# Subjects — controlled-vocabulary terms, their hierarchy, and tagged works

This domain exposes the controlled-vocabulary **subject** terms that classify works (keywords, discipline names, topic labels). It is backed by the single MariaDB base table `subjects` (~165,800 rows), with a self-referential `parent_id` term hierarchy and the denormalized, operator-maintained `subjects.total_works` column that every `works_count` figure reads verbatim (never a request-time `work_subjects` join, so even the largest subjects resolve in milliseconds). Free-text term search itself is not part of this domain's endpoints — it runs through the MariaDB FULLTEXT index `ft_subjects_term` from the search surface. Subjects relate outward to [works](./works.md) (via `work_subjects`), [venues](./venues.md) (via `venue_subjects`), and [courses](./courses.md) (via course bibliographies).

The root collection listing (`GET /subjects`) is **disabled** — only the six endpoints below are mounted. All responses use the standard envelope and pagination described in [../00-conventions.md](../00-conventions.md); this chapter documents only what is specific to subjects.

> **Course-linkage fields are inert today.** Every course-derived field in this domain — `courses_count` (detail/children), `used_in_courses` (works), and the entire `GET /subjects/{id}/courses` response — is structurally hardcoded to `0` / `[]` because the course domain is not loaded. Treat them as non-functional. See [../API_ISSUES.md](../API_ISSUES.md).

---

## `GET /subjects/statistics`

Structural + work-linkage rollup over the whole `subjects` table. No parameters. Public. Cached 1 hour (`subjects:statistics:v3`).

**Example requests**

```
GET /subjects/statistics
```

**Example response**

```json
{
  "status": "success",
  "data": {
    "total_subjects": 165779,
    "root_subjects": 160029,
    "child_subjects": 5750,
    "vocabularies_count": 5,
    "typed_subjects": 164955,
    "subjects_with_works": 165183,
    "total_work_subject_relations": 79911608,
    "vocabulary_distribution": [
      { "vocabulary": "OpenLibrary", "subject_count": 99358, "root_count": 98388, "works_count": 1019958 },
      { "vocabulary": "Keyword",     "subject_count": 61006, "root_count": 61006, "works_count": 44455298 },
      { "vocabulary": "OpenAlex",    "subject_count": 4784,  "root_count": 4,     "works_count": 29242605 },
      { "vocabulary": "Scopus",      "subject_count": 328,   "root_count": 328,   "works_count": 5160604 },
      { "vocabulary": "SCImago",     "subject_count": 303,   "root_count": 303,   "works_count": 33143 }
    ],
    "top_subjects": [
      { "id": 341907, "term": "Political science", "vocabulary": "Keyword", "subject_type": "General", "works_count": 2819809 }
    ],
    "meta": {
      "work_linkage_available": true,
      "source": "subjects.total_works (operator-maintained denormalized aggregate)"
    }
  },
  "meta": { "request": { "method": "GET", "path": "/subjects/statistics" } }
}
```

The `top_subjects` array holds **20** entries (trimmed to one above). Real top ranks: Political science (2,819,809), Sociology (2,283,163), Psychology (1,629,900), Philosophy (1,574,637), Art (1,555,466), Law (1,552,061), History (1,351,050), Computer Science (1,314,113) …

**Fields**

| field (dot-path) | type | notes |
|---|---|---|
| data.total_subjects | int | Total rows in `subjects` (~165.8K). |
| data.root_subjects | int | Rows with `parent_id IS NULL`. |
| data.child_subjects | int | Rows with `parent_id NOT NULL` (only ~5.7K — the hierarchy is shallow and sparse). |
| data.vocabularies_count | int | Distinct `vocabulary` values (5). |
| data.typed_subjects | int | Rows carrying a non-empty `subject_type`. |
| data.subjects_with_works | int | Rows with `total_works > 0`. |
| data.total_work_subject_relations | int | `SUM(total_works)` over all subjects (≈79.9M). **Not** a distinct count of `work_subjects` rows — it is the sum of the per-subject denormalized counts (a work tagged with N subjects is counted N times). |
| data.vocabulary_distribution[] | array | One entry per vocabulary, ordered by `subject_count` DESC. |
| data.vocabulary_distribution[].vocabulary | string | Enum (observed): `OpenLibrary`, `Keyword`, `OpenAlex`, `Scopus`, `SCImago`. |
| data.vocabulary_distribution[].subject_count | int | Subjects in that vocabulary. |
| data.vocabulary_distribution[].root_count | int | Root subjects in that vocabulary (note OpenAlex has only 4 roots but 4,784 subjects — it carries the deep tree). |
| data.vocabulary_distribution[].works_count | int | `SUM(total_works)` for that vocabulary. |
| data.top_subjects[] | array | Top 20 subjects by `total_works` DESC, tie-broken by term ASC. |
| data.top_subjects[].id | int | Subject id. |
| data.top_subjects[].term | string \| null | Term label. |
| data.top_subjects[].vocabulary | string \| null | As above. |
| data.top_subjects[].subject_type | string \| null | e.g. `General`, `ProperNoun`, `Field`, `Subfield`, `SubjectArea`, `Topic`. |
| data.top_subjects[].works_count | int | `subjects.total_works`. |
| data.meta.work_linkage_available | bool | **Always `true`.** Provenance flag, not a runtime signal. |
| data.meta.source | string | Fixed provenance string. |

**Notes** — `data.meta` is a nested block *inside* `data` (distinct from the envelope-level `meta.request`). No pagination. All figures come from stored/denormalized columns, so the endpoint is cheap and stable.

---

## `GET /subjects/{id}`

Single subject-term detail. Public. Cached 1 hour (`subject:v2:{id}`). Returns **404** when the id does not exist.

**Path parameters**

| param | type | notes |
|---|---|---|
| id | integer ≥ 1 | Subject id (required). Non-integer / `< 1` → 400 validation error. |

**Example requests**

```
GET /subjects/341907          # root subject "Political science"
GET /subjects/337471          # a child subject (has a parent)
GET /subjects/99999999999     # -> 404 Subject not found
```

**Example response** (child subject, to show the populated parent fields)

```json
{
  "status": "success",
  "data": {
    "id": 337471,
    "_links": { "self": "/subjects/337471" },
    "term": "French Urban and Social Studies",
    "vocabulary": "OpenAlex",
    "subject_type": "Topic",
    "term_pt": null,
    "term_es": null,
    "parent_id": 365301,
    "created_at": "2025-11-03T12:59:25.000Z",
    "works_count": 97144,
    "courses_count": 0,
    "children_count": 0,
    "parent_term": "Sociology and Political Science",
    "parent_vocabulary": "OpenAlex",
    "avg_relevance_score": null
  },
  "meta": { "request": { "method": "GET", "path": "/subjects/337471" } }
}
```

For a root subject (e.g. `341907`), `parent_id`, `parent_term`, `parent_vocabulary` are all `null`.

**Fields**

| field (dot-path) | type | notes |
|---|---|---|
| data.id | int | Subject id. |
| data._links.self | string | `/subjects/{id}`. |
| data.term | string \| null | Primary term label (usually English). |
| data.vocabulary | string \| null | `Keyword` \| `OpenAlex` \| `Scopus` \| `SCImago` \| `OpenLibrary`. |
| data.subject_type | string \| null | e.g. `General`, `ProperNoun`, `Field`, `Subfield`, `SubjectArea`, `Topic`. |
| data.term_pt | string \| null | Portuguese label. Null for many subjects. |
| data.term_es | string \| null | Spanish label. Null for many subjects. |
| data.parent_id | int \| null | Self-referential parent subject; null on roots. |
| data.created_at | string(ISO 8601) \| null | Row creation timestamp. |
| data.works_count | int | `subjects.total_works` (denormalized). |
| data.courses_count | int | **Always `0`** (course linkage not loaded). |
| data.children_count | int | Real `COUNT` of subjects whose `parent_id` = this id. |
| data.parent_term | string \| null | Parent's term; null when root. |
| data.parent_vocabulary | string \| null | Parent's vocabulary; null when root. **Detail-only** — not present on children/hierarchy list items. |
| data.avg_relevance_score | number \| null | **Always `null` by design** — the underlying `work_subjects.relevance_score` is a uniform placeholder, so no averaging scan is run. |

**Notes** — 404 envelope carries `code: "NOT_FOUND"` and `meta.request`. `courses_count` and `avg_relevance_score` are constant (0 / null) regardless of the subject — do not build UI that expects them to vary.

---

## `GET /subjects/{id}/children`

Direct children (one level down) of the subject, ordered by `works_count` DESC then `term` ASC. Paginated. Public. Cached 1 hour (`subject:{id}:children:v3:{filters}`).

**Path parameters** — `id` (integer ≥ 1, required).

**Query parameters** — pagination only (see [../00-conventions.md](../00-conventions.md)):

| param | type | default | bounds | effect |
|---|---|---|---|---|
| page | int | 1 | ≥ 1 | Page number. |
| limit | int | 10 | 1–100 | Page size. |
| offset | int | — | ≥ 0 | Offset alternative to `page` (both accepted). |

**Example requests**

```
GET /subjects/365301/children?limit=3
GET /subjects/365301/children?offset=2&limit=2
GET /subjects/341907/children            # a leaf subject -> data: []
```

**Example response**

```json
{
  "status": "success",
  "data": [
    {
      "id": 337471,
      "term": "French Urban and Social Studies",
      "vocabulary": "OpenAlex",
      "subject_type": "Topic",
      "parent_id": 365301,
      "created_at": "2025-11-03T12:59:25.000Z",
      "works_count": 97144,
      "courses_count": 0,
      "children_count": 0,
      "parent_term": null,
      "_links": { "self": "/subjects/337471" }
    }
  ],
  "pagination": { "page": 1, "limit": 3, "total": 224, "totalPages": 75, "hasNext": true, "hasPrev": false },
  "meta": {
    "request": { "method": "GET", "path": "/subjects/365301/children?limit=3" },
    "pagination_extras": { "offset": 0 }
  }
}
```

**Fields** (list-item shape)

| field (dot-path) | type | notes |
|---|---|---|
| data[].id | int | Child subject id. |
| data[].term | string \| null | Term label. |
| data[].vocabulary | string \| null | As above. |
| data[].subject_type | string \| null | As above. |
| data[].parent_id | int \| null | Equals the requested `{id}`. |
| data[].created_at | string(ISO) \| null | Row creation timestamp. |
| data[].works_count | int | Child's `total_works` (drives the sort). |
| data[].courses_count | int | **Always `0`** (hardcoded). |
| data[].children_count | int | Real grandchildren count (GROUP BY over `parent_id`). |
| data[].parent_term | string \| null | **Always `null` on this endpoint** — the children query selects no parent term (differs from `/subjects/{id}` detail, which resolves it). |
| data[]._links.self | string | `/subjects/{id}`. |

**Notes** — `pagination.total` is exact. A **non-existent parent id returns HTTP 200 with an empty page** (no existence-404 guard here, unlike detail/hierarchy). A leaf subject returns `data: []` with `total: 0`. Only ~5,750 subjects have children at all, so most calls return empty.

---

## `GET /subjects/{id}/hierarchy`

Ancestor chain from the root down to the requested subject, walking `parent_id`. Returns a flat array (root first, requested subject last), unpaginated. Public. Cached 1 hour (`subject:{id}:hierarchy:v2`). Returns **404** when the id does not exist.

**Path parameters** — `id` (integer ≥ 1, required).

**Example requests**

```
GET /subjects/337350/hierarchy     # 4-level chain
GET /subjects/341907/hierarchy     # a root -> single-element array
```

**Example response**

```json
{
  "status": "success",
  "data": [
    { "id": 2035488, "term": "Social Sciences",                 "vocabulary": "OpenAlex", "parent_id": null,    "works_count": 256 },
    { "id": 2564035, "term": "Social Sciences",                 "vocabulary": "OpenAlex", "parent_id": 2035488, "works_count": 0 },
    { "id": 365301,  "term": "Sociology and Political Science", "vocabulary": "OpenAlex", "parent_id": 2564035, "works_count": 0 },
    { "id": 337350,  "term": "Asian Studies and History",       "vocabulary": "OpenAlex", "parent_id": 365301,  "works_count": 33530 }
  ],
  "meta": { "request": { "method": "GET", "path": "/subjects/337350/hierarchy" } }
}
```

**Fields** — these are **raw DB rows, NOT run through a DTO**. Only these 5 keys appear; there is no `_links`, `subject_type`, `created_at`, or `parent_term` (inconsistent with the list/detail shapes — plan the UI accordingly).

| field (dot-path) | type | notes |
|---|---|---|
| data[].id | int | Node subject id. |
| data[].term | string | Term label. |
| data[].vocabulary | string | As above. |
| data[].parent_id | int \| null | `null` only on the first element (the root). |
| data[].works_count | int | `total_works` for that node (note intermediate nodes can be `0`). |

**Notes** — No `pagination` block (bounded ancestor walk). The array is always ≥ 1 element; a root subject yields a single-element array. Non-existent id → **HTTP 404** `Subject not found` (existence guard applies here, unlike children/works/courses).

---

## `GET /subjects/{id}/works`

Works tagged with this subject (via `work_subjects`), paginated. Public. Cached 1 hour (`subject:{id}:works:v2:{filters}`). Backed by MariaDB (id-selection on `work_subjects` then hydration from `works`/`publications`).

**Path parameters** — `id` (integer ≥ 1, required).

**Query parameters**

| param | type | default | bounds | effect |
|---|---|---|---|---|
| page | int | 1 | ≥ 1 | Page number. |
| limit | int | 10 | 1–100 | Page size. |
| offset | int | — | ≥ 0 | Offset alternative to `page`. |
| min_relevance | float | — | ≥ 0 | Keep rows with `work_subjects.relevance_score >= value`. Applied at id-selection. Note the underlying score is a uniform placeholder (`1`), so this filter is effectively all-or-nothing today. |
| year_from | int | — | 1900–2030 | Lower bound (inclusive) on the work's publication year. Applied at hydration. |
| year_to | int | — | 1900–2030 | Upper bound (inclusive) on the work's publication year. Applied at hydration. |
| document_type | string | — | len 1–50 | Exact match against the publication `type` (e.g. `ARTICLE`, `BOOK`, `CHAPTER`, `THESIS`, `CONFERENCE`, `PREPRINT`…). Applied at hydration. |
| language | string | — | len 2–10 | Exact match against `works.language` (ISO 639-1, e.g. `en`, `pt`). Applied at hydration. |

Ordering is fixed at `work_subjects.work_id DESC` (newest-ingested first); there is no client-facing `sort_by` on this endpoint.

**Example requests**

```
GET /subjects/345590/works?limit=3
GET /subjects/345590/works?limit=3&language=en&year_from=2015
GET /subjects/341907/works?limit=1               # 2.8M-work subject, still fast
GET /subjects/341907/works?document_type=ARTICLE&year_from=2020&year_to=2024
```

**Example response**

```json
{
  "status": "success",
  "data": [
    {
      "id": 21881577,
      "title": "Global health degrees",
      "publication_year": 2020,
      "language": "en",
      "document_type": "ARTICLE",
      "open_access": true,
      "relevance_score": 1,
      "assigned_by": "AUTHOR",
      "used_in_courses": 0
    }
  ],
  "pagination": { "page": 1, "limit": 3, "total": 5, "totalPages": 2, "hasNext": true, "hasPrev": false },
  "meta": {
    "request": { "method": "GET", "path": "/subjects/345590/works?limit=3" },
    "pagination_extras": { "offset": 0 }
  }
}
```

**Fields**

| field (dot-path) | type | notes |
|---|---|---|
| data[].id | int | Work id (link to [`/works/{id}`](./works.md)). |
| data[].title | string \| null | Work title. |
| data[].publication_year | int \| null | `MAX(publications.year)` across the work's publications. |
| data[].language | string \| null | `works.language` (ISO 639-1). |
| data[].document_type | string \| null | Latest publication `type` (`ARTICLE`, `BOOK`, `CHAPTER`, …), derived from the work's publications. |
| data[].open_access | bool \| null | `MAX(publications.open_access)` coerced to boolean — true if any publication is OA. |
| data[].relevance_score | number \| null | `work_subjects.relevance_score`. Uniform placeholder value `1` in current data. |
| data[].assigned_by | string \| null | Provenance of the tag, e.g. `AUTHOR`. |
| data[].used_in_courses | int | **Always `0`** (course linkage not loaded). |

**Notes**
- `pagination.total` comes from the denormalized `subjects.total_works` and is exact for the unfiltered subject. When `year_*` / `document_type` / `language` filters are applied at hydration, the returned page may **under-fill** relative to `total` (the total is not recomputed against the filters) — detect the end of data by `data.length < limit`.
- A **non-existent subject id returns HTTP 200 with an empty page** (no existence-404 guard).
- **Performance note (resolved):** this endpoint previously returned HTTP 500 (uncaught statement-timeout) for high-volume subjects. It was reworked to paginate-then-hydrate off the `work_subjects` index and now returns in ~2 ms even for the 2.8M-work subject `341907`, with a caught-timeout graceful-degradation net. See [../API_ISSUES.md](../API_ISSUES.md) (P3).

---

## `GET /subjects/{id}/courses`

Courses whose bibliography includes a work tagged with this subject. Public. Cached 1 hour (`subject:{id}:courses:{filters}`).

**Path parameters** — `id` (integer ≥ 1, required).

**Query parameters**

| param | type | default | bounds | effect |
|---|---|---|---|---|
| page | int | 1 | ≥ 1 | Page number. |
| limit | int | 10 | 1–100 | Page size. |
| offset | int | — | ≥ 0 | Offset alternative to `page`. |
| year_from | int | — | 1900–2030 | Lower bound (inclusive) on `courses.year`. |
| year_to | int | — | 1900–2030 | Upper bound (inclusive) on `courses.year`. |
| program_id | int | — | ≥ 1 | Restrict to courses in this program. |
| reading_type | string | — | len 1–50 | Exact match against `course_bibliography.reading_type`. |

**Example requests**

```
GET /subjects/341907/courses
GET /subjects/341907/courses?year_from=2020&reading_type=REQUIRED
```

**Example response** (currently always empty — course data not loaded)

```json
{
  "status": "success",
  "data": [],
  "pagination": { "page": 1, "limit": 10, "total": 0, "totalPages": 0, "hasNext": false, "hasPrev": false },
  "meta": {
    "request": { "method": "GET", "path": "/subjects/341907/courses" },
    "pagination_extras": { "offset": 0 }
  }
}
```

**Fields** (populated-row shape, from the DTO — not observable live because the course domain is empty)

| field (dot-path) | type | notes |
|---|---|---|
| data[].id | int | Course id. |
| data[].program_id | int \| null | Owning program. |
| data[].code | string \| null | Course code. |
| data[].name | string \| null | Course name. |
| data[].credits | number \| null | Credit value. |
| data[].semester | string \| null | Semester label. |
| data[].year | int \| null | Course year. |
| data[].reading_type | string \| null | From `course_bibliography.reading_type`. |
| data[].works_with_subject | int | `COUNT(DISTINCT work_id)` tagged with this subject within the course. |
| data[].instructor_count | int | `COUNT(DISTINCT` instructor person id`)`. |

**Notes** — The SQL is valid but **always returns 0 rows today** because `courses` / `course_bibliography` are unpopulated (known operator-side pending item — see [../API_ISSUES.md](../API_ISSUES.md)). Non-existent subject id → HTTP 200 empty page (no 404 guard). Once course data lands, the shape above applies. See the [courses domain](./courses.md).

---

## `GET /subjects` — disabled

The root collection listing is intentionally **not mounted**. A request falls through to the global 404 handler and returns the generic not-found envelope (no `meta.request`):

```
GET /subjects
```
```json
{ "status": "error", "message": "Can't find /subjects on this server!", "timestamp": "...", "code": "NOT_FOUND" }
```

This is expected behavior, correctly absent from the OpenAPI spec. To discover subjects, use `GET /subjects/statistics` (`top_subjects`), the term-search surface (`ft_subjects_term`), or navigate the hierarchy via `/subjects/{id}/children` and `/subjects/{id}/hierarchy`.

---

## Domain-wide caveats (quick reference)

| Concern | Behavior |
|---|---|
| `works_count` everywhere | Read from denormalized `subjects.total_works`; never a live join — fast even for 2.8M-work subjects. |
| Course fields | `courses_count`, `used_in_courses`, and all of `/subjects/{id}/courses` are constant `0` / `[]` — course data not loaded. |
| `avg_relevance_score` (detail) | Always `null` by design. |
| `relevance_score` (works) | Uniform placeholder `1`; `min_relevance` filter is effectively all-or-nothing. |
| Existence 404 | Only `/subjects/{id}` and `/subjects/{id}/hierarchy` 404 on a bogus id. `/children`, `/works`, `/courses` return HTTP 200 empty pages. |
| `parent_term` | Populated on detail; **always null** on `/children` rows; absent entirely on `/hierarchy` nodes. |
| `hierarchy` shape | Raw DB rows (5 keys, no `_links`/`subject_type`/`created_at`) — inconsistent with other subject shapes. |
| Pagination totals | Exact on `/children` and unfiltered `/works`; filtered `/works` pages can under-fill (total not recomputed). |
