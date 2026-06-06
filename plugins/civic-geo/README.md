# civic-geo - OpenClaw tool plugin

On-device lookups over the London civic-facility GeoJSON datasets, exposed to an
OpenClaw agent as tools. This is the team's real IP: the agent's brain is reused
(Nemotron via vLLM), the voice is reused (ElevenLabs Talk mode), and **this is
the part we write**.

## Layout

```
plugins/civic-geo/
├── src/geo.mjs        pure-Node engine (zero deps) - the real logic
├── src/index.ts       thin OpenClaw adapter exposing the engine as tools
├── scripts/smoke.mjs  zero-install validator against the real datasets
├── package.json
├── tsconfig.json
└── README.md
```

## Tools exposed

| Tool | What it does |
|---|---|
| `geocode(query)` | place name / landmark / postcode / `"lat,lon"` → coordinates, **offline** |
| `find_nearest(lat, lon, category?, limit?, radiusKm?)` | nearest facilities, optionally by type/radius |
| `get_details(id)` | full record for one facility (hours, accessibility, …) |
| `safety_count(lat, lon, radiusM?)` | CCTV/grit-bin density = "monitored streets" signal |
| `list_coverage()` | which facilities/boroughs we actually have (anti-over-promise) |

Categories accepted (with synonyms): library, school, toilet, polling station,
grit bin, cctv/camera, reception centre.

## 1. Validate the engine RIGHT NOW (no install, no hardware)

```bash
node plugins/civic-geo/scripts/smoke.mjs
```

Runs geocode + nearest + details + safety against the real `datasets/`. If the
output looks right, the data logic is proven - independent of OpenClaw or the box.

By default the engine reads `../../../datasets` (the repo root). Override:

```bash
CIVIC_DATA_DIR=/abs/path/to/Codeborough/datasets node plugins/civic-geo/scripts/smoke.mjs
```

## 2. Install as an OpenClaw plugin (on the box)

```bash
cd plugins/civic-geo
npm install
npm run build                                   # tsc -> dist/ (local sanity)

# point the engine at the deployed datasets before the gateway starts:
export CIVIC_DATA_DIR=/abs/path/to/Codeborough/datasets

openclaw plugins build  --entry ./dist/index.js # regenerates openclaw.plugin.json contracts.tools
openclaw plugins validate --entry ./dist/index.js
openclaw plugins install ./                      # install this plugin dir
openclaw gateway stop && openclaw gateway --port 18789 --verbose
openclaw plugins inspect civic-geo --runtime --json   # confirm 5 tools registered

openclaw agent --agent main --message "nearest library to 1 Triton Square"   # tool should fire (--agent = gateway, has tools)
```

## Notes / caveats (read before debugging)

- **SDK version:** `src/index.ts` targets the documented SDK (`openclaw >= 2026.5.17`):
  `defineToolPlugin` from `openclaw/plugin-sdk/tool-plugin`, schemas via TypeBox.
  Verify against the version actually installed on the box; only `index.ts` needs
  changing if the API differs - `geo.mjs` is pure and stable.
- **TypeBox import:** if `typebox` doesn't resolve, switch the import to
  `@sinclair/typebox` (the `Type` API is identical) and update `package.json`.
- **`contracts.tools`:** don't hand-write `openclaw.plugin.json`; let
  `openclaw plugins build` generate it, or tool calls won't be permitted.
- **Geocoding is offline + approximate:** a small landmark gazetteer (incl. the
  venue, "1 Triton Square") plus a dataset name/address fallback. Add landmarks
  in `geo.mjs` `LANDMARKS` for any place your demo will name.
- **Coverage is partial** (8 of 33 authorities) - see `datasets/SOURCES.md`. The
  agent should call `list_coverage` / honour `find_nearest`'s radius so it never
  invents facilities in uncovered boroughs.
- **CCTV honesty:** `safety_count`'s note says these are traffic/town cameras
  (busy, well-served roads), **not** crime surveillance. Keep that framing.
