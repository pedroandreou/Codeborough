# Codeborough UI - accessible, answer-first civic helper

A voice-first, **answer-first** web UI for the agent. The map is a *supporting* visual, not the
interface - because our users (elderly, visually impaired, new arrivals) can't navigate a dense
all-London map. Built for accessibility and one-tap use.

## What's different (vs a generic map app)
- **Answer card is the hero**: big place name, walk-time, and **♿ step-free / 🚼 baby-change / 🕐 hours**
  badges, plus a **🔊 Hear again** button. Announced to screen readers (`aria-live`).
- **"Where are you?" + big icon buttons** (🗳️ vote · 🚻 toilet · 🆘 rest centre · 📚 library · ❄️ grit · 🛡️ safe route)
  - one tap, no typing.
- **📍 Use my location**: one tap uses GPS (`navigator.geolocation`) instead of typing a postcode -
  the biggest barrier removed for elderly / visually-impaired / new-arrival users. Typing a place
  overrides it.
- **Voice-first**: large mic (browser STT in), answers spoken back via **ElevenLabs** (server-side).
- **Accessibility controls** (persisted): text size **A-/A+**, **dark** + **high-contrast** themes, **mute**.
- **Screen-reader & keyboard polish**: result uses a polite, atomic live region and **focus moves to
  the answer** when it arrives; a dedicated announcer speaks transient status ("finding the nearest…",
  geocode/mic errors, "Listening…", "Heard: …"); `prefers-reduced-motion` disables the mic pulse; one
  spoken reply at a time (new answers cancel in-flight audio).
- **Clean, focused map** (light CARTO tiles) that zooms to your result with a clear "you → there" line -
  plus a **List view** so you never *need* the map.
- **Multilingual** (13 languages incl. **English, Ελληνικά, 中文**, Español, Français, Português,
  Italiano, Polski, …): ask + hear the answer in your language. Nemotron replies in the chosen
  language; ElevenLabs `eleven_multilingual_v2` speaks it; mic STT switches locale; UI labels
  translate for the major ones.
- **Big Simple mode**: one giant mic + the spoken answer in huge text, nothing else - for the least
  tech-confident / visually impaired.
- **Walking directions** (🧭): real step-by-step via the bridge's `/route` (OSRM foot), spoken aloud;
  falls back to bearing+distance if offline.
- **Call & Save** on the answer card: **📞 Call** (when the dataset has a phone) and **⭐ Save** to a
  local "Saved places" list.

## Run
On the box, start the bridge (connects the UI to the agent + ElevenLabs voice):
```bash
export ELEVENLABS_API_KEY=sk_...  ELEVENLABS_VOICE_ID=...
export CIVIC_DATA_DIR="$HOME/Desktop/Codeborough/datasets"
node ui/bridge.mjs            # :8091
python3 -m http.server 8090   # serves the page
```
Open `http://127.0.0.1:8090/ui/` (tunnel 8090 + 8091 to your laptop for the demo).
The **sample buttons work offline** (no bridge) for rehearsal.

### Bridge env knobs (all optional)
| Var | Effect |
|---|---|
| `OPENCLAW_HTTP_URL` | Talk to the gateway over **HTTP** instead of scraping `openclaw agent` stdout (e.g. `http://127.0.0.1:18789/agent`). The CLI is the automatic fallback, so set this once you've confirmed the endpoint. `OPENCLAW_TOKEN` adds a bearer header. |
| `ROUTING_DISABLE=1` | Skip the OSRM network call; walking-route **safety scoring still runs on-device** (straight-line corridor). |
| `LOCAL_STT_CMD` | On-device whisper for voice-in (`POST /stt`), e.g. `"/opt/whisper.cpp/main -m ggml-base.en.bin -nt -otxt -f {in} -of {out}"`. Unset → UI uses browser STT. |
| `POLLING_LOOKUP_URL` | A "where do I vote" API template with `{postcode}` for the **assigned** station (`POST /polling`). Unset → on-device **nearest** station, honestly labelled. |

Endpoints added: `/route` now returns on-device `safety` (monitored-%) alongside steps; `/ask` accepts
a `grounded` field so the spoken reply is pinned to the same facts as the answer card; `/stt` and
`/polling` as above.

## Files
- `index.html` - the UI (self-contained; Leaflet via CDN).
- `bridge.mjs` - zero-dep Node bridge: `/ask` (runs the OpenClaw agent), `/geocode` `/nearest`
  `/safety` (civic-geo), `/tts` (ElevenLabs, key stays server-side).
