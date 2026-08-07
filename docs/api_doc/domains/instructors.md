# Instructors — course teaching staff and their teaching/authorship profiles

The instructors domain exposes the subset of **persons** who appear in the `course_instructors` join table (i.e. people who teach at least one course). An instructor is a `persons` row surfaced through `persons → course_instructors → courses`, enriched with teaching aggregates, and — on the rich statistics endpoint — cross-referenced against the person's own authorship record (`authorships`, `signatures`) and their courses' bibliographies (`course_bibliography → work_subjects → subjects`). No full-text engine is involved; every query is plain MariaDB. This domain is the teaching-staff counterpart of [courses](./courses.md) and overlaps with [persons](./persons.md) (an instructor is always a person) and [bibliographies](./bibliographies.md) (the works assigned as course readings).

All endpoints are public (no key), governed only by the shared rate limiter. See [00-conventions](../00-conventions.md) for the response envelope, pagination (`page`/`limit` and `offset`/`limit`), error codes, boolean/date normalization, and shared `meta` flags.

> **Data-load caveat (read first).** The course/instructor corpus is essentially a single seeded record. Today `GET /instructors` returns exactly **one** instructor (`person_id=11111`, "Bruno Cesar Cunha Cruz") teaching one course ("Social Anthropology", 2026). That course has no `course_bibliography` rows loaded yet, so `/subjects`, `/bibliographies`, and the analytical sub-arrays of `/statistics` come back **empty by design, not by fault**. Course-data loading is an operator-side follow-up (see [../API_ISSUES.md](../API_ISSUES.md)). The field inventories below document the *full* shape each response takes once data is loaded; the pasted examples show the current sparse reality.

---

## `GET /instructors`

List instructors (persons teaching ≥1 course), ranked by number of courses taught. MariaDB-backed; no full-text.

**Query parameters** (all optional):

| param | type | default | accepted values / bounds | effect |
|---|---|---|---|---|
| `page` | integer | 1 | ≥1 | Standard pagination. |
| `limit` | integer | 10 | ≥1 | Page size. |
| `offset` | integer | 0 | ≥0 | Alternative to `page`; both accepted (see 00-conventions). |
| `role` | string | — | length 1–100 | Exact match on `course_instructors.role` (e.g. `PROFESSOR`). |
| `program_id` | integer | — | ≥1 | Exact match on `courses.program_id`. |
| `year_from` | integer | — | 1900 .. currentYear+1 | Keep instructors teaching a course with `year >=` this. Out-of-range → 400. |
| `year_to` | integer | — | 1900 .. currentYear+1 | Keep instructors teaching a course with `year <=` this. |
| `search` | string | — | length 2–200 | `LIKE %v%` across `preferred_name` / `given_names` / `family_name`. |

There is **no sort parameter** — ordering is fixed at `courses_taught DESC, preferred_name ASC`.

**Example requests**
```
GET /instructors?limit=3
GET /instructors?role=PROFESSOR&program_id=1&year_from=2025&year_to=2026
GET /instructors?search=Cruz
GET /instructors?offset=0&limit=1
```

**Example response**
```json
{
  "status": "success",
  "data": [
    {
      "id": 11111,
      "person_id": 11111,
      "preferred_name": "Bruno Cesar Cunha Cruz",
      "given_names": "Bruno Cesar Cunha",
      "family_name": "Cruz",
      "identifiers": { "orcid": "0000-0001-8652-2333", "lattes_id": null, "scopus_id": null },
      "is_verified": true,
      "teaching_metrics": {
        "courses_taught": 1,
        "programs_count": 1,
        "teaching_span": { "earliest_year": 2026, "latest_year": 2026 }
      },
      "roles": ["PROFESSOR"],
      "program_ids": [1]
    }
  ],
  "pagination": { "page": 1, "limit": 3, "total": 1, "totalPages": 1, "hasNext": false, "hasPrev": false },
  "meta": {
    "filters": { "role": null, "program_id": null, "year_from": null, "year_to": null, "search": null },
    "request": { "method": "GET", "path": "/instructors?limit=3" },
    "pagination_extras": { "offset": 0 }
  }
}
```

**Fields**

| field (dot-path) | type | notes |
|---|---|---|
| `data[].id` | integer | Same value as `person_id` (`persons.id`). |
| `data[].person_id` | integer | `persons.id`. |
| `data[].preferred_name` | string\|null | Display name. |
| `data[].given_names` | string\|null | |
| `data[].family_name` | string\|null | |
| `data[].identifiers.orcid` | string\|null | ORCID, e.g. `0000-0001-8652-2333`. |
| `data[].identifiers.lattes_id` | string\|null | Lattes CV id. |
| `data[].identifiers.scopus_id` | string\|null | Scopus author id. |
| `data[].is_verified` | boolean | `persons.is_verified`. |
| `data[].teaching_metrics.courses_taught` | integer | `COUNT(DISTINCT course)`. Primary sort key. |
| `data[].teaching_metrics.programs_count` | integer | `COUNT(DISTINCT program)`. |
| `data[].teaching_metrics.teaching_span.earliest_year` | integer\|null | `MIN(courses.year)`. |
| `data[].teaching_metrics.teaching_span.latest_year` | integer\|null | `MAX(courses.year)`. |
| `data[].roles` | string[] | Distinct `course_instructors.role` values (e.g. `["PROFESSOR"]`). |
| `data[].program_ids` | integer[] | Distinct program ids the instructor teaches in. |
| `pagination.*` | object | Standard block (see 00-conventions). |
| `meta.filters` | object | Echo of the 5 filter params (null when unset). |
| `meta.pagination_extras.offset` | integer | Applied offset. |

**Notes / caveats**
- `pagination.total` is exact here (small table; no statement-budget estimate flag). No page under-fill.
- Currently returns exactly 1 row — see the data-load caveat above.
- A validation failure (e.g. `year_from=1800`) returns HTTP 400 with `code: VALIDATION_ERROR` and the express-validator `errors[]` array (`{type,value,msg,path,location}`).

---

## `GET /instructors/statistics`

Corpus-wide instructor aggregates plus a top-instructors leaderboard. No query params, no pagination.

**Example request**
```
GET /instructors/statistics
```

**Example response**
```json
{
  "status": "success",
  "data": {
    "total_instructors": 1,
    "total_courses_taught": 1,
    "programs_with_instructors": 1,
    "avg_courses_per_instructor": "1.0000",
    "role_distribution": [
      { "role": "PROFESSOR", "instructor_count": 1, "assignment_count": 1 }
    ],
    "top_instructors": [
      { "preferred_name": "Bruno Cesar Cunha Cruz", "courses_taught": 1, "programs_count": 1, "earliest_year": 2026, "latest_year": 2026 }
    ]
  },
  "meta": { "request": { "method": "GET", "path": "/instructors/statistics" } }
}
```

**Fields**

| field (dot-path) | type | notes |
|---|---|---|
| `data.total_instructors` | integer | Distinct instructors. |
| `data.total_courses_taught` | integer | Distinct courses that have an instructor. |
| `data.programs_with_instructors` | integer | Distinct programs. |
| `data.avg_courses_per_instructor` | **string** | MySQL `AVG` decimal string, e.g. `"1.0000"` — **not** a JSON number. Parse client-side. |
| `data.role_distribution[].role` | string | Role name (e.g. `PROFESSOR`). |
| `data.role_distribution[].instructor_count` | integer | Distinct instructors in that role. |
| `data.role_distribution[].assignment_count` | integer | Row count (assignments) for that role. |
| `data.top_instructors[].preferred_name` | string | Top 10 by `courses_taught`. |
| `data.top_instructors[].courses_taught` | integer | |
| `data.top_instructors[].programs_count` | integer | |
| `data.top_instructors[].earliest_year` | integer\|null | `MIN(course year)`. |
| `data.top_instructors[].latest_year` | integer\|null | `MAX(course year)`. |

**Notes / caveats**
- `avg_courses_per_instructor` type mismatch (string, not float) is intentional; do not assume numeric.
- No filters — this is a whole-corpus snapshot.

---

## `GET /instructors/{id}`

Single-instructor detail. Returns 404 when the person id is not present in `course_instructors` (a person who exists but teaches nothing is **not** an instructor).

**Path parameters**

| param | type | notes |
|---|---|---|
| `id` | integer ≥1 | `persons.id`. Must be an active instructor. |

**Example requests**
```
GET /instructors/11111
GET /instructors/99999999999   # -> 404 INSTRUCTOR_NOT_FOUND
```

**Example response**
```json
{
  "status": "success",
  "data": {
    "id": 11111,
    "person_id": 11111,
    "preferred_name": "Bruno Cesar Cunha Cruz",
    "given_names": "Bruno Cesar Cunha",
    "family_name": "Cruz",
    "identifiers": { "orcid": "0000-0001-8652-2333", "lattes_id": null, "scopus_id": null },
    "is_verified": true,
    "teaching_metrics": {
      "courses_taught": 1,
      "programs_count": 1,
      "teaching_span": { "earliest_year": 2026, "latest_year": 2026 },
      "bibliography_contributed": 0
    },
    "roles": ["PROFESSOR"],
    "program_ids": [1],
    "created_at": "2026-07-18T20:52:01.000Z"
  },
  "meta": { "request": { "method": "GET", "path": "/instructors/11111" } }
}
```

**Fields** — same shape as a list item, plus these detail-only fields:

| field (dot-path) | type | notes |
|---|---|---|
| `data.id` / `data.person_id` | integer | Both equal `persons.id`. |
| `data.preferred_name` / `given_names` / `family_name` | string\|null | |
| `data.identifiers.{orcid,lattes_id,scopus_id}` | string\|null | |
| `data.is_verified` | boolean | |
| `data.teaching_metrics.courses_taught` | integer | |
| `data.teaching_metrics.programs_count` | integer | |
| `data.teaching_metrics.teaching_span.{earliest_year,latest_year}` | integer\|null | |
| `data.teaching_metrics.bibliography_contributed` | integer | **Detail-only.** `COUNT(DISTINCT course_bibliography.work_id)` across taught courses. |
| `data.roles` | string[] | Distinct roles. |
| `data.program_ids` | integer[] | Distinct program ids. On the live (fixed) API this is populated (`[1]`), matching the list. |
| `data.created_at` | string(date-time)\|null | `persons.created_at`, ISO 8601. **Detail-only.** |

**Notes / caveats**
- 404 shape: `{ status:"error", message:"Instructor not found with ID {id}", code:"INSTRUCTOR_NOT_FOUND" }`.
- To fetch a person who is not an instructor, use [persons](./persons.md) instead.

---

## `GET /instructors/{id}/courses`

Paginated list of courses taught by the instructor, ordered `year DESC, semester, name`. Unlike `/instructors/{id}`, an unknown id here yields an **empty page (total 0), not a 404**.

**Path parameters**: `id` (integer ≥1).

**Query parameters** (all optional):

| param | type | default | accepted values / bounds | effect |
|---|---|---|---|---|
| `page` / `limit` / `offset` | integer | 1 / 10 / 0 | standard | Pagination. |
| `year_from` | integer | — | 1900 .. cy+1 | `courses.year >=` this. |
| `year_to` | integer | — | 1900 .. cy+1 | `courses.year <=` this. |
| `program_id` | integer | — | ≥1 | Exact `courses.program_id`. |
| `semester` | string | — | length 1–20 | Exact `courses.semester`. |
| `role` | string | — | length 1–100 | Exact instructor role in the course. |

**Example requests**
```
GET /instructors/11111/courses
GET /instructors/11111/courses?year_from=2026&program_id=1
GET /instructors/11111/courses?role=PROFESSOR&semester=1
```

**Example response**
```json
{
  "status": "success",
  "data": [
    {
      "id": 11111,
      "code": "B11111C",
      "name": "Social Anthropology",
      "credits": 1,
      "program_id": 1,
      "semester": "1",
      "year": 2026,
      "role": "PROFESSOR",
      "metrics": { "bibliography_count": 0, "co_instructors_count": 0 }
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 1, "totalPages": 1, "hasNext": false, "hasPrev": false },
  "meta": {
    "instructor_id": 11111,
    "filters": { "year_from": null, "year_to": null, "program_id": null, "semester": null, "role": null },
    "request": { "method": "GET", "path": "/instructors/11111/courses" },
    "pagination_extras": { "offset": 0 }
  }
}
```

**Fields**

| field (dot-path) | type | notes |
|---|---|---|
| `data[].id` | integer | `courses.id`. |
| `data[].code` | string\|null | Course code, e.g. `B11111C`. |
| `data[].name` | string\|null | Course title. |
| `data[].credits` | integer\|null | |
| `data[].program_id` | integer\|null | |
| `data[].semester` | string\|null | e.g. `"1"`. |
| `data[].year` | integer\|null | |
| `data[].role` | string\|null | Instructor's role in this course. |
| `data[].metrics.bibliography_count` | integer | Distinct bibliography works for the course. |
| `data[].metrics.co_instructors_count` | integer | Other instructors on the course. |
| `meta.instructor_id` | integer | Echo of path id. |
| `meta.filters` | object | Echo of the 5 filters (null when unset). |

**Notes / caveats**
- No parent-existence guard: an unknown/non-instructor id returns `data: []`, `total: 0` (200, not 404). Use `/instructors/{id}` first if you need the 404 semantics.
- For the full course record (all instructors, full bibliography), follow `id` to [courses](./courses.md) `GET /courses/{id}`.

---

## `GET /instructors/{id}/statistics`

Rich combined teaching + authorship analytics for one instructor. **Gates on `course_instructors` membership → 404 for non-instructors.** No pagination, no query params.

**Path parameters**: `id` (integer ≥1, must be an instructor).

**Example request**
```
GET /instructors/11111/statistics
```

**Example response** (sub-arrays empty here because this instructor has no loaded bibliography/authorship data):
```json
{
  "status": "success",
  "data": {
    "person": {
      "id": 11111,
      "preferred_name": "Bruno Cesar Cunha Cruz",
      "given_names": "Bruno Cesar Cunha",
      "family_name": "Cruz",
      "name_variations": [],
      "identifiers": { "orcid": "0000-0001-8652-2333", "lattes_id": null, "scopus_id": null },
      "is_verified": true,
      "created_at": "2026-07-18T20:52:01.000Z"
    },
    "teaching_profile": {
      "courses_taught": 1,
      "programs_count": 1,
      "bibliography_items_used": 0,
      "unique_collaborators": 0,
      "teaching_span": { "start_year": 2026, "end_year": 2026, "span_years": 1 },
      "teaching_roles": ["PROFESSOR"]
    },
    "authorship_profile": {
      "works_authored": 0,
      "unique_signatures": 1,
      "confirmed_authorships": 0,
      "publication_span": { "first_year": null, "latest_year": null }
    },
    "signatures": [
      { "id": 11111, "signature": "CRUZ B C C", "works_with_signature": 0 }
    ],
    "recent_authored_works": [],
    "bibliography_usage_patterns": [],
    "most_used_authors_in_courses": [],
    "subject_expertise": [],
    "teaching_collaborators": [],
    "combined_statistics": {
      "total_academic_span_years": 1,
      "academic_productivity_ratio": "0.00",
      "bibliography_diversity_score": 0,
      "signature_consistency_score": 0
    }
  },
  "meta": { "request": { "method": "GET", "path": "/instructors/11111/statistics" } }
}
```

**Fields** — `person` block:

| field (dot-path) | type | notes |
|---|---|---|
| `data.person.id` | integer | `persons.id`. |
| `data.person.preferred_name` / `given_names` / `family_name` | string\|null | |
| `data.person.name_variations` | array | Always `[]` (hardcoded placeholder in the DTO). |
| `data.person.identifiers.{orcid,lattes_id,scopus_id}` | string\|null | |
| `data.person.is_verified` | boolean | |
| `data.person.created_at` | string(date-time)\|null | |

`teaching_profile` block:

| field (dot-path) | type | notes |
|---|---|---|
| `data.teaching_profile.courses_taught` | integer | |
| `data.teaching_profile.programs_count` | integer | |
| `data.teaching_profile.bibliography_items_used` | integer | Distinct bibliography works across the instructor's courses. |
| `data.teaching_profile.unique_collaborators` | integer | Distinct co-instructors. |
| `data.teaching_profile.teaching_span.start_year` / `end_year` | integer\|null | |
| `data.teaching_profile.teaching_span.span_years` | integer | `end - start + 1`. |
| `data.teaching_profile.teaching_roles` | string[] | |

`authorship_profile` block (sourced from the `persons` metric columns, not the teaching tables):

| field (dot-path) | type | notes |
|---|---|---|
| `data.authorship_profile.works_authored` | integer | `= persons.total_works`. |
| `data.authorship_profile.unique_signatures` | integer | `1` if `persons.signature_id` is set, else `0`. |
| `data.authorship_profile.confirmed_authorships` | integer | Same source as `works_authored`. |
| `data.authorship_profile.publication_span.first_year` / `latest_year` | integer\|null | `persons.first/latest_publication_year`. |

`signatures[]` — one row per signature form linked to the person:

| field (dot-path) | type | notes |
|---|---|---|
| `data.signatures[].id` | integer | `signatures.id`. |
| `data.signatures[].signature` | string | Signature text, e.g. `CRUZ B C C`. |
| `data.signatures[].works_with_signature` | integer | Count of authorships for the person. |

Analytical arrays (empty until bibliography/authorship data is loaded — shapes below are authoritative for once-populated rendering):

| field (dot-path) | type | element shape / notes |
|---|---|---|
| `data.recent_authored_works[]` | array | Up to 10; each `{ id, title, year, work_type, language, open_access (bool), signature_text }`. |
| `data.bibliography_usage_patterns[]` | array | Grouped by reading type: `{ reading_type, works_count, courses_count }`. |
| `data.most_used_authors_in_courses[]` | array | Top 15: `{ person_id, author_name, usage_count, courses_count, author_string, first_author_name, authors_array? }`. |
| `data.subject_expertise[]` | array | Grouped by vocabulary: `{ vocabulary, subjects_count, works_count, courses_count }`. |
| `data.teaching_collaborators[]` | array | Top 10 co-instructors: `{ collaborator_id, collaborator_name, shared_courses }`. |

`combined_statistics` block:

| field (dot-path) | type | notes |
|---|---|---|
| `data.combined_statistics.total_academic_span_years` | integer | Max of teaching span vs publication span. |
| `data.combined_statistics.academic_productivity_ratio` | **string** | `(works_authored / courses_taught).toFixed(2)`, e.g. `"0.00"`. Not a number. |
| `data.combined_statistics.bibliography_diversity_score` | integer | Count of distinct `reading_type` groups. |
| `data.combined_statistics.signature_consistency_score` | number | `0` when no signatures carry works. |

**Notes / caveats**
- 404 (`INSTRUCTOR_NOT_FOUND`) if the id is not in `course_instructors` — this endpoint additionally gates on membership, unlike `/courses` which never 404s.
- Two fields are decimal **strings** (`academic_productivity_ratio`; and note `avg_courses_per_instructor` on `/statistics`); parse client-side.
- The empty analytical arrays are a data-load gap, not an error — see the top-of-chapter caveat and [../API_ISSUES.md](../API_ISSUES.md).

---

## `GET /instructors/{id}/subjects`

Paginated subject-expertise list derived from the works in the instructor's course bibliographies (`course_bibliography → work_subjects → subjects`). Ordered `courses_count DESC, works_count DESC`.

**Path parameters**: `id` (integer ≥1).

**Query parameters** (all optional):

| param | type | default | accepted values / bounds | effect |
|---|---|---|---|---|
| `page` / `limit` / `offset` | integer | 1 / 10 / 0 | standard | Pagination. |
| `vocabulary` | string | — | length 2–100 | Exact match on `subjects.vocabulary`. |

**Example requests**
```
GET /instructors/11111/subjects
GET /instructors/11111/subjects?vocabulary=Keyword&limit=20
```

**Example response** (currently empty — no bibliography loaded):
```json
{
  "status": "success",
  "data": [],
  "pagination": { "page": 1, "limit": 10, "total": 0, "totalPages": 0, "hasNext": false, "hasPrev": false },
  "meta": {
    "instructor_id": 11111,
    "filters": { "vocabulary": null },
    "request": { "method": "GET", "path": "/instructors/11111/subjects" },
    "pagination_extras": { "offset": 0 }
  }
}
```

**Fields** (shape from the `formatInstructorSubject` DTO; arrays empty until data loads):

| field (dot-path) | type | notes |
|---|---|---|
| `data[].id` | integer | `subjects.id`. |
| `data[].term` | string\|null | Subject term. |
| `data[].vocabulary` | string\|null | e.g. `Keyword`. |
| `data[].parent_id` | integer\|null | Parent subject id (hierarchy). |
| `data[].expertise_metrics.courses_count` | integer | Distinct courses using the subject. |
| `data[].expertise_metrics.works_count` | integer | Distinct works carrying the subject. |
| `data[].expertise_metrics.avg_relevance` | string\|null | `parseFloat(AVG(ws.relevance_score)).toFixed(2)` or null. Decimal string. |
| `meta.instructor_id` | integer | Echo of path id. |
| `meta.filters.vocabulary` | string\|null | Echo. |

**Notes / caveats**
- No parent-existence 404 — unknown id yields an empty page.
- Currently `ok_empty`: the sole seeded course has no `course_bibliography` rows, so the subject chain yields nothing. Will populate once bibliography is loaded operator-side.
- Related subject browsing: [subjects](./subjects.md).

---

## `GET /instructors/{id}/bibliographies`

Paginated list of works used as bibliography across the instructor's courses. Ordered `used_in_courses DESC, publication_year DESC`.

**Path parameters**: `id` (integer ≥1).

**Query parameters** (all optional):

| param | type | default | accepted values / bounds | effect |
|---|---|---|---|---|
| `page` / `limit` / `offset` | integer | 1 / 10 / 0 | standard | Pagination. |
| `reading_type` | string | — | length 1–50 | Exact match on `course_bibliography.reading_type`. |
| `year_from` | integer | — | 1900 .. cy+1 | Keep works whose latest publication year `>=` this. |
| `year_to` | integer | — | 1900 .. cy+1 | Keep works whose latest publication year `<=` this. |

**Example requests**
```
GET /instructors/11111/bibliographies
GET /instructors/11111/bibliographies?reading_type=REQUIRED&year_from=2000
```

**Example response** (currently empty — no bibliography loaded):
```json
{
  "status": "success",
  "data": [],
  "pagination": { "page": 1, "limit": 10, "total": 0, "totalPages": 0, "hasNext": false, "hasPrev": false },
  "meta": {
    "instructor_id": 11111,
    "filters": { "reading_type": null, "year_from": null, "year_to": null },
    "request": { "method": "GET", "path": "/instructors/11111/bibliographies" },
    "pagination_extras": { "offset": 0 }
  }
}
```

**Fields** (shape from the `formatInstructorBibliography` DTO):

| field (dot-path) | type | notes |
|---|---|---|
| `data[].work_id` | integer | `works.id`. |
| `data[].title` | string\|null | Work title. |
| `data[].publication_year` | integer\|null | From the work's latest publication. |
| `data[].language` | string\|null | `works.language`. |
| `data[].document_type` | string\|null | `publications.type` (`ARTICLE`/`BOOK`/`CHAPTER`/…). |
| `data[].open_access` | boolean | |
| `data[].reading_type` | string\|null | `course_bibliography.reading_type`. |
| `data[].author_count` | integer | Total authorships for the work. |
| `data[].first_author_name` | string\|null | `preferred_name` of the position-0 author. |
| `data[].authors` | string[] | Ordered author `preferred_name`s. |
| `data[].usage_metrics.used_in_courses` | integer | Distinct courses (of this instructor) using the work. Primary sort key. |
| `meta.instructor_id` | integer | Echo of path id. |
| `meta.filters.{reading_type,year_from,year_to}` | mixed | Echoes (null when unset). |

**Notes / caveats**
- No parent-existence 404 — unknown id yields an empty page.
- Currently `ok_empty` for the same reason as `/subjects`. Follow `work_id` to [works](./works.md) `GET /works/{id}` for the full work record, or see the shared [bibliographies](./bibliographies.md) domain.

---

## Cross-endpoint summary

| Endpoint | 404 on unknown id? | Pagination | Notable |
|---|---|---|---|
| `GET /instructors` | n/a | yes | Fixed order `courses_taught DESC, preferred_name ASC`; no sort param. |
| `GET /instructors/statistics` | n/a | no | `avg_courses_per_instructor` is a string. |
| `GET /instructors/{id}` | **yes** (`INSTRUCTOR_NOT_FOUND`) | no | Adds `bibliography_contributed`, `created_at`. |
| `GET /instructors/{id}/courses` | no (empty page) | yes | Per-course `metrics`. |
| `GET /instructors/{id}/statistics` | **yes** (gates on membership) | no | Largest payload; several sub-arrays + decimal strings. |
| `GET /instructors/{id}/subjects` | no (empty page) | yes | Empty until bibliography loads. |
| `GET /instructors/{id}/bibliographies` | no (empty page) | yes | Empty until bibliography loads. |

Decimal-string fields to parse client-side: `statistics.avg_courses_per_instructor`, `{id}/statistics.combined_statistics.academic_productivity_ratio`, `{id}/subjects[].expertise_metrics.avg_relevance`.
