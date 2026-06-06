#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Fire ONE grounded question at the OpenClaw agent, end-to-end (text-only).
# Proven working: brain (codeborough-brain via Ollama) -> geocode -> find_nearest
# -> local London GeoJSON -> grounded natural-language answer.
#
#   ./run-query.sh "nearest library to 1 Triton Square"
#   ./run-query.sh "where can I vote near Lambeth, step-free?"
#   ./run-query.sh --trace "nearest library to 1 Triton Square"   # show full block-by-block flow
#
# Prereqs (once): ./setup-local.sh ; ./start-ollama.sh ; brain + plugin installed.
# ---------------------------------------------------------------------------
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

TRACE=0
if [[ "${1:-}" == "--trace" ]]; then TRACE=1; shift; fi

# --- environment the embedded agent + plugin need ---
export PATH="$HOME/.local/bin:$PATH"
export OLLAMA_API_KEY="${OLLAMA_API_KEY:-ollama-local}"               # opt in to local Ollama detection
export CIVIC_DATA_DIR="${CIVIC_DATA_DIR:-$REPO_ROOT/datasets}"        # where the GeoJSON lives
export OPENCLAW_PLUGINS_ALLOW="${OPENCLAW_PLUGINS_ALLOW:-civic-geo}"  # trust our plugin (silences warning)

MSG="${*:-nearest library to 1 Triton Square}"
SESSION_KEY="cli-$(date +%s)"
OUT="$(mktemp)"

command -v openclaw >/dev/null 2>&1 || { echo "openclaw not installed. Run ./setup-local.sh first." >&2; exit 1; }

echo "CIVIC_DATA_DIR = $CIVIC_DATA_DIR"
echo "Question       : $MSG"
echo "----------------------------------------------------------------------"

# --local = embedded agent (uses this shell's env). --session-key is required.
openclaw agent --local --session-key "$SESSION_KEY" --json -m "$MSG" > "$OUT" 2>/dev/null

if [[ $TRACE -eq 1 ]]; then
  # Full block-by-block flow: USER -> BRAIN -> civic-geo -> ... -> FINAL ANSWER
  python3 "$SCRIPT_DIR/trace.py" "$OUT"
else
  python3 - "$OUT" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
m = d["meta"]["agentMeta"]
print(d["payloads"][-1]["text"])
print("\n--- (model: %s, %sms, in/out tokens: %s/%s) ---" % (
    m.get("model"), d["meta"].get("durationMs"),
    m["usage"].get("input"), m["usage"].get("output")))
PY
fi

rm -f "$OUT"
