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
import { geocode, findNearest, safetyCount, getDetails, listCoverage } from "../plugins/civic-geo/src/geo.mjs";

const PORT = Number(process.env.BRIDGE_PORT || 8091);
const EL_KEY = process.env.ELEVENLABS_API_KEY || "";
const EL_VOICE = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
const EL_MODEL = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";
const OC = process.env.OPENCLAW_BIN || "openclaw";

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

function runAgent(message, session = "codeborough-ui", lang) {
  // Ask the agent to answer in the user's language (place names/addresses stay as-is).
  const msg = lang && !/^english$/i.test(lang)
    ? `${message}\n\n(Reply in ${lang}. Keep place names, addresses and postcodes unchanged.)`
    : message;
  return new Promise((resolve) => {
    const args = ["agent", "--agent", "main", "--session-id", session, "--message", msg];
    const p = spawn(OC, args, { env: process.env });
    let out = "";
    p.stdout.on("data", (c) => (out += c));
    p.stderr.on("data", (c) => (out += c));
    p.on("close", () => resolve(cleanReply(out) || "(no reply)"));
    p.on("error", (e) => resolve("agent error: " + e.message));
  });
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

// Real walking directions via a public OSRM foot-routing server (network call; degrades gracefully).
async function route({ fromLat, fromLon, toLat, toLon }) {
  const u = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${fromLon},${fromLat};${toLon},${toLat}?overview=false&steps=true`;
  const r = await fetch(u, { headers: { "User-Agent": "Codeborough/1.0 (hackathon)" } });
  if (!r.ok) throw new Error("OSRM " + r.status);
  const j = await r.json();
  const rt = j.routes && j.routes[0];
  if (!rt) return { steps: [] };
  const VERB = { depart: "Head", turn: "Turn", continue: "Continue", "new name": "Continue", arrive: "Arrive", roundabout: "Take the roundabout", rotary: "Take the roundabout", merge: "Merge", fork: "Keep", "end of road": "Turn" };
  const steps = (rt.legs?.[0]?.steps || []).map((s) => {
    const m = s.maneuver || {};
    const verb = VERB[m.type] || "Continue";
    const dir = m.modifier ? " " + m.modifier : "";
    const on = s.name ? " on " + s.name : "";
    return { instruction: m.type === "arrive" ? "Arrive at your destination" : `${verb}${dir}${on}`, distanceM: Math.round(s.distance) };
  });
  return { distanceM: Math.round(rt.distance), durationS: Math.round(rt.duration), steps };
}

createServer(async (req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, CORS); return res.end(); }
  const url = req.url || "/";
  try {
    if (req.method === "GET" && url === "/health") return json(res, { ok: true, voice: !!EL_KEY });
    if (req.method !== "POST") return json(res, { error: "POST only" }, 405);
    const b = await body(req);
    if (url === "/ask") return json(res, { reply: await runAgent(b.message, b.session, b.lang) });
    if (url === "/route") return json(res, await route(b).catch((e) => ({ error: String(e.message || e), steps: [] })));
    if (url === "/geocode") return json(res, geocode(b.query));
    if (url === "/nearest")
      return json(res, findNearest({ lat: b.lat, lon: b.lon, category: b.category, limit: b.limit ?? 3, radiusKm: b.radiusKm }));
    if (url === "/safety") return json(res, safetyCount({ lat: b.lat, lon: b.lon, radiusM: b.radiusM ?? 400 }));
    if (url === "/details") return json(res, getDetails(b.id));
    if (url === "/coverage") return json(res, listCoverage());
    if (url === "/tts") {
      const audio = await tts(b.text || "");
      res.writeHead(200, { "Content-Type": "audio/mpeg", ...CORS });
      return res.end(audio);
    }
    return json(res, { error: "unknown endpoint" }, 404);
  } catch (e) {
    return json(res, { error: String(e.message || e) }, 500);
  }
}).listen(PORT, "127.0.0.1", () =>
  console.log(`Codeborough bridge on http://127.0.0.1:${PORT}  (voice: ${EL_KEY ? "on" : "off"})`),
);
