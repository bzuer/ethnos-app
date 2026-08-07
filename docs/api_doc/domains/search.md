# Search — full-text discovery over works and persons

The search domain is the primary discovery surface of the API. It exposes seven read-only endpoints that run against **Manticore Search** (SphinxQL, the same engine that powers `/works`, `/publications` and `/persons`): works full-text lives in the Manticore `works` index (fields `title, subtitle, abstract, authors, subjects, venue`), person full-text in the `persons` index (`preferred_name, given_names, family_name`). The one exception is the `venue`/`venue_name` filter, which resolves through the MariaDB `ft_venues_search` FULLTEXT index. Matching ids are found in Manticore and then hydrated from MariaDB base tables (`works`, `publications`, `persons`, `venues`), so every result row carries the same rich shape as the corresponding entity endpoint. All endpoints are public (no key, rate-limited only — see [../00-conventions.md](../00-conventions.md)).

Result rows reuse shapes from other domains: the work row is the same `WorkListItem` returned by [./works.md](./works.md) enriched with search provenance; the person row is a compact subset of [./persons.md](./persons.md). This chapter documents only what is specific to search; the response envelope, pagination (`page/limit` + `offset/limit`), auth/rate-limit, error codes, boolean/date normalization and the shared citation/sort params are all in [../00-conventions.md](../00-conventions.md).

Quick engine map:

| Endpoint | Entities | Engine | Paginated | `q` required |
|---|---|---|---|---|
| `GET /search/works` | works | Manticore (+ MariaDB for `venue`) | yes | no (filter-only allowed) |
| `GET /search/advanced` | works | Manticore | yes | no (filter-only allowed) |
| `GET /search/global` | works + persons | Manticore | no (per-entity slice) | **yes** |
| `GET /search/persons` | persons | Manticore | yes | **yes** |
| `GET /search/autocomplete` | titles + authors + venues | Manticore → MariaDB | no | **yes** (min 2) |
| `GET /search/popular` | most-frequent terms | Redis analytics aggregate | no | n/a |
| `GET /search/health` | engine status | — | no | n/a |

A cross-cutting note before the per-endpoint reference: the `relevance` field is present (as `null`) on the works rows of `/search/works` and `/search/global`, and on the person rows everywhere, but it is **always `null`** — Manticore's internal ranking score is never surfaced, even when `sort_by=relevance`. Do not build UI around it. The work row shape is byte-for-byte identical across `/search/works`, `/search/global` (`data.works.results[]`) and `/search/advanced` (`data.results[]`), so a single result component serves all three (the only difference: `/search/advanced` omits the `relevance` key entirely).

---

## `GET /search/works`

Full-text works search served by Manticore. Free-text `q` spans every text field; `q` is **optional** when at least one filter is supplied (filter-only queries such as `?venue=mana` are fully supported). Pagination totals are **exact** (Manticore `COUNT(*)`).

### Query parameters

| param | type | default | accepted values / bounds | effect |
|---|---|---|---|---|
| `q` | string | — | 2–200 chars; rejects `<`/`>`, `javascript:`, SQL keywords (`select insert update delete drop create alter exec execute union declare`) → 400 | Free-text over `@(title,subtitle,abstract,authors,subjects,venue)`. Optional if a filter is present. |
| `type` | enum | — | `ARTICLE, BOOK, CHAPTER, THESIS, CONFERENCE, CONFERENCE_PAPER, REPORT, DATASET, PREPRINT, REVIEW, EDITORIAL, OTHER` | Work-type filter with `any_publication` semantics (matches if any publication of the work is of that type). |
| `language` | string | — | 2–5 chars, ISO code e.g. `en`, `pt` | Language filter. |
| `peer_reviewed` | boolean | — | `1/0/true/false` | Peer-review flag. |
| `open_access` | boolean | — | `1/0/true/false` | Open-access flag. |
| `venue_name` | string | — | 2–255 chars | Venue name partial match via MariaDB `ft_venues_search` (flips the venue join to INNER). |
| `venue` | string | — | 2–255 chars | Alias of `venue_name`. |
| `year_from` | integer | — | 1900 .. currentYear+1 | Minimum publication year. |
| `year_to` | integer | — | 1900 .. currentYear+1 | Maximum publication year. |
| `author` | string | — | 2–255 chars | Manticore `@authors` field match (AND semantics with `q`/other filters). |
| `subject` | string | — | 2–255 chars | Manticore `@subjects` field match (AND semantics). |
| `sort_by` | enum | relevance (if `q`/filter text present) else `publication_year DESC, id DESC` | swagger enum `cited_by_count, references_count, publication_year, id, relevance`; validator also accepts the aliases `citation_count, reference_count, year, work_id` | Primary sort key. |
| `sort_order` | enum | `DESC` | `ASC`/`DESC`, case-insensitive | Sort direction. |

Plus the shared citation-filter and pagination params — `cited_by_min`/`cited_by_max` (aliases `citation_count_min`/`citation_count_max`, inclusive bounds against `works.citation_count`), `page`/`limit`, `offset`/`limit`. See [../00-conventions.md](../00-conventions.md).

### Example requests

```
GET /search/works?q=kinship&limit=20
GET /search/works?venue=mana&limit=10&sort_by=cited_by_count&sort_order=DESC        # filter-only, no q
GET /search/works?q=kinship&type=ARTICLE&year_from=2015&cited_by_min=5&sort_by=cited_by_count
GET /search/works?author=silva&subject=anthropology&limit=10                        # metadata filters, AND semantics
```

### Example response

```json
{
  "status": "success",
  "data": [
    {
      "id": 2689796,
      "publication_id": 1180479,
      "publications_count": 1,
      "title": "Mama's Baby, Papa's Maybe",
      "subtitle": "An American Grammar Book",
      "abstract": "Hortense Spillers's \"Mama's Baby, Papa's Maybe\" is a foundational text in Black feminist thought ... (long text)",
      "type": "BOOK",
      "language": "en",
      "publication_year": 1987,
      "doi": "10.2307/464747",
      "open_access": false,
      "peer_reviewed": true,
      "venue": {
        "id": 1014939,
        "name": "diacritics",
        "abbreviated_name": "diacritics",
        "type": "JOURNAL",
        "issn": "0300-7162",
        "eissn": "1080-6539",
        "scopus_id": "5700156387",
        "wikidata_id": "Q5270247",
        "openalex_id": "S149853692"
      },
      "authors_preview": ["Hortense J Spillers"],
      "contributors_preview": [
        { "person_id": 374840, "name": "Hortense J Spillers", "role": "AUTHOR", "roles": ["AUTHOR"], "position": 1 }
      ],
      "author_count": 1,
      "first_author": { "person_id": 374840, "name": "Hortense J Spillers" },
      "first_author_id": 374840,
      "first_author_identifiers": null,
      "cited_by_count": 1075,
      "references_count": 0,
      "added_to_database": "2025-08-29T20:47:32.000Z",
      "data_source": "search",
      "search_engine": "Manticore",
      "_links": { "self": "/works/2689796" },
      "relevance": null
    }
    // ... (2 returned of total 14580)
  ],
  "pagination": { "page": 1, "limit": 2, "total": 14580, "totalPages": 7290, "hasNext": true, "hasPrev": false },
  "meta": {
    "query": "kinship",
    "search_type": "fulltext",
    "performance": {
      "engine": "Manticore",
      "query_type": "search",
      "match_mode": "any_publication",
      "primary_query_ms": 4,
      "elapsed_ms": 5,
      "controller": "searchWorks",
      "controller_time_ms": 5
    },
    "request": { "method": "GET", "path": "/search/works?q=kinship&limit=2" },
    "pagination_extras": { "offset": 0 }
  }
}
```

### Fields — `data[]` (work row)

| field (dot-path) | type | notes |
|---|---|---|
| `id` | int | Work id. Navigate to `/works/{id}`. |
| `publication_id` | int | Latest matching publication id — navigate to `/publications/{id}`. |
| `publications_count` | int | Total publications on the work. |
| `title` | string | Work title. |
| `subtitle` | string \| null | |
| `abstract` | string \| null | Can be very long. |
| `type` | enum string | Displayed work type from the primary publication: `ARTICLE, BOOK, CHAPTER, THESIS, CONFERENCE, CONFERENCE_PAPER, REPORT, DATASET, PREPRINT, REVIEW, EDITORIAL, OTHER`. |
| `language` | string \| null | ISO code (`en`, `pt`, …). |
| `publication_year` | int \| null | Year of the displayed publication. |
| `doi` | string \| null | |
| `open_access` | boolean | From the primary publication. |
| `peer_reviewed` | boolean | From the primary publication. |
| `venue` | object \| null | Displayed publication's venue (see sub-table). |
| `venue.id` | int | |
| `venue.name` | string | |
| `venue.abbreviated_name` | string \| null | Always paired with `name`. |
| `venue.type` | enum string | `JOURNAL, CONFERENCE, REPOSITORY, BOOK_SERIES, SOURCE_BOOK, OTHER`. |
| `venue.issn` | string \| null | |
| `venue.eissn` | string \| null | |
| `venue.scopus_id` | string \| null | |
| `venue.wikidata_id` | string \| null | |
| `venue.openalex_id` | string \| null | |
| `authors_preview` | string[] | Up to 3 contributor display names, deduplicated by person and ordered AUTHOR first. Plain strings, no role — use `contributors_preview` to tell an author from a translator. |
| `contributors_preview` | object[] | The same people carrying their role: `{ person_id, name, role, roles[], position }`. See [works › Contributor roles and positions](./works.md#contributor-roles-and-positions). |
| `author_count` | int | Distinct people credited across every role; someone credited as both `AUTHOR` and `EDITOR` counts once. |
| `first_author` | object \| null | `{ person_id, name }`. Always an `AUTHOR`-role contributor. |
| `first_author.person_id` | int | |
| `first_author.name` | string | |
| `first_author_id` | int \| null | Duplicate of `first_author.person_id`. |
| `first_author_identifiers` | object \| null | Usually `null`. |
| `cited_by_count` | int | Incoming citations (`works.citation_count`). |
| `references_count` | int | Outgoing references. |
| `added_to_database` | ISO datetime | `works.created_at`. |
| `data_source` | string | Constant `"search"`. |
| `search_engine` | string | Constant `"Manticore"`. |
| `_links.self` | string | `/works/{id}`. |
| `relevance` | null | **Always null** — never surfaced (see intro). |

### Fields — `meta`

| field | type | notes |
|---|---|---|
| `meta.query` | string | Echoed `q` (empty string on filter-only queries). |
| `meta.search_type` | string | Constant `"fulltext"`. |
| `meta.performance.engine` | string | `"Manticore"`. |
| `meta.performance.query_type` | string | `"search"`. |
| `meta.performance.match_mode` | string | `"any_publication"` — a work matches if any of its publications matches the filters. |
| `meta.performance.primary_query_ms` | int | Manticore query time. |
| `meta.performance.elapsed_ms` | int | Total search time. |
| `meta.performance.controller` | string | `"searchWorks"`. |
| `meta.performance.controller_time_ms` | int | |
| `meta.pagination_extras.offset` | int | Effective offset (from `offset` param or derived from `page`). |
| `meta.request` | object | `{ method, path }`. |

### Notes / caveats

- Pagination `total` is **exact** (Manticore `COUNT(*)`); no `pagination_total_exact` flag or estimate fallback is emitted here.
- `match_mode: "any_publication"` — the `type`/`year`/`open_access`/`peer_reviewed` filters match a work if **any** of its publications qualifies, and the displayed publication is the latest matching one.
- Real cardinalities for calibration: `q=kinship` → 14 580 works; `venue=mana` → 959 works.
- Validation failures return the standard 400 envelope with `errors[]` (`{ type, value, msg, path, location }`) — e.g. `q=a` → `"Search query must be between 2 and 200 characters"`; `sort_by=bogus` → the sort_by enum message.
- To search authors or subjects specifically, prefer the `author`/`subject` filters (scoped Manticore fields) over stuffing names into `q` (which also matches title/abstract text).

---

## `GET /search/advanced`

Works search served by the same Manticore engine as `/search/works`, but wrapping the rows under `data.results` alongside a `data.facets` object. **Faceting is not implemented** — `data.facets` is always an empty object `{}`. Use it exactly like `/search/works` (same filters, same paginated exact totals); the only structural difference is the `data.results` nesting and the absence of the `relevance` key on rows.

### Query parameters

Same set as `/search/works`, with one extra alias:

| param | type | default | accepted values / bounds | effect |
|---|---|---|---|---|
| `work_type` | enum | — | same 12-value work-type enum | Alias of `type` (both accepted; `work_type` takes precedence when both set). |

All of `q, work_type, type, language, year_from, year_to, peer_reviewed, open_access, venue_name, venue, author, subject` plus the shared `cited_by_min/cited_by_max, sort_by, sort_order, page/limit, offset` behave identically to `/search/works`. `peer_reviewed`/`open_access` here are matched strictly against the strings `"true"`/`"false"`.

### Example requests

```
GET /search/advanced?q=ritual&author=silva&limit=20
GET /search/advanced?work_type=ARTICLE&year_from=2018&language=pt&limit=10
GET /search/advanced?venue=mana&sort_by=cited_by_count&sort_order=DESC
```

### Example response

```json
{
  "status": "success",
  "data": {
    "results": [
      {
        "id": 3974425,
        "publication_id": 2671174,
        "publications_count": 1,
        "title": "Remarks on Similarity in Ritual Classification",
        "subtitle": "Affliction, Divination, and Object Animation",
        "abstract": "In her article, Silva considers the significance of similarity ... (long text)",
        "type": "ARTICLE",
        "language": "en",
        "publication_year": 2013,
        "doi": "10.1086/673184",
        "open_access": false,
        "peer_reviewed": true,
        "venue": {
          "id": 1012740,
          "name": "History of Religions",
          "abbreviated_name": "Hist. Relig.",
          "type": "JOURNAL",
          "issn": "0018-2710",
          "eissn": "1545-6935",
          "scopus_id": "26797",
          "wikidata_id": null,
          "openalex_id": "S99675065"
        },
        "authors_preview": ["Sónia Silva"],
        "author_count": 1,
        "first_author": { "person_id": 3621666, "name": "Sónia Silva" },
        "first_author_id": 3621666,
        "first_author_identifiers": null,
        "cited_by_count": 4,
        "references_count": 10,
        "added_to_database": "2025-10-07T20:29:47.000Z",
        "data_source": "search",
        "search_engine": "Manticore",
        "_links": { "self": "/works/3974425" }
      }
      // ... (2 returned of total 110)
    ],
    "facets": {}
  },
  "pagination": { "page": 1, "limit": 2, "total": 110, "totalPages": 55, "hasNext": true, "hasPrev": false },
  "meta": {
    "query": "ritual",
    "search_type": "fulltext_faceted",
    "filters_applied": 1,
    "engine": "Manticore",
    "pagination_total_exact": true,
    "performance": { "controller_time_ms": 3 },
    "request": { "method": "GET", "path": "/search/advanced?q=ritual&author=silva&limit=2" },
    "pagination_extras": { "offset": 0 }
  }
}
```

### Fields

| field (dot-path) | type | notes |
|---|---|---|
| `data.results[]` | array | Work rows — **identical shape to `/search/works` data rows EXCEPT the `relevance` key is absent** here. See that endpoint's field table. |
| `data.facets` | object | **Always `{}`.** Faceting is not implemented; do not expect year/type/language/venue buckets. |
| `pagination` | object | Standard `{ page, limit, total, totalPages, hasNext, hasPrev }`, total exact. |
| `meta.query` | string | Echoed `q` (empty on filter-only). |
| `meta.search_type` | string | Constant `"fulltext_faceted"`. |
| `meta.filters_applied` | int | Count of active (non-empty) filters. |
| `meta.engine` | string | `"Manticore"` when a full-text/text clause participates, else `"MariaDB"` (pure filter-only). |
| `meta.pagination_total_exact` | boolean | Reports whether `total` is exact (typically `true`). |
| `meta.performance.controller_time_ms` | int | Controller wall time. |
| `meta.pagination_extras.offset` | int | Effective offset. |
| `meta.request` | object | `{ method, path }`. |

### Notes / caveats

- The endpoint's advertised differentiator (facets) is inert: `data.facets` is a permanent empty object and no `meta.search_engine`/`meta.faceted_search` keys are returned. This is a known limitation logged as an operator follow-up — see [../API_ISSUES.md](../API_ISSUES.md). Build filter UI from the static enums documented above, not from a facets response.
- Everything else matches `/search/works`: exact totals, `any_publication` semantics, same validation rules and error envelope. Real cardinality: `q=ritual&author=silva` → 110 works.

---

## `GET /search/global`

Simultaneous search across works **and** persons in one round-trip (institutions search is permanently disabled for performance). `q` is **required**. There is no cross-entity pagination — each entity block returns its own `total` and a `results[]` slice capped at `limit`.

### Query parameters

| param | type | default | accepted values / bounds | effect |
|---|---|---|---|---|
| `q` | string | — | **required**, min 2 chars | Full-text query run against both the works and persons Manticore indexes. |
| `limit` | integer | 5 | 1 .. 20 | Max rows returned **per entity type** (applies independently to works and persons). |

### Example requests

```
GET /search/global?q=anthropology
GET /search/global?q=viveiros+de+castro&limit=10
```

### Example response

```json
{
  "status": "success",
  "data": {
    "works": {
      "total": 296845,
      "results": [
        {
          "id": 2514643,
          "publication_id": 1021394,
          "publications_count": 1,
          "title": "Anthropology as Cultural Critique",
          "subtitle": "An Experimental Moment in the Human Sciences",
          "abstract": "Using cultural anthropology to analyze debates ... (long text)",
          "type": "ARTICLE",
          "language": "en",
          "publication_year": 1987,
          "doi": "10.2307/1386453",
          "open_access": false,
          "peer_reviewed": true,
          "venue": {
            "id": 1012231,
            "name": "Journal for the Scientific Study of Religion",
            "abbreviated_name": "J. Sci. Study Relig.",
            "type": "JOURNAL",
            "issn": "0021-8294",
            "eissn": "1468-5906",
            "scopus_id": "27285",
            "wikidata_id": "Q6294702",
            "openalex_id": "S207420867"
          },
          "authors_preview": ["David D Laitin", "George E Marcus", "M M J Fischer"],
          "author_count": 4,
          "first_author": { "person_id": 147469, "name": "David D Laitin" },
          "first_author_id": 147469,
          "first_author_identifiers": null,
          "cited_by_count": 1071,
          "references_count": 0,
          "added_to_database": "2025-08-18T22:36:47.000Z",
          "data_source": "search",
          "search_engine": "Manticore",
          "_links": { "self": "/works/2514643" },
          "relevance": null
        }
        // ... (limit rows of total 296845)
      ]
    },
    "persons": {
      "total": 23,
      "results": [
        {
          "id": 8961609,
          "_links": { "self": "/persons/8961609" },
          "preferred_name": "IEA RAS Moscow Russia Center for Medical Anthropology",
          "given_names": "IEA RAS Moscow Russia Center for Medical",
          "family_name": "Anthropology",
          "name_signature": null,
          "identifiers": { "orcid": null, "lattes_id": null, "scopus_id": null, "wikidata_id": null, "openalex_id": null, "url": null },
          "is_verified": false,
          "metrics": { "works_count": 2, "latest_publication_year": 2017 },
          "relevance": null
        }
        // ... (limit rows of total 23)
      ]
    },
    "institutions": {
      "total": 0,
      "results": [],
      "note": "Institutions search disabled for performance optimization"
    }
  },
  "meta": {
    "query": "anthropology",
    "query_time_ms": 25,
    "sources": {
      "works": { "engine": "Manticore", "query_type": "search", "match_mode": "any_publication", "primary_query_ms": 24, "elapsed_ms": 25, "controller": "searchWorks" },
      "persons": { "engine": "Manticore", "query_type": "search", "controller": "searchPersons" },
      "institutions": null
    },
    "controller_time_ms": 26,
    "request": { "method": "GET", "path": "/search/global?q=anthropology&limit=2" }
  }
}
```

### Fields

| field (dot-path) | type | notes |
|---|---|---|
| `data.works.total` | int | Total matching works (exact). |
| `data.works.results[]` | array | Full work-row shape (same as `/search/works`, includes `relevance: null`), sliced to `limit`. |
| `data.persons.total` | int | Total matching persons (exact). |
| `data.persons.results[]` | array | Compact person-row shape — see `/search/persons` field table. |
| `data.institutions.total` | int | **Always 0.** |
| `data.institutions.results` | array | **Always `[]`.** |
| `data.institutions.note` | string | `"Institutions search disabled for performance optimization"`. |
| `meta.query` | string | Echoed `q`. |
| `meta.query_time_ms` | int | Combined query time. |
| `meta.sources.works` | object | Works performance block (`engine, query_type, match_mode, primary_query_ms, elapsed_ms, controller`). |
| `meta.sources.persons` | object | Persons performance block (`engine, query_type, controller`). |
| `meta.sources.institutions` | null | Always `null`. |
| `meta.controller_time_ms` | int | Controller wall time. |
| `meta.request` | object | `{ method, path }`. |

### Notes / caveats

- Intended for a unified "search everything" box. Render the `works` and `persons` blocks separately; the `institutions` block is inert by design (empty with an explanatory `note`) — hide it or show a disabled state, do not treat `total: 0` as "no results found".
- No pagination: to page deeper into either entity, switch to `/search/works` or `/search/persons` with the same `q`.
- Real cardinalities: `q=anthropology` → 296 845 works, 23 persons.

---

## `GET /search/persons`

Full-text researcher/author name search via Manticore over `preferred_name, given_names, family_name`. `q` is **required**. Each row is a **compact** `PersonSearchItem`, not the full profile returned by `/persons/{id}` (see [./persons.md](./persons.md)). Paginated with exact totals.

### Query parameters

| param | type | default | accepted values / bounds | effect |
|---|---|---|---|---|
| `q` | string | — | **required**, 2–255 chars | Person name full-text query. |
| `verified` | boolean | — | `1/0/true/false` | Restrict to verified persons when true (honoured by the controller; not otherwise surfaced). |

Plus the shared pagination params `page`/`limit`, `offset`/`limit` — see [../00-conventions.md](../00-conventions.md).

### Example requests

```
GET /search/persons?q=silva&limit=20
GET /search/persons?q=viveiros&verified=true&limit=10
GET /search/persons?q=silva&limit=20&offset=40
```

### Example response

```json
{
  "status": "success",
  "data": [
    {
      "id": 1396157,
      "_links": { "self": "/persons/1396157" },
      "preferred_name": "Kleber Aparecido Da Silva Silva",
      "given_names": "Kleber Aparecido Da Silva",
      "family_name": "Silva",
      "name_signature": null,
      "identifiers": {
        "orcid": "0000-0002-7815-7767",
        "lattes_id": null,
        "scopus_id": null,
        "wikidata_id": null,
        "openalex_id": null,
        "url": null
      },
      "is_verified": true,
      "metrics": { "works_count": 47, "latest_publication_year": 2025 },
      "relevance": null
    }
    // ... (2 returned of total 27846)
  ],
  "pagination": { "page": 1, "limit": 2, "total": 27846, "totalPages": 13923, "hasNext": true, "hasPrev": false },
  "meta": {
    "query": "silva",
    "search_type": "fulltext",
    "performance": { "engine": "Manticore", "query_type": "search", "controller": "searchPersons", "controller_time_ms": 6 },
    "request": { "method": "GET", "path": "/search/persons?q=silva&limit=2" },
    "pagination_extras": { "offset": 0 }
  }
}
```

### Fields — `data[]` (person row)

| field (dot-path) | type | notes |
|---|---|---|
| `id` | int | Person id. Navigate to `/persons/{id}`. |
| `_links.self` | string | `/persons/{id}`. |
| `preferred_name` | string | Display name. |
| `given_names` | string \| null | |
| `family_name` | string \| null | |
| `name_signature` | null | Present but always `null` in results. |
| `identifiers.orcid` | string \| null | |
| `identifiers.lattes_id` | string \| null | |
| `identifiers.scopus_id` | string \| null | |
| `identifiers.wikidata_id` | string \| null | |
| `identifiers.openalex_id` | string \| null | |
| `identifiers.url` | string \| null | |
| `is_verified` | boolean | Whether the person record is verified. |
| `metrics.works_count` | int | Total works. |
| `metrics.latest_publication_year` | int \| null | Most recent publication year. |
| `relevance` | null | Always `null`. |

### Fields — `meta`

| field | type | notes |
|---|---|---|
| `meta.query` | string | Echoed `q`. |
| `meta.search_type` | string | Constant `"fulltext"`. |
| `meta.performance.engine` | string | `"Manticore"`. |
| `meta.performance.query_type` | string | `"search"`. |
| `meta.performance.controller` | string | `"searchPersons"`. |
| `meta.performance.controller_time_ms` | int | |
| `meta.pagination_extras.offset` | int | Effective offset. |
| `meta.request` | object | `{ method, path }`. |

### Notes / caveats

- This compact row does **not** include the full-profile blocks (`primary_affiliation`, `authorship_profile`, `subject_expertise`, `top_collaborators`, `recent_works`, `h_index`, `total_citations`, `created_at`, timestamps). Fetch `/persons/{id}` for those (see [./persons.md](./persons.md)). Identifiers live only under `identifiers{}`, not duplicated at top level.
- Totals are exact. Real cardinality: `q=silva` → 27 846 persons.
- Beware that some "persons" are institutional author strings (e.g. `"Society For Medical Anthropology"`) — this reflects the underlying data, not a bug.

---

## `GET /search/autocomplete`

Typeahead suggestions blending work **titles**, **author** names, and **venue** names. Candidate work ids are discovered via Manticore, then hydrated from MariaDB. Not paginated; returns a single flat `suggestions[]` list.

### Query parameters

| param | type | default | accepted values / bounds | effect |
|---|---|---|---|---|
| `q` | string | — | min 2 chars (a query < 2 chars returns the short-query shape, still HTTP 200) | The prefix/term to autocomplete. |
| `type` | enum | `all` | `all, titles, authors, venues` | Which suggestion kinds to include. |
| `limit` | integer | 10 | 1 .. 20 (clamped) | Max suggestions returned. |

### Example requests

```
GET /search/autocomplete?q=kins
GET /search/autocomplete?q=silva&type=authors&limit=5
GET /search/autocomplete?q=nature&type=venues&limit=8
GET /search/autocomplete?q=a          # short-query branch → suggestions:[], message:"Query too short"
```

### Example response (normal, `type=all`)

```json
{
  "status": "success",
  "data": {
    "query": "kins",
    "suggestions": [
      { "text": "‘Who Deserves a Chair?’", "type": "title", "relevance": 1, "preview": "‘Who Deserves a Chair?’" },
      { "text": "Evie Kins", "type": "author", "work_count": 4, "preview": "Evie Kins (4 works)" },
      {
        "text": "Journal of Adolescent Research",
        "name": "Journal of Adolescent Research",
        "abbreviated_name": "J. Adolesc. Res.",
        "type": "venue",
        "work_count": 2,
        "preview": "Journal of Adolescent Research [J. Adolesc. Res.] (2 works)"
      }
      // ... (10 total; mixed title/author/venue items)
    ],
    "type": "all",
    "count": 10,
    "generated_at": "2026-07-23T18:51:40.114Z"
  },
  "meta": {
    "query": "kins",
    "type": "all",
    "limit": 10,
    "engine": "Manticore",
    "request": { "method": "GET", "path": "/search/autocomplete?q=kins" }
  }
}
```

### Example response (short query, `q` < 2 chars, still HTTP 200)

```json
{
  "status": "success",
  "data": { "suggestions": [], "message": "Query too short" },
  "meta": { "query": "a", "type": "all", "limit": 10, "request": { "method": "GET", "path": "/search/autocomplete?q=a" } }
}
```

### Fields

| field (dot-path) | type | notes |
|---|---|---|
| `data.query` | string | Echoed query. Absent in the short-query shape. |
| `data.suggestions[]` | array | Mixed items; each has a discriminating `type`. |
| `suggestions[].text` | string | Display text (all item types). |
| `suggestions[].type` | enum string | `"title"` \| `"author"` \| `"venue"`. |
| `suggestions[].relevance` | int | **title items only** — count of works sharing that exact title. |
| `suggestions[].work_count` | int | **author + venue items only** — number of works for that author/venue. |
| `suggestions[].name` | string | **venue items only** — equals `text`. |
| `suggestions[].abbreviated_name` | string \| null | **venue items only.** |
| `suggestions[].preview` | string | Pre-formatted display string for all types (e.g. `"Evie Kins (4 works)"`, `"Journal … [J. Adolesc. Res.] (2 works)"`). |
| `data.type` | string | Echoes the `type` param. Absent in the short-query shape. |
| `data.count` | int | `suggestions.length`. Absent in the short-query shape. |
| `data.generated_at` | ISO datetime | Absent in the short-query shape. |
| `data.message` | string | **Short-query shape only** — `"Query too short"`. |
| `meta.query` | string | Echoed query. |
| `meta.type` | string | Echoed type. |
| `meta.limit` | int | Effective clamped limit. |
| `meta.engine` | string | `"Manticore"`. **Absent in the short-query shape.** |
| `meta.request` | object | `{ method, path }`. |

### Notes / caveats

- **Two response shapes**: the frontend must handle both. The normal shape carries `data.{query,type,count,generated_at}` and `meta.engine`; the short-query shape (`q` shorter than 2 characters) returns HTTP 200 with `data: { suggestions: [], message }` and no `engine`/`count`/`generated_at`. Key off `Array.isArray(data.suggestions)` plus the presence of `data.count`.
- Suggestion items are heterogeneous — switch on `suggestions[].type` to render each (title vs author-with-work-count vs venue-with-abbreviation). The `preview` string is safe to display verbatim if you don't want to compose your own.
- On an internal full-text failure the endpoint returns an empty `suggestions` list rather than an error inside a success envelope.

---

## `GET /search/popular`

Most-frequent search/title terms across the corpus, served from a precomputed analytics aggregate. Fast (does not run heavy SQL) and cached; returns HTTP 200. Not paginated.

### Query parameters

| param | type | default | accepted values / bounds | effect |
|---|---|---|---|---|
| `limit` | integer | 20 | 1 .. 50 (clamped) | Max number of terms returned. |

### Example requests

```
GET /search/popular
GET /search/popular?limit=10
```

### Example response

```json
{
  "status": "success",
  "data": {
    "popular_terms": [
      { "term": "social", "frequency": 57030, "type": "popular" },
      { "term": "health", "frequency": 43064, "type": "popular" },
      { "term": "education", "frequency": 32059, "type": "popular" },
      { "term": "impact", "frequency": 29306, "type": "popular" },
      { "term": "covid-19", "frequency": 29046, "type": "popular" }
      // ... (up to `limit` terms)
    ],
    "generated_at": "2026-07-23T18:54:36.308Z"
  },
  "meta": {
    "limit": 5,
    "source": "autocomplete_popular",
    "request": { "method": "GET", "path": "/search/popular?limit=5" }
  }
}
```

### Fields

| field (dot-path) | type | notes |
|---|---|---|
| `data.popular_terms[]` | array | Ranked list, most frequent first. |
| `popular_terms[].term` | string | The term (single word or token, e.g. `"covid-19"`). |
| `popular_terms[].frequency` | int | Occurrence count in the aggregate. |
| `popular_terms[].type` | string | Constant `"popular"`. |
| `data.generated_at` | ISO datetime | When this response was assembled. |
| `meta.limit` | int | Effective clamped limit. |
| `meta.source` | string | Constant `"autocomplete_popular"`. |
| `meta.request` | object | `{ method, path }`. |

### Notes / caveats

- This endpoint previously returned `503 REQUEST_TIMEOUT` on every call (an unbounded cross-join over the corpus). It has been fixed to read from a cached analytics aggregate and now returns HTTP 200 in ~1 ms; the fix is recorded in [../API_ISSUES.md](../API_ISSUES.md) (P2). Frontends can rely on it for a "trending terms" / suggestion-chips UI.
- Useful as pre-typed suggestion chips on an empty search box; feed a chosen `term` straight into `/search/works?q=`.

---

## `GET /search/health`

Reports the Manticore backend status and index topology. Public, unpaginated. Intended for status dashboards and diagnostics rather than end-user UI.

### Query parameters

None.

### Example request

```
GET /search/health
```

### Example response

```json
{
  "status": "success",
  "data": {
    "search_engine": "Manticore",
    "backend": "manticore",
    "reachable": true,
    "tables": [
      { "Table": "persons", "Type": "distributed" },
      { "Table": "persons_delta", "Type": "local" },
      { "Table": "persons_main", "Type": "local" },
      { "Table": "works", "Type": "distributed" },
      { "Table": "works_delta", "Type": "local" },
      { "Table": "works_main", "Type": "local" }
    ],
    "indexes": {
      "works": "Manticore table works (title, subtitle, abstract, authors, subjects, venue)",
      "persons": "Manticore table persons (preferred_name, given_names, family_name)",
      "venues": "ft_venues_search (name + abbreviated_name) [MariaDB]"
    },
    "endpoints": {
      "basic_search": "/search/works",
      "advanced_search": "/search/advanced",
      "autocomplete": "/search/autocomplete",
      "popular_terms": "/search/popular"
    }
  },
  "meta": { "request": { "method": "GET", "path": "/search/health" } }
}
```

### Fields

| field (dot-path) | type | notes |
|---|---|---|
| `data.search_engine` | string | `"Manticore"`. |
| `data.backend` | string | `"manticore"` (from the runtime `SEARCH_BACKEND`). |
| `data.reachable` | boolean | Whether the Manticore daemon responded. |
| `data.error` | string | Present **only on failure** (Manticore unreachable). |
| `data.tables[]` | array | `{ Table, Type }` per Manticore table. |
| `data.tables[].Table` | string | Table name (`works`, `works_main`, `works_delta`, `persons`, `persons_main`, `persons_delta`). |
| `data.tables[].Type` | string | `"distributed"` (the routed view) or `"local"` (main/delta shards). |
| `data.indexes.works` | string | Descriptive: fields indexed for works. |
| `data.indexes.persons` | string | Descriptive: fields indexed for persons. |
| `data.indexes.venues` | string | Descriptive: notes venue filtering uses MariaDB `ft_venues_search`. |
| `data.endpoints.*` | string | Route hints for the search family. |
| `meta.request` | object | `{ method, path }`. |

### Notes / caveats

- `reachable: false` plus a `data.error` string indicates Manticore is down — in that state `/search/works`, `/search/advanced`, `/search/global`, `/search/persons` and `/search/autocomplete` degrade or fail, since works/persons full-text has no MariaDB fallback. Only the `venue`/`venue_name` filter (MariaDB `ft_venues_search`) and the persons short-query LIKE path survive.
- The `works`/`persons` distributed tables fan out to `*_main` (nightly full rebuild) + `*_delta` (recent-updates, rebuilt every few minutes) shards; a freshly-published record may lag until the next delta index run.
