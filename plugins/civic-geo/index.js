// OpenClaw tool plugin entry — plain ESM JS, no build step, no external deps.
// Targets the installed OpenClaw plugin API (definePluginEntry + api.registerTool),
// matching the bundled `tavily` extension. Tool params are plain JSON Schema, so we
// don't need TypeBox. The engine lives in ./src/geo.mjs (zero-dep, testable standalone).
//
// Point the engine at the datasets with CIVIC_DATA_DIR before starting the gateway.

import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import {
  findNearest,
  getDetails,
  geocode,
  safetyCount,
  listCoverage,
} from "./src/geo.mjs";

// OpenClaw tool result shape (MCP-style): text content the model reads back.
const ok = (obj) => ({ content: [{ type: "text", text: JSON.stringify(obj) }] });

export default definePluginEntry({
  id: "civic-geo",
  name: "Civic GeoJSON",
  description:
    "On-device lookups over London civic-facility GeoJSON datasets (libraries, " +
    "schools, public toilets, polling stations, grit bins, CCTV, reception centres).",
  register(api) {
    api.registerTool(
      () => ({
        name: "geocode",
        label: "Geocode a place (offline)",
        description:
          "Resolve a place name, landmark, postcode, or 'lat,lon' string to " +
          "coordinates, fully offline. Call this FIRST when the user names a place.",
        parameters: {
          type: "object",
          properties: { query: { type: "string", description: "e.g. '1 Triton Square', 'Brixton', '51.52,-0.13'" } },
          required: ["query"],
          additionalProperties: false,
        },
        execute: async (_id, p) => ok(geocode(p.query)),
      }),
      { name: "geocode" },
    );

    api.registerTool(
      () => ({
        name: "find_nearest",
        label: "Find nearest civic facilities",
        description:
          "Find the nearest civic facilities to a lat/lon. Optional category " +
          "(library, school, toilet, polling station, grit bin, cctv, reception centre), " +
          "limit, and radiusKm. Use after geocode.",
        parameters: {
          type: "object",
          properties: {
            lat: { type: "number" },
            lon: { type: "number" },
            category: { type: "string" },
            limit: { type: "integer" },
            radiusKm: { type: "number" },
          },
          required: ["lat", "lon"],
          additionalProperties: false,
        },
        execute: async (_id, p) =>
          ok(findNearest({ lat: p.lat, lon: p.lon, category: p.category, limit: p.limit ?? 3, radiusKm: p.radiusKm })),
      }),
      { name: "find_nearest" },
    );

    api.registerTool(
      () => ({
        name: "get_details",
        label: "Facility details",
        description: "Full details for one facility by id (as returned by find_nearest, e.g. 'libraries:7').",
        parameters: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
          additionalProperties: false,
        },
        execute: async (_id, p) => ok(getDetails(p.id)),
      }),
      { name: "get_details" },
    );

    api.registerTool(
      () => ({
        name: "safety_count",
        label: "Monitored-streets signal",
        description:
          "Count CCTV cameras (and grit bins) within a radius of a point — the " +
          "'monitored / busy streets' signal. NOTE: CCTV here is mostly traffic/town " +
          "cameras (busy, well-served roads), NOT crime surveillance.",
        parameters: {
          type: "object",
          properties: { lat: { type: "number" }, lon: { type: "number" }, radiusM: { type: "number" } },
          required: ["lat", "lon"],
          additionalProperties: false,
        },
        execute: async (_id, p) => ok(safetyCount({ lat: p.lat, lon: p.lon, radiusM: p.radiusM ?? 400 })),
      }),
      { name: "safety_count" },
    );

    api.registerTool(
      () => ({
        name: "list_coverage",
        label: "Data coverage",
        description: "Which facilities and boroughs we have data for, with counts. Use to avoid over-promising.",
        parameters: { type: "object", properties: {}, additionalProperties: false },
        execute: async () => ok(listCoverage()),
      }),
      { name: "list_coverage" },
    );
  },
});
