# Codeborough - Build Plan v3 (one-day hackathon)

**One-liner:** A private, on-device, **voice-first civic wayfinding concierge** for London. Tell it
who you are and where you need to go; it finds the *right* civic place, tells you how to get there on
**monitored, well-served streets**, tells you about it, and remembers your situation the whole way -
all on the edge, nothing to the cloud.

**Targets (stacked):** Public Services track · Best use of NVIDIA Nemotron (RTX 5080) ·
ElevenLabs persistence bounty (≥ 1 h 11 m + live context retention).

> **v3 change:** we **build ON OpenClaw**, we don't hand-roll an agent. OpenClaw already ships the
> gateway, sessions, persistent memory, Talk voice loop, a native ElevenLabs provider, and a vLLM
> provider. Our only new code is **one tool plugin** (`plugins/civic-geo/`) + config + skills.

---

## The 5-layer stack (what we reuse vs write)

| Layer | What it is | Our move |
|---|---|---|
| **Nemotron 3** (open models) | The brains, on-device via vLLM | **config** - multi-model lineup → "Best use of Nemotron" |
| **OpenClaw** (`openclaw/openclaw`, MIT) | Agent runtime: gateway, sessions, memory, Talk voice, plugin SDK, WS/HTTP API | **build on** - add 1 plugin + skills |
| **ElevenLabs** | Voice in/out - a *native* OpenClaw provider | **config** - wins ElevenLabs bounty |
| **NemoClaw** | NVIDIA's secure wrapper (OpenShell + onboard CLI) around OpenClaw; official DGX Spark path | **optional** - NVIDIA narrative / security demo |
| **OpenShell** (`NVIDIA/OpenShell`, alpha) | Sandbox under NemoClaw: default-deny egress, credential brokering | **side-demo only** (don't sandbox the live voice loop) |

## Nemotron lineup (fits 128 GB; wins the bounty by breadth)

| Role | Model | Mem |
|---|---|---|
| Agent brain | `NVIDIA-Nemotron-3-Nano-30B-A3B-NVFP4` (57–75 tok/s; **tool-calling**) | ~21 GB |
| RAG embed | `llama-nemotron-embed-1b-v2` | ~2 GB |
| RAG rerank | `llama-nemotron-rerank-1b-v2` | ~2 GB |
| Safety guard | `Nemotron-3-Content-Safety` (pre + post-TTS hook) | ~6 GB |

~31 GB total → all four co-resident with ~90 GB to spare. Serve with **vLLM** (NVFP4; GB10/sm_121
NIM support lags for the small models). **Avoid Super 120B for voice** (~87 GB, ~23 tok/s).

---

## Architecture

```
DGX Spark / ZGX Nano (GB10, 128GB) - all on-device:

  vLLM ── Nemotron Nano-30B-NVFP4 (brain) + embed-1b + rerank-1b + Content-Safety-4B
    │  OpenAI /v1 @ :8000
    ▼
  OpenClaw Gateway (daemon :18789)            [REUSE]
   ├─ provider: vllm            (config)      [REUSE]
   ├─ Talk provider: elevenlabs (STT+TTS)     [REUSE]
   ├─ plugin: civic-geo  ← geocode / find_nearest / get_details / safety_count / list_coverage  [WE WRITE]
   ├─ skills: civic-assistant playbook (*.md) [WE WRITE]
   ├─ sessions + memory (1 long session, idle reset off, MEMORY.md)  [REUSE]
   └─ WS + OpenAI-compat HTTP API             [REUSE]
        ▲ ws:// + token
  optional: mic+map web UI (chat.send / sessions.messages.subscribe / tools.invoke / talk.session.*)  [WE WRITE if time]

  side-demo: OpenShell sandbox running a non-voice slice → security/credential story for judges
```

Honest framing: brain + data + memory are fully on-device; voice goes through ElevenLabs because the
bounty requires it.

---

## Key facts that de-risk the day

- **The ElevenLabs persistence/recall bounty is ~free.** OpenClaw sessions persist to disk and only
  reset at 4 AM or on idle (set `session.reset.idleMinutes: 0`). Memory-flush-before-compaction is on
  by default, so earlier turns survive a full context window → the judge's "what did I ask 40 min
  ago?" works. Keep one long session alive; capture its log for submission.
- **Voice = config only.** Talk mode `provider: "elevenlabs"` → Scribe v2 realtime STT + Eleven v3
  TTS, barge-in. No audio plumbing.
- **Model = OpenAI-compatible config.** Point `agents.defaults.model.primary` at `vllm/<nemotron-id>`
  (`http://127.0.0.1:8000/v1`). Must be a tool-calling model - Nano 30B is (Qwen3 parser).
- **OpenShell verdict:** do NOT put the live voice loop in it (alpha; container/GPU/audio friction;
  SSRF blocks the local tool service). Use 1–2 hrs to run a *non-realtime slice* in a sandbox to show
  default-deny egress + an API key the agent never sees + an OCSF audit trail - a strong judge asset.

---

## Our code: `plugins/civic-geo/` (done - engine validated)

The one thing we write. Pure-Node engine (`src/geo.mjs`, zero deps) + thin OpenClaw adapter
(`src/index.ts`). Five tools over the London datasets:

| Tool | Purpose |
|---|---|
| `geocode(query)` | place/landmark/postcode/`"lat,lon"` → coords, offline |
| `find_nearest(lat, lon, category?, limit?, radiusKm?)` | nearest facilities by type/radius |
| `get_details(id)` | full record (hours, accessibility) |
| `safety_count(lat, lon, radiusM?)` | CCTV/grit density = "monitored streets" signal |
| `list_coverage()` | what we actually cover (anti-over-promise) |

Validate now, zero install: `node plugins/civic-geo/scripts/smoke.mjs` (proven against real
`datasets/` - Triton Square → Regent's Park library @ 415 m; 41 cameras within 500 m of Brixton).
On the box: `openclaw plugins build/validate/install` (see `plugins/civic-geo/README.md`). Set
`CIVIC_DATA_DIR` to the deployed datasets path.

---

## Team split - 3 devs (tracked as tasks #1–#4)

- **Dev 1 - Brains & data:** `#1 nemotron-serve` (vLLM Nemotron on :8000, verify tool-calling) +
  `#2 civic-geo-plugin` (engine done; wrap as OpenClaw plugin + install).
- **Dev 2 - OpenClaw, voice & the bounty:** `#3 openclaw-voice` (onboard OpenClaw; config vLLM +
  ElevenLabs Talk + long-session/memory; run the 71-min session). *Blocked by #1.*
- **Dev 3 - Surface & pitch:** `#4 demo-ui-pitch` (map from tool JSON / thin WS UI; slides; demo
  script; optional OpenShell security side-demo).

**MVD:** Nano-30B brain + civic-geo plugin + ElevenLabs Talk + one long session.
**Bounty-breadth adds:** embed/rerank + Content-Safety (cheap; "responsible AI" + Nemotron breadth).
**Stretch:** custom map UI + OpenShell sandbox demo.

---

## Critical path
1. **NOW:** ask organizers to install/serve **Nemotron-3-Nano-30B-A3B-NVFP4** (or pull weights) - long lead.
2. `node plugins/civic-geo/scripts/smoke.mjs` - engine already passes (no hardware needed). **(Dev 1)**
3. vLLM Nemotron answering on :8000 with tool-calling. **(Dev 1)**
4. `openclaw onboard` → vLLM provider + ElevenLabs Talk; one typed grounded answer. **(Dev 2)**
5. `openclaw plugins install ./plugins/civic-geo`; agent fires the tools. **(Dev 1+2)**
6. Voice end-to-end; then memory/long-session config. **(Dev 2)**
7. **Launch the 71-min session early**, let it run while UI/pitch come together. **(Dev 2)**
8. Map UI + rehearse, incl. the 40-min recall moment. **(Dev 3)**

## Demo script (~3 min)
**Lead - voting + accessibility (the gap commercial maps can't fill):** "I've just moved to Brixton -
nearest polling station, and is it step-free?" → polling + step-free · "Safe walk in the dark?" →
monitored-streets + camera count · "Accessible toilet on the way?" → council toilet detail.
**Second beat (council-only data, same engine):** "Nearest emergency rest centre?" → reception centre.
**Bounty moment (judge, ~40 min in):** "Remind me where my polling station was?" → recall.
Close on impact: *equitable, private access to civic services for the people who struggle most.*

## Submission checklist
- [ ] **Public Services:** working demo + impact narrative + City of London open data.
- [ ] **Nemotron:** Nemotron is visibly the agent brain (+ retriever/safety for breadth); vLLM local.
- [ ] **ElevenLabs:** ran ≥ 1 h 11 m (log proves it); voice in + out; session log ready; survives the
      live context-retention question.
