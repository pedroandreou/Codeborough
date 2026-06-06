// Civic GeoJSON engine - pure Node ESM, zero dependencies.
//
// This is the real IP of the plugin: loading the London civic datasets and
// answering "near me" / details / geocode / safety questions over them. It has
// NO OpenClaw or third-party imports so you can run and test it on stock Node
// (see ../scripts/smoke.mjs) before any hardware or `openclaw` install exists.
//
// The OpenClaw adapter (src/index.ts) is a thin wrapper that exposes these
// functions as agent tools. If the SDK API differs on the box, only the wrapper
// changes - this engine stays intact.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

// Datasets live at the repo root. Override with CIVIC_DATA_DIR on the box.
export const DATA_DIR =
  process.env.CIVIC_DATA_DIR || resolve(HERE, "..", "..", "..", "datasets");

// ---------------------------------------------------------------------------
// Per-facility field maps. Each borough's portal uses different field names, so
// we map each facility's name/address/highlight fields explicitly, with a
// generic fallback for anything unmapped.
// ---------------------------------------------------------------------------
const FIELDS = {
  libraries: {
    // "Library" = Wandsworth, "ATT1" = Kingston (its name lives in ATT1).
    name: ["Name", "Library", "ATT1"],
    address: ["Address 1", "Address 2", "Address", "Postcode"],
    extra: ["Type", "Hours open per week", "Email or website", "Telephone", "Website", "Web_Link"],
  },
  schools: {
    // "School" = Wandsworth. Camden ("establishment_name") and Lambeth
    // ("ESTABLISHMENT_NAME") now match "Establishment name" via punctuation-
    // insensitive key matching (see norm()).
    name: ["Establishment name", "School"],
    address: ["Street", "Town", "Address", "Postcode"],
    extra: ["Phase of education", "Type of establishment", "Gender", "Website address"],
  },
  "public-toilets": {
    name: ["LocationText"],
    address: ["StreetAddress", "Postcode"],
    extra: ["AccessibleCategory", "BabyChange", "OpeningHours", "Category", "ManagedBy"],
  },
  "polling-stations": {
    name: ["Polling place - name"],
    address: ["Polling place - address"],
    extra: ["Ward", "Polling district"],
  },
  "reception-centres": {
    name: ["reception_name"],
    address: ["reception_address", "location_city", "location_zip"],
    extra: ["reception_telephone_number", "reception_website"],
  },
  cctv: {
    name: ["Location", "Camera_Number"],
    address: ["Location_Area", "Ward"],
    extra: ["Camera_Functionality", "Camera_Model"],
  },
  "grit-bins": {
    // "REMARK"/"Street_Name" = Kingston/City-of-London street; note Kingston's
    // "ON_STREET" is a Y/N flag, NOT a street name, so it is deliberately absent.
    name: ["road_name", "description", "REMARK", "Street_Name", "Description"],
    address: ["road_name", "Street_Name"],
    extra: ["website", "description"],
  },
};

const GENERIC_NAME = ["name", "Name", "title", "Title", "Location", "description"];

// Human-facing category synonyms → facility folder name.
const CATEGORY_ALIASES = {
  library: "libraries",
  libraries: "libraries",
  school: "schools",
  schools: "schools",
  toilet: "public-toilets",
  toilets: "public-toilets",
  "public toilet": "public-toilets",
  "public toilets": "public-toilets",
  loo: "public-toilets",
  "polling station": "polling-stations",
  "polling stations": "polling-stations",
  polling: "polling-stations",
  vote: "polling-stations",
  "grit bin": "grit-bins",
  "grit bins": "grit-bins",
  grit: "grit-bins",
  cctv: "cctv",
  camera: "cctv",
  cameras: "cctv",
  "reception centre": "reception-centres",
  "reception centres": "reception-centres",
  reception: "reception-centres",
  "rest centre": "reception-centres",
};

// Approximate landmark gazetteer for offline geocoding of common demo places.
// [lat, lon]. Approximate to street/area level - fine for "near me" framing.
const LANDMARKS = {
  "triton square": [51.5247, -0.1417],
  "1 triton square": [51.5247, -0.1417],
  "regents place": [51.5247, -0.1417],
  "regent's place": [51.5247, -0.1417],
  warren: [51.5247, -0.1417],
  "warren street": [51.5247, -0.1417],
  euston: [51.5282, -0.1337],
  "kings cross": [51.5308, -0.1238],
  "king's cross": [51.5308, -0.1238],
  camden: [51.539, -0.1426],
  "camden town": [51.539, -0.1426],
  brixton: [51.4626, -0.1145],
  "brixton station": [51.4627, -0.1145],
  lambeth: [51.4607, -0.1163],
  wandsworth: [51.4571, -0.1818],
  clapham: [51.4618, -0.1384],
  kingston: [51.4123, -0.3007],
  "kingston upon thames": [51.4123, -0.3007],
  barnet: [51.6444, -0.1997],
  "city of london": [51.5155, -0.0922],
  "kensington and chelsea": [51.4991, -0.1938],
  kensington: [51.4991, -0.1938],
  "hammersmith and fulham": [51.4927, -0.224],
  hammersmith: [51.4927, -0.224],
  westminster: [51.4975, -0.1357],
  "central london": [51.5074, -0.1278],
  london: [51.5074, -0.1278],
};

// ---------------------------------------------------------------------------
// Loading + caching
// ---------------------------------------------------------------------------
const _cache = new Map();

/** List the facility folders that have a merged all-London file. */
export function facilities() {
  if (!existsSync(DATA_DIR)) return [];
  return readdirSync(DATA_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((f) =>
      existsSync(join(DATA_DIR, f, `${f}-all-london.geojson`)),
    )
    .sort();
}

/** Load one facility's features (cached), each tagged with a synthetic id. */
export function load(facility) {
  if (_cache.has(facility)) return _cache.get(facility);
  const file = join(DATA_DIR, facility, `${facility}-all-london.geojson`);
  if (!existsSync(file)) {
    _cache.set(facility, []);
    return [];
  }
  const gj = JSON.parse(readFileSync(file, "utf8"));
  const feats = (gj.features || [])
    .map((f, i) => {
      const c = f.geometry && f.geometry.coordinates;
      if (!Array.isArray(c) || c.length < 2) return null;
      const lon = Number(c[0]);
      const lat = Number(c[1]);
      if (!isFinite(lat) || !isFinite(lon)) return null;
      return {
        id: `${facility}:${i}`,
        facility,
        lat,
        lon,
        borough: f.properties?._borough || null,
        props: f.properties || {},
      };
    })
    .filter(Boolean);
  _cache.set(facility, feats);
  return feats;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const R = 6371000; // Earth radius, metres
const rad = (d) => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversine(lat1, lon1, lat2, lon2) {
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Property keys vary per BOROUGH, not just per facility, so we match candidate
// field names against whatever keys a record actually has. Matching is both
// case- AND punctuation-insensitive: portals spell the same field as
// "Establishment name" (Barnet), "establishment_name" (Camden/Socrata) and
// "ESTABLISHMENT_NAME" (Lambeth/ArcGIS). norm() collapses all three to one key
// so a single candidate covers every borough's spelling.
const lc = (s) => String(s).toLowerCase();
const norm = (s) => lc(s).replace(/[^a-z0-9]+/g, "");

function indexProps(props) {
  const m = {};
  // Insert in key order; first writer wins so earlier (often canonical) keys
  // are not clobbered by a later key that normalises to the same token.
  for (const k of Object.keys(props)) {
    const n = norm(k);
    if (!(n in m)) m[n] = props[k];
  }
  return m;
}

// Some portals nest a value in an object, e.g. Camden Socrata stores
// website as {"url": "..."}. Flatten those to the meaningful string.
function coerce(v) {
  if (v != null && typeof v === "object" && !Array.isArray(v))
    return v.url || v.href || v.value || null;
  return v;
}

/** First non-empty value among candidate field names (case/punct-insensitive). */
function pick(props, candidates) {
  const idx = indexProps(props);
  for (const c of candidates) {
    const v = coerce(idx[norm(c)]);
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

// Ordered most-specific-first, unioned across every borough schema we've seen.
const NAME_CANDIDATES = [
  "Name", "name", "Establishment name", "Polling place - name", "POLLINGPLACENAME",
  "reception_name", "LocationText", "Label", "PROPERTY", "BLDG_NAME", "Location",
  "road_name", "description", "Camera_Number", "LEGEND2", "title",
];
const STREET_CANDIDATES = [
  "Address", "Polling place - address", "reception_address", "StreetAddress",
  "Street", "street", "Address 1", "Location_Area", "road_name",
];
const TOWN_CANDIDATES = ["Town", "location_city", "Address 2"];
const POSTCODE_CANDIDATES = ["Postcode", "postcode", "location_zip"];
// Generic "highlights" worth speaking aloud (accessibility, hours, contact, type).
const HIGHLIGHT_RE = /open|hour|accessib|baby|phone|telephone|website|email|^type$|facilit/i;

function nameOf(rec) {
  const map = FIELDS[rec.facility];
  const named =
    (map && pick(rec.props, map.name)) ||
    pick(rec.props, NAME_CANDIDATES) ||
    pick(rec.props, GENERIC_NAME);
  if (named) return named;
  // No name field in this borough's schema (e.g. Camden/Wandsworth polling
  // stations are address-only). Synthesise a human label from the address so a
  // voice agent says "Polling station, Stukeley Street, WC2B 5LL" rather than
  // the meaningless "polling-stations 143".
  const human = humanFacility(rec.facility);
  const addr = addressOf(rec);
  return addr ? `${human}, ${addr}` : `${human} ${rec.id.split(":")[1]}`;
}

// Singular, human-facing label for a facility folder name.
const FACILITY_LABELS = {
  "polling-stations": "Polling station",
  "grit-bins": "Grit bin",
  "public-toilets": "Public toilet",
  "reception-centres": "Reception centre",
  libraries: "Library",
  schools: "School",
  cctv: "CCTV camera",
};
function humanFacility(f) {
  return FACILITY_LABELS[f] || f.replace(/-/g, " ");
}

function addressOf(rec) {
  const map = FIELDS[rec.facility];
  const street = (map && pick(rec.props, map.address)) || pick(rec.props, STREET_CANDIDATES);
  const town = pick(rec.props, TOWN_CANDIDATES);
  const postcode = pick(rec.props, POSTCODE_CANDIDATES);
  const parts = [street, town, postcode].filter(Boolean);
  return parts.length ? [...new Set(parts)].join(", ") : null;
}

function extraOf(rec) {
  const out = {};
  // mapped highlights first (case-insensitive)
  const map = FIELDS[rec.facility];
  if (map) for (const k of map.extra) {
    const v = pick(rec.props, [k]);
    if (v) out[k] = v;
  }
  // then generic highlights from any remaining matching keys (bounded)
  for (const [k, raw] of Object.entries(rec.props)) {
    if (Object.keys(out).length >= 5) break;
    if (k === "_borough" || out[k]) continue;
    const v = coerce(raw);
    if (HIGHLIGHT_RE.test(k) && v != null && String(v).trim() !== "")
      out[k] = String(v).trim();
  }
  return out;
}

/** Shape one record for an answer. */
function summarise(rec, distance_m) {
  const out = {
    id: rec.id,
    facility: rec.facility,
    name: nameOf(rec),
    borough: rec.borough,
    address: addressOf(rec),
    lat: rec.lat,
    lon: rec.lon,
    extra: extraOf(rec),
  };
  if (distance_m != null) out.distance_m = Math.round(distance_m);
  return out;
}

/** Normalise a category string to a facility folder name, or null. */
export function normaliseCategory(cat) {
  if (!cat) return null;
  const c = String(cat).toLowerCase().trim();
  if (CATEGORY_ALIASES[c]) return CATEGORY_ALIASES[c];
  if (facilities().includes(c)) return c;
  // loose contains match
  for (const [k, v] of Object.entries(CATEGORY_ALIASES)) {
    if (c.includes(k)) return v;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Tool functions
// ---------------------------------------------------------------------------

/**
 * Nearest facilities to a point.
 * @param {{lat:number, lon:number, category?:string, limit?:number, radiusKm?:number}} o
 */
export function findNearest({ lat, lon, category, limit = 3, radiusKm } = {}) {
  if (!isFinite(lat) || !isFinite(lon))
    throw new Error("lat and lon are required numbers");
  const cat = category ? normaliseCategory(category) : null;
  if (category && !cat)
    return {
      query: { lat, lon, category },
      error: `Unknown category "${category}". Available: ${facilities().join(", ")}`,
      results: [],
    };
  const pool = cat ? [cat] : facilities();
  const maxM = radiusKm ? radiusKm * 1000 : Infinity;
  const scored = [];
  for (const f of pool) {
    for (const rec of load(f)) {
      const d = haversine(lat, lon, rec.lat, rec.lon);
      if (d <= maxM) scored.push([d, rec]);
    }
  }
  scored.sort((a, b) => a[0] - b[0]);
  return {
    query: { lat, lon, category: cat || "all", limit, radiusKm: radiusKm || null },
    count: scored.length,
    results: scored.slice(0, limit).map(([d, rec]) => summarise(rec, d)),
  };
}

/** Full details for one facility by synthetic id ("facility:index"). */
export function getDetails(id) {
  if (!id || !id.includes(":")) throw new Error('id must look like "facility:index"');
  const [facility] = id.split(":");
  const rec = load(facility).find((r) => r.id === id);
  if (!rec) return { id, error: "Not found" };
  return { ...summarise(rec, null), props: rec.props };
}

/**
 * Offline geocode: resolve a place/landmark/postcode/"lat,lon" to coordinates.
 * Falls back to matching dataset names/addresses if no landmark hits.
 */
export function geocode(query) {
  if (!query) throw new Error("query is required");
  const q = String(query).toLowerCase().trim();

  // direct "lat,lon"
  const m = q.match(/^(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)$/);
  if (m) return { query, lat: Number(m[1]), lon: Number(m[3]), source: "coords" };

  // landmark gazetteer (exact then contains)
  if (LANDMARKS[q])
    return { query, lat: LANDMARKS[q][0], lon: LANDMARKS[q][1], source: "landmark", approximate: true };
  for (const [k, v] of Object.entries(LANDMARKS)) {
    if (q.includes(k)) return { query, lat: v[0], lon: v[1], source: `landmark:${k}`, approximate: true };
  }

  // fall back to a facility record whose name/address/postcode matches
  for (const f of facilities()) {
    for (const rec of load(f)) {
      const hay = [nameOf(rec), addressOf(rec)].filter(Boolean).join(" ").toLowerCase();
      if (hay && hay.includes(q))
        return {
          query,
          lat: rec.lat,
          lon: rec.lon,
          source: `dataset:${rec.id}`,
          matched: nameOf(rec),
          approximate: true,
        };
    }
  }
  return { query, error: "Could not geocode. Try a known landmark, a postcode, or 'lat,lon'." };
}

/**
 * "Monitored streets" signal: how many CCTV cameras (and grit bins) are within
 * a radius of a point. Powers the safety-aware framing. Honest wording: these
 * are mostly traffic/town cameras = busy, well-served roads, NOT crime surveillance.
 * @param {{lat:number, lon:number, radiusM?:number}} o
 */
export function safetyCount({ lat, lon, radiusM = 400 } = {}) {
  if (!isFinite(lat) || !isFinite(lon))
    throw new Error("lat and lon are required numbers");
  const within = (facility) =>
    load(facility)
      .map((rec) => [haversine(lat, lon, rec.lat, rec.lon), rec])
      .filter(([d]) => d <= radiusM)
      .sort((a, b) => a[0] - b[0]);
  const cams = within("cctv");
  const grit = within("grit-bins");
  return {
    query: { lat, lon, radiusM },
    cctv_count: cams.length,
    grit_bin_count: grit.length,
    nearest_cameras: cams.slice(0, 3).map(([d, rec]) => summarise(rec, d)),
    note:
      "CCTV here is mostly traffic/town-centre cameras (busy, well-served roads), not crime surveillance.",
  };
}

/** What we actually cover, per facility, so the agent never over-promises. */
export function listCoverage() {
  return facilities().map((f) => {
    const recs = load(f);
    const boroughs = {};
    for (const r of recs) boroughs[r.borough || "?"] = (boroughs[r.borough || "?"] || 0) + 1;
    return { facility: f, total: recs.length, boroughs };
  });
}
