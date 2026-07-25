# Publications — per-publication instances of works, DOI resolution

The publications domain exposes individual *published instances* of a work: one row per `publications` record (`publications.id`), carrying its own DOI, venue, publisher, dates, identifiers, files and citation counts. A single [work](./works.md) is a multi-manifestation record and may own several publications (e.g. a PREPRINT and an ARTICLE), which appear as `siblings` of one another. The read path is backed by `publications p INNER JOIN works w LEFT JOIN venues v LEFT JOIN organizations publisher`. Full-text filters (`q`, `author`, `subject`) resolve matching work ids through **Manticore** and then filter `p.work_id IN (…)`; the `venue` substring filter resolves through MariaDB `ft_venues_search`; every other filter hits a B-tree index directly. Corpus scale is roughly 6.75M publications.

This chapter assumes you have read [../00-conventions.md](../00-conventions.md) for the response envelope, `page`/`limit` + `offset`/`limit` pagination, auth/rate-limit rules, error codes, automatic boolean/date normalization, and the shared `meta` flags and citation/sort query params. Related: [./works.md](./works.md) (the parent entity), [./venues.md](./venues.md), [./institutions.md](./institutions.md) (publishers are `organizations`).

---

## `GET /publications`

List publications, paginated. No auth. Engine is `"MariaDB"` for structured filters and `"Manticore"` whenever a full-text term (`q`/`author`/`subject`) participates. Implemented as **paginate-then-hydrate**: a page of `p.id` is selected first (joining `works` only when a `w.` column is referenced), then full rows are hydrated for those ids.

### Query parameters

| param | type | default | accepted values / bounds | effect |
|---|---|---|---|---|
| `page` | integer | 1 | ≥ 1 | 1-based page. |
| `limit` | integer | 20 | 1..100 (400 outside) | rows per page. |
| `offset` | integer | 0 | ≥ 0 | 0-based skip; alternative to `page`. `pagination.page` is recomputed from it; echoed in `meta.pagination_extras.offset`. |
| `q` | string | — | 1..200 chars | Manticore full-text over the parent work's title + subtitle + abstract + authors + subjects + venue. Sets `meta.engine="Manticore"`, exact total. |
| `type` | string | — | `ARTICLE`, `BOOK`, `CHAPTER`, `THESIS`, `CONFERENCE`, `CONFERENCE_PAPER`, `REPORT`, `DATASET`, `PREPRINT`, `REVIEW`, `EDITORIAL`, `OTHER` | exact `p.type`. Count exceeds the 2s budget → total is a non-exact whole-corpus estimate (see Notes). |
| `language` | string | — | 2..5 chars, ISO 639-1 | `w.language = ?`. |
| `year_from` | integer | — | ≥ 1000 | inclusive `p.year >= ?`. |
| `year_to` | integer | — | ≥ 1000 | inclusive `p.year <= ?`. |
| `open_access` | boolean | — | `1/0/true/false` | `p.open_access`. |
| `peer_reviewed` | boolean | — | `1/0/true/false` | `p.peer_reviewed`. |
| `has_files` | boolean | — | `1/0/true/false` | `EXISTS`/`NOT EXISTS` on `files`. **Combine with a selective filter** — a standalone `has_files=true` can exceed the statement budget and 503 (see Notes / [../API_ISSUES.md](../API_ISSUES.md)). |
| `venue` | string | — | ≤ 255 chars | boolean-mode MATCH against MariaDB `ft_venues_search` (venue name + abbreviated name); flips the venue join to INNER. The only text predicate that runs in MariaDB. |
| `venue_id` | integer | — | ≥ 1 | exact `p.venue_id`. Fast, exact total. |
| `publisher_id` | integer | — | ≥ 1 | exact `p.publisher_id`. |
| `work_id` | integer | — | ≥ 1 | restrict to the publications of one work (its siblings). |
| `doi` | string | — | ≤ 255 chars | exact DOI lookup (normalized + prefixed variants). |
| `author` | string | — | ≤ 255 chars | Manticore `@authors`; AND semantics across tokens. Sets `engine="Manticore"`. |
| `subject` | string | — | ≤ 255 chars | Manticore `@subjects`. |

Plus the shared citation/sort params (see [../00-conventions.md](../00-conventions.md)): `cited_by_min` / `cited_by_max` (aliases `citation_count_min` / `citation_count_max`), `sort_by`, `sort_order` (aliases `sortBy` / `sortOrder`). Domain specifics:

- `cited_by_min` / `cited_by_max` are inclusive bounds on the indexed denormalized `p.citation_count` (min 0). They return an **exact** total, quickly.
- `sort_by` accepted values: `cited_by_count`, `citation_count`, `references_count`, `reference_count`, `publication_year`, `year`, `id`, `publication_id`, `relevance`. Aliases collapse: `citation_count`→`cited_by_count`, `reference_count`→`references_count`, `year`→`publication_year`, `publication_id`→`id`.
- Sort resolution: `cited_by_count` → `p.citation_count <dir>, p.id <dir>`; `references_count` → `p.reference_count <dir>, p.id <dir>`; `publication_year` → `p.year <dir>, p.id DESC`; `id` → `p.id <dir>`.
- **`sort_by=relevance` is a no-op here** — it falls back to `p.id DESC`. Publications are never ordered by full-text relevance, even when `q` is set.
- Default order (no `sort_by`): `p.id DESC` (newest publication id first).
- `sort_order`: `ASC`/`DESC`, case-insensitive, default `DESC`.

### Example requests

```
GET /publications?limit=20
GET /publications?q=ritual&limit=20
GET /publications?sort_by=cited_by_count&sort_order=DESC&limit=10
GET /publications?type=ARTICLE&year_from=2015&year_to=2020&open_access=true
GET /publications?venue_id=1012121&sort_by=publication_year
GET /publications?cited_by_min=50&limit=20
GET /publications?work_id=22519667          # the siblings of one work
GET /publications?author=silva&subject=ritual
```

### Example response (`GET /publications?limit=2`)

```json
{
  "status": "success",
  "data": [
    {
      "id": 1127609346,
      "work_id": 22519667,
      "doi": "10.1086/742191",
      "title": "Theological Possibilities and the Anthropology of Eastern Orthodox Christianity",
      "abstract": null,
      "type": "ARTICLE",
      "language": "en",
      "publication_year": 2026,
      "publication_date": "2026-07-22T00:00:00.000Z",
      "volume": null,
      "issue": null,
      "pages": "000-000",
      "source": "crossref",
      "license_url": null,
      "license_version": null,
      "open_access": false,
      "peer_reviewed": true,
      "has_files": false,
      "has_scimag_file": false,
      "has_libgen_file": false,
      "venue": {
        "id": 1012159,
        "name": "Journal of Anthropological Research",
        "abbreviated_name": "J. Anthropol. Res.",
        "type": "JOURNAL",
        "issn": "0091-7710",
        "eissn": "2153-3806",
        "scopus_id": "37322",
        "wikidata_id": "Q15750490",
        "openalex_id": "S30381306"
      },
      "publisher": {
        "id": 2741923,
        "name": "University of Chicago Press",
        "type": "PUBLISHER",
        "country": "US",
        "ror_id": null,
        "wikidata_id": "Q1814982",
        "openalex_id": "P4310315672",
        "url": "https://www.press.uchicago.edu"
      },
      "identifiers": {
        "doi": "10.1086/742191",
        "pmid": null,
        "pmcid": null,
        "arxiv": null,
        "wos_id": null,
        "handle": null,
        "wikidata_id": null,
        "openalex_id": null,
        "isbn": null,
        "openlibrary_id": null,
        "scielo_pid": null,
        "google_book_id": null
      },
      "first_author": { "person_id": 3892437, "name": "Sarah Riccardi-Swartz" },
      "author_count": 1,
      "citation_count": 0,
      "reference_count": 0,
      "download_count": 0
    }
    // ... (2 total)
  ],
  "pagination": {
    "page": 1,
    "limit": 2,
    "total": 6756567,
    "totalPages": 3378284,
    "hasNext": true,
    "hasPrev": false
  },
  "meta": {
    "engine": "MariaDB",
    "pagination_total_exact": false,
    "elapsed_ms": 2,
    "request": { "method": "GET", "path": "/publications?limit=2" },
    "pagination_extras": { "offset": 0 }
  }
}
```

For a full-text query, `meta` looks like: `{"engine":"Manticore","pagination_total_exact":true,"fulltext_truncated":true,"fulltext_work_cap":5000,"elapsed_ms":30,...}` and `pagination.total` is the real match count (e.g. `q=ritual` → 4626).

### Fields — list item

| field | type | notes |
|---|---|---|
| `id` | int | `publications.id` — the publication id (NOT the work id). Navigate to `/publications/{id}`. |
| `work_id` | int | parent work id → `/works/{work_id}`. |
| `doi` | string \| null | canonical DOI of this publication. |
| `title` | string \| null | parent work title. |
| `abstract` | string \| null | parent work abstract (long text; frequently null). |
| `type` | string \| null | publication type enum (see `type` param list). Uppercased. |
| `language` | string \| null | ISO 639-1 from `works.language`. |
| `publication_year` | int \| null | generated `p.year`. |
| `publication_date` | ISO datetime \| null | |
| `volume` | string \| null | |
| `issue` | string \| null | |
| `pages` | string \| null | e.g. `"77-101"`, `"000-000"`. |
| `source` | string \| null | provenance, e.g. `"crossref"`, `"openalex"`. |
| `license_url` | string \| null | may hold a license **code** rather than a URL (e.g. `"cc-by"`, `"other-oa"`). Do not assume it is a hyperlink. |
| `license_version` | string \| null | e.g. `"vor"`, `"publishedVersion"`, `"unspecified"`. |
| `open_access` | bool \| null | |
| `peer_reviewed` | bool \| null | |
| `has_files` | bool | derived live from the `files` table for the page ids. |
| `has_scimag_file` | bool | any attached file with a non-null `scimag_id`. |
| `has_libgen_file` | bool | any attached file with a non-null `libgen_id`. |
| `venue` | object \| null | see venue sub-table. |
| `publisher` | object \| null | null when there is no publisher; see publisher sub-table. |
| `identifiers` | object | 12 keys, all string \| null — see identifiers sub-table. |
| `first_author` | object \| null | `{ person_id: int, name: string }`; null if the work has no hydrated author. |
| `author_count` | int | count of hydrated authorships on the work. |
| `citation_count` | int | parent work incoming-citation count (default 0). |
| `reference_count` | int | parent work outgoing-reference count (default 0). |
| `download_count` | int | this publication's download count (default 0). |

**`venue` block** (also used verbatim on detail and on `siblings[]`):

| field | type | notes |
|---|---|---|
| `venue.id` | int \| null | `venues.id`. |
| `venue.name` | string \| null | |
| `venue.abbreviated_name` | string \| null | always paired with `name`. |
| `venue.type` | string \| null | `JOURNAL`, `CONFERENCE`, `REPOSITORY`, `BOOK_SERIES`, `SOURCE_BOOK`, `OTHER`, or null. |
| `venue.issn` | string \| null | |
| `venue.eissn` | string \| null | |
| `venue.scopus_id` | string \| null | |
| `venue.wikidata_id` | string \| null | |
| `venue.openalex_id` | string \| null | |

**`publisher` block** (from `organizations`):

| field | type | notes |
|---|---|---|
| `publisher.id` | int \| null | `organizations.id`. |
| `publisher.name` | string | |
| `publisher.type` | string \| null | e.g. `PUBLISHER`. |
| `publisher.country` | string \| null | ISO-2 (`organizations.country_code`). |
| `publisher.ror_id` | string \| null | |
| `publisher.wikidata_id` | string \| null | |
| `publisher.openalex_id` | string \| null | |
| `publisher.url` | string \| null | |

**`identifiers` block** (same 12 keys on list and detail):

| field | type | notes |
|---|---|---|
| `identifiers.doi` | string \| null | |
| `identifiers.pmid` | string \| null | filled from `external_ids` JSON if the column is null. |
| `identifiers.pmcid` | string \| null | filled from `external_ids` JSON if the column is null. |
| `identifiers.arxiv` | string \| null | |
| `identifiers.wos_id` | string \| null | |
| `identifiers.handle` | string \| null | |
| `identifiers.wikidata_id` | string \| null | |
| `identifiers.openalex_id` | string \| null | |
| `identifiers.isbn` | string \| null | |
| `identifiers.openlibrary_id` | string \| null | |
| `identifiers.scielo_pid` | string \| null | |
| `identifiers.google_book_id` | string \| null | |

### Notes / caveats

- **`pagination.total` reliability is gated by `meta.pagination_total_exact`.** When `false` (e.g. `type=ARTICLE`, `year_from`/`year_to` — count exceeds the 2s budget, `elapsed_ms` ≈ 2000), `total` is the **whole-corpus estimate 6,756,567**, not the filtered subset — it is meaningless for that query. Do not display it; use `data.length < limit` (or `pagination.hasNext`) as the last-page terminator. Exact-total paths: `q`/`author`/`subject` (Manticore), `cited_by_min`/`cited_by_max`, `venue_id`, and the default no-filter listing all set `pagination_total_exact: true` and return real counts.
- **`meta.fulltext_truncated` + `meta.fulltext_work_cap`** appear when a full-text term matched more than 5000 work ids (`MANTICORE_PUBLICATIONS_WORK_CAP`); the id set is truncated to the cap. `meta.page_degraded` appears (with `pagination_total_exact:false`) if the id-selection budget fires — the page degrades to empty rather than 503 on the common sorts.
- **`has_files=true` standalone can 503** (`REQUEST_TIMEOUT` after ~5s): the `EXISTS(files)` id-selection scans publications id-descending and exceeds the statement budget without tripping the graceful degrade path. Always pair it with a selective filter (`venue_id`, `q`, a year range). Tracked in [../API_ISSUES.md](../API_ISSUES.md).
- `engine` is `"Manticore"` iff a full-text term (`q`/`author`/`subject`) participates; the `venue` substring filter and all structured filters keep `engine:"MariaDB"`.
- Invalid `sort_by`, `limit` out of 1..100, etc. → 400 `VALIDATION_ERROR` with the express-validator `errors[]` array (`{type,value,msg,path,location}`).

---

## `GET /publications/{id}`

Fetch one publication with its parent `work` block, `siblings[]`, live `files[]`, and (default on) incoming `citations` and outgoing `references`. No auth.

### Path parameters

| param | type | notes |
|---|---|---|
| `id` | integer ≥ 1 | `publications.id`. Non-integer → 400; unknown id → 404. |

### Query parameters

| param | type | default | accepted values | effect |
|---|---|---|---|---|
| `include_citations` | boolean | `true` | `1/0/true/false` | when `false`, `data.citations` is `null` (key present, not `[]`). |
| `include_references` | boolean | `true` | `1/0/true/false` | when `false`, `data.references` is `null` (key present). |

### Example requests

```
GET /publications/1127609346
GET /publications/1112638398                                  # a publication with files
GET /publications/1127609346?include_citations=false&include_references=false
```

### Example response (`GET /publications/1127609346`, trimmed)

```json
{
  "status": "success",
  "data": {
    "id": 1127609346,
    "identifiers": {
      "doi": "10.1086/742191",
      "pmid": null, "pmcid": null, "arxiv": null, "wos_id": null,
      "handle": null, "wikidata_id": null, "openalex_id": null,
      "isbn": null, "openlibrary_id": null, "scielo_pid": null, "google_book_id": null
    },
    "publication_date": "2026-07-22T00:00:00.000Z",
    "publication_year": 2026,
    "volume": null,
    "issue": null,
    "pages": "000-000",
    "language": "en",
    "open_access": false,
    "peer_reviewed": true,
    "has_files": false,
    "has_scimag_file": false,
    "has_libgen_file": false,
    "download_count": 0,
    "license_url": null,
    "license_version": null,
    "source": "crossref",
    "source_indexed_at": null,
    "venue": {
      "id": 1012159, "name": "Journal of Anthropological Research",
      "abbreviated_name": "J. Anthropol. Res.", "type": "JOURNAL",
      "issn": "0091-7710", "eissn": "2153-3806", "scopus_id": "37322",
      "wikidata_id": "Q15750490", "openalex_id": "S30381306"
    },
    "publisher": {
      "id": 2741923, "name": "University of Chicago Press", "type": "PUBLISHER",
      "country": "US", "ror_id": null, "wikidata_id": "Q1814982",
      "openalex_id": "P4310315672", "url": "https://www.press.uchicago.edu"
    },
    "files": [
      {
        "file_id": 11801719,
        "md5": "341d4d7672abb40664a0d6d57a35a78e",
        "format": "PDF",
        "size": 361257,
        "pages": null,
        "language": null,
        "version": null,
        "role": "MAIN",
        "libgen_id": null,
        "scimag_id": 18666132,
        "openacess_id": null,
        "best_oa_url": null,
        "verification": "PENDING",
        "download_count": 0
      }
      // ... (files ordered role MAIN>SUPPLEMENT>COVER>PREVIEW then id; cap 200)
    ],
    "work": {
      "id": 22519667,
      "title": "Theological Possibilities and the Anthropology of Eastern Orthodox Christianity",
      "subtitle": null,
      "abstract": null,
      "type": "ARTICLE",
      "language": "en",
      "citation_count": 0,
      "reference_count": 0,
      "authors": [
        {
          "person_id": 3892437,
          "preferred_name": "Sarah Riccardi-Swartz",
          "role": "AUTHOR",
          "position": 1,
          "is_corresponding": false
        }
      ],
      "subjects": []
    },
    "siblings": [
      {
        "id": 1125243905,
        "doi": "10.1080/01419870.2018.1410200",
        "publication_year": 2018,
        "publication_date": "2018-05-03T00:00:00.000Z",
        "volume": "41",
        "issue": "6",
        "pages": "1131-1145",
        "open_access": false,
        "peer_reviewed": true,
        "has_files": true,
        "venue": {
          "id": 1012141, "name": "Ethnic and Racial Studies",
          "abbreviated_name": "Ethn. Racial Stud.", "type": null,
          "issn": null, "eissn": null, "scopus_id": null,
          "wikidata_id": null, "openalex_id": null
        },
        "_links": { "self": "/publications/1125243905" }
      }
      // ... (cap 50; usually [] — most works have exactly one publication)
    ],
    "citations": [
      {
        "work_id": 22479148,
        "title": "Insights of Vietnamese American Women on Cervical Cancer Screening",
        "type": "ARTICLE",
        "year": 2026,
        "venue_name": "Journal of Racial and Ethnic Health Disparities",
        "venue_abbreviated_name": "J. Racial Ethn. Heal. Disparities",
        "doi": "10.1007/s40615-026-03114-8",
        "authors": "Minh Tung Phung; Rachel Sunny Inyangetuk; ...",
        "authors_count": 7,
        "open_access": true,
        "citation_type": "NEUTRAL",
        "citation_status": "RESOLVED",
        "citation_context": null
      }
      // ... (cap 100)
    ],
    "references": {
      "resolved": [
        {
          "work_id": 20385366,
          "title": "Church-State Symphonia",
          "type": "ARTICLE",
          "year": 2020,
          "venue_name": "Journal of Law and Religion",
          "venue_abbreviated_name": "J. Law Relig.",
          "doi": "10.1017/jlr.2020.38",
          "authors": "Mikhaïl Antonov",
          "authors_count": 1,
          "open_access": true,
          "citation_type": "NEUTRAL",
          "citation_status": null,
          "citation_context": null
        }
        // ... (cap 100)
      ],
      "unresolved": [
        {
          "cited_doi": "10.1093/oso/9780198797852.003.0013",
          "status": "PENDING",
          "citation_type": "NEUTRAL",
          "created_at": "2026-07-23T03:25:16.000Z",
          "resolved_at": null
        }
        // ... (cap 100)
      ]
    },
    "created_at": "2026-07-23T03:25:16.000Z",
    "updated_at": "2026-07-23T03:57:38.000Z"
  }
}
```

### Fields — detail top level

`identifiers`, `venue`, and `publisher` are identical to the list blocks above. Additional top-level fields:

| field | type | notes |
|---|---|---|
| `id` | int | `publications.id`. |
| `publication_date` | ISO datetime \| null | |
| `publication_year` | int \| null | |
| `volume` / `issue` / `pages` | string \| null | |
| `language` | string \| null | |
| `open_access` / `peer_reviewed` | bool \| null | |
| `has_files` / `has_scimag_file` / `has_libgen_file` | bool | recomputed live from the `files` JOIN (cap 200). |
| `download_count` | int | default 0. |
| `license_url` | string \| null | may be a license code, not a URL. |
| `license_version` | string \| null | |
| `source` | string \| null | |
| `source_indexed_at` | ISO datetime \| null | **detail-only** (not on list items). |
| `venue` | object \| null | 9-key block (see list). |
| `publisher` | object \| null | 8-key block (see list). |
| `files[]` | array | live from `files`, cap 200, ordered role `MAIN > SUPPLEMENT > COVER > PREVIEW` then id. |
| `work` | object | parent work block (see below). |
| `siblings[]` | array | other publications of the same work; cap 50; usually empty. |
| `citations` | array \| null | incoming citations (works citing this one); cap 100; `[]` if none; `null` when `include_citations=false`. |
| `references` | object \| null | outgoing references `{resolved[], unresolved[]}`; `null` when `include_references=false`. |
| `created_at` | ISO datetime \| null | `publications.created_at`. |
| `updated_at` | ISO datetime \| null | `publications.updated_at` (falls back to `summary_updated_at`). |

**`files[]` items:**

| field | type | notes |
|---|---|---|
| `files[].file_id` | int | |
| `files[].md5` | string \| null | |
| `files[].format` | string \| null | e.g. `PDF` (uppercased). |
| `files[].size` | number \| null | bytes (`file_size`). |
| `files[].pages` | int \| null | |
| `files[].language` | string \| null | |
| `files[].version` | string \| null | |
| `files[].role` | string | `file_role`; default `MAIN` (also `SUPPLEMENT`/`COVER`/`PREVIEW`). |
| `files[].libgen_id` | int \| null | |
| `files[].scimag_id` | int \| null | |
| `files[].openacess_id` | string \| null | note the spelling `openacess` (no second `c`). |
| `files[].best_oa_url` | string \| null | best open-access URL. |
| `files[].verification` | string \| null | `verification_status`, e.g. `PENDING`, `VERIFIED`. |
| `files[].download_count` | int | default 0. |

**`work` block:**

| field | type | notes |
|---|---|---|
| `work.id` | int | → `/works/{id}`. |
| `work.title` / `subtitle` / `abstract` | string \| null | |
| `work.type` | string \| null | displayed work type. |
| `work.language` | string \| null | |
| `work.citation_count` / `reference_count` | int | default 0. |
| `work.authors[]` | array | `{ person_id, preferred_name, role, position, is_corresponding }`. |
| `work.authors[].role` | string | default `AUTHOR`. |
| `work.authors[].position` | int \| null | author order. |
| `work.authors[].is_corresponding` | bool \| null | |
| `work.subjects[]` | array | `{ subject_id, term, vocabulary, lang }`; `vocabulary` default `KEYWORD`; often empty `[]`. |

**`siblings[]` items** (other publications of the same work):

| field | type | notes |
|---|---|---|
| `siblings[].id` | int | → `/publications/{id}`. |
| `siblings[].doi` | string \| null | |
| `siblings[].publication_year` | int \| null | |
| `siblings[].publication_date` | ISO datetime \| null | |
| `siblings[].volume` / `issue` / `pages` | string \| null | |
| `siblings[].open_access` / `peer_reviewed` / `has_files` | bool | |
| `siblings[].venue` | object \| null | same 9-key venue block. |
| `siblings[]._links.self` | string | `/publications/{id}`. |

**`citations[]` and `references.resolved[]` items** (shared shape — a cited/citing work row):

| field | type | notes |
|---|---|---|
| `work_id` | int | the citing (citations) / cited (references) work id. |
| `title` | string \| null | |
| `type` | string \| null | work type. |
| `year` | int \| null | publication year (keyed `year`, not `publication_year`, in this nested context). |
| `venue_name` | string \| null | |
| `venue_abbreviated_name` | string \| null | always paired with `venue_name`. |
| `doi` | string \| null | |
| `authors` | string \| null | `"; "`-joined author names (not an array). |
| `authors_count` | int | |
| `open_access` | bool \| null | |
| `citation_type` | string | `work_references.citation_type`; default `NEUTRAL`. |
| `citation_status` | string \| null | `RESOLVED` \| `PENDING` \| `FAILED` \| null. |
| `citation_context` | string \| null | always null in current data. |

**`references.unresolved[]` items** (references whose cited work is not yet in the DB):

| field | type | notes |
|---|---|---|
| `cited_doi` | string \| null | the referenced DOI that has no resolved work. |
| `status` | string | `PENDING` \| `FAILED`. `PENDING` is expected, not an error. |
| `citation_type` | string | default `NEUTRAL`. |
| `created_at` | ISO datetime \| null | |
| `resolved_at` | ISO datetime \| null | null while unresolved. |

### Notes / caveats

- **Shape asymmetry:** `citations` is a bare **array**, but `references` is an **object** `{resolved[], unresolved[]}`. Turning either off via `include_*=false` sets it to `null` (the key stays present), not `[]`/`{}`.
- `siblings` is usually `[]` — most works own a single publication. A non-empty `siblings` array indicates a multi-manifestation work; each sibling is directly navigable via `_links.self`.
- Unknown id → **404** `NOT_FOUND`: `{"status":"error","message":"Publication with ID 99999999999 not found","code":"NOT_FOUND","meta":{"id":"99999999999",...}}`. Non-integer id (`/publications/abc`) → **400** `VALIDATION_ERROR`.
- `has_*` flags and `files[]` are recomputed live from the `files` table at request time (capped at 200); on a files-query error the service logs and returns an empty file list rather than failing the request.
- For the work-level aggregated file roll-up, venues roll-up, and per-work metrics, use [`GET /works/{id}`](./works.md) instead — this endpoint is publication-scoped.

---

## `GET /{doi}` (and `/doi.org/{doi}`, `/https://doi.org/{doi}`)

Resolve a DOI directly to its publication. No auth. Wired as a regex route in `src/app.js` (`/^\/((?:https?:\/\/)?doi\.org\/)?(\d{2}\..+)$/`), handled by the same controller path as the detail endpoint — the response is **structurally identical to `GET /publications/{id}`** (same `work`, `siblings`, `files`, `citations`, `references` blocks).

### Path parameter

| param | type | notes |
|---|---|---|
| `doi` | string | a DOI beginning with two digits + `.` (e.g. `10.1086/742191`). The optional `doi.org/` or `https://doi.org/` prefix is stripped before lookup. Resolved against the unique `publications.doi`. |

### Query parameters

Same as detail: `include_citations` (default `true`) and `include_references` (default `true`); `false` sets the respective block to `null`.

### Example requests

```
GET /10.1191/1478088706qp063oa
GET /doi.org/10.1086/742191
GET /https://doi.org/10.1002/fea2.70059
GET /10.1191/1478088706qp063oa?include_citations=false
```

### Example response (`GET /10.1191/1478088706qp063oa`, trimmed)

```json
{
  "status": "success",
  "data": {
    "id": 1112638398,
    "identifiers": {
      "doi": "10.1191/1478088706qp063oa",
      "openalex_id": "W1979290264",
      "pmid": null, "pmcid": null, "arxiv": null, "wos_id": null,
      "handle": null, "wikidata_id": null, "isbn": null,
      "openlibrary_id": null, "scielo_pid": null, "google_book_id": null
    },
    "publication_year": 2006,
    "volume": "3", "issue": "2", "pages": "77-101",
    "language": "en",
    "open_access": true, "peer_reviewed": true,
    "has_files": true, "has_scimag_file": true, "has_libgen_file": false,
    "license_url": "other-oa", "license_version": "publishedVersion",
    "source": "openalex",
    "venue": { "id": 1014042, "name": "Qualitative Research in Psychology", "abbreviated_name": "Qual. Res. Psychol.", "type": "JOURNAL", "issn": "1478-0887", "eissn": "1478-0895", "scopus_id": "5100155099", "wikidata_id": "Q15749868", "openalex_id": "S51001188" },
    "publisher": { "id": 693664, "name": "Taylor & Francis", "type": "PUBLISHER", "country": "GB", "ror_id": null, "wikidata_id": "Q880582", "openalex_id": "P4310320547", "url": "https://www.taylorfrancis.com" },
    "files": [ /* same shape as detail */ ],
    "work": { "id": 7539537, "title": "Using thematic analysis in psychology", "citation_count": 21493, "reference_count": 11, "authors": [ /* ... */ ], "subjects": [] },
    "siblings": [],
    "citations": [ /* ... */ ],
    "references": { "resolved": [ /* ... */ ], "unresolved": [ /* ... */ ] },
    "created_at": "...",
    "updated_at": "..."
  }
}
```

### Fields

Identical to [`GET /publications/{id}`](#get-publicationsid) — see that field inventory in full.

### Notes / caveats

- Unknown DOI → **404** `NOT_FOUND`: `{"status":"error","message":"Publication not found for the given DOI","code":"NOT_FOUND","meta":{"doi":"10.9999/nonexistent-doi-xyz",...}}`.
- The regex only matches paths whose (post-prefix) segment starts with two digits and a dot, so it does not collide with the named collection routes. Slashes inside the DOI (e.g. `10.1086/742191`) are matched greedily and are fine unencoded.
- This is the resolver clients should use when they hold a DOI but not the internal `publications.id`; it saves a `/publications?doi=…` round-trip and returns the full detail payload in one call.
```
