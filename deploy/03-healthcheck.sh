#!/usr/bin/env bash
# Quick end-to-end health check on the DGX Spark.
export PATH="$HOME/.local/bin:$HOME/.npm-global/bin:$PATH"
REPO="$(cd "$(dirname "$0")/.." && pwd)"

echo "== ollama serving? =="
curl -sf http://localhost:11434/api/tags >/dev/null 2>&1 && echo "  serving ✅" || echo "  DOWN ❌  (run deploy/01-serve-model.sh)"
ollama ps 2>/dev/null

echo "== model on GPU + tool-calling? =="
curl -s http://localhost:11434/v1/chat/completions -H 'Content-Type: application/json' -d '{
  "model":"nemotron-nano",
  "messages":[{"role":"user","content":"find facilities near lat 51.52 lon -0.14, use the tool"}],
  "tools":[{"type":"function","function":{"name":"find_nearest","parameters":{"type":"object","properties":{"lat":{"type":"number"},"lon":{"type":"number"}},"required":["lat","lon"]}}}]
}' | grep -q '"tool_calls"' && echo "  tool_calls ✅" || echo "  no tool_calls ❌"

echo "== openclaw gateway up? =="
curl -sf http://localhost:18789 >/dev/null 2>&1 && echo "  up ✅" || echo "  not responding (run deploy/02-setup-openclaw.sh)"

echo "== civic-geo tools registered? =="
openclaw plugins inspect civic-geo --runtime --json 2>/dev/null | grep -o '"name":"[a-z_]*"' | head || echo "  not installed yet"

echo "== data engine reads datasets? =="
node "$REPO/plugins/civic-geo/scripts/smoke.mjs" 2>/dev/null | tail -2

echo "== memory =="
free -h | head -2
