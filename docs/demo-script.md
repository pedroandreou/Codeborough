# Codeborough - 3-minute demo script

## Before you start - must be running
- Nemotron on GPU: `ollama ps` shows `nemotron-nano` at 100% GPU.
- OpenClaw gateway up with civic-geo + elevenlabs + talk-voice (gateway log: "9 plugins").
- `ELEVENLABS_API_KEY` set; **one long session already running** (for the bounty - start it ~90 min before judging).
- Map UI open on the projector: `python3 -m http.server 8090` → `http://localhost:8090/ui/`.

## Hook (~15s)
> "Google already finds you a café or a library. What it *can't* tell you: where **you** vote, the nearest emergency rest centre, an accessible public toilet with the council's own detail, or a gritted route in winter - that civic data lives across 33 council portals. Codeborough answers it, by voice, on-device, private."

## Act 1 - Voting + accessibility (lead, ~60s) — the moment commercial maps fail
1. 🎙 *"I've just moved to Brixton - where's my nearest polling station, and is it step-free?"*
   → `geocode` Brixton → `find_nearest` polling → **"Brixton Library, Brixton Oval SW2 1JQ - step-free entrance."** *(map: pin + route)* — *Google has no polling-station layer at all.*
2. 🎙 *"Is it a safe walk? it'll be getting dark."*
   → `safety_count` → **"Keep to the main monitored roads - cameras cover the junctions on the way."** *(say "busy/monitored roads", not "surveillance")*
3. 🎙 *"Any accessible public toilet on the way?"*
   → `find_nearest` toilet → nearest one + the **council's accessibility / baby-change detail** commercial maps don't carry.

## Act 2 - Council-only data, same engine (~30s)
4. 🎙 *"I've just arrived and need help - where's the nearest emergency rest centre?"*
   → `find_nearest` reception centre → nearest rest centre.
   *(Point: rest centres, grit bins and council CCTV simply aren't in any commercial map - same engine, data Google can't show.)*

## Act 3 - The bounty moment (judge-driven, ~40 min into the live session)
5. Judge asks the **same running agent**: *"Remind me where my polling station was, and was it step-free?"*
   → recalls it from the long-session memory. *(This is the ElevenLabs ≥1h11m context-retention proof.)*

## Close (~15s)
> "Equitable, private access to civic services for the people who struggle most - new arrivals, the elderly, the visually impaired - grounded in public open data, running on the edge."

## Fallbacks (if something glitches live)
- **Voice breaks** → type the same lines into `openclaw tui` / the dashboard (text path, same tools).
- **A tool errors** → switch to the Map UI and click the matching demo scenario button (renders the same data).
- **Gateway down** → the embedded agent still answers (brain only); narrate the data from the Map UI.

## Anchors (real, from our data)
- Brixton ≈ 51.4626, -0.1145 · polling: Brixton Library / Brixton Oval SW2 1JQ ≈ 51.4611, -0.1147 · ~41 cameras within 500 m of Brixton · demo borough = **Lambeth** (only one with CCTV + all destination types). We return the **nearest** facility, not your *assigned* one.
