# Metrics — aggregate ranking and yearly roll-up analytics

The metrics domain exposes five **read-only, ranking-shaped** aggregate views over the corpus: a yearly publication roll-up (`/metrics/annual`) and four "top N" leaderboards over venues, institutions, persons, and co-authorship pairs. Every endpoint reads directly from a single base table's operator-maintained metric columns (`venues.works_count`, `organizations.publication_count`, `persons.total_works`, `publications.year`, an `authorships` self-join), so there is **no Manticore full-text involvement** anywhere in this domain — these are pure MariaDB aggregate queries. All five are **public** (no `X-Access-Key`), governed only by the shared rate limiter.

The per-entity detail pages live in other domains — this domain is the leaderboard/dashboard surface. Cross-links: venue rows point at [./venues.md](./venues.md), institution rows at [./institutions.md](./institutions.md), person rows at [./persons.md](./persons.md), and the collaboration pair shape is byte-identical to the one served by `/collaborations/top` in [./collaborations.md](./collaborations.md).

All responses follow the shared envelope, pagination model, and error codes documented in [../00-conventions.md](../00-conventions.md). This chapter documents only what is metrics-specific.

> **Swagger warning.** The generated OpenAPI `data[]` item `$ref`s (`Venue`, `Organization`, `Person`, `Collaboration`, and a flat annual schema) do **not** match the real payloads — the live responses are the compact, nested ranking objects documented below. Trust this chapter and the live API, not the referenced component schemas.

## Shared traits of the four "top N" endpoints

- **No `pagination_total_exact` flag.** Unlike `/works` and `/publications`, the metrics leaderboards count against a single indexed column, so `pagination.total` is always exact and the `meta.pagination_total_exact` flag is absent.
- **`ranking` is page-relative.** Every data item carries a 1-based `ranking` = `offset + index + 1`. On page 2 with `limit=5`, the first row's `ranking` is `6`. It is a display ordinal, not a stable global rank id.
- **`meta.summary`** is a per-endpoint rollup block computed over the **current page only** (except the `total_*_ranked` count, which is the full-corpus total). Treat page-scoped sums (`total_citations`, `avg_citations_per_work`) as page aggregates, not corpus aggregates.
- **`meta.filters`** echoes the effective filters (including the injected `page`/`limit`/`offset`). Some values echo as strings (see per-endpoint notes).
- **`productivity_score` is always `null`** on institutions and persons rows — reserved, never computed. Do not render it.
- Pagination validation (all endpoints): `page` ≥ 1, `limit` 1..100 (default 20), `offset` ≥ 0. Both `page/limit` and `offset/limit` are accepted (see conventions).

---

## `GET /metrics/annual`

Yearly roll-up of publications and works, grouped by `publications.year`, newest year first. Backed by `publications p INNER JOIN works w`; the year key is bounded to `1000..YEAR(CURDATE())+1`, so garbage future years are excluded and `2027` is the newest observed. **This endpoint was previously timing out at multi-year pages; it is now fixed** and returns full pages (a 10-year page completes in ~3 s).

### Query parameters

| param | type | default | accepted values / bounds | effect |
|---|---|---|---|---|
| `year_from` | integer | none | validator 1900..currentYear+1 (service floor is 1000) | inclusive lower bound: `p.year >= year_from` |
| `year_to` | integer | none | validator 1900..currentYear+1 | inclusive upper bound: `p.year <= year_to` |
| `page` / `limit` / `offset` | — | 1 / 20 / 0 | `limit` 1..100 | pagination over the distinct-year list (271 years total) |

There are **no** citation/sort params here; ordering is fixed `year DESC`.

### Example requests

```
GET /metrics/annual?limit=10
GET /metrics/annual?year_from=2020&year_to=2022&limit=5
GET /metrics/annual?limit=20&offset=20
```

### Example response

`GET /metrics/annual?limit=10` (trimmed to 2 of 10 rows):

```json
{
  "status": "success",
  "data": [
    {
      "year": 2026,
      "metrics": {
        "total_publications": 205986,
        "unique_works": 205982,
        "open_access_count": 164986,
        "open_access_percentage": 80.1,
        "articles": 205354,
        "books": 63,
        "unique_organizations": 53449,
        "avg_citations": 0.02
      },
      "growth": {
        "publications_vs_previous": null,
        "authors_vs_previous": null
      }
    },
    {
      "year": 2022,
      "metrics": {
        "total_publications": 353169,
        "unique_works": 352771,
        "open_access_count": 267688,
        "open_access_percentage": 75.8,
        "articles": 343480,
        "books": 6514,
        "unique_organizations": 63515,
        "avg_citations": 0.6
      },
      "growth": { "publications_vs_previous": null, "authors_vs_previous": null }
    }
    // ... (10 total: 2026, 2025, 2024 … 2017)
  ],
  "pagination": { "page": 1, "limit": 10, "total": 270, "totalPages": 27, "hasNext": true, "hasPrev": false },
  "meta": {
    "summary": {
      "total_years": 270,
      "date_range": "2017-2026",
      "total_works_all_years": 2879970,
      "avg_works_per_year": 287997,
      "growth_trend": "increasing"
    },
    "filters": { "year_from": null, "year_to": null, "limit": 10, "page": 1, "offset": 0 },
    "generated_at": "2026-07-23T22:08:18.140Z",
    "performance": { "controller_time_ms": 4 },
    "request": { "method": "GET", "path": "/metrics/annual?limit=10" },
    "pagination_extras": { "offset": 0 }
  }
}
```

### Fields — data item

| field (dot-path) | type | notes |
|---|---|---|
| `year` | integer | grouping key, bounded 1000..currentYear+1. The newest bucket reflects the summary table's coverage (e.g. `2026`). |
| `metrics.total_publications` | integer | publications in the year (precomputed `metrics_annual_summary.total_publications`). |
| `metrics.unique_works` | integer | distinct works in the year — slightly below `total_publications` (multi-manifestation works). |
| `metrics.open_access_count` | integer | publications with `open_access = 1`. |
| `metrics.open_access_percentage` | number (float, 2dp) | derived `ROUND(open_access_count * 100 / total_publications, 2)`. |
| `metrics.articles` | integer | count of `type = 'ARTICLE'`. |
| `metrics.books` | integer | count of `type = 'BOOK'`. Other types are not broken out. |
| `metrics.unique_organizations` | integer | **real** — distinct affiliated organizations active in the year (from the operator-maintained `metrics_annual_summary.unique_organizations`). `0` only for very sparse historical years. |
| `metrics.avg_citations` | number (float, 2dp) | mean citations per publication in the year (precomputed). Low for recent years (citations accrue over time). |
| `growth.publications_vs_previous` | null | **always `null`** — never computed. |
| `growth.authors_vs_previous` | null | **always `null`** — never computed. |

> `total_downloads` is **not** a field of this endpoint. Download counts are not computed in the database (`works.download_count` is universally unpopulated), so the field was removed from the response rather than served as a misleading `0`.

### Fields — `meta.summary` (page-scoped)

| field | type | notes |
|---|---|---|
| `total_years` | integer | distinct-year corpus total (= `pagination.total`, 271). |
| `date_range` | string \| null | `"min-max"` over the current page's years, e.g. `"2018-2027"`. |
| `total_works_all_years` | integer | sum of `total_publications` across the **page's** rows. |
| `avg_works_per_year` | integer | `total_works_all_years / rows_on_page`. |
| `growth_trend` | string \| null | enum `increasing` \| `stable` \| `decreasing` \| `insufficient_data`; `null` when fewer than 2 rows. Computed over page ordering (newest first), so `decreasing` means recent years have fewer works than older ones on the page. |

### Notes / caveats

- `meta.filters.year_from` / `year_to` echo as **strings** when provided (e.g. `"2020"`).
- **Backed by the precomputed `metrics_annual_summary` table** (operator-maintained, keyed by `year`, refreshed on the stats cadence). Every page is a single indexed read, so responses are sub-second (`controller_time_ms` ~4 ms) regardless of page depth. If the summary table is ever absent, the API transparently falls back to a live aggregation over `publications` (paginate distinct years, then aggregate the page) with the same shape — see [../API_ISSUES.md](../API_ISSUES.md).
- Both `growth.*` fields are structurally present but always `null` (not computed). `total_downloads` was removed entirely (no download data in the DB).

---

## `GET /metrics/venues`

Top venues ranked by `venues.works_count DESC` (tiebreak `total_score DESC`). Backed by the `venues` base table; fast (~45 ms). Real cardinality: **182,765** venues with `works_count > 0`. Related detail: [./venues.md](./venues.md).

### Query parameters

Pagination only (`page` / `limit` / `offset`). No filters, no sort override.

### Example requests

```
GET /metrics/venues?limit=3
GET /metrics/venues?limit=20&page=2
```

### Example response

`GET /metrics/venues?limit=3` (1 of 3 rows shown):

```json
{
  "status": "success",
  "data": [
    {
      "venue_id": 1343359,
      "ranking": 1,
      "name": "IOP Conference Series: Materials Science and Engineering",
      "abbreviated_name": "IOP Conf. Ser.: Materials Sci. Eng.",
      "type": "CONFERENCE",
      "metrics": {
        "total_works": 73821,
        "unique_authors": 0,
        "open_access_works": 0,
        "open_access_percentage": 0
      },
      "timespan": {
        "first_publication_year": 2011,
        "latest_publication_year": 2026,
        "years_active": 16
      }
    }
    // ... (3 total)
  ],
  "pagination": { "page": 1, "limit": 3, "total": 182765, "totalPages": 60922, "hasNext": true, "hasPrev": false },
  "meta": {
    "summary": {
      "total_venues_ranked": 182765,
      "top_venue_publications": 73821,
      "total_unique_authors": 0,
      "avg_open_access_percentage": 0,
      "venue_types": ["CONFERENCE", "JOURNAL"]
    },
    "filters": { "limit": 3, "page": 1, "offset": 0 },
    "generated_at": "2026-07-23T18:56:58.774Z",
    "performance": { "controller_time_ms": 45 },
    "request": { "method": "GET", "path": "/metrics/venues?limit=3" },
    "pagination_extras": { "offset": 0 }
  }
}
```

### Fields — data item

| field (dot-path) | type | notes |
|---|---|---|
| `venue_id` | integer | `venues.id`; link to `/venues/{venue_id}`. |
| `ranking` | integer | page-relative 1-based. |
| `name` | string | `venues.name`. |
| `abbreviated_name` | string \| null | `venues.abbreviated_name`. Always surfaced alongside `name`. |
| `type` | string enum | `JOURNAL` \| `CONFERENCE` \| `REPOSITORY` \| `BOOK_SERIES` \| `SOURCE_BOOK` \| `OTHER`. |
| `metrics.total_works` | integer | `venues.works_count` — the ranking key. |
| `metrics.unique_authors` | integer | **always `0`** — placeholder, not computed. |
| `metrics.open_access_works` | integer | **always `0`** — placeholder, not computed. |
| `metrics.open_access_percentage` | number | **always `0`** — placeholder, not computed. |
| `timespan.first_publication_year` | integer \| null | = `venues.coverage_start_year`. |
| `timespan.latest_publication_year` | integer \| null | = `venues.coverage_end_year`. |
| `timespan.years_active` | integer | `latest - first + 1`, else `0` when either bound is null. |

### Fields — `meta.summary`

| field | type | notes |
|---|---|---|
| `total_venues_ranked` | integer | corpus total (= `pagination.total`). |
| `top_venue_publications` | integer | `works_count` of the top row on the page. |
| `total_unique_authors` | integer | **always `0`** (placeholder). |
| `avg_open_access_percentage` | number | **always `0`** (placeholder). |
| `venue_types` | string[] | distinct `type` values present on the current page. |

### Notes / caveats

- Three `metrics` fields (`unique_authors`, `open_access_works`, `open_access_percentage`) and one summary field (`total_unique_authors`, `avg_open_access_percentage`) are hardcoded placeholder zeros — **do not chart them**. For real OA data on a venue, use the venue detail endpoint. See [../API_ISSUES.md](../API_ISSUES.md).
- `timespan` reflects the venue's declared coverage years, not an actual MIN/MAX over its publications.

---

## `GET /metrics/institutions`

Organizations ranked by `organizations.publication_count DESC` (tiebreak `id ASC`), restricted to `publication_count > 0`. Backed by the `organizations` base table plus a bounded `authorships + publications` join for the year range. Real cardinality: **~410,700** orgs with works. Related detail: [./institutions.md](./institutions.md).

### Query parameters

| param | type | default | accepted values / bounds | effect |
|---|---|---|---|---|
| `country_code` | string | none | **exactly 2 chars**, ISO 3166-1 alpha-2 (e.g. `BR`, `US`) | filters to that country; echoed in `meta.filters.country_code` |
| `page` / `limit` / `offset` | — | 1 / 20 / 0 | `limit` 1..100 | pagination |

### Example requests

```
GET /metrics/institutions?limit=3
GET /metrics/institutions?limit=2&country_code=BR
GET /metrics/institutions?limit=10&page=3
```

### Example response

`GET /metrics/institutions?limit=3` (1 of 3 rows shown):

```json
{
  "status": "success",
  "data": [
    {
      "organization_id": 2801117,
      "ranking": 1,
      "name": "University of Toronto",
      "country_code": "CA",
      "metrics": {
        "total_works": 5412,
        "total_citations": 7822,
        "avg_citations": 1.45,
        "unique_researchers": 4323,
        "open_access_works_count": 5750,
        "h_index": 35
      },
      "timespan": {
        "first_publication_year": 1891,
        "latest_publication_year": 2026,
        "years_active": 136
      },
      "productivity_score": null
    }
    // ... (3 total)
  ],
  "pagination": { "page": 1, "limit": 3, "total": 410716, "totalPages": 136906, "hasNext": true, "hasPrev": false },
  "meta": {
    "summary": {
      "total_institutions_ranked": 410716,
      "countries_represented": ["CA", "FR", "BR"],
      "top_institution_works": 5412,
      "avg_citations_per_work": 0.8,
      "total_citations": 11889
    },
    "filters": { "limit": 3, "page": 1, "offset": 0, "country_code": null },
    "generated_at": "2026-07-23T18:56:58.941Z",
    "performance": { "controller_time_ms": 160 },
    "request": { "method": "GET", "path": "/metrics/institutions?limit=3" },
    "pagination_extras": { "offset": 0 }
  }
}
```

### Fields — data item

| field (dot-path) | type | notes |
|---|---|---|
| `organization_id` | integer | `organizations.id`; link to `/institutions/{organization_id}`. |
| `ranking` | integer | page-relative 1-based. |
| `name` | string | `organizations.name`. |
| `country_code` | string \| null | ISO-2. |
| `metrics.total_works` | integer | `organizations.publication_count` — the ranking key. |
| `metrics.total_citations` | integer | `organizations.total_citations`. |
| `metrics.avg_citations` | number \| null | derived `ROUND(total_citations / total_works, 2)`; `null` when `total_works = 0` (never happens here since browse is activity-anchored). |
| `metrics.unique_researchers` | integer | `organizations.researcher_count`. |
| `metrics.open_access_works_count` | integer | `organizations.open_access_works_count`. **Scope-mismatched — can EXCEED `total_works`** (e.g. USP `total_works` 4312 vs OA 6535). **Do not compute an OA% from these two fields.** |
| `metrics.h_index` | integer \| null | `organizations.h_index`. |
| `timespan.first_publication_year` | integer \| null | `MIN(pub.year)` over affiliated authorships (bounded query). |
| `timespan.latest_publication_year` | integer \| null | `MAX(pub.year)`; may surface a garbage future year (USP shows `2027`). |
| `timespan.years_active` | integer | `latest - first + 1`, else `0`. |
| `productivity_score` | null | **always `null`** — reserved, not computed. |

### Fields — `meta.summary`

| field | type | notes |
|---|---|---|
| `total_institutions_ranked` | integer | corpus total for the active filter (= `pagination.total`). With `country_code=BR` this drops to 1031. |
| `countries_represented` | string[] | distinct `country_code`s on the current page. |
| `top_institution_works` | integer | `publication_count` of the page's top row. |
| `avg_citations_per_work` | number | page aggregate. |
| `total_citations` | integer | sum of `total_citations` across the **page**. |

### Notes / caveats

- `country_code` must be **exactly 2 characters** — a 1- or 3-char value returns 400 `VALIDATION` (the swagger once said `maxLength 3`; the validator requires 2). Value is uppercase ISO-2.
- The OA scope mismatch is a known data issue — see [../API_ISSUES.md](../API_ISSUES.md). The general `/institutions` list deliberately omits an OA percentage for this reason; only this metrics endpoint surfaces the raw count.
- Detail-by-id (`/institutions/{id}`) resolves any org regardless of activity; this leaderboard only shows `publication_count > 0`.

---

## `GET /metrics/persons`

Researchers ranked by `persons.total_works DESC`, base filter `total_works > 0`. Backed by the `persons` base table directly; fast (~15–65 ms). Real cardinality: **~305,670** persons. Related detail: [./persons.md](./persons.md).

### Query parameters

| param | type | default | accepted values / bounds | effect |
|---|---|---|---|---|
| `min_works` | integer | **none** | ≥ 1 | filters `total_works >= min_works`. **No default is applied when omitted** (base filter stays `total_works > 0`), despite older swagger claiming `default: 5`. |
| `organization_id` | integer | none | ≥ 1 | restrict to persons with an authorship whose `affiliation_id` equals this org id. Echoed (as a **string**) in `meta.filters.organization_id`. |
| `page` / `limit` / `offset` | — | 1 / 20 / 0 | `limit` 1..100 | pagination |

### Example requests

```
GET /metrics/persons?limit=3&min_works=500
GET /metrics/persons?limit=2&organization_id=2801117
GET /metrics/persons?limit=20
```

### Example response

`GET /metrics/persons?limit=3&min_works=500` (2 of 3 rows shown):

```json
{
  "status": "success",
  "data": [
    {
      "person_id": 3589585,
      "ranking": 1,
      "name": "John C Campbell",
      "identifiers": { "orcid": null },
      "is_verified": false,
      "primary_affiliation": null,
      "metrics": { "total_works": 1244, "total_citations": 4845, "avg_citations": 3.89 },
      "timespan": { "first_publication_year": 1922, "latest_publication_year": 2025, "years_active": 104 },
      "productivity_score": null
    },
    {
      "person_id": 18165,
      "ranking": 2,
      "name": "D Lester",
      "identifiers": { "orcid": "0000-0003-1357-8672" },
      "is_verified": true,
      "primary_affiliation": null,
      "metrics": { "total_works": 1138, "total_citations": 227, "avg_citations": 0.2 },
      "timespan": { "first_publication_year": 1950, "latest_publication_year": 2026, "years_active": 77 },
      "productivity_score": null
    }
    // ... (3 total)
  ],
  "pagination": { "page": 1, "limit": 3, "total": 36, "totalPages": 12, "hasNext": true, "hasPrev": false },
  "meta": {
    "summary": {
      "total_persons_ranked": 36,
      "top_person_works": 1244,
      "avg_citations_per_work": 1.45,
      "total_citations": 5347
    },
    "filters": { "limit": 3, "page": 1, "offset": 0, "organization_id": null },
    "generated_at": "2026-07-23T18:57:04.252Z",
    "performance": { "controller_time_ms": 1 },
    "request": { "method": "GET", "path": "/metrics/persons?limit=3&min_works=500" },
    "pagination_extras": { "offset": 0 }
  }
}
```

### Fields — data item

| field (dot-path) | type | notes |
|---|---|---|
| `person_id` | integer | `persons.id`; link to `/persons/{person_id}`. |
| `ranking` | integer | page-relative 1-based. |
| `name` | string | `persons.preferred_name`. |
| `identifiers.orcid` | string \| null | `persons.orcid`. Only ORCID is surfaced here. |
| `is_verified` | boolean \| null | `persons.is_verified`. |
| `primary_affiliation` | null | **always `null`** — not computed. Do not render. |
| `metrics.total_works` | integer | `persons.total_works` — the ranking key. |
| `metrics.total_citations` | integer | `persons.total_citations`. |
| `metrics.avg_citations` | number | `ROUND(total_citations / total_works, 2)`. |
| `timespan.first_publication_year` | integer \| null | `persons.first_publication_year`. |
| `timespan.latest_publication_year` | integer \| null | `persons.latest_publication_year`. |
| `timespan.years_active` | integer | `latest - first + 1`, else `0`. |
| `productivity_score` | null | **always `null`** — reserved. |

### Fields — `meta.summary`

| field | type | notes |
|---|---|---|
| `total_persons_ranked` | integer | corpus total for the active filter (= `pagination.total`; `min_works=500` → 36). |
| `top_person_works` | integer | `total_works` of the page's top row. |
| `avg_citations_per_work` | number | page aggregate. |
| `total_citations` | integer | sum over the **page**. |

### Notes / caveats

- `meta.filters.organization_id` echoes as a **string** (e.g. `"2801117"`) when provided, `null` otherwise.
- **Data-quality caveat.** The `total_works` leaderboard surfaces dedup/garbage entities near the top ("Fulano de Tal", "Et Al"-style names) because they aggregate many mis-attributed authorships. Treat the raw top-N as noisy; ORCID presence + `is_verified` are useful trust signals for the UI.

---

## `GET /metrics/collaborations`

Top co-authorship pairs computed over the **top ~2000 authors** (`persons.total_works >= 30`), ordered by `shared_works DESC`. Backed by an `authorships` self-join (heavy — ~2.5–3 s, bounded by a statement budget). The pair shape is **identical** to `/collaborations/top` and `/persons/{id}/collaborators` — see [./collaborations.md](./collaborations.md). Real cardinality at default: ~5,129 pairs.

### Query parameters

| param | type | default | accepted values / bounds | effect |
|---|---|---|---|---|
| `min_collaborations` | integer | **2** | 1..50 | `HAVING shared_works >= min_collaborations`. Echoed (as a **string**) in `meta.filters.min_collaborations`. |
| `page` / `limit` / `offset` | — | 1 / 20 / 0 | `limit` 1..100 | pagination |

### Example requests

```
GET /metrics/collaborations?limit=3
GET /metrics/collaborations?limit=3&min_collaborations=5
GET /metrics/collaborations?limit=10&min_collaborations=10
```

### Example response

`GET /metrics/collaborations?limit=3&min_collaborations=5` (2 of 3 rows shown):

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
      "metrics": { "shared_works": 375, "avg_shared_citations": 15, "collaboration_strength": "very_strong" },
      "timespan": { "first_collaboration_year": 1975, "latest_collaboration_year": 2024, "collaboration_years": 50 }
    },
    {
      "ranking": 2,
      "collaborators": {
        "person_1": { "id": 85449, "name": "Carter G Woodson" },
        "person_2": { "id": 3626787, "name": "C G Woodson" }
      },
      "metrics": { "shared_works": 237, "avg_shared_citations": 0.68, "collaboration_strength": "very_strong" },
      "timespan": { "first_collaboration_year": 1916, "latest_collaboration_year": 1950, "collaboration_years": 35 }
    }
    // ... (3 total)
  ],
  "pagination": { "page": 1, "limit": 3, "total": 785, "totalPages": 262, "hasNext": true, "hasPrev": false },
  "meta": {
    "summary": {
      "total_collaboration_pairs": 785,
      "strongest_collaboration_count": 375,
      "avg_collaboration_years": 49,
      "collaboration_strength_distribution": { "very_strong": 3, "strong": 0, "moderate": 0, "weak": 0 }
    },
    "filters": { "limit": 3, "page": 1, "offset": 0, "min_collaborations": 5 },
    "generated_at": "2026-07-23T18:57:06.742Z",
    "performance": { "controller_time_ms": 2462 },
    "request": { "method": "GET", "path": "/metrics/collaborations?limit=3&min_collaborations=5" },
    "pagination_extras": { "offset": 0 }
  }
}
```

### Fields — data item

| field (dot-path) | type | notes |
|---|---|---|
| `ranking` | integer | page-relative 1-based. |
| `collaborators.person_1.id` | integer | `LEAST(id_a, id_b)` — the lower person id of the pair. |
| `collaborators.person_1.name` | string \| null | `persons.preferred_name`. |
| `collaborators.person_2.id` | integer | `GREATEST(id_a, id_b)` — the higher id. |
| `collaborators.person_2.name` | string \| null | `persons.preferred_name`. |
| `metrics.shared_works` | integer | `COUNT(DISTINCT work_id)` co-authored by the pair — the ranking key. |
| `metrics.avg_shared_citations` | number | `ROUND(AVG(w.citation_count), 2)` over the shared works. |
| `metrics.collaboration_strength` | string enum | derived from `shared_works`: `>=10` → `very_strong`, `>=5` → `strong`, `>=3` → `moderate`, else `weak`. |
| `timespan.first_collaboration_year` | integer \| null | `MIN(pub.year)` over shared works. |
| `timespan.latest_collaboration_year` | integer \| null | `MAX(pub.year)`. |
| `timespan.collaboration_years` | integer | `latest - first + 1`, else `0`. |

### Fields — `meta.summary`

| field | type | notes |
|---|---|---|
| `total_collaboration_pairs` | integer | pair count for the active filter (= `pagination.total`; `min_collaborations=5` → 785). |
| `strongest_collaboration_count` | integer | `shared_works` of the page's top pair. |
| `avg_collaboration_years` | integer | page aggregate. |
| `collaboration_strength_distribution` | object | histogram `{ very_strong, strong, moderate, weak }` counted over the **current page** only. |

### Notes / caveats

- `meta.filters.min_collaborations` echoes as a **string** (e.g. `"5"`).
- **Graceful degradation.** The self-join is heavy. If the statement budget fires, the service returns an **empty `data` array** with `meta.degraded = true` and a `meta.filters.scope = "top_authors_only"` marker (present only in the degraded branch). The UI must handle an empty page that is not "no results". Under normal load the query completes (~2.5–3 s).
- **Scope.** Only pairs among the top ~2000 authors (`total_works >= 30`) are considered — this is not an exhaustive collaboration graph.
- **Data-quality caveat.** The strongest "collaborations" are largely same-person duplicate clusters (`"Et Al"`/`"et al et al"`, `"Carter G Woodson"`/`"C G Woodson"`, `"M Strathern"`/`"Marilyn Strathern"`) rather than genuine co-authorships. Treat top rows as noisy; consider surfacing a data-cleaning caveat in any UI built on this.
- Identical pair shape is also served by `/collaborations/top` — see [./collaborations.md](./collaborations.md).
