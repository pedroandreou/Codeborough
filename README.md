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

| Path | What it is |
|---|---|
| [`datasets/`](datasets/) | The civic facility data, one subdirectory per facility, each as `.csv` and `.geojson` |
| [`datasets/libraries/`](datasets/libraries/) | Libraries (13, Camden) |
| [`datasets/reception-centres/`](datasets/reception-centres/) | Council reception centres (19, Camden) |
| [`datasets/schools/`](datasets/schools/) | Schools (658, Camden + surrounding boroughs) |
| [`datasets/public-toilets/`](datasets/public-toilets/) | Public toilets (39, Camden) |
| [`datasets/polling-stations/`](datasets/polling-stations/) | Polling stations (61, Camden) |
| [`datasets/grit-bins/`](datasets/grit-bins/) | Grit bins (177, Camden) |
| [`datasets/SOURCES.md`](datasets/SOURCES.md) | Where each dataset comes from, licences, refresh URLs, and why some facilities aren't centrally available |
| [`docs/london-structure.md`](docs/london-structure.md) | How London is organised (boroughs, wards, geographies) and why facility data is split across sources |
| [`LICENSE`](LICENSE) | Project licence |

Current scope is a **London Borough of Camden** pilot. CCTV is not included: it is withheld from open data for security (see [`datasets/SOURCES.md`](datasets/SOURCES.md)).

## Team

**Codeborough**
