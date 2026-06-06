# Codeborough - pitch

## The problem
Commercial maps (Google, Apple) already do shops, restaurants and big POIs (libraries included)
well - so this is **not** a "better map". The real gap is the **civic layer councils publish but
commercial maps don't ingest**: where you vote, winter grit bins, emergency rest centres, council
safety cameras, and the civic detail on public toilets (accessible? baby-change? council hours).
It's open data, but **scattered across 33 separate council portals** and hard to query in plain
language - worst for new arrivals, the elderly, the visually impaired, and the privacy-conscious.

## Who it helps
New arrivals finding their way · elderly/step-free needs · visually impaired (voice-first) ·
non-native speakers · the privacy-conscious. The civic version of "ask a local who actually knows."

## The solution
**Codeborough** - a private, **on-device, voice-first** civic concierge for London. Speak a
question; an on-device **NVIDIA Nemotron-3-Nano** (tool-calling) routes it through **OpenClaw**,
calls our **`civic-geo`** plugin over local **City-of-London open GeoJSON**, and **ElevenLabs**
speaks a grounded answer back. It remembers your situation across the whole conversation.

### Three pillars
1. **Find the civic thing maps miss** - the nearest polling station, rest centre, accessible public
   toilet or library, and how to reach it. *(polling stations, reception centres, public toilets,
   libraries, schools)*
2. **Get me there safely** - prefers **monitored, busy, well-served streets**. *(CCTV, grit bins)*
   *Honest framing: CCTV here is traffic/town cameras = busy roads, **not** crime surveillance.*
3. **Tell me about it** - hours, accessibility, what's there.

## Why on-device matters
**Privacy** (location + queries never leave the box) · **works anywhere** (self-contained, no cloud
dependency) · **richer answers** (local data integration a map app can't match). The only cloud hop
is the ElevenLabs voice - required by that sponsor bounty - and we say so plainly.

## The stack
`mic → ElevenLabs STT → OpenClaw (Nemotron brain + civic-geo tools + session memory) → ElevenLabs
TTS → speaker`, all on a **DGX Spark (GB10, 128 GB)**. Brain + data + memory on-device; voice via
ElevenLabs. We *build on* OpenClaw - our IP is the `civic-geo` plugin (5 tools) + the civic data.

## Differentiation vs a map app
- Surfaces **council civic data Google/Apple don't carry** (polling stations, grit bins, rest
  centres, council CCTV, accessible-toilet detail) - not generic commercial POIs.
- **Private + offline-capable** brain + data (only the voice call leaves the box).
- **Safety-aware** framing from real CCTV/grit data (busy/monitored streets).
- **Accessibility-first**, voice-native - built for users app-centric tools underserve.

## How we hit each prize
- **Public Services track** - improves access to city services for the people who struggle most,
  grounded in City-of-London open data; working on-device demo.
- **Best use of NVIDIA Nemotron** - Nemotron-3-Nano is the agent brain (tool-calling) running locally
  on the GB10; the whole reasoning + tool-routing loop is Nemotron.
- **ElevenLabs persistence bounty** - one autonomous agent running **≥ 1 h 11 m** with **voice in/out**
  and **live context retention** (judge can ask it about something said 40 min earlier).

## Honest limitations
- We return the **nearest** polling station / school, **not your *assigned* one** yet - that needs a
  postcode→district lookup (e.g. Democracy Club's API); a clear, scoped next step.
- Where it overlaps commercial maps (libraries, big POIs), we're not better - our edge is the
  council civic layer they omit, plus on-device privacy and an accessible voice interface.
- Open civic data exists for **8 of 33** boroughs; demo focuses on **Lambeth** (only borough with
  CCTV + all destination types). Coverage is partial - the agent says so rather than inventing.
- CCTV = traffic/town cameras (busy roads), not crime surveillance.
- Voice is a cloud call (ElevenLabs); everything else is on-device.
