# Codeborough - submission checklist

## Public Services track
- [ ] Working on-device demo (voice → grounded civic answer).
- [ ] Uses **City of London open data** - cite `datasets/SOURCES.md` (OGL-licensed, 8 boroughs).
- [ ] Impact narrative (`docs/pitch.md`): who it helps + why on-device.
- [ ] Repo link: github.com/pedroandreou/Codeborough.

## Best use of NVIDIA Nemotron
- [ ] Show Nemotron is the brain: `ollama ps` (nemotron-nano, 100% GPU) + the tool-call test
      (`/v1/chat/completions` returns `tool_calls`).
- [ ] Show the agent actually calling `civic-geo` tools through OpenClaw (gateway, not embedded).
- [ ] (Bonus) note the lineup option: reasoning + retriever + content-safety all from Nemotron 3.

## ElevenLabs persistence bounty
- [ ] Agent ran **≥ 1 h 11 m** continuously - proof = the session transcript timestamps.
- [ ] **Voice in and out** via ElevenLabs (Scribe STT + Eleven v3 TTS), Talk mode.
- [ ] **Live context retention** - judge asks about something from earlier in the session; it recalls.
- [ ] **Submit the session log** artifact:
      `~/.openclaw/agents/main/sessions/<sessionId>.jsonl`
      (copy it out before tearing down: `cp ~/.openclaw/agents/main/sessions/*.jsonl ~/Desktop/`).

## #3 finish - close out `openclaw-voice` (Dev 2, on the box)
Already done: gateway up (9 plugins incl. elevenlabs + talk-voice), voice **out** (ElevenLabs TTS,
multilingual), **context retention** (recall verified), long uptime. Two things remain to tick #3:

**A. One real ElevenLabs voice-IN round-trip (Scribe STT).** Our `ui/` uses *browser* STT in; the
bounty wants ElevenLabs voice in. Prove it once via OpenClaw Talk:
1. Tunnel + open the dashboard: `http://127.0.0.1:18789/#token=codeborough-local-token` (incognito).
2. In the chat composer, click the **🎙 / Talk** control, allow the mic, and **speak** a question.
3. Confirm the loop: **Scribe STT (in) → Nemotron → Eleven v3 TTS (out)**. Note it in the logs.
   - If Talk mic is fiddly, the fallback demo path is our `ui/` (browser STT in + ElevenLabs out),
     but still do this one Scribe-in test for the bounty evidence.

**B. One continuous ≥ 1 h 11 m session + saved log artifact.**
```bash
# start ~90 min before judging; keep the gateway up; run a few turns in ONE session id:
openclaw agent --agent main --session-id codeborough-demo --message "Where's my nearest polling station in Brixton, step-free?"
# ...more turns over the next 70+ min (same --session-id) ...
openclaw agent --agent main --session-id codeborough-demo --message "Remind me where my polling station was?"   # recall check
# save the artifact:
cp ~/.openclaw/agents/main/sessions/codeborough-demo.jsonl           ~/Desktop/codeborough-bounty-session.jsonl
cp ~/.openclaw/agents/main/sessions/codeborough-demo.trajectory.jsonl ~/Desktop/codeborough-bounty-trajectory.jsonl
```
- [ ] A. ElevenLabs Scribe voice-in confirmed (one spoken round-trip via Talk).
- [ ] B. ≥ 1 h 11 m single session run; recall works at the end; transcript copied out.
- [ ] Then tick task #3.

## Demo readiness
- [ ] `docs/demo-script.md` rehearsed (incl. the 40-min recall moment + fallbacks).
- [ ] Map UI open (`ui/index.html`).
- [ ] One long session started ~90 min before judging (so the 1 h 11 m clock is already past).
- [ ] ElevenLabs API key **rotated** if it was exposed in any shared terminal.

## Nice-to-have (only if time)
- [ ] NVFP4 served via vLLM/TRT (NGC key works) → swap `agents.defaults.model.primary`.
- [ ] OpenShell sandbox slice for the "secure agent" security story.
