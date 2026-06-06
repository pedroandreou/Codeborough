#!/usr/bin/env bash
# Wire OpenClaw on the DGX Spark: install the civic-geo plugin + civic-assistant skill,
# drop in our config, and (re)start the gateway pointed at the Nemotron (Ollama) endpoint.
#
# Prereqs: run 01-serve-model.sh first (Nemotron on :11434) and openclaw installed.
# Voice is OPTIONAL on the first pass — text works without it. For voice, set your key first:
#   export ELEVENLABS_API_KEY=sk_...     (then re-run this script)
set -uo pipefail
export PATH="$HOME/.local/bin:$HOME/.npm-global/bin:$PATH"

REPO="$(cd "$(dirname "$0")/.." && pwd)"
export CIVIC_DATA_DIR="$REPO/datasets"
GW_PORT="${OPENCLAW_GATEWAY_PORT:-18789}"
export ELEVENLABS_VOICE_ID="${ELEVENLABS_VOICE_ID:-21m00Tcm4TlvDq8ikWAM}"  # default prebuilt voice

command -v openclaw >/dev/null || { echo "ERROR: openclaw not on PATH."; exit 1; }

if [ -z "${ELEVENLABS_API_KEY:-}" ]; then
  echo "NOTE: ELEVENLABS_API_KEY not set — wiring brain + tools only (text). Voice stays inactive"
  echo "      until you 'export ELEVENLABS_API_KEY=sk_...' and re-run this script."
fi

echo "== 1/4 build + install civic-geo plugin =="
if ( cd "$REPO/plugins/civic-geo" \
      && npm install --no-audit --no-fund \
      && npm run build \
      && openclaw plugins build  --entry ./dist/index.js \
      && openclaw plugins validate --entry ./dist/index.js \
      && openclaw plugins install ./ ); then
  echo "   plugin installed."
else
  echo "   WARN: plugin step failed — check OpenClaw SDK version vs plugins/civic-geo/README.md."
  echo "   (Engine works standalone; only src/index.ts needs adjusting if the SDK differs.)"
fi

echo "== 2/4 install civic-assistant skill =="
mkdir -p "$HOME/.openclaw/skills"
cp -r "$REPO/deploy/skills/civic-assistant" "$HOME/.openclaw/skills/"

echo "== 3/4 install config (backing up any existing) =="
mkdir -p "$HOME/.openclaw"
if [ -f "$HOME/.openclaw/openclaw.json" ]; then
  cp "$HOME/.openclaw/openclaw.json" "$HOME/.openclaw/openclaw.json.bak.$(date +%s)"
fi
cp "$REPO/deploy/openclaw.config.json" "$HOME/.openclaw/openclaw.json"

echo "== 4/4 (re)start gateway =="
openclaw gateway stop 2>/dev/null || true
sleep 1
OLLAMA_KEEP_ALIVE=24h \
CIVIC_DATA_DIR="$CIVIC_DATA_DIR" \
ELEVENLABS_API_KEY="${ELEVENLABS_API_KEY:-}" \
ELEVENLABS_VOICE_ID="$ELEVENLABS_VOICE_ID" \
  nohup openclaw gateway --port "$GW_PORT" > "$HOME/openclaw-gateway.log" 2>&1 &
sleep 6

echo "== verify =="
openclaw plugins inspect civic-geo --runtime --json 2>/dev/null | head -c 500 || true
echo
echo "✅ Setup done. Test (text):"
echo "   openclaw agent --message 'nearest library to 1 Triton Square'"
echo "   Then voice: set ELEVENLABS_API_KEY, re-run this script, and use 'openclaw tui' / Talk mode."
