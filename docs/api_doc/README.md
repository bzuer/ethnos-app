# Ethnos API — Documentation

Complete documentation for the Ethnos.app Academic Bibliography API, written for a **frontend rebuild**: it aims to expose every endpoint, every field, and every usable parameter combination so a UI can be built end-to-end without access to the backend or database.

Two forms of documentation live here, plus the machine-readable OpenAPI spec:

| Document | Purpose |
|---|---|
| [`00-conventions.md`](./00-conventions.md) | **Read first.** The rules shared by every endpoint: response envelope, pagination, auth & rate-limit, error codes, value normalization, `meta` flags, shared query params, the search-engine model, identifiers. |
| [`domains/`](./domains/) | One text chapter per domain, each with per-endpoint request/response examples, full field inventories, parameter combinations, and caveats. |
| [`API_ISSUES.md`](./API_ISSUES.md) | The behaviour defects found in the audit, each as problem → solution → validation, plus operator-side follow-ups. |
| `GET /docs.json` · `GET /docs` | The generated OpenAPI 3.0 spec (source of truth for machines) and its Swagger UI. Regenerate with `npm run docs:generate`. |

## Domain chapters

| Chapter | Endpoints |
|---|---|
| [works](./domains/works.md) | `/works`, `/works/showcase`, `/works/{id}`, `/works/{id}/bibliographies` |
| [citations](./domains/citations.md) | `/works/{id}/citations`, `/references`, `/metrics`, `/network` |
| [publications](./domains/publications.md) | `/publications`, `/publications/{id}`, DOI resolver `/{doi}` |
| [persons](./domains/persons.md) | `/persons`, `/persons/{id}`, `/persons/{id}/works`, `/persons/{id}/signatures` |
| [collaborations](./domains/collaborations.md) | `/collaborations/top`, `/persons/{id}/collaborators`, `/persons/{id}/network` |
| [venues](./domains/venues.md) | `/venues`, `/venues/search`, `/venues/statistics`, `/venues/{id}`, `/venues/{id}/works` |
| [institutions](./domains/institutions.md) | `/institutions`, `/institutions/{id}`, `/{id}/works`, `/{id}/funded-works` |
| [search](./domains/search.md) | `/search/works`, `/advanced`, `/global`, `/persons`, `/autocomplete`, `/popular`, `/health` |
| [subjects](./domains/subjects.md) | `/subjects/statistics`, `/subjects/{id}` (+ `/children`, `/hierarchy`, `/works`, `/courses`) |
| [courses](./domains/courses.md) | `/courses`, `/courses/statistics`, `/courses/{id}` (+ `/instructors`, `/subjects`, `/bibliographies`) |
| [instructors](./domains/instructors.md) | `/instructors`, `/instructors/statistics`, `/instructors/{id}` (+ `/courses`, `/statistics`, `/subjects`, `/bibliographies`) |
| [signatures](./domains/signatures.md) | `/signatures/search`, `/signatures/statistics`, `/signatures/{id}` (+ `/persons`, `/works`) |
| [bibliographies](./domains/bibliographies.md) | `/bibliographies`, `/bibliographies/analyses`, `/bibliographies/statistics` |
| [metrics](./domains/metrics.md) | `/metrics/annual`, `/venues`, `/institutions`, `/persons`, `/collaborations` |
| [dashboard](./domains/dashboard.md) | `/dashboard/overview`, `/performance`, `/search-trends`, `/alerts` (auth) |
| [security](./domains/security.md) | `/security/stats`, `/headers`, `/audit`, `POST /security/unblock/{ip}` (auth) |
| [system](./domains/system.md) | `GET /`, `/health/liveness`, `/health/readiness`, `/health/metrics` |

**78 operations** across 78 paths. All examples were captured against the live API and validated field-for-field against the OpenAPI spec.

## Where the API listens

Call **`http://localhost:1211`** (or the production base URL). That port is served by nginx, which reverse-proxies to the application on `127.0.0.1:1201`; the application port is loopback-bound and not reachable. Port `1212` belongs to the frontend and is never an API port. The full table, and what a `502` from the proxy means for a client, are in [`00-conventions.md` § Ports](./00-conventions.md#ports) and [`domains/system.md` § Serving topology](./domains/system.md#serving-topology-and-ports).
