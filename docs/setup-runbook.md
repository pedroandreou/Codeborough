# Setup runbook - standing up Codeborough on the DGX Spark

Concrete, replayable steps for the box. Architecture and rationale are in
[`build-plan.md`](build-plan.md); this is the "how we actually run it" companion.

**Voice = ElevenLabs API (required).** ElevenLabs is a main sponsor and the persistence bounty
needs ElevenLabs voice in *and* out. OpenClaw provides the Talk loop; ElevenLabs does the STT + TTS.

---

## Status (Sat 6 Jun 2026)

- **Host:** `nvidia@scan-05` - DGX Spark, **GB10 Grace Blackwell, CUDA 13**, driver 580.159.03, 121 GB unified, 3.5 TB free.
- **OpenClaw:** installed (`~/.npm-global/bin/openclaw`), gateway already listening on `:18789`.
- **Docker + GPU:** working - `--gpus all` (CDI) passes the GPU into containers; Compose v2 present.
- **Brain:** **Nemotron 3 Nano-30B-A3B NVFP4** served by **vLLM** (`vllm/vllm-openai:v0.22.1`, arm64),
  validated loading + tool-calling on the GB10. The full containerized stack is in
  [`../deploy/DOCKER.md`](../deploy/DOCKER.md); the steps below are the manual equivalent.

---

## Step 1 - Serve Nemotron NVFP4 via vLLM (Task #1, Dev 1)

### 1a. Free the unified memory pool
GB10 shares one 128 GB pool between CPU and GPU, so RAM pressure starves the model. `nvidia-smi`
reports "Not Supported" for memory here - use `free -h`, where `available` is the real GPU budget.
```bash
sudo sh -c 'sync; echo 3 > /proc/sys/vm/drop_caches'   # reclaim page cache
free -h                                                 # want `available` > ~45 GiB
```

### 1b. Serve the NVFP4 checkpoint (weights pull once, ~16 GB, into a named volume)
```bash
docker volume create cb_models
docker run --rm --gpus all -p 8001:8000 -v cb_models:/models -e HF_HOME=/models \
  vllm/vllm-openai:v0.22.1 \
  --model nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-NVFP4 \
  --served-model-name nemotron-nano --max-model-len 32768 \
  --gpu-memory-utilization 0.45 --trust-remote-code
```
Wait for `Application startup complete`. (Host `:8001` → container `:8000`, since `:8000` is taken.)
> Needs vLLM ≥ v0.22.1: the Nemotron-3 config uses `norm_eps`, which older builds don't read.

### 1c. Tool-calling test - MUST PASS before wiring OpenClaw
```bash
curl -s http://localhost:8001/v1/chat/completions -H 'Content-Type: application/json' -d '{
  "model":"nemotron-nano",
  "messages":[{"role":"user","content":"What civic facilities are near 51.52,-0.14? Use the tool."}],
  "tools":[{"type":"function","function":{"name":"find_nearest",
    "parameters":{"type":"object","properties":{"lat":{"type":"number"},"lon":{"type":"number"}},
    "required":["lat","lon"]}}}]
}' | python3 -m json.tool
```
Pass = the reply contains a `tool_calls` field. Fail = the model dumps JSON as plain text → check the
chat template / tool-parser flags.

---

## Step 2 - OpenClaw + ElevenLabs voice (Task #3, Dev 2)

OpenClaw is already installed; gateway on `:18789`. Configure `~/.openclaw/openclaw.json`:

```json5
{
  // brain: vLLM's OpenAI-compatible endpoint (set OPENAI_BASE_URL=http://localhost:8001/v1)
  agents: { defaults: { model: { primary: "openai/nemotron-nano" } } },

  // VOICE: ElevenLabs (required - main sponsor + bounty). Talk loop = STT in + TTS out.
  talk: {
    provider: "elevenlabs",
    providers: {
      elevenlabs: {
        apiKey: "${ELEVENLABS_API_KEY}",
        voiceId: "<pick a voice id>",
        modelId: "eleven_v3"            // STT side uses Scribe v2 realtime
      }
    },
    interruptOnSpeech: true,            // barge-in
    silenceTimeoutMs: 1500
  },

  // MEMORY: keep one long session alive for the 71-min run (no idle reset)
  session: { reset: { idleMinutes: 0 } }
}
```
```bash
export ELEVENLABS_API_KEY=sk_...        # from the ElevenLabs dashboard
openclaw gateway stop && openclaw gateway --port 18789 --verbose
openclaw tts audio "Hello from Codeborough"   # quick TTS smoke test
```
> If ever run inside NemoClaw/OpenShell, add egress for `api.elevenlabs.io:443` to the policy.
> Unsandboxed (our path today) it just works.

---

## Step 3 - Install the civic-geo plugin (Task #2, Dev 1)

Engine is done and validated. On the box:
```bash
cd ~/Codeborough && git pull        # get plugins/civic-geo + datasets
export CIVIC_DATA_DIR="$PWD/datasets"
node plugins/civic-geo/scripts/smoke.mjs            # sanity (zero-install)

cd plugins/civic-geo && npm install && npm run build
openclaw plugins build  --entry ./dist/index.js
openclaw plugins validate --entry ./dist/index.js
openclaw plugins install ./
openclaw gateway stop && openclaw gateway --port 18789 --verbose
openclaw plugins inspect civic-geo --runtime --json  # expect 5 tools
openclaw agent --agent main --message "nearest library to 1 Triton Square"   # tool fires (--agent = gateway/tools; never --local)
```
See [`../plugins/civic-geo/README.md`](../plugins/civic-geo/README.md) for caveats (SDK version, TypeBox import).

---

## Step 4 - The 71-minute session + log (Task #3, ElevenLabs bounty)

- Get the agent stable (steps 1–3 green), then **start one continuous session and leave it running**
  - launch it with hours to spare (e.g. over dinner); you present tomorrow, so the clock can run today.
- Keep it one session (don't `/new`); the vLLM brain stays resident for the whole run.
- The session transcript (`~/.openclaw/agents/<id>/sessions/<sessionId>.jsonl`) is the **submission
  artifact**. Rehearse the judge's "what did I ask earlier?" recall.

---

## Quick map: steps → tasks
| Step | Task |
|---|---|
| 1 serve Nemotron + tool-call test | #1 nemotron-serve |
| 2 OpenClaw + ElevenLabs voice | #3 openclaw-voice |
| 3 civic-geo plugin install | #2 civic-geo-plugin |
| 4 71-min session + log | #3 openclaw-voice (ElevenLabs bounty) |

Dev 3 (#4) works in parallel: map from civic-geo JSON + slides + demo script.
