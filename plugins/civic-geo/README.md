# civic-geo - OpenClaw tool plugin

On-device geospatial computation over the London civic-facility GeoJSON datasets,
exposed to an OpenClaw agent as tools. Pure-Node engine with zero runtime
dependencies — testable against the real datasets with no GPU, no API key, and no
install step.

## Layout

```
plugins/civic-geo/
├── src/geo.mjs        engine — all geospatial logic, zero dependencies
├── src/index.ts       thin OpenClaw adapter exposing the engine as tools
├── scripts/smoke.mjs  zero-install validator against the real datasets
├── package.json
├── tsconfig.json
└── README.md
```

## Tools exposed

Six tools are registered by `src/index.ts`:

| Tool | What it computes |
|---|---|
| `geocode(query)` | Resolves a place name, landmark, postcode, or `"lat,lon"` to coordinates — offline. Four-layer strategy: literal coords → postcode centroid (built at runtime from dataset records) → landmark gazetteer → substring match against dataset names/addresses. |
| `find_nearest(lat, lon, category?, limit?, radiusKm?)` | Brute-force nearest-neighbour search: computes haversine distance from the query point to every record in the relevant dataset(s), filters by optional radius, sorts ascending, returns top N with formatted results. |
| `get_details(id)` | Returns the full record for one facility by synthetic id. Runs the field-normalisation layer to resolve accessibility, hours, and contact fields across different borough schemas. |
| `safety_count(lat, lon, radiusM?)` | Counts CCTV cameras and grit bins within a radius — a "monitored/busy streets" density signal. |
| `route_safety(fromLat, fromLon, toLat, toLon, corridorM?)` | Spatial geometry: projects lat/lon to planar XY, computes point-to-segment distance from each camera to the route, samples the path every ~120 m, and returns the percentage of the journey within a corridor of a camera. Accepts a full polyline (e.g. from OSRM) for accuracy, or falls back to a straight origin→destination line. |
| `list_coverage()` | Aggregates loaded records by facility and borough — lets the agent state coverage honestly rather than over-promising. |

Categories accepted by `find_nearest` (with synonyms): library, school, toilet,
polling station, grit bin, cctv/camera, reception centre.

## What the engine actually does (not "just lookups")

`geo.mjs` is deterministic code, not a retrieval model — but it's also not
key-value lookups. The meaningful computation:

- **Field normalisation across 8 borough schemas.** Each council's portal uses
  different field names (`Establishment name` / `establishment_name` /
  `ESTABLISHMENT_NAME`). The engine strips case and punctuation to a canonical
  token, then picks the first non-empty match across every candidate name. It also
  flattens nested values (Camden Socrata stores website as `{"url": "..."}`), and
  synthesises a human name when a borough's records have no name field at all
  (e.g. `"Polling station, Stukeley Street, WC2B 5LL"`).

- **Postcode geocoding built from the data itself.** No postcode file is shipped.
  At first call the engine scans every record, groups by postcode, and computes
  a centroid (averages lat/lon across records sharing that postcode). A full
  postcode resolves to its centroid; an outward code (`SW2`) resolves to the
  district centroid. Anything not in our coverage returns an honest error.

- **Route-corridor geometry.** `routeSafety` uses an equirectangular projection
  to convert lat/lon to metres, then computes the perpendicular distance from
  each camera to each route segment. It samples the route at ~120 m intervals
  and counts what fraction of sample points fall within `corridorM` of a camera.
  This monitored percentage is derived spatial math — nothing about it is a lookup.

The separation of labour: Nemotron decides which tool to call and with what
arguments; the engine computes the actual geospatial answer deterministically.
This is why answers are reproducible and can't be hallucinated, and why the entire
engine can be validated on stock Node before any model or GPU is involved.

## 1. Validate the engine (no install, no hardware)

```bash
node plugins/civic-geo/scripts/smoke.mjs
```

Exercises all six tools against the real `datasets/`. Expected output: Triton
Square → Regent's Park library at ~415 m; 41 cameras within 500 m of Brixton;
route-safety corridor along Brixton → nearest polling station.

Override the data path if needed:

```bash
CIVIC_DATA_DIR=/abs/path/to/Codeborough/datasets node plugins/civic-geo/scripts/smoke.mjs
```

## 2. Install as an OpenClaw plugin (on the box)

```bash
cd plugins/civic-geo
npm install
npm run build                                   # tsc -> dist/

# point the engine at the deployed datasets before the gateway starts:
export CIVIC_DATA_DIR=/abs/path/to/Codeborough/datasets

openclaw plugins build  --entry ./dist/index.js # regenerates openclaw.plugin.json contracts.tools
openclaw plugins validate --entry ./dist/index.js
openclaw plugins install ./                      # install this plugin dir
openclaw gateway stop && openclaw gateway --port 18789 --verbose
openclaw plugins inspect civic-geo --runtime --json   # confirm 6 tools registered

openclaw agent --agent main --message "nearest library to 1 Triton Square"   # tool should fire
```

## Notes / caveats (read before debugging)

- **SDK version:** `src/index.ts` targets the documented SDK (`openclaw >= 2026.5.17`):
  `defineToolPlugin` from `openclaw/plugin-sdk/tool-plugin`, schemas via TypeBox.
  Verify against the version actually installed on the box; only `index.ts` needs
  changing if the API differs — `geo.mjs` is pure and stable.
- **TypeBox import:** if `typebox` doesn't resolve, switch the import to
  `@sinclair/typebox` (the `Type` API is identical) and update `package.json`.
- **`contracts.tools`:** don't hand-write `openclaw.plugin.json`; let
  `openclaw plugins build` generate it, or tool calls won't be permitted.
- **Geocoding is offline + approximate:** the postcode centroid index is built
  from our datasets, so it covers only the postcodes present in the 8 boroughs we
  have. Add entries to `LANDMARKS` in `geo.mjs` for any place name the product
  will call by landmark.
- **Coverage is partial** (8 of 33 authorities) — see `datasets/SOURCES.md`. The
  agent should call `list_coverage` and honour `find_nearest`'s radius so it
  never invents facilities in uncovered boroughs.
- **CCTV framing:** `safety_count` and `route_safety` both carry an explicit note
  in their return value: these are traffic/town-centre cameras (busy, well-served
  roads), **not** crime surveillance. Preserve that framing in agent responses.
