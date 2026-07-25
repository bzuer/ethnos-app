# Persons — researchers and authors

This domain exposes the **person / author entity**: researchers and authors, backed by the `persons` base table (metric block, identifiers, `signature_id`), enriched at request time by joins to `signatures`, `authorships` (+ `works`, `publications`, `venues`), `work_subjects`, and `organizations` (for the primary affiliation). Free-text name search runs through **Manticore** (`persons_main`/`persons_delta` distributed index, unstemmed); everything else — the base list, the `signature` prefix lookup, and all nested endpoints — is served by **MariaDB**. Persons link outward to [works](./works.md) (`/persons/{id}/works`), [institutions](./institutions.md) (`primary_affiliation`), [signatures](./signatures.md), and [collaborations](./collaborations.md) — note `/persons/{id}/collaborators` and `/persons/{id}/network` exist and return 200 but are wired in the collaborations domain, not here.

The corpus is large and sparse: **4,727,444 persons** total, **1,555,748 verified**. Most rows are single-work authors (`works_count = 1`); productive researchers (e.g. id `3589585`, John C Campbell, 1244 works, h-index 26) are the exception.

Global conventions (envelope, `page`/`limit` + `offset`/`limit` pagination, rate limiting, error codes, boolean/date normalization, shared citation/sort params) are described once in [../00-conventions.md](../00-conventions.md) and are assumed here.

---

## `GET /persons`

Paginated list of researchers/authors. Default order is **`id DESC`** (newest first). The base list has **no metric or name sort** — there is no `sort_by`/`sort_order` on this endpoint. Backing engine depends on the parameter used: MariaDB for the plain list, `verified` filter, and `signature` lookup; **Manticore** for free-text `search`/`q`. Counts are exact `COUNT(*)` — there is no `pagination_total_exact` flag here.

**Query parameters**

| param | type | default | accepted values / bounds | effect |
|---|---|---|---|---|
| `page` | integer | 1 | ≥ 1 | 1-based page. |
| `limit` | integer | 20 | 1..100 (400 outside) | page size. |
| `offset` | integer | — | ≥ 0 | alternative to `page`; echoed at `meta.pagination_extras.offset`; combines with `limit`. |
| `search` | string | — | 2..255 chars | Full-text name search via **Manticore**. Sets `meta.engine="Manticore"`, `meta.query_type="search"`. The real free-text param. |
| `q` | string | — | 2..255 chars | Alias of `search` — identical Manticore path (verified: `q=silva` → 27,846, engine Manticore). |
| `signature` | string | — | 2..100 chars | MariaDB **LIKE-prefix** (`{value}%`) over `signatures.signature` via INNER JOIN. Sets `meta.query_type="signature_lookup"`. Case-sensitive to the stored uppercase form (use `SILVA`, not `silva`). |
| `verified` | string | — | `true` \| `false` only | filters `is_verified`. `verified=true` → 1,555,748. Any other value 400s. |

There is **no affiliation or country filter**. `affiliation=…` and `country=…` are accepted (not validated, not rejected) but are silent **no-ops** — the total is unchanged (verified: `affiliation=USP` → still 4,727,444). Do not build UI against them; see [../API_ISSUES.md](../API_ISSUES.md).

**Example requests**

```
GET /persons?limit=20
GET /persons?search=silva&limit=20
GET /persons?signature=SILVA&page=2&limit=20
GET /persons?verified=true&limit=20
```

**Example response** (`GET /persons?limit=3`)

```json
{
  "status": "success",
  "data": [
    {
      "id": 10592611,
      "_links": { "self": "/persons/10592611" },
      "preferred_name": "Wudson Guilherme de Oliveira",
      "given_names": "Wudson Guilherme",
      "family_name": "de Oliveira",
      "name_signature": "DE OLIVEIRA W G",
      "identifiers": {
        "orcid": null, "lattes_id": null, "scopus_id": null,
        "wikidata_id": null, "openalex_id": null, "url": null
      },
      "is_verified": false,
      "metrics": { "works_count": 1, "latest_publication_year": 2024 }
    }
  ],
  "pagination": {
    "page": 1, "limit": 3, "total": 4727444,
    "totalPages": 1575815, "hasNext": true, "hasPrev": false
  },
  "meta": {
    "engine": "MariaDB",
    "query_type": "list",
    "elapsed_ms": 339,
    "request": { "method": "GET", "path": "/persons?limit=3" },
    "pagination_extras": { "offset": 0 }
  }
}
```

On the `search`/`q` path `identifiers.orcid` and `is_verified` populate for real (e.g. `Kleber Aparecido Da Silva Silva`, orcid `0000-0002-7815-7767`, verified, 47 works), and `meta` carries `engine:"Manticore"`, `query_type:"search"`, **no `elapsed_ms`**.

**Fields** (list item)

| field (dot-path) | type | notes |
|---|---|---|
| `id` | integer | person id. |
| `_links.self` | string | `/persons/{id}`. |
| `preferred_name` | string \| null | display name. |
| `given_names` | string \| null | |
| `family_name` | string \| null | |
| `name_signature` | string \| null | normalized signature from the `signatures` join (e.g. `DE OLIVEIRA W G`). **null on the Manticore `search` path** (that path skips the signature join). |
| `identifiers.orcid` | string \| null | populated on all paths. |
| `identifiers.lattes_id` | string \| null | **always null on the list** — the list SQL selects only `orcid`. |
| `identifiers.scopus_id` | string \| null | **always null on the list.** |
| `identifiers.wikidata_id` | string \| null | **always null on the list.** |
| `identifiers.openalex_id` | string \| null | **always null on the list.** |
| `identifiers.url` | string \| null | **always null on the list.** |
| `is_verified` | boolean | verification flag. |
| `metrics.works_count` | integer | from `persons.total_works`. |
| `metrics.latest_publication_year` | integer \| null | |

**meta**

| field | notes |
|---|---|
| `meta.engine` | `MariaDB` (list / signature / verified) or `Manticore` (search/q). |
| `meta.query_type` | `list` \| `signature_lookup` \| `search`. |
| `meta.elapsed_ms` | present on MariaDB paths; **absent on the Manticore search path**. |
| `meta.request` | `{ method, path }`. |
| `meta.pagination_extras.offset` | echoes the effective offset. |

**Notes / caveats**

- To get the full identifier set (lattes, scopus, wikidata, openalex, url), fetch the detail endpoint `GET /persons/{id}` — the list truncates identifiers to `orcid`.
- Counts are exact; no `pagination_total_exact` flag and no page under-fill on this endpoint.
- `signature` matches the stored **uppercase** normalized form as a prefix. `search`/`q` are morphology-free (unstemmed) name matching.

---

## `GET /persons/{id}`

Full researcher profile: metrics, all identifiers, primary affiliation, an authorship profile, subject expertise, top collaborators, and recent works. MariaDB only; no query params.

**Path parameters**

| param | type | notes |
|---|---|---|
| `id` | integer ≥ 1 | person id. Non-existent → **404 NOT_FOUND**. |

**Example requests**

```
GET /persons/3589585
GET /persons/10592611
```

**Example response** (`GET /persons/3589585`, arrays trimmed)

```json
{
  "status": "success",
  "data": {
    "id": 3589585,
    "_links": { "self": "/persons/3589585" },
    "preferred_name": "John C Campbell",
    "given_names": "John C",
    "family_name": "Campbell",
    "name_variations": [],
    "name_signature": "CAMPBELL J C",
    "identifiers": {
      "orcid": null, "lattes_id": null, "scopus_id": null,
      "wikidata_id": null, "openalex_id": null, "url": null
    },
    "is_verified": false,
    "metrics": { "works_count": 1244, "latest_publication_year": 2025 },
    "primary_affiliation": {
      "id": 3775465,
      "name": "Senior Research Fellow, Council on Foreign Relations",
      "type": "INSTITUTE",
      "country_code": null,
      "_links": { "self": "/institutions/3775465" }
    },
    "authorship_profile": {
      "works_count": 1244,
      "author_count": 1244,
      "editor_count": 0,
      "total_citations": 4845,
      "open_access_works": null,
      "first_publication_year": 1922,
      "latest_publication_year": 2025,
      "h_index": 26
    },
    "subject_expertise": [
      { "subject_id": 341907, "term": "Political science", "vocabulary": "Keyword", "works_count": 1224 }
    ],
    "top_collaborators": [
      { "person_id": 3626952, "preferred_name": "John Creighton Campbell", "shared_works_count": 13 }
    ],
    "recent_works": [
      {
        "id": 21454979,
        "title": "The effects of implicit bias interventions on mock jurors' civil trial decisions and perceptions of the courts",
        "subtitle": null,
        "type": "ARTICLE",
        "language": "en",
        "publication_year": 2025,
        "doi": "10.1037/lhb0000610",
        "open_access": false,
        "role": "AUTHOR",
        "position": 4,
        "venue": {
          "id": 1023027,
          "name": "Law and Human Behavior",
          "abbreviated_name": "Law Hum. Behav.",
          "type": "JOURNAL"
        }
      }
    ],
    "created_at": "2025-11-14T23:10:42.000Z",
    "updated_at": "2026-07-22T05:54:41.000Z"
  },
  "meta": { "request": { "method": "GET", "path": "/persons/3589585" } }
}
```

**Fields** (detail root)

| field (dot-path) | type | notes |
|---|---|---|
| `id` | integer | |
| `_links.self` | string | `/persons/{id}`. |
| `preferred_name` | string \| null | |
| `given_names` | string \| null | |
| `family_name` | string \| null | |
| `name_variations` | string[] | **always `[]`** — the DTO passes an empty array; no source column is read. |
| `name_signature` | string \| null | from the `signatures` join. |
| `is_verified` | boolean | |
| `created_at` | string (ISO date-time) | |
| `updated_at` | string (ISO date-time) | |

**`identifiers` block** (detail selects `persons.*`, so all six may populate)

| field | type | notes |
|---|---|---|
| `identifiers.orcid` | string \| null | ORCID iD. |
| `identifiers.lattes_id` | string \| null | Lattes (Brazilian CV) id. |
| `identifiers.scopus_id` | string \| null | |
| `identifiers.wikidata_id` | string \| null | |
| `identifiers.openalex_id` | string \| null | |
| `identifiers.url` | string \| null | homepage/profile URL. |

**`metrics` block** (stored `persons` columns)

| field | type | notes |
|---|---|---|
| `metrics.works_count` | integer | = `persons.total_works`. |
| `metrics.latest_publication_year` | integer \| null | |

**`primary_affiliation`** (object \| null — most-frequently-affiliated org; null when the person has no affiliation)

| field | type | notes |
|---|---|---|
| `primary_affiliation.id` | integer | organization id. |
| `primary_affiliation.name` | string | org name (may be a raw affiliation string, e.g. "Senior Research Fellow, …"). |
| `primary_affiliation.type` | string | org type: `UNIVERSITY \| INSTITUTE \| PUBLISHER \| FUNDER \| COMPANY \| OTHER`. |
| `primary_affiliation.country_code` | string \| null | ISO-2, often null. |
| `primary_affiliation._links.self` | string | `/institutions/{id}`. |

This is **not** the full [institution](./institutions.md) schema — it is a compact stub; fetch `/institutions/{id}` for the rest.

**`authorship_profile` block** (derived from `authorships` + stored metrics)

| field | type | notes |
|---|---|---|
| `authorship_profile.works_count` | integer | distinct works authored/edited. |
| `authorship_profile.author_count` | integer | distinct works with role `AUTHOR`. |
| `authorship_profile.editor_count` | integer | distinct works with role `EDITOR`. |
| `authorship_profile.total_citations` | integer \| null | from `persons.total_citations`. |
| `authorship_profile.open_access_works` | integer \| null | **always null** (hardcoded; not computed). |
| `authorship_profile.first_publication_year` | integer \| null | earliest publication year across the corpus. |
| `authorship_profile.latest_publication_year` | integer \| null | latest publication year. |
| `authorship_profile.h_index` | integer \| null | from `persons.h_index`. |

**`subject_expertise[]`** — top 10 subjects by works_count (from `work_subjects` + `subjects`)

| field | type | notes |
|---|---|---|
| `subject_expertise[].subject_id` | integer | |
| `subject_expertise[].term` | string | subject term. |
| `subject_expertise[].vocabulary` | string | e.g. `Keyword`, `OpenAlex`, `Scopus`, `OpenLibrary`. The same conceptual subject can appear under multiple vocabularies (e.g. "Law" as both OpenAlex and Scopus). |
| `subject_expertise[].works_count` | integer | works of this person tagged with the subject. |

**`top_collaborators[]`** — top 10 by shared works (authorship co-occurrence)

| field | type | notes |
|---|---|---|
| `top_collaborators[].person_id` | integer | collaborator id → `/persons/{id}`. |
| `top_collaborators[].preferred_name` | string | |
| `top_collaborators[].shared_works_count` | integer | works co-authored with this person. |

**`recent_works[]`** — up to 10 most recent works

| field | type | notes |
|---|---|---|
| `recent_works[].id` | integer | work id → `/works/{id}`. |
| `recent_works[].title` | string \| null | |
| `recent_works[].subtitle` | string \| null | |
| `recent_works[].type` | string \| null | publication type of the latest publication: `ARTICLE \| BOOK \| CHAPTER \| THESIS \| CONFERENCE \| CONFERENCE_PAPER \| REPORT \| DATASET \| PREPRINT \| REVIEW \| EDITORIAL \| OTHER`. |
| `recent_works[].language` | string \| null | ISO 639-1. |
| `recent_works[].publication_year` | integer \| null | keyed `publication_year` (not `year`). |
| `recent_works[].doi` | string \| null | |
| `recent_works[].open_access` | boolean | |
| `recent_works[].role` | string \| null | `AUTHOR` \| `EDITOR`. |
| `recent_works[].position` | integer \| null | author position on the work. |
| `recent_works[].venue` | object \| null | `{ id, name, abbreviated_name, type }`; `type` ∈ `JOURNAL \| CONFERENCE \| REPOSITORY \| BOOK_SERIES \| SOURCE_BOOK \| OTHER`. |

**Notes / caveats**

- 404 when the id does not exist: `{ status:"error", code:"NOT_FOUND", message:"Person with ID … not found", meta:{ id, request } }`.
- `meta` carries only `request` (no engine/pagination on detail).
- For the full paginated works list use `/persons/{id}/works`; `recent_works` is a fixed 10-item preview.

---

## `GET /persons/{id}/works`

Works authored or edited by a person, paginated. Honours the **shared work sort/citation-filter contract** (see [../00-conventions.md](../00-conventions.md)) plus person-specific `role`/`year_from`/`year_to`. Rate-limited by `relationalLimiter`. Counts are exact.

**Path parameters**

| param | type | notes |
|---|---|---|
| `id` | integer ≥ 1 | person id. Non-existent → **404** (service returns null → controller 404). |

**Query parameters**

| param | type | default | accepted values / bounds | effect |
|---|---|---|---|---|
| `page` | integer | 1 | ≥ 1 | |
| `limit` | integer | 20 | 1..100 | |
| `offset` | integer | — | ≥ 0 | alternative to `page`. |
| `role` | string | — | `AUTHOR` \| `EDITOR` (case-insensitive, upper-cased) | filter by authorship role. `role=EDITOR` on an author-only person → total 0. |
| `year_from` | integer | — | ≥ 1000 | inclusive lower bound on publication year. |
| `year_to` | integer | — | ≥ 1000 | inclusive upper bound. |
| `cited_by_min` | integer | — | ≥ 0 | inclusive lower bound on `cited_by_count` (against `works.citation_count`). Alias `citation_count_min`. |
| `cited_by_max` | integer | — | ≥ 0 | inclusive upper bound. Alias `citation_count_max`. |
| `sort_by` | string | `publication_year` | `cited_by_count`, `references_count`, `publication_year` (+ aliases `citation_count`, `reference_count`, `year`) | primary sort key. Invalid value → **400 VALIDATION_ERROR**. |
| `sort_order` | string | `DESC` | `ASC` \| `DESC` (case-insensitive) | sort direction. |

**Example requests**

```
GET /persons/3589585/works?limit=20
GET /persons/3589585/works?sort_by=cited_by_count&sort_order=DESC&limit=20
GET /persons/3589585/works?role=AUTHOR&year_from=2000&year_to=2020
GET /persons/3589585/works?cited_by_min=100&sort_by=cited_by_count
```

**Example response** (`GET /persons/3589585/works?limit=2&sort_by=cited_by_count`, one element)

```json
{
  "status": "success",
  "data": [
    {
      "id": 9825438,
      "title": "The Expansion of International Society",
      "subtitle": null,
      "abstract": "The work of a study group of distinguished scholars, this book is a systematic investigation of the origins and nature of the international society today. ... (truncated)",
      "type": "ARTICLE",
      "language": "en",
      "doi": "10.2307/20042191",
      "publication_year": 1984,
      "open_access": false,
      "cited_by_count": 201,
      "references_count": 0,
      "authorship": { "role": "AUTHOR", "position": 1, "is_corresponding": false },
      "publication": {
        "year": 1984,
        "journal": "Foreign Affairs",
        "volume": "63",
        "issue": "2",
        "pages": "411",
        "open_access": false
      },
      "authors": {
        "total_count": 3,
        "author_string": "John C Campbell; Hedley Bull; Adam Watson"
      },
      "created_at": "2026-04-08T04:20:07.000Z"
    }
  ],
  "pagination": {
    "page": 1, "limit": 2, "total": 1244,
    "totalPages": 622, "hasNext": true, "hasPrev": false
  },
  "meta": {
    "request": { "method": "GET", "path": "/persons/3589585/works?limit=2&sort_by=cited_by_count" },
    "pagination_extras": { "offset": 0 }
  }
}
```

**Fields** (work row)

| field (dot-path) | type | notes |
|---|---|---|
| `id` | integer | work id → `/works/{id}`. |
| `title` | string \| null | |
| `subtitle` | string \| null | |
| `abstract` | string \| null | full abstract text (can be long). |
| `type` | string \| null | type of the latest publication (see enum above). |
| `language` | string \| null | ISO 639-1. |
| `doi` | string \| null | |
| `publication_year` | integer \| null | top-level year, keyed `publication_year`. |
| `open_access` | boolean | top-level OA flag. |
| `cited_by_count` | integer | from `works.citation_count`; present on every row. |
| `references_count` | integer | from `works.reference_count`. |
| `authorship.role` | string | `AUTHOR` \| `EDITOR` — this person's role on the work. |
| `authorship.position` | integer \| null | this person's author position. |
| `authorship.is_corresponding` | boolean | corresponding-author flag. |
| `publication.year` | integer \| null | year of the displayed publication. |
| `publication.journal` | string \| null | venue name. |
| `publication.volume` | string \| null | |
| `publication.issue` | string \| null | |
| `publication.pages` | string \| null | |
| `publication.open_access` | boolean | OA flag of the displayed publication. |
| `authors.total_count` | integer | total authorship rows on the work. |
| `authors.author_string` | string \| null | `; `-joined author display names (all authors, not just this person). |
| `created_at` | string (ISO date-time) | work record creation timestamp. |

**Notes / caveats**

- Both `abstract` and the top-level `publication_year`/`open_access` are real response fields (they were absent from older swagger; the live response is authoritative).
- Sort verified DESC on a productive person: `cited_by_count` → 201, 122, 93… With `sort_by` omitted, order falls back to `publication_year DESC`.
- 404 for non-existent person id (same envelope as `/persons/{id}`).
- Counts are exact; no degradation flag on this endpoint.

---

## `GET /persons/{id}/signatures`

Name signatures linked to a person (via `persons.signature_id` → `signatures`). A person has **0 or 1** signature, so `data` is typically ≤ 1 row. Rate-limited by `relationalLimiter`.

**Path parameters**

| param | type | notes |
|---|---|---|
| `id` | integer ≥ 1 | person id. Non-existent → **404**. |

**Query parameters**: `page`, `limit` (1..100, default 10), `offset` only — standard pagination.

**Example requests**

```
GET /persons/3589585/signatures
GET /persons/10592611/signatures?limit=10
```

**Example response** (`GET /persons/3589585/signatures`)

```json
{
  "status": "success",
  "data": [
    {
      "id": 32492,
      "signature": "CAMPBELL J C",
      "created_at": "2025-11-16T18:30:27.000Z",
      "persons_count": 9
    }
  ],
  "pagination": {
    "page": 1, "limit": 10, "total": 1,
    "totalPages": 1, "hasNext": false, "hasPrev": false
  },
  "meta": {
    "request": { "method": "GET", "path": "/persons/3589585/signatures" },
    "pagination_extras": { "offset": 0 }
  }
}
```

**Fields**

| field (dot-path) | type | notes |
|---|---|---|
| `id` | integer | signature id → `/signatures/{id}` (see [signatures](./signatures.md)). |
| `signature` | string | normalized signature text (uppercase form, e.g. `CAMPBELL J C`). |
| `created_at` | string (ISO date-time) | |
| `persons_count` | integer | number of distinct persons sharing this signature (disambiguation fan-out; here 9 people share `CAMPBELL J C`). |

**Notes / caveats**

- Default `limit` is **10** (unlike the 20-default elsewhere), but a person rarely has more than one signature, so pagination is effectively cosmetic.
- 404 for non-existent person id.
- The signature's `persons_count` is a useful UI signal that the name is ambiguous across multiple person records.

---

## Cross-links

- Works by a person: `GET /persons/{id}/works` → each row links to [works](./works.md).
- Primary affiliation → [institutions](./institutions.md) (`/institutions/{id}`).
- Signature detail and shared-signature clusters → [signatures](./signatures.md).
- Collaborator graph: `GET /persons/{id}/collaborators` and `GET /persons/{id}/network` are documented in [collaborations](./collaborations.md) (wired in that domain, not in `src/routes/persons.js`).
- Known limitations (list `affiliation`/`country` no-ops, `authorship_profile.open_access_works` always null, `name_variations` always `[]`): [../API_ISSUES.md](../API_ISSUES.md).
