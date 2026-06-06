#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Raw tool-calling check against the local Ollama model.
# This is the GATE: if the model can't emit tool_calls, the agent can never
# drive our civic-geo tools — so verify this BEFORE wiring OpenClaw.
#
#   ./test-toolcall.sh            # uses qwen3:4b
#   ./test-toolcall.sh llama3.1:8b
#
# PASS = response contains a "tool_calls" field.
# FAIL = the model writes JSON as plain text in "content" → switch model tag.
# ---------------------------------------------------------------------------
set -euo pipefail

MODEL="${1:-qwen3:4b}"
HOST="http://localhost:11434"

c_green() { printf '\033[0;32m%s\033[0m\n' "$*"; }
c_red() { printf '\033[0;31m%s\033[0m\n' "$*"; }
c_yellow() { printf '\033[0;33m%s\033[0m\n' "$*"; }

if ! curl -s "$HOST/api/tags" >/dev/null 2>&1; then
  c_red "Ollama not reachable at $HOST. Start it:  ollama serve &"
  exit 1
fi

echo "Model under test: $MODEL"
echo "Sending a prompt that SHOULD trigger the find_nearest tool..."

RESP=$(curl -s "$HOST/v1/chat/completions" -H 'Content-Type: application/json' -d @- <<JSON
{
  "model": "$MODEL",
  "messages": [
    {"role": "user", "content": "What civic facilities are near latitude 51.52, longitude -0.14? Use the find_nearest tool to look it up."}
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "find_nearest",
        "description": "Find nearest civic facilities to a lat/lon.",
        "parameters": {
          "type": "object",
          "properties": {
            "lat": {"type": "number"},
            "lon": {"type": "number"},
            "category": {"type": "string"}
          },
          "required": ["lat", "lon"]
        }
      }
    }
  ],
  "tool_choice": "auto"
}
JSON
)

echo "----- raw response (truncated) -----"
echo "$RESP" | head -c 1200
echo
echo "------------------------------------"

if echo "$RESP" | grep -q '"tool_calls"'; then
  c_green "PASS ✅  model emitted a tool_calls field — it can drive civic-geo tools."
  echo "$RESP" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(json.dumps(d["choices"][0]["message"].get("tool_calls"), indent=2))' 2>/dev/null || true
  exit 0
else
  c_red "FAIL ❌  no tool_calls field."
  c_yellow "The model wrote the call as text instead of a real tool call."
  c_yellow "Fix: try another tool-calling model, e.g.:"
  c_yellow "     ollama pull llama3.1:8b && ./test-toolcall.sh llama3.1:8b"
  exit 1
fi
