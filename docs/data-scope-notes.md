# Data scope: where we are and what to decide

> **Historical note (pre-hackathon prep).** This scope question is now **settled** - see
> [`build-plan.md`](build-plan.md). We use the data we already have, with the live demo focused on
> **Lambeth**. Kept below for context on how we got here.

A short note for our prep meeting today (Monday 1 June), ahead of the hackathon (5 to 7 June, 1 Triton Square, London). Please read it and bring your view so we can settle how wide to go and how to design it.

## What the repository contains right now

We started with Camden (which publishes all our facilities in one place), then checked every other borough and pulled what they publish as open location data. We now have **8 authorities**, not just Camden.

Coverage so far (record counts; a dash means that borough does not publish it):

| Borough | Libraries | Reception | CCTV | Schools | Toilets | Polling | Grit bins |
|---|--:|--:|--:|--:|--:|--:|--:|
| Camden | 13 | 19 | - | 658 | 39 | 61 | 177 |
| Lambeth | 11 | - | 470 | 100 | 32 | 101 | - |
| Wandsworth | 11 | - | - | 81 | - | 83 | 55 |
| Kingston | 7 | - | - | - | - | 53 | 110 |
| Kensington & Chelsea | - | 28 | 79 | - | 48 | - | - |
| Barnet | - | - | - | 161 | 26 | 91 | - |
| City of London | - | - | - | - | 71 | 4 | 34 |
| Hammersmith & Fulham | - | - | - | - | - | 71 | - |
| **Total** | **42** | **47** | **549** | **1000** | **216** | **464** | **376** |

Each borough's raw file sits in `datasets/<facility>/<borough>/`, and all boroughs are merged into one `datasets/<facility>/<facility>-all-london.geojson` per facility. Full sources and caveats are in `datasets/SOURCES.md`.

## The limitation to be aware of

We checked all 32 boroughs plus the City of London. Only **8** publish any of these facilities as open location data. The other 24 have only statistics, or no open data portal at all.

The reason is how London works: each council publishes its own data separately, in its own format. There is no single source with all these facilities for the whole city. (Background in `docs/london-structure.md`.)

So even after collecting everything available, coverage is partial and uneven: some facilities exist in several boroughs, some in only one or two.

## Our options

1. **Camden only.** Treat Camden as one borough done in depth. Cleanest and most consistent, all facilities present.
2. **Use what we have now (8 authorities).** Wider reach, but coverage is patchy: e.g. toilets in 5 boroughs, grit bins in 4, CCTV in 2, reception centres in 2.
3. **Go genuinely London-wide for the three that allow it.** Schools, libraries and polling stations each have a single national source (DfE for schools, Arts Council for libraries, Democracy Club for polling) that covers all of London in one download. The other four (toilets, grit bins, CCTV, reception centres) have no national source, so they stay borough-by-borough whatever we choose.

These can be combined: e.g. national sources for schools/libraries/polling, plus the boroughs we have for the rest.

## Things worth a view from everyone

- Does the demo land better as "works across London" or "one borough done in depth"?
- For the judges, is broad coverage or depth of information per place more impressive?
- Are we comfortable with uneven coverage (some facilities London-wide, others only a few boroughs)?
- How much of our limited time should go into chasing or cleaning data versus building the product?

A practical detail if we go wider: each borough uses different field names, so the merged files share geometry but not yet a common set of attributes. Unifying those fields is extra work we would need to budget for.

Action: bring your view to today's meeting so we can pick a direction and the implementation steps, and arrive at the hackathon (5 to 7 June) ready to build.
