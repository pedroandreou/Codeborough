# Datasets

Each facility has its own subdirectory under `datasets/`, holding a `.csv` (full tabular export) and a `.geojson` (point geometry for location queries). All GeoJSON records include coordinates. Scope is the **London Borough of Camden** (schools also include surrounding boroughs).

```
datasets/
├── grit-bins/          grit-bins.csv          grit-bins.geojson
├── libraries/          libraries.csv          libraries.geojson
├── polling-stations/   polling-stations.csv   polling-stations.geojson
├── public-toilets/     public-toilets.csv     public-toilets.geojson
├── reception-centres/  reception-centres.csv  reception-centres.geojson
├── schools/            schools.csv            schools.geojson
└── SOURCES.md
```

## Camden Open Data

Source: **Camden Open Data** (https://opendata.camden.gov.uk/), London Borough of Camden.
Licence: **UK Open Government Licence (OGL v2)** - free to use with attribution.

| Facility | File | Socrata ID | Records |
|---|---|---|---|
| Polling stations | `polling-stations` | `5rhh-fxna` | 61 |
| Schools (Camden + surrounding boroughs) | `schools` | `bgas-tixx` | 658 |
| Public toilets (Public Conveniences) | `public-toilets` | `4b2v-65nr` | 39 |
| Reception centres (Council Reception Points) | `reception-centres` | `afuk-bm95` | 19 |
| Grit bins | `grit-bins` | `jcq4-7pt3` | 177 |

Refresh:
- CSV: `https://opendata.camden.gov.uk/api/views/<ID>/rows.csv?accessType=DOWNLOAD`
- GeoJSON: `https://opendata.camden.gov.uk/resource/<ID>.geojson?$limit=50000`

## Libraries

Source: **Basic dataset of libraries 2023 (enhanced)**, librarydata.uk / Libraries Hacked, derived from Arts Council England's Libraries Location dataset.
File: `https://blog.librarydata.uk/files/basic-dataset-for-libraries-2023-enhanced.csv` (England-wide, 3,547 rows).
Licence: Open (OGL-based). Filtered here to `Upper tier local authority = Camden`.

| Facility | File | Records |
|---|---|---|
| Libraries | `libraries` | 13 |

## CCTV - not available

CCTV was listed on the **stale 2016** London Datastore Camden entry but is **not** on Camden's current open data portal. Surveillance CCTV locations are generally withheld for security reasons, so there is no equivalent open dataset.

Alternative if a "cameras" layer is wanted: **TfL JamCams** (live traffic cameras, London-wide) via the TfL Unified API / open feed - note these are traffic cameras, not council CCTV.

## Why these aren't all on the London Datastore - and where to get them

Root cause: the **London Datastore (GLA) holds statistics *about* London** (borough/ward counts, rates, results), **not facility *locations***. Facility point data is *operational* and owned by each borough, so it lives on borough portals (Camden, Brent, Wandsworth…) that the Datastore only links to. Hence each facility is "missing" for a specific reason:

| Facility | Why missing from the Datastore | Where to actually get it |
|---|---|---|
| Libraries | Only usage *statistics*; no location file | **Arts Council England** (national, geocoded) - *used here* |
| Schools | Abundant *statistics*, no location point file | **DfE Get Information About Schools (GIAS)** (national, geocoded) |
| Public toilets | Only a committee *report* with summary tables | **Great British Public Toilet Map** / `toilets4london` (London-wide, aggregated) |
| Polling stations | Only a 2010 file, incomplete (24/33 authorities) | **Democracy Club** (UK-wide, CSV + API; election-time-sensitive) |
| Grit bins | Pure operational borough data | **Borough portals only** - Camden (*used here*), +Brent/Wandsworth to widen |
| Reception centres | "Reception" on the Datastore = school year (age 4-5), not the facility | **Borough portals only** - Camden (*used here*) |
| CCTV | Only the stale Camden index entry | **Unavailable** - withheld for security (TfL JamCams = traffic cameras only) |

Coverage model: **schools + libraries** → full London via national datasets; **polling stations + toilets** → London-wide via aggregators (with caveats); **grit bins + reception centres** → borough-by-borough; **CCTV** → none. Other boroughs with facility location data include **Brent** and **Wandsworth** (each its own format). See [`../docs/london-structure.md`](../docs/london-structure.md) for why the data is split this way.
