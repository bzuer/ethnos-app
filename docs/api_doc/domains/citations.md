# Citations — citation graph, references, bibliometrics and network for a work

This domain exposes the **citation relationships of a single work**: who cites it, what it cites, its bibliometric summary, and a bounded citation-network graph. All four operations are nested under `/works/{id}` and are backed purely by the MariaDB `work_references` table (edges: `status` ∈ `PENDING|RESOLVED|FAILED`, `citation_type` ∈ `POSITIVE|NEUTRAL|NEGATIVE|SELF`) joined to `works`/`publications`/`venues`/`authorships` for hydration. **No Manticore/full-text is involved** — these are pure relational reads. The parent work resource itself lives in [./works.md](./works.md); the `cited_by_count` / `references_count` shown on work listings there come from the denormalized `works.citation_count` / `works.reference_count` columns and can differ from the exact `work_references` counts computed here (see caveats). Global response envelope, pagination (`page`/`limit` + `offset`/`limit`), error codes and rate-limiting are described in [../00-conventions.md](../00-conventions.md); this chapter documents only what is specific to citations.

An edge in `work_references` records "citing_work cites cited_work". A citation may be resolved by a **direct work link** (`cited_work_id` set) or only by a **DOI** (`cited_doi` set, `cited_work_id` null → the cited work is not yet in the corpus). `RESOLVED` means the cited work exists locally; `PENDING` is the normal state for a DOI not yet matched (not an error); `FAILED` is a resolution attempt that gave up.

All four endpoints are **public** (no key). Non-existent work ids return **404** via an existence guard (`SELECT id FROM works WHERE id=?`); invalid params return **400** with the standard express-validator envelope.

---

## `GET /works/{id}/citations`

Lists works that **cite** the target work (incoming edges). Public, MariaDB `work_references` joined to `works`/latest-publication/`venues`/`authorships`. Ordered by `MAX(wr.id) DESC` — most-recently-ingested citing edge first.

**Path parameters**

| param | type | notes |
|---|---|---|
| `id` | integer ≥ 1 | Work id. 404 if the work does not exist. |

**Query parameters**

| param | type | default | accepted values / bounds | effect |
|---|---|---|---|---|
| `type` | string | `all` | `all`, `POSITIVE`, `NEUTRAL`, `NEGATIVE`, `SELF` | Filters citing edges by `work_references.citation_type`. `all` = no filter. Invalid value → 400. |
| `page` | integer | 1 | ≥ 1 | 1-based page. |
| `limit` | integer | 20 | 1..100 | Page size. `0` or `>100` → 400. |
| `offset` | integer | — | ≥ 0 | Alternative to `page`; skip N rows. Combined with `limit` it resolves to a page (e.g. `offset=2&limit=2` → page 2). |

There are no shared citation/sort params on this endpoint (no `sort_by`, no `cited_by_*`) — it is a fixed most-recent-first order.

**Example requests**

```
GET /works/7539537/citations?limit=2
GET /works/7539537/citations?limit=20&type=NEUTRAL
GET /works/7539537/citations?limit=20&offset=40
GET /works/22519667/citations?limit=5        # a work with zero citations
```

**Example response** (`7539537` "Using thematic analysis in psychology", trimmed to one array element; `total` really is 43,419):

```json
{
  "status": "success",
  "data": {
    "work_id": 7539537,
    "citing_works": [
      {
        "citing_work_id": 22479148,
        "cited_work_id": null,
        "title": "Insights of Vietnamese American Women on Cervical Cancer Screening and HPV Self-Sampling",
        "type": "ARTICLE",
        "publication_year": 2026,
        "venue_name": "Journal of Racial and Ethnic Health Disparities",
        "venue_abbreviated_name": "J. Racial Ethn. Heal. Disparities",
        "doi": "10.1007/s40615-026-03114-8",
        "authors_count": 7,
        "citation": { "type": "NEUTRAL", "status": "RESOLVED", "context": null }
      }
    ],
    "filters": { "type": "all" }
  },
  "pagination": { "page": 1, "limit": 2, "total": 43419, "totalPages": 21710, "hasNext": true, "hasPrev": false },
  "meta": {
    "query_time_ms": 207,
    "source": "citations_analysis",
    "filters": { "type": "all" },
    "request": { "method": "GET", "path": "/works/7539537/citations?limit=2" },
    "pagination_extras": { "offset": 0 }
  }
}
```

Empty case (`22519667`) is the identical envelope with `citing_works: []`, `pagination.total: 0`, `totalPages: 0`.

**Fields**

| field (dot-path) | type | notes |
|---|---|---|
| `data.work_id` | integer | Echoes the path id. |
| `data.citing_works[]` | array | One entry per distinct citing work, most-recently-ingested first. Empty when there are no citations (or none match `type`). |
| `data.citing_works[].citing_work_id` | integer | Id of the work that cites the target. Link to `/works/{citing_work_id}`. |
| `data.citing_works[].cited_work_id` | null | **Always `null`** here (the shared DTO carries both keys; only `citing_work_id` is meaningful on this endpoint). |
| `data.citing_works[].title` | string \| null | Citing work title. |
| `data.citing_works[].type` | string \| null | Publication type of the citing work's latest publication: `ARTICLE\|BOOK\|CHAPTER\|THESIS\|CONFERENCE\|CONFERENCE_PAPER\|REPORT\|DATASET\|PREPRINT\|REVIEW\|EDITORIAL\|OTHER`. |
| `data.citing_works[].publication_year` | integer \| null | Year of the citing work (from its latest-publication summary). |
| `data.citing_works[].venue_name` | string \| null | Falls back to the abbreviated name if the full name is null. |
| `data.citing_works[].venue_abbreviated_name` | string \| null | Short venue name; may be null even when `venue_name` is set. |
| `data.citing_works[].doi` | string \| null | DOI of the citing work. |
| `data.citing_works[].authors_count` | integer | Count of `authorships` rows for the citing work; defaults `0`. |
| `data.citing_works[].citation` | object | The edge summary between this citing work and the target. |
| `data.citing_works[].citation.type` | string \| null | Aggregated citation type over the edges from that citing work (`MIN(citation_type)`): `POSITIVE\|NEUTRAL\|NEGATIVE\|SELF`. |
| `data.citing_works[].citation.status` | string \| null | Derived: `RESOLVED` if any edge resolved, else `PENDING`, else `FAILED`. |
| `data.citing_works[].citation.context` | null | **Always `null`** — no citation-context text is stored. |
| `data.filters.type` | string | Echoes the requested `type` filter (`all` when unset). |
| `pagination.*` | object | Standard block. `total` = **exact** `COUNT(DISTINCT citing_work_id)` (no statement-budget flag on this endpoint). |
| `meta.query_time_ms` | integer | Server time for the request. |
| `meta.source` | string | Constant `"citations_analysis"`. |
| `meta.filters.type` | string | Duplicate of `data.filters.type`. |
| `meta.pagination_extras.offset` | integer | Resolved offset. |
| `meta.request.{method,path}` | object | From the global response formatter. |

**Notes / caveats**

- The count is **exact** — there is no `pagination_total_exact` flag and no under-fill risk here.
- **Latency:** the `COUNT(DISTINCT …)` and hydration on very-highly-cited works (tens of thousands of citations, e.g. `7539537`) can take a few hundred ms up to a few seconds. It still returns; do not set an aggressive client timeout for such works.
- `type=SELF` / `POSITIVE` / `NEGATIVE` legitimately return `total: 0` for most works — in the current data essentially all edges are `NEUTRAL`.
- `cited_work_id` is structurally always null here; use `citing_work_id` for navigation.
- Related: reverse direction is `/works/{id}/references` (this section, below); aggregate counts are on `/works/{id}/metrics`.

---

## `GET /works/{id}/references`

Lists works that the target work **references** (outgoing edges), split into locally-resolved references and unresolved DOI-only references, with corpus-wide `counts`. Public, MariaDB `work_references`. No `type` filter here.

**Path parameters**

| param | type | notes |
|---|---|---|
| `id` | integer ≥ 1 | Work id. 404 if the work does not exist. |

**Query parameters**

| param | type | default | bounds | effect |
|---|---|---|---|---|
| `page` | integer | 1 | ≥ 1 | 1-based page. |
| `limit` | integer | 20 | 1..100 | Page size (paginates the combined reference rows). |
| `offset` | integer | — | ≥ 0 | Alternative to `page`; same semantics as `/citations`. |

No `type` filter and no sort params — references come back in the table's natural order.

**Example requests**

```
GET /works/22519667/references?limit=3
GET /works/22519667/references?limit=100      # whole reference list in one page
GET /works/22519667/references?limit=20&page=2
```

**Example response** (`22519667`, 56 references = 42 resolved / 14 unresolved; arrays trimmed):

```json
{
  "status": "success",
  "data": {
    "work_id": 22519667,
    "referenced_works": [
      {
        "citing_work_id": null,
        "cited_work_id": 13047110,
        "title": "Black Orthodox “Visual Piety”",
        "type": "ARTICLE",
        "publication_year": 2020,
        "venue_name": "Journal of Africana Religions",
        "venue_abbreviated_name": "J. Afr. Relig.",
        "doi": "10.5325/jafrireli.8.1.0084",
        "authors_count": 1,
        "citation": { "type": "NEUTRAL", "context": null }
      }
    ],
    "unresolved_references": [
      {
        "cited_doi": "10.1093/oso/9780198797852.003.0013",
        "status": "PENDING",
        "citation_type": "NEUTRAL",
        "created_at": "2026-07-23T03:25:16.000Z",
        "resolved_at": null
      }
    ],
    "unsolved": [
      {
        "cited_doi": "10.1093/oso/9780198797852.003.0013",
        "status": "PENDING",
        "citation_type": "NEUTRAL",
        "created_at": "2026-07-23T03:25:16.000Z",
        "resolved_at": null
      }
    ],
    "counts": { "total": 56, "resolved": 42, "unresolved": 14 }
  },
  "pagination": { "page": 1, "limit": 100, "total": 56, "totalPages": 1, "hasNext": false, "hasPrev": false },
  "meta": {
    "query_time_ms": 2,
    "source": "references_analysis",
    "request": { "method": "GET", "path": "/works/22519667/references?limit=100" },
    "pagination_extras": { "offset": 0 }
  }
}
```

**Fields**

Resolved references block (`data.referenced_works[]`):

| field (dot-path) | type | notes |
|---|---|---|
| `data.work_id` | integer | Echoes the path id. |
| `data.referenced_works[]` | array | RESOLVED references **on the current page only**, de-duplicated by `cited_work_id`. Page-scoped (see caveats). |
| `data.referenced_works[].citing_work_id` | null | **Always `null`** here (shared DTO). |
| `data.referenced_works[].cited_work_id` | integer | Referenced work id. Link to `/works/{cited_work_id}`. |
| `data.referenced_works[].title` | string \| null | Referenced work title. |
| `data.referenced_works[].type` | string \| null | Publication type enum (same set as `/citations`). |
| `data.referenced_works[].publication_year` | integer \| null | Year of the referenced work. |
| `data.referenced_works[].venue_name` | string \| null | Falls back to abbreviated name. |
| `data.referenced_works[].venue_abbreviated_name` | string \| null | May be null. |
| `data.referenced_works[].doi` | string \| null | Falls back to the edge's `cited_doi` when the work summary DOI is null. |
| `data.referenced_works[].authors_count` | integer | Author count of the referenced work. |
| `data.referenced_works[].citation` | object | `{ type, context }` — **note there is no `status` key here** (unlike `/citations`, where the row carries `citation.status`). |
| `data.referenced_works[].citation.type` | string \| null | `POSITIVE\|NEUTRAL\|NEGATIVE\|SELF`. |
| `data.referenced_works[].citation.context` | null | Always `null`. |

Unresolved block (`data.unresolved_references[]`, and its alias `data.unsolved[]`):

| field (dot-path) | type | notes |
|---|---|---|
| `data.unresolved_references[]` | array | PENDING/FAILED reference rows **on the current page**. |
| `data.unresolved_references[].cited_doi` | string \| null | DOI that has not been resolved to a local work. |
| `data.unresolved_references[].status` | string | `PENDING` (default) or `FAILED`. |
| `data.unresolved_references[].citation_type` | string | `POSITIVE\|NEUTRAL\|NEGATIVE\|SELF`, default `NEUTRAL`. |
| `data.unresolved_references[].created_at` | string(ISO) \| null | When the edge was recorded. |
| `data.unresolved_references[].resolved_at` | string(ISO) \| null | `null` while unresolved. |
| `data.unsolved[]` | array | **Exact alias of `unresolved_references`** (identical content, kept for back-compat). Prefer `unresolved_references`. |

Counts block (corpus-wide, not page-scoped):

| field (dot-path) | type | notes |
|---|---|---|
| `data.counts.total` | integer | All `work_references` rows for this work (= `pagination.total`). |
| `data.counts.resolved` | integer | RESOLVED rows with a non-null `cited_work_id`, across the whole work (not just this page). |
| `data.counts.unresolved` | integer | PENDING + FAILED rows, across the whole work. |
| `pagination.*` | object | `total = counts.total`; **exact** count. |
| `meta.source` | string | Constant `"references_analysis"`. |
| `meta.query_time_ms` / `meta.pagination_extras.offset` / `meta.request.*` | — | Standard. |

**Notes / caveats**

- **Two different scopes on one payload.** `referenced_works` and `unresolved_references`/`unsolved` are **page-scoped** — they are split out of the current page's rows only. `counts` is **corpus-wide**. Drive summary badges ("42 resolved · 14 unresolved") off `data.counts`; render the two lists off the arrays. A page that happens to contain only resolved rows will show `unresolved_references: []` even though `counts.unresolved > 0` (and vice-versa). To get every resolved reference hydrated in one shot, request `limit=100` when `counts.total ≤ 100`.
- The `unsolved` key is a redundant alias — do not treat it as a distinct dataset.
- Fast endpoint (single-digit ms typical).
- Related: reverse direction `/works/{id}/citations`; totals also appear on `/works/{id}/metrics` (`total_references_made`).

---

## `GET /works/{id}/metrics`

Bibliometric summary for one work: citations received, references made, citation-type breakdown, temporal span and impact flags. Public, MariaDB `work_references` + `publications`. No query params.

**Path parameters**

| param | type | notes |
|---|---|---|
| `id` | integer ≥ 1 | Work id. 404 if the work does not exist (the guard runs before the service's zeroed-metrics fallback, so a bad id is a real 404). |

**Query parameters:** none.

**Example requests**

```
GET /works/7539537/metrics       # highly-cited
GET /works/22519667/metrics      # zero citations
```

**Example response** (`7539537`):

```json
{
  "status": "success",
  "data": {
    "work_id": 7539537,
    "title": "Using thematic analysis in psychology",
    "type": "ARTICLE",
    "publication_year": 2006,
    "citation_metrics": {
      "total_citations_received": 43419,
      "total_references_made": 34,
      "unique_citing_works": 43419,
      "citations_per_year": 775.34,
      "citation_types": { "positive": 0, "neutral": 43419, "negative": 0, "self": 0 }
    },
    "temporal_metrics": {
      "first_citation_year": 1970,
      "latest_citation_year": 2027,
      "citation_span_years": 58
    },
    "impact_indicators": { "highly_cited": true, "citation_velocity": "recent" }
  },
  "meta": {
    "query_time_ms": 227,
    "source": "bibliometric_analysis",
    "request": { "method": "GET", "path": "/works/7539537/metrics" }
  }
}
```

Zero-citation case (`22519667`): every count `0`, `citations_per_year: 0`, all three `temporal_metrics` `null`, `highly_cited: false`, `citation_velocity: "historical"`.

**Fields**

| field (dot-path) | type | notes |
|---|---|---|
| `data.work_id` | integer | Path id. |
| `data.title` | string \| null | Work title. |
| `data.type` | string \| null | Latest publication type (subquery `ORDER BY year DESC, id DESC`). Same enum set as above. |
| `data.publication_year` | integer \| null | **Earliest (MIN)** publication year of the work. |
| `data.citation_metrics.total_citations_received` | integer | `COUNT(*)` of RESOLVED `work_references` where `cited_work_id = id`. May differ from `cited_by_count` on `/works` (see caveats). |
| `data.citation_metrics.total_references_made` | integer | `COUNT(*)` of all `work_references` where `citing_work_id = id` (includes unresolved). Matches `counts.total` on `/references`. |
| `data.citation_metrics.unique_citing_works` | integer | `COUNT(DISTINCT citing_work_id)`. |
| `data.citation_metrics.citations_per_year` | number (float, 2-dp) | `total_citations_received ÷ max(1, currentYear − first_citation_year)`. `0` when no citations. |
| `data.citation_metrics.citation_types.positive` | integer | Count of citing edges with `citation_type = POSITIVE`. |
| `data.citation_metrics.citation_types.neutral` | integer | `NEUTRAL` count. |
| `data.citation_metrics.citation_types.negative` | integer | `NEGATIVE` count. |
| `data.citation_metrics.citation_types.self` | integer | `SELF` count. |
| `data.temporal_metrics.first_citation_year` | integer \| null | MIN publication year across citing works. `null` when no citations. |
| `data.temporal_metrics.latest_citation_year` | integer \| null | MAX publication year across citing works. |
| `data.temporal_metrics.citation_span_years` | integer \| null | `latest − first + 1`; `null` if either endpoint is null. |
| `data.impact_indicators.highly_cited` | boolean | `true` when `total_citations_received > 100`. |
| `data.impact_indicators.citation_velocity` | string | `current` (latest citation year = this year), `recent` (≥ thisYear−2), `historical` (older / no citations), or `unknown` (internal-fallback path). |
| `meta.source` | string | Constant `"bibliometric_analysis"`. |
| `meta.query_time_ms` / `meta.request.*` | — | Standard. |

**Notes / caveats**

- **Two citation totals can disagree.** `total_citations_received` counts RESOLVED `work_references` rows, while `/works` (and `/publications`) surface the denormalized `works.citation_count` as `cited_by_count`. For `7539537` this endpoint reports 43,419 while `/works` reports ~21,493 — they are computed from different sources. Decide per screen which is authoritative; do not expect them to match.
- **Temporal fields are approximate.** `first_citation_year` / `latest_citation_year` derive from citing works' `publications.year`, which contains dirty data — expect floor artifacts (e.g. `1970`) and future years (e.g. `2027`), which inflate `citation_span_years` and deflate `citations_per_year`. Present these as soft/approximate, or clamp client-side.
- Graceful degradation: on an internal error (for an *existing* work) the service returns zeroed metrics with `citation_velocity: "unknown"` rather than 500. A non-existent id still 404s (guard precedes the fallback).
- See ../API_ISSUES.md for the citation-count-source discrepancy and dirty-year follow-ups.

---

## `GET /works/{id}/network`

Builds a bounded citation-network graph (nodes + directed edges) around a central work, BFS-expanded over **resolved** `work_references` up to `depth` levels. Public, MariaDB. The graph is a **sample, not exhaustive**: hard caps ~120 nodes / 100 edges / 200 per level.

**Path parameters**

| param | type | notes |
|---|---|---|
| `id` | integer ≥ 1 | Central work id. 404 if the work does not exist. |

**Query parameters**

| param | type | default | bounds | effect |
|---|---|---|---|---|
| `depth` | integer | 1 | 1..3 | BFS expansion levels. `depth=5` (or 0) → 400. |

No pagination — the whole graph is one payload.

**Example requests**

```
GET /works/22519667/network
GET /works/22519667/network?depth=2
GET /works/22519667/network?depth=3
```

**Example response** (`22519667`, `depth=1` → 43 nodes / 42 edges; nodes map and edges array trimmed to one entry each):

```json
{
  "status": "success",
  "data": {
    "central_work_id": 22519667,
    "network_depth": 1,
    "nodes": {
      "22519667": { "id": 22519667, "title": "Theological Possibilities and the Anthropology of Eastern Orthodox Christianity", "year": 2026, "is_central": true },
      "13047110": { "id": 13047110, "title": "Black Orthodox “Visual Piety”", "year": 2020, "is_central": false }
    },
    "edges": [
      { "source": 22519667, "target": 13047110, "depth": 1, "citation_type": "NEUTRAL", "source_year": 2026, "target_year": 2020 }
    ],
    "network_stats": { "total_nodes": 43, "total_edges": 42, "max_depth": 1 }
  },
  "meta": {
    "query_time_ms": 1,
    "source": "network_analysis",
    "complexity": { "total_nodes": 43, "total_edges": 42, "max_depth": 1 },
    "request": { "method": "GET", "path": "/works/22519667/network" }
  }
}
```

**Fields**

| field (dot-path) | type | notes |
|---|---|---|
| `data.central_work_id` | integer | The path id — the graph's center. |
| `data.network_depth` | integer | Echoes the requested `depth` (raw display value; traversal internally clamps to 1..3). |
| `data.nodes` | object (map) | **Keyed by work-id string** → node object. NOT an array — iterate `Object.values()`. Includes the central node plus every discovered node. |
| `data.nodes.<id>.id` | integer | Work id (same as the map key, numeric). |
| `data.nodes.<id>.title` | string \| null | Work title. |
| `data.nodes.<id>.year` | integer \| null | MIN publication year of that work. |
| `data.nodes.<id>.is_central` | boolean | `true` only for `central_work_id`; `false` for all others. Use to style the focal node. |
| `data.edges[]` | array | Directed edges (`source` cites `target`). |
| `data.edges[].source` | integer | Citing work id (present as a node). |
| `data.edges[].target` | integer | Cited work id (present as a node). |
| `data.edges[].depth` | integer | BFS level (1..maxDepth) at which the edge was discovered. |
| `data.edges[].citation_type` | string \| null | `POSITIVE\|NEUTRAL\|NEGATIVE\|SELF`. Lives on edges only, not nodes. |
| `data.edges[].source_year` | integer \| null | Year of the citing work. |
| `data.edges[].target_year` | integer \| null | Year of the cited work. |
| `data.network_stats.total_nodes` | integer | Distinct node count (≤ ~120 cap). |
| `data.network_stats.total_edges` | integer | Edge count (≤ 100 cap). |
| `data.network_stats.max_depth` | integer | Deepest edge depth present (`0` when the graph is empty). |
| `meta.source` | string | Constant `"network_analysis"`. |
| `meta.complexity` | object | Duplicate of `network_stats`. |
| `meta.query_time_ms` / `meta.request.*` | — | Standard. |

**Notes / caveats**

- **Bounded sample.** A deep or dense work returns a truncated graph — at `depth=2` a busy work hits the EDGE_CAP (100 edges / ~98 nodes for `22519667`). Do not treat the node/edge set as complete; there is no pagination to fetch the remainder.
- Nodes carry only `id/title/year/is_central` — no publication `type`, no per-node citation type. Citation type is an **edge** attribute.
- Traversal follows only **resolved** edges (unresolved DOI-only references never enter the graph), so the graph can be sparser than `/references` counts suggest.
- Graceful degradation: on an internal error (for an existing work) the service returns an empty graph (`nodes: {}`, `edges: []`, all stats `0`) rather than 500. A non-existent id still 404s.
- Rendering tip: build the node lookup from the `nodes` map, then draw `edges` as arrows `source → target`; highlight the node whose `is_central` is `true`.

---

## Shared behaviour across this domain

- **Existence guard (404).** All four endpoints run `SELECT id FROM works WHERE id=?` first; a missing work returns HTTP 404 with `code: "NOT_FOUND"` and a message like `"Citations for work with ID … not found"`.
- **Validation (400).** `type=<bad>`, `limit=0`/`limit>100`, `depth` outside 1..3, and a non-integer `id` return HTTP 400 with `code: "VALIDATION_ERROR"` and the express-validator `errors[]` array (`path`/`msg`/`location`). See [../00-conventions.md](../00-conventions.md).
- **Counts are exact.** `/citations` and `/references` totals are exact `COUNT` values — there is no statement-budget/`pagination_total_exact` degradation on this domain (unlike `/works`).
- **`context` is always null** and the cross-direction id key (`cited_work_id` on `/citations`, `citing_work_id` on `/references`) is always null — both are shared-DTO artifacts. Don't build UI that depends on them being populated.
