#!/bin/sh
# Gateway entrypoint (OpenClaw 2026.6.x). The brain provider is registered declaratively in
# /root/.openclaw/openclaw.json -> models.providers.vllm = our NVIDIA Nemotron NVFP4 served by
# vLLM over its OpenAI-COMPATIBLE API (api:"openai-completions"; "openai" is the wire FORMAT,
# not the vendor -- the weights are NVIDIA's and nothing leaves the internal core_net).
# This script installs the civic-geo plugin and (idempotently, non-fatally) asserts the default
# model, then starts the gateway. Kept non-fatal so a CLI/flag drift can't block startup.
set -e

SERVED="${BRAIN_SERVED_NAME:-nemotron-nano}"
MODEL="vllm/${SERVED}"

echo "[entrypoint] default brain model = $MODEL (NVIDIA Nemotron NVFP4 via local vLLM)"

# 1) Install the civic-geo plugin (idempotent; verified working on this image).
( cd /opt/civic-geo && openclaw plugins install ./ ) || echo "[entrypoint] WARN: plugin install"

# 2) Belt-and-suspenders: ensure the gateway default model is our local brain. The config above
#    already sets agents.defaults.model.primary, so this just re-asserts it. `openclaw models set
#    <provider/model>` is the documented 2026.6.x command.
openclaw models set "$MODEL" >/dev/null 2>&1 \
  || echo "[entrypoint] note: 'openclaw models set $MODEL' skipped (config default applies)"

# 3) Start the gateway, bound to 0.0.0.0 so the bridge container can reach it over core_net.
exec openclaw gateway --port "${OPENCLAW_GATEWAY_PORT:-18789}" --host 0.0.0.0
