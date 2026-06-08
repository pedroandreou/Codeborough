# Codeborough Documentation

Private, on-device, voice-first civic concierge for London.

---

## Documents

| # | Document | Audience | Description |
|---|---|---|---|
| 1 | [Overview & Value Proposition](01-overview.md) | Commercial / Decision-maker | What it does, who it's for, core differentiators |
| 2 | [Use Cases & Limits](02-use-cases.md) | Both | Concrete scenarios and honest scope boundaries |
| 3 | [Architecture](03-architecture.md) | Both | System design, data flow, end-to-end worked example |
| 4 | [Getting Started (Developer)](04-getting-started.md) | Developer | Prerequisites, smoke test, full stack bring-up |
| 5 | [Tool / API Reference](05-tool-reference.md) | Developer | All five tools: inputs, outputs, examples, failure modes |
| 6 | [Extending Codeborough](06-extending.md) | Developer | Add datasets, add tools, swap the model |
| 7 | [Data Guide](07-data-guide.md) | Both | Sources, licences, coverage matrix, preparation pipeline |
| 8 | [Operations & Privacy](08-operations.md) | Both | Deployment, the privacy boundary, refresh, secrets |

---

## Quick orientation

- **No hardware?** Run the engine smoke test first — zero install, zero GPU: `node plugins/civic-geo/scripts/smoke.mjs`
- **Full stack?** Needs an NVIDIA GB10 box + ElevenLabs API key. Start at [Getting Started](04-getting-started.md).
- **Adding data?** Go straight to [Extending — Add a dataset](06-extending.md#1-add-a-new-borough-dataset).
- **Adding a tool?** See [Extending — Add a tool](06-extending.md#2-add-a-new-tool).
- **Procurement / partnership?** [Overview](01-overview.md) and [Use Cases & Limits](02-use-cases.md) are written for you.
- **Privacy claim?** [Operations & Privacy](08-operations.md) states exactly what stays on-device and what the three optional network calls are.

---

## Repository layout

```
plugins/civic-geo/     The team's core IP: on-device GeoJSON engine + OpenClaw plugin
  src/geo.mjs          Pure Node geospatial engine (zero dependencies, independently testable)
  index.js             Deployed OpenClaw plugin entry (5 tools registered)
  src/index.ts         TypeScript adapter (alternative entry; see Known gaps in tool reference)
  scripts/smoke.mjs    Zero-install validator

datasets/              London civic facility GeoJSON (OGL-licensed, 8 boroughs)
ui/                    Accessible browser UI + Node bridge (bridge.mjs, serves :8091)
deploy/                Dockerfiles, OpenClaw configs, egress proxy, runbooks
docker-compose.yml     Single-command bring-up
Makefile               Orchestration (gate-test, demo, prove-boundary, logs, nuke)
docs/                  This documentation set + architecture diagram
datasets/SOURCES.md    Coverage matrix, sources, licences, field caveats, refresh URLs
docs/london-structure.md   Why London facility data is split across 33 council portals
```
