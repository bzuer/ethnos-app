# Ethnos API — Global conventions (read this first)

This chapter documents everything that is the **same across every endpoint**: the response envelope, pagination, authentication, error handling, automatic value normalization, the shared `meta` flags, the shared query parameters, and the search-engine model. The per-domain chapters under [`domains/`](./domains/) assume you have read this and only document what is specific to each domain.

The companion document [`API_ISSUES.md`](./API_ISSUES.md) records the behaviour defects that were found and fixed (and the few operator-side follow-ups). The machine-readable contract is the OpenAPI spec at `GET /docs.json` (Swagger UI at `GET /docs`).

---

## 1. What the API is

A public, **read-only** RESTful API over an academic bibliographic corpus:

| Entity | Scale (approx.) | Endpoints |
|---|---|---|
| Works (multi-manifestation records) | 7,136,695 | `/works`, `/search/works` |
| Publications (one per published instance of a work) | 7,220,125 | `/publications` |
| Persons (researchers) | 4,727,444 | `/persons`, `/search/persons` |
| Venues (journals, book series, repositories…) | 189,076 | `/venues` |
| Organizations (institutions, publishers, funders) | — | `/institutions` |
| Subjects (controlled vocabulary) | 169,159 | `/subjects/*` |
| Signatures (normalized author name forms) | — | `/signatures/*` |
| Courses / Instructors / Bibliographies | sparse | `/courses`, `/instructors`, `/bibliographies` |

A **work** is a *multi-manifestation* record: its type lives per-publication on `publications.type`, so one work can carry publications of different types. Work listings use **`any_publication`** semantics (a work matches a filter if any of its publications matches).

**Base URLs**

| Environment | URL |
|---|---|
| Production | `https://api.ethnos.app` |
| Local/dev | `http://localhost:1211` |

All examples in this guide use relative paths; prefix them with a base URL. OpenAPI `info.version` is `2.0.0`.

---

## 2. Response envelope

Every response is a JSON object with a `status` discriminator.

**Success**
```json
{
  "status": "success",
  "data": <object | array | null>,
  "pagination": { ... },     // only on list endpoints
  "meta": { ... }            // almost always present
}
```

**Error**
```json
{
  "status": "error",
  "message": "Human-readable message",
  "code": "MACHINE_CODE",
  "timestamp": "2026-07-23T18:24:42.455Z",
  "errors": [ ... ],         // only on validation failures (express-validator array)
  "meta": { "request": { "method": "GET", "path": "/works" } }
}
```

Always branch on `status` first. On success, read `data`; on error, read `code` (stable) and `message` (human).

---

## 3. Pagination

Every listing accepts pagination **two interchangeable ways**:

- `page` + `limit` (1-based page), or
- `offset` + `limit` (0-based offset).

If both `page` and `offset` are supplied, `page` is derived from `offset` (`page = floor(offset/limit) + 1`).

| Param | Default | Bounds |
|---|---|---|
| `limit` | `10` | `1..100` (values above 100 are clamped to 100) |
| `page` | `1` | `>= 1` |
| `offset` | `0` | `>= 0` |

The `pagination` object on list responses:

| Field | Type | Meaning |
|---|---|---|
| `page` | int | current 1-based page |
| `limit` | int | effective page size |
| `total` | int | total matching rows — **best-effort**, see `meta.pagination_total_exact` |
| `totalPages` | int | `ceil(total/limit)` |
| `hasNext` | bool | more pages after this one |
| `hasPrev` | bool | pages before this one |

When `offset`/`cursor` were supplied, the effective offset is echoed under `meta.pagination_extras.offset`.

> **Terminator rule.** On JOIN-heavy or full-text listings `total` can be a non-exact estimate (see §6). Do not treat `total` as authoritative unless `meta.pagination_total_exact === true`. Always also stop paging when a page returns fewer than `limit` rows (`data.length < limit`).

---

## 4. Automatic value normalization

Every response passes through a normalizer, so clients can rely on stable types:

- **Booleans**: fields matching `is_*`, `has_*`, `*_flag`, `*_enabled`, `open_access`, `peer_reviewed`, `is_in_doaj`, `is_in_scielo`, `is_indexed_in_scopus`, `active`, etc. are always real JSON booleans (`0/1` and `"true"/"false"` are coerced). Numeric-looking exceptions like `works_count`, `year`, `total`, `limit`, `offset` are **not** coerced.
- **Dates**: fields matching `*_at`, `*_date`, `*timestamp`, `created_at`, `updated_at`, `publication_date`, etc. are ISO-8601 UTC strings (`YYYY-MM-DDT...Z`). Date-only values become `T00:00:00.000Z`.
- **Nullish strings**: the strings `"null"` / `"undefined"` and JS `undefined` become JSON `null`.

So: booleans are booleans, dates are ISO strings, and absent values are `null` (not `""` or `"null"`).

---

## 5. Authentication & rate limiting

**The API is open by default — no key is required** for any data or metrics endpoint (`/`, `/works`, `/publications`, `/persons`, `/venues`, `/institutions`, `/search/*`, `/subjects/*`, `/signatures/*`, `/courses`, `/instructors`, `/bibliographies`, `/metrics/*`, citations, collaborations, the DOI resolver).

**Endpoints that require a key** (`X-Access-Key` header) — reject with **401** when missing/invalid:

- `/dashboard/*`
- `/security/*`
- `/health/readiness`, `/health/metrics`

`/health/liveness`, `/docs`, and the OpenAPI documents are public.

**Rate limiting** is on by default: unauthenticated requests are capped at **120 requests/minute per IP** (window 60 s). Over the cap → **429**. Localhost is exempt. A valid key **removes** the cap on the open endpoints (it is an optional rate-limit bypass there).

Header aliases (case-insensitive): `x-access-key`, `x-internal-key`, `x-api-key`. Query-string aliases: `access_key`, `accessKey`, `api_key`.

In OpenAPI the security scheme `XAccessKey` is declared globally as **optional** (`security: [{}, { XAccessKey: [] }]`); gated operations override to require it.

---

## 6. The `meta` object — shared flags

`meta` carries provenance and reliability signals. Not every flag appears on every endpoint; the ones you will encounter:

| Flag | Where | Meaning |
|---|---|---|
| `request.{method,path}` | everywhere | echo of the request |
| `pagination_total_exact` | work/publication/institution listings | `false` → `pagination.total` is an estimate (unfiltered browse, or the count exceeded the ~2 s budget); gate on this before trusting `total` |
| `match_mode` | work listings / affiliated works | `"any_publication"` on `/works`; `"affiliation"` / `"funder"` on institution nested works |
| `engine` / `performance.engine` | works, publications, search | `"Manticore"` when a full-text term participated, else `"MariaDB"` |
| `performance.*` | works, publications | server-side timing (`primary_query_ms`, `total_rows_examined`, `query_type`) |
| `fulltext_truncated` / `fulltext_work_cap` | `/publications` with full-text | the full-text work-id set was capped (default 5000) |
| `page_degraded` | `/publications` | the page query hit the statement budget and returned empty; narrow the filter or change the sort |
| `has_files_source` | `/publications?has_files=true` | `"files_index"` when the fast path served the page (with `has_files_note` if extra filters may under-fill) |
| `sort` / `sort.{by,order}` | venues, institutions | the effective sort applied |
| `summary` | metrics/collaborations | aggregate roll-ups |
| `pagination_extras.offset` | any list called with `offset` | the effective offset |

**Graceful degradation.** Heavy reads are bounded below the 5 s request ceiling. When a query exceeds its budget the endpoint degrades (empty/estimated page + a `meta` flag) instead of returning `5xx`. Design the UI to read the flags rather than assume every page is exact and full.

---

## 7. Shared query parameters

### Citation filters & sorting (work and publication listings)
Available on `/works`, `/works/showcase`, `/publications`, `/search/works`, `/search/advanced`, `/persons/{id}/works`, `/venues/{id}/works`, `/institutions/{id}/works`, `/institutions/{id}/funded-works`:

| Param | Meaning |
|---|---|
| `cited_by_min` / `cited_by_max` | inclusive bounds on citation count (aliases `citation_count_min` / `citation_count_max`) |
| `sort_by` | `cited_by_count` \| `references_count` \| `publication_year` \| `id` \| (`relevance` on full-text paths). Aliases `sortBy`, and `citation_count`/`reference_count`/`year`/`work_id` |
| `sort_order` | `ASC` \| `DESC` (alias `sortOrder`); numeric fields default `DESC` |

With `sort_by` omitted: DB-backed listings default to `publication_year DESC, id DESC`; full-text paths default to relevance. Work list items expose `cited_by_count` / `references_count`; publication list items expose `citation_count` / `reference_count`.

### Common filters
`type` (per the domain's enum), `language` (ISO 639-1), `year_from` / `year_to`, `open_access` (bool), `peer_reviewed` (bool). Empty-string params (`param=`) are treated as absent.

---

## 8. Search-engine model

- **Manticore Search** (SphinxQL) powers free-text `q` and the `author` / `subject` metadata filters for **works** and **persons**. `q` spans `title, subtitle, abstract, authors, subjects, venue`; `author` → the authors field, `subject` → the subjects field (AND semantics). Matching ids are hydrated from MariaDB. Manticore `COUNT(*)` totals are **exact**.
- **MariaDB FULLTEXT** powers `venues` (`ft_venues_search` — also the `venue` / `venue_name` filter on works/publications), `subjects` (`ft_subjects_term`), and `organizations` (`ft_organizations_name`, plus exact acronym match).
- `meta.engine` tells you which engine served a given response.

> Historical note: earlier docs described a MariaDB works FULLTEXT (`ft_works_content` / `ft_works_metadata`). Those indexes **no longer exist**; works/persons full-text is Manticore-only. Any lingering mention elsewhere is stale.

---

## 9. Identifiers

Every primary resource nests its external identifiers under an `identifiers{}` object (never duplicated at the top level). Families in the corpus: **DOI, ORCID, ROR, ISSN / eISSN, ISBN-13, Scopus, OpenAlex, Wikidata, Handle, PMID, PMCID, arXiv, SciELO, OpenLibrary, LCCN, OCLC** and more (per entity). Every primary resource also exposes `_links.self`.

**DOI resolution.** `GET /{doi}` (also `/doi.org/{doi}` and `/https://doi.org/{doi}`) resolves a DOI to its publication and returns the publication payload with the parent work embedded.

---

## 10. HTTP status & error codes

| HTTP | When | `code` (examples) |
|---|---|---|
| 200 | success | — |
| 400 | validation failure (bad param) | `VALIDATION_ERROR` (+ `errors[]` with `path`/`msg`/`location`) |
| 401 | missing/invalid key on a gated endpoint | `UNAUTHORIZED` |
| 404 | resource / parent id not found | `NOT_FOUND` (+ domain codes like `COURSE_NOT_FOUND`, `INSTRUCTOR_NOT_FOUND`) |
| 429 | rate limit exceeded | `RATE_LIMITED` |
| 500 | unexpected server error | `INTERNAL_ERROR` (+ domain `*_FAILED` codes) |
| 503 | timeout / dependency unavailable | `TIMEOUT` |

`code` values are stable — branch UI logic on `code`, show `message` to users. Nested listings **404** when the parent id does not exist (e.g. `/venues/{id}/works`, `/works/{id}/citations`, `/persons/{id}/collaborators`, `/courses/{id}/instructors`).

---

## 11. How to read the domain chapters

Each file in [`domains/`](./domains/) documents one domain: an intro, then per-endpoint sections with **query parameters**, **example requests**, a **structurally-complete example response**, a **complete field inventory**, and **notes/caveats**. Cross-links use relative paths.

Suggested reading order for a frontend build: [works](./domains/works.md) → [publications](./domains/publications.md) → [persons](./domains/persons.md) → [search](./domains/search.md) → [venues](./domains/venues.md) → [institutions](./domains/institutions.md) → [subjects](./domains/subjects.md) → [citations](./domains/citations.md) → [collaborations](./domains/collaborations.md) → [metrics](./domains/metrics.md) → [courses](./domains/courses.md) / [instructors](./domains/instructors.md) / [signatures](./domains/signatures.md) / [bibliographies](./domains/bibliographies.md) → [dashboard](./domains/dashboard.md) / [security](./domains/security.md) / [system](./domains/system.md).
