<!--
  Ethnos frontend performance diagnosis — 2026-09-30.
  Method: live measurements on .80 (production build of HEAD b4a300d on :1202, a baseline build of
  3fe6de9 and a prototype build, each in an isolated scratch copy), a headless-Chrome CDP driver
  measuring full loads and link clicks behind a latency-injecting proxy, A/B load tests with unique
  work ids, and a 15-minute probe of https://ethnos.app (origin: .175). This is a DIAGNOSIS — no
  application code was changed.
-->

# Ethnos Frontend — Performance Diagnosis (2026-09-30)

## 1. Verdict

Users see every page and every click take seconds. Three things add up to that, and the frontend's
render path and the API are not among them.

1. **The production origin (.175) is saturated.** Its Next process periodically stops accepting
   connections: Cloudflare answers **504 after exactly ~5.07 s** (nginx `proxy_connect_timeout 5s`)
   or **after ~60 s** (`proxy_read_timeout 60s`), and even `/privacy`, a prerendered page served in
   2 ms when the process is idle, took 40–51 s to arrive. In 15 minutes of probing, 9.5% of
   origin-bound requests failed with 504, and 8 of 8 simultaneous requests for a static page all
   returned 504 at 5.08 s.
2. **Since `b4a300d`, every click pays that round trip synchronously.** `LocaleLink` defaults to
   `prefetch={false}`, which in Next 16 also turns off hover and touch prefetching, and Next's
   default `staleTimes.dynamic` is `0`. As a result, *any* navigation, including home ⇄ lists
   (which needs no API at all) and returning to a page just visited, waits one full origin round trip.
   Before `b4a300d`, a pt/es visitor had the chrome links prefetched on load, and those clicks
   completed in 4–41 ms.
3. **Nothing absorbs traffic at the edge.** Cloudflare caches no HTML or RSC (`cf-cache-status:
   DYNAMIC`) even though the origin now sends `s-maxage`, the stylesheet is revalidated at the
   origin on every request, and legacy/negotiated URLs add a 307/308 hop. Every page view and every
   click lands on the saturated process.

Measured on .80 with no competing traffic, the same build and API are fast: 2 ms per ISR hit,
30–50 ms per miss, and 3–55 ms per API call.

## 2. Evidence

### 2.1 Origin on .80 (no public traffic, API warm)

| Request | Result |
|---|---|
| API `/works/{id}?include_citations…`, `/works/{id}/metrics`, `/persons/{id}`, `/search/works?q=` | 3–55 ms |
| `/works/{id}` ISR **miss** (200) | 28–50 ms |
| `/works/{id}` ISR **miss** (404) | ~170 ms (fixed cost, see §3.5) |
| `/works/{id}` ISR **hit** | ~2 ms |
| Static pages (`/`, `/search`, `/privacy`) | 2–12 ms |
| Client navigation, loopback (HEAD) | 28–295 ms, 1 RSC request per click |

### 2.2 Public path (Cloudflare UDI → tunnel → nginx → Next on .175)

Probe: `/privacy` and a cached `/works/{id}` every ~3 s, 16:28–16:43 (222 requests).

| | p50 | p90 | p99 | max |
|---|---|---|---|---|
| `/privacy` (prerendered) | 0.49 s | 5.07 s | 40.8 s | 51.5 s |
| `/works/24203958` | 0.27 s | 2.24 s | 23.8 s | 60.1 s |
| Edge hits (`/robots.txt`, `/_next/static/*`) | 0.03–0.07 s | | | |

- 173 responses < 1 s, 16 in 1–5 s, **24 at ~5.07 s**, **9 ≥ 20 s**; **21 × 504** (`server:
  cloudflare`, body `error code: 504`).
- 8 concurrent `/privacy` requests: **all 504 at 5.07–5.09 s**. A minute later the origin answered
  an immediate **502** (process down or restarting).
- Earlier single requests: `/pt` 56 s TTFB with `x-nextjs-cache: HIT` (the origin had the page
  ready), `/css/styles.min.css` 35 s (`cf-cache-status: MISS`).
- Body throughput when the path is slow: ~50 KB/s (a 23 KB work page took ~0.45 s after the first
  byte).

**Reading the signatures:** nginx dials Next on loopback. A loopback `connect()` only times out when
the listener's accept queue is full, i.e. the Node event loop is not calling `accept()`. The
~5.07 s cluster is therefore a blocked or saturated Next process, not the tunnel. The ~60 s cluster
is a connection accepted but not answered within `proxy_read_timeout`.

### 2.3 Browser navigation A/B (headless Chrome, 600 ms round trip injected, `pt-BR`)

| Click | HEAD (`b4a300d`) | Baseline (`3fe6de9`) | Prototype (§5.2) |
|---|---|---|---|
| home → lists (1st) | 642 ms | 32 ms | 637 ms¹ |
| lists → home | 635 ms | 29 ms | 30 ms |
| home → lists (2nd, 3rd) | 636 / 634 ms | 30 / 5 ms | 30 / 30 ms |
| home → venues | 647 ms | 37 ms | 58 ms |
| venues → search | 633 ms | 29 ms | 28 ms |
| work / person / venue links (hover 400 ms) | 634–648 ms | —² | 635–655 ms³ |
| Requests on a full load without interaction | 11 | **34** (20 RSC prefetches) | 11 |

¹ In the test, the first pointer movement happened 150 ms before the first click, so the warm-up
was still in flight. In a real session the pointer moves long before the first click.
² For `en`, the baseline rendered `/en/…` links: prefetches were wasted and every click was a hard
navigation (full document plus ~24 requests).
³ Hover prefetch of ISR entity routes is **not reused** by Next 16's navigation: the click issues its
own request even when the prefetch finished first. `kind: 'full'` was worse (3 requests, ~950 ms).

### 2.4 Capacity A/B on .80 (unique work ids, API warm, `next start` single process)

| Build | c = 8 | c = 32 | p50 @ c = 32 |
|---|---|---|---|
| HEAD, ISR (`force-static` + `revalidate`) | 63.8 req/s | 67.6 req/s | 445 ms |
| Baseline, dynamic | 89.0 req/s | 105 req/s | 285 ms |

- Each ISR miss costs **~45% more CPU** than the old dynamic render: ~15 ms vs ~10 ms of main
  thread per work page. The ISR render produces and stores HTML, the RSC payload and the segment
  prefetch data.
- ISR hits: 657 req/s (`/works/{id}`) and 1,194 req/s (`/privacy`) with gzip; 786 and 1,434 req/s
  without it. Next's own compression costs **15–20%** of main-thread throughput.
- Break-even: ISR only beats dynamic rendering when **≥ ~35%** of requests hit the cache
  ((15.2 − 10.3) / (15.2 − 1.4)). The memory LRU (`cacheMaxMemorySize` 256 MiB, 75–155 KB of HTML
  per work page plus a comparable RSC payload) holds roughly **1,000–2,000 work pages**, while bots
  walk tens of thousands of distinct work URLs per hour. The real hit ratio on .175 is unknown
  (§4), but it is unlikely to reach the break-even point under crawler load.

### 2.5 The 16:45 deploy on .175 and an overload reproduction

- The deploy did not hang. `check_app` logged `ethnos-app.service is active` at 16:45:48 and then
  `wait_for_app` spent **6 minutes** (until 16:51:45) failing to get `GET /` from 127.0.0.1:1202
  within its 5 s `--max-time`. `READY_TIMEOUT=60` counts *iterations*, not seconds, so 60 × (5 s +
  1 s) = 6 min. The process that had just started could not answer a prerendered page for 6 minutes:
  it restarts with an empty memory ISR cache (`isrFlushToDisk: false`) straight into live traffic,
  plus whatever crawlers retry after the 502s of the build window. Validation then passed at 16:51:46.
- Lab reproduction on .80, open-loop arrivals of unique `/works/{id}` with a 60 s client timeout
  (nginx's `proxy_read_timeout`) and a `wait_for_app`-style probe of `/` every second:

| Arrival rate | HEAD (ISR) | Baseline (dynamic) |
|---|---|---|
| 90 req/s × 40 s | kept up, probe 3–23 ms, 0/39 probe timeouts | kept up, probe 3–4 ms, 0/40 |
| 180 req/s × 25 s | probe **timed out 4/6**, 358 requests abandoned at 60 s, drained 25 s after the load stopped | probe **timed out 2/11**, backlog of 2,613, drained 32 s after the load stopped |

  Both builds collapse the same way once arrivals exceed what one Node thread can render. HEAD
  degrades somewhat earlier, but the deciding variable is the **volume** reaching Node. Requests
  abandoned by the client are still rendered, which wastes capacity and extends the collapse past
  the peak. The capacity figures depend on page weight: heavy works with long citation lists render
  at ~65–100/s (§2.4), recent light ones at 90+/s.

### 2.6 Traffic on .175 (host data, 2026-09-30)

- Requests reaching nginx per minute, 16:49–17:00: **3,428–6,233** (57–104 req/s), with a peak of
  6,233 at 16:57. This is at or above what a single Next process renders (§2.4, §2.5). When .80 was
  the origin on 29 Sep it received ~400/min, so the load grew about **10×**.
- From 17:01 the volume fell to 728, then 318, then 53, because less traffic reached nginx (an
  upstream change, still to be identified). `ss -lntH 'sport = :1202'` showed `Recv-Q 0`, meaning
  no accept backlog at that moment.
- This confirms §3.1: the latency comes from request volume against single-threaded capacity.
- Wider window, 16:39–17:00: 3,428–9,621 req/min. The **9,621 at 16:44** is the retry flood that
  arrived as the app came back from the deploy's build window (502s), straight into an empty
  memory cache.
- Snapshot at 17:07:58, during a 1,888 req/min burst: **`Recv-Q 140`** on `:1202` (140
  connections waiting for Node to accept them). `next-server` at **150% CPU** with **4.8 GB RSS**
  22 minutes after start; the ISR cache is capped at 256 MiB, so most of that is in-flight
  renders, including ones their clients already abandoned. `mariadbd` held 6.3 GB, leaving 2.5 GB
  of 15 GB available. Once the load dropped, `/privacy` from inside the box took 3–130 ms.
- nginx error log: **643,175** `upstream timed out … while connecting` (the 5.07 s 504s) and
  **109,950** `… while reading` (the 60 s 504s). `NRestarts=0`; no `heap`/`fatal` in the journal.
- Top paths (whole access log): `/works/N` 1,015,976 · `/en/search/results` 703,787 ·
  `/search/results` 526,383 · `/en/works/N` 429,165 · `/en/persons/N` 209,927 · `/persons/N`
  166,539 · `/es/works/N` 61,118 · `/en/institutions/N` 52,305 · `/site.webmanifest` 43,855 ·
  `/pt/works/N` 43,542. **`/en/*` alone is ~1.4 M requests**: stale URLs that each cost a
  Node-served 308 plus the follow-up request. The robots-disallowed search surfaces take ~1.23 M.
- Top user agents: 8 of the 10 are **outdated desktop Chrome builds** (131, 116, 133, 110, 107,
  108, 117, 103; ~1.58 M requests together), plus Chrome 146/Linux (274k) and Safari 26/macOS
  (175k). No search-engine crawler appears in the top 10. This is the headless-Chrome scraper fleet
  described under Production Service › Cloudflare edge, and it ignores `robots.txt`.
- `journalctl -u ethnos-indexnow --since -12h` returned no entries, so **IndexNow is not a factor**
  on .175. The IndexNow bullet in §3.1 is ruled out.

## 3. Causes, ranked

### 3.1 Saturated Next process on .175 (confirmed symptom, cause to confirm on the host)

The 5.07 s/60 s signatures and the 40–51 s static-page stalls can only come from the Node event loop
being unavailable. Contributing factors, from strongest evidence to weakest:

- **Unique-URL crawler traffic is all ISR misses**, and each miss is ~45% dearer than before
  (§2.4). Next renders on one thread per process, so everything, including cache hits and
  prerendered pages, queues behind those renders.
- **The traffic is a headless-Chrome scraper fleet** (§2.6): outdated Chrome user agents, ~1.4 M
  stale `/en/*` URLs answered by Node with a 308, ~1.23 M hits on robots-disallowed search
  surfaces. *Ruled out:* IndexNow-driven crawling (no timer runs on .175, and no search engine
  appears among the top user agents).
- **Overload feeds on itself**: requests abandoned at nginx's 60 s timeout keep rendering, the
  process grew to 4.8 GB RSS under load, and garbage collection on that heap blocks the event loop
  further.
- **Shared host**: on .175 the API, MariaDB and Manticore compete for the same CPU.
- **Gzip on the main thread** (§2.4) and the **4xx double fetch** (§3.5) add constant overhead.

### 3.2 Every click is a synchronous origin round trip (regression, `b4a300d`)

`src/components/common/LocaleLink.tsx` forces `prefetch={false}`. In Next 16 that disables
viewport, hover and touch prefetching alike (`client/app-dir/link.js`: `onMouseEnter`/
`onTouchStart` return early when `prefetchEnabled` is false). With the default
`experimental.staleTimes.dynamic = 0`, nothing fetched by a click is reused either. The measured
effect is exactly one round trip per click (§2.3), multiplied by the origin latency of §2.2.
Removing the prefetch storm was the right call for bots, but it moved the whole round trip in
front of human users.

### 3.3 No edge absorption (dashboard configuration)

- HTML and RSC: `cf-cache-status: DYNAMIC` on every page and navigation, even though entity and
  static pages carry `s-maxage`. Edge hits measured 30–70 ms.
- Stylesheet: `/css/styles.min.css` is sent with `public, max-age=0, must-revalidate`
  (`next.config.mjs#immutableCss`), so Cloudflare **revalidates it at the origin on every request**
  (`cf-cache-status: REVALIDATED`; one MISS took 35 s). It is render-blocking, so a first visit
  shows nothing until the saturated origin answers.
- Hops: an unprefixed URL for a pt/es browser answers a 307 first (`/` → `/pt` took 1.45 s under
  load), and legacy `/en/…` links a 308. On 29 Sep, 27% of the requests on .80 were such 308s,
  mostly from scrapers.

### 3.4 Not a cause

- The API: 3–55 ms on every endpoint the pages use.
- `cache: 'no-store'` in `fetchJson` under `force-static`: Next's `markCurrentScopeAsDynamic`
  returns early for `forceStatic`, so the entity pages stay ISR (`x-nextjs-cache: HIT`, `s-maxage`
  observed).
- Client bundle: 10–11 scripts, ~200 KB gzipped per page, all edge-cached and immutable.
- CSP (`CSP_ENFORCE=1`): no violation on any measured page. `upgrade-insecure-requests` is harmless
  over https.

### 3.5 Secondary defects

- **`fetchJson` retries 4xx.** A non-OK response that is not 429/5xx is thrown *inside* the `try`,
  lands in the `catch` and is retried after 150 ms. A missing entity therefore costs two API calls
  and ≥150 ms (the constant ~170 ms 404 in §2.1), and an 8 s timeout is retried too (up to ~16 s
  per call).
- **Stale server actions.** Scrapers keep POSTing action ids from earlier deployments
  (`Failed to find Server Action "…"`, several per minute on 29 Sep). This is noise, but each POST
  still reaches Node.

## 4. To confirm on .175

```bash
# Accept queue: Recv-Q near Send-Q (511) means Next is not accepting (the 5.07 s 504s)
ss -lntH 'sport = :1202'

# Process CPU / memory and what competes with it
top -b -n1 -o %CPU | head -20

# Origin latency from inside the box, while the public site is slow
for i in $(seq 10); do curl -s -o /dev/null -w '%{http_code} %{time_total}\n' http://127.0.0.1:1212/privacy; sleep 1; done

# Request rate per minute, top paths and top user agents
awk '{print substr($4,2,17)}' /var/log/nginx/ethnos-app.access.log | uniq -c | tail -30
awk '{print $7}' /var/log/nginx/ethnos-app.access.log | sed -E 's#\?.*##; s#/[0-9]+#/N#g' | sort | uniq -c | sort -rn | head
awk -F'"' '{print $6}' /var/log/nginx/ethnos-app.access.log | sort | uniq -c | sort -rn | head

# nginx upstream timeouts (connect = the 5 s 504s, read = the 60 s 504s)
grep -cE 'upstream timed out .* while connecting' /var/log/nginx/ethnos-app.error.log
grep -cE 'upstream timed out .* while reading' /var/log/nginx/ethnos-app.error.log

# Crashes, restarts, IndexNow activity
systemctl show ethnos-app -p NRestarts -p ExecMainStartTimestamp
journalctl -u ethnos-app --since -3h | grep -ciE 'heap|fatal'
journalctl -u ethnos-indexnow --since -12h | tail -20
```

The access log carries no timing or cache status today. Adding
`$request_time $upstream_response_time $upstream_http_x_nextjs_cache` to a `log_format` in
`config/nginx.conf` would give the ISR hit ratio that decides §5.4.

## 5. Recommendations

Ordered by effect on what users feel. Nothing below has been applied.

### 5.1 Edge (Cloudflare dashboard) — largest effect

- **Cache Rule for HTML and RSC** that respects origin `Cache-Control` (already specified under
  Production Service › Cloudflare edge in CLAUDE.md, still not applied): repeat views drop to
  30–70 ms and stop reaching Node.
- **WAF custom rule, Managed Challenge (or Block)** for the outdated Chrome builds seen in §2.6,
  excluding verified bots. `contains` works on every plan (`matches`/regex needs a paid one):
  `(http.user_agent contains "Chrome/103.0.0.0" or http.user_agent contains "Chrome/107.0.0.0" or http.user_agent contains "Chrome/108.0.0.0" or http.user_agent contains "Chrome/110.0.0.0" or http.user_agent contains "Chrome/116.0.0.0" or http.user_agent contains "Chrome/117.0.0.0" or http.user_agent contains "Chrome/131.0.0.0" or http.user_agent contains "Chrome/133.0.0.0") and not cf.client.bot`.
  This covers ~1.58 M of the logged requests.
- **Redirect Rule for `/en` and `/en/*` → the unprefixed URL (308, query preserved)** at the edge,
  so ~1.4 M stale-URL hits never cross the tunnel. As a fallback, a cacheable 308 Cache Rule, or
  answering the 308 in nginx instead of Node.
- **Rate-limiting rule** on `/search/results` (GET and the server-action POSTs), which
  `robots.txt` already disallows.

### 5.2 Prototype: warm chrome navigation (frontend, validated in the lab)

- `LocaleLink` gains a `warm` prop. A warm link calls `router.prefetch(href)` after the **first real
  interaction** (`pointermove`, `pointerdown`, `keydown`, `touchstart`, `wheel`) and on hover/focus.
  Headless scrapers produce no input events, so they trigger no prefetch. The four header links
  (`/`, `/search`, `/venues`, `/lists`) are warm; every other link keeps `prefetch={false}`.
- `next.config.mjs`: `experimental.staleTimes = { dynamic: 300, static: 300 }`, so a page reached
  by a click is reused for five minutes.
- Measured (§2.3): chrome navigation 635 ms → **28–58 ms** after the first interaction, and 11
  requests per bot page load (same as HEAD, versus 34 on the baseline).
- Limit: it does not speed up entity links (hover prefetch is not reused by Next 16 for these ISR
  routes). Those clicks are only fixed by §5.1 and a healthy origin.

### 5.3 Frontend and nginx, low risk

- **`compress: false`** in `next.config.mjs`, with gzip left to nginx (already `gzip on`,
  `gzip_proxied any`). Add **`text/x-component`** to `gzip_types` so RSC payloads stay compressed.
  Expected gain: +15–20% of main-thread throughput.
- **`fetchJson`**: retry only 429/5xx/network errors, never a 4xx.
- **`scripts/manage.sh#wait_for_app`**: bound the loop by elapsed time (`SECONDS`), not by
  iteration count, so `READY_TIMEOUT=60` means 60 s and a saturated start no longer looks like a
  6-minute hang.
- **Stylesheet**: serve it under a content-hashed URL with `immutable`, or at least give it an edge
  TTL, so a first visit no longer waits on the origin for render-blocking CSS.

### 5.4 Capacity (decide with the data from §4)

- **ISR vs dynamic for entity pages**: keep ISR only if the logged hit ratio is ≥ ~35%. Otherwise
  dynamic rendering is ~45% cheaper per request under crawler load.
- **More than one Next process**: `next start` renders on a single thread. Two to four instances on
  consecutive loopback ports behind the existing nginx `upstream` multiply capacity (each keeps its
  own memory ISR cache).

## 6. Resolution (2026-09-30)

The operator put the Cloudflare zone in **Under Attack** mode; everything below is in the repository
and was verified on a production build behind a non-root nginx running the rendered vhost (SEO audit
green through nginx and direct, lint and typecheck clean).

| Change | Effect measured on .80 |
|---|---|
| Header links `warm` (prefetch on the first real input event) | Chrome navigation 28–36 ms instead of one origin round trip; no prefetch from scripted clients |
| Entity pages back to dynamic rendering; `p/[page]` routes, proxy pagination rewrite and the memory ISR cache removed | ~45% less CPU per unique page than an ISR miss |
| nginx `max_conns=64` on the upstream | At 180 req/s of unique pages: `/` answered every probe in 4–17 ms, 4,037 pages served, 445 shed with an immediate 502, none abandoned, Node at 870 MB |
| Client components get only what they render (work Tools, `EntityTools`, list badge, OA badge on the server, 7 of 18 message namespaces) | Pages 19–31% smaller (venue 440 → 305 KB, person 380 → 272 KB, work 154 → 105 KB, home gzip 16.1 → 11.8 KB) |
| `fetchJson` never retries a 4xx | One API call per missing entity |
| nginx answers `/en` 308s, compresses (level 5, `text/x-component`), logs `rt`/`urt`/`ip`/`ray` | Stale-URL traffic never reaches Node; Next no longer gzips on its event loop |
| Versioned, immutable stylesheet | The edge stops revalidating it at the origin |
| `manage.sh` (903 → 261 lines) and `render-config.sh` (210 → 89) without the verification scaffolding; config without comments | Identical rendered vhost |
| Reading list consolidated in `src/lib/reading-list.ts`; header counter correct on load | — |

Tried and dropped: `experimental.staleTimes` and hover/`kind: 'full'` prefetch of entity links (no
reuse by the navigation in Next 16), and more than one Next process (more computation, not less).

## 7. Method and artifacts

- Builds: HEAD (`b4a300d`, live unit on :1202), baseline `3fe6de9` and the §5.2 prototype, each
  built in a scratch copy with `/etc/next-frontend.env` and served on its own loopback port. The live
  unit and nginx were not modified.
- Browser: `chrome-headless-shell` driven over the DevTools protocol; real `Input.dispatchMouseEvent`
  hover and clicks; a Node proxy injecting a 600 ms delay on every non-`/_next/static` request.
- Load: Node HTTP client over 800 distinct work ids (API pre-warmed), 60 s cap per run, plus a
  `/privacy` probe every 100 ms during the runs.
- Public probe: `curl` against `https://ethnos.app` from .80, every ~3 s for 15 minutes.
