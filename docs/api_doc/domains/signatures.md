# Signatures — normalized author name forms and their person/work linkages

The signatures domain exposes **normalized author-name strings** (uppercased canonical forms such as `"SILVA"`, `"DA SILVA A M"`) and the persons and works attached to them. It is backed by the `signatures` base table (`id`, `signature`, `created_at`) joined to `persons.signature_id`. There is **no Manticore involvement** here — signature search is a plain MariaDB `LIKE` / `=` over `signatures.signature`; person and work rows are hydrated from MariaDB by id. The table is large (~3.0M signatures, essentially all linked to at least one person).

A signature groups author-name variants: many `persons` rows can share the same `signature_id`, and `/signatures/{id}/persons` and `/signatures/{id}/works` expand that grouping. This domain reuses the person list-item shape from [persons](./persons.md) and links out to [works](./works.md). Read [00-conventions](../00-conventions.md) first for the envelope, pagination, error codes, and boolean/date normalization — this chapter only covers what is specific to signatures.

> **No root collection listing.** `GET /signatures` is intentionally **not registered** (per the endpoint inventory) and 404s through the global not-found handler. Use `/signatures/search` to browse.

The five live endpoints:

| Endpoint | Purpose |
|---|---|
| `GET /signatures/search` | substring / exact search over the signature string |
| `GET /signatures/statistics` | aggregate stats over the whole table |
| `GET /signatures/{id}` | single signature detail |
| `GET /signatures/{id}/persons` | persons sharing this signature |
| `GET /signatures/{id}/works` | works authored under this signature |

---

## `GET /signatures/search`

Substring (default) or exact search over the normalized signature string. Public. Backed by MariaDB `LIKE` / `=` on `signatures.signature` (no full-text engine). Returns matching signatures, each with a `persons_count`.

**Query parameters**

| param | type | default | accepted values / bounds | effect |
|---|---|---|---|---|
| `q` | string | — | **required**, 1..100 chars, trimmed | search term. Empty or missing → **400** `VALIDATION_ERROR` |
| `exact` | boolean | `false` | true/false (normalized) | `true` → `signature = q` exact match; otherwise `signature LIKE %q%` |
| `limit` | integer | `20` | 1..100 (clamped to 100) | page size |
| `offset` | integer | `0` | `>= 0` | rows to skip |

This endpoint is **offset/limit only** (no `page` param; pass `offset`). The response still normalizes to the standard `{page,limit,total,...}` pagination block, and echoes the raw offset under `meta.pagination_extras.offset`.

**Example requests**

```
GET /signatures/search?q=silva&limit=5
GET /signatures/search?q=silva&limit=20&offset=40
GET /signatures/search?q=SILVA%20A&exact=true
GET /signatures/search           # 400 — q is required
```

**Example response** (`?q=silva&limit=5`)

```json
{
  "status": "success",
  "data": [
    { "id": 14490421, "signature": "SILVA",        "created_at": "2026-01-11T22:14:39.000Z", "persons_count": 1 },
    { "id": 259377,   "signature": "DA SILVA A M",  "created_at": "2025-11-16T18:32:32.000Z", "persons_count": 91 },
    { "id": 17164,    "signature": "SILVA A",       "created_at": "2025-11-16T18:30:18.000Z", "persons_count": 82 },
    { "id": 87140,    "signature": "DA SILVA M A",  "created_at": "2025-11-16T18:30:56.000Z", "persons_count": 81 },
    { "id": 17497,    "signature": "SILVA M",       "created_at": "2025-11-16T18:30:18.000Z", "persons_count": 73 }
  ],
  "pagination": { "page": 1, "limit": 5, "total": 7773, "totalPages": 1555, "hasNext": true, "hasPrev": false },
  "meta": {
    "searchTerm": "silva",
    "exact": false,
    "request": { "method": "GET", "path": "/signatures/search?q=silva&limit=5" },
    "pagination_extras": { "offset": 0 }
  }
}
```

**Fields** (each `data[]` element)

| field | type | notes |
|---|---|---|
| `id` | integer | signature id — pass to `/signatures/{id}` and the nested endpoints |
| `signature` | string | normalized name form, uppercased (e.g. `"SILVA"`, `"DA SILVA A M"`) |
| `created_at` | string(date-time) | ISO-8601 UTC |
| `persons_count` | integer | distinct `persons` rows with this `signature_id` (`COUNT(p.id)`); `0` possible |

`meta` extras specific to this endpoint:

| field | type | notes |
|---|---|---|
| `meta.searchTerm` | string | echo of the trimmed `q` |
| `meta.exact` | boolean | echo of the `exact` flag |
| `meta.pagination_extras.offset` | integer | effective offset applied |

**Notes / caveats**
- **Ordering**: exact-string matches first (`CASE WHEN signature = q`), then `persons_count DESC`, then `signature ASC`. So a search for `silva` surfaces the shortest exact stem near the top only if it equals `q`; otherwise the most-shared signatures lead.
- `pagination.total` is **exact** (`COUNT(DISTINCT s.id)`) — no budget/estimate flag on this path. Result sets can be huge (`silva` → 7773), so paginate.
- Search `data[]` items are **raw service rows** — they do **not** carry `_links.self` (unlike the `/signatures/{id}` detail item). If you need a self link, construct `/signatures/{id}` from `id`.
- The match is a plain `LIKE %q%` substring over the uppercased canonical form; it is case-insensitive at the collation level but there is no fuzzy/stemmed matching. To find a person by natural name, prefer [`/search/persons`](./search.md).

---

## `GET /signatures/statistics`

Aggregate statistics over the entire `signatures` table (length buckets and person linkage). Public. No query parameters. Cached ~48h.

**Example request**

```
GET /signatures/statistics
```

**Example response**

```json
{
  "status": "success",
  "data": {
    "total_signatures": 2998653,
    "short_signatures": 1629340,
    "medium_signatures": 1341847,
    "long_signatures": 27466,
    "avg_signature_length": 10.6634,
    "linked_signatures": 2998652,
    "unlinked_signatures": 1
  },
  "meta": { "request": { "method": "GET", "path": "/signatures/statistics" } }
}
```

**Fields**

| field | type | notes |
|---|---|---|
| `total_signatures` | integer | `COUNT(*)` of the table (~3.0M) |
| `short_signatures` | integer | signatures with `LENGTH(signature) <= 10` |
| `medium_signatures` | integer | `LENGTH(signature)` in 11..20 |
| `long_signatures` | integer | `LENGTH(signature) > 20` |
| `avg_signature_length` | number(float) | `AVG(LENGTH(signature))`, e.g. `10.6634` |
| `linked_signatures` | integer | signatures referenced by at least one `persons.signature_id` |
| `unlinked_signatures` | integer | `total_signatures - linked_signatures` (near-zero; effectively all signatures are linked) |

**Notes / caveats**
- The linked vs. unlinked split is essentially fully linked (observed `unlinked_signatures` fluctuates around 0–1 as data updates). Treat "unlinked" as a rounding-error tail, not a meaningful browse dimension.
- No `pagination` block (single object payload). There is no time budget / estimate flag on this endpoint — counts are the real aggregate.

---

## `GET /signatures/{id}`

Single signature detail. Same shape as a search row but adds `_links.self`. Public. Cached ~1h.

**Path parameters**

| param | type | bounds | notes |
|---|---|---|---|
| `id` | integer | `>= 1` (positive integer) | signature id; non-integer → 400, non-existent → 404 |

**Example requests**

```
GET /signatures/259377
GET /signatures/99999999999    # 404 — Signature not found
```

**Example response** (`/signatures/259377`)

```json
{
  "status": "success",
  "data": {
    "id": 259377,
    "signature": "DA SILVA A M",
    "created_at": "2025-11-16T18:32:32.000Z",
    "persons_count": 91,
    "_links": { "self": "/signatures/259377" }
  },
  "meta": { "request": { "method": "GET", "path": "/signatures/259377" } }
}
```

**Fields**

| field | type | notes |
|---|---|---|
| `id` | integer | signature id |
| `signature` | string | normalized name form |
| `created_at` | string(date-time) \| null | ISO-8601 UTC |
| `persons_count` | integer \| null | distinct linked persons |
| `_links.self` | string | `/signatures/{id}` |

**Notes / caveats**
- **404** `NOT_FOUND` with message `"Signature not found"` when the id does not exist.
- To expand this signature, follow with `/signatures/{id}/persons` (the linked researchers) and `/signatures/{id}/works` (their works).

---

## `GET /signatures/{id}/persons`

Paginated list of the `persons` that share this signature (`persons.signature_id = id`). Public. Returns the **shared person list-item DTO** (same shape as [persons](./persons.md) list rows), **not** a signature shape.

**Path parameters**

| param | type | bounds | notes |
|---|---|---|---|
| `id` | integer | `>= 1` | signature id; 404 if it does not exist |

**Query parameters**

| param | type | default | bounds | effect |
|---|---|---|---|---|
| `limit` | integer | `20` | 1..100 (clamped) | page size |
| `offset` | integer | `0` | `>= 0` | rows to skip |

Offset/limit paging (raw offset echoed at `meta.pagination_extras.offset`). No `page` param on this route.

**Example requests**

```
GET /signatures/259377/persons
GET /signatures/259377/persons?limit=50&offset=50
```

**Example response** (`/signatures/259377/persons?limit=3`)

```json
{
  "status": "success",
  "data": [
    {
      "id": 6799473,
      "_links": { "self": "/persons/6799473" },
      "preferred_name": "Aarão Miranda da Silva",
      "given_names": "Aarão Miranda",
      "family_name": "da Silva",
      "name_signature": null,
      "identifiers": {
        "orcid": null,
        "lattes_id": null,
        "scopus_id": null,
        "wikidata_id": null,
        "openalex_id": null,
        "url": null
      },
      "is_verified": false,
      "metrics": { "works_count": 1, "latest_publication_year": 2014 }
    }
  ],
  "pagination": { "page": 1, "limit": 3, "total": 91, "totalPages": 31, "hasNext": true, "hasPrev": false },
  "meta": {
    "request": { "method": "GET", "path": "/signatures/259377/persons?limit=3" },
    "pagination_extras": { "offset": 0 }
  }
}
```

**Fields** (each `data[]` element — the person list-item shape)

| field | type | notes |
|---|---|---|
| `id` | integer | person id — follow `_links.self` to `/persons/{id}` |
| `_links.self` | string | `/persons/{id}` |
| `preferred_name` | string \| null | display name |
| `given_names` | string \| null | |
| `family_name` | string \| null | |
| `name_signature` | string \| null | person's own signature-name field (from the person DTO); typically `null` here |
| `identifiers.orcid` | string \| null | ORCID |
| `identifiers.lattes_id` | string \| null | Lattes id |
| `identifiers.scopus_id` | string \| null | Scopus author id |
| `identifiers.wikidata_id` | string \| null | Wikidata id |
| `identifiers.openalex_id` | string \| null | OpenAlex id |
| `identifiers.url` | string \| null | canonical URL |
| `is_verified` | boolean | person verification flag |
| `metrics.works_count` | integer | from `persons.total_works` |
| `metrics.latest_publication_year` | integer \| null | most recent publication year for the person |

**Notes / caveats**
- **404** `NOT_FOUND` (`"Signature not found"`) when the signature id does not exist (the service returns null when there is no matching signature row).
- `pagination.total` is **exact** (`COUNT` of persons with this `signature_id`).
- This is the same DTO used by [persons](./persons.md) listings; the `identifiers{}` nesting and `metrics{}` block match there. Do not expect flat top-level identifier keys.

---

## `GET /signatures/{id}/works`

Paginated list of works authored by **any** person carrying this signature. Public. Uses the `formatSignatureWork` DTO — an author-centric work row.

**Path parameters**

| param | type | bounds | notes |
|---|---|---|---|
| `id` | integer | `>= 1` | signature id; 404 if it does not exist |

**Query parameters**

| param | type | default | bounds | effect |
|---|---|---|---|---|
| `page` | integer | `1` | `>= 1` | page number (this route is **page-based**, not offset) |
| `limit` | integer | `20` | 1..100 (clamped) | page size |

> This endpoint accepts **only** `page` and `limit`. It does **not** honor the shared work-listing sort/citation/type/language/year filters (`sort_by`, `cited_by_min`, `type`, etc.). Ordering is fixed.

**Example requests**

```
GET /signatures/259377/works
GET /signatures/259377/works?limit=3
GET /signatures/259377/works?page=2&limit=50
```

**Example response** (`/signatures/259377/works?limit=3`, one element shown)

```json
{
  "status": "success",
  "data": [
    {
      "id": 22435033,
      "title": "Racismo, Cultura e Matemática",
      "subtitle": "Uma revisão sobre a Educação Quilombola à luz dos Estudos Culturais",
      "type": "ARTICLE",
      "language": "es",
      "doi": "10.23899/dftyhy63",
      "open_access": true,
      "authorship": {
        "role": "AUTHOR",
        "position": 2,
        "is_corresponding": false,
        "person_id": 10395464,
        "person_name": "Amanda Morais da Silva"
      },
      "publication": {
        "year": 2026,
        "journal": "RELACult - Revista Latino-Americana de Estudos em Cultura e Sociedade",
        "volume": "12",
        "issue": "3",
        "pages": null,
        "open_access": true
      },
      "authors": {
        "total_count": 4,
        "author_string": "Pedro Lucas Olinto Moura; Amanda Morais da Silva; Keilla Das Dores Teixeira; Patrícia Ignácio"
      },
      "created_at": "2026-07-19T22:55:47.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 3, "total": 204, "totalPages": 68, "hasNext": true, "hasPrev": false },
  "meta": { "request": { "method": "GET", "path": "/signatures/259377/works?limit=3" } }
}
```

**Fields** (each `data[]` element)

| field | type | notes |
|---|---|---|
| `id` | integer | work id — link to `/works/{id}` (see [works](./works.md)) |
| `title` | string \| null | work title |
| `subtitle` | string \| null | work subtitle |
| `type` | string \| null | displayed publication type of the latest publication: `ARTICLE`, `BOOK`, `CHAPTER`, `THESIS`, `CONFERENCE`, `CONFERENCE_PAPER`, `REPORT`, `DATASET`, `PREPRINT`, `REVIEW`, `EDITORIAL`, `OTHER` |
| `language` | string \| null | ISO 639-1 |
| `doi` | string \| null | DOI |
| `open_access` | boolean \| null | top-level convenience flag (from the latest publication's `open_access`) |
| `authorship.role` | string | `AUTHOR` \| `EDITOR` (MIN over this person's authorships on the work) |
| `authorship.position` | integer | author-list position |
| `authorship.is_corresponding` | boolean | corresponding-author flag |
| `authorship.person_id` | integer | the (lowest) person id under this signature that authored the work |
| `authorship.person_name` | string \| null | that person's `preferred_name` |
| `publication.year` | integer \| null | year of the latest publication |
| `publication.journal` | string \| null | venue name |
| `publication.volume` | string \| null | |
| `publication.issue` | string \| null | |
| `publication.pages` | string \| null | page range/article number (e.g. `"e025004"`) |
| `publication.open_access` | boolean | duplicate of top-level `open_access` |
| `authors.total_count` | integer | total authorships on the work |
| `authors.author_string` | string \| null | `; `-joined full author names (hydrated) |
| `created_at` | string(date-time) \| null | work `created_at`, ISO-8601 UTC |

**Notes / caveats**
- **Ordering is fixed**: `COALESCE(publication.year, 2024) DESC, work_id DESC`. Works with a null publication year are treated as year 2024 for sorting. You cannot re-sort or citation-filter this endpoint — for filtered/sorted work lists, use [`/works`](./works.md) or [`/persons/{id}/works`](./persons.md).
- **404** `NOT_FOUND` (`"Signature not found"`) when the signature id does not exist.
- `pagination.total = COUNT(DISTINCT work_id)` and is **exact** — no estimate/budget flag on this path.
- The `authorship` block reflects one representative linked person (the MIN person id under the signature), not necessarily the person you searched for. If you need per-person authorship, resolve via `/signatures/{id}/persons` then [`/persons/{id}/works`](./persons.md).

---

## Errors & edge cases (domain summary)

| Case | HTTP | Body |
|---|---|---|
| `q` missing/empty on `/search` | 400 | `VALIDATION_ERROR` with `errors[]` (`path: "q"`) |
| Non-integer `id` | 400 | `VALIDATION_ERROR` (`Signature ID must be a positive integer`) |
| Non-existent signature id (detail / persons / works) | 404 | `NOT_FOUND`, `message: "Signature not found"`, with `meta.request` |
| `GET /signatures` (root listing) | 404 | global not-found: `"Can't find /signatures on this server!"` — no `meta.request` block. Intentionally disabled |

All list endpoints in this domain report **exact** `pagination.total`; none set `pagination_total_exact`/`page_degraded`, so no graceful-degradation handling is needed here (unlike works/publications — see [00-conventions §6](../00-conventions.md)).
