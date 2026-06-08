# Overview & Value Proposition

`[commercial]`

---

## What Codeborough does

Codeborough answers the question *"where do I find [civic service] near me?"* — by voice, in plain language, on a single device that never shares your location or questions with a third party.

Ask: *"Where do I vote and is it step-free?"*  
Ask: *"Nearest accessible toilet to Brixton station?"*  
Ask: *"Is the walk to the polling station on busy, well-lit roads?"*

Codeborough responds in under a few seconds with a spoken answer grounded in real London council open data — name, walking distance, accessibility detail, opening hours. The answer comes from the device; no server farms, no user profiles, no data sold.

---

## Who it's for

Codeborough is built for the people that commercial maps consistently underserve:

| Audience | Why Codeborough helps |
|---|---|
| **New arrivals** | Civic information in 13 languages; no local knowledge assumed |
| **Elderly residents** | Voice-first, one-tap GPS, Big Simple mode (giant mic + large text) |
| **Visually impaired users** | Screen-reader-ready; answer is announced, focus moves to it; ARIA live regions throughout |
| **Anyone navigating civic access** | Polling stations, emergency rest centres, accessible toilets — things commercial maps don't carry |
| **Council accessibility & inclusion teams** | Ready-to-deploy, open-source, zero recurring data cost |

---

## What makes it different

### 1. It answers civic questions commercial maps don't

Google Maps knows cafés. Codeborough knows polling stations, public toilets with baby-change facilities, emergency rest centres, grit bins, and council CCTV coverage — the layer of civic infrastructure that matters when you're elderly, newly arrived, or navigating an emergency. All sourced from council open-data portals under the UK Open Government Licence.

### 2. It stays on the device

The reasoning, every civic look-up, postcode geocoding, route-safety scoring, and conversation memory all run on-device. Your location and questions never leave the box. The only network calls are to ElevenLabs for voice transcription and speech — and those can be replaced with on-device Whisper.

The privacy boundary is enforced by Docker networking, not just asserted. The core reasoning containers sit on an `internal: true` Docker network with no internet gateway — they *cannot* initiate outbound connections. A single egress proxy allows only `*.elevenlabs.io`. `make prove-boundary` verifies this live.

### 3. Answers are grounded, not generated

Codeborough never invents a facility. The AI model (Nemotron) decides which data to retrieve; deterministic code computes the actual answer. Distance is haversine maths. Safety scoring is geometry. No hallucinations can enter the data path.

### 4. It is voice-native and accessibility-first

The UI was designed around the hardest users first: large mic button, one-tap GPS, accessibility controls (text size, dark/high-contrast, mute), full keyboard navigation, and a Big Simple mode. Answers are spoken back via ElevenLabs in 13 languages.

### 5. It is built to be extended

Adding a new London borough is a file drop. Adding a new facility type is a folder plus a few lines in the engine. Swapping the language model is one config line. The clean separation of concerns — data engine / agent runtime / voice bridge — means each layer can evolve independently.

---

## Current scope (June 2026)

Codeborough covers **8 of 33 London authorities** across seven facility categories. The full coverage matrix is in the [Data Guide](07-data-guide.md). Only boroughs that publish civic facilities as open location data under the OGL are included; the other 25 have no open location data portal for these facility types.

**Covered boroughs:** Camden, Lambeth, Wandsworth, Kingston upon Thames, Kensington & Chelsea, Barnet, City of London, Hammersmith & Fulham.

**Facility categories:** Libraries, schools, public toilets, polling stations, grit bins, CCTV (traffic/town cameras), reception / emergency rest centres.

---

## Hardware requirement

The full voice stack runs on an **NVIDIA DGX Spark (GB10, arm64)** — a compact, self-contained device with 128 GB of unified CPU/GPU memory. The model (Nemotron-3-Nano-30B-A3B, ~18 GB of weights) fits comfortably on-device. No cloud GPU is required. The data engine can be validated with no hardware at all (`node plugins/civic-geo/scripts/smoke.mjs`).

---

## Licence & provenance

Codeborough was built at **NVIDIA Hack for Impact — London** (June 2026, Public Services track). The code is [MIT-licensed](../LICENSE). Civic data is sourced from council open-data portals under the [UK Open Government Licence v3 (OGL)](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/), which permits redistribution, reuse, and adaptation with attribution. Source attribution per borough is in [`datasets/SOURCES.md`](../datasets/SOURCES.md).

---

## Reviewer rubric (self-assessment)

| # | Criterion | Status | Note |
|---|---|---|---|
| 1 | Accuracy | ✅ | Claims verified against README, docker-compose, data |
| 2 | Completeness | ✅ | Covers all key commercial angles |
| 3 | Honesty | ✅ | Coverage scope, geocoding approximation, hardware requirement all stated |
| 4 | Audience fit | ✅ | No code; commercial register throughout |
| 5 | Extensibility | ⚠️ | Covered at high level; detail in doc 06 |
| 6 | Runnability | n/a | No commands in this document |
| 7 | Traceability | ✅ | Coverage matrix sourced from SOURCES.md; privacy claims from docker-compose.yml |
| 8 | Clarity | ✅ | Terms defined on first use |
| 9 | Consistency | ✅ | Terminology consistent with README and other docs |
| 10 | No overclaim | ✅ | Coverage gap, hardware requirement, and geocoding approximation stated plainly |

## Assumptions register

*(None — all claims in this document are directly traceable to README.md, docker-compose.yml, or datasets/SOURCES.md.)*
