# Codeborough

**Private, on-device, voice-first civic concierge for London.**  
Ask in plain language - *"where do I vote and is it step-free?"*, *"nearest accessible toilet to Brixton station?"* - and get a spoken answer grounded in real council open data, on a device that keeps your questions and location to itself.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Platform: NVIDIA GB10](https://img.shields.io/badge/platform-NVIDIA%20GB10%20arm64-76b900?style=flat-square)](https://www.nvidia.com/en-us/products/workstations/dgx-spark/)
[![Brain: Nemotron-3-Nano NVFP4](https://img.shields.io/badge/brain-Nemotron--3--Nano%20NVFP4-76b900?style=flat-square)](https://huggingface.co/nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-NVFP4)
[![Voice: ElevenLabs](https://img.shields.io/badge/voice-ElevenLabs-000000?style=flat-square)](https://elevenlabs.io)

---

## What it does

- **Surfaces civic data commercial maps don't carry** - polling stations, emergency rest centres,
  grit bins, council CCTV coverage, accessible-toilet detail - across 8 London authorities, by asking
  in plain language via voice or text.
- **Routes safely** - walking routes prefer monitored, well-served streets; CCTV and grit-bin
  density are scored on-device from the same GeoJSON, not from a remote service.
- **Stays on the box** - reasoning, civic lookups, postcode geocoding, route-safety scoring and
  conversation memory never leave the device. Voice (ElevenLabs) is the only network call, and
  it can be replaced with on-device Whisper.

Built for the people commercial tools underserve: new arrivals, the elderly, the visually impaired,
and anyone who needs civic access rather than the nearest café.

---

## Quick start

**Validate the data engine** - no install, no GPU, no API key:

```bash
node plugins/civic-geo/scripts/smoke.mjs
```

Expected: Triton Square → Regent's Park library at ~415 m; 41 cameras within 500 m of Brixton.
If it looks right, the civic data logic is proven independently of the LLM or the box.

**Deploy the full stack** (requires an NVIDIA GB10 box and an ElevenLabs API key):

```bash
cp .env.example .env && $EDITOR .env   # set ELEVENLABS_API_KEY - the only required secret

# GB10 shares one 128 GB unified pool between CPU and GPU; free it before loading the model:
sudo sh -c 'sync; echo 3 > /proc/sys/vm/drop_caches'
free -h                                # want `available` comfortably above ~45 GiB

make gate-test    # confirm Nemotron NVFP4 serves on the GB10 (~16 GB weights, downloaded once)
make demo         # stage weights → build → docker compose up --wait → pre-warm
```

Then open **`http://<box>:8091`** in a browser.

**SSH tunnel** (from a laptop with no LAN access):
```bash
ssh -N -L 8091:127.0.0.1:8091 <user>@<box>
# then open http://localhost:8091
```

Quick text test without the UI:
```bash
docker compose exec gateway openclaw agent --agent main --message "nearest library to 1 Triton Square"
```

Full runbook (topology, GB10 memory gotchas, integration points to verify, raw Compose commands) →
**[`deploy/DOCKER.md`](deploy/DOCKER.md)**. Bare-metal path (no Docker) →
[`docs/setup-runbook.md`](docs/setup-runbook.md).

---

## How it works

Four Docker containers on one GB10 box, connected by two Docker networks that enforce the privacy
boundary at the infrastructure level.

![Codeborough system architecture](docs/architecture.png)

**Full-resolution interactive diagram → [`docs/architecture.html`](docs/architecture.html)**
([htmlpreview link](https://htmlpreview.github.io/?https://github.com/pedroandreou/Codeborough/blob/main/docs/architecture.html)
when the repo is public - GitHub can't render HTML directly.)

**Spine (never leaves the box):** browser → `bridge :8091` → `gateway` (OpenClaw + `civic-geo`
plugin) → `vllm` (Nemotron reasons, calls tools) → answer back through the same path.

**Voice excursion (spoken turns only):** ① browser mic → ② bridge sends audio out through
`egress-proxy` to **ElevenLabs Scribe** (STT) → ③ spine runs → ④ bridge sends answer text out to
**ElevenLabs v3** (TTS) → spoken reply. A *typed* turn uses only the spine and never touches
ElevenLabs or any network.

The `egress-proxy` is a default-deny allowlist: `*.elevenlabs.io` only, everything else 403. The
`vllm` and `gateway` containers sit on an `internal: true` Docker network with no gateway/NAT -
they *cannot* initiate outbound connections. The privacy boundary is enforced by Docker, not just
asserted.

---

## Privacy

**Always on the box:** reasoning, civic-data lookups, postcode geocoding, route-safety scoring,
conversation memory. What you asked and where you are never leaves the device.

Three optional network calls, each independently disableable:

| Call | Purpose | How to disable |
|---|---|---|
| **ElevenLabs** voice in/out | STT (Scribe) + TTS (v3) | Set `LOCAL_STT_CMD` for on-device Whisper STT; mute TTS to go fully offline |
| **Walking-route geometry** (OSRM) | Turn-by-turn step directions | `ROUTING_DISABLE=1` - route-safety scoring stays on-device either way |
| **Assigned polling station** (gov API) | Your *assigned* station, not just nearest | Unset `POLLING_LOOKUP_URL` - falls back to nearest facility, honestly labelled |

With all three disabled the system is air-gapped end to end. None sends your identity: OSRM sees
two coordinates, the polling API sees a postcode, ElevenLabs sees audio or text.

---

## Extending Codeborough

The components are designed to be extended independently:

| What to extend | How |
|---|---|
| **More London boroughs** | Add `datasets/<facility>/<borough>/<facility>.geojson`; the engine picks it up at startup with no code changes |
| **More facility types** | Add a GeoJSON folder + a category entry in `plugins/civic-geo/src/geo.mjs`; the OpenClaw layer and LLM need no changes |
| **Assigned polling lookup** | Set `POLLING_LOOKUP_URL` to a [Democracy Club API](https://wheredoivote.co.uk/api/) template with `{postcode}` |
| **On-device voice (no ElevenLabs)** | Set `LOCAL_STT_CMD` to a Whisper command for STT; TTS is independently mutable |
| **Different LLM** | Swap `agents.defaults.model.primary` in `deploy/openclaw.gateway.json`; `civic-geo` is model-agnostic |
| **Embed + rerank + content-safety** | Add extra vLLM services + a LiteLLM router; point the gateway at the router |
| **Different city** | Replace `datasets/` with any city's open GeoJSON; update category mappings in `geo.mjs` |

The clean separation is: `civic-geo` owns data logic (pure Node, zero deps, independently testable);
OpenClaw owns agent runtime, voice and memory; the bridge owns the web surface. Each layer can be
swapped without touching the others.

---

## Scope & known limitations

- **Dataset coverage: 8 of 33 London authorities.** Only those that publish civic facilities as
  open location data under OGL; the other 25 have no open location data portal. Full coverage
  matrix, sources, caveats and refresh URLs → [`datasets/SOURCES.md`](datasets/SOURCES.md).
- **Nearest ≠ assigned.** Returns the *nearest* polling station or school, not your legally assigned
  one. Assigned lookup requires a postcode-to-district API; see `POLLING_LOOKUP_URL` above.
- **Geocoding is approximate.** Landmark gazetteer + address/name fallback - accurate enough for
  "near Brixton", not OS-grade surveyed points. Add entries to `geo.mjs LANDMARKS` for any place
  the product will name by landmark.
- **CCTV = traffic cameras.** The CCTV layer is TfL traffic/town cameras (busy, well-served roads),
  not community-safety surveillance. `safety_count` documents this and the agent repeats it.
- **Hardware-specific.** The containerized stack is built and tested for the GB10 (arm64, 128 GB
  unified memory, CDI GPU passthrough). Other NVIDIA hardware needs `VLLM_GPU_FRAC` and
  `--max-model-len` tuning; x86 needs a different vLLM image tag.

---

## Repository layout

```
plugins/civic-geo/     on-device GeoJSON tool plugin - the team's core IP (see its README)
datasets/              London civic facility GeoJSON, per borough + merged all-london files (OGL)
ui/                    accessible, answer-first web UI + zero-dep Node bridge (bridge.mjs)
deploy/                containerized stack: Dockerfiles, OpenClaw configs, egress allowlist
docker-compose.yml     single-command bring-up
Makefile               orchestration (gate-test, demo, prove-boundary, logs, nuke)
docs/                  architecture diagram (HTML + PNG), setup runbook, pitch deck
datasets/SOURCES.md    coverage matrix, sources, licences, field caveats, refresh URLs
docs/london-structure.md   why facility data is split across 33 separate council portals
```

---

## Contributing

The highest-impact contribution is **additional borough datasets**: if your council publishes any of
these facilities as open location data, open a PR adding a GeoJSON file under
`datasets/<facility>/<borough>/` - the engine picks it up with no code changes. See
[`datasets/SOURCES.md`](datasets/SOURCES.md) for the format, coverage gaps, and which 25 boroughs
are still missing.

For code contributions, [`plugins/civic-geo/README.md`](plugins/civic-geo/README.md) is the right
starting point - that's where the data logic lives and it has a zero-install test harness.

---

## Datasets

London civic facility data is sourced borough-by-borough from council open data portals, all
released under the [UK Open Government Licence (OGL v3)](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/).
OGL permits redistribution, reuse and adaptation with attribution. Sources and attribution per
borough → [`datasets/SOURCES.md`](datasets/SOURCES.md).

---

## Origin

Codeborough was built at **NVIDIA Hack for Impact - London** (June 2026, Public Services track) in
under 24 hours. The IP belongs to the team; the code is MIT-licensed.

---

## Licence

[MIT](LICENSE)
