# Institutions — organizations, their affiliated works, and their funded works

This domain exposes **organizations**: universities, institutes, publishers, funders and companies. It is backed entirely by the `organizations` MariaDB base table; search runs through the MariaDB `ft_organizations_name` FULLTEXT index plus an exact match against the `acronyms` JSON array (no Manticore here). Affiliated works are resolved through `authorships.affiliation_id` and funded works through `funding.funder_id`, both joining `works`/`publications`/`venues` — the same underlying corpus surfaced by [./works.md](./works.md) and [./publications.md](./publications.md), rendered through a compact affiliated-work DTO. Person links point into [./persons.md](./persons.md).

All responses use the standard envelope, pagination (`page/limit` and `offset/limit`), auth/rate-limit rules, boolean/date normalization, and shared citation/sort params documented in [../00-conventions.md](../00-conventions.md). This chapter documents only what is specific to institutions. Every endpoint is **public** (no key required).

> **Division of labour (important for the UI).** Whatever the DB stores, the API presents **verbatim and never recomputes**: the org metric columns (`works_count`, `researchers_count`, `total_citations`, `h_index`, `i10_index`, `two_yr_mean_citedness`) are the source of truth. Whatever is useful but not stored, the API **derives internally** from the affiliated-works corpus (year range, production-by-type, yearly trend, top authors, recent works), each bounded by a statement budget, cached, gated by an include flag, and degrading gracefully.

## Data reality — read before building filters

Org-type distribution across the whole `organizations` table (~640k rows):

| type | total rows | rows with `publication_count > 0` (browsable) |
|------|-----------:|----------------------------------------------:|
| INSTITUTE | ~410,940 | ~410,940 |
| FUNDER | ~215,396 | 0 |
| PUBLISHER | ~13,241 | 0 |
| UNIVERSITY / COMPANY / OTHER | 0 | 0 |

Consequences the frontend must design around:

- `GET /institutions` browse is **activity-gated on `publication_count > 0`**, so it only ever returns `type=INSTITUTE`. Passing `type=UNIVERSITY|PUBLISHER|FUNDER|COMPANY|OTHER` returns an empty page (`data:[]`, `total:0`) — it is not a bug.
- FUNDER and PUBLISHER organizations exist but have 0 publications. They are reachable **only by direct id** (`GET /institutions/{id}`) and, for funders, via `GET /institutions/{id}/funded-works`. They never appear in browse.
- `UNIVERSITY`, `COMPANY`, `OTHER` are dead enum values (no rows anywhere) but are accepted by validation.
- Unfiltered browse `pagination.total` ≈ **410,716** and is `pagination_total_exact: true` (counted under a 2.5 s budget).

---

## `GET /institutions`

List / search organizations. Browse is restricted to publication-bearing orgs (INSTITUTE only); adding `q`/`search` switches to search mode. Backed by MariaDB (`meta.engine = "MariaDB"` on browse, `"MariaDB-FULLTEXT"` on search).

### Query parameters

| param | type | default | accepted values / bounds | effect |
|-------|------|---------|--------------------------|--------|
| `page` | integer | 1 | ≥ 1 | 1-based page. |
| `limit` | integer | 20 | 1..100 (400 outside) | Items per page. |
| `offset` | integer | 0 | ≥ 0 | Alternative to `page`; accepted simultaneously; echoed at `meta.pagination_extras.offset`. |
| `search` | string | — | 2..255 chars | FULLTEXT over `name` (`ft_organizations_name`) ∪ exact match against the `acronyms` JSON array (e.g. `USP`). Switches to search mode. |
| `q` | string | — | 2..255 chars | Alias of `search`. |
| `type` | string enum | — | `UNIVERSITY,INSTITUTE,PUBLISHER,FUNDER,COMPANY,OTHER` (case-insensitive) | Filter by org type. On browse only `INSTITUTE` yields rows (see data reality). |
| `openalex_type` | string | — | 2..30 chars, exact | Finer OpenAlex type: `education`, `government`, `healthcare`, `nonprofit`, `archive`, `funder`, `company`, … |
| `country` | string | — | 2-letter ISO 3166-1 alpha-2 | Filter by `country_code`. |
| `country_code` | string | — | 2-letter ISO | Alias of `country`. |
| `status` | string enum | — | `active,inactive,withdrawn` (case-insensitive) | Lifecycle status. |
| `has_ror` | boolean | — | `true`/`false` | Restrict to `ror_id IS NOT NULL`. |
| `works_min` | integer | — | ≥ 0 | Inclusive lower bound on `works_count` (= `publication_count`). |
| `works_max` | integer | — | ≥ 0 | Inclusive upper bound on `works_count`. |
| `researchers_min` | integer | — | ≥ 0 | Inclusive lower bound on `researchers_count`. |
| `cited_by_min` | integer | — | ≥ 0 | Inclusive lower bound on `total_citations`. Alias `citation_count_min`. |
| `cited_by_max` | integer | — | ≥ 0 | Inclusive upper bound on `total_citations`. Alias `citation_count_max`. |
| `h_index_min` | integer | — | ≥ 0 | Inclusive lower bound on `h_index`. |
| `sort_by` | string enum | `works_count` (browse) / `relevance` (search) | `works_count, researchers_count, citations, cited_by_count, h_index, i10_index, name, id, created_at, updated_at, relevance` | Sort key. `citations` == `cited_by_count`. `relevance` applies only with a search term. camelCase alias `sortBy` honored. |
| `sort_order` | string | key-dependent | `ASC`/`DESC` | Numeric keys default `DESC`; `name`/`id` default `ASC`. camelCase alias `sortOrder` honored. |

Notes: this endpoint does **not** honour the shared `cited_by_count` sort against `works.citation_count` — its citation bounds and sort target the org-level `total_citations` column. Search results are ordered `acronym_exact DESC, publication_count DESC, name-relevance DESC, id ASC` regardless of the reported `relevance` value (see below).

### Example requests

```
GET /institutions?limit=2
GET /institutions?q=USP&limit=2
GET /institutions?sort_by=citations&sort_order=DESC&limit=2
GET /institutions?country=BR&works_min=100&h_index_min=10&limit=20
GET /institutions?openalex_type=government&sort_by=researchers_count&limit=20
```

### Example response (browse, `?limit=2`)

```json
{
  "status": "success",
  "data": [
    {
      "id": 2801117,
      "name": "University of Toronto",
      "type": "INSTITUTE",
      "openalex_type": "education",
      "status": "active",
      "acronyms": [],
      "location": { "country_code": "CA", "city": "Toronto" },
      "identifiers": {
        "ror_id": "03dbr7087",
        "grid_id": "grid.17063.33",
        "wikidata_id": "Q180865",
        "openalex_id": "I185261750",
        "url": "https://www.utoronto.ca"
      },
      "metrics": {
        "works_count": 5412,
        "researchers_count": 4323,
        "total_citations": 7822,
        "h_index": 35,
        "i10_index": 146,
        "two_yr_mean_citedness": 0.0352
      },
      "created_at": "2026-07-08T05:24:04.000Z",
      "updated_at": "2026-07-23T21:06:45.000Z",
      "_links": { "self": "/institutions/2801117" }
    }
    // ... (2 total; next item e.g. "Centre National de la Recherche Scientifique", acronyms:["CNRS"])
  ],
  "pagination": { "page": 1, "limit": 2, "total": 410716, "totalPages": 205358, "hasNext": true, "hasPrev": false },
  "meta": {
    "engine": "MariaDB",
    "query_type": "list",
    "elapsed_ms": 103,
    "source": "organizations",
    "sort": { "by": "works_count", "order": "DESC" },
    "pagination_total_exact": true,
    "request": { "method": "GET", "path": "/institutions?limit=2" },
    "pagination_extras": { "offset": 0 }
  }
}
```

On a **search** (`?q=USP`), each row additionally carries a top-level `relevance` float, and `meta` reports `engine: "MariaDB-FULLTEXT"`, `query_type: "search"`, `sort: { by: "relevance", order: "DESC" }`:

```json
{
  "id": 2801123,
  "name": "Universidade de São Paulo",
  "type": "INSTITUTE",
  "openalex_type": "education",
  "status": "active",
  "acronyms": ["USP"],
  "location": { "country_code": "BR", "city": "São Paulo" },
  "identifiers": { "ror_id": "036rp1748", "grid_id": "grid.11899.38", "wikidata_id": "Q835960", "openalex_id": "I17974374", "url": "https://www5.usp.br" },
  "metrics": { "works_count": 4312, "researchers_count": 4737, "total_citations": 2140, "h_index": 19, "i10_index": 44, "two_yr_mean_citedness": 0.0033 },
  "created_at": "2026-07-08T05:24:04.000Z",
  "updated_at": "2026-07-23T21:05:57.000Z",
  "_links": { "self": "/institutions/2801123" },
  "relevance": 0
}
```

### Fields (list item)

| field (dot-path) | type | notes |
|------------------|------|-------|
| `id` | integer | Organization id. |
| `name` | string | Canonical name. |
| `type` | string enum | `UNIVERSITY\|INSTITUTE\|PUBLISHER\|FUNDER\|COMPANY\|OTHER`. In browse always `INSTITUTE`. |
| `openalex_type` | string \| null | Finer OpenAlex type (`education`, `government`, `healthcare`, `nonprofit`, `archive`, `funder`, `company`, …). |
| `status` | string \| null | `active\|inactive\|withdrawn` (observed: `active`). |
| `acronyms` | string[] | May be `[]`. (On detail this moves under `names`.) |
| `location` | object \| null | `null` when both sub-fields are null. |
| `location.country_code` | string \| null | ISO 3166-1 alpha-2. |
| `location.city` | string \| null | City name. |
| `identifiers.ror_id` | string \| null | ROR id, no URL prefix. |
| `identifiers.grid_id` | string \| null | GRID id. |
| `identifiers.wikidata_id` | string \| null | Wikidata Q-id. |
| `identifiers.openalex_id` | string \| null | OpenAlex I-id. |
| `identifiers.url` | string \| null | Homepage URL. |
| `metrics.works_count` | integer | Stored `publication_count`, verbatim. |
| `metrics.researchers_count` | integer | Stored `researcher_count` (distinct local affiliated authors). |
| `metrics.total_citations` | integer | Stored. |
| `metrics.h_index` | integer \| null | Stored. |
| `metrics.i10_index` | integer \| null | Stored. |
| `metrics.two_yr_mean_citedness` | number \| null | Stored `2yr_mean_citedness`. |
| `created_at` | string(date-time) \| null | |
| `updated_at` | string(date-time) \| null | |
| `_links.self` | string | `/institutions/{id}`. |
| `relevance` | number | **Search responses only.** Name-MATCH relevance; `0` for acronym-only matches (the row qualified via the JSON-contains branch, not the name MATCH). Do not use it as a display ranking — trust the returned row order instead. |

### Notes / caveats

- The open-access surface is intentionally **not** exposed on `/institutions` — the stored `open_access_works_count` scope-mismatches `publication_count`, so a derived percentage could exceed 100 %. The raw count is available on `/metrics/institutions` instead.
- `pagination_total_exact` is normally `true` (count under a 2.5 s budget). If the budget ever fires the flag flips to `false` with an estimated `total` — see [../00-conventions.md](../00-conventions.md).
- Empty page for a non-INSTITUTE `type` filter is expected, not an error (data reality above).

---

## `GET /institutions/{id}`

Full institution profile. Resolves **any existing organization regardless of activity** — 0-publication FUNDER/PUBLISHER orgs resolve by id. A non-existent id returns **404**. This response has **no `pagination`**; `meta` carries only the `request` block.

### Path parameters

| param | type | notes |
|-------|------|-------|
| `id` | integer ≥ 1 | Organization id. |

### Query parameters (include flags)

| param | type | default | effect |
|-------|------|---------|--------|
| `include_production` | boolean | `true` | Embed `production_summary` (`by_work_type` + `publication_trend`). |
| `include_authors` | boolean | `true` | Embed `top_authors`. |
| `include_works` | boolean | `true` | Embed `recent_works`. |
| `include_relationships` | boolean | `true` | Embed the `relationships` hierarchy. |

When a flag is `false` the corresponding block is emitted **empty** (arrays `[]`, relationship counts `0`), not omitted — the shape stays stable.

### Example requests

```
GET /institutions/2801117
GET /institutions/2801117?include_production=false&include_authors=false&include_works=false&include_relationships=false
GET /institutions/694519            # a FUNDER org (0 publications) — resolves by id only
```

### Example response (trimmed; arrays reduced)

```json
{
  "status": "success",
  "data": {
    "id": 2801117,
    "name": "University of Toronto",
    "type": "INSTITUTE",
    "openalex_type": "education",
    "status": "active",
    "location": { "country_code": "CA", "city": "Toronto" },
    "names": {
      "acronyms": [],
      "alternative_names": ["University of Toronto", "Université de Toronto"],
      "aliases_count": 2
    },
    "identifiers": {
      "ror_id": "03dbr7087", "grid_id": "grid.17063.33",
      "wikidata_id": "Q180865", "openalex_id": "I185261750",
      "url": "https://www.utoronto.ca"
    },
    "metrics": {
      "works_count": 5412, "researchers_count": 4323, "total_citations": 7822,
      "h_index": 35, "i10_index": 146, "two_yr_mean_citedness": 0.0352,
      "first_publication_year": 1891, "latest_publication_year": 2026
    },
    "funding_role": { "funded_works_count": 0, "grants_count": 0 },
    "production_summary": {
      "by_work_type": [
        { "type": "ARTICLE", "works_count": 5367 },
        { "type": "OTHER", "works_count": 27 },
        { "type": "BOOK", "works_count": 8 },
        { "type": "CHAPTER", "works_count": 8 },
        { "type": "DATASET", "works_count": 2 }
      ],
      "publication_trend": [
        { "year": 2026, "works_count": 390 },
        { "year": 2025, "works_count": 435 }
        // ... (up to 15 years, most-recent-first)
      ]
    },
    "relationships": {
      "parents": [
        { "id": 2801740, "name": "University Health Network", "type": "INSTITUTE", "country_code": "CA", "_links": { "self": "/institutions/2801740" } }
        // ... (2 total)
      ],
      "children": [
        { "id": 2805274, "name": "Toronto Rehabilitation Institute", "type": "INSTITUTE", "country_code": "CA", "_links": { "self": "/institutions/2805274" } }
        // ... (4 total; note some rows have country_code: null)
      ],
      "related": [
        { "id": 2801669, "name": "Hospital for Sick Children", "type": "INSTITUTE", "country_code": "CA", "_links": { "self": "/institutions/2801669" } }
        // ... (21 total)
      ],
      "parents_count": 2,
      "children_count": 4,
      "related_count": 21
    },
    "top_authors": [
      { "person_id": 1594928, "preferred_name": "Richard M Saunders", "works_count": 46, "latest_publication_year": 1968, "_links": { "self": "/persons/1594928" } }
      // ... (up to 10)
    ],
    "recent_works": [
      {
        "id": 22456366,
        "title": "University expansion, academic fields, and the match between the degree and the job",
        "subtitle": null,
        "type": "ARTICLE",
        "language": "en",
        "doi": "10.1093/sf/soag096",
        "publication_year": 2026,
        "open_access": true,
        "peer_reviewed": true,
        "cited_by_count": 0,
        "references_count": 0,
        "publication": { "id": 1127546045, "year": 2026, "doi": "10.1093/sf/soag096", "volume": null, "issue": null, "pages": null, "open_access": true, "peer_reviewed": true },
        "venue": { "id": 1012146, "name": "Social Forces", "abbreviated_name": "Soc. Forces", "type": "JOURNAL" },
        "authors": { "total_count": 2, "author_string": "J Horowitz; Sagi Ramaj", "authors_preview": ["J Horowitz", "Sagi Ramaj"] },
        "grant_number": null,
        "_links": { "self": "/works/22456366" }
      }
      // ... (up to 10)
    ],
    "created_at": "2026-07-08T05:24:04.000Z",
    "updated_at": "2026-07-23T21:06:45.000Z",
    "_links": {
      "self": "/institutions/2801117",
      "works": "/institutions/2801117/works",
      "funded_works": "/institutions/2801117/funded-works"
    }
  },
  "meta": { "request": { "method": "GET", "path": "/institutions/2801117" } }
}
```

### Fields (detail)

Core identity/identifiers/metrics fields are the same as the list item, **except**: `acronyms` moves under `names`, there is no top-level `relevance`, and `metrics` gains two derived year fields. Additional blocks below.

**`names` block**

| field | type | notes |
|-------|------|-------|
| `names.acronyms` | string[] | |
| `names.alternative_names` | string[] | e.g. translated / historical names. |
| `names.aliases_count` | integer | `= acronyms.length + alternative_names.length`. |

**`metrics` additions (derived)**

| field | type | notes |
|-------|------|-------|
| `metrics.first_publication_year` | integer \| null | Derived from the affiliated-works corpus (bounded query, cached), not stored. |
| `metrics.latest_publication_year` | integer \| null | Derived. |

**`funding_role` block** (present regardless of include flags)

| field | type | notes |
|-------|------|-------|
| `funding_role.funded_works_count` | integer | `COUNT` over `funding` where `funder_id = this org`. `0` for pure institutes. |
| `funding_role.grants_count` | integer | `COUNT(DISTINCT grant_number)`. |

**`production_summary` block** (gated by `include_production`; empty when off)

| field | type | notes |
|-------|------|-------|
| `production_summary.by_work_type[]` | array | `{ type, works_count }`, ordered `works_count` DESC. `type` ∈ ARTICLE/BOOK/CHAPTER/THESIS/CONFERENCE/PREPRINT/REVIEW/EDITORIAL/DATASET/REPORT/OTHER. |
| `production_summary.by_work_type[].type` | string enum | Work type. |
| `production_summary.by_work_type[].works_count` | integer | Count within that type. |
| `production_summary.publication_trend[]` | array | `{ year, works_count }`, most-recent-first, up to 15 years. |
| `production_summary.publication_trend[].year` | integer | Publication year. |
| `production_summary.publication_trend[].works_count` | integer | Works in that year. |

**`relationships` block** (gated by `include_relationships`; empty arrays + `0` counts when off). Drawn from `organization_relationships`.

| field | type | notes |
|-------|------|-------|
| `relationships.parents[]` | array | Related-org objects (see shape below). |
| `relationships.children[]` | array | Same shape. |
| `relationships.related[]` | array | Same shape. |
| `relationships.*[].id` | integer | Related org id. |
| `relationships.*[].name` | string | Related org name. |
| `relationships.*[].type` | string enum | Related org type. |
| `relationships.*[].country_code` | string \| null | May be `null`. |
| `relationships.*[]._links.self` | string | `/institutions/{id}`. |
| `relationships.parents_count` | integer | |
| `relationships.children_count` | integer | |
| `relationships.related_count` | integer | Total relationship rows are read under a `LIMIT 200` cap. |

**`top_authors` block** (gated by `include_authors`; empty when off; up to 10)

| field | type | notes |
|-------|------|-------|
| `top_authors[].person_id` | integer | Author id. |
| `top_authors[].preferred_name` | string | |
| `top_authors[].works_count` | integer | Works at this org by this author. |
| `top_authors[].latest_publication_year` | integer \| null | |
| `top_authors[]._links.self` | string | `/persons/{id}`. |

**`recent_works` block** (gated by `include_works`; empty when off; up to 10). Each element is an **affiliated-work item** — the exact same shape as `/institutions/{id}/works` rows; see the field table in that section. `grant_number` is `null` here.

**Top-level**

| field | type | notes |
|-------|------|-------|
| `created_at` / `updated_at` | string(date-time) \| null | |
| `_links.self` / `_links.works` / `_links.funded_works` | string | Navigation. |

### Notes / caveats

- 404 with `code: "NOT_FOUND"` for a non-existent id (`meta.id` echoes the requested id). "Resolves any org" means it does not require `publication_count > 0` — it does **not** mean arbitrary ids resolve.
- Derived blocks each run under a statement budget and are cached (detail cache key `organization:v4:{id}:{flags}`). On timeout they degrade to empty rather than 503.

---

## `GET /institutions/{id}/works`

Works whose authorships carry this organization as `affiliation_id` (`meta.match_mode = "affiliation"`). Backed by MariaDB. 404 on a non-existent org id.

### Path parameters

| param | type | notes |
|-------|------|-------|
| `id` | integer ≥ 1 | Organization id. |

### Query parameters

| param | type | default | accepted values / bounds | effect |
|-------|------|---------|--------------------------|--------|
| `page` / `limit` / `offset` | integer | 1 / 20 / 0 | `limit` 1..100 | Standard pagination. |
| `type` | string | — | 2..50 chars (e.g. `ARTICLE`, `BOOK`, `CHAPTER`, `THESIS`, `CONFERENCE`, `PREPRINT`) | Matches works with **any** publication of that type (`EXISTS` on publications). |
| `year_from` | integer | — | ≥ 1500 | Inclusive lower bound on the latest-publication year. |
| `year_to` | integer | — | ≥ 1500 | Inclusive upper bound. |
| `language` | string | — | 2..10 chars | Exact `works.language`. |
| `open_access` | boolean | — | `true`/`false` | On the latest publication. |
| `peer_reviewed` | boolean | — | `true`/`false` | On the latest publication. |
| `cited_by_min` | integer | — | ≥ 0 | Inclusive lower bound on `works.citation_count`. Alias `citation_count_min`. |
| `cited_by_max` | integer | — | ≥ 0 | Inclusive upper bound. Alias `citation_count_max`. |
| `sort_by` | string enum | `publication_year` | `cited_by_count, references_count, publication_year, id` | Sort key. Aliases: `citations`/`citation_count` → `cited_by_count`, `reference_count` → `references_count`, `year` → `publication_year`. camelCase `sortBy` honored. |
| `sort_order` | string | key-dependent | `ASC`/`DESC` | Numeric keys default `DESC`. camelCase `sortOrder` honored. |

### Example requests

```
GET /institutions/2801117/works?limit=20
GET /institutions/2801117/works?sort_by=cited_by_count&sort_order=DESC&limit=20
GET /institutions/2801117/works?type=BOOK&year_from=2000&limit=20
GET /institutions/2801117/works?open_access=true&cited_by_min=100&limit=20
```

### Example response (`?limit=2&sort_by=cited_by_count`)

```json
{
  "status": "success",
  "data": [
    {
      "id": 4522279,
      "title": "When Work Interferes with Life",
      "subtitle": "Work-Nonwork Interference and the Influence of Work-Related Demands and Resources",
      "type": "ARTICLE",
      "language": "en",
      "doi": "10.1177/000312240907400606",
      "publication_year": 2009,
      "open_access": true,
      "peer_reviewed": true,
      "cited_by_count": 198,
      "references_count": 32,
      "publication": {
        "id": 3219028, "year": 2009, "doi": "10.1177/000312240907400606",
        "volume": "74", "issue": "6", "pages": "966-988",
        "open_access": true, "peer_reviewed": true
      },
      "venue": { "id": 1012569, "name": "American Sociological Review", "abbreviated_name": "Am. Sociol. Rev.", "type": "JOURNAL" },
      "authors": {
        "total_count": 6,
        "author_string": "Schieman; Scott Schieman; P Glavin; Paul Glavin; M A Milkie; Melissa A Milkie",
        "authors_preview": ["Schieman", "Scott Schieman", "P Glavin"]
      },
      "grant_number": null,
      "_links": { "self": "/works/4522279" }
    }
    // ... (2 total)
  ],
  "pagination": { "page": 1, "limit": 2, "total": 5412, "totalPages": 2706, "hasNext": true, "hasPrev": false },
  "meta": {
    "engine": "MariaDB",
    "query_type": "organization_works",
    "elapsed_ms": 0,
    "match_mode": "affiliation",
    "sort": { "by": "cited_by_count", "order": "DESC" },
    "pagination_total_exact": true,
    "request": { "method": "GET", "path": "/institutions/2801117/works?limit=2&sort_by=cited_by_count" },
    "pagination_extras": { "offset": 0 }
  }
}
```

### Fields (affiliated-work item)

This exact shape is reused by `recent_works[]` on the detail and by `/funded-works` rows.

| field (dot-path) | type | notes |
|------------------|------|-------|
| `id` | integer | Work id. |
| `title` | string | |
| `subtitle` | string \| null | |
| `type` | string enum \| null | Work type from the latest publication (ARTICLE/BOOK/CHAPTER/THESIS/CONFERENCE/PREPRINT/…). |
| `language` | string \| null | ISO 639-1. |
| `doi` | string \| null | Of the latest publication. |
| `publication_year` | integer \| null | Latest publication year. |
| `open_access` | boolean | Of the latest publication. |
| `peer_reviewed` | boolean | Of the latest publication. |
| `cited_by_count` | integer | `= works.citation_count`. |
| `references_count` | integer | `= works.reference_count`. |
| `publication.id` | integer \| null | Latest publication id (navigate to `/publications/{id}`). |
| `publication.year` | integer \| null | |
| `publication.doi` | string \| null | |
| `publication.volume` | string \| null | |
| `publication.issue` | string \| null | |
| `publication.pages` | string \| null | |
| `publication.open_access` | boolean | |
| `publication.peer_reviewed` | boolean | |
| `venue` | object \| null | `null` when no venue. |
| `venue.id` | integer \| null | |
| `venue.name` | string \| null | |
| `venue.abbreviated_name` | string \| null | Always paired with `name`. |
| `venue.type` | string enum \| null | JOURNAL/CONFERENCE/REPOSITORY/BOOK_SERIES/SOURCE_BOOK/OTHER. |
| `authors.total_count` | integer | Total authorships on the work. |
| `authors.author_string` | string \| null | `; `-joined preferred names (all hydrated names; may include multiple spellings of the same author). |
| `authors.authors_preview` | string[] | First 3 names. |
| `grant_number` | string \| null | **Always present as a key.** `null` on the affiliation surface; populated on `/funded-works`. |
| `_links.self` | string | `/works/{id}`. |

### Notes / caveats

- `meta.match_mode = "affiliation"`, `query_type = "organization_works"`, `pagination_total_exact = true`. `pagination.total` is the total affiliated works (e.g. U. Toronto = 5,412).
- 404 (existence guard) when the org id does not exist.
- Full work detail (abstract, all publications, files, subjects) is on [./works.md](./works.md) `GET /works/{id}`; individual publications on [./publications.md](./publications.md).

---

## `GET /institutions/{id}/funded-works`

Works financed by this org acting as a funder (`funding.funder_id`; `meta.match_mode = "funder"`), each row carrying its `grant_number`. Same item shape, filters, and sort contract as `/works`. 404 on a non-existent org id.

### Path & query parameters

Identical to `GET /institutions/{id}/works` (see that section). `meta.query_type = "organization_funded_works"`, `meta.match_mode = "funder"`.

### Example requests

```
GET /institutions/694519/funded-works?limit=20          # NNSF China — 34,602 funded works
GET /institutions/694484/funded-works?sort_by=cited_by_count&limit=20   # NSF
GET /institutions/2801117/funded-works?limit=20         # an INSTITUTE — empty (total 0)
```

Real FUNDER ids the UI can rely on (all have `publication_count = 0`, so they are absent from browse — reach them by id): `694519` National Natural Science Foundation of China (~50,683 grant rows), `694484` NSF (~19,174), `2741433` NIH (~12,816), `694715` SSHRC Canada (~11,238), `694426` ESRC (~9,589).

### Example response (real funder `694519`, `?limit=2`)

```json
{
  "status": "success",
  "data": [
    {
      "id": 22415579,
      "title": "Guizhi Wuling Decoction alleviates myocardial fibrosis by restoring mitochondrial homeostasis",
      "subtitle": "Evidence from network pharmacology, molecular docking, and multi-omics integration",
      "type": "ARTICLE",
      "language": "en",
      "doi": "10.1016/j.jep.2026.122197",
      "publication_year": 2027,
      "open_access": true,
      "peer_reviewed": true,
      "cited_by_count": 0,
      "references_count": 0,
      "publication": { "id": 1127505258, "year": 2027, "doi": "10.1016/j.jep.2026.122197", "volume": "372", "issue": null, "pages": "122197", "open_access": true, "peer_reviewed": true },
      "venue": { "id": 1014003, "name": "Journal of Ethnopharmacology", "abbreviated_name": "J. Ethnopharmacol.", "type": "JOURNAL" },
      "authors": { "total_count": 8, "author_string": "Lipeng Shi; Jie Wang; Yi-Xiang Wang; ...", "authors_preview": ["Lipeng Shi", "Jie Wang", "Yi-Xiang Wang"] },
      "grant_number": null,
      "_links": { "self": "/works/22415579" }
    },
    {
      "id": 22415571,
      "title": "Integrated prioritization of candidate quality markers for Smilacis Chinae Rhizoma ...",
      "grant_number": "82304707",
      "_links": { "self": "/works/22415571" }
      // ... same shape as above; grant_number populated here
    }
    // ... (2 shown of 34602 total)
  ],
  "pagination": { "page": 1, "limit": 2, "total": 34602, "totalPages": 17301, "hasNext": true, "hasPrev": false },
  "meta": {
    "engine": "MariaDB",
    "query_type": "organization_funded_works",
    "match_mode": "funder",
    "sort": { "by": "publication_year", "order": "DESC" },
    "pagination_total_exact": true,
    "request": { "method": "GET", "path": "/institutions/694519/funded-works?limit=2" },
    "pagination_extras": { "offset": 0 }
  }
}
```

### Fields

Identical to the affiliated-work item table under `GET /institutions/{id}/works`. The meaningful difference is `grant_number` (string), which is populated here where recorded (e.g. `"82304707"`) and `null` where the funding row has no grant number.

### Notes / caveats

- For an INSTITUTE id, `funded_works_count = 0` → `data: []`, `total: 0`, `pagination_total_exact: true`. This is **expected empty** (`ok_empty`), not a bug — institutes rarely act as funders. Use a FUNDER id to see populated data.
- This is the only useful surface for pure FUNDER orgs, which never appear in `/institutions` browse.
- Note publication years can be ahead of the current year (e.g. `2027`) — advance/online-first records exist in the corpus.
- 404 (existence guard) when the org id does not exist.

---

## 404 shape (all `{id}` endpoints)

```json
{
  "status": "error",
  "message": "Institution with ID 99999999999 not found",
  "timestamp": "2026-07-23T18:54:38.612Z",
  "code": "NOT_FOUND",
  "meta": { "id": "99999999999", "request": { "method": "GET", "path": "/institutions/99999999999" } }
}
```

## Related endpoints

- `/metrics/institutions` — leaderboard of orgs by stored `publication_count`, and the one place the raw `open_access_works_count` is surfaced. See the metrics chapter.
- [./works.md](./works.md), [./publications.md](./publications.md), [./persons.md](./persons.md), [./venues.md](./venues.md) for the entities linked from these payloads.
- Known operator follow-ups (annual/OA aggregates) are tracked in [../API_ISSUES.md](../API_ISSUES.md).
