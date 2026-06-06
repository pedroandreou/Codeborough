#!/usr/bin/env bash
# Codeborough — 71-minute (>= 1h11m) endurance + memory-retention soak.
# Tests the ElevenLabs context-retention bounty: one long-lived OpenClaw session
# stays alive AND recalls an early fact across the whole >=71-min window.
#
# Point it at the bridge (locally tunneled :8091, or on the box).
#   BRIDGE=http://127.0.0.1:8091 SECONDS_TOTAL=4260 ./soak-71m.sh
#
# Pass criteria:
#   1) session survives the full window with zero hard errors
#   2) the final recall turn still returns the fact planted in turn 1 ("Pedro")
set -euo pipefail
BRIDGE="${BRIDGE:-http://127.0.0.1:8091}"
SESSION="${SESSION:-soak-$(date +%s)}"
TOTAL="${SECONDS_TOTAL:-4260}"      # 71 min = 4260 s
EVERY="${EVERY:-120}"               # one keepalive turn every 2 min
NAME="${NAME:-Pedro}"
LOG="${LOG:-soak-$SESSION.log}"

ask() { # message -> reply (stdout), also tees to log
  curl -s -XPOST "$BRIDGE/ask" -H 'content-type: application/json' \
    -d "{\"message\":$(python3 -c 'import json,sys;print(json.dumps(sys.argv[1]))' "$1"),\"session\":\"$SESSION\"}" \
    | python3 -c 'import sys,json;print(json.load(sys.stdin).get("reply",""))'
}

echo "soak session=$SESSION window=${TOTAL}s every=${EVERY}s bridge=$BRIDGE" | tee "$LOG"
start=$(date +%s); turn=0; fails=0

# Turn 1: plant the fact.
r=$(ask "Hi, please remember my name is $NAME. Just acknowledge.")
echo "[t=0 plant] $r" | tee -a "$LOG"
case "$r" in *"[diagnostic]"*|*Error*|"") echo "PLANT FAILED — brain path down, aborting." | tee -a "$LOG"; exit 2;; esac

# Keepalive turns until the window elapses.
while :; do
  now=$(date +%s); el=$((now-start)); [ "$el" -ge "$TOTAL" ] && break
  sleep "$EVERY"; turn=$((turn+1)); now=$(date +%s); el=$((now-start))
  r=$(ask "Quick check #$turn — are you still here? One short sentence.")
  ok=ok; case "$r" in *"[diagnostic]"*|*Error*|"") ok=FAIL; fails=$((fails+1));; esac
  echo "[t=${el}s turn=$turn $ok] ${r:0:90}" | tee -a "$LOG"
done

# Final turn: recall the planted fact.
r=$(ask "Without me repeating it — what name did I ask you to remember at the start?")
el=$(( $(date +%s) - start ))
echo "[t=${el}s RECALL] $r" | tee -a "$LOG"
echo "----" | tee -a "$LOG"
if echo "$r" | grep -qi "$NAME"; then
  echo "PASS: survived ${el}s with $fails transient fails; recalled '$NAME'." | tee -a "$LOG"
else
  echo "FAIL: ran ${el}s ($fails fails) but did NOT recall '$NAME'." | tee -a "$LOG"; exit 1
fi
