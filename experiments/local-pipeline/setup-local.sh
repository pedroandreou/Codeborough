#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Local pipeline dry-run — guided setup for the LAPTOP (RTX 2080 Super, 8GB).
#
# Installs only what's missing and PROMPTS before any multi-GB download.
# Safe to re-run: every step is idempotent and skips work already done.
#
#   ./setup-local.sh            # interactive
#   ./setup-local.sh --yes      # assume yes to download prompts (still skips installed steps)
#
# What it sets up:
#   1. Node.js (needed to build the civic-geo plugin)   — via package manager
#   2. Ollama (local model server)                       — official installer
#   3. qwen3:4b model (stand-in brain, ~2.5GB)           — PROMPTS first
#   4. OpenClaw (agent runtime)                           — official installer
# It does NOT auto-edit ~/.openclaw/openclaw.json; it prints the exact keys to set.
# ---------------------------------------------------------------------------
set -euo pipefail

ASSUME_YES=0
[[ "${1:-}" == "--yes" ]] && ASSUME_YES=1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DATA_DIR="$REPO_ROOT/datasets"
PLUGIN_DIR="$REPO_ROOT/plugins/civic-geo"
MODEL_TAG="qwen3:4b"

c_green() { printf '\033[0;32m%s\033[0m\n' "$*"; }
c_yellow() { printf '\033[0;33m%s\033[0m\n' "$*"; }
c_red() { printf '\033[0;31m%s\033[0m\n' "$*"; }
step() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

confirm() {
  # confirm "message"  -> returns 0 if yes
  [[ $ASSUME_YES -eq 1 ]] && { c_yellow ">> $1 [auto-yes]"; return 0; }
  read -r -p ">> $1 [y/N] " ans
  [[ "$ans" =~ ^[Yy]$ ]]
}

have() { command -v "$1" >/dev/null 2>&1; }

# ---------------------------------------------------------------------------
step "0. Environment check"
echo "Repo root : $REPO_ROOT"
echo "Datasets  : $DATA_DIR"
echo "Plugin    : $PLUGIN_DIR"
if have nvidia-smi; then
  nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv,noheader || true
else
  c_yellow "nvidia-smi not found — CPU-only mode (model will be slow but the pipeline still works)."
fi
[[ -d "$DATA_DIR" ]] || { c_red "datasets/ not found at $DATA_DIR — are you on the right branch?"; exit 1; }

# ---------------------------------------------------------------------------
step "1. Node.js (for building the civic-geo plugin)"
if have node; then
  c_green "Node already installed: $(node --version)"
else
  c_yellow "Node.js is not installed."
  if have apt-get; then
    if confirm "Install Node.js 22 via apt (uses sudo)?"; then
      curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
      sudo apt-get install -y nodejs
      c_green "Node installed: $(node --version)"
    else
      c_yellow "Skipped. Install Node 20+ yourself, then re-run."
    fi
  elif have conda; then
    if confirm "Install Node.js via conda into the current env?"; then
      conda install -y -c conda-forge nodejs
      c_green "Node installed: $(node --version)"
    fi
  else
    c_yellow "No apt/conda detected. Install Node 20+ manually (https://nodejs.org), then re-run."
  fi
fi

# ---------------------------------------------------------------------------
step "2. Ollama (local model server)"
if have ollama; then
  c_green "Ollama already installed: $(ollama --version 2>/dev/null | head -1)"
else
  if confirm "Install Ollama via the official script (curl https://ollama.com/install.sh | sh)?"; then
    curl -fsSL https://ollama.com/install.sh | sh
    c_green "Ollama installed: $(ollama --version 2>/dev/null | head -1)"
  else
    c_yellow "Skipped Ollama. The pipeline needs a local model server; install it before continuing."
  fi
fi

# Make sure the Ollama server is up (the installer usually starts a service).
if have ollama; then
  if ! curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
    c_yellow "Ollama server not responding on :11434 — starting it in the background..."
    OLLAMA_KEEP_ALIVE=24h nohup ollama serve > "$SCRIPT_DIR/ollama.log" 2>&1 &
    sleep 4
  fi
  if curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
    c_green "Ollama server is up on :11434"
  else
    c_red "Ollama server still not reachable. Check $SCRIPT_DIR/ollama.log"
  fi
fi

# ---------------------------------------------------------------------------
step "3. Pull the stand-in brain ($MODEL_TAG, ~2.5GB)"
echo "Why qwen3:4b: fits 8GB VRAM, and uses the SAME tool-call parser as Nemotron-30B,"
echo "so tool-calling behaviour here matches the real DGX brain."
if have ollama && curl -s http://localhost:11434/api/tags 2>/dev/null | grep -q "\"$MODEL_TAG\""; then
  c_green "$MODEL_TAG already pulled."
elif have ollama; then
  if confirm "Download $MODEL_TAG now (~2.5GB)?"; then
    ollama pull "$MODEL_TAG"
    c_green "$MODEL_TAG ready."
  else
    c_yellow "Skipped model pull. Run 'ollama pull $MODEL_TAG' when ready."
  fi
else
  c_yellow "Ollama missing — cannot pull the model yet."
fi

# ---------------------------------------------------------------------------
step "4. Build + smoke-test the civic-geo engine (no GPU needed)"
if have node; then
  export CIVIC_DATA_DIR="$DATA_DIR"
  echo "CIVIC_DATA_DIR=$CIVIC_DATA_DIR"
  node "$PLUGIN_DIR/scripts/smoke.mjs" | head -30 || c_red "smoke test failed — check the engine."
  c_green "Engine smoke test ran (see output above)."
else
  c_yellow "Node missing — skipping engine smoke test."
fi

# ---------------------------------------------------------------------------
step "5. OpenClaw (agent runtime)"
if have openclaw; then
  c_green "OpenClaw already installed: $(openclaw --version 2>/dev/null | head -1)"
else
  if confirm "Install OpenClaw via the official script (curl https://openclaw.ai/install.sh | bash)?"; then
    curl -fsSL https://openclaw.ai/install.sh | bash || \
      c_yellow "Installer returned non-zero — you may need to run its onboarding interactively. See README."
    have openclaw && c_green "OpenClaw installed: $(openclaw --version 2>/dev/null | head -1)"
  else
    c_yellow "Skipped OpenClaw. Install it, then continue with the plugin + config steps."
  fi
fi

# ---------------------------------------------------------------------------
step "6. Next steps (manual — printed, not auto-applied)"
cat <<EOF

  a) Prove tool-calling works (MUST pass before wiring OpenClaw):
       ./test-toolcall.sh

  b) Point OpenClaw at the local model. Edit ~/.openclaw/openclaw.json so it contains:
       "agents": { "defaults": { "model": { "primary": "ollama/$MODEL_TAG" } } }
       "session": { "reset": { "idleMinutes": 0 } }
     (Reference file: $SCRIPT_DIR/openclaw.local.json)

  c) Build + install the civic-geo plugin (point it at the datasets first):
       export CIVIC_DATA_DIR="$DATA_DIR"
       cd "$PLUGIN_DIR" && npm install && npm run build
       openclaw plugins build    --entry ./dist/index.js
       openclaw plugins validate --entry ./dist/index.js
       openclaw plugins install  ./
       openclaw gateway stop && openclaw gateway --port 18789 --verbose

  d) Fire an end-to-end grounded question:
       ./run-query.sh "nearest library to 1 Triton Square"

EOF
c_green "Setup script finished."
