# Data scope: where we are and what to decide

A short note for our prep meeting today (Monday 1 June), ahead of the hackathon (5 to 7 June, 1 Triton Square, London). Please read it, do your own research, and bring notes and ideas so we can discuss how to design it and the implementation steps.

## What the repository contains right now

We have collected real open data for six of our seven facilities, all for the **London Borough of Camden only**:

- Libraries (13)
- Reception centres (19)
- Schools (658, includes some surrounding boroughs)
- Public toilets (39)
- Polling stations (61)
- Grit bins (177)

Each one is in its own folder under `datasets/`, saved as both a spreadsheet (`.csv`) and a map-ready file with coordinates (`.geojson`). Full details of where each came from are in `datasets/SOURCES.md`.

CCTV is not included, because councils do not publish CCTV camera locations as open data (it is held back for security reasons).

## The limitation to be aware of

Right now our data only covers **one borough, Camden**, not all of London.

The reason is how London's data works: each of London's 33 councils publishes its own data separately, in its own format. There is no single source that has all of these facilities for the whole of London. Camden happened to publish all of ours in one place, which is why we started there. (Background on this is in `docs/london-structure.md`.)

## What expanding to all of London would actually look like

It is not all or nothing. The facilities split into three groups:

1. **Easy to expand to all of London.** Schools, libraries, public toilets and polling stations each have a single national or London-wide source we can pull from. Covering all of London for these is roughly one download each.
2. **Hard to expand.** Grit bins and reception centres only exist council by council. To cover London we would have to collect from many separate council websites, each different, with gaps. A lot of manual work.
3. **Not possible.** CCTV is not available anywhere.

## What to think about before Monday

Main question: do we keep things to Camden for now and treat it as our working example, or do we expand the facilities we easily can to cover all of London?

Things worth a view from everyone:

- Does the demo land better as "works across London" or as "one borough done in depth"?
- For the judges, is broad coverage or depth of information per place more impressive?
- How much of our limited time should go into chasing more data versus building the actual product?
- If we expand, are we comfortable that some facilities (grit bins, reception centres) stay Camden-only while others are London-wide?

Action: each of us researches the above and takes notes on implementation ideas. We then meet today (Monday 1 June) to discuss how to design it and the implementation steps, so we arrive at the hackathon (5 to 7 June) ready to build.
