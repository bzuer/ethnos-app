# Dashboard — operational telemetry snapshot (auth required)

The dashboard domain exposes a live, read-only operational view of the running API process: search-engine performance, request/status distribution, system health, threshold alerts, and search-usage trends. Unlike every other domain, **none of this is backed by a base table** — the numbers come from the in-process monitoring middleware (`src/middleware/monitoring.js` `getMetrics()`, the same source as `/health/metrics`), so they are cumulative *since the last process restart* and reset to zero on restart. The only DB-touching piece is the per-day search-analytics series and popular terms, which come from the autocomplete service (`autocompleteService.getSearchAnalytics` / `getPopularTerms`). All four endpoints require `X-Access-Key` (router-level `requireInternalAccessKey`); there is no pagination anywhere in this domain. The `engine_status` label is a hardcoded `"Manticore"` (the works/persons search backend — see ./persons.md and the works search notes).

**Auth**: every endpoint returns `401 {"status":"error","code":"UNAUTHORIZED","message":"Invalid or missing access key"}` without a valid key. Send the key in `X-Access-Key` (aliases `x-internal-key` / `x-api-key`; see ../00-conventions.md for the full accepted list). Localhost is exempt from the rate limiter, but the auth guard still applies. `429` is declared but not reachable from localhost. Response envelope, error codes, and the shared `meta.request` / `meta.performance.controller_time_ms` blocks are described in ../00-conventions.md and are not repeated here.

> **Frontend note:** These endpoints power an internal ops dashboard, not end-user screens. Several fields are placeholders that are always constant (`index_size_mb: 0`, `recent_queries: []`, `chart_data: []`, `active_connections: 0`, `queries_last_minute: 0`) because no historical retention exists — design around them rather than expecting them to fill in.

---

## `GET /dashboard/overview`

One-shot operational snapshot combining search performance, status distribution, system health, recent search activity, and the current alert list. No query parameters (extras are ignored). Auth required.

### Example requests

```
GET /dashboard/overview                       # requires header X-Access-Key: $KEY
# curl -s -H "X-Access-Key: $KEY" http://localhost:1211/dashboard/overview
# no key -> 401 UNAUTHORIZED
```

### Example response

```json
{
  "status": "success",
  "data": {
    "timestamp": "2026-07-23T18:56:54.206Z",
    "search_performance": {
      "engine_status": "Manticore",
      "current_metrics": {
        "queries_per_second": 0.19,
        "avg_response_time": 155,
        "error_rate": 0.53,
        "index_size_mb": 0
      },
      "performance_distribution": {
        "total_queries": 379,
        "by_status": { "200": 337, "400": 13, "401": 3, "404": 25 },
        "top_endpoints": [
          { "endpoint": "GET /publications", "count": 19 },
          { "endpoint": "GET /works", "count": 17 },
          { "endpoint": "GET /persons", "count": 15 }
        ]
      }
    },
    "system_health": {
      "rollback_active": false,
      "uptime_seconds": 1944,
      "consecutive_failures": 0,
      "last_successful_check": "2026-07-23T18:56:54.206Z",
      "memory_usage": "142MB rss",
      "active_connections": 0,
      "health_status": "healthy"
    },
    "recent_activity": {
      "queries_last_hour": 229,
      "queries_last_minute": 0,
      "recent_queries": [],
      "search_analytics": {
        "2026-07-23": {
          "total_searches": 6,
          "unique_queries": 2,
          "avg_results": 7.666666666666667,
          "top_queries": [
            { "query": "kins", "count": 4 },
            { "query": "silva", "count": 2 }
          ]
        },
        "2026-07-22": { "total_searches": 0, "unique_queries": 0, "avg_results": 0, "top_queries": [] }
      },
      "activity_level": "moderate"
    },
    "alerts": [
      {
        "type": "performance",
        "severity": "medium",
        "message": "Slow average response time: 155ms",
        "threshold": "50ms",
        "current_value": "155ms",
        "timestamp": "2026-07-23T18:56:54.206Z",
        "requires_action": false,
        "alert_id": "alert_b86bde07"
      }
    ]
  },
  "meta": {
    "generated_at": "2026-07-23T18:56:54.206Z",
    "performance": { "controller_time_ms": 2 },
    "request": { "method": "GET", "path": "/dashboard/overview" }
  }
}
```

### Fields

Top level:

| field (dot-path) | type | notes |
|---|---|---|
| `data.timestamp` | string (ISO) | DTO-generation time (equals `meta.generated_at`). |

`data.search_performance`:

| field | type | notes |
|---|---|---|
| `.engine_status` | string | Hardcoded `"Manticore"`. Falls back to `"unknown"` only if the engine label is absent. |
| `.current_metrics.queries_per_second` | number | `requests.total / uptime_seconds`, rounded 2dp. Very low on a quiet box. |
| `.current_metrics.avg_response_time` | number (ms) | Average over the request-latency sample window (~last 10 min). Integer-valued in practice. |
| `.current_metrics.error_rate` | number | **Percent units** (`0.53` = 0.53%), NOT a 0–1 fraction. Computed `errors.total / requests.total * 100`, 2dp. |
| `.current_metrics.index_size_mb` | number | Always `0` — Manticore index size is not tracked. |
| `.performance_distribution.total_queries` | integer | Total requests counted since process start. |
| `.performance_distribution.by_status` | object | Map of HTTP status code (string key) → count. Keys present depend on live traffic; observed `200,400,401,404,500,503`. |
| `.performance_distribution.top_endpoints[]` | array | Up to 10 entries, sorted desc by `count`. |
| `.performance_distribution.top_endpoints[].endpoint` | string | e.g. `"GET /publications"` (method + path, no query string). |
| `.performance_distribution.top_endpoints[].count` | integer | Request count for that endpoint. |

`data.system_health`:

| field | type | notes |
|---|---|---|
| `.rollback_active` | boolean | Hardcoded `false` (no rollback machinery in this build). |
| `.uptime_seconds` | integer | Process uptime in seconds. |
| `.consecutive_failures` | integer | Hardcoded `0`. |
| `.last_successful_check` | string (ISO) \| null | Synthetic — equals the generation time. |
| `.memory_usage` | string \| null | RSS as a string with unit suffix, e.g. `"142MB rss"`. Parse the integer if you need a number. |
| `.active_connections` | integer | Hardcoded `0` (not tracked). |
| `.health_status` | string | Enum `healthy \| warning \| unhealthy \| degraded \| unknown`. Derived: `rollback_active` → `degraded`; `consecutive_failures > 5` → `unhealthy`; `>0` → `warning`; else `healthy`. Effectively always `healthy` given the hardcoded inputs. |

`data.recent_activity`:

| field | type | notes |
|---|---|---|
| `.queries_last_hour` | integer | Number of latency samples retained (~last 10-min window). The `_hour` label is inherited; treat as "recent sample count". |
| `.queries_last_minute` | integer | Hardcoded `0`. |
| `.recent_queries` | array | Always `[]` (no per-request retention). DTO would cap at 10 if ever fed. |
| `.search_analytics` | object \| object | Map of `YYYY-MM-DD` (string key) → daily block, spanning exactly 7 days (fixed window), newest key first. **If no analytics rows exist at all, this is instead `{ "message": "No analytics data available" }`** — branch on the presence of the `message` key. |
| `.search_analytics.<date>.total_searches` | integer | User searches recorded that day. |
| `.search_analytics.<date>.unique_queries` | integer | Distinct query strings that day. |
| `.search_analytics.<date>.avg_results` | number | Mean result count per search (raw float, not rounded — e.g. `7.666…`). |
| `.search_analytics.<date>.top_queries[]` | array | `{ query, count }`, most frequent first. Empty `[]` on zero-traffic days. |
| `.search_analytics.<date>.top_queries[].query` | string | Search term. |
| `.search_analytics.<date>.top_queries[].count` | integer | Times that term was searched. |
| `.activity_level` | string | Enum `minimal \| low \| moderate \| high \| very_high \| unknown`. Buckets of `queries_last_hour`: `>1000` very_high, `>500` high, `>100` moderate, `>10` low, else minimal. |
| `data.alerts[]` | array | Same object shape as `GET /dashboard/alerts` items — see that section's field table. Sorted desc by severity. |

Notes / caveats: All counters are cumulative since restart and reset on restart — do not treat them as historical. The `search_analytics` window is always 7 days regardless of anything. `index_size_mb`, `active_connections`, `queries_last_minute`, `recent_queries`, `rollback_active`, `consecutive_failures` are constant placeholders (documented as operator follow-ups in ../API_ISSUES.md).

---

## `GET /dashboard/performance`

Performance summary + status distribution, plus a chart time-series that is **always empty**. Auth required.

### Query parameters

| param | type | default | bounds | effect |
|---|---|---|---|---|
| `hours` | integer | 24 | 1..168 | Validated and echoed to `meta.hours_requested` (clamped `min(hours,168)`). **No functional effect** — `chart_data` stays `[]` regardless. Out-of-range → `400 VALIDATION_ERROR` (`"Hours must be between 1 and 168"`). Empty string `hours=` is treated as absent (default 24). |

### Example requests

```
GET /dashboard/performance
GET /dashboard/performance?hours=48        # echoed only; response body unchanged
GET /dashboard/performance?hours=999        # 400 VALIDATION_ERROR
GET /dashboard/performance?hours=0          # 400 VALIDATION_ERROR
```

### Example response

```json
{
  "status": "success",
  "data": {
    "chart_data": [],
    "summary": {
      "total_queries": 380,
      "avg_response_time": 154,
      "p95_response_time": 994,
      "error_count": 0.53,
      "uptime_seconds": 1944
    },
    "distribution": {
      "total_queries": 380,
      "by_status": { "200": 338, "400": 13, "401": 3, "404": 25 },
      "top_endpoints": [
        { "endpoint": "GET /publications", "count": 19 },
        { "endpoint": "GET /works", "count": 17 }
      ]
    }
  },
  "meta": {
    "hours_requested": 24,
    "data_points": 0,
    "generated_at": "2026-07-23T18:56:54.213Z",
    "performance": { "controller_time_ms": 1 },
    "request": { "method": "GET", "path": "/dashboard/performance" }
  }
}
```

### Fields

| field (dot-path) | type | notes |
|---|---|---|
| `data.chart_data` | array | **Always `[]`** — no historical retention, so no time-series is ever produced. When (hypothetically) fed, each element would be `{ timestamp, metrics:{query_count,avg_response_time,error_count,error_rate}, health_indicators:{performance_score,status} }` per `formatPerformanceChart`; do not build charting logic that depends on it being non-empty. |
| `data.summary.total_queries` | integer | Cumulative requests since restart. |
| `data.summary.avg_response_time` | number (ms) | Recent-window average latency. |
| `data.summary.p95_response_time` | number (ms) | Recent-window 95th-percentile latency (can be large, e.g. `994`, `3022`). |
| `data.summary.error_count` | number | **Misnamed: this is the error *rate* in percent, not a count.** Route assigns `error_count: m.error_rate` (e.g. `0.53` = 0.53%). Do not display it as an absolute count of errors. |
| `data.summary.uptime_seconds` | integer | Process uptime. |
| `data.distribution.total_queries` | integer | Same value as `summary.total_queries`. |
| `data.distribution.by_status` | object | Map status code (string) → count. |
| `data.distribution.top_endpoints[]` | array | `{ endpoint, count }`, up to 10, sorted desc by count. |
| `meta.hours_requested` | integer | Echo of the (clamped) `hours` param, default 24. |
| `meta.data_points` | integer | `= chart_data.length`, always `0`. |

Notes / caveats: `summary` and `distribution` are real telemetry; `chart_data` is empty by design (operator follow-up in ../API_ISSUES.md). If you need a true count of errored requests, sum the 4xx/5xx entries in `distribution.by_status` yourself. The `error_count` field is a rate, not a count — see the naming caveat above.

---

## `GET /dashboard/search-trends`

Search-usage trend indicators (volume / unique queries / avg results), popular autocomplete terms, and a per-day analytics series. The popular-terms list and daily-analytics come from the autocomplete service (DB-backed); the trend indicators are computed from the daily series. Auth required.

### Query parameters

| param | type | default | bounds | effect |
|---|---|---|---|---|
| `days` | integer | 7 | 1..365 | Number of days of search analytics to load. Echoed to `meta.days_analyzed` and used as the `data.analytics_period` label (`"30 days"` when `days=30`). Out-of-range → `400 VALIDATION_ERROR` (`"Days must be between 1 and 365"`). Empty string `days=` treated as absent. |

Note: the underlying per-day series (`daily_data`) and the `top_queries` inside it come from a fixed retention window — increasing `days` extends the analytics lookback passed to the service and the `analytics_period` label, but sparse traffic means most days are still zero.

### Example requests

```
GET /dashboard/search-trends
GET /dashboard/search-trends?days=30
GET /dashboard/search-trends?days=400       # 400 VALIDATION_ERROR
```

### Example response

```json
{
  "status": "success",
  "data": {
    "trends": {
      "search_volume":  { "trend": "stable", "change_percent": 0, "recent_average": 2,    "historical_average": 0, "is_significant": false },
      "unique_queries": { "trend": "stable", "change_percent": 0, "recent_average": 0.67, "historical_average": 0, "is_significant": false },
      "avg_results":    { "trend": "stable", "change_percent": 0, "recent_average": 2.56, "historical_average": 0, "is_significant": false }
    },
    "popular_terms": [
      { "term": "social",    "frequency": 57030, "trend": "stable" },
      { "term": "health",    "frequency": 43064, "trend": "stable" },
      { "term": "education",  "frequency": 32059, "trend": "stable" }
    ],
    "daily_data": [
      { "date": "2026-07-17T00:00:00.000Z", "total_searches": 0, "unique_queries": 0, "avg_results": 0, "top_terms": [] },
      { "date": "2026-07-23T00:00:00.000Z", "total_searches": 6, "unique_queries": 2, "avg_results": 7.666666666666667, "top_terms": [] }
    ],
    "analytics_period": "7 days",
    "generated_at": "2026-07-23T18:57:02.171Z"
  },
  "meta": {
    "days_analyzed": 7,
    "generated_at": "2026-07-23T18:57:02.171Z",
    "performance": { "controller_time_ms": 0 },
    "request": { "method": "GET", "path": "/dashboard/search-trends" }
  }
}
```

### Fields

`data.trends` — three trend indicators, all the same shape:

| field | type | notes |
|---|---|---|
| `.search_volume` / `.unique_queries` / `.avg_results` | object | Trend indicator (below). |
| `.<indicator>.trend` | string | Enum `increasing \| decreasing \| stable \| unknown`. `increasing` when change > +10%, `decreasing` when < −10%, else `stable`; `unknown` when the indicator is absent. |
| `.<indicator>.change_percent` | number | Percent change of the mean of the 3 most-recent days vs the mean of the 3 oldest days in the window. `0` when the historical mean is 0 (avoids divide-by-zero). |
| `.<indicator>.recent_average` | number | Mean of the last 3 days, 2dp. |
| `.<indicator>.historical_average` | number | Mean of the first 3 days, 2dp. |
| `.<indicator>.is_significant` | boolean | `abs(change_percent) > 10`. |

`data.popular_terms[]`:

| field | type | notes |
|---|---|---|
| `.term` | string | Autocomplete term. |
| `.frequency` | integer | **Corpus frequency** (how often the term appears across indexed content, e.g. `57030`), NOT a count of user searches. Sourced from `getPopularTerms(20)`. |
| `.trend` | string | Always `"stable"` (no per-term trend computed). |

Array length: up to 20, sorted desc by `frequency`.

`data.daily_data[]`:

| field | type | notes |
|---|---|---|
| `.date` | string (ISO) | Full ISO datetime at midnight (e.g. `"2026-07-23T00:00:00.000Z"`). Note this differs from `overview.search_analytics` keys, which are bare `YYYY-MM-DD`. Ascending by date. |
| `.total_searches` | integer | Searches that day. |
| `.unique_queries` | integer | Distinct queries that day. |
| `.avg_results` | number | Mean results per search (raw float). |
| `.top_terms` | array | Always `[]` in this DTO output (the per-day top terms are not surfaced here; use `overview.search_analytics.<date>.top_queries` for that). |

Other:

| field | type | notes |
|---|---|---|
| `data.analytics_period` | string | Label built from the `days` param, e.g. `"7 days"`, `"30 days"`. |
| `data.generated_at` | string (ISO) | DTO-generation time. |
| `meta.days_analyzed` | integer | Echo of the `days` param (default 7). |

Notes / caveats: When fewer than 2 days of analytics exist, `router.analyzeTrends` returns `{ message: "Insufficient data for trend analysis" }` and each of the three indicators degrades to `{ trend: "unknown", change_percent: 0 }` (via `formatTrendIndicator`); `daily_data` is then `[]`. Not seen on a warm box (7 days always present) but reachable on a fresh process. `popular_terms` is real corpus data; the per-day `total_searches`/`avg_results` are near-zero on a quiet instance simply because there is little user-search traffic — that is an empty-data condition, not a fault.

---

## `GET /dashboard/alerts`

Current threshold-based system alerts with a severity rollup. Alerts are recomputed live on each call from the same telemetry. Auth required. No query parameters.

### Alert rules

| type | fires when | severity | requires_action |
|---|---|---|---|
| `error` | `error_rate > 5` (percent) | `high` | `true` |
| `performance` | `avg_response_time > 50` (ms) | `medium` | `false` |
| `volume` | `queries_per_second > 100` | `medium` | `false` |

On a live API doing DB joins, the `performance` alert is essentially always present (avg latency > 50ms is normal here); `error` fires only during genuinely elevated error rates; `volume` is unreachable on localhost. `requires_action` is `true` only for `high`/`critical` severities.

### Example requests

```
GET /dashboard/alerts
```

### Example response

```json
{
  "status": "success",
  "data": {
    "alerts": [
      {
        "type": "performance",
        "severity": "medium",
        "message": "Slow average response time: 158ms",
        "threshold": "50ms",
        "current_value": "158ms",
        "timestamp": "2026-07-23T18:57:02.200Z",
        "requires_action": false,
        "alert_id": "alert_85e8319a"
      }
    ],
    "alert_count": 1,
    "last_check": "2026-07-23T18:57:02.200Z",
    "severity_counts": { "medium": 1 }
  },
  "meta": {
    "generated_at": "2026-07-23T18:57:02.200Z",
    "performance": { "controller_time_ms": 1 },
    "request": { "method": "GET", "path": "/dashboard/alerts" }
  }
}
```

When both an error and a performance alert are active the array carries both, sorted `critical > high > medium > low`, e.g.:

```json
{
  "type": "error",
  "severity": "high",
  "message": "High error rate: 6.2%",
  "threshold": "5%",
  "current_value": "6.2%",
  "timestamp": "2026-07-23T18:57:02.200Z",
  "requires_action": true,
  "alert_id": "alert_e34ab06f"
}
```

### Fields

`data.alerts[]` (this object shape is identical to `overview.data.alerts[]`):

| field | type | notes |
|---|---|---|
| `.type` | string | Enum `error \| performance \| volume` (DTO falls back to `unknown` if unset). |
| `.severity` | string | Enum `critical \| high \| medium \| low`. Array is sorted desc by this. |
| `.message` | string | Human-readable message, includes the current value. |
| `.threshold` | string \| null | The tripping threshold as a display string: `"5%"`, `"50ms"`, `"100 QPS"`. |
| `.current_value` | string \| null | The current measured value as a display string: `"158ms"`, `"6.2%"`, `"120 QPS"`. |
| `.timestamp` | string (ISO) | When the alert was generated (= call time). |
| `.requires_action` | boolean | `true` iff severity ∈ {`high`, `critical`}. |
| `.alert_id` | string | `alert_<md5[:8]>` hashed from `type-severity-message`; stable for the same alert content, so usable as a de-dupe/React key. |
| `data.alert_count` | integer | `= alerts.length`. |
| `data.last_check` | string (ISO) | Call time. |
| `data.severity_counts` | object | Map severity → count, containing only severities that are present (e.g. `{ "high": 1, "medium": 1 }`). Absent severities are omitted, not zero. |

Notes / caveats: The alert set is stateless and recomputed per request — there is no acknowledgement or persistence, so an alert reappears every call while its condition holds and vanishes the moment it clears. `error_rate` is compared in percent units (`> 5` = 5%); the message value is the same percent figure (no double-scaling). `severity_counts` only lists present severities — treat a missing key as 0 in the UI.
