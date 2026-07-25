# Venues — journals, conferences, repositories, book series & source books

The venues domain exposes the venue-level entity: journals, conferences, repositories, book series, "source books", and other publishing outlets. All five endpoints are backed by the MariaDB base table `venues v LEFT JOIN organizations pub ON pub.id = v.publisher_id` (the publisher hydrates from `organizations`). Free-text search here is **MariaDB** — a `LIKE`/`ft_venues_search` scan, **not Manticore** (unlike [works](./works.md) and [persons](./persons.md)). Top subjects come from `venue_subjects + subjects`. Venues relate to [publications](./publications.md) (each publication carries a `venue_id`), to [works](./works.md) via `/venues/{id}/works`, and to [institutions](./institutions.md) via the publisher org.

Corpus scale (live, 2026-07-23): **189,076 venues** — `source_books` ≈ 165,444 (~87%), `journals` = 22,680, the rest a long tail. Any type-filter UI must offer all six types, `SOURCE_BOOK` included.

Global response envelope, pagination (`page`/`limit` + `offset`/`limit`), rate-limiting, error codes, and boolean/date normalization are described once in [../00-conventions.md](../00-conventions.md) and are **not** repeated here. This chapter covers only what is venue-specific. All venue endpoints are public (no key required).

---

## `GET /venues`

Paginated list of venues. Default sort is `score DESC` (global ranking, most important venues first). Free-text term uses `search=` (a MariaDB `LIKE`). Backing table `venues LEFT JOIN organizations`.

### Query parameters

| param | type | default | accepted values / bounds | effect |
|---|---|---|---|---|
| `limit` | integer | 20 | 1..100 | page size |
| `page` | integer | 1 | ≥1 | 1-based page |
| `offset` | integer | 0 | ≥0 | alternative to `page`; snapped to a page boundary and echoed at `meta.pagination_extras.offset` (e.g. `offset=5&limit=2` → page 3, echoed offset 4) |
| `type` | string | — | `JOURNAL`,`CONFERENCE`,`REPOSITORY`,`BOOK_SERIES`,`SOURCE_BOOK`,`OTHER` | filter by venue type; invalid value → 400. `SOURCE_BOOK` dominates the corpus |
| `search` | string | — | 1..200 chars | free-text; MariaDB `LIKE` over `name`, `abbreviated_name`, `issn`, `eissn`, publisher name. (The dedicated `/venues/search` uses `q` instead — the two are **not** interchangeable) |
| `sortBy` / `sort_by` | string | `score` | `name`,`type`,`impact_factor`,`works_count`,`id`,`score`,`ranking`,`h_index`,`cited_by_count`,`coverage_start_year`,`coverage_end_year`,`oldest`,`newest` | sort key; invalid → 400. `oldest`=alias of `coverage_start_year`, `newest`=alias of `coverage_end_year`, `ranking`=`score` |
| `sortOrder` / `sort_order` | string | see effect | `ASC`,`DESC` (snake alias is upper-cased) | direction. Default when omitted: numeric/ranking fields → `DESC`; `id`,`name`,`type`,`coverage_start_year`,`oldest` → `ASC`; `coverage_end_year`,`newest` → `DESC` |
| `coverage_from` | integer | — | ≥0 | keep venues whose `coverage_start_year` ≥ value |
| `coverage_to` | integer | — | ≥0 | keep venues whose `coverage_end_year` ≤ value |
| `coverage_start_from` / `coverage_start_to` | integer | — | ≥0 | inclusive bounds on `coverage_start_year` |
| `coverage_end_from` / `coverage_end_to` | integer | — | ≥0 | inclusive bounds on `coverage_end_year` |
| `active_in_year` | integer | — | ≥0 | keep venues whose range encloses the year (`start ≤ year ≤ end`) |
| `min_id` | integer | — | ≥1 | keyset helper — only venues with `id ≥ value` |

Rows with NULL coverage years are always pushed to the tail regardless of sort direction. When the primary sort is not `score`/`ranking`, `COALESCE(v.total_score,0) DESC` then `v.name ASC` are appended as tiebreakers. `meta.sort` reports the effective `{by,order}`; `meta.filters` appears only when a filter is applied.

### Example requests

```
GET /venues?limit=20
GET /venues?type=JOURNAL&sortBy=impact_factor&sort_order=DESC&limit=20
GET /venues?search=Nature&limit=10
GET /venues?active_in_year=2010&coverage_from=1990&sortBy=works_count
GET /venues?type=SOURCE_BOOK&min_id=1000000&limit=50
```

### Example response

```json
{
  "status": "success",
  "data": [
    {
      "id": 1012121,
      "_links": { "self": "/venues/1012121" },
      "name": "Annual Review of Anthropology",
      "abbreviated_name": "Annu. Rev. Anthropol.",
      "type": "BOOK_SERIES",
      "aggregation_type": "bookseries",
      "country_code": "US",
      "language": "en",
      "homepage_url": "http://www.annualreviews.org/journal/anthro",
      "open_access": false,
      "coverage_start_year": 1972,
      "coverage_end_year": 2026,
      "works_count": 1230,
      "cited_by_count": 62126,
      "publisher": { "id": 2428364, "name": "Annual Reviews Inc.", "type": "PUBLISHER", "country_code": "US" },
      "identifiers": {
        "issn": "0084-6570", "eissn": "1545-4290", "scopus_id": "68623",
        "wikidata_id": "Q4769665", "openalex_id": "S195167216", "scielo_id": null
      },
      "indexing": {
        "is_in_doaj": false, "is_in_scielo": false, "is_indexed_in_scopus": true,
        "validation_status": "VALIDATED"
      },
      "metrics": {
        "impact_factor": 4.004, "citescore": 6.4, "sjr": 1.341, "snip": 4.007,
        "h_index": 114, "i10_index": 768, "two_yr_mean_citedness": 0.2903
      },
      "ranking": {
        "score": 25.006,
        "components": { "subject": 10, "oa": 0, "impact": 5.006, "llm": 10 },
        "llm": { "relevance": 5, "justification": "The Annual Review of Anthropology is a premier publication ..." }
      },
      "subjects": [
        { "subject_id": 2537289, "term": "Anthropology", "score": 1, "vocabulary": "SCImago", "lang": "en" }
      ]
    }
  ],
  "pagination": { "page": 1, "limit": 2, "total": 189076, "totalPages": 94538, "hasNext": true, "hasPrev": false },
  "meta": {
    "source": "venues",
    "sort": { "by": "score", "order": "DESC" },
    "filters": { "type": "JOURNAL" },
    "includes": { "identifiers": true, "indexing": true, "metrics": true, "ranking": true, "subjects": true },
    "request": { "method": "GET", "path": "/venues?limit=2" },
    "pagination_extras": { "offset": 0 }
  }
}
```

The `subjects[]` array is trimmed above; **list rows carry up to 5 subjects**. `meta.filters` is present only when a filter (e.g. `type`) was supplied.

### Fields (list item — this is the base venue shape reused by `/venues/search` and, extended, by `/venues/{id}`)

| field (dot-path) | type | notes |
|---|---|---|
| `id` | integer | venue id |
| `_links.self` | string | `/venues/{id}` |
| `name` | string\|null | official venue name |
| `abbreviated_name` | string\|null | short name; always paired with `name` |
| `type` | string\|null | `JOURNAL`\|`CONFERENCE`\|`REPOSITORY`\|`BOOK_SERIES`\|`SOURCE_BOOK`\|`OTHER` |
| `aggregation_type` | string\|null | free label, e.g. `journal`, `bookseries` |
| `country_code` | string\|null | ISO-2 |
| `language` | string\|null | ISO 639-1 (from `venues.lang`) |
| `homepage_url` | string\|null | |
| `open_access` | boolean\|null | fully-OA policy flag |
| `coverage_start_year` | integer\|null | first covered year |
| `coverage_end_year` | integer\|null | last covered year; **can hold a future/garbage year** (e.g. 2028/2029) — validate on display |
| `works_count` | integer | stored count; defaults 0 |
| `cited_by_count` | integer | stored count; defaults 0 |
| `publisher` | object\|null | `{id, name, type, country_code}`; null when no publisher linked |
| `identifiers.issn` | string\|null | |
| `identifiers.eissn` | string\|null | electronic ISSN |
| `identifiers.scopus_id` | string\|null | |
| `identifiers.wikidata_id` | string\|null | |
| `identifiers.openalex_id` | string\|null | |
| `identifiers.scielo_id` | string\|null | |
| `indexing.is_in_doaj` | boolean\|null | |
| `indexing.is_in_scielo` | boolean\|null | |
| `indexing.is_indexed_in_scopus` | boolean\|null | |
| `indexing.validation_status` | string\|null | audit status, e.g. `VALIDATED`, `PENDING`, `NOT_FOUND`, `FAILED` |
| `metrics.impact_factor` | number\|null | |
| `metrics.citescore` | number\|null | |
| `metrics.sjr` | number\|null | SCImago Journal Rank |
| `metrics.snip` | number\|null | Source Normalized Impact per Paper |
| `metrics.h_index` | integer\|null | |
| `metrics.i10_index` | integer\|null | |
| `metrics.two_yr_mean_citedness` | number\|null | 2-year mean citedness |
| `ranking.score` | number\|null | = `venues.total_score` = subject+oa+impact+llm (the four components sum exactly to this) |
| `ranking.components.subject` | number\|null | subject-relevance component |
| `ranking.components.oa` | number\|null | open-access component |
| `ranking.components.impact` | number\|null | blended bibliometric impact component (= `venues.impact_score`) |
| `ranking.components.llm` | number\|null | LLM-relevance component |
| `ranking.llm.relevance` | integer\|null | LLM relevance 0–5 |
| `ranking.llm.justification` | string\|null | LLM free-text rationale |
| `subjects[]` | array | top subjects; **≤5 on list rows** |
| `subjects[].subject_id` | integer\|null | |
| `subjects[].term` | string\|null | subject term |
| `subjects[].score` | number\|null | subject weight; null for vocabularies without scores (e.g. OpenAlex/Scopus rows) |
| `subjects[].vocabulary` | string\|null | e.g. `SCImago`, `OpenAlex`, `Scopus` |
| `subjects[].lang` | string\|null | ISO 639-1 |

`mag_id` is stored on the base table but **never exposed**. Identifiers live only under `identifiers{}` — they are not duplicated at the top level.

### Notes / caveats

- `pagination.total` on the unfiltered list is the full corpus count (189,076); it is computed under a bounded budget — treat as authoritative for venues but see [../00-conventions.md](../00-conventions.md) for the shared `pagination_total_exact` semantics on heavier listings.
- Root-list free-text is `search=`; the dedicated endpoint below is `q=`. Mixing them 400s.
- `coverage_end_year` can be a garbage future year — do not trust it as a hard "still active" signal.

---

## `GET /venues/search`

Dedicated venue search. Same MariaDB `LIKE` surface as `/venues?search=` but **requires `q`** and returns a search-flavoured `meta` (`source` + echoed `query`, no `sort`). Rows are fixed-ordered by `COALESCE(total_score,0) DESC, name ASC` — there is no sort parameter.

### Query parameters

| param | type | default | accepted values / bounds | effect |
|---|---|---|---|---|
| `q` | string | — (**required**) | 1..200 chars | search term; matched via `LIKE` over `name`, `abbreviated_name`, `issn`, `eissn`, publisher name. Missing/empty → 400 |
| `type` | string | — | six venue types (as above) | optional type filter |
| `limit` | integer | 20 | 1..100 | page size |
| `offset` | integer | 0 | ≥0 | items to skip |

### Example requests

```
GET /venues/search?q=mana&limit=20
GET /venues/search?q=Nature&type=JOURNAL&limit=10
GET /venues/search?q=anthropology&offset=20&limit=20
```

### Example response

```json
{
  "status": "success",
  "data": [
    {
      "id": 1012128,
      "_links": { "self": "/venues/1012128" },
      "name": "Mana",
      "abbreviated_name": "Mana",
      "type": "JOURNAL",
      "aggregation_type": "journal",
      "country_code": "BR",
      "language": "en",
      "homepage_url": "https://api.elsevier.com/content/serial/title/issn/0104-9313",
      "open_access": true,
      "coverage_start_year": 1996,
      "coverage_end_year": 2026,
      "works_count": 893,
      "cited_by_count": 6302,
      "publisher": { "id": 2903095, "name": "Universidade Federal do Rio de Janeiro", "type": "PUBLISHER", "country_code": "BR" },
      "identifiers": { "issn": "0104-9313", "eissn": "1678-4944", "scopus_id": "5100154602", "wikidata_id": "Q15759471", "openalex_id": "S4210222159", "scielo_id": null },
      "indexing": { "is_in_doaj": true, "is_in_scielo": true, "is_indexed_in_scopus": true, "validation_status": "VALIDATED" },
      "metrics": { "impact_factor": 0.339, "citescore": 0.8, "sjr": 0.142, "snip": 0.844, "h_index": 36, "i10_index": 139, "two_yr_mean_citedness": 0 },
      "ranking": { "score": 21.332, "components": { "subject": 10, "oa": 0.05, "impact": 1.282, "llm": 10 }, "llm": { "relevance": 5, "justification": "Mana is a prominent Brazilian journal ..." } },
      "subjects": [
        { "subject_id": 2537289, "term": "Anthropology", "score": 0.5, "vocabulary": "SCImago", "lang": "en" }
      ]
    }
  ],
  "pagination": { "page": 1, "limit": 1, "total": 1730, "totalPages": 1730, "hasNext": true, "hasPrev": false },
  "meta": {
    "source": "venues",
    "query": "mana",
    "includes": { "identifiers": true, "indexing": true, "metrics": true, "ranking": true, "subjects": true },
    "request": { "method": "GET", "path": "/venues/search?q=mana&limit=1" },
    "pagination_extras": { "offset": 0 }
  }
}
```

### Fields

Data rows are **identical** to the `/venues` list item shape (see the field table above), including the ≤5-subject cap. The only difference is in `meta`:

| field (dot-path) | type | notes |
|---|---|---|
| `meta.source` | string | `"venues"` |
| `meta.query` | string | echo of `q` |
| `meta.includes` | object | which blocks were embedded |
| `meta.pagination_extras.offset` | integer | echoed offset |

There is **no** `meta.sort` here (fixed ordering).

### Notes / caveats

- This is an implementation alias of `/venues?search=` with the same LIKE surface and `COALESCE(total_score,0) DESC, name ASC` ordering, differing only in that `q` is required and the search `meta` is restored.
- 400 example (missing `q`): `{"status":"error","message":"Validation failed","code":"VALIDATION_ERROR","errors":[{"path":"q",...}]}`.

---

## `GET /venues/statistics`

Aggregate venue counts and metric summaries. Returns a **single flat object** (no `by_type` nesting, no pagination). Cache key `venues:statistics:v4`.

### Query parameters

None.

### Example request

```
GET /venues/statistics
```

### Example response

```json
{
  "status": "success",
  "data": {
    "total_venues": 189076,
    "journals": 22680,
    "conferences": 144,
    "repositories": 207,
    "book_series": 287,
    "source_books": 165444,
    "other": 314,
    "with_impact_factor": 79842,
    "avg_impact_factor": 0.8502489,
    "max_impact_factor": 295,
    "min_impact_factor": 0,
    "indexed_in_doaj": 5529,
    "indexed_in_scielo": 1,
    "indexed_in_scopus": 11648,
    "avg_global_ranking_score": 12.518824
  },
  "meta": { "request": { "method": "GET", "path": "/venues/statistics" } }
}
```

### Fields

| field (dot-path) | type | notes |
|---|---|---|
| `total_venues` | integer | full corpus count |
| `journals` | integer | count of `type = JOURNAL` |
| `conferences` | integer | `CONFERENCE` |
| `repositories` | integer | `REPOSITORY` |
| `book_series` | integer | `BOOK_SERIES` |
| `source_books` | integer | `SOURCE_BOOK` (dominant, ~87%) |
| `other` | integer | `OTHER` |
| `with_impact_factor` | integer | venues carrying a non-null impact factor |
| `avg_impact_factor` | number | mean impact factor across venues that have one |
| `max_impact_factor` | number | maximum IF observed |
| `min_impact_factor` | number | minimum IF observed |
| `indexed_in_doaj` | integer | count with `is_in_doaj = true` |
| `indexed_in_scielo` | integer | count with `is_in_scielo = true` (currently 1) |
| `indexed_in_scopus` | integer | count with `is_indexed_in_scopus = true` |
| `avg_global_ranking_score` | number | mean of `venues.total_score` |

### Notes / caveats

- The six type counts sum to `total_venues`. Good for a corpus-overview dashboard tile.
- `indexed_in_scielo = 1` reflects the current base-table state, not a bug.

---

## `GET /venues/{id}`

Full venue detail. Returns the base venue shape **plus** timestamps and up to five heavier embedded blocks, each individually toggleable. Existence-guarded (404 for unknown ids).

### Path parameters

| param | type | notes |
|---|---|---|
| `id` | integer (≥1) | venue id; non-numeric or unknown → 404 `NOT_FOUND` |

### Query parameters

| param | type | default | accepted values | effect |
|---|---|---|---|---|
| `include_subjects` | boolean | true | true/false | embed the top subjects (≤10 on detail) |
| `include_yearly` | boolean | true | true/false | embed `yearly_stats[]` |
| `include_top_authors` | boolean | true | true/false | embed `top_authors[]` |
| `include_recent_works` | boolean | true | true/false | embed `recent_works[]` |

Booleans follow the shared normalization in [../00-conventions.md](../00-conventions.md). `top_publications[]` has **no** include flag — it is always present when non-empty. `publication_summary` is always present.

### Example requests

```
GET /venues/1012121
GET /venues/1012121?include_recent_works=false&include_yearly=false
GET /venues/1012128?include_top_authors=false
```

### Example response (trimmed — arrays cut to one element)

```json
{
  "status": "success",
  "data": {
    "id": 1012121,
    "_links": { "self": "/venues/1012121" },
    "name": "Annual Review of Anthropology",
    "abbreviated_name": "Annu. Rev. Anthropol.",
    "type": "BOOK_SERIES",
    "aggregation_type": "bookseries",
    "country_code": "US",
    "language": "en",
    "homepage_url": "http://www.annualreviews.org/journal/anthro",
    "open_access": false,
    "coverage_start_year": 1972,
    "coverage_end_year": 2026,
    "works_count": 1230,
    "cited_by_count": 62126,
    "publisher": { "id": 2428364, "name": "Annual Reviews Inc.", "type": "PUBLISHER", "country_code": "US" },
    "identifiers": { "issn": "0084-6570", "eissn": "1545-4290", "scopus_id": "68623", "wikidata_id": "Q4769665", "openalex_id": "S195167216", "scielo_id": null },
    "indexing": { "is_in_doaj": false, "is_in_scielo": false, "is_indexed_in_scopus": true, "validation_status": "VALIDATED" },
    "metrics": { "impact_factor": 4.004, "citescore": 6.4, "sjr": 1.341, "snip": 4.007, "h_index": 114, "i10_index": 768, "two_yr_mean_citedness": 0.2903 },
    "ranking": { "score": 25.006, "components": { "subject": 10, "oa": 0, "impact": 5.006, "llm": 10 }, "llm": { "relevance": 5, "justification": "The Annual Review of Anthropology is a premier publication ..." } },

    "created_at": "2025-08-15T01:08:49.000Z",
    "updated_at": "2026-07-23T06:18:34.000Z",
    "last_validated_at": "2026-07-23T05:19:35.000Z",
    "summary_updated_at": "2026-07-23T06:18:34.000Z",

    "publication_summary": {
      "first_publication_year": 1972,
      "latest_publication_year": 2026,
      "total_works_count": 1388,
      "open_access_works_count": 78,
      "open_access_percentage": 5.6,
      "publication_trend": [ { "year": 2026, "works_count": 5, "oa_works_count": 0 } ]
    },

    "subjects": [
      { "subject_id": 2537289, "term": "Anthropology", "score": 1, "vocabulary": "SCImago", "lang": "en" }
    ],

    "yearly_stats": [
      { "year": 2026, "works_count": 5, "oa_works_count": 0, "cited_by_count": 0 }
    ],

    "top_authors": [
      { "person_id": 3617945, "name": "Don Brenneis", "works_count": 15, "best_position": 1, "is_corresponding": false }
    ],

    "top_publications": [
      { "publication_id": 821908, "work_id": 2296484, "title": "Migrant \"Illegality\" and Deportability in Everyday Life", "publication_year": 2002, "doi": "10.1146/annurev.anthro.31.040402.085432", "open_access": false, "citation_count": 1505 }
    ],

    "recent_works": [
      {
        "id": 20149810,
        "title": "Channels",
        "subtitle": null,
        "abstract": "Channels are often treated as basic conditions ...",
        "type": "ARTICLE",
        "language": "en",
        "publication_year": 2026,
        "volume": null,
        "issue": null,
        "pages": null,
        "doi": "10.1146/annurev-anthro-041524-022740",
        "open_access": false,
        "peer_reviewed": true,
        "publication_date": "2026-06-18T00:00:00.000Z",
        "author_count": 1,
        "authors": [ { "person_id": 3621918, "name": "Alaina Lemon", "position": 1, "is_corresponding": true } ]
      }
    ]
  },
  "meta": {
    "includes": { "identifiers": true, "indexing": true, "metrics": true, "ranking": true, "subjects": true, "yearly_stats": true, "top_authors": true, "recent_works": true },
    "request": { "method": "GET", "path": "/venues/1012121" }
  }
}
```

In the live payload `subjects[]` holds up to 10 rows, `yearly_stats[]` and `publication_summary.publication_trend[]` hold one row per covered year (55 in this example), `top_authors[]` and `top_publications[]` hold up to 10 rows, and `recent_works[]` holds the most recent ~10 works.

### Fields — base block

Everything in the `/venues` list-item table above applies unchanged (same `identifiers`/`indexing`/`metrics`/`ranking`/`publisher`), except `subjects[]` is capped at **10** (vs 5 on list).

### Fields — detail-only blocks

| field (dot-path) | type | notes |
|---|---|---|
| `created_at` | string(ISO)\|null | row creation |
| `updated_at` | string(ISO)\|null | last row update |
| `last_validated_at` | string(ISO)\|null | last validation audit |
| `summary_updated_at` | string(ISO)\|null | when the denormalized summary was refreshed |
| **`publication_summary`** | object | derived corpus summary (always present) |
| `publication_summary.first_publication_year` | integer\|null | earliest work year; falls back to coverage range |
| `publication_summary.latest_publication_year` | integer\|null | latest work year |
| `publication_summary.total_works_count` | integer | works in the venue's corpus (from per-year aggregation; may differ from top-level `works_count`) |
| `publication_summary.open_access_works_count` | integer | OA works in corpus |
| `publication_summary.open_access_percentage` | number\|null | 0–100, one decimal; **null when no yearly data** |
| `publication_summary.publication_trend[]` | array | `{year, works_count, oa_works_count}`, newest-first |
| `publication_summary.publication_trend[].year` | integer\|null | |
| `publication_summary.publication_trend[].works_count` | integer | |
| `publication_summary.publication_trend[].oa_works_count` | integer | |
| **`yearly_stats[]`** | array | gated by `include_yearly`; one row per covered year, newest-first |
| `yearly_stats[].year` | integer\|null | |
| `yearly_stats[].works_count` | integer | |
| `yearly_stats[].oa_works_count` | integer | |
| `yearly_stats[].cited_by_count` | integer | citations accrued to that year's works |
| **`top_authors[]`** | array | gated by `include_top_authors`; up to 10 |
| `top_authors[].person_id` | integer | → [persons](./persons.md) |
| `top_authors[].name` | string | |
| `top_authors[].works_count` | integer | works in this venue |
| `top_authors[].best_position` | integer\|null | best (lowest) author position achieved |
| `top_authors[].is_corresponding` | boolean\|null | ever corresponding author here |
| **`top_publications[]`** | array | **no include flag**; present when non-empty; up to 10 |
| `top_publications[].publication_id` | integer | → [publications](./publications.md) |
| `top_publications[].work_id` | integer | → [works](./works.md) |
| `top_publications[].title` | string | |
| `top_publications[].publication_year` | integer\|null | keyed `publication_year` |
| `top_publications[].doi` | string\|null | |
| `top_publications[].open_access` | boolean\|null | |
| `top_publications[].citation_count` | integer | |
| **`recent_works[]`** | array | gated by `include_recent_works`; rich work rows, newest-first |
| `recent_works[].id` | integer | work id |
| `recent_works[].title` | string\|null | |
| `recent_works[].subtitle` | string\|null | |
| `recent_works[].abstract` | string\|null | |
| `recent_works[].type` | string | publication type (`ARTICLE`, `BOOK`, …) |
| `recent_works[].language` | string\|null | |
| `recent_works[].publication_year` | integer\|null | keyed `publication_year` here (contrast `/venues/{id}/works` which keys `year`) |
| `recent_works[].volume` / `.issue` / `.pages` | string\|null | |
| `recent_works[].doi` | string\|null | |
| `recent_works[].open_access` | boolean\|null | |
| `recent_works[].peer_reviewed` | boolean\|null | |
| `recent_works[].publication_date` | string(ISO)\|null | |
| `recent_works[].author_count` | integer | |
| `recent_works[].authors[]` | array | `{person_id, name, position:int, is_corresponding:bool\|null}` |
| `meta.includes` | object | reflects the effective include flags (`identifiers`/`indexing`/`metrics`/`ranking`/`subjects`/`yearly_stats`/`top_authors`/`recent_works`) |

### Notes / caveats

- Unknown/oversized id → **404** `{"code":"NOT_FOUND","message":"Venue with ID {id} not found","meta":{"id":...}}`.
- `publication_summary.total_works_count` (corpus-derived) can exceed the top-level stored `works_count` (e.g. 1388 vs 1230) — they are computed differently; show the stored `works_count` for the headline metric and the summary for the year-by-year view.
- `open_access_percentage` is null when the venue has no yearly data — guard the division in the UI.
- Turn off unused heavy blocks (`include_yearly=false`, `include_recent_works=false`) to shrink payloads.

---

## `GET /venues/{id}/works`

Works published in the venue. Honours the standard work sort/citation-filter contract. Rows use a **distinct venue-work shape** (not the generic Work schema) and — note — key the year as `year`, not `publication_year`. Existence-guarded.

### Path parameters

| param | type | notes |
|---|---|---|
| `id` | integer (≥1) | venue id; unknown → 404 `NOT_FOUND` |

### Query parameters

| param | type | default | accepted values / bounds | effect |
|---|---|---|---|---|
| `limit` | integer | 20 | 1..100 | page size |
| `offset` | integer | 0 | ≥0 | items to skip; echoed at `meta.pagination_extras.offset` |
| `year` | integer | — | ≥1900 | exact publication-year filter; echoed at `meta.filters.year` |
| `year_from` | integer | — | ≥1000 | inclusive lower year bound |
| `year_to` | integer | — | ≥1000 | inclusive upper year bound |
| `cited_by_min` / `citation_count_min` | integer | — | ≥0 | keep works with `cited_by_count ≥ value` |
| `cited_by_max` / `citation_count_max` | integer | — | ≥0 | keep works with `cited_by_count ≤ value` |
| `sort_by` / `sortBy` | string | — | `cited_by_count`,`references_count`,`publication_year` (+ aliases `citation_count`=`cited_by_count`, `reference_count`=`references_count`, `year`=`publication_year`) | primary sort key |
| `sort_order` / `sortOrder` | string | `DESC` | `ASC`,`DESC` | direction |

These are the shared citation/sort params documented in [../00-conventions.md](../00-conventions.md); this endpoint's specific enum is above. Default order when `sort_by` is omitted is most-cited/most-recent first.

### Example requests

```
GET /venues/1012121/works?limit=20
GET /venues/1012121/works?sort_by=cited_by_count&sort_order=DESC&limit=20
GET /venues/1012121/works?year_from=2000&year_to=2010&cited_by_min=100
GET /venues/1012121/works?year=2024
```

### Example response

```json
{
  "status": "success",
  "data": [
    {
      "id": 2296484,
      "title": "Migrant \"Illegality\" and Deportability in Everyday Life",
      "subtitle": null,
      "abstract": "This article strives to meet two challenges ...",
      "type": "ARTICLE",
      "language": "en",
      "year": 2002,
      "volume": "31",
      "issue": "1",
      "pages": "419-447",
      "doi": "10.1146/annurev.anthro.31.040402.085432",
      "open_access": false,
      "peer_reviewed": true,
      "publication_date": "2002-10-01T00:00:00.000Z",
      "cited_by_count": 1505,
      "references_count": 81,
      "author_count": 2,
      "authors": [
        { "person_id": 13960, "name": "N De Genova", "position": 1, "is_corresponding": true },
        { "person_id": 169444, "name": "Nicholas P De Genova", "position": 1, "is_corresponding": false }
      ]
    }
  ],
  "pagination": { "page": 1, "limit": 2, "total": 1388, "totalPages": 694, "hasNext": true, "hasPrev": false },
  "meta": {
    "request": { "method": "GET", "path": "/venues/1012121/works?limit=2&sort_by=cited_by_count" },
    "pagination_extras": { "offset": 0 }
  }
}
```

### Fields

| field (dot-path) | type | notes |
|---|---|---|
| `id` | integer | work id → [works](./works.md) |
| `title` | string\|null | |
| `subtitle` | string\|null | |
| `abstract` | string\|null | |
| `type` | string | publication type (`ARTICLE`, `BOOK`, `CHAPTER`, …) |
| `language` | string\|null | ISO 639-1 |
| `year` | integer\|null | **publication year, keyed `year`** here (contrast `recent_works[].publication_year` on detail) |
| `volume` | string\|null | |
| `issue` | string\|null | |
| `pages` | string\|null | |
| `doi` | string\|null | |
| `open_access` | boolean\|null | |
| `peer_reviewed` | boolean\|null | |
| `publication_date` | string(ISO)\|null | |
| `cited_by_count` | integer | from `works.citation_count` |
| `references_count` | integer | outgoing references |
| `author_count` | integer | |
| `authors[]` | array | `{person_id:int, name:string, position:int, is_corresponding:bool\|null}` — note duplicate rows can share `position` (name variants of the same author) |

### Notes / caveats

- `meta` carries **only** `request` and `pagination_extras` (plus `filters.year` when `year` is set). There is **no** `meta.match_mode` and **no** `meta.sort` here, unlike other work listings ([works](./works.md), [institutions](./institutions.md)/works).
- Unknown venue id → 404 `NOT_FOUND` (existence guard runs before listing).
- Row shape differs from the generic Work schema — do not reuse a shared Work component blindly; in particular the year field name (`year`) differs from most other work surfaces.
- `pagination.total` here is the venue's total work count; standard shared `pagination_total_exact` degradation may apply on very large venues — see [../00-conventions.md](../00-conventions.md) and ../API_ISSUES.md.
