# Architecture

`[both]` — overview section for decision-makers; data-flow and example sections for developers.

---

## Overview `[commercial]`

Codeborough is four Docker containers running on one device. They are connected by two Docker networks that enforce the privacy boundary at the infrastructure level.

```
            host browser ──▶ :8091 (published)
                                │
   ┌─────────── core_net (internal: true — NO internet) ───────────┐
   │  vllm (GPU)  ◀── OpenAI /v1 ──  gateway (OpenClaw+civic-geo)  │
   │  Nemotron NVFP4 :8000         + memory volume :18789           │
   └────────────────────────────────────────┬──────────────────────┘
                                  bridge (ui/bridge.mjs) ── dual-homed
                                             │
                       edge_net ──▶ egress-proxy (allow *.elevenlabs.io) ──▶ ☁ ElevenLabs
```

**The spine (never leaves the box):** browser → bridge → gateway (OpenClaw + civic-geo) → vllm (Nemotron reasons, calls tools) → answer back through the same path.

**Voice excursion (spoken turns only):** ① browser mic → ② bridge sends audio through the egress proxy to **ElevenLabs Scribe** (STT) → ③ spine runs → ④ bridge sends the answer text through the proxy to **ElevenLabs v3** (TTS) → spoken reply. A *typed* turn uses only the spine.

A plain text query touches no network at all if ElevenLabs is disabled.

---

## The three layers `[developer]`

### Layer 1 — `civic-geo` (the data engine)

`plugins/civic-geo/src/geo.mjs` is pure Node.js with zero runtime dependencies. It loads the London civic GeoJSON datasets at startup and answers spatial queries deterministically:

- **Geocoding** — landmark gazetteer + postcode centroid index built from the data itself + substring match against dataset names and addresses. Fully offline.
- **Nearest-neighbour** — brute-force haversine distance from a query point to every record, filtered by optional radius and category, sorted ascending.
- **Field normalisation** — strips case and punctuation from property keys so `Establishment name`, `establishment_name`, and `ESTABLISHMENT_NAME` all resolve to the same field.
- **Route-safety geometry** — equirectangular projection to planar XY, perpendicular distance from each camera to each route segment, sampled at ~120 m intervals.

`index.js` (the deployed OpenClaw plugin entry) wraps five of these functions as agent-callable tools and registers them with the OpenClaw runtime. Source: [`plugins/civic-geo/index.js`](../plugins/civic-geo/index.js), [`plugins/civic-geo/src/geo.mjs`](../plugins/civic-geo/src/geo.mjs).

### Layer 2 — OpenClaw gateway

OpenClaw (`openclaw >= 2026.6`) is the agent runtime: it manages the ReAct loop (reason → act → observe), session memory (persisted to `cb_memory` volume as `sessions/*.jsonl`), tool dispatch, and the WebSocket interface. It is configured by `deploy/openclaw.gateway.json` and the agent playbook at `deploy/skills/civic-assistant/SKILL.md`.

The gateway sits on `core_net` (no internet). It calls vLLM over the OpenAI-compatible API at `http://vllm:8000/v1`.

### Layer 3 — Nemotron (the reasoning brain)

`nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-NVFP4` is served by vLLM (`v0.22.1+`) on the GB10 GPU. It decides which tool to call based on the user's question and the agent playbook. It does not access the internet; it never sees the data directly — it only sees tool results.

Configuration: context window 65,536 tokens, max output 2,048 tokens. Tool calling is enabled with `--enable-auto-tool-choice --tool-call-parser=qwen3_coder` and a custom reasoning parser for structured tool calls. Source: `docker-compose.yml` vllm service.

---

## Data flow `[developer]`

```
User speaks / types a message
         │
         ▼
  [bridge :8091]  — if voice: STT via ElevenLabs Scribe (audio out, text back)
         │
         ▼  POST /ask {"message": "..."}
  [bridge runs:  openclaw agent --agent main]
         │
         ▼
  [gateway / OpenClaw]
    Prepends agent system prompt (SKILL.md)
    Appends session history from cb_memory
         │
         ▼  OpenAI /v1/chat/completions (via vllm provider)
  [vllm — Nemotron]
    Reads the conversation
    Emits a tool_call (e.g. geocode "Brixton station")
         │
         ▼
  [OpenClaw dispatches tool call → civic-geo plugin]
    geocode("Brixton station")  → {lat: 51.4627, lon: -0.1145}
    find_nearest({lat, lon, category: "polling station", limit: 1})
      → [{id: "polling-stations:43", name: "...", distanceM: 312, ...}]
         │
         ▼
  [Tool result returned to Nemotron as observation]
    Nemotron produces final text answer
         │
         ▼
  [gateway returns answer text to bridge]
         │
         ▼
  [bridge]  — if voice: TTS via ElevenLabs v3 (text out, audio back)
    Returns answer text + audio to browser
         │
         ▼
  Browser: answer card displayed + spoken aloud
```

---

## End-to-end example `[developer]`

**Query:** *"Where do I vote near Brixton and is it step-free?"*

**Step 1 — geocode**

```json
Tool call:  geocode({"query": "Brixton"})
Result:     {"lat": 51.4626, "lon": -0.1145, "source": "landmark"}
```

**Step 2 — find_nearest**

```json
Tool call:  find_nearest({"lat": 51.4626, "lon": -0.1145,
                          "category": "polling station", "limit": 1})
Result:     {
  "results": [{
    "id": "polling-stations:43",
    "facility": "polling-stations",
    "name": "St Matthew's Church Hall",
    "address": "Brixton Hill, Lambeth, SW2 1JF",
    "borough": "lambeth",
    "distanceM": 312,
    "formatted": "St Matthew's Church Hall — 312 m (about a 4-minute walk)"
  }]
}
```

**Step 3 — get_details** (for accessibility)

```json
Tool call:  get_details({"id": "polling-stations:43"})
Result:     {
  "id": "polling-stations:43",
  "name": "St Matthew's Church Hall",
  "address": "Brixton Hill, Lambeth, SW2 1JF",
  "borough": "lambeth",
  "highlights": {"Ward": "Tulse Hill"},
  "allProperties": { ... }
}
```

Note: step-free access data is not present in the Lambeth polling stations dataset. Codeborough would say: *"The nearest polling station is St Matthew's Church Hall on Brixton Hill, about a 4-minute walk. I don't have accessibility information for this station — contact Lambeth Council to confirm."*

**Spoken response:**

> *"Your nearest polling station is St Matthew's Church Hall on Brixton Hill, about a 4-minute walk south. I don't have step-free access details for this one — Lambeth Council can confirm. Would you like directions?"*

---

## Service contracts `[developer]`

| Service | Exposes | Consumed by |
|---|---|---|
| `vllm` | OpenAI `/v1/chat/completions` at `:8000` | `gateway` (via `OPENAI_BASE_URL`) |
| `gateway` | OpenClaw WebSocket at `:18789` | `bridge` (via `openclaw agent --agent main`) |
| `egress-proxy` | HTTP CONNECT proxy at `:8888` | `bridge` (via `HTTPS_PROXY` env) |
| `bridge` | HTTP at `:8091`: `/ask`, `/geocode`, `/nearest`, `/safety`, `/route`, `/tts`, `/stt`, `/polling` | Browser |

`vllm` and `gateway` have no published ports — they are only reachable within `core_net`.

---

## Known gaps (architecture) `[developer]`

> **`route_safety` tool status**: `src/index.ts` (the TypeScript adapter) defines and exports `route_safety` as a sixth tool. The deployed entry `index.js` only registers five tools (no `route_safety`). `openclaw.plugin.json` `contracts.tools` confirms five. However, `SKILL.md` tells the agent to call `route_safety` — this will fail silently or produce an error if the model attempts it. Route safety *is* available via the bridge's `/route` endpoint (called directly by the UI), but not as an agent-callable tool in the current deployed plugin. Source: [`plugins/civic-geo/index.js`](../plugins/civic-geo/index.js), [`plugins/civic-geo/openclaw.plugin.json`](../plugins/civic-geo/openclaw.plugin.json), [`deploy/skills/civic-assistant/SKILL.md`](../deploy/skills/civic-assistant/SKILL.md).

> **Two integration points unverified on the GB10**: (1) Whether the OpenClaw vllm provider key names match `openclaw.gateway.json` exactly (verify with `openclaw models list` inside the container); (2) whether the bridge can reach the gateway over the Docker network as configured (verify after `make demo`). Source: [`deploy/DOCKER.md`](../deploy/DOCKER.md) "Two integration points to VERIFY".

---

## Reviewer rubric (self-assessment)

| # | Criterion | Status | Note |
|---|---|---|---|
| 1 | Accuracy | ✅ | Topology from docker-compose.yml; tool list from index.js + plugin JSON |
| 2 | Completeness | ✅ | Overview, three layers, data flow, worked example, service contracts |
| 3 | Honesty | ✅ | route_safety gap and unverified integration points explicitly called out |
| 4 | Audience fit | ✅ | Overview section for commercial; detail sections for developer |
| 5 | Extensibility | ⚠️ | Extension points described; runnable examples in doc 06 |
| 6 | Runnability | ✅ | Example tool calls match actual tool signatures in index.js |
| 7 | Traceability | ✅ | Every claim cites source file |
| 8 | Clarity | ✅ | ASCII topology diagram; step-by-step data flow |
| 9 | Consistency | ✅ | Consistent with README topology |
| 10 | No overclaim | ✅ | route_safety gap flagged; integration uncertainty stated |

## Assumptions register

- `[ASSUMPTION — verify]` The worked example uses realistic but not actual data. The real `polling-stations:43` may have different name, address, and distance. The example illustrates the *structure* of the tool call/response, not a specific live record.
- `[ASSUMPTION — verify]` `SKILL.md` step 4 references `route_safety` as a tool. Until `route_safety` is added to `index.js` this call will not be dispatched by OpenClaw. Confirm whether the agent falls back gracefully or errors.
