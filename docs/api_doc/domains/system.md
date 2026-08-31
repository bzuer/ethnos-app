# System — service discovery, health, and monitoring

This domain exposes the operational surface of the API: the **service-discovery root** (`GET /`) and the three **health/monitoring probes** under `/health/*`. It is backed by no single base table — the root merges a boot-time `COUNT(*)` snapshot from `homepageStats.service.js` with static strings from `src/app.js`, while the probes read process state (`monitoring.getMetrics()`) and a live DB ping (`testConnection()`). No search engine participates. These endpoints are what a frontend hits to render a landing/status page, wire up a health dashboard, and discover the other domains (each links out to the resource groups documented in [./works.md](./works.md), [./persons.md](./persons.md), [./venues.md](./venues.md), [./institutions.md](./institutions.md), [./search.md](./search.md), etc.).

The catch-all DOI resolver (`GET /{doi}`) is physically mounted at the root but is semantically a Publications endpoint — see [./publications.md](./publications.md). It is only cross-referenced here.

Global response envelope, pagination, auth, rate-limit, error codes, and boolean/date normalization are documented once in [../00-conventions.md](../00-conventions.md); this chapter only covers what is specific to the system domain.

Route files: `src/app.js` (root `/`, catch-all 404), `src/routes/health.js` (the three probes).

---

## Serving topology and ports

The API is never its own public listener. **nginx** owns the public port and reverse-proxies to the application, which is bound to loopback and is not routable — not from the internet, and not from the LAN.

| Port | Owner | Role |
|---|---|---|
| `1211` | nginx | The public API. The only port a client calls. |
| `1201` | the API process | Application listener, `127.0.0.1` only. Not exposed. |
| `1210` | temporary test instance | Integration-test runs (`INTEGRATION_BASE_URL`). Ephemeral. |
| `1212` | the frontend | Reserved for the frontend app; never an API port. |
| `1213` | another site's vhost | Unrelated to the API. |

Consequences a frontend or a status dashboard must handle:

- **A health probe measures the application, not the path to it.** `/health/liveness` returning 200 proves the app answered; it says nothing about nginx, because the answer already came through nginx. If the proxy is down the request does not return 200 — it does not return at all (connection refused).
- **`502` means the app is down while nginx is up.** It is HTML, not the JSON envelope — see [Gateway errors](../00-conventions.md#gateway-errors). A status page should render it as "API unavailable", never parse it for `message`.
- **A restart is visible as a 502 window, not as an error envelope.** nginx keeps the public port bound while the application is stopped, so clients get 502 rather than a refused connection for the duration.
- **Rate limits apply to localhost too.** Traffic through the proxy carries `X-Forwarded-For`, which disables the loopback exemption; `http://localhost:1211` is rate-limited exactly like any other origin.

---

## `GET /`

API root and service-discovery document. **Public** — no key required. It is rate-limited like every other open endpoint, localhost included, because requests reach the app through the proxy (see [Serving topology and ports](#serving-topology-and-ports)). No DB query at request time; corpus totals come from a snapshot captured at boot / periodic refresh (`data.data_statistics.collected_at` is the snapshot time, not `now()`).

**Query parameters**: none.

**Example requests**

```
GET http://localhost:1211/
```

**Example response** (HTTP 200, trimmed; long category lists kept in full because they are the discovery map):

```json
{
  "status": "success",
  "data": {
    "name": "Ethnos.app Academic Bibliography API",
    "version": "2.0.0",
    "description": "Public RESTful API for academic bibliographic research with 7,136,695 works, 7,220,125 publications, 4,727,444 researchers",
    "environment": "production",
    "timestamp": "2026-07-23T18:57:15.978Z",
    "documentation": { "swagger_ui": "/docs", "openapi_spec": "/docs.json" },
    "system_status": {
      "database": "7,136,695 works, 7,220,125 publications",
      "search_engine": "Manticore Search (SphinxQL) full-text for works and persons; MariaDB FULLTEXT for venues (ft_venues_search), subjects (ft_subjects_term), organizations (ft_organizations_name); the venue filter uses ft_venues_search",
      "cache": "Redis with 30min TTL",
      "rate_limiting": "Public requests limited to 120/min per IP; a valid X-Access-Key removes the limit",
      "authentication": "No key required for data and metrics endpoints; X-Access-Key still gates /dashboard, /security/* and the internal health probes (/health/readiness, /health/metrics)"
    },
    "main_categories": {
      "search_discovery": {
        "description": "Search across works, persons, and publications backed by Manticore Search (SphinxQL) full-text for works and persons; MariaDB FULLTEXT for venues, subjects, organizations (institutions search disabled for performance)",
        "endpoints": ["/search/works", "/search/persons", "/search/advanced", "/search/autocomplete", "/search/global"]
      },
      "academic_works": {
        "description": "Publications and citations analysis",
        "endpoints": ["/works", "/works/{id}", "/works/{id}/citations", "/works/{id}/references"]
      },
      "researchers_authors": {
        "description": "Researcher profiles and collaboration networks",
        "endpoints": ["/persons", "/persons/{id}", "/persons/{id}/collaborators", "/persons/{id}/works"]
      },
      "institutions": {
        "description": "Academic institutions, publishers and funders",
        "endpoints": ["/institutions", "/institutions/{id}", "/institutions/{id}/works", "/institutions/{id}/funded-works"]
      },
      "academic_venues": {
        "description": "Journals, conferences, and publication venues",
        "endpoints": ["/venues", "/venues/{id}", "/venues/search", "/venues/statistics"]
      },
      "courses_teaching": {
        "description": "Academic courses and instructor profiles",
        "endpoints": ["/courses", "/courses/{id}", "/instructors", "/instructors/{id}/statistics"]
      },
      "bibliography_analysis": {
        "description": "Academic bibliography and reading analysis",
        "endpoints": ["/bibliographies", "/bibliographies/analyses"]
      },
      "metrics_analytics": {
        "description": "Research metrics and institutional analytics",
        "endpoints": ["/metrics/venues", "/metrics/institutions", "/metrics/persons", "/metrics/collaborations", "/dashboard/overview"]
      }
    },
    "data_statistics": {
      "total_works": "7,136,695",
      "total_publications": "7,220,125",
      "total_researchers": "4,727,444",
      "total_organizations": "639,573",
      "total_venues": "189,076",
      "total_courses": "1",
      "collected_at": "2026-07-23T18:24:32.678Z"
    },
    "technical_features": {
      "search_performance": "Manticore Search (SphinxQL) full-text for works and persons; MariaDB FULLTEXT for venues (ft_venues_search), subjects (ft_subjects_term), organizations (ft_organizations_name); the venue filter uses ft_venues_search; institutions search disabled for optimal performance",
      "authentication": "Open access: data and metrics endpoints need no key. An optional X-Access-Key (header: x-access-key | x-internal-key | x-api-key) lifts the rate limit and unlocks /dashboard, /security/* and the internal health probes (/health/readiness, /health/metrics).",
      "rate_limits": "Unauthenticated requests: 120/min per IP. No limit when a valid X-Access-Key is supplied.",
      "response_format": "JSON with pagination {page, limit, total, totalPages, hasNext, hasPrev}",
      "cache_ttl": "30 minutes",
      "security": "XSS protection, SQL injection prevention, abuse detection"
    },
    "quick_examples": {
      "search_works": "GET /search/works?q=machine+learning&limit=10",
      "get_work_details": "GET /works/22519667",
      "search_authors": "GET /persons?search=silva&limit=5",
      "venue_metrics": "GET /venues/statistics",
      "system_health": "GET /health/liveness"
    },
    "support": {
      "license": "MIT License",
      "website": "https://ethnos.app",
      "technical_contact": "Bruno Cesar Cunha Cruz - PPGAS/MN/UFRJ"
    }
  },
  "meta": { "request": { "method": "GET", "path": "/" } }
}
```

**Fields**

| field (dot-path) | type | notes |
|---|---|---|
| data.name | string | Static: `"Ethnos.app Academic Bibliography API"`. |
| data.version | string | Static: `"2.0.0"`. |
| data.description | string | Interpolates the three headline totals; falls back to a plain sentence with no numbers if the snapshot is null. |
| data.environment | string | `process.env.NODE_ENV`, observed `"production"` (`"development"` if unset). |
| data.timestamp | string (ISO 8601) | Per-request `now()` — changes every call. |
| data.documentation.swagger_ui | string | `"/docs"` — Swagger UI path. |
| data.documentation.openapi_spec | string | `"/docs.json"` — raw OpenAPI JSON. |
| data.system_status.database | string | `"{works} works, {publications} publications"` (comma-grouped). |
| data.system_status.search_engine | string | Human blurb describing the engine split (Manticore for works/persons; MariaDB FULLTEXT for venues/subjects/organizations). Display text only. |
| data.system_status.cache | string | `"Redis with 30min TTL"`. |
| data.system_status.rate_limiting | string | Rate-limit blurb. |
| data.system_status.authentication | string | Auth blurb. |
| data.main_categories | object | Discovery map: 8 fixed keys — `search_discovery`, `academic_works`, `researchers_authors`, `institutions`, `academic_venues`, `courses_teaching`, `bibliography_analysis`, `metrics_analytics`. |
| data.main_categories.{key}.description | string | Human label for the group. |
| data.main_categories.{key}.endpoints | string[] | Example path templates for that group (some carry `{id}` placeholders — not literal URLs). |
| data.data_statistics.total_works | string | **Comma-grouped number string** (e.g. `"7,136,695"`), NOT an integer — strip commas before parsing. |
| data.data_statistics.total_publications | string | Comma-grouped. |
| data.data_statistics.total_researchers | string | Comma-grouped (distinct persons). |
| data.data_statistics.total_organizations | string | Comma-grouped. |
| data.data_statistics.total_venues | string | Comma-grouped. |
| data.data_statistics.total_courses | string | Comma-grouped. Currently `"1"` — the courses table has a single row (see [./courses.md](./courses.md)). |
| data.data_statistics.collected_at | string (ISO 8601) \| null | Snapshot capture time (NOT request time). `null` if the boot snapshot failed. |
| data.technical_features.search_performance | string | Engine/performance blurb (mirrors `system_status.search_engine`). |
| data.technical_features.authentication | string | Auth blurb. |
| data.technical_features.rate_limits | string | Rate-limit blurb. |
| data.technical_features.response_format | string | Documents the pagination key set `{page, limit, total, totalPages, hasNext, hasPrev}`. |
| data.technical_features.cache_ttl | string | `"30 minutes"`. |
| data.technical_features.security | string | Security-feature blurb. |
| data.quick_examples.search_works | string | Copy-pasteable example call. |
| data.quick_examples.get_work_details | string | Example call (real work id). |
| data.quick_examples.search_authors | string | Example call. |
| data.quick_examples.venue_metrics | string | Example call — `"GET /venues/statistics"`. |
| data.quick_examples.system_health | string | Example call — `"GET /health/liveness"`. |
| data.support.license | string | `"MIT License"`. |
| data.support.website | string | `"https://ethnos.app"`. |
| data.support.technical_contact | string | Maintainer contact string. |
| meta.request.method / path | string | Standard envelope meta. |

**Notes / caveats**
- All six `data_statistics` totals are **strings with thousands separators**, not numbers. Parse with `Number(s.replace(/,/g,''))`.
- Totals are a snapshot; a running import can make them drift slightly from the live count. Treat as approximate headline figures. `collected_at` tells you how fresh.
- The `main_categories[].endpoints` arrays are a discovery aid, not an exhaustive route list, and some entries are `{id}` templates. Do not build routing off them verbatim.
- Swagger models the 200 body as `SystemRoot`, but the JDoc schema is coarse — treat this field table as authoritative over the spec.
- Earlier builds shipped stale MariaDB-works engine strings and two broken `quick_examples` (`/venues/1/statistics`, `/health`); the live payload above is the corrected version — trust it.

---

## `GET /health/liveness`

Liveness probe — is the process up and responsive. **Public** (`security: []`). No DB access; always 200 while the process serves. Use for load-balancer liveness checks and a green/red process indicator.

**Query parameters**: none. **Path parameters**: none.

**Example requests**

```
GET http://localhost:1211/health/liveness
```

**Example response** (HTTP 200)

```json
{
  "status": "success",
  "data": { "alive": true, "timestamp": "2026-07-23T18:57:15.984Z" },
  "meta": { "request": { "method": "GET", "path": "/health/liveness" } }
}
```

**Fields**

| field (dot-path) | type | notes |
|---|---|---|
| data.alive | boolean | Always `true` when the response is served. |
| data.timestamp | string (ISO 8601) | Server `now()` at response time. |

**Notes / caveats**
- There is **no `GET /health` root route** — a bare `/health` falls through to the 404 handler. The only probes are `/health/liveness`, `/health/readiness`, `/health/metrics`.
- Public and cheap; safe to poll frequently.

---

## `GET /health/readiness`

Readiness probe — is the service ready to serve, i.e. the **database is reachable**. Runs `testConnection()`. Returns 200 when the DB is up, 503 when it is down. **AUTH required** (`requireInternalAccessKey`): missing OR invalid key → 401.

**Query parameters**: none. **Path parameters**: none.

**Auth**: send `X-Access-Key: $KEY`. Header aliases (case-insensitive): `x-access-key`, `x-internal-key`, `x-api-key`. Query-string aliases also lift the guard: `access_key`, `accessKey`, `api_key`. See [../00-conventions.md](../00-conventions.md) for the full key story.

**Example requests**

```
GET http://localhost:1211/health/readiness                         # 401 (no key)
GET http://localhost:1211/health/readiness   -H "X-Access-Key: $KEY"   # 200 (DB up)
GET http://localhost:1211/health/readiness   -H "X-Access-Key: wrong"  # 401 (invalid key)
```

**Example response** (HTTP 200)

```json
{
  "status": "success",
  "data": { "ready": true, "message": "Service is ready to accept requests" },
  "meta": { "request": { "method": "GET", "path": "/health/readiness" } }
}
```

**401 response** (missing or invalid key — both are 401, there is no separate 403):

```json
{ "status": "error", "message": "Invalid or missing access key", "timestamp": "2026-07-23T18:57:15.989Z", "code": "UNAUTHORIZED" }
```

**503 response** (DB unreachable — error envelope; not exercised live, DB was healthy):

```json
{ "status": "error", "message": "Service dependencies are not available", "timestamp": "...", "code": "INTERNAL_ERROR" }
```

**Fields**

| field (dot-path) | type | notes |
|---|---|---|
| data.ready | boolean | `true` on 200. On DB failure the endpoint returns 503 with an error envelope (no `data.ready:false`). |
| data.message | string | `"Service is ready to accept requests"`. |

**Notes / caveats**
- Distinguish the two failure modes on the client: **401** = you did not send a valid key (auth problem, retrying without a key won't help); **503** = authenticated but the DB is down (dependency problem).
- Swagger declares 200/401/429/500/503.

---

## `GET /health/metrics`

In-process monitoring metrics from `monitoring.getMetrics()` — the same telemetry source that backs `/dashboard/overview` and `/dashboard/performance` (see [../00-conventions.md](../00-conventions.md) and the dashboard endpoints). **In-memory only; resets on process restart; no historical retention** (there is no time-series here — use it for a live status widget, not trend charts). **AUTH required** (`requireInternalAccessKey`): missing/invalid key → 401.

**Query parameters**: none. **Path parameters**: none. Same key/aliases as `/health/readiness` above.

**Example requests**

```
GET http://localhost:1211/health/metrics                       # 401 (no key)
GET http://localhost:1211/health/metrics -H "X-Access-Key: $KEY"   # 200
```

**Example response** (HTTP 200, structurally complete; `top_endpoints` trimmed to 3 of 10)

```json
{
  "status": "success",
  "data": {
    "uptime_ms": 1965385,
    "uptime_human": "32m 45s",
    "requests": {
      "total": 404,
      "by_status": { "200": 357, "400": 16, "401": 5, "404": 25 },
      "top_endpoints": [
        { "endpoint": "GET /publications", "count": 19 },
        { "endpoint": "GET /works", "count": 17 },
        { "endpoint": "GET /persons", "count": 15 }
      ],
      "performance": { "avg_response_time_ms": 158, "p95_response_time_ms": 1013, "total_samples": 254 }
    },
    "errors": { "total": 2, "by_type": { "AppError": 2 }, "recent_count": 2, "error_rate": 0.5 },
    "system": {
      "memory": { "rss": 148688896, "heapTotal": 54874112, "heapUsed": 50090616, "external": 2959870, "arrayBuffers": 447762 },
      "cpu_cores": 12,
      "load_average": [ 0.58, 0.52, 0.64 ],
      "free_memory_mb": 16116,
      "total_memory_mb": 31432
    }
  },
  "meta": { "request": { "method": "GET", "path": "/health/metrics" } }
}
```

**Fields**

| field (dot-path) | type | notes |
|---|---|---|
| data.uptime_ms | integer | Milliseconds since process start. |
| data.uptime_human | string | Humanised uptime, e.g. `"32m 45s"`, `"1d 2h 3m"`. |
| data.requests.total | integer | Total requests counted since boot. |
| data.requests.by_status | object<string,int> | Map of HTTP status code (as a string key: `"200"`,`"400"`,`"401"`,`"404"`,`"503"`,…) → count. Only observed statuses appear as keys. |
| data.requests.top_endpoints | array | Up to the top 10 endpoints by hit count, descending. |
| data.requests.top_endpoints[].endpoint | string | `"METHOD /path"`, raw path — ids are NOT templated (`GET /works/123` and `GET /works/456` count separately). |
| data.requests.top_endpoints[].count | integer | Hit count for that raw endpoint string. |
| data.requests.performance.avg_response_time_ms | integer | Mean response time over the recent sample window. |
| data.requests.performance.p95_response_time_ms | integer | 95th-percentile response time over the window. |
| data.requests.performance.total_samples | integer | Number of samples in the window (overall sample buffer capped ~1000). |
| data.errors.total | integer | Total errors counted. |
| data.errors.by_type | object<string,int> | Error-constructor-name → count (e.g. `AppError`). `{}` when none. |
| data.errors.recent_count | integer | Size of the recent-errors ring buffer (max ~50). |
| data.errors.error_rate | number (float) | Errors ÷ requests × 100, 2 decimal places (a percentage, e.g. `0.5`). |
| data.system.memory.rss | integer | Resident set size, bytes (`process.memoryUsage()`). |
| data.system.memory.heapTotal | integer | V8 heap allocated, bytes. |
| data.system.memory.heapUsed | integer | V8 heap in use, bytes. |
| data.system.memory.external | integer | Memory of C++ objects bound to JS, bytes. |
| data.system.memory.arrayBuffers | integer | ArrayBuffer/SharedArrayBuffer memory, bytes. Present in the live payload though omitted from the swagger example. |
| data.system.cpu_cores | integer | `os.cpus().length`. |
| data.system.load_average | number[3] | OS 1 / 5 / 15-minute load averages. On some platforms may read `[0,0,0]`. |
| data.system.free_memory_mb | integer | Free system RAM in MB. |
| data.system.total_memory_mb | integer | Total system RAM in MB. |

**Notes / caveats**
- All counters are **in-memory and reset on restart**; `uptime_ms` tells you how long the current window covers. Do not treat as durable analytics.
- Memory figures under `data.system.memory` are **bytes**; `free_memory_mb` / `total_memory_mb` are **megabytes**. Divide/format accordingly.
- `error_rate` is already a percentage (not a 0–1 fraction).
- Swagger models this as `HealthMetrics` / `HealthMetricsSuccess`; the `system.memory` sub-object is declared as a generic int map, so the concrete keys above (including `arrayBuffers`) are the authoritative shape.

---

## Errors and the catch-all

**404 (unmatched path).** Any path that does not match a route and is not DOI-shaped falls to the path-less `notFoundHandler`:

```
GET http://localhost:1211/nonexistent-path-xyz   → HTTP 404
```
```json
{ "status": "error", "message": "Can't find /nonexistent-path-xyz on this server!", "timestamp": "2026-07-23T18:57:16.008Z", "code": "NOT_FOUND" }
```

| field | type | notes |
|---|---|---|
| status | string | `"error"`. |
| message | string | `"Can't find {path} on this server!"`. |
| code | string | `"NOT_FOUND"`. |
| timestamp | string (ISO 8601) | Server time. |

This generic 404 carries **no `meta` block** (unlike the DOI 404, which includes `meta.doi`).

**DOI resolver `GET /{doi}`.** The root also hosts a catch-all regex route (`/{doi}`, plus `/doi.org/{doi}` and `/https://doi.org/{doi}` prefixes) that resolves a DOI via `publications.doi` (UNIQUE) to a full publication payload with the parent work embedded. It is documented in [./publications.md](./publications.md) — an unknown DOI returns 404 with `code: NOT_FOUND` and a `meta.doi` echo. Not covered further here.

**Rate limiting.** All four system endpoints are subject to the shared limiter (429 over cap for unauthenticated non-localhost traffic); a valid key or a localhost origin is exempt. See [../00-conventions.md](../00-conventions.md).
