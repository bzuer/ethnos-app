# Collaborations — co-authorship partnerships, ego-networks, and per-person collaborators

This domain surfaces **co-authorship relationships** derived from the `authorships` table (a self-join on `work_id`, joining `persons` for names and `publications`/`works` for years and citations). There is **no Manticore** involvement here — every query runs in MariaDB. Three read-only endpoints are exposed: a global ranking of the most productive research partnerships (`/collaborations/top`), and two person-scoped views (`/persons/{id}/collaborators`, `/persons/{id}/network`) that live on the persons route surface but belong conceptually to this domain. All three are open (no access key) and governed by the shared rate limiter. See [../00-conventions.md](../00-conventions.md) for the response envelope, pagination (`page/limit` + `offset/limit`), error codes, and shared `meta` flags. Related: person entities and their metrics are documented in [./persons.md](./persons.md); the identical top-partnerships payload is also served by `/metrics/collaborations` (see [./metrics.md](./metrics.md)).

**Shape note for the frontend:** all three endpoints return the DTO shape `{ ranking, collaborators:{person_1,person_2}, metrics, timespan }` (top) / `{ collaborator, metrics, timespan }` (per-person) / `{ nodes, edges, network_stats }` (network). The `collaboration_pair` / `collaboration_metrics` schema names that appear in older `docs/swagger.json` are stale — trust the live shapes below.

---

## `GET /collaborations/top`

Most productive research partnerships: pairs of persons who co-authored, ranked by shared-work count descending. Restricted to the **top 2000 persons by `persons.total_works`** (each with `total_works >= 30`), keeping pairs whose shared-work count is at least `min_collaborations`. Backed by a MariaDB `authorships` self-join; the count is budgeted (statement-timeout). Cached ~30 min; the first uncached call is heavy (~3 s).

**Query parameters** (all optional):

| param | type | default | accepted values / bounds | effect |
|---|---|---|---|---|
| `min_collaborations` | integer | 5 | 1..50 | Minimum shared-work count per pair (`HAVING collaboration_count >= n`). |
| `year_from` | integer | none | 1900 .. currentYear+1 | Keep pairs with at least one shared publication year `>=` this value. |
| `year_to` | integer | none | 1900 .. currentYear+1 | Keep pairs with at least one shared publication year `<=` this value. |
| `page` | integer | 1 | min 1 | Standard page (see conventions). |
| `limit` | integer | 20 | 1..100 | Page size. |
| `offset` | integer | 0 | min 0 | Alternative to `page`; combined with `limit`. |

This endpoint does **not** honour the shared citation/sort params — ordering is fixed to shared-works DESC.

**Example requests**:

```
GET /collaborations/top?limit=3
GET /collaborations/top?min_collaborations=50&year_from=2015&year_to=2020
GET /collaborations/top?limit=2&offset=2&min_collaborations=50&year_from=2015&year_to=2020
```

**Example response** (`GET /collaborations/top?limit=3`):

```json
{
  "status": "success",
  "data": [
    {
      "ranking": 1,
      "collaborators": {
        "person_1": { "id": 400985, "name": "Et Al" },
        "person_2": { "id": 5757439, "name": "et al et al" }
      },
      "metrics": {
        "shared_works": 375,
        "avg_shared_citations": 15,
        "collaboration_strength": "very_strong"
      },
      "timespan": {
        "first_collaboration_year": 1975,
        "latest_collaboration_year": 2024,
        "collaboration_years": 50
      }
    },
    {
      "ranking": 2,
      "collaborators": {
        "person_1": { "id": 85449, "name": "Carter G Woodson" },
        "person_2": { "id": 3626787, "name": "C G Woodson" }
      },
      "metrics": { "shared_works": 237, "avg_shared_citations": 0.68, "collaboration_strength": "very_strong" },
      "timespan": { "first_collaboration_year": 1916, "latest_collaboration_year": 1950, "collaboration_years": 35 }
    },
    {
      "ranking": 3,
      "collaborators": {
        "person_1": { "id": 1518, "name": "M Strathern" },
        "person_2": { "id": 3587328, "name": "Marilyn Strathern" }
      },
      "metrics": { "shared_works": 229, "avg_shared_citations": 26.19, "collaboration_strength": "very_strong" },
      "timespan": { "first_collaboration_year": 1966, "latest_collaboration_year": 2026, "collaboration_years": 61 }
    }
  ],
  "pagination": { "page": 1, "limit": 3, "total": 780, "totalPages": 260, "hasNext": true, "hasPrev": false },
  "meta": {
    "query_time_ms": 3167,
    "source": "collaboration_ranking",
    "summary": { "total_partnerships": 780, "avg_collaborations": 280 },
    "filters": { "min_collaborations": 5, "year_from": null, "year_to": null },
    "request": { "method": "GET", "path": "/collaborations/top?limit=3" },
    "pagination_extras": { "offset": 0 }
  }
}
```

**Fields**:

| field (dot-path) | type | notes |
|---|---|---|
| `status` | string | `"success"`. |
| `data` | array | Flat array of partnership objects (not wrapped in an object). |
| `data[].ranking` | integer | 1-based global rank across the whole result set (offset-aware: page 2 of `limit=2` starts at 3). |
| `data[].collaborators.person_1.id` | integer | Person id; the **lower** id of the pair (`LEAST`). |
| `data[].collaborators.person_1.name` | string \| null | `persons.preferred_name`. |
| `data[].collaborators.person_2.id` | integer | The **higher** id of the pair (`GREATEST`). |
| `data[].collaborators.person_2.name` | string \| null | `persons.preferred_name`. |
| `data[].metrics.shared_works` | integer | Distinct co-authored works between the pair. |
| `data[].metrics.avg_shared_citations` | number | `ROUND(AVG(works.citation_count), 2)` over the shared works; integer-valued when it rounds evenly (e.g. `15`), can be `0`. |
| `data[].metrics.collaboration_strength` | string enum | `very_strong` (`shared_works >= 10`), `strong` (`>= 5`), `moderate` (`>= 2`), `weak` (else). |
| `data[].timespan.first_collaboration_year` | integer \| null | `MIN(publications.year)` across shared works. |
| `data[].timespan.latest_collaboration_year` | integer \| null | `MAX(publications.year)`. |
| `data[].timespan.collaboration_years` | integer | `latest - first + 1`; `0` if either bound is null. |
| `pagination.*` | object | Standard block; `total` is an exact COUNT (budgeted, falls back to `offset+len` on statement-timeout). |
| `meta.query_time_ms` | integer | Uncached ~3 s (heavy self-join); ms when cache-hit. |
| `meta.source` | string | `"collaboration_ranking"`. |
| `meta.summary.total_partnerships` | integer | Equals `pagination.total`. |
| `meta.summary.avg_collaborations` | integer | Mean `shared_works` over the returned page rows only (rounded) — not a global average. |
| `meta.filters.min_collaborations` | integer | Effective filter echo. |
| `meta.filters.year_from` | integer \| null | Echo. |
| `meta.filters.year_to` | integer \| null | Echo. |
| `meta.pagination_extras.offset` | integer | Effective offset. |
| `meta.degraded` | boolean | Present and `true` only if the self-join trips its statement-timeout budget and the page degrades to empty. Not observed under normal load. |

**Notes / caveats**:
- The top of the ranking is dominated by **duplicate-author artifacts** — the same person recorded under name variants (e.g. `Et Al`/`et al et al`; `Carter G Woodson`/`C G Woodson`; `M Strathern`/`Marilyn Strathern`). These are not genuine two-person partnerships; the UI may want to visually flag pairs whose names normalize to the same string. Genuine distinct collaborations appear further down.
- With `min_collaborations=50&year_from=2015&year_to=2020` the result narrows to ~10 partnerships (`total: 10`).
- `total` is exact when the COUNT completes within budget; on timeout it falls back and `pagination` reflects an estimate. No `pagination_total_exact` flag is emitted by this endpoint specifically.

---

## `GET /persons/{id}/collaborators`

All co-authors of a single person, ranked by shared-work count descending, with per-pair metrics and timespan. Backed by the MariaDB `authorships` self-join scoped to `person_id = {id}`. Fast (single-person scope, ~10 ms).

**Path parameters**:

| param | type | notes |
|---|---|---|
| `id` | integer (min 1) | Person id. Non-integer / `<1` → 400 validation error. |

**Query parameters** (all optional):

| param | type | default | accepted values / bounds | effect |
|---|---|---|---|---|
| `min_collaborations` | integer | 2 | 1..50 | Minimum shared-work count for a co-author to be included (`HAVING >= n`). |
| `sort_by` | string | `collaboration_count` | `collaboration_count`, `latest_collaboration_year`, `avg_citations_together` | Requested ordering. **Currently the data query hard-orders by `collaboration_count DESC` regardless** — the value is validated and echoed in `meta.filters.sort_by` but does not change row order. See [../API_ISSUES.md](../API_ISSUES.md). |
| `page` | integer | 1 | min 1 | Standard page. |
| `limit` | integer | 20 | 1..100 | Page size. |
| `offset` | integer | 0 | min 0 | Alternative to `page`. |

**Example requests**:

```
GET /persons/18165/collaborators
GET /persons/18165/collaborators?limit=3&min_collaborations=10
GET /persons/10592611/collaborators          (person with no qualifying co-authors → empty list, 200)
```

**Example response** (`GET /persons/18165/collaborators?limit=3`):

```json
{
  "status": "success",
  "data": {
    "person_id": 18165,
    "collaborators": [
      {
        "collaborator": { "id": 3616510, "name": "David Lester" },
        "metrics": {
          "shared_works": 179,
          "avg_shared_citations": 0.54,
          "collaboration_strength": "very_strong"
        },
        "timespan": {
          "first_collaboration_year": 1966,
          "latest_collaboration_year": 2026,
          "collaboration_years": 61
        }
      },
      {
        "collaborator": { "id": 3624542, "name": "Bijou Yang" },
        "metrics": { "shared_works": 63, "avg_shared_citations": 0.54, "collaboration_strength": "very_strong" },
        "timespan": { "first_collaboration_year": 1988, "latest_collaboration_year": 2016, "collaboration_years": 29 }
      },
      {
        "collaborator": { "id": 687684, "name": "Ahmed M Abdel-Khalek" },
        "metrics": { "shared_works": 56, "avg_shared_citations": 0.04, "collaboration_strength": "very_strong" },
        "timespan": { "first_collaboration_year": 1997, "latest_collaboration_year": 2023, "collaboration_years": 27 }
      }
    ]
  },
  "pagination": { "page": 1, "limit": 3, "total": 150, "totalPages": 50, "hasNext": true, "hasPrev": false },
  "meta": {
    "query_time_ms": 12,
    "source": "collaboration_analysis",
    "person_id": 18165,
    "filters": { "min_collaborations": 2, "sort_by": "collaboration_count" },
    "summary": { "total_collaborators": 150, "avg_collaborations_per_collaborator": 99 },
    "request": { "method": "GET", "path": "/persons/18165/collaborators?limit=3" },
    "pagination_extras": { "offset": 0 }
  }
}
```

**Fields**:

| field (dot-path) | type | notes |
|---|---|---|
| `status` | string | `"success"`. |
| `data.person_id` | integer | The queried person. |
| `data.collaborators` | array | Co-author rows; may be `[]` (still 200) when the person has co-authors but none reach `min_collaborations`. |
| `data.collaborators[].collaborator.id` | integer | Co-author person id. |
| `data.collaborators[].collaborator.name` | string \| null | `persons.preferred_name`. |
| `data.collaborators[].metrics.shared_works` | integer | Distinct shared works. |
| `data.collaborators[].metrics.avg_shared_citations` | number | `ROUND(AVG(works.citation_count), 2)` over the shared works; can be `0`. |
| `data.collaborators[].metrics.collaboration_strength` | string enum | `very_strong`/`strong`/`moderate`/`weak` (same thresholds as `/collaborations/top`). |
| `data.collaborators[].timespan.first_collaboration_year` | integer \| null | `MIN(publications.year)`. |
| `data.collaborators[].timespan.latest_collaboration_year` | integer \| null | `MAX(publications.year)`. |
| `data.collaborators[].timespan.collaboration_years` | integer | `latest - first + 1`; `0` if either null. |
| `pagination.*` | object | Envelope-level (sibling of `data`, not nested inside it). `total` = distinct-collaborator COUNT (budgeted). |
| `meta.query_time_ms` | integer | Typically single/low double-digit ms. |
| `meta.source` | string | `"collaboration_analysis"`. |
| `meta.person_id` | integer | Duplicate of `data.person_id`. |
| `meta.filters.min_collaborations` | integer | Echo. |
| `meta.filters.sort_by` | string | Echo of the requested sort (not applied — see caveat). |
| `meta.summary.total_collaborators` | integer | Equals `pagination.total`. |
| `meta.summary.avg_collaborations_per_collaborator` | integer | Mean `shared_works` over the returned page rows (rounded). |
| `meta.pagination_extras.offset` | integer | Effective offset. |

**Notes / caveats**:
- **Empty vs 404.** A person who exists and has at least one 1-shared-work co-author but none meeting `min_collaborations` returns **200 with `data.collaborators: []`**, `pagination.total: 0`, `summary.total_collaborators: 0` (example id `10592611`). A person with literally no co-authors, or a non-existent id, returns **404** `{"code":"NOT_FOUND","message":"Collaborators for person with ID … not found"}`.
- **`sort_by` is non-functional** — ordering is always `collaboration_count DESC` (see [../API_ISSUES.md](../API_ISSUES.md)). Do not build UI sort controls that rely on it.
- To lower the inclusion threshold and see more co-authors, drop `min_collaborations` to `1`.

---

## `GET /persons/{id}/network`

Co-authorship **ego-network**: a BFS outward from the central person, returning graph `nodes` and `edges` for force-directed / graph visualisations. Backed by MariaDB `authorships`. Hard caps: **120 nodes** (`NODE_CAP`), **20 direct collaborators per node** (fan-out cap), and edges require `weight` (shared works) `>= 2`. No pagination.

**Path parameters**:

| param | type | notes |
|---|---|---|
| `id` | integer (min 1) | Central person id. |

**Query parameters** (all optional):

| param | type | default | accepted values / bounds | effect |
|---|---|---|---|---|
| `depth` | integer | 2 | 1..3 | BFS hops from the central person. `depth=1` = direct collaborators only; `depth>=2` adds indirect. `depth>3` or `<1` → 400 validation error. |

**Example requests**:

```
GET /persons/18165/network
GET /persons/18165/network?depth=1
GET /persons/18165/network?depth=3
```

**Example response** (`GET /persons/18165/network?depth=1`, trimmed):

```json
{
  "status": "success",
  "data": {
    "central_person_id": 18165,
    "network_depth": 1,
    "nodes": {
      "18165": { "id": 18165, "name": "D Lester", "type": "central", "level": 0 },
      "3616510": { "id": 3616510, "name": "David Lester", "type": "direct_collaborator", "level": 1 },
      "76299": { "id": 76299, "name": "Antoon A Leenaars", "type": "direct_collaborator", "level": 1 }
    },
    "edges": [
      { "source": 18165, "target": 3616510, "weight": 179, "relationship": "collaboration" },
      { "source": 18165, "target": 3624542, "weight": 63, "relationship": "collaboration" }
    ],
    "network_stats": {
      "total_nodes": 21,
      "total_edges": 20,
      "direct_collaborators": 20,
      "network_density": 0.095
    }
  },
  "meta": {
    "query_time_ms": 5,
    "source": "network_analysis",
    "complexity": { "total_nodes": 21, "total_edges": 20, "direct_collaborators": 20, "network_density": 0.095 },
    "request": { "method": "GET", "path": "/persons/18165/network?depth=1" }
  }
}
```

At `depth=2` (the default) the same person saturates the cap: `nodes` grows to 120, `edges` to 169, with the 20 direct collaborators plus `indirect_collaborator` (level 2) nodes.

**Fields**:

| field (dot-path) | type | notes |
|---|---|---|
| `data.central_person_id` | integer | The queried person. |
| `data.network_depth` | integer | Effective depth after clamping to 1..3. |
| `data.nodes` | object (map) | **Keyed by stringified person-id**, not an array. Includes the central node. Capped at 120 entries. |
| `data.nodes.<id>.id` | integer | Person id (matches the map key). |
| `data.nodes.<id>.name` | string \| null | `persons.preferred_name`. |
| `data.nodes.<id>.type` | string enum | `central` (level 0), `direct_collaborator` (level 1), `indirect_collaborator` (level >= 2). |
| `data.nodes.<id>.level` | integer | 0 central, 1 direct, 2/3 indirect (= BFS hop distance). |
| `data.edges` | array | Undirected, unique co-authorship edges with `weight >= 2`. |
| `data.edges[].source` | integer | Person id (one endpoint). |
| `data.edges[].target` | integer | Person id (other endpoint). |
| `data.edges[].weight` | integer | Shared-work count between the two persons. |
| `data.edges[].relationship` | string | Always `"collaboration"`. |
| `data.network_stats.total_nodes` | integer | Node count including central (<= 120). |
| `data.network_stats.total_edges` | integer | Edge count. |
| `data.network_stats.direct_collaborators` | integer | Count of level-1 nodes (<= 20 fan-out cap). |
| `data.network_stats.network_density` | number | `edges / (n*(n-1)/2)`, rounded to 3 decimals. A JSON number, not a string. |
| `meta.query_time_ms` | integer | Typically single-digit ms. |
| `meta.source` | string | `"network_analysis"`. |
| `meta.complexity` | object | Byte-for-byte duplicate of `data.network_stats`. |

**Notes / caveats**:
- **No pagination** on this endpoint — the whole (capped) graph comes back in one payload. Consumers must handle up to 120 nodes / ~170 edges client-side.
- `nodes` is a **map keyed by string ids**, so iterate `Object.values(data.nodes)` (or use the keys to resolve `edges[].source/target` to node objects for rendering).
- Edges with only a single shared work (`weight < 2`) are omitted by design; a direct collaborator with exactly 1 shared work will not appear.
- **404 guard:** a non-existent person (or one with no co-authorship network) returns 404 `{"code":"NOT_FOUND","message":"Collaboration network for person with ID … not found"}`.
- Because of the 20-per-node fan-out and 120-node cap, a highly-connected person's network is a **sample**, not an exhaustive graph — do not present `total_nodes`/`total_edges` as the person's true collaborator count (use `/persons/{id}/collaborators` for the full ranked list).
