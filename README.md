# Codeborough

A **local-first Facilities Navigator** that lets Londoners instantly locate civic services and places near them, and learn more about each one.

Built for **NVIDIA Hack for Impact - London**.

## The problem

Generic map tools don't know what's actually around you in a civic sense - where the nearest library, public toilet, or polling station is, or what services a reception centre offers. The data exists across many open datasets, but it's scattered and hard to query in plain language.

## Our solution

Codeborough understands a natural-language request, finds the relevant facilities across a range of London open datasets, and returns an accurate, contextual answer - all running on-device.

Covered datasets:

1. Libraries
2. Reception centres
3. CCTV cameras
4. Schools
5. Public toilets
6. Polling stations
7. Grit bins

### How it works

- **Small, specialised models** parse the user request, route it to the right dataset(s), and compose the answer - rather than one large general model.
- **Open datasets** are pulled in and queried locally to ground every response in real data.
- **Runs on a local NVIDIA DGX machine**, which means:
  - **Privacy** - user location and queries never leave the device.
  - **Richer answers** - local data integration surfaces detail a generic map tool can't.
  - **Anywhere** - the system is self-contained and doesn't depend on the cloud.

## Hackathon

| | |
|---|---|
| **Event** | NVIDIA Hack for Impact - London |
| **Theme** | Build autonomous systems that think, act, and run anywhere, for positive impact |
| **Platform** | On-device deployment on NVIDIA DGX Spark / ZGX Nano (GB10 Grace Blackwell), open-source models |
| **Track** | **Public Services** - improving access to and efficiency of city services |
| **Team** | Codeborough |

Our project targets the **Public Services** track: grounding agentic, local-first intelligence in real City of London open data to make civic services genuinely easy to find.

## Repository contents

Facility data is organised per facility, then per borough, with a merged file across all boroughs:

```
datasets/<facility>/<borough>/<facility>.geojson   raw data for one borough
datasets/<facility>/<facility>-all-london.geojson  all boroughs merged
```

| Path | What it is |
|---|---|
| [`datasets/libraries/`](datasets/libraries/) | Libraries (42 across 4 boroughs) |
| [`datasets/reception-centres/`](datasets/reception-centres/) | Reception / rest centres (47 across 2 boroughs) |
| [`datasets/cctv/`](datasets/cctv/) | CCTV cameras (549 across 2 boroughs) |
| [`datasets/schools/`](datasets/schools/) | Schools (1000 across 4 boroughs) |
| [`datasets/public-toilets/`](datasets/public-toilets/) | Public toilets (216 across 5 boroughs) |
| [`datasets/polling-stations/`](datasets/polling-stations/) | Polling stations (464 across 7 boroughs) |
| [`datasets/grit-bins/`](datasets/grit-bins/) | Grit bins (376 across 4 boroughs) |
| [`datasets/SOURCES.md`](datasets/SOURCES.md) | Coverage matrix, sources, licences, caveats, and refresh URLs |
| [`docs/london-structure.md`](docs/london-structure.md) | How London is organised (boroughs, wards, geographies) and why facility data is split across sources |
| [`docs/data-scope-notes.md`](docs/data-scope-notes.md) | Team note on coverage and the scope options to decide |
| [`LICENSE`](LICENSE) | Project licence |

Data covers the 8 of 33 London authorities that publish these facilities as open location data; coverage per facility is partial. See [`datasets/SOURCES.md`](datasets/SOURCES.md) for the full matrix and caveats.

## Team

**Codeborough**
