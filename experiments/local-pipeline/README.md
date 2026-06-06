# Local pipeline dry-run (laptop) — VALIDATED

**Branch:** `experiment/local-pipeline-laptop-dryrun`

A laptop-sized rehearsal of the real DGX pipeline. It proves the full loop —
*typed question → reasoning brain → tool call → local London data → grounded
answer* — using small substitutes for the two parts that need the DGX. **Nothing
here changes the production plan; it de-risks it.**

## Proven result (RTX 2080 Super, 8GB)

Question: *"What is the nearest library to 1 Triton Square?"* → the agent
**geocoded** the address, called **find_nearest**, and answered from the real
GeoJSON:

> **Regent's Park Library — Robert Street, NW1 3QT — 415m away** (+ 2 more, with
> Camden opening hours). The 415m matches the engine smoke test exactly, proving
> data flows end-to-end through OpenClaw → brain → civic-geo → datasets.

A second query (*"nearest public toilets to Brixton"*) returned Electric Avenue
(56m, Lambeth, open 24/7) — also fully grounded.

Stack that actually ran:
`OpenClaw 2026.6.1` · `codeborough-brain` (qwen3:4b, reasoning ON) via `Ollama 0.30.6`
(CUDA) · our `civic-geo` plugin (5 tools) · local `datasets/` GeoJSON.

## What is the SAME as the DGX, and what is SWAPPED

| Layer | DGX (real demo) | Laptop (this folder) | Why |
|---|---|---|---|
| Agent runtime | OpenClaw | **OpenClaw 2026.6.1 (same)** | identical — reused |
| Our tools | `civic-geo` plugin | **`civic-geo` plugin (same)** | identical — our code |
| Data | `datasets/` GeoJSON | **`datasets/` (same)** | identical — already in repo |
| Brain (LLM) | Nemotron-3-Nano-30B | **`codeborough-brain` = qwen3:4b** | 30B needs ~20GB+; 8GB can't. Qwen3 is a **reasoning + tool-calling** model like Nemotron, so behaviour mirrors the DGX. |
| Voice | ElevenLabs Talk (STT+TTS) | **OFF — typed text** | cloud + API key; not needed to prove the loop. Hook below. |

**Hardware target:** RTX 2080 Super (8 GB VRAM), 32 GB RAM, Linux (no sudo).

> **Synced with `main`.** This branch now uses main's **plain-JS** `civic-geo`
> plugin (no TypeScript/typebox/build) and main's `civic-assistant` skill. The
> only laptop-specific extras are the small stand-in brain, the 8GB memory
> tuning, and the reasoning-hiding config below.

## Files

| File | Purpose |
|---|---|
| `setup-local.sh` | Guided install: Node, Ollama, model, OpenClaw (prompts before big downloads) |
| `start-ollama.sh` | Start Ollama with the 8GB-friendly flags (flash-attn + q8 KV cache) |
| `Modelfile` | Builds `codeborough-brain` from qwen3:4b (reasoning ON, GPU-fitting context) |
| `test-toolcall.sh` | Raw tool-calling gate — **must pass before wiring OpenClaw** |
| `run-query.sh` | Fire one grounded question end-to-end (text). Add `--trace` to see the full flow |
| `trace.py` | Pretty-prints the block-by-block pipeline: USER → BRAIN → civic-geo → … → ANSWER |
| `openclaw.local.json` | Reference config (model + reasoning-hide + session keys) |

## See the whole pipeline (input → each block → output)

```bash
./run-query.sh --trace "nearest library to 1 Triton Square"
```

Example (validated):

```
STEP 1. USER        → "What is the nearest library to 1 Triton Square?"
STEP 2. BRAIN       → calls geocode({"query":"1 Triton Square"})
STEP 3. civic-geo   → {lat:51.5247, lon:-0.1417, source:"landmark"}
STEP 4. BRAIN       → calls find_nearest({lat,lon, category:"library", radiusKm:1})
STEP 5. civic-geo   → Regent's Park Library, Robert St NW1 3QT, Camden, 415 m
STEP 6. BRAIN       → "The nearest library to 1 Triton Square is Regent's Park
                      Library, Robert Street NW1 3QT — about 415 m away."
```

## Reproduce from scratch

```bash
cd experiments/local-pipeline

# 1. Install Node (conda), Ollama (~/.local, no sudo), model, OpenClaw
./setup-local.sh                       # prompts before each multi-GB step

# 2. Build the GPU-fitting reasoning brain
ollama create codeborough-brain -f Modelfile

# 3. Start Ollama with 8GB-friendly memory flags
./start-ollama.sh

# 4. Prove the model can emit tool_calls
./test-toolcall.sh codeborough-brain

# 5. Build + install our plugin into OpenClaw (one-time)
export CIVIC_DATA_DIR="$(cd ../../datasets && pwd)"
cd ../../plugins/civic-geo && npm install && npm run build
openclaw plugins build  --entry ./dist/index.js
openclaw plugins validate --entry ./dist/index.js
openclaw plugins install ./
cd ../../experiments/local-pipeline

# 6. Point OpenClaw at the local brain
export OLLAMA_API_KEY=ollama-local
openclaw models set ollama/codeborough-brain

# 7. Ask it something grounded in the data
./run-query.sh "nearest library to 1 Triton Square"
```

## Hard-won gotchas (these cost us time — read before debugging)

1. **Plugin = plain JS now (no typebox/build).** We adopted main's plain-JS
   `civic-geo` plugin (`index.js`, `definePluginEntry` + `api.registerTool`).
   Install with `openclaw plugins install ./ --force`. (The earlier TypeScript +
   `typebox` approach hit a version trap — `typebox@^0.34.0` doesn't exist on
   npm; OpenClaw bundles `1.1.39`. The plain-JS plugin sidesteps all of that.)
2. **Context window vs OpenClaw prompt.** OpenClaw injects a big system prompt +
   every tool schema (~16k tokens). If `num_ctx` is too small the prompt fills
   the window and the model emits ~1 token ("Okay"). Use `num_ctx 20480`.
3. **8GB VRAM is the ceiling.** `num_ctx 32768` made the model need ~9.7GB → it
   spilled to **CPU** (`ollama ps` showed `36%/64% CPU/GPU`) and requests timed
   out. Fix = flash-attn + **q8 KV cache** (`start-ollama.sh`) + `num_ctx 20480`
   → fits at **4.3GB, 100% GPU**.
4. **Keep thinking ON.** Disabling qwen3's reasoning is tempting for speed, but
   Nemotron is a reasoning model — we keep thinking on so the dry-run is honest.
   The earlier HTTP 500 was context overflow, NOT thinking.
5. **Reasoning leaked into the answer (the "Okay, let me think…" ramble).**
   Root cause: OpenClaw's reasoning auto-detect does NOT fire for a custom
   `ollama create` tag, so it never sent the reasoning directive → Ollama dumped
   the raw `<think>` into `content`. Fix (in `openclaw.local.json`): declare the
   model `reasoning: true` under `models.providers.ollama` AND set
   `agents.defaults.reasoningDefault: "off"`. Then the model still thinks (to
   pick tools) but the thinking is hidden from the reply. On the DGX with
   vLLM/Nemotron this is handled natively, so it's a laptop-only fix.
6. **`openclaw agent` needs a session.** Pass `--local --session-key <key>`.
   `--local` runs embedded so it inherits `CIVIC_DATA_DIR` / `OLLAMA_API_KEY`.
7. **Trust the plugin** to silence the warning: `export OPENCLAW_PLUGINS_ALLOW=civic-geo`.
8. **No sudo on this laptop.** Ollama installed via tarball to `~/.local`; Node
   via conda env `codeborough-node`; OpenClaw via `npm -g` into that env.

## Speed note (laptop only)

A full reasoning + tool-chain answer takes ~1–2 min on the 4B at ~32 tok/s. That's
a *laptop stand-in* limitation, not your demo. On the DGX, Nemotron-30B is far
faster and the reasoning is the whole point. We validate **logic** here, not latency.

## Adding voice later (config-only, no code)

In OpenClaw config add a `talk` block with `provider: "elevenlabs"` and export
`ELEVENLABS_API_KEY` (never commit it). Same change on the DGX.

## Moving to the DGX — two config swaps only

1. **Brain:** `openclaw models set vllm/<nemotron-id>` (or `ollama/<nemotron-tag>`).
   The DGX serves Nemotron-3-Nano-30B; everything else is identical.
2. **Voice:** add the `talk` ElevenLabs block.

OpenClaw, the `civic-geo` plugin, the datasets, and the agent prompt are unchanged.
