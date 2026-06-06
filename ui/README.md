# Codeborough demo map UI

A self-contained Leaflet map that renders the `civic-geo` tool output on a London map -
the visual we show on screen while the voice agent talks. No build step, no backend required.

## Run

```bash
# from the repo root
python3 -m http.server 8090
# then open  http://localhost:8090/ui/
```
…or just open `ui/index.html` directly in a browser.

## What it does

- **Demo buttons** load bundled sample scenarios (family → school, toilets, safe streets/CCTV,
  elderly → polling, coverage) and render them instantly - works offline for rehearsal.
- **Feed live tool JSON**: paste any `civic-geo` output into the box and click *Render*. It
  auto-detects the shape:
  - `geocode` → `{lat, lon, ...}` → "you are here" marker
  - `find_nearest` → `{results:[{name,lat,lon,distance_m,facility,...}]}` → facility pins + route line
  - `safety_count` → `{cctv_count, nearest_cameras:[...]}` → camera markers + radius (monitored-streets)
  - `list_coverage` → `[{facility,total,boroughs}]` → coverage summary
- Per-facility colour legend; "monitored / busy streets" wording for CCTV (never "surveillance").

## Wire it to the live agent (optional)

The sample path works standalone. To drive it from the running agent, have OpenClaw's
`civic-geo` tool results POSTed/streamed into the page (see the `TODO` hook in `app`/`index.html`),
or simply paste the tool JSON during the demo. The map is intentionally decoupled so a glitch in
voice never breaks the visual.
