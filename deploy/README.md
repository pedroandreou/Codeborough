# Deploy - running Codeborough on the DGX Spark

We serve **Nemotron-3-Nano-30B-A3B (NVFP4) via vLLM on the GPU**, with OpenClaw (brain + voice +
memory) and our `civic-geo` plugin on top, all as a one-command containerized stack. The full
runbook, topology, and the provable privacy boundary live in **[`DOCKER.md`](DOCKER.md)**.

## One-command bring-up

```bash
cd ~/Desktop/Codeborough
git pull
cp .env.example .env && $EDITOR .env     # set ELEVENLABS_API_KEY

# free the unified memory pool first (GB10 shares one 128GB pool between CPU and GPU)
sudo sh -c 'sync; echo 3 > /proc/sys/vm/drop_caches'

make gate-test       # confirm the Nemotron NVFP4 brain serves on the GB10 (downloads ~16GB once)
make demo            # stage weights, build, start the stack, pre-warm
make prove-boundary  # verify the privacy boundary: core blocked, only ElevenLabs egresses
```

UI: `http://<box>:8091`.

## What's in the stack

| Service | Role | GPU |
|---|---|---|
| `vllm` | Nemotron-3-Nano-30B-A3B **NVFP4** brain, OpenAI `/v1` | ✅ |
| `gateway` | OpenClaw + `civic-geo` plugin + session memory | - |
| `bridge` | `ui/bridge.mjs` - browser-facing voice + map | - |
| `egress-proxy` | the single allowlisted crossing point (`*.elevenlabs.io`) | - |

| File | Purpose |
|---|---|
| `docker-compose.yml` (repo root) | the whole stack: services, internal/edge networks, volumes |
| `Dockerfile.gateway` / `Dockerfile.bridge` / `egress-proxy/` | images for the services we own |
| `openclaw.gateway.json` / `openclaw.client.json` | OpenClaw config (brain via vLLM, remote gateway target) |
| `skills/civic-assistant/SKILL.md` | agent playbook - when to call each civic-geo tool, voice style, memory |
| `DOCKER.md` | full runbook, topology diagram, privacy-boundary proof, trade-offs |

## Try it (text)

```bash
docker compose exec gateway openclaw agent --agent main --message "nearest library to 1 Triton Square"
# NOTE: --agent main routes to the gateway → civic-geo tools + memory. Never --local (no plugins).
```

Session memory persists across turns - idle reset is disabled by default. The session transcript
lives at `~/.openclaw/agents/<id>/sessions/<sessionId>.jsonl`.

## Notes / gotchas

- **vLLM version:** needs `vllm/vllm-openai:v0.22.1`+ - the Nemotron-3 config uses `norm_eps`, which
  older builds don't read.
- **GPU memory:** single GB10, one unified 128 GB pool → exactly one model resident at a time.
  `VLLM_GPU_FRAC` (default 0.45 ≈ 55 GiB) leaves headroom; `nvidia-smi` shows "Not Supported" for
  memory on GB10, so gauge with `free -h` (`available` column).
- **Plugin SDK:** `plugins/civic-geo/src/index.ts` targets `openclaw >= 2026.5.17`; if the installed
  version differs, only that file needs tweaking - `geo.mjs` is stable.
- **Port conflicts:** vLLM binds to host `:8001` (not `:8000`) to avoid collisions with other services on the box.
