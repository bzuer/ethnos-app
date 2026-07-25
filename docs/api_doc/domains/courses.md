# Courses — teaching syllabi, reading lists, and instructor rosters

The `courses` domain exposes academic course records (syllabi) and their three satellite relations: the instructor roster, the reading list (bibliography), and the subjects derived from that reading list. It is backed entirely by MariaDB (`courses`, `course_instructors`, `course_bibliography`, joined through to `persons`, `works`, `publications`, `work_subjects`, `subjects`) — **no Manticore involvement**; the only text filter is a plain SQL `LIKE`. Course records reference a `program_id` FK into the `programs` table (degree programs by institution), but that table is currently empty, so `program_id` is a bare integer with no joinable program entity. Bibliography rows link to `works` (see [./works.md](./works.md)) and instructors are `persons` (see [./persons.md](./persons.md)); the same course→work reading-list relation also surfaces from the [./bibliographies.md](./bibliographies.md) domain.

All shared conventions — the `{ status, data, pagination, meta }` envelope, `page`/`limit` + `offset`/`limit` pagination, rate limiting, error codes/envelope, and automatic boolean/date normalization — are documented in [../00-conventions.md](../00-conventions.md) and are not repeated here. This domain requires no auth key; it is served under the general rate limiter.

> **Data-sparsity warning.** At the time of writing the domain is seeded with a **single test course** (`id=11111`, `code="B11111C"`, "Social Anthropology") that has **one instructor and zero bibliography/subject rows**. Every response below is real but minimal: the nested reading-list and subject listings are legitimately empty, and the statistics collapse to counts of 1. The DTO item shapes for bibliography and subject rows are therefore documented from the corrected swagger + DTO contract, and flagged as not-yet-observable with live data. Build the UI to the shapes below, not to the current row counts.

---

## `GET /courses`

List courses with instructor/bibliography rollup counts and a 3-name instructor preview. Backed by MariaDB; sort is fixed (`year DESC, semester, name`) and not client-controllable.

**Query parameters**

| param | type | default | accepted values / bounds | effect |
|---|---|---|---|---|
| `page` | integer | 1 | ≥ 1 | Page number (offset derived). |
| `limit` | integer | **10** | 1..100 | Page size. Out-of-range values are **silently clamped to 100**, not rejected — the controller does not enforce the attached validators, so `limit=999` returns 200 with `limit=100`. |
| `offset` | integer | 0 | ≥ 0 | Offset pagination; `offset`/`limit` and `page`/`limit` are both accepted. |
| `search` | string | — | 1..100 chars | Case-insensitive `LIKE %v%` over `c.name` **or** `c.code`. |
| `program_id` | integer | — | — | Exact match on `program_id`. |
| `year` | integer | — | — | Exact match on academic `year`. |
| `semester` | string | — | e.g. `"1"` | Exact match on the `semester` label (string, not int). |

There are no citation/sort params here — this listing has no client-controllable sort.

**Example requests**

```
GET /courses
GET /courses?limit=3
GET /courses?search=anthro
GET /courses?year=2026&semester=1
GET /courses?offset=0&limit=20&program_id=1
```

**Example response**

```json
{
  "status": "success",
  "data": [
    {
      "id": 11111,
      "_links": { "self": "/courses/11111" },
      "code": "B11111C",
      "name": "Social Anthropology",
      "credits": 1,
      "program_id": 1,
      "semester": "1",
      "year": 2026,
      "metrics": {
        "instructor_count": 1,
        "bibliography_count": 0
      },
      "instructors_preview": ["Bruno Cesar Cunha Cruz"],
      "created_at": "2026-07-18T20:46:20.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 3, "total": 1, "totalPages": 1, "hasNext": false, "hasPrev": false },
  "meta": {
    "filters": { "program_id": null, "year": null, "semester": null, "search": null },
    "performance": { "query_time_ms": 0 },
    "request": { "method": "GET", "path": "/courses?limit=3" },
    "pagination_extras": { "offset": 0 }
  }
}
```

**Fields (list item)**

| field (dot-path) | type | notes |
|---|---|---|
| `id` | integer | Course id. |
| `_links.self` | string | `/courses/{id}`. |
| `code` | string \| null | Course code, e.g. `"B11111C"`. |
| `name` | string \| null | Course name. |
| `credits` | integer \| null | Credit count. DTO applies `credits \|\| null`, so a stored `0` surfaces as `null`. |
| `program_id` | integer \| null | FK into the (currently empty) `programs` table; no joinable program object. |
| `semester` | string \| null | Semester label, e.g. `"1"`. String, not integer. |
| `year` | integer \| null | Academic year. |
| `metrics.instructor_count` | integer | DISTINCT instructors on the course. |
| `metrics.bibliography_count` | integer | DISTINCT bibliography works on the course. |
| `instructors_preview` | string[] | Up to 3 instructor `preferred_name`s (from a `GROUP_CONCAT`, split client-side by the API). |
| `created_at` | string(date-time) \| null | ISO 8601. |

**Meta**

| field | type | notes |
|---|---|---|
| `meta.filters` | object | Echoes applied filters (`program_id`, `year`, `semester`, `search`); `null` when absent. |
| `meta.performance.query_time_ms` | integer | **Placeholder, always `0`** (computed as `Date.now() - Date.now()`). Do not surface as a real latency. |
| `meta.pagination_extras.offset` | integer | Resolved offset for the page. |
| `meta.request` | object | `{ method, path }`. |

**Notes / caveats**
- `metrics` on the **list** carries only `instructor_count` and `bibliography_count` — there is **no `subject_count` key** here (the list SQL never computes it). `subject_count` appears only on the detail endpoint. See [../API_ISSUES.md](../API_ISSUES.md).
- `pagination.total` is an exact `COUNT(*)` (no statement-budget estimate on this small table); `pagination_total_exact` is not emitted for this domain.
- Sort is fixed and not overridable.

---

## `GET /courses/statistics`

Aggregate course counts plus year and semester distributions. No query params, no pagination.

**Example request**

```
GET /courses/statistics
```

**Example response**

```json
{
  "status": "success",
  "data": {
    "total_courses": 1,
    "programs_count": 1,
    "earliest_year": 2026,
    "latest_year": 2026,
    "semesters_count": 1,
    "avg_credits": "1.0000",
    "courses_with_credits": 1,
    "year_distribution": [ { "year": 2026, "course_count": 1, "program_count": 1 } ],
    "semester_distribution": [ { "semester": "1", "course_count": 1 } ]
  },
  "meta": { "request": { "method": "GET", "path": "/courses/statistics" } }
}
```

**Fields**

| field (dot-path) | type | notes |
|---|---|---|
| `total_courses` | integer | `COUNT(*)` of courses. |
| `programs_count` | integer | DISTINCT `program_id`. |
| `earliest_year` | integer \| null | `MIN(year)`. |
| `latest_year` | integer \| null | `MAX(year)`. |
| `semesters_count` | integer | DISTINCT `semester`. |
| `avg_credits` | **string** \| null | `AVG(credits)` as a MariaDB DECIMAL **string**, e.g. `"1.0000"` — NOT a JSON number; `parseFloat` before display. `null` when no credited courses exist. |
| `courses_with_credits` | integer | Count of courses with a non-null `credits`. |
| `year_distribution[]` | array | Top 10 years, DESC by year. |
| `year_distribution[].year` | integer | Academic year. |
| `year_distribution[].course_count` | integer | Courses in that year. |
| `year_distribution[].program_count` | integer | DISTINCT programs in that year. |
| `semester_distribution[]` | array | Per-semester counts (unbounded). |
| `semester_distribution[].semester` | string | Semester label. |
| `semester_distribution[].course_count` | integer | Courses in that semester. |

**Notes / caveats**
- `avg_credits` type/nullability mismatch vs the swagger `number` example is a known doc issue — treat it as a decimal string. See [../API_ISSUES.md](../API_ISSUES.md).
- `year_distribution` is capped at 10 rows; `semester_distribution` is not.

---

## `GET /courses/{id}`

Full course detail: base fields plus embedded bibliography, instructor, and derived-subject lists, each with a per-facet statistics block. Returns **404 `COURSE_NOT_FOUND`** for an unknown id.

**Path parameters**

| param | type | notes |
|---|---|---|
| `id` | integer (≥ 1) | Course id. |

**Query parameters** (all optional; honoured by the controller)

| param | type | default | effect |
|---|---|---|---|
| `include_bibliography` | boolean | `true` | `=false` drops `bibliography` and `bibliography_statistics`. |
| `include_instructors` | boolean | `true` | `=false` drops `instructors` and `instructor_statistics`. |
| `include_subjects` | boolean | `true` | `=false` drops `subjects` and `subject_statistics`. |
| `bibliography_limit` | integer | 50 | Cap on embedded bibliography rows (echoed in `meta.limits.bibliography`). |
| `instructors_limit` | integer | 20 | Cap on embedded instructor rows (echoed in `meta.limits.instructors`). |
| `subjects_limit` | integer | 30 | Cap on embedded subject rows (echoed in `meta.limits.subjects`). |

Booleans follow the shared falsy/normalization rules in [../00-conventions.md](../00-conventions.md).

**Example requests**

```
GET /courses/11111
GET /courses/11111?include_bibliography=false&include_subjects=false
GET /courses/11111?instructors_limit=1&bibliography_limit=100
```

**Example response**

```json
{
  "status": "success",
  "data": {
    "id": 11111,
    "_links": { "self": "/courses/11111" },
    "code": "B11111C",
    "name": "Social Anthropology",
    "credits": 1,
    "program_id": 1,
    "semester": "1",
    "year": 2026,
    "metrics": { "instructor_count": 1, "bibliography_count": 0, "subject_count": 0 },
    "instructors_preview": ["Bruno Cesar Cunha Cruz"],
    "created_at": "2026-07-18T20:46:20.000Z",
    "source_file": null,
    "bibliography": [],
    "instructors": [
      {
        "person_id": 11111,
        "preferred_name": "Bruno Cesar Cunha Cruz",
        "given_names": "Bruno Cesar Cunha",
        "family_name": "Cruz",
        "role": "PROFESSOR",
        "identifiers": { "orcid": "0000-0001-8652-2333" },
        "is_verified": true
      }
    ],
    "subjects": [],
    "bibliography_statistics": { "by_type": {}, "by_week": [] },
    "instructor_statistics": { "by_role": { "PROFESSOR": 1 } },
    "subject_statistics": { "by_vocabulary": {} }
  },
  "meta": {
    "includes": { "bibliography": true, "instructors": true, "subjects": true },
    "limits": { "bibliography": 50, "instructors": 20, "subjects": 30 },
    "request": { "method": "GET", "path": "/courses/11111" }
  }
}
```

**Fields — base (superset of the list-item fields)**

| field (dot-path) | type | notes |
|---|---|---|
| `id`, `_links.self`, `code`, `name`, `credits`, `program_id`, `semester`, `year`, `created_at` | — | Same semantics as the list item above. |
| `metrics.instructor_count` | integer | DISTINCT instructors. |
| `metrics.bibliography_count` | integer | DISTINCT bibliography works. |
| `metrics.subject_count` | integer | DISTINCT derived subjects — **computed on detail only** (0 when no bibliography linkage). |
| `instructors_preview` | string[] | Up to 3 instructor names. |
| `source_file` | string \| null | Provenance filename of the ingested syllabus; `null` when unknown. |

**Fields — `bibliography[]`** (embedded; empty for the seed course — shape from DTO)

| field (dot-path) | type | notes |
|---|---|---|
| `bibliography[].work_id` | integer | FK to `works`. |
| `bibliography[].title` | string \| null | Work title. |
| `bibliography[].publication_year` | integer \| null | From the work's latest publication (`pub.year`). |
| `bibliography[].language` | string \| null | ISO 639-1 from `works.language`. |
| `bibliography[].document_type` | string \| null | `publications.type` of the latest pub (`ARTICLE`/`BOOK`/`CHAPTER`/…). |
| `bibliography[].open_access` | boolean | True if the latest pub is open access. |
| `bibliography[].reading_type` | string \| null | One of `REQUIRED` / `RECOMMENDED` / `SUPPLEMENTARY` / `OPTIONAL`. |
| `bibliography[].week_number` | integer \| null | Syllabus week the reading is assigned to. |
| `bibliography[].notes` | string \| null | Free-text instructor note. |
| `bibliography[].authors_preview` | string[] | Author `preferred_name`s in authorship order. |
| `bibliography[].author_count` | integer | Total authors on the work. |
| `bibliography[].first_author_name` | string \| null | Convenience first-author name. |

**Fields — `instructors[]`** (embedded)

| field (dot-path) | type | notes |
|---|---|---|
| `instructors[].person_id` | integer | `canonical_person_id`, falling back to `person_id`. |
| `instructors[].preferred_name` | string \| null | Display name. |
| `instructors[].given_names` | string \| null | |
| `instructors[].family_name` | string \| null | |
| `instructors[].role` | string \| null | e.g. `PROFESSOR`. |
| `instructors[].identifiers.orcid` | string \| null | ORCID iD. |
| `instructors[].is_verified` | boolean | Whether the person record is verified. |

**Fields — `subjects[]`** (embedded; derived from `course_bibliography → work_subjects → subjects`; empty for seed course)

| field (dot-path) | type | notes |
|---|---|---|
| `subjects[].id` | integer | Subject id. |
| `subjects[].term` | string \| null | Subject term. |
| `subjects[].vocabulary` | string \| null | Controlled vocabulary (e.g. `Keyword`). |
| `subjects[].parent_id` | integer \| null | Parent subject (term hierarchy). |
| `subjects[].work_count` | integer | DISTINCT works in this course's bibliography carrying the subject. |

**Fields — statistics blocks**

| field (dot-path) | type | notes |
|---|---|---|
| `bibliography_statistics.by_type` | object map | `{ reading_type: { count, first_week, last_week } }`; `{}` when no bibliography. |
| `bibliography_statistics.by_week[]` | array | `[{ week_number, count, reading_types }]` where `reading_types` is a comma-joined string; `[]` when none. |
| `instructor_statistics.by_role` | object map | `{ role: count }`, e.g. `{ "PROFESSOR": 1 }`. |
| `subject_statistics.by_vocabulary` | object map | `{ vocabulary: { unique_subjects, works_covered } }`; `{}` when no subjects. |

**Meta**

| field | type | notes |
|---|---|---|
| `meta.includes` | object | `{ bibliography, instructors, subjects }` booleans reflecting the include flags actually applied. |
| `meta.limits` | object | `{ bibliography, instructors, subjects }` — the effective row caps. |
| `meta.request` | object | `{ method, path }`. |

**Notes / caveats**
- 404 `COURSE_NOT_FOUND` when the id does not exist (see the 404 envelope example under `/courses/{id}/instructors`).
- The embedded `bibliography`/`subjects` arrays and their statistics blocks are omitted entirely (not emptied) when the corresponding `include_*` flag is `false`; `meta.includes` mirrors this.
- Embedded arrays are convenience previews capped by the `*_limit` params; use the dedicated nested listings below for full pagination.

---

## `GET /courses/{id}/instructors`

Paginated instructor roster for a course. Sort is fixed (`role, preferred_name`). **404 `COURSE_NOT_FOUND`** when the course id does not exist (existence guard).

**Path parameters**

| param | type | notes |
|---|---|---|
| `id` | integer (≥ 1) | Course id. |

**Query parameters**

| param | type | default | accepted values / bounds | effect |
|---|---|---|---|---|
| `page` | integer | 1 | ≥ 1 | Page number. |
| `limit` | integer | **10** | 1..100 | Page size. |
| `offset` | integer | 0 | ≥ 0 | Offset pagination. |
| `role` | string | — | e.g. `PROFESSOR` | Exact match on `course_instructors.role`. |

**Example requests**

```
GET /courses/11111/instructors
GET /courses/11111/instructors?role=PROFESSOR
GET /courses/11111/instructors?limit=50&page=1
```

**Example response**

```json
{
  "status": "success",
  "data": [
    {
      "person_id": 11111,
      "preferred_name": "Bruno Cesar Cunha Cruz",
      "given_names": "Bruno Cesar Cunha",
      "family_name": "Cruz",
      "role": "PROFESSOR",
      "identifiers": { "orcid": "0000-0001-8652-2333" },
      "is_verified": true
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 1, "totalPages": 1, "hasNext": false, "hasPrev": false },
  "meta": {
    "course_id": 11111,
    "filters": { "role": null },
    "request": { "method": "GET", "path": "/courses/11111/instructors" },
    "pagination_extras": { "offset": 0 }
  }
}
```

**Fields (item)** — identical to the detail `instructors[]` shape.

| field (dot-path) | type | notes |
|---|---|---|
| `person_id` | integer | `canonical_person_id` (falls back to `person_id`). |
| `preferred_name` | string \| null | |
| `given_names` | string \| null | |
| `family_name` | string \| null | |
| `role` | string \| null | e.g. `PROFESSOR`. |
| `identifiers.orcid` | string \| null | |
| `is_verified` | boolean | |

**Meta**: `meta.course_id`, `meta.filters.role` (echo; `null` when absent), `meta.pagination_extras.offset`.

**404 envelope** (`GET /courses/99999999999/instructors`)

```json
{
  "status": "error",
  "message": "Course not found with ID 99999999999",
  "timestamp": "2026-07-23T18:54:27.450Z",
  "code": "COURSE_NOT_FOUND",
  "meta": { "request": { "method": "GET", "path": "/courses/99999999999/instructors" } }
}
```

**Notes / caveats**
- This is the **only** nested course listing with an existence guard. `/subjects` and `/bibliographies` return 200-empty for an unknown id instead of 404 (see below). See [../API_ISSUES.md](../API_ISSUES.md).
- Related person detail at [./persons.md](./persons.md); the same person as course instructor is also reachable via the [./instructors.md](./instructors.md) domain.

---

## `GET /courses/{id}/subjects`

Subjects derived from the course's bibliography works (`course_bibliography → work_subjects → subjects`). Sort is fixed (`work_count DESC, term`). **No existence guard** — an unknown course id returns HTTP 200 with an empty page.

**Path parameters**: `id` (integer ≥ 1).

**Query parameters**

| param | type | default | accepted values | effect |
|---|---|---|---|---|
| `page` | integer | 1 | ≥ 1 | Page number. |
| `limit` | integer | **10** | 1..100 | Page size. |
| `offset` | integer | 0 | ≥ 0 | Offset pagination. |
| `vocabulary` | string | — | — | Exact match on `subjects.vocabulary`. |

**Example requests**

```
GET /courses/11111/subjects
GET /courses/11111/subjects?vocabulary=Keyword
GET /courses/11111/subjects?limit=30
```

**Example response** (empty — the seed course has no bibliography→subject linkage)

```json
{
  "status": "success",
  "data": [],
  "pagination": { "page": 1, "limit": 10, "total": 0, "totalPages": 0, "hasNext": false, "hasPrev": false },
  "meta": {
    "course_id": 11111,
    "filters": { "vocabulary": null },
    "request": { "method": "GET", "path": "/courses/11111/subjects" },
    "pagination_extras": { "offset": 0 }
  }
}
```

**Fields (item)** — shape from DTO (not observable with current data)

| field (dot-path) | type | notes |
|---|---|---|
| `id` | integer | Subject id. |
| `term` | string \| null | Subject term. |
| `vocabulary` | string \| null | Controlled vocabulary. |
| `parent_id` | integer \| null | Parent subject (hierarchy). |
| `work_count` | integer | DISTINCT works in the course bibliography carrying that subject. |

**Meta**: `meta.course_id`, `meta.filters.vocabulary`, `meta.pagination_extras.offset`.

**Notes / caveats**
- Returns 200-empty (not 404) for an unknown course id — no existence guard.
- Empty for the seed course because its `course_bibliography` has zero rows; these subjects are a projection of the reading list, so they only appear once bibliography rows exist. Full subject entities live in [./subjects.md](./subjects.md).

---

## `GET /courses/{id}/bibliographies`

Paginated reading list for a course, each row carrying an author preview. Sort is fixed (`week_number, reading_type, title`). **No existence guard** — an unknown course id returns HTTP 200 with an empty page.

**Path parameters**: `id` (integer ≥ 1).

**Query parameters**

| param | type | default | accepted values | effect |
|---|---|---|---|---|
| `page` | integer | 1 | ≥ 1 | Page number. |
| `limit` | integer | **10** | 1..100 | Page size. |
| `offset` | integer | 0 | ≥ 0 | Offset pagination. |
| `reading_type` | string | — | `REQUIRED` \| `RECOMMENDED` \| `SUPPLEMENTARY` \| `OPTIONAL` | Exact match on reading type. |
| `week_number` | integer | — | — | Exact match on syllabus week. |

**Example requests**

```
GET /courses/11111/bibliographies
GET /courses/11111/bibliographies?reading_type=REQUIRED
GET /courses/11111/bibliographies?week_number=1&limit=50
```

**Example response** (empty — no bibliography rows for the seed course)

```json
{
  "status": "success",
  "data": [],
  "pagination": { "page": 1, "limit": 10, "total": 0, "totalPages": 0, "hasNext": false, "hasPrev": false },
  "meta": {
    "course_id": 11111,
    "filters": { "reading_type": null, "week_number": null },
    "request": { "method": "GET", "path": "/courses/11111/bibliographies" },
    "pagination_extras": { "offset": 0 }
  }
}
```

**Fields (item)** — shape from DTO (not observable with current data)

| field (dot-path) | type | notes |
|---|---|---|
| `work_id` | integer | FK to `works`. |
| `title` | string \| null | Work title. |
| `publication_year` | integer \| null | From the latest publication (`pub.year`). |
| `language` | string \| null | ISO 639-1 from `works.language`. |
| `document_type` | string \| null | `publications.type` of the latest pub (`ARTICLE`/`BOOK`/`CHAPTER`/…). |
| `open_access` | boolean | True if the latest pub is open access. |
| `reading_type` | string \| null | `REQUIRED` / `RECOMMENDED` / `SUPPLEMENTARY` / `OPTIONAL`. |
| `week_number` | integer \| null | Assigned syllabus week. |
| `notes` | string \| null | Instructor note. |
| `authors_preview` | string[] | Author `preferred_name`s in authorship order. |
| `author_count` | integer | Total authors on the work. |
| `first_author_name` | string \| null | Convenience first-author name. |

**Meta**: `meta.course_id`, `meta.filters` (`reading_type`, `week_number`), `meta.pagination_extras.offset`.

**Notes / caveats**
- Returns 200-empty (not 404) for an unknown course id — no existence guard.
- Empty for the seed course because `course_bibliography` has no rows for it. Each row projects a `works` record; use [./works.md](./works.md) / [./publications.md](./publications.md) for the full work/publication detail, and [./bibliographies.md](./bibliographies.md) for the cross-entity reading-list surface (also reachable as `/works/{id}/bibliographies`).
