# Codeborough — Build Plan (one-day hackathon)

**One-liner:** A private, on-device, **voice-first civic wayfinding concierge** for London. Tell it
who you are and where you need to go; it finds the *right* civic place, tells you how to get there
on **monitored, well-served streets**, tells you about it, and remembers your situation the whole
way — all on the edge, nothing to the cloud.

**Targets (stacked):** Public Services track · Best use of NVIDIA Nemotron (RTX 5080) ·
ElevenLabs persistence bounty.

We have **one build day** (3 people) and present tomorrow. Everything below bends to that.

---

## The Minimum Viable Demo (build ONLY this first)

> Speak a civic question → **Nemotron** picks the right Lambeth dataset, queries it **locally** →
> speaks back a **grounded** answer naming the source → **remembers earlier turns** → and has run
> **continuously for 71+ minutes** with a saved session log.

That alone contends for all three prizes:
- voice in/out → **ElevenLabs**
- Nemotron as the brain → **Nemotron bounty**
- on-device City-of-London open data → **Public Services track**
- 71 min + live recall → **ElevenLabs persistence bounty**

Everything else is polish layered on top **only if the spine is solid.**

---

## Three pillars (every original idea lands in one)

| Pillar | What it does | Datasets | Absorbs |
|---|---|---|---|
| **1. Get me there** | Finds the *right* destination for *you* (your child's school, your assigned polling station) and guides you | schools, polling, libraries, reception centres | family→school, elderly→polling |
| **2. Get me there safely** *(signature)* | Mentions monitored, busy, well-served streets near the route; winter footing | **CCTV**, grit bins | travellers→CCTV, reframed crime→safety |
| **3. Tell me about it** | Hours, accessibility, what's there, a bit of character — the "good story" | all + answer composition | library visitors |

**Pillar 2 ships as a spoken line, not a map:** *"...it's along the main monitored roads — there
are 6 traffic cameras near that route."* That's a CCTV-near-corridor count over the data — **no
routing engine, no map required.**

**Safety wording (locked):** "monitored / busy / well-served streets," **never** "crime /
surveillance." Lambeth CCTV = TfL *traffic* cameras (see `datasets/SOURCES.md`); the honest claim is
*busy main roads*, not crime watch.

---

## Architecture

```
 mic ─► [Scribe STT] ─►  ┌──────────────┐  tool calls  ┌────────────────────┐
                         │  NEMOTRON     │ ───────────► │  Data/Tool layer    │
 spk ◄─ [Eleven v3 TTS]◄─│  route +      │ ◄─────────── │  (Lambeth GeoJSON)  │
                         │  compose      │  results     └────────────────────┘
                         └──────┬───────┘ ◄─┐ retrieve/inject
                                │            │
                     ┌──────────┴────────────┴───────┐
                     │ Session memory (turns + entity │ ← the 1h11m crux
                     │ memory + summary + session log)│
                     └────────────────────────────────┘
   Everything except ElevenLabs voice runs on the DGX/ZGX. Demo borough: Lambeth.
```

---

## Team split — 3 devs

- **Dev 1 — Brain:** data tools first (`find_nearest` / `get_details` / `geocode` / `safety_count`
  over Lambeth GeoJSON — fast, standalone, unblocks all), then Nemotron via NIM + tool-calling +
  accessible answer composition (incl. the spoken safety line) + grounding/refusal.
- **Dev 2 — Conversation & the bounty:** the voice loop (Scribe in + Eleven v3 out + turn-taking —
  prototype today via the ElevenLabs MCP, pre-hardware) **and** the long-running process: memory
  store, summary rollup, session log, 1h11m heartbeat, recall path. Voice + memory in one process,
  one owner, no seam. Strongest generalist goes here.
- **Dev 3 — Safety, surface & pitch:** CCTV-near-corridor count, the demo script + impact narrative
  + slides, integration testing, and capturing the session log for submission. Map UI only if the
  spine is done by mid-afternoon.

**Convergence points (where 3-person teams lose time):**
- Dev 1 ↔ Dev 2 meet at the **tool-calling contract** — freeze it in the first hour so they build to
  the same shape in parallel.
- Dev 3 consumes both outputs, so integrates last — keep them productive early on slides + safety fn
  against mock answers.

---

## Explicitly OUT today
- ❌ Real routing engine (OSRM/Valhalla) — zero prize value, big time sink.
- ❌ Live GPS / turn-by-turn navigation.
- ❌ Multi-borough — **Lambeth only.** One borough fully working beats five half-working.
- ❌ Persona-specific code — family & elderly are the *same* code path; they differ only in what you
  *say* in the demo.
- ⚠️ Map UI — only if the spine is done early. Voice is the interface; the map is a bonus.

---

## The de-risk: the 71-minute run

The continuous run must literally happen, but **not under deadline pressure.** Get the agent
*stable* by late afternoon, then **launch the long session in the evening and let it run overnight /
through dinner** while you write the pitch — you present tomorrow, so the 71-min clock can run
tonight. Save the session log = your ElevenLabs submission artifact. **Stability by late afternoon is
the real internal deadline**, not "finish everything."

---

## One-day timeline

| Phase | Dev 1 — Brain | Dev 2 — Voice + Memory | Dev 3 — Safety + Pitch |
|---|---|---|---|
| **First hour (together)** | Lock hardware · **request Nemotron NIM now** · **freeze tool contract** · agree demo script | | |
| **Morning** | Data tools over Lambeth (no LLM — fast win) | Voice loop via ElevenLabs MCP/SDK (works pre-hardware) | CCTV-near-corridor fn + start slides against mock answers |
| **Midday** | Nemotron + tool-calling: typed Q → grounded A | Memory store + recall path (typed first) | Wire safety line into answer; draft impact narrative |
| **Afternoon** | Answer composition + safety line; harden "we don't cover that" | **Integrate voice + brain + memory into one long-running process** | End-to-end testing; (map only if ahead) |
| **Late afternoon** | Bug-fix the spine with Dev 2 | **Spine stable** ← internal deadline | Rehearse demo v1; finalize slides |
| **Evening** | — | **Launch the 71-min session, save the log** | Write ElevenLabs submission + rehearse the recall moment |

---

## First-hour checklist (before any code)
1. **Ask organizers to install Nemotron-Nano-9B-V2 NIM** — longest lead time.
2. **Freeze the tool-calling contract** so Dev 1 and Dev 2 build in parallel without integration
   surprises this evening.
3. **Agree the exact demo script** so you build only what you'll show.

---

## Demo script (~3 min)

**Family (lead):**
1. *"We just moved to Brixton, my daughter starts at [Lambeth school] Monday — how do we get there?"*
   → finds school, describes the way. **(P1)**
2. *"A safe walking route? It'll be early and dark."* → monitored-street mention + camera count.
   **(P2)**
3. *"Any toilets near the school?"* → en-route facility. **(P3)**

**Elderly → polling (30s, shows the same engine):**
4. *"I'm 78, where do I vote and can I get there step-free?"* → assigned station + accessible
   guidance.

**Bounty moment (judge, ~40 min in):**
5. *"Remind me which school it was, and what time we said to leave?"* → memory recall.
   **(ElevenLabs)**

Close on impact: *equitable, private access to civic services for the people who struggle most —
new arrivals, the elderly, the visually impaired — built on public open data, running on the edge.*

---

## Submission checklist
- [ ] **Track (Public Services):** working demo + impact narrative + uses City of London open data.
- [ ] **Nemotron bounty:** Nemotron is visibly the agent brain; NIM running locally.
- [ ] **ElevenLabs bounty:** ran ≥ 1 h 11 m (heartbeat log proves it); ElevenLabs voice in + out;
      session log ready to submit; survives the live context-retention question.
