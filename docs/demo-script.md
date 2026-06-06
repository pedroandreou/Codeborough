# Codeborough — 3-minute demo script

## Before you start — must be running
- Nemotron on GPU: `ollama ps` shows `nemotron-nano` at 100% GPU.
- OpenClaw gateway up with civic-geo + elevenlabs + talk-voice (gateway log: "9 plugins").
- `ELEVENLABS_API_KEY` set; **one long session already running** (for the bounty — start it ~90 min before judging).
- Map UI open on the projector: `python3 -m http.server 8090` → `http://localhost:8090/ui/`.

## Hook (~15s)
> "Finding a civic service in London — your child's school, your polling station, an accessible toilet — is scattered across 33 separate councils' data, and map apps don't know *your* civic places (and they ship your location to the cloud). Codeborough does — by voice, on-device, private."

## Act 1 — A family who just moved (lead, ~60s)
1. 🎙 *"We just moved to Brixton — my daughter starts school Monday. How do we get there?"*
   → `geocode` Brixton → `find_nearest` school → **"Sudbourne Primary, Hayter Road SW2 5AP — about a 10-minute walk south."** *(map: pin + route line)*
2. 🎙 *"Is there a safe walking route? It'll be dark."*
   → `safety_count` → **"Yes — keep to the main monitored roads; there are cameras covering the junctions on the way."** *(say "busy/monitored roads", not "surveillance")*
3. 🎙 *"Any public toilets near the school?"*
   → `find_nearest` toilet → nearest one + whether it's accessible.

## Act 2 — Elderly voter, same engine (~30s)
4. 🎙 *"I'm 78 — where do I vote, and can I get there step-free?"*
   → `find_nearest` polling → **"Brixton Library, Brixton Oval SW2 1JQ — step-free entrance."**
   *(Point: identical engine, different person — accessibility-first.)*

## Act 3 — The bounty moment (judge-driven, ~40 min into the live session)
5. Judge asks the **same running agent**: *"Remind me which school my daughter starts at, and what time we said to leave?"*
   → recalls it from the long-session memory. *(This is the ElevenLabs ≥1h11m context-retention proof.)*

## Close (~15s)
> "Equitable, private access to civic services for the people who struggle most — new arrivals, the elderly, the visually impaired — grounded in public open data, running on the edge."

## Fallbacks (if something glitches live)
- **Voice breaks** → type the same lines into `openclaw tui` / the dashboard (text path, same tools).
- **A tool errors** → switch to the Map UI and click the matching demo scenario button (renders the same data).
- **Gateway down** → the embedded agent still answers (brain only); narrate the data from the Map UI.

## Anchors (real, from our data)
- Brixton ≈ 51.4626, -0.1145 · Sudbourne Primary ≈ 51.4584, -0.1193 · Triton Square → Regent's Park library ≈ 415 m · ~41 cameras within 500 m of Brixton · demo borough = **Lambeth** (only one with CCTV + all destination types).
