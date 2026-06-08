# Codeborough - containerized stack (DGX Spark / GB10, arm64)

One-command, single-box deployment. Brain = **Nemotron NVFP4 via vLLM**, grounded by the
`civic-geo` plugin over local GeoJSON, voiced by ElevenLabs - with a **provable** privacy
boundary: the reasoning core has no internet route; only the voice bridge egresses.

## Topology

```
            host browser ──▶ :8091 (published)
                                │
   ┌─────────── core_net (internal: true - NO internet) ───────────┐
   │   vllm (GPU)  ◀── OpenAI /v1 ──  gateway (OpenClaw+civic-geo)  │
   │   Nemotron NVFP4 :8000          + memory volume :18789         │
   └────────────────────────────────────────┬──────────────────────┘
                                  bridge (ui/bridge.mjs) ── dual-homed
                                             │
                       edge_net ──▶ egress-proxy (allow *.elevenlabs.io) ──▶ ☁ ElevenLabs
```

- **core_net** is `internal: true` → Docker attaches no gateway/NAT. `vllm` and `gateway`
  *cannot* reach the internet. That's the privacy claim, enforced by Docker, not asserted.
- **bridge** is the only reasoning-adjacent service on `edge_net`, and its egress is clamped
  to ElevenLabs by `egress-proxy` (default-deny allowlist).
- GPU via **`gpus: all`** (CDI) — requires Docker with NVIDIA GPU support (`docker run --gpus all` must work on the host).

## Run order

```bash
cd ~/Desktop/Codeborough
cp .env.example .env && $EDITOR .env          # set ELEVENLABS_API_KEY

# 0) FREE THE UNIFIED MEMORY POOL (GB10 shares one 128GB pool between CPU and GPU).
#    Stop any other resident GPU/model processes, then drop reclaimable page cache so
#    vLLM can claim its budget. `nvidia-smi` shows "Not Supported" for memory on GB10;
#    use `free -h` - the `available` column is the real GPU budget.
sudo sh -c 'sync; echo 3 > /proc/sys/vm/drop_caches'
free -h                                       # want `available` comfortably above ~45 GiB

# 1) GATE TEST - confirm the brain serves Nemotron NVFP4 on the GB10 (downloads ~16GB once).
make gate-test
#    ✅ "Application startup complete" + a tool_calls reply  -> proceed.

# 2) Bring the whole stack up (stages weights, builds, waits for health, pre-warms).
make demo

# 3) Verify the privacy boundary (core has no internet, only ElevenLabs egresses).
make prove-boundary

# 4) Watch the only outbound traffic, live.
make logs        # (or: docker compose logs -f egress-proxy)
```

UI: `http://<box>:8091`.

## Two integration points to VERIFY on the box (OpenClaw-specific)

These are the only spots I couldn't confirm without the box; the Docker layer is solid.

1. **Gateway → vLLM provider.** `deploy/openclaw.gateway.json` configures an OpenAI-compatible
   provider at `http://vllm:8000/v1`, model `openai/nemotron-nano`. Confirm the provider key
   names with `openclaw models list` inside the gateway container; adjust if the schema differs.
2. **Bridge → gateway target.** `ui/bridge.mjs` spawns `openclaw agent --agent main`, which must
   reach the **gateway container** (not localhost). `deploy/openclaw.client.json` +
   `OPENCLAW_GATEWAY_URL` set a remote target - verify against `openclaw agent --help` /
   `openclaw gateway --help`. If OpenClaw can't do a remote gateway cleanly, the fallback is to
   run the gateway daemon *inside* the bridge container (localhost:18789) and drop the separate
   gateway service - at the cost of moving the egress boundary to the bridge (still provable, just
   a coarser line).

## Notes & known trade-offs

- **Embed + rerank + safety models**: not included — civic-geo does exact GeoJSON lookups so
  semantic retrieval adds nothing here. To add later: extra vllm services + a LiteLLM router in
  front; point the gateway at the router instead of vllm directly.
- **Weights**: `HF_HUB_OFFLINE=1` at runtime so the brain can't fetch even if it had a route;
  weights are staged by `make pull-model` at setup time.
- **Secrets**: `.env` is fine for a single-box deployment. For production, switch to Docker
  `secrets:` so the key never appears in `docker inspect`.
- **GPU memory**: single GB10, one unified 128 GB pool, so exactly one model is resident at a
  time. `VLLM_GPU_FRAC` (default 0.45 ≈ 55 GiB) leaves headroom for the rest of the box; raise
  toward 0.6 if the box is otherwise idle.
