# Deploy - running Codeborough on the DGX Spark

We serve **Nemotron-3-Nano (GGUF) via Ollama on the GPU** - this is the official DGX Spark
`nemotron`/`ollama` playbook path, already tool-calling-verified. OpenClaw (brain + voice + memory)
sits on top, with our `civic-geo` plugin for the data.

Run order on the box (`scan-05`). Scripts are idempotent - re-run any safely.

```bash
cd ~/Desktop/Codeborough
git pull

# 1. serve the Nemotron brain on the GPU (Ollama) -> :11434
bash deploy/01-serve-model.sh

# 2. wire OpenClaw: civic-geo plugin + civic-assistant skill + config + gateway
#    (text works now; add voice later by exporting the key and re-running)
bash deploy/02-setup-openclaw.sh

# 3. health check
bash deploy/03-healthcheck.sh

# 4. add ElevenLabs voice when you have the key:
export ELEVENLABS_API_KEY=sk_...
# export ELEVENLABS_VOICE_ID=<voice id>   # optional; defaults to a standard prebuilt voice
bash deploy/02-setup-openclaw.sh          # re-run to enable Talk mode
```

## What each piece is

| File | Purpose |
|---|---|
| `01-serve-model.sh` | Pull + serve `nemotron-nano` (Nemotron-3-Nano GGUF) on the GPU via Ollama |
| `02-setup-openclaw.sh` | Build/install `civic-geo` plugin, install the skill, write config, restart the gateway |
| `03-healthcheck.sh` | Confirm: Ollama serving, GPU + tool-calling, gateway up, tools registered, data readable |
| `openclaw.config.json` | OpenClaw config - Nemotron brain (`ollama/nemotron-nano`), ElevenLabs Talk voice, one long session |
| `skills/civic-assistant/SKILL.md` | Agent playbook - when to call each civic-geo tool, voice style, safety wording, memory |

## Try it

```bash
openclaw agent --agent main --message "nearest library to 1 Triton Square"
openclaw agent --agent main --message "where's the nearest public toilet to Brixton, and is it accessible?"
# NOTE: use --agent main (routes to the gateway → civic-geo tools + memory).
# Do NOT use --local: it runs the embedded agent with NO plugins (ungrounded answers).
openclaw tui          # interactive; or the dashboard at http://127.0.0.1:18789 (token in gateway log)
```

For the **ElevenLabs persistence bounty**: keep one session running ≥ 1 h 11 m (config disables idle
reset). The transcript at `~/.openclaw/agents/<id>/sessions/<sessionId>.jsonl` is the submission artifact.

## Notes / gotchas

- **Model id:** config uses `ollama/nemotron-nano:latest`. If OpenClaw can't find it, run
  `openclaw models list` and adjust `agents.defaults.model.primary` in `~/.openclaw/openclaw.json`.
- **Plugin SDK:** `plugins/civic-geo/src/index.ts` targets `openclaw >= 2026.5.17`. If the installed
  version differs (`openclaw --version`), only that file needs tweaking; `geo.mjs` is stable.
- **Why GGUF not the NVFP4 file:** NVFP4 needs vLLM, which isn't prebuilt on the box (a from-source
  ARM64 build = hours). The GGUF is the same Nemotron model via the official playbook, already working.
- **The org's RAG stack** (containers on :3000/:8000/Milvus/Postgres) is unrelated - leave it; we use our own.
