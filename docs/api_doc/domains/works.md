# Works — academic works (the parent record of the corpus)

The Works domain exposes the *work* entity: the parent bibliographic record that owns one or more publications (manifestations). It is backed by the `works` base table joined to `publications` (and, per row, `venues` / `organizations` / `persons` / `subjects` / `files` / `work_references`). A work is *multi-manifestation*: type, DOI, year, venue, files etc. live on the publication, so a single work can carry several publications of different types. List cards therefore display the **latest matching publication** and expose `match_mode: "any_publication"` — a work is in the result set if *any* of its publications matches the filters.

Search routing: the default browse and pure structured-filter paths (`type`, `language`, `year_from`/`year_to`, `open_access`, `venue_id`, `cited_by_min`/`max`, sorts) run on **MariaDB**. Free-text `q` and the metadata filters `author` / `subject` route through **Manticore** (SphinxQL); `venue_name` matches MariaDB `ft_venues_search`. Every response reports the engine that served it via `meta.performance.engine` and the per-row `search_engine` field.

Related domains: publications (`../publications.md`, navigate via each row's `publication_id`), persons (`../persons.md`, via `first_author.person_id` / authors), venues (`../venues.md`), institutions (`../institutions.md`, via author affiliations), subjects (`../subjects.md`), and courses/bibliographies (`../bibliographies.md`, the reverse of `/works/{id}/bibliographies`). Global response envelope, pagination (`page/limit` + `offset/limit`), auth, rate limiting, error codes, boolean/date normalization, and the shared citation/sort params are documented once in `../00-conventions.md` — this chapter only covers what is specific to works.

Endpoints in this domain:

| Endpoint | Purpose |
|---|---|
| `GET /works` | Paginated/searchable/filterable work listing (MariaDB + Manticore). |
| `GET /works/showcase` | High-performance browse; same shape as `/works`, structured filters only. |
| `GET /works/{id}` | Full work detail (publications, files, authors, subjects, citations, metrics). |
| `GET /works/{id}/bibliographies` | Courses whose reading list includes this work. |

---

## `GET /works`

Paginated list of works. Open (no auth). Default browse selects ids straight from `publications` (`SELECT DISTINCT work_id … ORDER BY work_id DESC`), so the newest works surface first.

**Query parameters**

| param | type | default | accepted values / bounds | effect |
|---|---|---|---|---|
| `page` | int | 1 | ≥1 | page number (1-based). |
| `limit` | int | **10** | 1..100 | page size. Swagger's old `default: 20` is wrong; live default is 10. |
| `offset` | int | 0 | ≥0 | skip N rows (alternative to `page`). When both given, `page` is derived from `offset` floored to a page boundary. |
| `q` | string | — | any text | free-text across title/subtitle/abstract/authors/subjects/venue → **Manticore**. Sets `engine=Manticore`, exact total. |
| `search` | string | — | any text | alias of `q`. |
| `author` | string | — | any text | Manticore `@authors` filter (AND semantics). |
| `subject` | string | — | any text | Manticore `@subjects` filter (AND semantics). |
| `venue_name` | string | — | any text | venue-name match via MariaDB `ft_venues_search`. `engine` label reports `Manticore` (full-text code path) even though the venue match runs in MariaDB. |
| `venue` | string | — | any text | alias of `venue_name`. |
| `venue_id` | int | — | ≥1 | exact venue id filter. |
| `type` | string | — | `ARTICLE, BOOK, CHAPTER, THESIS, CONFERENCE, CONFERENCE_PAPER, REPORT, DATASET, PREPRINT, REVIEW, EDITORIAL, OTHER` | filter by publication type (any_publication). `work_type` is an accepted alias. |
| `language` | string | — | 2..5 chars | ISO 639-1 match on `works.language`. |
| `year_from` | int | — | ≥1000 | displayed publication year ≥ value. |
| `year_to` | int | — | ≥1000 | displayed publication year ≤ value. |
| `open_access` | bool | — | 1/0/true/false | filter by OA availability. |
| `peer_reviewed` | bool | — | 1/0/true/false | filter by peer-review status. |
| `cited_by_min` | int | — | ≥0 | inclusive lower bound on `cited_by_count` (`works.citation_count`). Alias `citation_count_min`. |
| `cited_by_max` | int | — | ≥0 | inclusive upper bound. Alias `citation_count_max`. |
| `sort_by` | string | see note | `cited_by_count, references_count, publication_year, id, relevance` (aliases `citation_count, reference_count, year, work_id`) | primary sort key. Alias `sortBy`. |
| `sort_order` | string | `DESC` | `ASC`/`DESC` (case-insensitive) | sort direction. Alias `sortOrder`. |

Plus the shared citation/sort params — see `../00-conventions.md`. Default sort: `relevance` on the full-text path (`q`/`author`/`subject`/`venue_name`), otherwise `publication_year DESC, id DESC` (default browse orders by `work_id DESC`).

Caveat: **`has_files` is accepted but silently ignored** on `/works` — it does not filter. Use `/publications?has_files=true` when file presence must be enforced (`../publications.md`).

**Example requests**

```
GET /works?limit=2
GET /works?q=kinship&limit=10
GET /works?author=silva&type=ARTICLE&year_from=2015&limit=20
GET /works?sort_by=cited_by_count&sort_order=DESC&limit=20
GET /works?cited_by_min=100&cited_by_max=500&open_access=true
GET /works?venue_name=mana&limit=20
```

**Example response** (`GET /works?limit=2`, trimmed)

```json
{
  "status": "success",
  "data": [
    {
      "id": 22519667,
      "publication_id": 1127609346,
      "publications_count": 1,
      "title": "Theological Possibilities and the Anthropology of Eastern Orthodox Christianity",
      "subtitle": null,
      "abstract": null,
      "type": "ARTICLE",
      "language": "en",
      "publication_year": 2026,
      "doi": "10.1086/742191",
      "open_access": false,
      "peer_reviewed": true,
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
      "authors_preview": ["Sarah Riccardi-Swartz"],
      "author_count": 1,
      "first_author": { "person_id": 3892437, "name": "Sarah Riccardi-Swartz" },
      "first_author_id": 3892437,
      "first_author_identifiers": null,
      "cited_by_count": 0,
      "references_count": 0,
      "added_to_database": "2026-07-23T03:25:16.000Z",
      "data_source": "full_api",
      "search_engine": "MariaDB",
      "_links": { "self": "/works/22519667" }
    }
    // ... (2 total)
  ],
  "pagination": { "page": 1, "limit": 2, "total": 6187180, "totalPages": 3093590, "hasNext": true, "hasPrev": false },
  "meta": {
    "match_mode": "any_publication",
    "pagination_total_exact": false,
    "performance": { "engine": "MariaDB", "query_type": "showcase_optimized", "primary_query_ms": 0, "total_rows_examined": 2 },
    "request": { "method": "GET", "path": "/works?limit=2" },
    "pagination_extras": { "offset": 0 }
  }
}
```

On the Manticore path (`q=kinship`) each row instead carries `data_source: "search"`, `search_engine: "Manticore"`, `meta.performance.engine: "Manticore"`, `query_type: "search"`, and `pagination_total_exact: true`.

**Fields** — list item (identical shape on `/works`, `/works/showcase`, and full-text variants)

| field | type | notes |
|---|---|---|
| `id` | int | work id. |
| `publication_id` | int \| null | id of the displayed (latest matching) publication → `/publications/{publication_id}`. |
| `publications_count` | int | total publications of this work. |
| `title` | string \| null | work title. |
| `subtitle` | string \| null | |
| `abstract` | string \| null | full abstract text; can be very long. |
| `type` | string \| null | displayed work type from latest publication. Enum: `ARTICLE, BOOK, CHAPTER, THESIS, CONFERENCE, CONFERENCE_PAPER, REPORT, DATASET, PREPRINT, REVIEW, EDITORIAL, OTHER`. |
| `language` | string \| null | ISO 639-1. |
| `publication_year` | int \| null | year of displayed publication. May contain garbage future years (see caveats). |
| `doi` | string \| null | DOI of displayed publication. |
| `open_access` | bool \| null | |
| `peer_reviewed` | bool \| null | |
| `venue` | object \| null | see venue sub-table. |
| `authors_preview` | string[] | up to 3 preferred author names. |
| `author_count` | int | total authors on the work. |
| `first_author` | object \| null | `{ person_id:int, name:string }`. |
| `first_author_id` | int \| null | duplicate of `first_author.person_id`. |
| `first_author_identifiers` | object \| null | always `null` on list rows (populated only on detail authors). |
| `cited_by_count` | int | incoming citations = `works.citation_count`; defaults 0. |
| `references_count` | int | outgoing references = `works.reference_count`; defaults 0. |
| `added_to_database` | string(date-time) \| null | `works.created_at`. |
| `data_source` | string | `"full_api"` (MariaDB path) or `"search"` (Manticore path). |
| `search_engine` | string | `"MariaDB"` or `"Manticore"` — which engine served this row. |
| `_links.self` | string | `/works/{id}`. |

Venue sub-object (`venue`, and every venue block in this domain):

| field | type | notes |
|---|---|---|
| `id` | int | venue id → `/venues/{id}`. |
| `name` | string | |
| `abbreviated_name` | string \| null | always paired with `name`. |
| `type` | string \| null | `JOURNAL, CONFERENCE, REPOSITORY, BOOK_SERIES, SOURCE_BOOK, OTHER` (SOURCE_BOOK ≈ 90% of venues). |
| `issn` / `eissn` | string \| null | |
| `scopus_id` / `wikidata_id` / `openalex_id` | string \| null | external identifiers. |

**Notes / caveats**

- `meta.match_mode` is always `"any_publication"`.
- `pagination_total_exact`: `false` on the default unfiltered browse (`total` is the fixed estimate **6187180**) and on any count-budget timeout; `true` on Manticore full-text (exact `COUNT`) and on filtered MariaDB counts (e.g. `type=BOOK` → exact 177810). Do not display the estimate as a precise count.
- **Possible page under-fill on Manticore filters.** `subject` / `author` can return fewer rows than `limit` because some matched work ids do not hydrate through the publications join (e.g. `subject=anthropology&limit=3` → 2 rows). Never treat `data.length < limit` as "last page" when a full-text/metadata filter is active — rely on `pagination.hasNext` / `pagination.total`.
- `sort_by=publication_year` can surface out-of-range future years (2028 observed); the listing does not clamp years the way `/metrics/annual` does. See `../API_ISSUES.md`.
- `has_files` is a no-op here (`../API_ISSUES.md`).

---

## `GET /works/showcase`

High-performance MariaDB browse over `works` joined to the latest publication. **Identical row shape and `meta`** to `GET /works` (same list-item field inventory above). Open (no auth).

**Query parameters** — structured filters only. It does **not** read `q`/`search`/`author`/`subject`/`venue_name`/`venue_id`/`peer_reviewed`/`has_files`.

| param | type | default | accepted values / bounds | effect |
|---|---|---|---|---|
| `page` | int | 1 | ≥1 | page number. |
| `limit` | int | **10** | 1..100 | page size. |
| `offset` | int | 0 | ≥0 | skip N. |
| `type` | string | — | same 12-value enum as `/works` | publication type filter. |
| `year_from` / `year_to` | int | — | ≥1000 | year range on displayed publication. |
| `language` | string | — | 2..5 chars | ISO 639-1 match. |
| `cited_by_min` / `cited_by_max` | int | — | ≥0 | inclusive citation bounds. |
| `sort_by` | string | browse order | `cited_by_count, references_count, publication_year, id` (no `relevance`) | primary sort. |
| `sort_order` | string | `DESC` | `ASC`/`DESC` | direction. |

The swagger-mentioned legacy aliases `work_type` / `year` are not present in the live payload here.

**Example requests**

```
GET /works/showcase?limit=20
GET /works/showcase?type=BOOK&limit=20
GET /works/showcase?year_from=2020&year_to=2023&sort_by=cited_by_count
```

**Example response** (`GET /works/showcase?limit=1&type=BOOK`, trimmed)

```json
{
  "status": "success",
  "data": [
    {
      "id": 22438549,
      "publication_id": 1127528228,
      "publications_count": 1,
      "title": "Macroeconomic Effects of Market Structure Distortions",
      "subtitle": null,
      "abstract": null,
      "type": "BOOK",
      "language": "en",
      "publication_year": 2022,
      "doi": null,
      "open_access": false,
      "peer_reviewed": true,
      "venue": { "id": 1343355, "name": "Macroeconomic Effects of Market Structure Distortions", "abbreviated_name": null, "type": "SOURCE_BOOK", "issn": null, "eissn": null, "scopus_id": null, "wikidata_id": null, "openalex_id": null },
      "authors_preview": ["Flavien Moreau", "Ludovic Panon"],
      "author_count": 2,
      "first_author": { "person_id": 6044943, "name": "Flavien Moreau" },
      "first_author_id": 6044943,
      "first_author_identifiers": null,
      "cited_by_count": 0,
      "references_count": 0,
      "added_to_database": "2026-07-20T17:27:26.000Z",
      "data_source": "full_api",
      "search_engine": "MariaDB",
      "_links": { "self": "/works/22438549" }
    }
  ],
  "pagination": { "page": 1, "limit": 1, "total": 177810, "totalPages": 177810, "hasNext": true, "hasPrev": false },
  "meta": {
    "match_mode": "any_publication",
    "pagination_total_exact": true,
    "performance": { "engine": "MariaDB", "query_type": "showcase_optimized", "primary_query_ms": 2, "total_rows_examined": 1 },
    "request": { "method": "GET", "path": "/works/showcase?limit=1&type=BOOK" },
    "pagination_extras": { "offset": 0 }
  }
}
```

**Notes / caveats** — same `pagination_total_exact` behaviour as `/works` (unfiltered browse → estimate 6187180, `false`; a `type` filter → exact count, `true`). Because there is no Manticore path here, no full-text under-fill occurs, but publication-less works are still excluded by the join.

---

## `GET /works/{id}`

Full detail payload for one work: every publication embedded, plus work-level aggregations (primary publication, files, venues roll-up, authors, subjects, citations, metrics, funding). Open (no auth). 404s when the id does not exist.

**Path parameters**

| param | type | notes |
|---|---|---|
| `id` | int (≥1) | work id. Non-integer → 400; unknown → 404. |

**Query parameters**

| param | type | default | accepted values | effect |
|---|---|---|---|---|
| `include_citations` | bool | true | 1/0/true/false | when false, `citations.cited_by` is omitted/empty. |
| `include_references` | bool | true | 1/0/true/false | when false, `citations.references` is omitted/empty. |

**Example requests**

```
GET /works/7539537
GET /works/22519667?include_citations=false&include_references=false
```

**Example response** (`GET /works/7539537`, arrays trimmed to one element)

```json
{
  "status": "success",
  "data": {
    "id": 7539537,
    "_links": { "self": "/works/7539537" },
    "title": "Using thematic analysis in psychology",
    "subtitle": null,
    "abstract": "Increasingly, adult Indigenous language learners ... (long)",
    "type": "ARTICLE",
    "language": "en",
    "publication_year": 2006,
    "doi": "10.1191/1478088706qp063oa",
    "open_access": true,
    "peer_reviewed": true,
    "has_files": true,
    "venue": { "id": 1014042, "name": "Qualitative Research in Psychology", "abbreviated_name": "Qual. Res. Psychol.", "type": "JOURNAL", "issn": "1478-0887", "eissn": "1478-0895", "scopus_id": "5100155099", "wikidata_id": "Q15749868", "openalex_id": "S51001188" },
    "year_range": { "earliest": 2006, "latest": 2006 },
    "languages": ["en"],
    "summary_updated_at": "2026-07-22T19:55:15.000Z",
    "primary_publication_id": 1112638398,
    "primary_publication": {
      "id": 1112638398, "doi": "10.1191/1478088706qp063oa", "publication_year": 2006,
      "publication_date": "2006-01-01T00:00:00.000Z", "volume": "3", "issue": "2", "pages": "77-101",
      "open_access": true, "peer_reviewed": true, "has_files": true,
      "venue": { "id": 1014042, "name": "Qualitative Research in Psychology", "abbreviated_name": "Qual. Res. Psychol.", "type": "JOURNAL", "issn": "1478-0887", "eissn": "1478-0895", "scopus_id": "5100155099", "wikidata_id": "Q15749868", "openalex_id": "S51001188" },
      "publisher": { "id": 693664, "name": "Taylor & Francis", "type": "PUBLISHER", "country": "GB", "ror_id": null, "wikidata_id": "Q880582", "openalex_id": "P4310320547", "url": "https://taylorandfrancis.com" },
      "source": "crossref", "license_url": null, "license_version": null,
      "_links": { "self": "/publications/1112638398" }
    },
    "files": [
      {
        "file_id": 9648677, "publication_id": 1112638398, "md5": "76dd10b645a4c2d1e2a266def1ea1804",
        "format": "PDF", "size": null, "pages": null, "language": null, "version": null, "role": "MAIN",
        "libgen_id": null, "scimag_id": null, "openacess_id": "doi:10.1191/1478088706qp063oa",
        "best_oa_url": "https://www.tandfonline.com/doi/abs/10.1191/1478088706qp063oa",
        "verification": "PENDING", "download_count": 0
      }
      // ... (2 total)
    ],
    "file_summary": { "files_returned": 2, "files_total": 2, "files_truncated": false, "publications_with_files": 1, "total_download_count": 0, "best_oa_url": "https://www.tandfonline.com/doi/abs/10.1191/1478088706qp063oa", "by_format": { "PDF": 2 }, "by_role": { "MAIN": 2 }, "has_scimag": true, "has_libgen": false, "has_open_access": true },
    "venues": [
      { "id": 1014042, "name": "Qualitative Research in Psychology", "abbreviated_name": "Qual. Res. Psychol.", "type": "JOURNAL", "issn": "1478-0887", "eissn": "1478-0895", "scopus_id": "5100155099", "wikidata_id": "Q15749868", "openalex_id": "S51001188", "publication_count": 1, "latest_year": 2006 }
    ],
    "publications": [
      {
        "id": 1112638398,
        "identifiers": { "doi": "10.1191/1478088706qp063oa", "pmid": null, "pmcid": null, "arxiv": null, "wos_id": null, "handle": null, "wikidata_id": null, "openalex_id": "W1979290264", "isbn": null, "openlibrary_id": null, "scielo_pid": null, "google_book_id": null },
        "publication_date": "2006-01-01T00:00:00.000Z", "publication_year": 2006,
        "volume": "3", "issue": "2", "pages": "77-101", "language": "en",
        "open_access": true, "peer_reviewed": true, "has_files": true,
        "has_scimag_file": true, "has_libgen_file": false, "download_count": 0,
        "license_url": null, "license_version": null, "source": "crossref", "source_indexed_at": null,
        "venue": { "id": 1014042, "name": "Qualitative Research in Psychology" },
        "publisher": { "id": 693664, "name": "Taylor & Francis" },
        "files": [ /* same file entry shape as top-level files[] */ ],
        "created_at": null, "updated_at": null,
        "_links": { "self": "/publications/1112638398" },
        "is_primary": true
      }
      // ... (1 total)
    ],
    "publications_total": 1,
    "publications_has_more": false,
    "identifiers": { "doi": ["10.1191/1478088706qp063oa"], "openalex_id": ["W1979290264"] },
    "authors": [
      {
        "person_id": 7922, "preferred_name": "Braun", "given_names": null, "family_name": "Braun",
        "identifiers": { "orcid": "0000-0002-3435-091X", "scopus_id": null, "lattes_id": null },
        "role": "AUTHOR", "position": 1, "is_corresponding": true, "affiliation": null
      }
      // ... (N total)
    ],
    "subjects": [
      { "subject_id": 341989, "term": "Cartography", "vocabulary": "Keyword", "lang": "en", "relevance_score": 1, "assigned_by": "AUTHOR" }
      // ... (17 total)
    ],
    "citations": {
      "cited_by": [
        { "work_id": 22479148, "title": "Insights of Vietnamese American Women ...", "authors": "Minh Tung Phung; Rachel Sunny Inyangetuk; Gulsah Sofia Onar", "publication_year": 2026, "venue_name": "Journal of Racial and Ethnic Health Disparities", "venue_abbreviated_name": "J. Racial Ethn. Heal. Disparities", "open_access": true, "citation_type": "NEUTRAL", "citation_status": "RESOLVED", "citation_context": null }
        // ... (100 total)
      ],
      "references": [
        { "work_id": 19606075, "title": "Dilemmas in qualitative health research", "authors": "Liz Yardley; Lucy Yardley", "publication_year": 2000, "venue_name": "Psychology & Health", "venue_abbreviated_name": "Psychol. Heal.", "doi": "10.1080/08870440008400302", "open_access": false, "citation_type": "NEUTRAL", "citation_context": null }
        // ... (19 total)
      ],
      "unresolved_references": [
        { "cited_doi": "10.5172/conu.19.1-2.75", "status": "PENDING", "citation_type": "NEUTRAL", "created_at": "2026-07-19T23:34:21.000Z", "resolved_at": null }
      ],
      "unsolved": [ /* alias of unresolved_references */ ]
    },
    "metrics": {
      "citation_count": 21493, "reference_count": 11, "download_count": 0, "view_count": 0,
      "altmetric_score": null, "social_media_mentions": 0, "news_mentions": 0,
      "publications_count": 1, "publications_with_files_count": 1, "publications_open_access_count": 1,
      "publications_peer_reviewed_count": 1, "distinct_venues_count": 1,
      "total_files_count": 2, "total_files_download_count": 0, "metrics_last_updated": "2026-07-22T19:55:15.000Z"
    },
    "funding": [],
    "created_at": "2026-03-13T22:56:42.000Z",
    "updated_at": "2026-07-22T19:55:15.000Z"
  }
}
```

**Fields** — top-level `data`

| field | type | notes |
|---|---|---|
| `id` | int | work id. |
| `_links.self` | string | `/works/{id}`. |
| `title` / `subtitle` / `abstract` | string \| null | |
| `type` | string \| null | from primary publication; same 12-value enum. |
| `language` | string \| null | work-level language. |
| `publication_year` | int \| null | primary publication year. |
| `doi` | string \| null | primary publication DOI. |
| `open_access` | bool | true if **any** publication is OA. |
| `peer_reviewed` | bool | true if **any** publication is peer-reviewed. |
| `has_files` | bool | true if any publication has files. |
| `venue` | object \| null | primary publication venue (venue sub-shape). |
| `year_range.earliest` / `.latest` | int \| null | min/max over hydrated publications' years. |
| `languages` | string[] | distinct languages across publications. |
| `summary_updated_at` | string(ISO) \| null | ISO of `works.metrics_last_updated`. |
| `primary_publication_id` | int \| null | picker: latest year → `has_files` → `publication_id` DESC. |
| `primary_publication` | object \| null | compact block, see sub-table. |
| `files` | object[] | flat work-level file aggregation, see sub-table. |
| `file_summary` | object | file rollup, see sub-table. |
| `venues` | object[] | distinct-venue roll-up: venue fields + `publication_count` + `latest_year`; ordered `publication_count DESC, latest_year DESC`. |
| `publications` | object[] | full per-publication entries (capped 50), see sub-table. |
| `publications_total` | int | true total (queried when >50). |
| `publications_has_more` | bool | true when >50 publications. |
| `identifiers` | object | aggregated union of every publication's identifiers; a key appears only when non-empty, each value a string array. Possible keys: `doi, pmid, pmcid, arxiv, wos_id, handle, wikidata_id, openalex_id, isbn, openlibrary_id, scielo_pid, google_book_id`. |
| `authors` | object[] | see sub-table. |
| `subjects` | object[] | see sub-table. |
| `citations` | object | `cited_by`, `references`, `unresolved_references`, `unsolved` — see sub-tables. |
| `metrics` | object | see sub-table. |
| `funding` | object[] | `{ funder_id, funder_name, grant_number }`; empty when no funding recorded. |
| `created_at` / `updated_at` | string(date-time) \| null | work timestamps. |

`primary_publication` block:

| field | type | notes |
|---|---|---|
| `id` | int | publication id → `/publications/{id}`. |
| `doi` | string \| null | |
| `publication_year` | int \| null | |
| `publication_date` | string(date-time) \| null | |
| `volume` / `issue` / `pages` | string \| null | |
| `open_access` / `peer_reviewed` / `has_files` | bool | |
| `venue` | object \| null | venue sub-shape. |
| `publisher` | object \| null | `{ id, name, type, country, ror_id, wikidata_id, openalex_id, url }`; `type` from `organizations.type`. |
| `source` | string \| null | provenance, e.g. `"crossref"`. |
| `license_url` / `license_version` | string \| null | |
| `_links.self` | string | `/publications/{id}`. |

`files[]` entry (flat, capped 50; sorted role `MAIN>SUPPLEMENT>COVER>PREVIEW` → verification `VERIFIED` first → `publication_id` DESC):

| field | type | notes |
|---|---|---|
| `file_id` | int | |
| `publication_id` | int | parent publication. |
| `md5` | string \| null | |
| `format` | string \| null | e.g. `PDF`. |
| `size` | int \| null | bytes. |
| `pages` | int \| null | |
| `language` | string \| null | |
| `version` | string \| null | |
| `role` | string \| null | `MAIN, SUPPLEMENT, COVER, PREVIEW`. |
| `libgen_id` / `scimag_id` / `openacess_id` | string \| null | source-specific ids (`openacess_id` may hold `doi:…`). |
| `best_oa_url` | string \| null | open-access URL. |
| `verification` | string \| null | `VERIFIED, PENDING, FAILED`. |
| `download_count` | int | |

`file_summary` block:

| field | type | notes |
|---|---|---|
| `files_returned` | int | count in `files[]` (≤50). |
| `files_total` | int | total across publications. |
| `files_truncated` | bool | true when `files_total > files_returned`. |
| `publications_with_files` | int | |
| `total_download_count` | int | |
| `best_oa_url` | string \| null | |
| `by_format` | object(map) | `{ "PDF": 2, ... }`. |
| `by_role` | object(map) | `{ "MAIN": 2, ... }`. |
| `has_scimag` / `has_libgen` / `has_open_access` | bool | rollup flags. |

`publications[]` entry (capped 50):

| field | type | notes |
|---|---|---|
| `id` | int | publication id. |
| `identifiers` | object | 12 keys: `doi, pmid, pmcid, arxiv, wos_id, handle, wikidata_id, openalex_id, isbn, openlibrary_id, scielo_pid, google_book_id`; each string or null. |
| `publication_date` | string(date-time) \| null | |
| `publication_year` | int \| null | |
| `volume` / `issue` / `pages` | string \| null | |
| `language` | string \| null | |
| `open_access` / `peer_reviewed` / `has_files` | bool | |
| `has_scimag_file` / `has_libgen_file` | bool | |
| `download_count` | int | |
| `license_url` / `license_version` | string \| null | |
| `source` | string \| null | |
| `source_indexed_at` | string(date-time) \| null | |
| `venue` | object \| null | venue sub-shape. |
| `publisher` | object \| null | publisher sub-shape. |
| `files` | object[] | same file entry shape as top-level `files[]`. |
| `created_at` / `updated_at` | string(date-time) \| null | often null on publications. |
| `_links.self` | string | `/publications/{id}`. |
| `is_primary` | bool | true for the primary publication. |

`authors[]` entry:

| field | type | notes |
|---|---|---|
| `person_id` | int | → `/persons/{person_id}`. |
| `preferred_name` | string | |
| `given_names` / `family_name` | string \| null | |
| `identifiers` | object | `{ orcid, scopus_id, lattes_id }`, each string or null. |
| `role` | string | default `AUTHOR`. |
| `position` | int | 1-based author order. |
| `is_corresponding` | bool | |
| `affiliation` | object \| null | `{ id, name, type, country, _links.self }` (`_links.self` → `/institutions/{id}`); null when no affiliation. |

`subjects[]` entry:

| field | type | notes |
|---|---|---|
| `subject_id` | int | → `/subjects/{id}`. |
| `term` | string | |
| `vocabulary` | string | e.g. `Keyword`. |
| `lang` | string \| null | |
| `relevance_score` | number | placeholder, typically `1`. |
| `assigned_by` | string | e.g. `AUTHOR`, `SYSTEM`. |

`citations.cited_by[]` (works citing this one, ≤100):

| field | type | notes |
|---|---|---|
| `work_id` | int | citing work → `/works/{work_id}`. |
| `title` | string \| null | |
| `authors` | string | `"; "`-joined author names. |
| `publication_year` | int \| null | |
| `venue_name` / `venue_abbreviated_name` | string \| null | |
| `open_access` | bool | |
| `citation_type` | string | default `NEUTRAL`. |
| `citation_status` | string | `RESOLVED, PENDING, FAILED`. |
| `citation_context` | string \| null | |

`citations.references[]` (resolved outgoing refs, ≤100): same shape as `cited_by` plus `doi` (string \| null), minus `citation_status`.

`citations.unresolved_references[]` (and its alias `citations.unsolved[]`):

| field | type | notes |
|---|---|---|
| `cited_doi` | string | DOI of the not-yet-resolved reference. |
| `status` | string | `PENDING` (expected; cited work not in DB yet) or `FAILED`. |
| `citation_type` | string | default `NEUTRAL`. |
| `created_at` | string(date-time) \| null | |
| `resolved_at` | string(date-time) \| null | |

`metrics` block:

| field | type | notes |
|---|---|---|
| `citation_count` | int | = `works.citation_count`. |
| `reference_count` | int | = `works.reference_count`. |
| `download_count` / `view_count` | int | |
| `altmetric_score` | number \| null | |
| `social_media_mentions` / `news_mentions` | int | |
| `publications_count` | int | |
| `publications_with_files_count` | int | |
| `publications_open_access_count` | int | |
| `publications_peer_reviewed_count` | int | |
| `distinct_venues_count` | int | |
| `total_files_count` | int | |
| `total_files_download_count` | int | |
| `metrics_last_updated` | string(date-time) \| null | |

**Notes / caveats**

- 404 with `code: "NOT_FOUND"` and message `"Work with ID {id} not found"` for unknown ids; 400 `VALIDATION_ERROR` for non-integer ids.
- `publications`, `files`, `citations.cited_by`, `citations.references` are each capped (50 / 50 / 100 / 100). Use `publications_has_more` / `file_summary.files_truncated` and the dedicated `/publications` and `/works/{id}/citations|references` endpoints (see `../publications.md`, `../citations.md`) for the full lists.
- Set `include_citations=false` / `include_references=false` to shrink the payload when the UI does not render those blocks.
- `unresolved_references` and `unsolved` are the same data (alias); read either, not both.

---

## `GET /works/{id}/bibliographies`

Lists the courses whose reading list includes this work (reverse of the courses/bibliography domain). Open (no auth). 404s on unknown work id.

**Path parameters**

| param | type | notes |
|---|---|---|
| `id` | int (≥1) | work id. |

**Query parameters**

| param | type | default | accepted values / bounds | effect |
|---|---|---|---|---|
| `reading_type` | string | — | `REQUIRED, RECOMMENDED, SUPPLEMENTARY, OPTIONAL` | filter by reading type. |
| `year_from` | int | — | ≥1900 | courses from this year. |
| `year_to` | int | — | ≥1900 | courses up to this year. |
| `limit` | int | **10** | 1..100 | page size. |
| `offset` | int | 0 | ≥0 | skip N. |

**Example requests**

```
GET /works/2684644/bibliographies
GET /works/2684644/bibliographies?reading_type=REQUIRED&year_from=2020&year_to=2025
```

**Example response** (`GET /works/22519667/bibliographies`)

```json
{
  "status": "success",
  "data": [],
  "pagination": { "page": 1, "limit": 10, "total": 0, "totalPages": 0, "hasNext": false, "hasPrev": false },
  "meta": { "request": { "method": "GET", "path": "/works/22519667/bibliographies" }, "pagination_extras": { "offset": 0 } }
}
```

**Fields** — row shape (per swagger; currently unverifiable live because the `courses` / `course_bibliography` tables are empty):

| field | type | notes |
|---|---|---|
| `course_id` | int | → `/courses/{id}`. |
| `course_code` | string | |
| `course_name` | string | |
| `course_year` | int | |
| `program_id` | int \| null | |
| `reading_type` | string | `REQUIRED, RECOMMENDED, SUPPLEMENTARY, OPTIONAL`. |
| `instructor_count` | int | |
| `instructors` | string | `"; "`-joined instructor names. |

**Notes / caveats**

- Currently returns an empty list for every work — the course-bibliography dataset is not loaded (operator follow-up; see `../API_ISSUES.md`). The endpoint is wired and returns HTTP 200 with `data: []`, not an error.
- A valid work id with no course usage and an unknown work id both matter: unknown ids 404 (existence guard via `validateWorkId`); a real work with no bibliography usage returns the empty-data 200 above.
- Related: the forward direction lives in the bibliographies/courses domain (`../bibliographies.md`).
