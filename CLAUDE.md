# CLAUDE.md

## Project

**Ethnos** — a Next.js 16 bibliographic discovery app for anthropology and sociology (en, pt, es). It creates nothing: it delivers structured bibliographic records from the Ethnos API as clean, evident pages, with the least computation possible. Every backend call is made server-side against the API's nginx at `127.0.0.1:1211`; client components reach it only through server actions. The app itself runs as Next on `localhost:1202`, published only through nginx on `:1212`.

**Guiding principle:** simple, clean, fluid. Prefer removing code to adding it; no defensive scaffolding that re-checks what cannot fail; no history in code or docs — git keeps it.

## Commands

| Task | Command |
|------|---------|
| Dev (`localhost:1210`) | `./bin/dev` or `npm run dev` |
| Build | `npm run build` |
| Lint | `npm run lint` |
| Deploy (stop → clean → `npm ci` → css → build → units → start) | `scripts/manage.sh deploy` |
| Start / stop / restart the system unit | `scripts/manage.sh {start\|stop\|restart}` |
| Unit state and one request through nginx | `scripts/manage.sh status` |
| Render and install the nginx vhost (`--print` renders only) | `scripts/manage.sh nginx [--print]` |
| Install the unit (+ IndexNow timer when `INDEXNOW_AUTOSUBMIT=1`) | `scripts/manage.sh systemd:install` |
| Maintenance mode | `scripts/manage.sh maintenance {on\|off\|status}` |
| SEO audit (acceptance test of `docs/SEO.md`) | `scripts/manage.sh seo audit` (`SEO_BASE=…` to retarget) |
| IndexNow (new or re-dated URLs only) | `scripts/manage.sh seo indexnow:new [--dry-run\|--limit n]` |
| Regenerate `styles.min.css` | `scripts/manage.sh css` |
| Remove units, vhost, `.next`, `node_modules` | `scripts/manage.sh uninstall` |

## Layout

```
src/app/(site)/[locale]/            Pages (locale-prefixed; (shells)/ holds the page tree)
src/app/sitemap.xml/, sitemaps/     Sitemap index and sections (ISR hourly)
src/app/site.webmanifest/           Default-locale manifest (per-locale under [locale]/)
src/components/common/              Shared components
src/lib/api.ts                      fetchJson() — the single HTTP client to 127.0.0.1:1211
src/lib/endpoints.ts                Server-only data access (searchWorks, loadWork, getEntityRecord, …)
src/lib/actions.ts                  'use server' bridge for client components
src/lib/works.ts, venues.ts, …      API payload adapters and display helpers
src/lib/work-export.ts              Citation formats (BibTeX/RIS), access links, list items
src/lib/work-export-docx.ts         APA .docx builder (lazy-loaded)
src/lib/entity-export.ts            JSON export envelopes
src/lib/reading-list.ts             Personal reading list (localStorage) shared by every client
src/lib/site.ts                     Origin/brand constants and URL builders
src/lib/meta-text.ts                Title/description fitting
src/lib/structured-data.ts          JSON-LD builders and safe serializer
src/lib/sitemap.ts, docs.ts, markdown.ts, manifest.ts
src/i18n/                           next-intl config, routing, metadata builder
src/proxy.ts                        Locale routing and maintenance mode
messages/{en,pt,es}.json            UI strings (structurally identical)
public/css/styles.css               The stylesheet (SSOT); styles.min.css is generated
public/robots.txt, public/xml-list/ Robots policy; curated sitemap id lists
config/nginx.conf                   Vhost template
scripts/manage.sh                   Deploy and service control
scripts/nginx/render-config.sh      Renders/installs the vhost
scripts/systemd/                    Unit templates (app + opt-in IndexNow timer)
scripts/seo/                        SEO audit and IndexNow submitter
docs/SEO.md                         SEO/indexability contract
docs/data_doc/                      Corpus documentation (rendered at /docs/corpus)
docs/api_doc/                       API reference (unpublished)
```

## Conventions

- All source in English; user-facing strings only in `messages/*.json`, identical in structure across the three files.
- No comments in code or config. No inline CSS or JS; use the classes of `public/css/styles.css`.
- 2 spaces, semicolons, single quotes; PascalCase components, camelCase props and variables.
- Conventional Commits (`feat:`, `fix:`, `perf:`, `docs:`, `chore:`), short, imperative, English.
- `npm run lint` and `tsc` stay clean.

## Search domain rule

Every search result is a work. Searching an author, a venue, a subject or an institution returns works; entities are refinements, never results.

## Rendering and data

- **Static shells** — home, search, search results, global search, venues catalog, lists, docs, privacy, license and maintenance are prerendered at build time. They never read `headers()`, `cookies()` or `searchParams` on the server; client components read the URL after mount.
- **Entity pages are dynamic** — `works/[id]`, `persons/[id]`, `venues/[id]`, `institutions/[id]` and `subjects/[id]` are `force-dynamic` and read `?page=N` from `searchParams` (through `resolvePageParam`). The corpus is a long tail of millions of URLs, so a per-process render cache would cost more than it saves.
- **One HTTP path to the API** — `fetchJson()` injects `x-access-key` from `ETHNOS_API_KEY`, times out at 8 s and retries only 429, 5xx, network errors and timeouts (a 4xx is final). There is no `src/app/api/**` route and must not be one. The API sits behind its own nginx: a stopped API answers HTML `502`, which is never a missing entity.
- **Client → backend = server actions** in `src/lib/actions.ts`. A client component never calls `fetch` against the API or knows its URL.
- **Client components receive only what they render.** Every prop of a `'use client'` component is serialized into the page. Pass small derived values (links, ids, a list item, labels), never an API record; data needed only on click (exports) is fetched on click through an action. `NextIntlClientProvider` gets only `CLIENT_NAMESPACES` (`layout.tsx`); a client component that needs another namespace adds it there.
- **Params are Promises** — `await props.params` / `await props.searchParams`.
- **Missing entities answer 404** through `notFound()`. A malformed id (API `400 VALIDATION_ERROR` on the path) is also a 404: every entity lookup uses `isMissingEntityError`, never bare `isNotFoundError`.
- **Env files live in `/etc/`** — `/etc/next-frontend.env` (secrets included). Never create `.env*` in the tree; `ENV_FILE=` points elsewhere for local work.

## API model (v2)

- A **work** is abstract; its editions are `publications[]`. List endpoints (`/works`, `/works/showcase`, `/search/works`, `/venues/{id}/works`) return flat items merging one publication.
- `/works/{id}` is partially flat: root `publication_year`, `doi`, `open_access`, `peer_reviewed`, `language`, `venue`, `files[]`, `metrics`, `citations{cited_by[], references[]}` (the unresolved lists are not surfaced), `primary_publication` (scalar `doi`, no `identifiers`), publication-scoped `publisher`/`volume`/`issue`/`pages`/`publication_date`/`license_*`, and root `identifiers` as array-valued maps. `normalizeWorkDetail` flattens it; `open_access`/`peer_reviewed` use any-publication semantics. Citation and reference expansion uses `include_citations=true&include_references=true`; the authoritative counts come from `/works/{id}/metrics`, the full lists from `/works/{id}/citations|references` (the embedded envelope holds at most 100).
- **Contributors**: `authors[]` has one row per authorship with `role` ∈ `AUTHOR|EDITOR|TRANSLATOR|REVIEWER`, `position` 1-based *per role*; `contributors[]` has one row per person with `roles[]`. List items carry `contributors_preview[]` (max 3), `author_count`, `first_author{person_id,name}`; `/persons/{id}/works` items carry `authorship{role,roles[],position,is_corresponding}` and `authors{total_count,author_string}`; `/venues/{id}/works` items carry `authors[]` with a scalar `role`. Every role is surfaced, never filtered to `AUTHOR`: read entries with `pickContributorEntries` and group with the helpers of `works.ts` (`groupContributorsByRole` in the fixed order AUTHOR → EDITOR → TRANSLATOR → REVIEWER → OTHER, deduping within a role and sorting by position then array index; `groupContributorsByRoleSet` for display, one row per role set; `pickPrimaryContributors` for credit). `normWork` splits `authors`/`editors`/`translators`/`reviewers`; BibTeX emits `author`/`editor`/`translator`, RIS `AU`/`A2`/`A4`/`A3`.
- `/persons/{id}` returns one `primary_affiliation` (`normalizePersonDetail` shims it into `affiliations[]`).
- `/works` and `/works/showcase` take `limit` 1–100; the no-filter browse lists only publication-bearing works and its `total` is an estimate (`meta.pagination_total_exact: false` → `results.totalApprox`). `/search/works` takes `q`, `author`, `venue`/`venue_name`, `subject`, `work_type`, `language`, `year_from`, `year_to`, `peer_reviewed`, `open_access`, `page`, `limit`, `sort_by`, `sort_order`; never send `scope=works`. `searchWorks` is the only orchestrator (showcase for an empty browse, `/search/works` otherwise, `/works?search=` as fallback) and filter detection uses `SEARCH_FILTER_KEYS`. List options are emitted in snake_case (`sort_by`, `sort_order`, `cited_by_min`, `cited_by_max`).
- **Venues** share one payload across `/venues`, `/venues/search` and `/venues/{id}`: root fields plus `identifiers{}` (scalars), `indexing{}`, `metrics{}`, `ranking{}` and a `publisher` object whose `id` is an institution. `normalizeVenue` hoists the nested blocks to the root — a new block field is hoisted there. The venue description is `summary` (truncated at 500 chars on lists, complete on detail), never `ranking.llm.justification`. `/venues` filters and sorts are typed in `VenuesListFilters` and emitted through `VENUES_FILTER_PARAMS`.
- **Files** (`work.files[]`): `openacess_id` is `doi:…`, not a URL; `best_oa_url` is the OA full text when known; Sci-Hub uses the work DOI when a file has `scimag_id`; Libgen uses `md5` when `libgen_id` is set. `buildFileOpenAccessUrl` and `buildWorkAccessLinks` (`work-export.ts`) are the only derivations.

## Pages

- **Every detail page** renders its data table, then one `SectionTabs`, with Tools last: work **Abstract / Citations / References / Impact / Tools** (subjects inside Abstract; Impact from `authoritative_metrics`); venue **[Summary] / Recent / Prominent / First / Tools**; person **Recent / Prominent / First / [Expertise] / Tools**; institution **Recent / Prominent / First / [Funded] / [Production] / Tools**; subject **Recent / Prominent / First / Tools**.
- **Subjects link to a filtered search** through `SubjectLinks` (`/search/results?…&subject=<term>`, `rel="nofollow"`), never to `/subjects/{id}`.
- **Tools**: the work page uses `work-actions.tsx` (access links, add to list, JSON/BibTeX/RIS/APA); the other entities use `EntityTools` with `kind`, `entityId`, `filename`, `worksCount` and a label. Exports are fetched on click and lossless: the entity JSON is the full upstream record (`buildWorkExport`/`buildEntityExport`), the works corpus comes from `getEntityExportWorks` (person: every work; venue: current year; institution and subject: first 100; a 5,000-work stop, and `scope.truncated` is always surfaced). `normWork` is the citation shape only. `docx` is reached only through `await import('@/lib/work-export-docx')`.
- **Reading list** — `src/lib/reading-list.ts` is its only implementation (`readList`, `writeList`, `isListed`, `subscribeToList`); `ReadingListCounter` and `ListToggleBadge` subscribe to it.
- **Documentation** (`/docs`, `/docs/{collection}`, `/docs/{collection}/{slug}`) renders repository Markdown through the dependency-free parser (`markdown.ts` → typed AST, no injected HTML). `DOC_COLLECTIONS` (`docs.ts`) is the manifest; an empty source file is an unpublished chapter. The body is the English source; only the chrome (`docs.*`) is localized, and it stays English in all three files until reviewed translations exist. The section has no header or footer link.
- **External identifiers** link out (`target="_blank" rel="noopener noreferrer"`) through the registry in `src/lib/identifiers.ts`, whose keys are the normalized (hyphen/underscore-free) forms; an unregistered key is not rendered.

## i18n

- `en` is unprefixed; `pt` and `es` live under `/pt`, `/es`. `src/proxy.ts` (not next-intl's middleware): `/en/…` → 308 to the unprefixed URL; an unprefixed GET whose `NEXT_LOCALE` cookie (first) or Accept-Language (fallback) resolves to pt/es → 307 to the prefixed URL (`private, no-store`); everything else is rewritten to `/{locale}/…`. `LocaleSwitcher` is the only writer of `NEXT_LOCALE`.
- `LocaleLink` never passes `locale` to next-intl's `Link` and does not prefetch. The four header links carry `warm`: they prefetch once, on the first real input event, so chrome navigation is instant for people and costs nothing for scripted clients.
- Every page's metadata comes from `buildPageMetadata` / `fitPageTitle` / `composeDescription` and localized `metadata.*` keys; titles carry no brand suffix (the template adds it) and static descriptions are 120–160 characters in all three locales.
- New crawler-facing paths go into `shouldBypassIntl` (`src/proxy.ts`).

## SEO

`docs/SEO.md` is the contract and `scripts/manage.sh seo audit` its acceptance test. In short: `SITE_ORIGIN` is the only origin literal; canonical and hreflang come from `buildPageMetadata`; search results, global search, lists, maintenance and `/doi/*` are noindex, and robots.txt disallows the search surfaces; Highwire `citation_*` tags only on works; JSON-LD only through `JsonLd.tsx`; `/sitemap.xml` indexes `pages`, `recent`, `works`, `venues` and `persons`, one canonical URL per resource, `lastmod` only when true; legacy redirects in `(redirects)/` are single-hop 308s.

## Production

```
edge (Cloudflare) → nginx :1212 → next start -H localhost -p 1202
                    nginx :1211 → API 127.0.0.1:1201
```

- One **system** unit, `ethnos-app.service`, rendered from `scripts/systemd/ethnos-app.service` with the checkout owner as `User`, Node 20–24 from nvm (`NODE_BIN` overrides) and `ExecStart` running Next directly. Ports and the Node path are baked in at install time, so a change to them needs `deploy` (or `systemd:install` + `restart`).
- `deploy` stops the app for the build (nginx answers 502 meanwhile) because it deletes `.next`.
- The app binds `-H localhost`, never `-H 127.0.0.1`: with an IP literal, Next treats its own locale rewrites as external and every English URL redirects to itself.
- **nginx vhost** (`config/nginx.conf`, rendered from `/etc/next-frontend.env`: `NGINX_PUBLIC_PORT`, `APP_PORT`, `APP_UPSTREAM_HOST`, `NGINX_LISTEN_ADDRESS` — loopback unless set empty — `NGINX_SERVER_NAME`, `NGINX_IPV6`, `NGINX_PROXY_TIMEOUT`, optional TLS trio):
  - answers `/en` and `/en/…` with the 308 itself, before Node;
  - caps the upstream at 64 concurrent connections (`max_conns`), so a flood is shed at once instead of queueing in Node;
  - is the only compressor (`compress: false` in Next; `gzip_types` keeps `text/x-component` for RSC);
  - adds no headers to proxied responses (they come from `next.config.mjs`), does not intercept errors, and streams (`proxy_buffering off`);
  - logs the combined format plus `rt=`, `urt=`, `ip=` (`CF-Connecting-IP`) and `ray=`.
- Cloudflare 504 after ~5 s = nginx could not connect (Node's accept queue is full); after ~60 s = no answer within the read timeout; an immediate 502 = the app is down or over the connection cap.
- **Stylesheet**: pages link `/css/styles.min.css?v=<content hash>` (computed in `next.config.mjs`), served `immutable`; a CSS change reaches users only through a rebuild.
- **CSP** lives in `next.config.mjs`, report-only unless `CSP_ENFORCE=1` at build time; `'unsafe-inline'` is required by the prerendered hydration scripts. A new external asset needs its origin added first.
- **Maintenance**: `MAINTENANCE_MODE` (set by a systemd drop-in through `manage.sh maintenance`) makes the proxy answer every request with the localized maintenance page, HTTP 503 and `Retry-After`.
- **IndexNow**: with `INDEXNOW_AUTOSUBMIT=1` (production host only), `systemd:install` installs an hourly timer that submits new or re-dated sitemap URLs, keeping state in `.cache/indexnow/state.json`. Never resubmit the whole corpus.
- **Cloudflare** is configured by the operator, outside this repository.

## Gotchas

- Under `set -euo pipefail`, a command substitution whose `grep` may match nothing needs `|| true`, and an `a && b` list must not end a loop or function.
- The hosts run uutils coreutils, whose `install` fails with `No such file or directory` when the source is `/dev/stdin` and the destination exists: install from a temporary file.
- `Cannot find module './948.js'` on `next start` means a half-built `.next` or Node ≥ 25: run `deploy`.
- Never recreate `src/app/sitemap.ts` or `public/site.webmanifest` (they shadow the live routes), nor per-locale `robots.txt`.
- `loadWork()` and `getPersonsWorks()` are wrapped in React `cache()`: `generateMetadata` and the page share one fetch.
- Sitemap and docs code keep filesystem paths statically scoped (`path.join(process.cwd(), 'public', 'xml-list', file)`); a variable root makes Turbopack trace the whole project.
