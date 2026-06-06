# Setup runbook - standing up Codeborough on the DGX Spark

Concrete, replayable steps for the box. Architecture and rationale are in
[`build-plan.md`](build-plan.md); this is the "how we actually run it" companion.

**Voice = ElevenLabs API (required).** ElevenLabs is a main sponsor and the persistence bounty
needs ElevenLabs voice in *and* out. OpenClaw provides the Talk loop; ElevenLabs does the STT + TTS.

---

## Status (Sat 6 Jun 2026, morning)

- **Host:** `nvidia@scan-05` - DGX Spark, **GB10 Grace Blackwell, CUDA 13**, driver 580.159.03, 121 GB unified, 3.5 TB free.
- **OpenClaw:** installed (`~/.npm-global/bin/openclaw`), gateway already listening on `:18789`.
- **Model runtime:** none yet - no Ollama / vLLM / NIM serving (checked `:8000 :11434 :30000`, all empty). HF cache dirs are 12 KB stubs (weights never downloaded), so we pull fresh.
- **Access:** no `sudo`, and **Docker needs sudo** for us → no containers without help.
- **BLOCKER → organizers:** asked for Docker access for `nvidia` (group/sudo) **or** Ollama system-wide with GPU, **or** the `nemotron-3-nano-30b-a3b` NIM on `:8000/v1` with tool-calling. Meanwhile trying the no-sudo Ollama install below.

---

## Step 1 - Serve Nemotron (Task #1, Dev 1)

### 1a. Install Ollama, no sudo
```bash
export PATH=$HOME/.local/bin:$PATH
mkdir -p ~/.local
curl -fSL https://github.com/ollama/ollama/releases/download/v0.30.6/ollama-linux-arm64.tar.zst -o /tmp/ollama.tar.zst
tar --zstd -xf /tmp/ollama.tar.zst -C ~/.local 2>/dev/null \
  || zstd -d -c /tmp/ollama.tar.zst | tar -x -C ~/.local
~/.local/bin/ollama --version
```
> Use the plain `arm64` build (GB10 is sbsa-class, **not** the jetpack/Jetson variants).
> If this build is CPU-only (no GPU in the log at 1b), fall back to the organizer ask (system-wide
> Ollama or Docker), since a 30B on CPU is too slow for voice.

### 1b. Start it + confirm GPU
```bash
OLLAMA_KEEP_ALIVE=24h nohup ~/.local/bin/ollama serve > ~/ollama.log 2>&1 &
sleep 4
curl -s http://localhost:11434/api/tags; echo
grep -iE 'gpu|cuda|blackwell|gb10|compute|library' ~/ollama.log | tail -15   # expect CUDA + ~120 GB
```

### 1c. Pull Nemotron (from Hugging Face - cache is empty)
```bash
ollama pull hf.co/unsloth/NVIDIA-Nemotron-3-Nano-30B-A3B-GGUF:Q4_K_M   # confirm exact quant tag on HF
# fallback brains if the Nemotron template misbehaves on tool-calls:
#   ollama pull hf.co/unsloth/Qwen3.6-35B-A3B-GGUF:Q4_K_M
```
> Prefer the plain **Nemotron-3-Nano-30B-A3B** (cleaner tool-calling) over the Omni variant for a
> text+tools agent. Keep Nemotron as the brain for the bounty; Qwen is only an unblock-the-pipeline
> fallback.

### 1d. Tool-calling test - MUST PASS before wiring OpenClaw
```bash
curl -s http://localhost:11434/v1/chat/completions -H 'Content-Type: application/json' -d '{
  "model":"<the-tag-from-1c>",
  "messages":[{"role":"user","content":"What civic facilities are near 51.52,-0.14? Use the tool."}],
  "tools":[{"type":"function","function":{"name":"find_nearest",
    "parameters":{"type":"object","properties":{"lat":{"type":"number"},"lon":{"type":"number"}},
    "required":["lat","lon"]}}}]
}' | python3 -m json.tool
```
Pass = the reply contains a `tool_calls` field. Fail = the model dumps JSON as plain text → the
model's template doesn't support tools; switch tag/model.

---

## Step 2 - OpenClaw + ElevenLabs voice (Task #3, Dev 2)

OpenClaw is already installed; gateway on `:18789`. Configure `~/.openclaw/openclaw.json`:

```json5
{
  // brain: OpenClaw auto-detects Ollama at 127.0.0.1:11434
  agents: { defaults: { model: { primary: "ollama/<the-tag-from-1c>" } } },

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
- Keep it one session (don't `/new`); `OLLAMA_KEEP_ALIVE=24h` keeps the model resident.
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
