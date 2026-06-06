# Codeborough — submission checklist

## Public Services track
- [ ] Working on-device demo (voice → grounded civic answer).
- [ ] Uses **City of London open data** — cite `datasets/SOURCES.md` (OGL-licensed, 8 boroughs).
- [ ] Impact narrative (`docs/pitch.md`): who it helps + why on-device.
- [ ] Repo link: github.com/pedroandreou/Codeborough.

## Best use of NVIDIA Nemotron
- [ ] Show Nemotron is the brain: `ollama ps` (nemotron-nano, 100% GPU) + the tool-call test
      (`/v1/chat/completions` returns `tool_calls`).
- [ ] Show the agent actually calling `civic-geo` tools through OpenClaw (gateway, not embedded).
- [ ] (Bonus) note the lineup option: reasoning + retriever + content-safety all from Nemotron 3.

## ElevenLabs persistence bounty
- [ ] Agent ran **≥ 1 h 11 m** continuously — proof = the session transcript timestamps.
- [ ] **Voice in and out** via ElevenLabs (Scribe STT + Eleven v3 TTS), Talk mode.
- [ ] **Live context retention** — judge asks about something from earlier in the session; it recalls.
- [ ] **Submit the session log** artifact:
      `~/.openclaw/agents/main/sessions/<sessionId>.jsonl`
      (copy it out before tearing down: `cp ~/.openclaw/agents/main/sessions/*.jsonl ~/Desktop/`).

## Demo readiness
- [ ] `docs/demo-script.md` rehearsed (incl. the 40-min recall moment + fallbacks).
- [ ] Map UI open (`ui/index.html`).
- [ ] One long session started ~90 min before judging (so the 1 h 11 m clock is already past).
- [ ] ElevenLabs API key **rotated** if it was exposed in any shared terminal.

## Nice-to-have (only if time)
- [ ] NVFP4 served via vLLM/TRT (NGC key works) → swap `agents.defaults.model.primary`.
- [ ] OpenShell sandbox slice for the "secure agent" security story.
