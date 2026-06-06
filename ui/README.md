# Codeborough UI - accessible, answer-first civic helper

A voice-first, **answer-first** web UI for the agent. The map is a *supporting* visual, not the
interface - because our users (elderly, visually impaired, new arrivals) can't navigate a dense
all-London map. Built for accessibility and one-tap use.

## What's different (vs a generic map app)
- **Answer card is the hero**: big place name, walk-time, and **♿ step-free / 🚼 baby-change / 🕐 hours**
  badges, plus a **🔊 Hear again** button. Announced to screen readers (`aria-live`).
- **"Where are you?" + big icon buttons** (🗳️ vote · 🚻 toilet · 🆘 rest centre · 📚 library · ❄️ grit · 🛡️ safe route)
  - one tap, no typing.
- **Voice-first**: large mic (browser STT in), answers spoken back via **ElevenLabs** (server-side).
- **Accessibility controls** (persisted): text size **A-/A+**, **dark** + **high-contrast** themes, **mute**.
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
export ELEVENLABS_API_KEY=sk_...  ELEVENLABS_VOICE_ID=...  OLLAMA_API_KEY=ollama
export CIVIC_DATA_DIR="$HOME/Desktop/Codeborough/datasets"
node ui/bridge.mjs            # :8091
python3 -m http.server 8090   # serves the page
```
Open `http://127.0.0.1:8090/ui/` (tunnel 8090 + 8091 to your laptop for the demo).
The **sample buttons work offline** (no bridge) for rehearsal.

## Files
- `index.html` - the UI (self-contained; Leaflet via CDN).
- `bridge.mjs` - zero-dep Node bridge: `/ask` (runs the OpenClaw agent), `/geocode` `/nearest`
  `/safety` (civic-geo), `/tts` (ElevenLabs, key stays server-side).
