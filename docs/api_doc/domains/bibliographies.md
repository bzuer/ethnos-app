# Bibliographies — course reading lists over the works corpus

This domain exposes **course-reading assignments**: the join of academic courses to the works they assign as reading. Each bibliography row is one `(course_id, work_id)` pair drawn from the `course_bibliography` base table, enriched with course metadata (`courses`), work/publication metadata (`works` + latest `publications`), and — on the filtered path — author and instructor names. There is no full-text engine here: every query runs against MariaDB with plain B-tree joins and a fixed sort. The domain relates to [courses](./courses.md) (the parent course entities and their instructors), [works](./works.md)/[publications](./publications.md) (the assigned readings), and [instructors](./instructors.md) (course teachers). Global conventions — response envelope, pagination (`page/limit` + `offset/limit`), rate limiting, error codes, boolean/date normalization — are in [../00-conventions.md](../00-conventions.md) and are not repeated here.

> **Data state (read this first).** In the live database the `course_bibliography` table is **empty (0 rows)**; `courses`, `course_instructors`, and `programs` each hold exactly 1 row. Course-data loading is a pending operator-side task, not an API defect (see [../API_ISSUES.md](../API_ISSUES.md)). Consequently **all three endpoints currently return structurally valid but empty payloads** — `[]` lists, empty aggregation arrays, and zero/`null` statistics. The field inventories below are the true, complete contract (derived from the DTO and service SQL); the "populated example" JSON blocks show the shape each field takes once data is loaded, while the "live response" blocks show exactly what the API returns today. A frontend must render both the empty and populated states.

---

## `GET /bibliographies`

List bibliography entries (works assigned as course reading), one row per `(course_id, work_id)`. Public, no auth. Backed by MariaDB: `course_bibliography cb` joined to `courses`, `works`, and each work's latest `publications` row; author/instructor names come from follow-up subqueries on the non-light path.

**Query parameters** (all optional):

| param | type | default | accepted values / bounds | effect |
|---|---|---|---|---|
| `page` | integer | 1 | ≥ 1 | page number (page/limit pagination) |
| `limit` | integer | 10 (via `normalizePagination` when omitted) | 1..100; > 100 → 400 `VALIDATION_ERROR` | page size |
| `offset` | integer | 0 | ≥ 0 | offset pagination; accepted simultaneously with `page`/`limit` |
| `course_id` | integer | — | ≥ 1 | filter `cb.course_id` |
| `work_id` | integer | — | ≥ 1 | filter `cb.work_id` |
| `instructor_id` | integer | — | ≥ 1 | keep only rows whose course has this instructor (`course_instructors.canonical_person_id`) |
| `reading_type` | string | — | 1..50 chars | exact match on `cb.reading_type` (e.g. `required`, `recommended`) |
| `week_number` | integer | — | ≥ 1 | filter `cb.week_number` |
| `year_from` | integer | — | 1900..2030 | `courses.year >=` |
| `year_to` | integer | — | 1900..2030 | `courses.year <=` |
| `program_id` | integer | — | ≥ 1 | filter `courses.program_id` |
| `search` | string | — | 1..255 chars | LIKE across `works.title`, `courses.name`, `courses.code` |
| `light` | boolean | auto | `true`/`false` (see conventions for boolean coercion) | forces the lightweight query, dropping the `author_count`/`instructors` subqueries (they return `null`) |

There are **no** citation/sort params in this domain and the sort is **not** client-controllable — it is fixed at `courses.year DESC, semester, week_number, reading_type, title`.

**Light-mode auto-behaviour (important for the UI).** The service auto-enables light mode whenever **none** of `course_id`, `instructor_id`, `search` is supplied. So the default bare listing (`GET /bibliographies`) is already "light" and returns `author_count` and `instructors` as `null`. To get populated `author_count`/`instructors`, pass at least one of those three filters and do not pass `light=true`.

**Example requests**

```
GET /bibliographies
GET /bibliographies?limit=3
GET /bibliographies?course_id=1                       # non-light path: author_count + instructors populated
GET /bibliographies?program_id=42&reading_type=required&year_from=2020&year_to=2024
GET /bibliographies?search=cultures&instructor_id=17&page=2&limit=25
GET /bibliographies?offset=5&limit=2                  # offset pagination
```

**Example response (live, empty)**

```json
{
  "status": "success",
  "data": [],
  "pagination": { "page": 1, "limit": 3, "total": 0, "totalPages": 0, "hasNext": false, "hasPrev": false },
  "meta": {
    "source": "bibliography.service",
    "request": { "method": "GET", "path": "/bibliographies?limit=3" },
    "pagination_extras": { "offset": 0 }
  }
}
```

**Example `data[]` element (populated shape, once course data is loaded)**

```json
{
  "course_id": 11111,
  "work_id": 22519667,
  "reading_type": "required",
  "week_number": 3,
  "notes": "read chapters 1-2",
  "course_code": "ANT501",
  "course_name": "Intro to Anthropology",
  "course_year": 2024,
  "semester": "1",
  "program_id": 42,
  "title": "The Interpretation of Cultures",
  "publication_year": 1973,
  "open_access": false,
  "language": "en",
  "document_type": "BOOK",
  "author_count": 1,
  "first_author_name": "Clifford Geertz",
  "instructors": "Jane Doe; John Smith",
  "authors": ["Clifford Geertz"]
}
```

**Fields (`data[]`)** — every element carries all of these keys regardless of light mode; in light mode `author_count`/`instructors` are `null`.

| field | type | notes |
|---|---|---|
| `course_id` | integer \| null | FK `courses.id` |
| `work_id` | integer \| null | FK `works.id` — link to [/works/{id}](./works.md) |
| `reading_type` | string \| null | free text from `course_bibliography.reading_type` (e.g. `required`, `recommended`); ≤ 50 chars |
| `week_number` | integer \| null | course week the reading is assigned to |
| `notes` | string \| null | `course_bibliography.notes` |
| `course_code` | string \| null | `courses.code` |
| `course_name` | string \| null | `courses.name` |
| `course_year` | integer \| null | `courses.year` |
| `semester` | string \| null | `courses.semester` (e.g. `"1"`, `"2"`) |
| `program_id` | integer \| null | `courses.program_id` |
| `title` | string \| null | `works.title` |
| `publication_year` | integer \| null | latest publication year for the work (`MAX(publications.year)`) |
| `open_access` | boolean \| null | from the latest publication's `open_access` |
| `language` | string \| null | `works.language` (ISO 639-1) |
| `document_type` | string \| null | latest publication `type`; enum `ARTICLE\|BOOK\|CHAPTER\|THESIS\|CONFERENCE\|CONFERENCE_PAPER\|REPORT\|DATASET\|PREPRINT\|REVIEW\|EDITORIAL\|OTHER` |
| `author_count` | integer \| null | count of authorships for the work; **`null` in light mode** |
| `first_author_name` | string \| null | first author's `preferred_name` (by authorship position) |
| `instructors` | string \| null | `"; "`-separated distinct instructor preferred names for the course; **`null` in light mode** |
| `authors` | string[] | author preferred names ordered by authorship position; `[]` when none |

**Notes / caveats**
- `pagination.total` is a plain exact `COUNT` for this listing (no statement-budget estimate flag; the join is small). No `meta.pagination_total_exact`, `meta.engine`, or `meta.match_mode` appear in this domain.
- `meta.source` is always `"bibliography.service"`; `meta.pagination_extras.offset` echoes the resolved offset.
- To populate `author_count`/`instructors`, send a non-light filtered request (`course_id`, `instructor_id`, or `search`) — see light-mode auto-behaviour above.
- Currently returns `[]` for every query (empty `course_bibliography`). This is expected, not a 5xx/404 — see the data-state note at the top and [../API_ISSUES.md](../API_ISSUES.md).

---

## `GET /bibliographies/analyses`

Aggregate analytics over course bibliographies: most-reused works, per-year trends, and reading-type / document-type distributions. Public, no auth. MariaDB aggregation queries; returns a **single object** under `data` (no pagination envelope). Column names are raw SQL output (not passed through a DTO).

**Query parameters** (all optional):

| param | type | default | accepted values / bounds | effect |
|---|---|---|---|---|
| `year_from` | integer | — | 1900..2030 | `courses.year >=` on all four aggregations |
| `year_to` | integer | — | 1900..2030 | `courses.year <=` on all four aggregations |
| `program_id` | integer | — | ≥ 1 | `courses.program_id =` on all four aggregations |
| `reading_type` | string | — | 1..50 chars | `cb.reading_type =` on all four aggregations |
| `limit` | integer | 20 | 1..100 | caps **`most_used_works` only**; `trends_by_year` is fixed at 10, `document_type_distribution` at 10, `reading_type_distribution` is unbounded |

**Example requests**

```
GET /bibliographies/analyses
GET /bibliographies/analyses?limit=50
GET /bibliographies/analyses?program_id=42&year_from=2018&year_to=2024
GET /bibliographies/analyses?reading_type=required
```

**Example response (live, empty)**

```json
{
  "status": "success",
  "data": {
    "most_used_works": [],
    "trends_by_year": [],
    "reading_type_distribution": [],
    "document_type_distribution": []
  },
  "meta": { "request": { "method": "GET", "path": "/bibliographies/analyses" } }
}
```

**Populated element shapes (once course data is loaded)**

```json
{
  "most_used_works": [
    {
      "id": 22519667,
      "title": "The Interpretation of Cultures",
      "publication_year": 1973,
      "open_access": false,
      "document_type": "BOOK",
      "used_in_courses": 5,
      "used_in_programs": 2,
      "reading_types": ["required", "recommended"]
    }
  ],
  "trends_by_year": [
    { "year": 2024, "works_count": 40, "courses_count": 12, "programs_count": 3, "avg_publication_year": 1998.4 }
  ],
  "reading_type_distribution": [
    { "reading_type": "required", "count": 120, "unique_works": 95, "courses": 30 }
  ],
  "document_type_distribution": [
    { "document_type": "ARTICLE", "usage_count": 200, "unique_works": 180, "courses_count": 45 }
  ]
}
```

**Fields**

`data` (top-level object):

| field | type | notes |
|---|---|---|
| `most_used_works` | array | works reused across courses, ordered `used_in_courses DESC, used_in_programs DESC`; capped at `limit` |
| `trends_by_year` | array | per-year usage, ordered `year DESC`, **fixed LIMIT 10** |
| `reading_type_distribution` | array | usage per reading_type, ordered `count DESC`, unbounded |
| `document_type_distribution` | array | usage per document type, ordered `usage_count DESC`, **fixed LIMIT 10** |

`most_used_works[]`:

| field | type | notes |
|---|---|---|
| `id` | integer | `works.id` |
| `title` | string \| null | `works.title` |
| `publication_year` | integer \| null | latest publication year |
| `open_access` | boolean \| null | latest publication `open_access` (coerced to bool) |
| `document_type` | string \| null | latest publication `type` enum (see enum list above) |
| `used_in_courses` | integer | `COUNT(DISTINCT course_id)` |
| `used_in_programs` | integer | `COUNT(DISTINCT program_id)` |
| `reading_types` | string[] | distinct reading_type values for this work (comma-split by the service) |

`trends_by_year[]`:

| field | type | notes |
|---|---|---|
| `year` | integer \| null | `courses.year` |
| `works_count` | integer | `COUNT(DISTINCT work_id)` |
| `courses_count` | integer | `COUNT(DISTINCT course_id)` |
| `programs_count` | integer | `COUNT(DISTINCT program_id)` |
| `avg_publication_year` | number \| null | `AVG(publications.year)`, fractional |

`reading_type_distribution[]`:

| field | type | notes |
|---|---|---|
| `reading_type` | string \| null | the reading type |
| `count` | integer | total bibliography rows of that type |
| `unique_works` | integer | `COUNT(DISTINCT work_id)` |
| `courses` | integer | `COUNT(DISTINCT course_id)` |

`document_type_distribution[]`:

| field | type | notes |
|---|---|---|
| `document_type` | string \| null | latest publication `type` enum |
| `usage_count` | integer | total bibliography rows |
| `unique_works` | integer | `COUNT(DISTINCT works.id)` |
| `courses_count` | integer | `COUNT(DISTINCT course_id)` |

**Notes / caveats**
- No pagination — the four arrays live under one `data` object; `meta` carries only `request`.
- `limit` affects `most_used_works` only; the other three arrays have fixed/unbounded sizes as noted.
- Note the inconsistent count-key naming across the four blocks (`courses` vs `courses_count`, `count` vs `usage_count`) — the table above is authoritative per block.
- All arrays empty today (empty `course_bibliography`).

---

## `GET /bibliographies/statistics`

Global rollup counts over course bibliographies. Public, no auth. MariaDB aggregation; returns a **single object** under `data` (no pagination). **No query parameters** (the validator array is empty).

**Example requests**

```
GET /bibliographies/statistics
```

**Example response (live)** — fields are always present, so the shape is fully observable even while empty:

```json
{
  "status": "success",
  "data": {
    "total_bibliography_entries": 0,
    "unique_works": 0,
    "courses_with_bibliography": 0,
    "programs_with_bibliography": 0,
    "avg_works_per_course": null,
    "max_works_per_course": null,
    "reading_type_distribution": [],
    "year_range": {
      "earliest_course_year": null,
      "latest_course_year": null,
      "earliest_publication_year": null,
      "latest_publication_year": null,
      "avg_publication_year": null
    }
  },
  "meta": { "request": { "method": "GET", "path": "/bibliographies/statistics" } }
}
```

**Fields (`data`)**

| field | type | notes |
|---|---|---|
| `total_bibliography_entries` | integer | `COUNT(*)` of `course_bibliography` rows |
| `unique_works` | integer | `COUNT(DISTINCT work_id)` |
| `courses_with_bibliography` | integer | `COUNT(DISTINCT course_id)` |
| `programs_with_bibliography` | integer | `COUNT(DISTINCT program_id)` |
| `avg_works_per_course` | number \| null | average works per course; `null` when empty |
| `max_works_per_course` | integer \| null | max works on any one course; `null` when empty |
| `reading_type_distribution` | array | per reading_type object (see below), ordered `count DESC` |
| `year_range` | object | nested year bounds (see below) |

`reading_type_distribution[]`:

| field | type | notes |
|---|---|---|
| `reading_type` | string \| null | the reading type |
| `count` | integer | rows of that type |
| `percentage` | number | `count * 100 / total`, 2 decimal places |

`year_range`:

| field | type | notes |
|---|---|---|
| `earliest_course_year` | integer \| null | `MIN(courses.year)` |
| `latest_course_year` | integer \| null | `MAX(courses.year)` |
| `earliest_publication_year` | integer \| null | `MIN(publications.year)` |
| `latest_publication_year` | integer \| null | `MAX(publications.year)` |
| `avg_publication_year` | number \| null | `AVG(publications.year)`, fractional |

**Notes / caveats**
- Scalar count fields are `0` and the average/max/year fields are `null` while `course_bibliography` is empty; `reading_type_distribution` is `[]`. This is the true empty state, not an error.
- `meta` carries only `request`. No pagination.
- Note `reading_type_distribution` here exposes `{reading_type, count, percentage}` — a different shape than the same-named block in `/analyses` (`{reading_type, count, unique_works, courses}`). Do not share a renderer between the two.
