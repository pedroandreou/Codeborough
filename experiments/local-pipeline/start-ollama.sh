#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Start (or restart) the local Ollama server with the memory settings that let
# a big context fit on an 8GB GPU. Source this or run it before querying.
#
#   ./start-ollama.sh
#
# Why the flags:
#   OLLAMA_FLASH_ATTENTION=1   — flash attention (less KV-cache memory)
#   OLLAMA_KV_CACHE_TYPE=q8_0  — quantize KV cache to 8-bit (~half the memory)
#   OLLAMA_KEEP_ALIVE=24h      — keep the model resident (no reload between calls)
# Without these, num_ctx 20480 spills to CPU on 8GB and requests crawl/time out.
# ---------------------------------------------------------------------------
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"

if curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
  echo "Ollama already running. Restart with the right flags? (kill + relaunch)"
  pkill -f "ollama serve" 2>/dev/null || true
  sleep 2
fi

OLLAMA_FLASH_ATTENTION=1 OLLAMA_KV_CACHE_TYPE=q8_0 OLLAMA_KEEP_ALIVE=24h \
  nohup ollama serve > "$HOME/ollama.log" 2>&1 &
sleep 4

if curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
  echo "Ollama up on :11434 (flash-attn + q8 KV cache)."
  echo "Tip: after a query, run 'ollama ps' — PROCESSOR should read 100% GPU."
else
  echo "Ollama failed to start — see $HOME/ollama.log" >&2
  exit 1
fi
