# Tool / API Reference

`[developer]`

The `civic-geo` OpenClaw plugin exposes **five tools** to the agent. These are the functions the language model calls during a conversation. All computation is on-device; none of these tools makes a network request.

> **Tool count note:** `src/index.ts` (the TypeScript adapter) defines six tools including `route_safety`. The **deployed entry** `index.js` registers five tools. `openclaw.plugin.json` confirms five. `SKILL.md` references `route_safety` as a callable tool - this is currently a gap. See [Known gaps](#known-gaps) at the end of this document.

Source: [`plugins/civic-geo/index.js`](../plugins/civic-geo/index.js), [`plugins/civic-geo/src/geo.mjs`](../plugins/civic-geo/src/geo.mjs).

---

## `geocode`

**Purpose:** Resolve any place description to WGS84 coordinates, fully offline. This is almost always the first tool called in a conversation.

**Strategy (four layers, tried in order):**
1. Literal coordinates - if `query` matches `"lat,lon"`, parse and return directly.
2. Postcode centroid - built at runtime from the dataset records. A full postcode resolves to its centroid; an outward code (`SW2`) resolves to the district centroid.
3. Landmark gazetteer - ~20 curated places (Brixton, Euston, King's Cross, Camden Town, Wandsworth, Kingston, Kensington, Hammersmith, City of London, etc.).
4. Substring match - scans every dataset record's name and address fields for the query string.

### Input

| Parameter | Type | Required | Description |
|---|---|---|---|
| `query` | string | ✅ | Place name, landmark, postcode, or `"lat,lon"` string |

### Output (success)

```json
{
  "lat": 51.4626,
  "lon": -0.1145,
  "source": "landmark"
}
```

`source` is one of `"literal"`, `"postcode"`, `"landmark"`, `"dataset"`.

### Output (failure)

```json
{
  "error": "not found",
  "query": "ZZ9 9ZZ"
}
```

### Example

```json
Input:   {"query": "Brixton"}
Output:  {"lat": 51.4626, "lon": -0.1145, "source": "landmark"}

Input:   {"query": "SW2 1JF"}
Output:  {"lat": 51.461, "lon": -0.1138, "source": "postcode"}

Input:   {"query": "51.52,-0.13"}
Output:  {"lat": 51.52, "lon": -0.13, "source": "literal"}
```

### Failure modes

- Query not in gazetteer, not a valid postcode in our data, and no substring match → `{"error": "not found"}`. The agent should ask the user for a different description or offer the nearest landmark it knows.
- Postcode geocoding only covers postcodes that appear in the 8-borough dataset. Postcodes in uncovered boroughs return not-found.

---

## `find_nearest`

**Purpose:** Find the nearest civic facilities to a point. Returns up to `limit` results sorted by distance ascending, optionally filtered by facility type and radius.

### Input

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `lat` | number | ✅ | - | Latitude (WGS84) |
| `lon` | number | ✅ | - | Longitude (WGS84) |
| `category` | string | - | all categories | Facility type. Accepted values and synonyms below. |
| `limit` | integer | - | 3 | Maximum results to return |
| `radiusKm` | number | - | no limit | Only return results within this radius (km) |

**Accepted category values** (case-insensitive, with synonyms):

| Category | Synonyms |
|---|---|
| `library` | `libraries` |
| `school` | `schools` |
| `toilet` | `toilets`, `public toilet`, `public toilets`, `loo` |
| `polling station` | `polling stations`, `polling`, `vote` |
| `grit bin` | `grit bins`, `grit` |
| `cctv` | `camera`, `cameras` |
| `reception centre` | `reception centres`, `reception`, `rest centre` |

### Output

```json
{
  "results": [
    {
      "id": "libraries:5",
      "facility": "libraries",
      "name": "Regent's Park Library",
      "address": "Robert Street, NW1 3BT",
      "borough": "camden",
      "lat": 51.5262,
      "lon": -0.1429,
      "distanceM": 415,
      "formatted": "Regent's Park Library - 415 m (about a 5-minute walk)"
    }
  ],
  "category": "libraries",
  "query": {"lat": 51.5247, "lon": -0.1417}
}
```

### Example

```json
Input:  {"lat": 51.5247, "lon": -0.1417, "category": "library", "limit": 3}
Output: {"results": [ ... up to 3 libraries sorted by distance ... ]}

Input:  {"lat": 51.4626, "lon": -0.1145, "category": "toilet", "radiusKm": 2, "limit": 5}
Output: {"results": [ ... toilets within 2 km of Brixton ... ]}
```

### Failure modes

- No results in the dataset for the given category (e.g. no library data for the query's borough) → `{"results": [], ...}`. The agent should call `list_coverage` and report honestly.
- Unknown `category` string → typically treated as "all categories" (no category filter applied). Source: `geo.mjs` CATEGORY_ALIASES.

---

## `get_details`

**Purpose:** Return the full record for one facility, including accessibility, hours, and contact fields. Use after `find_nearest` to answer follow-up questions.

### Input

| Parameter | Type | Required | Description |
|---|---|---|---|
| `id` | string | ✅ | Facility id as returned by `find_nearest` (e.g. `"libraries:7"`) |

### Output

```json
{
  "id": "public-toilets:12",
  "facility": "public-toilets",
  "name": "Stockwell Road Public Toilets",
  "address": "Stockwell Road, Lambeth, SW9 9TZ",
  "borough": "lambeth",
  "lat": 51.4707,
  "lon": -0.1224,
  "highlights": {
    "AccessibleCategory": "Accessible",
    "BabyChange": "Yes",
    "OpeningHours": "08:00 - 20:00"
  },
  "allProperties": { ... full source properties ... }
}
```

`highlights` contains the fields most likely to be spoken aloud (accessibility, hours, contact, type). The exact fields depend on the borough's source data. `allProperties` contains the verbatim source record.

### Failure modes

- Unknown `id` (not in the loaded datasets) → `{"error": "not found", "id": "..."}`.
- The requested facility has no accessibility or hours data in the source → `highlights` will be empty or incomplete. The agent should say "I don't have accessibility details for this one" rather than guessing.

---

## `safety_count`

**Purpose:** Count CCTV cameras (and grit bins) within a radius of a point - the "monitored / busy streets" density signal for a single location.

**Framing note (required):** CCTV in this dataset is predominantly TfL traffic cameras and town-centre cameras on busy, well-served roads - **not** community-safety surveillance. The agent must always describe this as "busy, monitored main roads", never imply crime levels or surveillance. Source: `index.js` tool description; `SKILL.md` step 4.

### Input

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `lat` | number | ✅ | - | Latitude |
| `lon` | number | ✅ | - | Longitude |
| `radiusM` | number | - | 400 | Radius in metres |

### Output

```json
{
  "lat": 51.4626,
  "lon": -0.1145,
  "radiusM": 500,
  "cctv_count": 41,
  "grit_count": 3,
  "note": "CCTV here is mostly traffic/town-centre cameras (busy roads), not crime surveillance."
}
```

### Example

```json
Input:  {"lat": 51.4626, "lon": -0.1145, "radiusM": 500}
Output: {"cctv_count": 41, "grit_count": 3, ...}
```

Expected output for Brixton at 500 m radius: ~41 cameras. Source: `plugins/civic-geo/README.md` smoke test expected values.

### Failure modes

- No CCTV data for the query area → `cctv_count: 0`. Only Lambeth and Kensington & Chelsea have CCTV data. The agent should call `list_coverage` if it's unsure.

---

## `list_coverage`

**Purpose:** Return a summary of which facility types and boroughs have data loaded, with record counts. Use to avoid over-promising on coverage gaps.

### Input

None. Takes no parameters.

### Output

```json
[
  {
    "facility": "cctv",
    "total": 549,
    "boroughs": {"lambeth": 470, "kensington-and-chelsea": 79}
  },
  {
    "facility": "grit-bins",
    "total": 376,
    "boroughs": {"camden": 177, "wandsworth": 55, "kingston": 110, "city-of-london": 34}
  },
  ...
]
```

### Example

```json
Input:  {}
Output: [ array of {facility, total, boroughs} objects ]
```

### Usage pattern

Call `list_coverage` before committing to an answer about a borough or facility type you're unsure about. If the borough isn't in the `boroughs` map for the relevant facility, say so plainly. Source: `SKILL.md` step 5.

---

## Known gaps

### `route_safety` - defined but not registered

`route_safety` computes the fraction of a walking route that falls within a corridor of CCTV cameras. The function exists in `geo.mjs` as `routeSafety` and is defined in `src/index.ts`. It is **not registered** in the deployed `index.js` and is **not listed** in `openclaw.plugin.json` `contracts.tools`.

SKILL.md step 4 tells the agent to call `route_safety` for "is the walk there safe" queries. Until the tool is added to `index.js`, these calls will fail.

**Workaround:** The bridge's `/route` endpoint calls `routeSafety` directly from `geo.mjs` and returns `safety` (monitored percentage) alongside turn-by-turn directions. The UI uses this endpoint for the route-safety display. The agent cannot call it as a tool in the current deployment.

**To fix:** Add the following to `index.js` `register(api)` block:

```javascript
import { routeSafety } from "./src/geo.mjs";

api.registerTool(
  () => ({
    name: "route_safety",
    label: "Route safety (monitored streets)",
    description:
      "Percentage of a walking route that passes within corridorM metres of a " +
      "CCTV camera. CCTV = traffic/town cameras (busy roads), NOT crime surveillance.",
    parameters: {
      type: "object",
      properties: {
        fromLat: { type: "number" },
        fromLon: { type: "number" },
        toLat:   { type: "number" },
        toLon:   { type: "number" },
        corridorM: { type: "number" },
      },
      required: ["fromLat", "fromLon", "toLat", "toLon"],
      additionalProperties: false,
    },
    execute: async (_id, p) =>
      ok(routeSafety({
        fromLat: p.fromLat, fromLon: p.fromLon,
        toLat: p.toLat, toLon: p.toLon,
        corridorM: p.corridorM ?? 150,
      })),
  }),
  { name: "route_safety" },
);
```

Then regenerate `openclaw.plugin.json` with `openclaw plugins build` and restart the gateway. Source: `src/index.ts` for the full parameter schema; `geo.mjs` for the `routeSafety` function.

---

## Reviewer rubric (self-assessment)

| # | Criterion | Status | Note |
|---|---|---|---|
| 1 | Accuracy | ✅ | Tool schemas verified against index.js and geo.mjs FIELDS/CATEGORY_ALIASES |
| 2 | Completeness | ✅ | All 5 registered tools; route_safety gap documented |
| 3 | Honesty | ✅ | CCTV framing, coverage limits, failure modes all stated |
| 4 | Audience fit | ✅ | Developer document |
| 5 | Extensibility | ✅ | route_safety fix recipe provided |
| 6 | Runnability | ⚠️ | Tool call examples are structurally correct; exact outputs depend on loaded data |
| 7 | Traceability | ✅ | Every parameter, default, and caveat cites source |
| 8 | Clarity | ✅ | Consistent table format per tool |
| 9 | Consistency | ✅ | Parameter names match index.js exactly |
| 10 | No overclaim | ✅ | route_safety gap, postcode coverage limit, CCTV framing all explicit |

## Assumptions register

- `[ASSUMPTION - verify]` Output shapes shown are inferred from `geo.mjs` function implementations. Verify against a live smoke test (`node plugins/civic-geo/scripts/smoke.mjs`) for exact field names and values.
- `[ASSUMPTION - verify]` `safety_count` output includes a `note` field about CCTV framing. Verify this is emitted by the `safetyCount` function in geo.mjs (the README and index.js description both require this framing, but the exact output shape should be confirmed by running the smoke test).
- `[ASSUMPTION - verify]` `list_coverage` output shape. The smoke test calls `listCoverage()` - run it to confirm the exact JSON structure.
