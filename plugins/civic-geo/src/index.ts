// OpenClaw adapter for the civic-geo engine.
//
// This is a THIN wrapper: it exposes the pure functions in ./geo.mjs as agent
// tools. All the real logic lives in geo.mjs (which runs with zero deps - see
// ../scripts/smoke.mjs). If the installed OpenClaw plugin SDK differs from what
// is assumed here, you only adjust THIS file; the engine is unaffected.
//
// Targets the documented OpenClaw plugin SDK (openclaw >= 2026.5.17):
//   defineToolPlugin from "openclaw/plugin-sdk/tool-plugin", schemas via TypeBox.
// On the box, verify with:  openclaw plugins build --entry ./dist/index.js
//                           openclaw plugins validate --entry ./dist/index.js
// If `typebox` does not resolve, use `@sinclair/typebox` (identical `Type` API).
// Point the engine at your datasets with the CIVIC_DATA_DIR env var before
// starting the gateway, e.g.  export CIVIC_DATA_DIR=/path/to/Codeborough/datasets

import { Type } from "typebox";
import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";
import {
  findNearest,
  getDetails,
  geocode,
  safetyCount,
  routeSafety,
  listCoverage,
} from "./geo.mjs";

export default defineToolPlugin({
  id: "civic-geo",
  name: "Civic GeoJSON",
  description:
    "Local lookups over London civic-facility GeoJSON datasets (libraries, " +
    "schools, public toilets, polling stations, grit bins, CCTV, reception " +
    "centres). All on-device; nothing leaves the box.",

  tools: (tool: any) => [
    tool({
      name: "find_nearest",
      description:
        "Find the nearest civic facilities to a lat/lon. Optionally filter by " +
        "category (library, school, toilet, polling station, grit bin, cctv, " +
        "reception centre) and/or a radius in km. Use after `geocode` turns a " +
        "place name into coordinates.",
      parameters: Type.Object({
        lat: Type.Number({ description: "Latitude (WGS84)" }),
        lon: Type.Number({ description: "Longitude (WGS84)" }),
        category: Type.Optional(
          Type.String({ description: "Facility type, e.g. 'library' or 'toilet'. Omit for all." }),
        ),
        limit: Type.Optional(Type.Integer({ description: "Max results (default 3)" })),
        radiusKm: Type.Optional(Type.Number({ description: "Only within this radius (km)" })),
      }),
      execute: async (a: any) =>
        findNearest({ lat: a.lat, lon: a.lon, category: a.category, limit: a.limit ?? 3, radiusKm: a.radiusKm }),
    }),

    tool({
      name: "get_details",
      description:
        "Get full details for one facility by its id (as returned by " +
        "find_nearest, e.g. 'libraries:7'). Use for opening hours, accessibility, etc.",
      parameters: Type.Object({
        id: Type.String({ description: "Facility id, 'facility:index' e.g. 'public-toilets:12'" }),
      }),
      execute: async (a: any) => getDetails(a.id),
    }),

    tool({
      name: "geocode",
      description:
        "Resolve a place name, landmark, postcode, or 'lat,lon' string to " +
        "coordinates, fully offline. Call this first when the user names a place.",
      parameters: Type.Object({
        query: Type.String({ description: "e.g. '1 Triton Square', 'Brixton', or '51.52,-0.13'" }),
      }),
      execute: async (a: any) => geocode(a.query),
    }),

    tool({
      name: "safety_count",
      description:
        "Count CCTV cameras (and grit bins) within a radius of a point - the " +
        "'monitored / busy streets' signal for safety-aware framing. Note: CCTV " +
        "is mostly traffic/town cameras (busy roads), NOT crime surveillance.",
      parameters: Type.Object({
        lat: Type.Number(),
        lon: Type.Number(),
        radiusM: Type.Optional(Type.Number({ description: "Radius in metres (default 400)" })),
      }),
      execute: async (a: any) => safetyCount({ lat: a.lat, lon: a.lon, radiusM: a.radiusM ?? 400 }),
    }),

    tool({
      name: "route_safety",
      description:
        "How 'monitored' a WALK is, not just a spot: counts CCTV/grit in a " +
        "corridor ALONG the route from origin to destination and returns the " +
        "percentage of the journey on monitored streets. Use for 'is the walk " +
        "there safe / well-lit / on busy roads'. Computed fully on-device. Same " +
        "honest caveat: these are mostly traffic cameras on busy roads, not crime data.",
      parameters: Type.Object({
        fromLat: Type.Number({ description: "Origin latitude" }),
        fromLon: Type.Number({ description: "Origin longitude" }),
        toLat: Type.Number({ description: "Destination latitude" }),
        toLon: Type.Number({ description: "Destination longitude" }),
        corridorM: Type.Optional(Type.Number({ description: "Corridor half-width in metres (default 150)" })),
      }),
      execute: async (a: any) =>
        routeSafety({ fromLat: a.fromLat, fromLon: a.fromLon, toLat: a.toLat, toLon: a.toLon, corridorM: a.corridorM ?? 150 }),
    }),

    tool({
      name: "list_coverage",
      description:
        "List which facilities and boroughs we actually have data for, with " +
        "counts. Use to avoid over-promising on places/types we don't cover.",
      parameters: Type.Object({}),
      execute: async () => listCoverage(),
    }),
  ],
});
