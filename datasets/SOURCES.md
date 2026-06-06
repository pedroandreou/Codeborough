# Datasets

Civic facility location data for London, gathered borough by borough.

## Layout

Each facility has its own folder. Inside it, one subfolder per borough holds that borough's raw data, and a single `*-all-london.geojson` merges every borough we have for that facility (each feature tagged with a `_borough` property).

```
datasets/<facility>/
├── <borough>/<facility>.geojson      raw data for one borough (some also .csv)
├── ...
└── <facility>-all-london.geojson     all boroughs merged, one file
```

All GeoJSON is WGS84 (longitude/latitude) point geometry, ready for "near me" queries.

## Coverage matrix

Numbers are record counts. A dash means that borough does not publish that facility as open location data.

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
| **Boroughs** | 4 | 2 | 2 | 4 | 5 | 7 | 4 |

We checked all 32 boroughs plus the City of London. The other 24 authorities publish none of these as open location data (statistics dashboards or no portal).

## Sources by borough

All released under the UK Open Government Licence (OGL) unless noted. Verify the licence on each portal before publishing.

| Borough | Portal / source | Platform |
|---|---|---|
| Camden | opendata.camden.gov.uk | Socrata |
| Lambeth | gis.lambeth.gov.uk (hub: lambethopenmappingdata-lambethcouncil.opendata.arcgis.com) | ArcGIS |
| Wandsworth | wandsworth.gov.uk "Location data" page | Static CSV |
| Kingston | od-rbk.opendata.arcgis.com | ArcGIS Hub |
| Kensington & Chelsea | RBKC ArcGIS services (rbkc-lbhf) | ArcGIS |
| Barnet | open.barnet.gov.uk | DataPress |
| City of London | mapping.cityoflondon.gov.uk (INSPIRE WFS) | ArcGIS WFS |
| Hammersmith & Fulham | LBHF ArcGIS services (rbkc-lbhf) | ArcGIS |

Camden libraries come from the Arts Council England libraries dataset (national, geocoded) filtered to Camden, not Camden's own portal.

## Caveats (read before relying on a layer)

- **Barnet schools and polling stations** publish only addresses, so coordinates are postcode-centroid geocodes (via postcodes.io), accurate to postcode level, not surveyed points.
- **Lambeth CCTV** is TfL traffic cameras, not council community-safety CCTV.
- **Kensington & Chelsea reception centres** are emergency rest centres, the nearest match to "reception centres", not routine customer-service desks.
- **City of London polling** is 4 polling places (tiny resident population); schools there are a catchment boundary, not points, so not included.
- Each portal uses a different platform and field names. The unified files merge geometry and tag `_borough`; the raw per-borough property fields are kept verbatim (not rewritten to a shared schema on disk). Instead, the `civic-geo` engine normalises them **at read time** — matching name/address/highlight fields case- and punctuation-insensitively, so `Establishment name`, `establishment_name` and `ESTABLISHMENT_NAME` all resolve to the same logical field. Address-only sources with no venue name (e.g. Camden/Wandsworth polling stations) are labelled from their address (`"Polling station, Stukeley Street, WC2B 5LL"`).
- **Camden `schools`** is a London-wide GIAS extract (658 rows) that is all tagged `_borough: camden` even though individual rows carry their true `local_authority_name` (often another borough). Treat Camden's school count as London-wide, not Camden-only, until the file is re-split by authority.

## A simpler route for three of these

For three facilities a single national dataset already covers all of London, with no borough stitching:

- **Schools** - DfE Get Information About Schools (GIAS)
- **Libraries** - Arts Council England (the source already used for Camden)
- **Polling stations** - Democracy Club (UK-wide; changes per election)

The borough-by-borough approach is the only option for **public toilets, grit bins, CCTV and reception centres**, where no national source exists.

## Not available

- **CCTV** beyond Lambeth (traffic) and Kensington & Chelsea (community safety). Most councils withhold camera locations. Barnet lists cameras but with no coordinates, so it could not be mapped.
- **Reception centres** beyond Camden and the K&C rest centres. Rare as open data.

## Refresh

- Socrata (Camden): `https://opendata.camden.gov.uk/resource/<ID>.geojson?$limit=50000`
- ArcGIS (Lambeth, Kingston, RBKC, H&F): `<FeatureServer or MapServer>/0/query?where=1=1&outFields=*&outSR=4326&f=geojson`
- WFS (City of London): `https://www.mapping.cityoflondon.gov.uk/arcgis/services/INSPIRE/MapServer/WFSServer?service=WFS&version=2.0.0&request=GetFeature&typeNames=<layer>&outputFormat=GEOJSON&srsName=EPSG:4326`
- Static CSV (Wandsworth, Barnet): download the CSV and convert any British National Grid eastings/northings to WGS84.

See [`../docs/london-structure.md`](../docs/london-structure.md) for why facility data is split across boroughs.
