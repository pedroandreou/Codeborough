# Codeborough

A **private, on-device, voice-first civic concierge** for London. Speak a question -
*"where's the nearest accessible public toilet to Triton Square?"*, *"where do I vote and can I
get there step-free?"* - and Codeborough finds the right civic service near you, tells you how to
get there on **monitored, well-served streets**, and remembers your situation across the whole
conversation. The **reasoning, civic data, memory, and safety scoring run on the edge** - *who is
asking and what they asked stays on the box*. Voice uses ElevenLabs (the bounty), and two **optional,
off-by-default** network helpers (walking-route geometry, assigned-polling lookup) can each be
disabled for a fully air-gapped run - see [Privacy](#privacy-what-is-and-isnt-on-device).

Built for **NVIDIA Hack for Impact - London** (Public Services track), targeting the
**Nemotron** and **ElevenLabs** bounties as well.

> **Current direction is v3.** See [`docs/build-plan.md`](docs/build-plan.md) for the full
> architecture, task split, and demo script. This README is the front door; the build plan is the
> source of truth.

## The problem

Commercial maps (Google, Apple) already do shops, restaurants and big POIs well - libraries
included - so this isn't about finding a café. The gap is the **civic layer that councils publish
but commercial maps don't ingest**: where you vote, winter grit bins, emergency rest centres,
council safety cameras, and the civic detail on public toilets (accessible? baby-change? council
hours). That data is open but **scattered across 33 separate council portals** and hard to query in
plain language - hardest for the people who most need it (new arrivals, the elderly, the visually
impaired, the privacy-conscious).

## Our solution

A voice agent that we **build on OpenClaw**, grounded in real City of London open data, running
entirely on an NVIDIA DGX Spark / ZGX Nano (GB10):

- **Voice in/out** via **ElevenLabs** (Talk mode: Scribe STT + Eleven v3 TTS).
- **Brain:** **NVIDIA Nemotron 3** (Nano-30B-A3B, **NVFP4**) served locally via vLLM, doing
  tool-calling - optionally with a Nemotron retriever + content-safety guard for breadth.
- **Grounding:** our own [`plugins/civic-geo/`](plugins/civic-geo/) OpenClaw tool plugin queries
  the London GeoJSON datasets locally (`geocode` incl. **offline postcode lookup**, `find_nearest`,
  `get_details`, `safety_count`, **`route_safety`** = monitored-streets coverage *along the walk*,
  `list_coverage`).
- **Memory:** one long-lived OpenClaw session + persistent memory, so it recalls earlier turns
  (the ElevenLabs ≥ 1 h 11 m context-retention bounty).
- **Surface:** an accessible, answer-first **web UI** ([`ui/`](ui/)) - big mic, one-tap civic
  buttons, GPS "use my location", spoken answers, 13 languages, Big Simple mode and a clean map.
  A zero-dep Node **bridge** (`ui/bridge.mjs`) sits in front of the gateway and keeps the
  ElevenLabs key server-side. See the [UI README](ui/README.md).
- **Deployment:** a one-command **containerized stack** ([`deploy/`](deploy/) + `docker-compose.yml`)
  for the DGX Spark, with a **Docker-enforced** privacy boundary - the reasoning core has no
  internet route; only the voice bridge egresses. See [Deployment](#quick-start--deployment).

Why on-device matters: **privacy** (location/queries stay on the box), **richer answers** (local
data surfaces detail a map app can't), and **anywhere** (self-contained, no cloud dependency).

### Privacy: what is (and isn't) on-device

We're precise about this so the claim survives scrutiny. **On the box, always:** Nemotron reasoning,
all civic-data lookups, postcode geocoding, **route-safety scoring**, and conversation memory. *Who is
asking and what they asked never leaves the device.*

Three things *can* use the network, each **optional and clearly labelled**:

| Network call | Why | How to go fully offline |
|---|---|---|
| **ElevenLabs** voice in/out | Required by the bounty; best-in-class TTS | Set `LOCAL_STT_CMD` for on-device whisper STT; mute TTS |
| **Walking-route geometry** (OSRM) | Turn-by-turn steps | `ROUTING_DISABLE=1` → straight-line corridor; **safety scoring is local either way** |
| **Assigned polling station** (gov API) | The *correct* "where do I vote", not just nearest | Unset `POLLING_LOOKUP_URL` → on-device **nearest** station (honestly labelled) |

With those three disabled the system is **air-gapped** end to end. None of them ever sends the user's
*identity* - OSRM sees two coordinates, the polling API sees a postcode, ElevenLabs sees text/audio.

### Three things it does

1. **Find the civic thing maps miss** - the nearest polling station, rest centre, library or
   accessible public toilet, and how to get to it. *(polling stations, reception centres, libraries,
   schools, public toilets)* - we return the **nearest** facility (not your *assigned* station/catchment yet; that's a postcode-lookup next step).
2. **Get me there safely** - prefers monitored, busy, well-served streets. *(CCTV, grit bins)*
   Honest framing: CCTV here is mostly traffic/town cameras = busy roads, **not** crime surveillance.
3. **Tell me about it** - hours, accessibility, what's there. *(all datasets)*

## Architecture

How the components come together - voice via ElevenLabs, brain via Nemotron, grounded by our
`civic-geo` plugin over local data, all orchestrated by OpenClaw on the device.

![Codeborough system architecture](docs/architecture.png)

**📐 Interactive version → [`docs/architecture.html`](docs/architecture.html)** - open it in a
browser to watch a voice turn flow end-to-end, with the on-device boundary drawn around everything
except ElevenLabs; hover or click any box for detail. (GitHub can't render
interactive HTML in a README, so the image above is a static preview of it; or view the HTML live via
[htmlpreview](https://htmlpreview.github.io/?https://github.com/pedroandreou/Codeborough/blob/main/docs/architecture.html)
when the repo is public.)

**Flow:** user speaks → ① ElevenLabs Scribe STT → ② OpenClaw Gateway → ③ Nemotron reasons and
calls tools → ④ `civic-geo` plugin → ⑤ queries the local GeoJSON → results return to Nemotron →
it composes a grounded answer → back through OpenClaw → ElevenLabs Eleven v3 TTS → user hears.
Session memory persists across turns, so it recalls earlier context (the ≥ 1 h 11 m ElevenLabs
bounty). Reasoning, data, memory and safety scoring run on-device; only the optional voice / route /
assigned-polling calls touch the network, and each can be disabled (see
[Privacy](#privacy-what-is-and-isnt-on-device)).

> The diagram above is the **conceptual voice turn** (brain · voice · data). In the running system
> the browser talks to the **web UI** ([`ui/`](ui/)) → a **bridge** (`ui/bridge.mjs`) → the gateway,
> and the whole stack is containerized. For the **deployment topology** - which containers run on
> which Docker network and exactly where the privacy boundary is enforced - see the topology diagram
> in [`deploy/DOCKER.md`](deploy/DOCKER.md).

## Hackathon

| | |
|---|---|
| **Event** | NVIDIA Hack for Impact - London |
| **Theme** | Build autonomous systems that think, act, and run anywhere, for positive impact |
| **Platform** | On-device on NVIDIA DGX Spark / ZGX Nano (GB10 Grace Blackwell), open-source models |
| **Stack** | OpenClaw · NVIDIA Nemotron 3 · ElevenLabs · (NemoClaw/OpenShell optional) |
| **Track** | **Public Services** - improving access to and efficiency of city services |
| **Bounties** | Best use of Nemotron · ElevenLabs persistent agent (≥ 1 h 11 m + context retention) |
| **Team** | Codeborough |

## Repository contents

```
docs/build-plan.md          ← the plan (architecture, tasks, demo script) - START HERE
plugins/civic-geo/          ← our OpenClaw tool plugin over the datasets (the part we write)
datasets/<facility>/        ← London civic GeoJSON, per borough + a merged all-london file
ui/                         ← accessible, answer-first web UI + zero-dep voice/map bridge
deploy/ · docker-compose.yml · Makefile  ← one-command containerized stack for the DGX
```

| Path | What it is |
|---|---|
| [`docs/build-plan.md`](docs/build-plan.md) | **Build plan v3** - architecture, 3-dev task split, demo script, submission checklist |
| [`docs/setup-runbook.md`](docs/setup-runbook.md) | **Setup runbook** - exact on-the-box commands (Nemotron NVFP4 via vLLM, OpenClaw + ElevenLabs voice, plugin install, 71-min session) + current status |
| [`docs/Codeborough-Pitch-Deck.pptx`](docs/Codeborough-Pitch-Deck.pptx) | **Pitch deck** (PowerPoint - GitHub won't preview it; download to view) |
| [`docs/pitch.md`](docs/pitch.md) · [`docs/demo-script.md`](docs/demo-script.md) | Written pitch + 3-min demo script |
| [`docs/submission-checklist.md`](docs/submission-checklist.md) | Per-bounty submission checklist (Public Services · Nemotron · ElevenLabs) |
| [`ui/`](ui/) | Accessible, answer-first **web UI** (`index.html`) + zero-dep voice/map **bridge** (`bridge.mjs`) - see its [README](ui/README.md) |
| [`deploy/`](deploy/) · [`docker-compose.yml`](docker-compose.yml) · [`Makefile`](Makefile) · [`.env.example`](.env.example) | **Containerized stack** for the DGX Spark + the provable privacy boundary - full runbook in [`deploy/DOCKER.md`](deploy/DOCKER.md) |
| [`plugins/civic-geo/`](plugins/civic-geo/) | OpenClaw tool plugin: on-device GeoJSON lookups (see its [README](plugins/civic-geo/README.md)) |
| [`datasets/libraries/`](datasets/libraries/) | Libraries (42 across 4 boroughs) |
| [`datasets/reception-centres/`](datasets/reception-centres/) | Reception / rest centres (47 across 2 boroughs) |
| [`datasets/cctv/`](datasets/cctv/) | CCTV cameras (549 across 2 boroughs) |
| [`datasets/schools/`](datasets/schools/) | Schools (1000 across 4 boroughs) |
| [`datasets/public-toilets/`](datasets/public-toilets/) | Public toilets (216 across 5 boroughs) |
| [`datasets/polling-stations/`](datasets/polling-stations/) | Polling stations (464 across 7 boroughs) |
| [`datasets/grit-bins/`](datasets/grit-bins/) | Grit bins (376 across 4 boroughs) |
| [`datasets/SOURCES.md`](datasets/SOURCES.md) | Coverage matrix, sources, licences, caveats, refresh URLs |
| [`docs/london-structure.md`](docs/london-structure.md) | How London is organised and why facility data is split across sources |
| [`docs/data-scope-notes.md`](docs/data-scope-notes.md) | Historical pre-hackathon scope note (now settled - see the build plan) |
| [`LICENSE`](LICENSE) | Project licence |

Data covers 8 of 33 London authorities that publish these facilities as open location data;
coverage per facility is partial. The demo focuses on **Lambeth** (the one borough with CCTV *and*
all destination types). See [`datasets/SOURCES.md`](datasets/SOURCES.md) for the full matrix and caveats.

## Quick start & deployment

### 1. Validate the data engine (zero install, no hardware)

```bash
node plugins/civic-geo/scripts/smoke.mjs
```

### 2. Deploy the full stack on the DGX Spark (Docker Compose)

The whole system ships as a **single `docker compose` stack**, orchestrated by a `Makefile` so you
don't type the long commands by hand. `vllm` (Nemotron NVFP4 brain, GPU), `gateway` (OpenClaw +
`civic-geo` + memory), `bridge` (the UI's voice/map server) and `egress-proxy` (the one allowlisted
crossing point) come up together. **You need Docker with NVIDIA GPU support on the GB10 box and an
ElevenLabs API key** - nothing else.

```bash
cd ~/Desktop/Codeborough
git pull
cp .env.example .env && $EDITOR .env     # set ELEVENLABS_API_KEY (the only required secret)

# Free the unified memory pool first (GB10 shares one 128GB pool between CPU and GPU):
sudo sh -c 'sync; echo 3 > /proc/sys/vm/drop_caches'
free -h                                  # want the `available` column comfortably above ~45 GiB

make gate-test        # 1) confirm the Nemotron NVFP4 brain serves on the GB10 (downloads ~16GB once)
make demo             # 2) stage weights → docker compose up --build --wait → pre-warm the brain
make prove-boundary   # 3) judge-facing proof: core has NO internet, only ElevenLabs egresses
make logs             # 4) tail the stack (watch egress-proxy for the only outbound traffic)
```

Then open the UI at **`http://<box>:8091`**.

**What `make demo` actually runs** is plain `docker compose up -d --build --wait` (preceded by a
weights-staging step and followed by a warm-up call) - so if you prefer raw Compose:

```bash
make pull-model              # pre-stage the NVFP4 weights into the cb_models volume
docker compose up -d --build --wait
docker compose ps            # all services healthy?
docker compose logs -f egress-proxy
docker compose down          # stop (keep volumes) · `make nuke` / `down -v` to drop weights too
```

Quick text sanity check without the UI:

```bash
docker compose exec gateway openclaw agent --agent main --message "nearest library to 1 Triton Square"
```

**Full runbook** - topology diagram, the GB10 memory gotchas, the two OpenClaw integration points to
verify on the box, and what we deliberately skipped under 24 h - is in
**[`deploy/DOCKER.md`](deploy/DOCKER.md)** (quick version in [`deploy/README.md`](deploy/README.md)).
For the non-containerized / bare-box path (running OpenClaw + vLLM directly), see
[`docs/setup-runbook.md`](docs/setup-runbook.md) and [`plugins/civic-geo/README.md`](plugins/civic-geo/README.md).

## Team

**Codeborough**
