# CLAUDE.md

## Project

**Ethnos** — Next.js 16 bibliographic discovery app for anthropology/sociology research. Multilingual (en, pt, es), static-first. All data is fetched server-side directly from the backend at `127.0.0.1:1211` — there is no in-app HTTP proxy; client components reach the backend through server actions in `src/lib/actions.ts`.

Tech stack: React 19, Next.js 16 (App Router), next-intl 4, TypeScript 5.9, Node 24.x LTS.

## Commands

| Task | Command | Port |
|------|---------|------|
| Dev | `./bin/dev` or `npm run dev` | 1210 |
| Build | `npm run build` | — |
| Prod (systemd) | `systemctl --user start ethnos-app` | 1212 |
| Deploy | `scripts/manage.sh deploy` | 1212 |
| Lint | `npm run lint` | — |
| CSS minify | `scripts/manage.sh css` | — |
| Setup service | `scripts/manage.sh setup_service` | — |
| Maintenance on/off/status | `scripts/manage.sh maintenance {on\|off\|status}` | — |

## Project Layout

```
src/app/(site)/[locale]/         App Router pages (locale-prefixed)
src/components/common/           Shared React components
src/lib/                         Server utilities, API client, formatters
src/lib/api.ts                   fetchJson() — the single HTTP client to 127.0.0.1:1211
src/lib/endpoints.ts             Server-only high-level wrappers (searchWorks, getWork, …)
src/lib/actions.ts               'use server' actions — RPC bridge for client components
src/lib/work-export.ts           Shared export/citation utilities (BibTeX, RIS, APA, normalization)
src/i18n/                        next-intl config, routing, metadata helpers
src/proxy.ts                     Locale-aware middleware proxy (no HTTP-level API proxy)
messages/{en,pt,es}.json         UI translations (must stay in sync)
public/css/styles.css            SSOT stylesheet
docs/html-css/                   Legacy HTML/CSS reference (visual parity target)
scripts/manage.sh                Build, deploy, daemon management
scripts/systemd/                 systemd user service unit
config/env/                      Env file templates
```

## Critical Conventions

- **All source code in English.** Localized strings only in `messages/*.json`.
- **No comments in code.** Remove any comments in sections you edit.
- **No inline CSS or JS.** Use SSOT classes from `public/css/styles.css`.
- **Code style:** 2 spaces, semicolons, single quotes. PascalCase components, camelCase props/vars.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`), short and imperative, in English.

## Search Domain Rule

- **Every search result is a work.** Regardless of entity type searched — author, venue, keyword, institution — the response is always a list of works. Searching an author returns that author's works. Searching a venue returns that venue's works. The work is the universal unit of search results.

## API v2 Entity Model

- Upstream is **Ethnos.app Academic Bibliography API v2.0.0** (OpenAPI at `http://127.0.0.1:1211/docs/`). A **work** is an abstract bibliographic entity (title, authors, subjects, citations, aggregated identifiers); concrete editions live in its **publications[]** array (one per venue/year/volume with its own files, DOI, ISSN, peer-review, open-access, license).
- List endpoints (`/works`, `/works/showcase`, `/search/works`, `/venues/{id}/works`) return already-flat items that merge one primary publication into the work.
- Detail endpoint `/works/{id}` is **partially flat** in v2: the root carries `publication_year`, `doi`, `open_access`, `peer_reviewed`, `has_files`, `language`, `venue`, `files[]`, plus a `year_range`, `languages[]`, `funding[]`, `metrics` (`citation_count`, `reference_count`, `download_count`, `view_count`, `altmetric_score`, `publications_*_count`, `total_files_*`), and a `citations` envelope with `cited_by[]`, `references[]`, `unresolved_references[]`, `unsolved[]`. The canonical publication is exposed directly as `primary_publication` (and indexed by `primary_publication_id`); each entry in `publications[]` also carries `is_primary` plus its own `venue`, `publisher`, `files[]`, and a per-publication `identifiers` object whose values are **scalars**. Root `identifiers` aggregates across publications as **array-valued** maps (`{doi:[…], pmid:[…], …}`). Fields that remain publication-scoped (not on the root): `publisher`, `volume`, `issue`, `pages`, `publication_date`, `license_url`, `license_version`. The frontend must still flatten — prefer reading `primary_publication` and merging scalar identifier aliases from it over guessing from the array. Root `files[]` carries `publication_id` linkage.
- `/persons/{id}` returns a single `primary_affiliation` object (not an `affiliations[]` array). `/persons/{id}/works` items have `publication.year` / `publication.journal` and `authors` as an object `{total_count, author_string}` (not an array).
- `/works` accepts `search=` (not `q=`). `/search/works` accepts `q=` and a full filter set: `author`, `venue`/`venue_name`, `subject`, `work_type` (or `type`), `language`, `year_from`, `year_to`, `peer_reviewed`, `open_access`, plus `page` / `limit` / `sort_by` / `sortOrder` / `include_facets`. Returns `{ status, data[], pagination{ page, limit, total, totalPages, hasNext, hasPrev }, meta }`; each item carries the flat list shape (`id`, `title`, `subtitle`, `abstract`, `publication_year`, `type`, `venue{}`, `doi`, `open_access`, `peer_reviewed`, `cited_by_count`, `language`, `authors_preview[]`, `first_author`, `relevance`). Empty `q` is accepted and behaves like a browse. Sphinx is the primary engine with a MariaDB fallback (signalled via `meta.note`). `scope=works` (used elsewhere) triggers a slow showcase query on this endpoint — keep the parameter out of `/search/works` requests.
- `/works/{id}` citation/reference expansion uses the flags `include_citations=true&include_references=true` (**not** the old `include=metrics,references,files,venue,authors` CSV).

## Architecture Rules

- **Home, Search, Venues are fully static** (`dynamic = 'force-static'`, no `revalidate`). No `headers()`, `cookies()`, or request-bound APIs in these routes.
- **One HTTP path to the API.** Every request to `127.0.0.1:1211` is made by `fetchJson()` in `src/lib/api.ts` — server components, `generateMetadata`, and server actions all share it. There is no `src/app/api/**` route and there must not be one; introducing an HTTP proxy duplicates URL/parameter logic and is the source of the dysfunctions that motivated removing it.
- **Client → backend = server actions.** Pagination, filters, autocomplete, and any other browser-triggered data fetch go through a `'use server'` function in `src/lib/actions.ts` (which internally calls `fetchJson` or a wrapper in `endpoints.ts`). Never call the backend via `fetch('/api/...')` from a client component, and never hard-code the backend URL on the client.
- **Next.js 16 params are Promises** — always `await props.params` before accessing fields.
- **The API key never leaves the server.** `fetchJson()` injects `x-access-key` from `ETHNOS_API_KEY`; because every backend call funnels through it, no client component (including server-action bodies sent over the wire) ever touches the secret.
- **Env files live in `/etc/`, period.** The frontend reads secrets (notably `ETHNOS_API_KEY`) from `/etc/next-frontend.env` (mode `0640 root:ubuntu`); the backend reads them from `/etc/node-backend.env`. Never populate `config/env/next-frontend.env`, `.env.local`, or `.env` in the worktree — even though `scripts/manage.sh load_env` and the systemd unit list them as fallbacks, they exist only to support local dev with explicit `ENV_FILE` overrides. Production secrets must not sit inside the project tree. Provision new keys with `sudo install -m 0640 -o root -g ubuntu /dev/stdin /etc/next-frontend.env <<< 'KEY=value'`.
- **Missing entities return HTTP 404, never 307.** Detail pages (`/works/[id]`, `/persons/[id]`, `/venues/[id]`) call `notFound()` from `next/navigation` when the entity is absent, which renders `src/app/(site)/[locale]/not-found.tsx` with a 404 status. Redirecting bad IDs to a listing/search page (the previous `?notice=*-not-found` pattern) was flagged by Google Search Console as soft 404 / redirect error and is forbidden.
- **Legacy URL redirects live in `src/app/(site)/[locale]/(redirects)/`.** Each route there must target an existing page; never add a redirect whose destination is itself a redirect (no chains) and never use this folder as a soft-404 sink.
- **`docx` must stay lazy.** `src/lib/work-export.ts` contains only the cheap text/normalization helpers (`normWork`, `toBibTeX`, `toRIS`, etc.). The `docx` library (Document/Packer/Paragraph/TextRun/AlignmentType) and the APA paragraph builder live in `src/lib/work-export-docx.ts`, which exposes `buildApaDocxBlob(works, fallbackAuthor, { spacing? })`. All export buttons (`work-actions.tsx`, `PersonTools.tsx`, `ListPageClient.tsx`) must reach `docx` only via `await import('@/lib/work-export-docx')` inside the click handler — never a top-level import, or the ~347 KiB JSZip/docx chunk lands in the initial bundle.
- **Modern browser target (`package.json#browserslist`).** Chrome/Edge/Firefox ≥ 100, Safari/iOS Safari ≥ 15.4, Samsung ≥ 19. Lets SWC skip transpilation of ES2022 features (Array.prototype.at, Object.hasOwn, etc.). Production builds are Turbopack — Next still inlines its tiny `polyfill-module.js` into the eager runtime chunk; that ~1.4 KiB cost is unavoidable until upstream fixes it, and is not worth switching to `next build --webpack` for.

## i18n

- Default locale: `en` (no prefix in URL). `pt` and `es` get `/pt`, `/es` prefixes.
- Static shells must be generated per locale at build time.
- Navigation helpers from `@/i18n/routing`. Locale-aware links via `LocaleLink` component.
- Every localized page calls `buildPageMetadata` with matching message key.

## Key Files

- `src/lib/api.ts` — `fetchJson()` with retries (default 2), timeout (default 8s), `x-access-key` injection from `ETHNOS_API_KEY`. Single HTTP client for the entire frontend; both SSR code and server actions use it.
- `src/lib/endpoints.ts` — server-only high-level API wrappers (`searchWorks`, `getWork`, `getPublication`, `getPersonsWorks`, `getPersonsWorksProminent`, `getVenuesPage`, `getVenueWorksPage`, `getVenueWorksByOffset`, `getHomeRecentWorks`, `getHomeTopVenues`). `searchWorks` is the **single** search-orchestrator: empty `q` with no active filter goes to `/works/showcase`; empty `q` with filters goes to `/search/works` (without `q`); non-empty `q` hits `/search/works` and falls back to `/works?search=…`. Filter detection uses the `SEARCH_FILTER_KEYS` whitelist — keep it in sync if a new filter is added. `getHomeRecentWorks` is **Sphinx-independent by design** — the home page is `force-static` so the build-time fetch must never touch a Sphinx-dependent endpoint (Sphinx may legitimately be off during a deploy and `/search/works?q=*` also fails upstream validation because `q` must be ≥ 2 chars). Primary call is `/works/showcase?limit=N` (pure `summary_publications` MariaDB query); on empty result or HTTP failure it falls back to `/works?limit=N` (same MariaDB path, default `work_id DESC` ordering). Avoid adding `sort_by` to the `/works` fallback — `/works?sort_by=…` currently returns zero rows for unauthenticated sort keys (`id`, `publication_year`, `cited_by_count`). `getWork` and `getPersonsWorks` apply the schema adapters below. List wrappers accept a `WorksListOptions` bag (`sortBy`, `sortOrder`, `citedByMin`, `citedByMax`) that maps to the backend's citation-aware query params (`sort_by=cited_by_count`, `cited_by_min`, `cited_by_max`). `/persons/{id}/works` returns one row per authorship record (an author listed twice appears twice), so `getPersonsWorks` and `getPersonsWorksProminent` dedupe by work id; the latter oversamples `limit × 4` (capped at 100) so the post-dedupe slice still has a full page.
- `src/lib/actions.ts` — `'use server'` module exposing the only backend bridge available to client components: `actSearchWorks(params)` (delegates to `searchWorks`), `actSearchSphinx(params)` (Sphinx `/search/advanced` with `/search/works` and `/works?search=` fallbacks), `actAutocomplete(query)` (parallel `/search/works`, `/venues/search`, `/search/persons` for the header combobox), `actGetWorkFull(id)` (single-work expansion with `include_citations=true&include_references=true`), and `actGetVenuesPage(page, limit, opts)`. Add a new action here whenever a client component needs new backend data — do not reach back to `fetch()` against an HTTP path.
- `src/lib/works.ts` — display helpers (author formatting, OA detection, abstract sanitization) **and** the v2 schema adapters:
  - `pickPrimaryPublication(raw)` — fallback heuristic used when the API does not surface `primary_publication`; chooses the canonical publication from `raw.publications[]` (OA+MAIN file wins; then has-files+MAIN; then OA; then any files; then newest `publication_date`; else first).
  - `flattenIdentifierArrays(idsObj)` — reduces `{doi:[…], pmid:[…], …}` to first-scalar per key.
  - `normalizeWorkDetail(raw)` — flattens a `/works/{id}` payload so downstream code reads the legacy flat shape (`publication{id,year,publication_date,volume,issue,pages,doi,peer_reviewed,open_access,license_*}`, `venue`, `publisher`, `files`, scalar `doi/pmid/isbn/…` aliases, plus `open_access` / `peer_reviewed` mirrored at the root). Prefers `raw.primary_publication` when present and falls back to `pickPrimaryPublication(raw)` otherwise; keeps the v2 root `files[]` array (which carries `publication_id`) over the per-publication files, and preserves root-level `publication_year` / `open_access` / `peer_reviewed` when the primary lacks them. No-op when there is neither a `primary_publication` nor any `publications[]` (i.e. already-flat list items).
  - `normalizePersonDetail(raw)` — shims `primary_affiliation` into `affiliations[]` for PersonPage.
  - `normalizePersonWorkItem(raw)` — maps `/persons/{id}/works` items (`publication.year`, `publication.journal`, `authors.author_string`) to the canonical list-item shape (`publication_year`, `venue.name`, `authors_preview[]`).
- `src/lib/work-export.ts` — shared citation/export functions: `normWork`, `toBibTeX`, `toRIS`, `toApaParagraph`, `normAuthor`, `buildAccessUrl`, `buildDoiUrl`, plus the file-object helpers `buildFileOpenAccessUrl`, `pickOpenAccessFile`, `pickLibgenFile`, `pickScimagFile` (used by both `work-actions.tsx` and `ListPageClient.tsx`). `normWork` pre-flattens new-shape detail payloads via `normalizeWorkDetail` before reading fields; it emits a single canonical shape that already carries `id`, `url`, and `oa_url` (best open-access URL derived from `files[]`). JSON exports use `{ exported_at, count, works }` — never wrap raw + normalized side by side. BibTeX text fields are escaped; `url`, `doi`, `abstract`, `note` (MD5) and `pdf_url` (OA URL when present and distinct from `url`) are emitted as standard fields, never folded into `annote`. RIS emits the OA URL as an extra `UR  -` line plus `L1  -` (full-text). APA appends the OA URL after DOI/access URLs when it differs.
- `src/components/common/GroupedIdentifiers.tsx` — shared identifier renderer (works detail page). Venues detail page renders each identifier on its own table row instead of grouping.
- `src/components/common/SectionTabs.tsx` — generic client component implementing the WAI-ARIA tabs pattern. Takes `ariaLabel` and `tabs: Array<{ key, label, content }>`; empty/falsy content tabs are filtered out so callers can pass conditional content inline. Uses `<div role="tablist">` with `aria-label`, `role="tab"` buttons with `aria-selected` / `aria-controls` / roving `tabIndex`, and keyboard navigation (Left/Right/Home/End). Panels use `role="tabpanel"` with `aria-labelledby` and `hidden` toggles. Styling: `.title-section.title-section-tabs` + `.section-tab` (selected/hover/focus-visible → `--label-gray`; unselected → `--border-gray`; `gap: var(--spacing-xl)`).
- `src/app/(site)/[locale]/(shells)/works/[id]/WorkSectionTabs.tsx` — thin server wrapper around `SectionTabs`; exposes the fixed **Abstract / References / Citations / Tools** ordering for the work detail page.
- `src/app/(site)/[locale]/(shells)/works/[id]/WorkRelatedList.tsx` — server component that renders a results list for references or cited-by items. Accepts `items`, a `pickAuthors` fn, and a flat `labels` bag so `page.tsx` no longer duplicates the reference/citation item markup.
- `src/app/(site)/[locale]/(shells)/persons/[id]/PersonPage.tsx` — server component for the person detail page. Renders the biographic data table, then uses `SectionTabs` with tabs **Recent / Prominent / Tools** (labels under `persons.sections.*`). "Recent" sorts the fetched page by `publication_year` DESC then `created_at` DESC; pagination nav lives in this tab. "Prominent" is a dedicated `getPersonsWorksProminent` fetch that hits the backend with `sort_by=cited_by_count&cited_by_min=1` and dedupes by work id — it always shows the author's top-cited works, no pagination.
- `src/app/(site)/[locale]/(shells)/persons/[id]/PersonWorksList.tsx` — server component that renders a person's work list with the open-access/badges pattern, empty-state copy, and `common.entities.titleUnavailable` fallback title.
- `src/app/(site)/[locale]/(shells)/persons/[id]/PersonTools.tsx` — client component inside the **Tools** tab. Offers one-click exports that operate on the currently fetched page of works: author metadata (JSON), publications (JSON / BibTeX / RIS / APA .docx). Reuses `normWork`, `toBibTeX`, `toRIS`, `toApaParagraph` from `src/lib/work-export.ts`.
- `src/app/(site)/[locale]/(shells)/venues/[id]/page.tsx` — venue detail page. After the biographic data/description/subjects sections it renders `SectionTabs` with **Recent / Prominent / First** (labels under `venues.sections.*`). "Recent" sorts the current page by `publication_year` DESC then `publication_date` DESC; pagination nav lives in this tab. "Prominent" is a dedicated `getVenueWorksPage` call with `sort_by=cited_by_count&cited_by_min=1&sortOrder=desc` — the venue's top-cited works, no pagination. "First" is a separate `getVenueWorksByOffset` call at `offset = max(0, total - limit)` sorted ASC, so it shows the venue's actual earliest works.
- `src/app/(site)/[locale]/(shells)/venues/page.tsx` + `VenuesList.tsx` — venues catalog page. Renders `SectionTabs` with four tabs (labels under `venues.listSections.*`, tablist aria-label `venues.listSections.navLabel`). Each tab is a server-fetched `VenuesList`:
  - **Melhores** (`best`, default) — `getVenuesPage(sortBy='score', sortOrder='DESC')`, paginated (sort propagates into the `actGetVenuesPage` action on the client).
  - **Proeminentes** (`prominent`) — `sortBy='cited_by_count', sortOrder='DESC'`, fixed top 25.
  - **Recentes** (`recent`) — `sortBy='newest', type='JOURNAL'` (backend alias for `coverage_end_year DESC`), fixed top 25.
  - **Primeiros** (`first`) — `sortBy='oldest', type='JOURNAL'` (backend alias for `coverage_start_year ASC`), fixed top 25.
  Backend sortBy whitelist includes the `oldest` / `newest` aliases plus `{name, type, impact_factor, works_count, id, score, ranking, h_index, cited_by_count}`. `/venues` also accepts coverage filters (`coverage_from`, `coverage_to`, `active_in_year`, etc.) plumbed via `VenuesListFilters`. `VenuesList` accepts `paginated` / `sortBy` / `sortOrder` props to serve both paginated and curated modes; client-side refetches on page change invoke `actGetVenuesPage` from `src/lib/actions.ts`. Each row renders an enriched meta line (type · publisher · coverage · ISSN · E-ISSN · works · `cited_by` · h-index · impact · country), plus a badges row with project-palette variants: Open Access (`.badge.open-acess`, yellow solid), DOAJ (`.badge.doaj`, blue outline), SciELO (`.badge.scielo`, red outline), Scopus (`.badge.scopus`, gray outline). Subjects are serialized via `pickSubjectsText` (reads `term` / `display_name` / `name` from subject objects, avoiding the prior "[object Object]" bug).
- `src/app/(site)/[locale]/(shells)/venues/[id]/VenueWorksList.tsx` — server component that renders a venue's publication as a list item with the shared open-access/badges pattern plus empty-state copy.
- `src/components/common/SearchForm.tsx` — shared client form used by both `/search` and the `/search/results` refine panel. Reads `useSearchParams()` and binds every field to React state via `useEffect` (initial state is empty so SSR matches the first client render, then state syncs from the URL — defaultValue/key remount tricks were unreliable for `<select>` after hydration). Submits via GET to `formAction` (the locale-aware `/search/results`); the **Clear** button resets state instead of relying on `<button type="reset">`. The autocomplete is delegated to `SearchAutocomplete`, which now has a `useEffect` to mirror its `defaultValue` prop into local `query` state so it tracks the form-controlled `state.q`.
- `src/app/(site)/[locale]/(shells)/search/page.tsx` — static shell that renders `<SearchForm />` plus the search tips section. The redundant `SearchFormClient` wrapper was removed.
- `src/app/(site)/[locale]/(shells)/search/results/SearchResultsClient.tsx` — client component for the search results page. Above the items list it renders a results summary (query echo via `t.rich('results.queryEcho')`, total via the `results.total` plural ICU message, page position via `results.pagePosition`) and a chip list of active filters (`.filter-chip` with × remove links built by stripping that key from the current URLSearchParams and appending the result to `pathname`). The form itself sits in a collapsible **Refine search** section (`section-toggle` button drives `aria-expanded` + `hidden` on the panel; always rendered collapsed on load regardless of query/filters — the user opens it manually via the toggle). Empty results yield two distinct messages: `results.startPrompt` when there are no query/filter params at all, `results.noResults` when there are. Data fetching is delegated to `actSearchWorks` (`src/lib/actions.ts`); the showcase-vs-search routing and the `/works?search=` fallback live in `searchWorks` (server-side) so SSR and CSR exercise the same branch logic. Filter values `true`/`false` are rendered through `formatFilterValue` so the chips show "Yes"/"No"/"Sim"/"Não" instead of raw booleans. Pagination row places the centered `pagination-info` (page X of Y) between Previous and Next.
- `src/i18n/metadata.ts` — SEO metadata builder per locale
- `src/app/.../works/[id]/work-detail.ts` — `loadWork()` wrapped with React `cache()`; fetches `/works/{id}?include_citations=true&include_references=true` and pipes the response through `normalizeWorkDetail`. The works/[id] page reads citation/reference lists from `work.citations.{references,cited_by}` (each entry: `work_id`, `title`, `authors` string, `publication_year`, `venue_name`, `venue_abbreviated_name`, optional `doi`, `open_access`, `citation_type`, `citation_status`, `citation_context`); the metrics row binds to `work.metrics.{citation_count,reference_count,download_count,view_count}`.

## Production Service

The app runs as a **systemd user service** (`ethnos-app.service`). Linger is enabled so it survives logout.

- **Source unit:** `scripts/systemd/ethnos-app.service`
- **Installed to:** `~/.config/systemd/user/ethnos-app.service`
- **Manage:** `systemctl --user {start|stop|restart|status} ethnos-app`
- **Logs:** `journalctl --user -u ethnos-app -f`
- `scripts/manage.sh restart` and `deploy` use `systemctl --user restart` automatically.
- **First-time setup:** `scripts/manage.sh setup_service` installs the unit, enables it, and configures linger.

## Maintenance Mode

The runtime flag is the env var `MAINTENANCE_MODE` (truthy values: `1`, `true`, `on`, `yes`). When set:

- `src/proxy.ts` intercepts every request (page or server-action POST), rewrites it to `/{locale}/maintenance`, returns **HTTP 503** with `Retry-After: 3600` and `Cache-Control: no-store`. Locale comes from the existing detection (path prefix → cookie → Accept-Language → default). Because every browser-triggered backend call now flows through a server action (which is a POST to a page URL), a single middleware-level short-circuit replaces what used to be a separate `/api` proxy guard.
- The page itself lives at `src/app/(site)/[locale]/maintenance/page.tsx` (`force-static`, prerendered for `en/pt/es`). Strings under `maintenance.*` in `messages/{en,pt,es}.json`; metadata under `metadata.maintenance`. The route is intentionally reachable directly so the rewrite target resolves; it also appears in the sitemap because it's a normal static page.

Toggle via:

- `scripts/manage.sh maintenance on` writes `~/.config/systemd/user/ethnos-app.service.d/maintenance.conf` with `Environment=MAINTENANCE_MODE=1`, runs `daemon-reload`, then `systemctl --user restart ethnos-app.service` if the service is active.
- `scripts/manage.sh maintenance off` removes that drop-in, reloads, and restarts.
- `scripts/manage.sh maintenance status` prints whether the drop-in exists and whether the service is active.

The flag lives in a systemd drop-in (never in `/etc/next-frontend.env` or the worktree), so toggling does not require sudo and the production secret file is left untouched. The service restart is intentional: the env var is read once at process start, and a restart guarantees fresh middleware behavior across all workers.

## File Objects (works/:id payload)

Each entry in `work.files[]` (work-detail or per-publication) carries:

```
{ file_id, publication_id, md5, format, size, pages, language, version,
  role: 'MAIN'|'SECONDARY',
  libgen_id, scimag_id, openacess_id, best_oa_url,
  verification, download_count }
```

- `openacess_id` (one-c spelling) is a DOI-shaped string like `"doi:10.xxx/yyy"`, NOT a URL. Strip the `doi:` prefix and prefix `https://doi.org/` to build a link.
- `best_oa_url` is the canonical open-access full-text URL when known; usually populated when `openacess_id` is set, but the export/button helpers must defensively cover the case where only `openacess_id` is present.
- Sci-Hub uses the work-level DOI (file objects have no `doi` field); the file's `scimag_id` is the only signal that a Sci-Hub mirror exists.
- Libgen uses the file's `md5` plus presence of `libgen_id`.

The shared helper `buildFileOpenAccessUrl(file)` in `src/lib/work-export.ts` encodes all of the above and is the single source of truth for OA URL derivation across `work-actions.tsx`, `work-detail.ts`, and `normWork` (which exposes the result as `oa_url` on the normalized work).

## Gotchas

- If `Cannot find module './948.js'` on `next start`: ensure Node < 25, run `scripts/manage.sh deploy`.
- CSS changes: edit `public/css/styles.css`, then run `scripts/manage.sh css` to regenerate minified version.
- Three message files must stay structurally identical — adding a key in one requires adding it in all three.
- Export/citation functions (`normWork`, `toBibTeX`, `toRIS`, `toApaParagraph`) live in `src/lib/work-export.ts` — do not duplicate in page components.
- `loadWork()` and `getPersonsWorks()` are wrapped with React `cache()` — safe to call in both `generateMetadata` and page render without double-fetching.
