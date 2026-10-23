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
src/lib/format.ts                   formatNumber(value, locale)
src/i18n/                           next-intl config, routing, metadata builder
src/proxy.ts                        Locale routing and maintenance mode
messages/{en,pt,es}.json            UI strings (structurally identical)
public/css/styles.css               The stylesheet (SSOT); styles.min.css is generated
public/robots.txt, public/xml-list/ Robots policy; curated sitemap id lists
config/nginx.conf                   Vhost template
config/env/next-frontend.env.example  Every variable the app and scripts read
scripts/manage.sh                   Deploy and service control
scripts/nginx/render-config.sh      Renders/installs the vhost
scripts/systemd/                    Unit templates (app + opt-in IndexNow timer)
scripts/seo/                        SEO audit and IndexNow submitter
docs/SEO.md                         SEO/indexability contract
docs/PRIVACY_AND_COOKIES{,_PT,_ES}.md  Privacy page body, one file per locale
docs/data_doc/                      Corpus documentation (rendered at /docs/corpus)
docs/~data_doc/                     Corpus chapter drafts (not rendered)
docs/concepts/                      Visual references (not rendered)
```

## Conventions

- All source in English; user-facing strings only in `messages/*.json`, identical in structure across the three files. Counts use ICU plurals (`{count, plural, one {# work} other {# works}}`) and numbers are formatted for the page locale with `formatNumber(value, locale)`.
- No comments in code or config. No inline CSS or JS; use the classes of `public/css/styles.css`.
- 2 spaces, semicolons, single quotes; PascalCase components, camelCase props and variables.
- Conventional Commits (`feat:`, `fix:`, `perf:`, `docs:`, `chore:`), short, imperative, English.
- `npm run lint` and `tsc` stay clean.

## Search domain rule

Every search result is a work. Searching an author, a venue, a subject or an institution returns works; entities are refinements, never results.

## Rendering and data

- **Static shells** — home, search, search results, global search, venues catalog, lists, docs, privacy, license and maintenance are prerendered at build time; the home revalidates hourly so its updates list follows the corpus. They never read `headers()`, `cookies()` or `searchParams` on the server; client components read the URL after mount.
- **Entity pages are dynamic** — `works/[id]`, `persons/[id]`, `venues/[id]`, `institutions/[id]` and `subjects/[id]` are `force-dynamic` and read `?page=N` from `searchParams` (through `resolvePageParam`); a page past the last one answers 404, a failed list fetch renders an empty tab. The corpus is a long tail of millions of URLs, so a per-process render cache would cost more than it saves.
- **One HTTP path to the API** — `fetchJson()` injects `x-access-key` from `ETHNOS_API_KEY` (all traffic leaves one IP, and without the key the API limits it to 120 requests a minute), times out at 8 s and retries once on `502`, network errors and timeouts; any other status is final (a `503 REQUEST_TIMEOUT` is the API's statement budget, which a retry only repeats). There is no `src/app/api/**` route and must not be one. The API sits behind its own nginx: a stopped API answers HTML `502`, which is never a missing entity.
- **Client → backend = server actions** in `src/lib/actions.ts`. A client component never calls `fetch` against the API or knows its URL.
- **Client components receive only what they render.** Every prop of a `'use client'` component is serialized into the page. Pass small derived values (links, ids, a list item, labels, the `VenueListItem` rows of `toVenueListPage`, the `toWorkListRow`/`toRelatedWorkRow` rows of `works.ts`), never an API record; data needed only on click (exports) is fetched on click through an action, and actions return only what their caller renders. `NextIntlClientProvider` gets only `CLIENT_NAMESPACES` (`layout.tsx`); a client component that needs another namespace adds it there.
- **Server actions are public endpoints.** Each one bounds its inputs (known parameters, limits, kinds, pages, text length) before reaching the API; nothing they fetch uses `force-cache`.
- **Params are Promises** — `await props.params` / `await props.searchParams`.
- **Missing entities answer 404** through `notFound()`. Every entity lookup is a path lookup with a fixed query, so any API `404` (`NOT_FOUND`) or `400` (`VALIDATION_ERROR` on a malformed id) means a missing entity: `isMissingEntityError` is the only status check `api.ts` exports.
- **Env files live in `/etc/`** — `/etc/next-frontend.env` (secrets included). Never create `.env*` in the tree; `ENV_FILE=` points elsewhere for local work.

## API model (v2)

The contract is the live OpenAPI spec, `http://127.0.0.1:1211/docs.json` (Swagger UI at `/docs`); the rules below are what the frontend relies on, including behaviour the spec leaves out.

- A **work** is abstract; its editions are `publications[]`. List endpoints return flat `WorkListItem` rows showing one publication (`publication_year`, `doi`, `venue{}`, `contributors_preview[]` ≤ 3, `author_count` across every role, `cited_by_count`, `references_count`, full `abstract`).
- `/works/{id}` is read as returned, with no normalizer: the root `publication_year`, `doi`, `venue` and `language` are the primary publication's; `open_access` and `peer_reviewed` are true when any publication is; `primary_publication` holds `publication_date`, `volume`, `issue`, `pages`, `publisher{}` and `license_url` (often a bare token such as `cc-by`, not a URL); `identifiers` maps each key to an array (the union over publications). `workDoi` is the root DOI, else the first of `identifiers.doi`. `peer_reviewed` is true for every publication and is never surfaced. `metrics.download_count`/`view_count` are always 0.
- **Contributors**: `authors[]` has one row per authorship with `role` ∈ `AUTHOR|EDITOR|TRANSLATOR|REVIEWER`, `position` 1-based *per role*; `contributors[]` has one row per person with `roles[]`. `/persons/{id}/works` rows carry `authorship{role,roles[],position,is_corresponding}`, `publication{year,journal,volume,issue,pages}` and `authors{total_count,author_string}`, where `author_string` joins every role with `'; '`; `/institutions/{id}/works` rows add `authors.authors_preview` (≤ 3) and `venue{}`; `/venues/{id}/works` rows carry `authors[]` with a scalar `role`, key the year as `year` and carry no venue. Every role is surfaced, never filtered to `AUTHOR`: read entries with `pickContributorEntries` and group with the helpers of `works.ts` (`groupContributorsByRole` in the fixed order AUTHOR → EDITOR → TRANSLATOR → REVIEWER → OTHER, deduping by person within a role and sorting by position then array index; `groupContributorsByRoleSet` for display, one row per role set; `pickPrimaryContributors` for credit). Names are never merged by spelling — distinct people share surnames and initials.
- `/persons/{id}` returns one `primary_affiliation{id,name}`; its `identifiers.wikidata_id`, `openalex_id` and `url` and `authorship_profile.open_access_works` are always null; `author_count`/`editor_count` count works.
- **Search**: `searchWorks` is the only orchestrator. It sends the known parameters (`q`, `author`, `venue`, `subject`, `work_type`, `language`, `year_from`, `year_to`, `open_access`, `cited_by_min`, `cited_by_max`, `sort_by`, `sort_order`, `page`, `limit` ≤ 100) to `/works`, which serves the empty browse (the showcase order, `id` DESC), filters and full text alike; `/search/works` returns the same rows but rejects pages above 1000. Query text is literal: letters, digits and `_` only, every word required, no phrases, operators or exclusions; text parameters take 2–200 (`q`) or 2–255 characters, `language` 2–5, years ≥ 1000. Full text pages over the first 100,000 matches; a page can under-fill, so paging follows `pagination.hasNext`. `total` is exact only when `meta.pagination_total_exact` is true — otherwise it is the whole-corpus estimate, never a count of the filtered set, and is not shown. `meta.page_degraded` (200 with `data: []`) is a load error. Types `CONFERENCE_PAPER` and `EDITORIAL` hold no works and are not offered.
- `/search/global` serves works and persons; its `institutions` block is permanently empty and is not read. `/search/autocomplete` returns `title|author|venue` suggestions; its `work_count` counts a sample, not the corpus, and is not shown. `relevance` is always null — no UI is built on it.
- **Venues** share one payload across `/venues`, `/venues/search` and `/venues/{id}`: root fields plus `identifiers{}` (scalars), `indexing{}`, `metrics{}`, `ranking{}`, `subjects[]` and a `publisher` object whose `id` is an institution. `normalizeVenue` spreads `identifiers`, `indexing` and `metrics` onto the root for the pages. The venue description is `summary` (truncated at 500 chars on lists, complete on detail). The page fetches `/venues/{id}` with `include_yearly`, `include_top_authors` and `include_recent_works` off. `/venues` sorts by `score` DESC by default (`newest`/`oldest` default to coverage end DESC / start ASC), takes the `VenuesListFilters` in use and rejects pages above 1000.
- **Institutions**: the page fetches `/institutions/{id}` with `include_works`, `include_authors` and `include_relationships` off (`recent_works` costs seconds). FUNDER and PUBLISHER organisations have `works_count` 0 and no affiliated works; their works are `/institutions/{id}/funded-works`.
- **Subjects**: `/subjects/{id}/works` has a fixed `id` DESC order (newest ingested) and ignores sort parameters; its rows carry only `id`, `title`, `publication_year`, `language`, `document_type` and `open_access`. `/works?subject=` matches words across every subject label of a work, not a subject id, so it never stands in for a subject's works. `courses_count` is always 0.
- **Work lists of an entity** (`/persons/{id}/works`, `/venues/{id}/works`, `/institutions/{id}/works`) are ordered by the API: Recent is `publication_year` DESC (the default), Prominent `cited_by_count` DESC with `cited_by_min=1`, First `publication_year` ASC. Never reorder a page on the client. `page` is accepted everywhere (the spec lists only `offset` on `/venues/{id}/works`); `offset` is served as given. List options are emitted in snake_case (`sort_by`, `sort_order`, `cited_by_min`).
- **Citations and references**: `/works/{id}?include_citations=true&include_references=true` embeds at most 100 rows of each, complete when shorter. The embedded `cited_by` equals page 1 of `/works/{id}/citations`, so its list continues from page 2. The embedded `references` is not page 1 of `/works/{id}/references`, which pages over every edge (resolved or not) and returns only the resolved ones in `referenced_works[]` — that list loads from page 1, dedupes by id and keeps fetching until a batch of new rows arrives. Paged rows carry `authors_count`, not names. In `/works/{id}/metrics`, `unique_citing_works` (the citing works, as counted by `/citations`) is the Citations count; `total_citations_received` counts edges and `citation_types` is only ever neutral, so neither is shown.
- **DOI resolver**: `/{doi}` returns the publication owning the DOI with its `work{id}`; `resolveDoi` decodes the path segments Next hands it, strips `doi:`/`doi.org` prefixes, encodes each segment once and turns the citation lists off.
- **Files** (`work.files[]`): `openacess_id` is `doi:…`, not a URL; `best_oa_url` is the OA full text when known; Sci-Hub uses the work DOI when a file has `scimag_id`; Libgen uses `md5` when `libgen_id` is set. `buildFileOpenAccessUrl` and `buildWorkAccessLinks` (`work-export.ts`) are the only derivations.

## Pages

- **Every detail page** renders its data table, then one `SectionTabs`. The work page's tabs are **Abstract / Citations / References / Impact** (subjects inside Abstract; Impact from `authoritative_metrics`), and Tools is a permanent section below them, always visible whichever tab is active. The other entities keep Tools as their last tab: venue **[Summary] / Recent / Prominent / First / Tools**; person **Recent / Prominent / First / [Expertise] / Tools**; institution **[Recent / Prominent / First] / [Funded] / [Production] / Tools**, the first three only with affiliated works; subject **Recent / Tools**. A person's works show their role when it is not AUTHOR.
- **Subject terms link to a filtered search** through `SubjectLinks` (`/search/results?…&subject=<term>`, `rel="nofollow"`); the only link to `/subjects/{id}` is a subject's parent row.
- **Tools**: the work page uses `work-actions.tsx` (access links, add to list, JSON/BibTeX/RIS/APA); the other entities use `EntityTools` with `kind`, `entityId`, `filename`, `worksCount` and a label (subjects offer JSON only: their rows have no authors, DOI or venue). Exports are fetched on click: the entity JSON is the upstream record plus `_links` (`getEntityRecord` fetches it bare; the work adds `authoritative_metrics`), the works corpus comes from `getEntityExportWorks` (person: every work; venue: current year, stamped with the venue and publisher its rows lack; institution and subject: first 100; a 5,000-work stop, and `scope.truncated` is always surfaced). `normWork` is the citation shape: it reads every row shape (detail, list, person, institution, venue, subject rows and reading-list items) and prefers the full `author_string` to any preview. `docx` is reached only through `await import('@/lib/work-export-docx')`.
- **Reading list** — `src/lib/reading-list.ts` is its only implementation (`readList`, `writeList`, `isListed`, `subscribeToList`); `ReadingListCounter` and `ListToggleBadge` subscribe to it. Items are `toListItem` records, whose `authors` is a list of names (`pickAuthorNames`, the 3-name preview on entity lists); list exports refetch each work without its citation lists.
- **Privacy** renders `docs/PRIVACY_AND_COOKIES{,_PT,_ES}.md` for the page locale.
- **Documentation** (`/docs`, `/docs/{collection}`, `/docs/{collection}/{slug}`) renders repository Markdown through the dependency-free parser (`markdown.ts` → typed AST, no injected HTML). `DOC_COLLECTIONS` (`docs.ts`) is the manifest; an empty source file is an unpublished chapter. The body is the English source; only the chrome (`docs.*`) is localized, and it stays English in all three files until reviewed translations exist. The section has no header or footer link.
- **External identifiers** link out (`target="_blank" rel="noopener noreferrer"`) through the registry in `src/lib/identifiers.ts`, whose keys are the normalized (hyphen/underscore-free) forms; an unregistered key is not rendered.

## i18n

- `en` is unprefixed; `pt` and `es` live under `/pt`, `/es`. `src/proxy.ts` (not next-intl's middleware): `/en/…` → 308 to the unprefixed URL; an unprefixed GET whose `NEXT_LOCALE` cookie (first) or Accept-Language (fallback) resolves to pt/es → 307 to the prefixed URL (`private, no-store`); everything else is rewritten to `/{locale}/…`. `LocaleSwitcher` is the only writer of `NEXT_LOCALE`.
- `LocaleLink` never passes `locale` to next-intl's `Link` and does not prefetch. The four header links carry `warm`: they prefetch once, on the first real input event, so chrome navigation is instant for people and costs nothing for scripted clients.
- Every page's metadata comes from `buildPageMetadata` / `fitPageTitle` / `composeDescription` and localized `metadata.*` keys; titles carry no brand suffix (the template adds it) and static descriptions are 120–160 characters in all three locales.
- New crawler-facing paths go into `shouldBypassIntl` (`src/proxy.ts`).

## SEO

`docs/SEO.md` is the contract and `scripts/manage.sh seo audit` its acceptance test. In short: `SITE_ORIGIN` is the only origin literal; canonical and hreflang come from `buildPageMetadata`; search results, global search, lists, maintenance and `/doi/*` are noindex, and robots.txt disallows the search surfaces; Highwire `citation_*` tags only on works; JSON-LD only through `JsonLd.tsx`; `/sitemap.xml` indexes `pages`, `recent`, `works`, `venues` and `persons`, one canonical URL per resource, `lastmod` only when true; each section publishes at most 50,000 URLs, the first ids of its curated list in `public/xml-list/` (venues and persons best-first; works every id cited at least 10 times, shuffled, so each reshuffle publishes a new sample); legacy redirects in `(redirects)/` are single-hop 308s.

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
- `loadWork`, `getPersonsWorks`, `getVenue`, `getVenueWorksPage`, `getInstitution` and `getSubject` are wrapped in React `cache()`, so `generateMetadata` and the page share one fetch — but only when called with identical arguments: pass the same `page` and a module-level options object (the venue page's `RECENT`), never an inline literal.
- `package.json` `allowScripts` pins the exact versions allowed to run install scripts; bumping one of those packages means updating its entry.
- Sitemap and docs code keep filesystem paths statically scoped and inline in the `fs` call (`fs.readFile(path.join(process.cwd(), 'public', 'xml-list', file))`); a variable root, or a path passed through a variable, makes Turbopack trace the whole project (`npm run build` prints the warning).
