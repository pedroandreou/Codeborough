# Codeborough — pitch

## The problem
Civic services in London — your child's school, your assigned polling station, the nearest
accessible toilet, a library — are split across **33 separate councils' open datasets** in different
formats. General map apps don't know *your* civic places, and they send your location to the cloud.
The people who most need these services — new arrivals, the elderly, the visually impaired, those
without a smartphone they trust — are the worst served.

## Who it helps
New arrivals finding their way · elderly/step-free needs · visually impaired (voice-first) ·
non-native speakers · the privacy-conscious. The civic version of "ask a local who actually knows."

## The solution
**Codeborough** — a private, **on-device, voice-first** civic concierge for London. Speak a
question; an on-device **NVIDIA Nemotron-3-Nano** (tool-calling) routes it through **OpenClaw**,
calls our **`civic-geo`** plugin over local **City-of-London open GeoJSON**, and **ElevenLabs**
speaks a grounded answer back. It remembers your situation across the whole conversation.

### Three pillars
1. **Get me there** — finds the *right* destination for *you* (your child's school, your assigned
   polling station) and guides you. *(libraries, schools, polling, reception centres)*
2. **Get me there safely** — prefers **monitored, busy, well-served streets**. *(CCTV, grit bins)*
   *Honest framing: CCTV here is traffic/town cameras = busy roads, **not** crime surveillance.*
3. **Tell me about it** — hours, accessibility, what's there.

## Why on-device matters
**Privacy** (location + queries never leave the box) · **works anywhere** (self-contained, no cloud
dependency) · **richer answers** (local data integration a map app can't match). The only cloud hop
is the ElevenLabs voice — required by that sponsor bounty — and we say so plainly.

## The stack
`mic → ElevenLabs STT → OpenClaw (Nemotron brain + civic-geo tools + session memory) → ElevenLabs
TTS → speaker`, all on a **DGX Spark (GB10, 128 GB)**. Brain + data + memory on-device; voice via
ElevenLabs. We *build on* OpenClaw — our IP is the `civic-geo` plugin (5 tools) + the civic data.

## Differentiation vs a map app
- Knows **your** civic entities (assigned polling station, enrolled school) — not generic POIs.
- **Private + offline-capable** brain/data.
- **Safety-aware** routing framing from real CCTV data.
- **Accessibility-first**, voice-native.

## How we hit each prize
- **Public Services track** — improves access to city services for the people who struggle most,
  grounded in City-of-London open data; working on-device demo.
- **Best use of NVIDIA Nemotron** — Nemotron-3-Nano is the agent brain (tool-calling) running locally
  on the GB10; the whole reasoning + tool-routing loop is Nemotron.
- **ElevenLabs persistence bounty** — one autonomous agent running **≥ 1 h 11 m** with **voice in/out**
  and **live context retention** (judge can ask it about something said 40 min earlier).

## Honest limitations
- Open civic data exists for **8 of 33** boroughs; demo focuses on **Lambeth** (only borough with
  CCTV + all destination types). Coverage is partial — the agent says so rather than inventing.
- CCTV = traffic/town cameras (busy roads), not crime surveillance.
- Voice is a cloud call (ElevenLabs); everything else is on-device.
