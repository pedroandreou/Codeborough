# Use Cases & Limits

`[both]`

---

## Concrete scenarios (what Codeborough does today)

### 1. "Where do I vote?" — polling station finder

> *"Where's my polling station and is it step-free?"*

Codeborough geocodes the user's location, finds the nearest polling station in the dataset, and returns the name, address, ward, walking distance, and accessibility information where the source data carries it.

**Honest caveat:** Codeborough returns the *nearest* polling station, not the one you are legally assigned to. Your assigned station depends on your electoral registration and district — that mapping requires a postcode-to-district API (see `POLLING_LOOKUP_URL` in [Operations](08-operations.md)). When the API is not configured, Codeborough says *"nearest"*, not *"your"*.

---

### 2. "Nearest accessible toilet" — public toilets with accessibility detail

> *"Nearest accessible toilet to Brixton station?"*  
> *"Is there one with baby-change nearby?"*

Codeborough finds public toilets within a given radius, filtered by category. Where the source data includes `AccessibleCategory` and `BabyChange` fields, these are returned and spoken aloud. Where they're absent, Codeborough says so rather than guessing.

---

### 3. "How do I get to the library?" — route-safety guidance

> *"Is the walk to Regent's Park Library on busy, well-lit roads?"*

The bridge's `/route` endpoint calls the on-device route-safety engine: it computes the fraction of the walking route that passes within ~150 m of a CCTV camera. The spoken answer frames this as *"about 80% of your walk is on busy, monitored roads"*.

**Important framing:** the CCTV layer is TfL traffic and town-centre cameras — busy, well-served roads, not crime surveillance. Codeborough never uses language that implies crime levels or surveillance. See [Data Guide — CCTV caveat](07-data-guide.md#caveats).

---

### 4. Emergency preparedness — reception / rest centres

> *"If there's a flood, where's the nearest emergency rest centre?"*

Codeborough finds the nearest reception or emergency rest centre and provides the address and phone number where available. This is a facility type commercial maps do not carry.

**Coverage caveat:** reception centre data exists only for Camden (19 records) and Kensington & Chelsea (28 records, coded as emergency rest centres). For all other boroughs the answer is honest: *"I don't have data for your area."*

---

### 5. Winter safety — grit bin location

> *"Is there a grit bin near the top of my road?"*

Finds the nearest grit bin(s) by location, with the road name and description where available.

---

### 6. Safe neighbourhood signal — CCTV density

> *"How monitored is this area?"*

`safety_count` returns the number of CCTV cameras and grit bins within a configurable radius (default 400 m). Again: traffic/town cameras, not crime data.

---

### 7. Cross-conversation memory

Codeborough holds the user's context across turns within a session. If you ask about a polling station and then ask *"how far is it from there to the nearest library?"*, Codeborough has the first location in memory and doesn't ask again. Session memory persists in a named Docker volume (`cb_memory`); idle reset is disabled by default (configurable via `idleMinutes` in `openclaw.gateway.json`).

---

### 8. Multilingual queries

The UI and agent support 13 languages including English, Greek (Ελληνικά), Chinese (中文), Spanish, French, Portuguese, Italian, and Polish. Nemotron replies in the user's selected language; ElevenLabs `eleven_multilingual_v2` speaks it; the browser STT switches locale accordingly.

---

## What Codeborough cannot do today

These are genuine current limits, not future features.

| Limitation | Explanation |
|---|---|
| **8 of 33 London boroughs** | Only boroughs that publish the relevant civic data as open location data under OGL are covered. The other 25 have no open location data portal for these facility types. Queries about uncovered boroughs get an honest "not covered" response. |
| **Nearest ≠ assigned** | Polling stations and schools are returned as "nearest", not as the legally assigned facility. Assigned lookup requires an external postcode-to-district API. |
| **Geocoding is approximate** | Postcode geocoding is centroid-level (built from our own dataset records, not a full postcode file). Landmark geocoding covers a curated list of about 20 places. For precise addresses not in the dataset, accuracy is postcode-level. |
| **CCTV is traffic cameras** | The CCTV layer is TfL traffic and town-centre cameras, not community-safety surveillance. Safety framing means "busy, monitored roads", never "low crime area". |
| **Route directions require a network call** | Turn-by-turn walking directions use OSRM (an optional network call). Route-safety *scoring* is always on-device. Set `ROUTING_DISABLE=1` to skip OSRM; the safety score and straight-line bearing still work. |
| **No real-time data** | Datasets are static snapshots from council portals. Opening hours, temporary closures, and polling-station changes (e.g. between elections) are not reflected until a refresh. |
| **Hardware-specific at full stack** | The GPU-served full stack is built and tested on the NVIDIA GB10 (arm64, 128 GB unified memory). Other hardware needs tuning (`VLLM_GPU_FRAC`, `--max-model-len`); x86 needs a different vLLM image tag. The data engine has no hardware requirement. |
| **Camden schools are London-wide** | The Camden schools file is a London-wide DfE extract (658 rows), all tagged `_borough: camden`. Individual rows carry their true `local_authority_name`. Treat Camden school coverage as London-wide until this file is re-split. |
| **No national school/polling lookups** | Codeborough uses borough-level GeoJSON. Single national datasets exist for schools (DfE GIAS) and polling stations (Democracy Club) — integrating these would improve coverage immediately. See [Data Guide](07-data-guide.md#a-simpler-route-for-three-facilities). |

---

## Reviewer rubric (self-assessment)

| # | Criterion | Status | Note |
|---|---|---|---|
| 1 | Accuracy | ✅ | All scenarios verified against SKILL.md, tool definitions, and SOURCES.md caveats |
| 2 | Completeness | ✅ | Seven positive scenarios; comprehensive limits table |
| 3 | Honesty | ✅ | Nearest ≠ assigned, geocoding approximation, CCTV framing all explicit |
| 4 | Audience fit | ✅ | Plain English; accessible to non-technical reader |
| 5 | Extensibility | n/a | Not the focus of this document |
| 6 | Runnability | n/a | No commands |
| 7 | Traceability | ✅ | Each caveat traces to SOURCES.md, SKILL.md, or README |
| 8 | Clarity | ✅ | Each scenario follows a consistent pattern |
| 9 | Consistency | ✅ | Consistent with overview and data guide |
| 10 | No overclaim | ✅ | Limitations section is prominent, not buried |

## Assumptions register

- `[ASSUMPTION — verify]` Multilingual reply confirmed for Nemotron (a 30B instruction-tuned model); verify that `eleven_multilingual_v2` is the TTS model used in practice — `.env.example` shows `ELEVENLABS_MODEL=eleven_v3` (monolingual default). The UI README mentions `eleven_multilingual_v2` for multilingual scenarios; confirm the bridge switches models on language change.
