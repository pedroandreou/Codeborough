#!/usr/bin/env bash
# Ensure Ollama is serving Nemotron-3-Nano on the GPU. Idempotent — safe to re-run.
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"

MODEL_REPO="hf.co/unsloth/Nemotron-3-Nano-30B-A3B-GGUF:Q4_K_M"
ALIAS="nemotron-nano"

command -v ollama >/dev/null || { echo "ERROR: ollama not on PATH ($HOME/.local/bin)."; exit 1; }

# start the server if it isn't up
if ! curl -sf http://localhost:11434/api/tags >/dev/null 2>&1; then
  echo "Starting ollama serve (background)..."
  OLLAMA_KEEP_ALIVE=24h nohup ollama serve > "$HOME/ollama.log" 2>&1 &
  sleep 4
fi

# pull + alias the model if we don't have it yet
if ! ollama list 2>/dev/null | grep -q "^${ALIAS}"; then
  echo "Pulling ${MODEL_REPO} (~18 GB, one-time)..."
  ollama pull "$MODEL_REPO"
  ollama cp "$MODEL_REPO" "$ALIAS"
fi

echo "--- ollama ps (PROCESSOR should say GPU) ---"
ollama ps || true
echo "✅ '${ALIAS}' serving at http://localhost:11434/v1"
