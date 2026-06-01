# How London is Organised

Reference for understanding where civic facility data comes from.

## Hierarchy

```
Greater London            GLA / Mayor - strategic (transport, police, planning, London Datastore)
   │
   ├── 33 local authorities    Councils - own & publish facility data
   │        └── Wards          Electoral subdivisions (polling stations attach here)
   │              └── MSOA → LSOA → Output Area    Census statistical geographies
   │
   └── 5 sub-regions          Planning groupings only
```

- **Greater London** - governed by the GLA (Mayor + Assembly). Runs TfL, the Met, and the London Datastore. Strategic, not local services.
- **Local authorities (councils)** - deliver day-to-day services, so they own the facility data.
- **City of London** - not a borough; the historic "Square Mile", run by the City of London Corporation with its own police. The 33rd authority.
- **Wards** - electoral units inside a borough.
- **LSOA / MSOA / Output Area** - Census geographies; most Datastore *statistics* break down by these.

## The 33 local authorities

**Inner London (12 + City of London)**

Camden · Greenwich · Hackney · Hammersmith & Fulham · Islington · Kensington & Chelsea · Lambeth · Lewisham · Southwark · Tower Hamlets · Wandsworth · Westminster
*(+ City of London - separate, unique)*

**Outer London (20)**

Barking & Dagenham · Barnet · Bexley · Brent · Bromley · Croydon · Ealing · Enfield · Haringey · Harrow · Havering · Hillingdon · Hounslow · Kingston upon Thames · Merton · Newham · Redbridge · Richmond upon Thames · Sutton · Waltham Forest

> **32 boroughs + City of London = 33 authorities**, all inside Greater London.
> "Inner/Outer" has two official definitions (1965 statutory vs ONS) that disagree on Greenwich, Haringey, Newham. The **borough** is the unit that matters for data.

## Why this matters for the data

Every facility in this project is a **borough responsibility**, so the data lives on 33 separate council systems in different formats:

| Facility | Run by the borough as… |
|---|---|
| Libraries | public library service |
| Schools | local education authority |
| Public toilets | public conveniences |
| Grit bins | winter road gritting |
| Polling stations | electoral services |
| Reception centres | council customer-service points |
| CCTV | town-centre CCTV |

**Key takeaway:** strategic data → GLA / London Datastore; facility data → 33 boroughs. There is no single "London facilities" database. The only ways to go London-wide are cross-borough aggregators (DfE for schools, Arts Council for libraries, Democracy Club for polling stations) - otherwise it's borough-by-borough. See [`../datasets/SOURCES.md`](../datasets/SOURCES.md).
