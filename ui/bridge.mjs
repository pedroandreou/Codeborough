// Codeborough UI bridge - tiny zero-dependency Node HTTP server that connects
// our web UI to the live agent + data + ElevenLabs voice. Run it ON the DGX.
//
//   ELEVENLABS_API_KEY=sk_... ELEVENLABS_VOICE_ID=... \
//   CIVIC_DATA_DIR=$HOME/Desktop/Codeborough/datasets \
//   node ui/bridge.mjs            # serves on :8091
//
// Endpoints (all CORS-open for the tunneled browser):
//   POST /ask     {message, session?}  -> {reply}           (runs the OpenClaw agent: Nemotron + civic-geo + memory)
//   POST /geocode {query}              -> geocode(...)        (for the map)
//   POST /nearest {lat,lon,category?,limit?,radiusKm?} -> findNearest(...)
//   POST /safety  {lat,lon,radiusM?}   -> safetyCount(...)
//   POST /tts     {text}               -> audio/mpeg          (ElevenLabs, key stays server-side)
//   GET  /health                       -> {ok:true}

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { writeFileSync, readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { geocode, findNearest, safetyCount, routeSafety, getDetails, listCoverage } from "../plugins/civic-geo/src/geo.mjs";

const PORT = Number(process.env.BRIDGE_PORT || 8091);
const EL_KEY = process.env.ELEVENLABS_API_KEY || "";
const EL_VOICE = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
const EL_MODEL = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";
const OC = process.env.OPENCLAW_BIN || "openclaw";
const OC_HTTP = process.env.OPENCLAW_HTTP_URL || ""; // set to the gateway agent endpoint to skip CLI stdout-scraping
const OC_TOKEN = process.env.OPENCLAW_TOKEN || "";
// Optional fully-on-device speech-to-text (e.g. whisper.cpp). Command template with
// {in} = input audio path, {out} = output basename. Example:
//   LOCAL_STT_CMD="/opt/whisper.cpp/main -m /models/ggml-base.en.bin -nt -otxt -f {in} -of {out}"
// When unset, /stt returns an empty transcript and the UI falls back to browser STT.
const STT_CMD = process.env.LOCAL_STT_CMD || "";
// Optional "where do I vote" API for the ASSIGNED (not just nearest) polling station.
// Template with {postcode}, e.g. a Democracy Club / Electoral Commission endpoint.
// Off by default - when unset, /polling returns the on-device NEAREST station.
const POLLING_URL = process.env.POLLING_LOOKUP_URL || "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (res, obj, code = 200) => {
  res.writeHead(code, { "Content-Type": "application/json", ...CORS });
  res.end(JSON.stringify(obj));
};
const body = (req) =>
  new Promise((resolve) => {
    let d = "";
    req.on("data", (c) => (d += c));
    req.on("end", () => { try { resolve(d ? JSON.parse(d) : {}); } catch { resolve({}); } });
  });

// Strip OpenClaw's banners/warnings/box-drawing from `openclaw agent` stdout,
// leaving just the assistant's reply text.
function cleanReply(out) {
  const ansi = /\x1b\[[0-9;?]*[ -\/]*[@-~]/g;
  const noise =
    /^(\[plugins\]|plugins\.allow|Config \(|\[gateway\]|EMBEDDED FALLBACK|Gateway target:|Source:|Config:|Bind:|gateway connect failed|Possible causes:|- |Run `openclaw|Stopped systemd|Restarted systemd|Usage:|Updating|nohup:)/;
  const boxy = /[│◇├╮╯╰┌┐└┘▄▀█░▕▏▁]/;
  return out
    .replace(ansi, "")
    .replace(/\uFFFD\[[0-9;?]*[ -\/]*[@-~]/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => {
      const t = l.trim();
      return t && t !== "NO_REPLY" && !noise.test(t) && !boxy.test(t) && !t.startsWith("![") && !t.includes("(embed ref=") && !t.startsWith("<function=") && !t.startsWith("</function>") && !t.startsWith("<parameter=") && !t.startsWith("</parameter>") && !t.startsWith("title=\"") && !t.startsWith("height=\"");
    })
    .join("\n")
    .trim();
}

// Build the message we hand the agent. When `grounded` is supplied (the JSON the
// civic-geo tools already computed for the on-screen card), we PIN the agent to
// those facts - it narrates them instead of independently geocoding, so the spoken
// reply can't disagree with the card. This is the fix for the old "split-brain".
function composeMessage(message, lang, grounded) {
  let m = message;
  if (grounded)
    m += `\n\n[Grounded facts from civic-geo - answer using ONLY these; do not invent or re-look-up places]\n${grounded}`;
  if (lang && !/^english$/i.test(lang))
    m += `\n\n(Reply in ${lang}. Keep place names, addresses and postcodes unchanged.)`;
  return m;
}

// PREFERRED transport: a structured HTTP call to the OpenClaw gateway - no stdout
// scraping, no regex scrubbing. Set OPENCLAW_HTTP_URL to the gateway's agent
// endpoint on the box (e.g. http://127.0.0.1:18789/agent). We accept several
// response shapes so this adapts to the real API without a code change.
async function agentViaHttp(message, session) {
  const r = await fetch(OC_HTTP, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(OC_TOKEN ? { Authorization: `Bearer ${OC_TOKEN}` } : {}) },
    body: JSON.stringify({ agent: "main", session, sessionId: session, message }),
  });
  if (!r.ok) throw new Error("agent http " + r.status);
  const j = await r.json();
  const reply = j.reply || j.content || j.text || j.message?.content || j.choices?.[0]?.message?.content;
  if (!reply) throw new Error("agent http: no reply field");
  return String(reply).trim();
}

// FALLBACK transport: the CLI, stdout scrubbed. Kept so a missing/changed HTTP
// API never hard-fails the demo - but it's no longer the primary path.
function agentViaCli(message, session) {
  return new Promise((resolve) => {
    const args = ["agent", "--agent", "main", "--session-id", session, "--message", message];
    const p = spawn(OC, args, { env: process.env });
    let out = "";
    p.stdout.on("data", (c) => (out += c));
    p.stderr.on("data", (c) => (out += c));
    p.on("close", () => resolve(cleanReply(out) || "(no reply)"));
    p.on("error", (e) => resolve("agent error: " + e.message));
  });
}

async function runAgent(message, session = "codeborough-ui", lang, grounded) {
  const msg = composeMessage(message, lang, grounded);
  if (OC_HTTP) {
    try { return await agentViaHttp(msg, session); }
    catch (e) { console.error("[agent] HTTP failed (" + e.message + "), falling back to CLI"); }
  }
  return agentViaCli(msg, session);
}

async function tts(text) {
  if (!EL_KEY) throw new Error("ELEVENLABS_API_KEY not set");
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${EL_VOICE}`, {
    method: "POST",
    headers: { "xi-api-key": EL_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: EL_MODEL }),
  });
  if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return Buffer.from(await r.arrayBuffer());
}

// On-device speech-to-text via a local whisper binary (no audio leaves the box).
// Body: { audio: "<base64>", ext?: "webm" }. Returns { transcript, engine } or an
// empty transcript + error so the browser can fall back to its own STT.
async function sttLocal(b) {
  if (!STT_CMD) return { transcript: "", error: "local STT not configured (set LOCAL_STT_CMD)" };
  if (!b || !b.audio) return { transcript: "", error: "no audio" };
  const dir = mkdtempSync(join(tmpdir(), "cb-stt-"));
  const inFile = join(dir, "in." + (b.ext || "webm"));
  const outBase = join(dir, "out");
  try {
    writeFileSync(inFile, Buffer.from(b.audio, "base64"));
    const cmd = STT_CMD.replaceAll("{in}", inFile).replaceAll("{out}", outBase);
    const [bin, ...args] = cmd.split(/\s+/);
    let stdout = await new Promise((resolve, reject) => {
      let o = "";
      const p = spawn(bin, args, { env: process.env });
      p.stdout.on("data", (c) => (o += c));
      p.stderr.on("data", () => {});
      p.on("close", () => resolve(o));
      p.on("error", reject);
    });
    // Prefer a produced transcript file (whisper writes {out}.txt); else use stdout.
    let transcript = "";
    for (const f of [outBase + ".txt", inFile.replace(/\.[^.]+$/, ".txt")]) {
      try { transcript = readFileSync(f, "utf8"); break; } catch {}
    }
    return { transcript: (transcript || stdout).trim(), engine: "local" };
  } catch (e) {
    return { transcript: "", error: String(e.message || e) };
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch {}
  }
}

// Walking directions: turn-by-turn geometry from a public OSRM foot-router (the ONE
// optional network call - degrades gracefully to a straight line if offline). The
// SAFETY scoring runs on-device over our own CCTV/grit data, so even when the route
// shape comes from the network, the "how monitored is my walk" answer never leaves
// the box. Set ROUTING_DISABLE=1 to stay fully offline (straight-line corridor only).
async function route({ fromLat, fromLon, toLat, toLon, corridorM }) {
  let geo = null, distanceM = null, durationS = null, steps = [];
  if (!process.env.ROUTING_DISABLE) {
    try {
      const u = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson&steps=true`;
      const r = await fetch(u, { headers: { "User-Agent": "Codeborough/1.0 (hackathon)" } });
      if (!r.ok) throw new Error("OSRM " + r.status);
      const rt = (await r.json()).routes?.[0];
      if (rt) {
        distanceM = Math.round(rt.distance); durationS = Math.round(rt.duration);
        geo = rt.geometry?.coordinates || null; // [[lon,lat],...]
        const VERB = { depart: "Head", turn: "Turn", continue: "Continue", "new name": "Continue", arrive: "Arrive", roundabout: "Take the roundabout", rotary: "Take the roundabout", merge: "Merge", fork: "Keep", "end of road": "Turn" };
        steps = (rt.legs?.[0]?.steps || []).map((s) => {
          const m = s.maneuver || {};
          const on = s.name ? " on " + s.name : "";
          return { instruction: m.type === "arrive" ? "Arrive at your destination" : `${VERB[m.type] || "Continue"}${m.modifier ? " " + m.modifier : ""}${on}`, distanceM: Math.round(s.distance) };
        });
      }
    } catch (e) { /* offline / blocked - fall back to straight-line safety below */ }
  }
  // On-device monitored-streets scoring along the ACTUAL route (or straight line).
  const polyline = geo ? geo.map(([lon, lat]) => [lat, lon]) : null;
  let safety = null;
  try {
    safety = routeSafety({ fromLat, fromLon, toLat, toLon, polyline, corridorM: corridorM ?? 150 });
  } catch (e) { /* missing coords - leave safety null */ }
  return { distanceM: distanceM ?? safety?.route_length_m ?? null, durationS, steps, geometry: geo, safety };
}

// Where do I vote? On-device default = NEAREST polling station (honest: not always
// your assigned one). Set POLLING_LOOKUP_URL to a government "where do I vote" API
// template (with {postcode}) to get the ASSIGNED station - one optional network call,
// clearly labelled, off by default. We parse tolerantly across response shapes.
async function pollingStation(b) {
  const { postcode } = b;
  // Optional: the correct, assigned station from an official postcode API.
  if (POLLING_URL && postcode) {
    try {
      const r = await fetch(POLLING_URL.replaceAll("{postcode}", encodeURIComponent(String(postcode).replace(/\s+/g, ""))),
        { headers: { "User-Agent": "Codeborough/1.0 (hackathon)" } });
      if (r.ok) {
        const j = await r.json();
        const ps = j.polling_station?.properties || j.polling_station || j.station || null;
        if (ps && (ps.address || ps.name || ps.polling_station_id)) {
          return { assigned: true, method: "official-api", source: POLLING_URL.split("?")[0],
            station: { name: ps.name || "Your polling station", address: ps.address || ps.polling_place || null,
              lat: ps.latitude ?? ps.lat ?? null, lon: ps.longitude ?? ps.lon ?? null } };
        }
        // API reached but couldn't confirm a station for this postcode - say so, don't guess.
        return { assigned: false, method: "nearest", note: "Couldn't confirm an assigned station; showing nearest.",
          ...nearestPolling(b) };
      }
    } catch (e) { /* fall through to on-device nearest */ }
  }
  return { assigned: false, method: "nearest", ...nearestPolling(b) };
}

// On-device nearest polling station from a postcode or lat/lon (no network).
function nearestPolling(b) {
  let { lat, lon } = b;
  if ((lat == null || lon == null) && b.postcode) {
    const g = geocode(b.postcode);
    if (typeof g.lat === "number") { lat = g.lat; lon = g.lon; }
    else return { error: g.error || "Could not locate that postcode.", station: null };
  }
  if (lat == null || lon == null) return { error: "Need a postcode or coordinates.", station: null };
  const near = findNearest({ lat, lon, category: "polling station", limit: 1 });
  const s = near.results?.[0] || null;
  return { station: s, note: "Nearest polling station - confirm it's where you're registered to vote." };
}

createServer(async (req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, CORS); return res.end(); }
  const url = req.url || "/";
  try {
    if (req.method === "GET" && url === "/health") return json(res, { ok: true, voice: !!EL_KEY });
    // Serve the UI page itself so the browser can open the bridge directly (http://<box>:8091).
    if (req.method === "GET" && (url === "/" || url === "/index.html" || url === "/ui/" || url === "/ui/index.html")) {
      try {
        const html = readFileSync(new URL("./index.html", import.meta.url));
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", ...CORS });
        return res.end(html);
      } catch {
        return json(res, { error: "UI page not found next to bridge.mjs" }, 404);
      }
    }
    if (req.method !== "POST") return json(res, { error: "POST only" }, 405);
    const b = await body(req);
    if (url === "/ask") return json(res, { reply: await runAgent(b.message, b.session, b.lang, b.grounded) });
    if (url === "/route") return json(res, await route(b).catch((e) => ({ error: String(e.message || e), steps: [] })));
    if (url === "/geocode") return json(res, geocode(b.query));
    if (url === "/nearest")
      return json(res, findNearest({ lat: b.lat, lon: b.lon, category: b.category, limit: b.limit ?? 3, radiusKm: b.radiusKm }));
    if (url === "/safety") return json(res, safetyCount({ lat: b.lat, lon: b.lon, radiusM: b.radiusM ?? 400 }));
    if (url === "/details") return json(res, getDetails(b.id));
    if (url === "/coverage") return json(res, listCoverage());
    if (url === "/stt") return json(res, await sttLocal(b));
    if (url === "/polling") return json(res, await pollingStation(b));
    if (url === "/tts") {
      const audio = await tts(b.text || "");
      res.writeHead(200, { "Content-Type": "audio/mpeg", ...CORS });
      return res.end(audio);
    }
    return json(res, { error: "unknown endpoint" }, 404);
  } catch (e) {
    return json(res, { error: String(e.message || e) }, 500);
  }
}).listen(PORT, "0.0.0.0", () =>
  console.log(`Codeborough bridge on http://0.0.0.0:${PORT}  (voice: ${EL_KEY ? "on" : "off"})`),
);
