# CLAUDE.md

## Project

**Ethnos** — Next.js 16 bibliographic discovery app for anthropology/sociology research. Multilingual (en, pt, es), static-first, with API proxy to a backend at `127.0.0.1:1211`.

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

## Project Layout

```
src/app/(site)/[locale]/         App Router pages (locale-prefixed)
src/app/api/[...path]/route.ts   API proxy (rate-limited, 15s timeout, 502 on failure)
src/components/common/           Shared React components
src/lib/                         Server utilities, API client, formatters
src/lib/work-export.ts           Shared export/citation utilities (BibTeX, RIS, APA, normalization)
src/i18n/                        next-intl config, routing, metadata helpers
src/proxy.ts                     Locale-aware middleware proxy
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
- `/works` accepts `search=` (not `q=`). `/search/works` accepts `q=`. `/search/works` supports `venue_name` / `venue` aliases and `include_facets`.
- `/works/{id}` citation/reference expansion uses the flags `include_citations=true&include_references=true` (**not** the old `include=metrics,references,files,venue,authors` CSV).

## Architecture Rules

- **Home, Search, Venues are fully static** (`dynamic = 'force-static'`, no `revalidate`). No `headers()`, `cookies()`, or request-bound APIs in these routes.
- **Pagination/filters are client-side** via `/api/**` proxy; the App Router shell stays static.
- **Next.js 16 params are Promises** — always `await props.params` before accessing fields.
- **API proxy** injects `x-access-key` from `ETHNOS_API_KEY`; never expose secrets to the client.
- **Env precedence:** `ENV_FILE` > `/etc/next-frontend.env` > `config/env/next-frontend.env` > `.env.local` > `.env`.

## i18n

- Default locale: `en` (no prefix in URL). `pt` and `es` get `/pt`, `/es` prefixes.
- Static shells must be generated per locale at build time.
- Navigation helpers from `@/i18n/routing`. Locale-aware links via `LocaleLink` component.
- Every localized page calls `buildPageMetadata` with matching message key.

## Key Files

- `src/lib/api.ts` — `fetchJson()` with retries (default 2), timeout (default 8s), API key injection
- `src/lib/endpoints.ts` — high-level API wrappers (`searchWorks`, `getWork`, `getPublication`, `getPersonsWorks`, `getPersonsWorksProminent`, `getVenuesPage`, `getVenueWorksPage`, `getVenueWorksByOffset`, `getHomeRecentWorks`, `getHomeTopVenues`). `searchWorks` routes empty queries to `/works/showcase` and falls back to `/works?search=…` on `/search/works` failure. `getWork` and `getPersonsWorks` apply the schema adapters below. List wrappers accept a `WorksListOptions` bag (`sortBy`, `sortOrder`, `citedByMin`, `citedByMax`) that maps to the backend's citation-aware query params (`sort_by=cited_by_count`, `cited_by_min`, `cited_by_max`). `/persons/{id}/works` returns one row per authorship record (an author listed twice appears twice), so `getPersonsWorks` and `getPersonsWorksProminent` dedupe by work id; the latter oversamples `limit × 4` (capped at 100) so the post-dedupe slice still has a full page.
- `src/lib/works.ts` — display helpers (author formatting, OA detection, abstract sanitization) **and** the v2 schema adapters:
  - `pickPrimaryPublication(raw)` — fallback heuristic used when the API does not surface `primary_publication`; chooses the canonical publication from `raw.publications[]` (OA+MAIN file wins; then has-files+MAIN; then OA; then any files; then newest `publication_date`; else first).
  - `flattenIdentifierArrays(idsObj)` — reduces `{doi:[…], pmid:[…], …}` to first-scalar per key.
  - `normalizeWorkDetail(raw)` — flattens a `/works/{id}` payload so downstream code reads the legacy flat shape (`publication{id,year,publication_date,volume,issue,pages,doi,peer_reviewed,open_access,license_*}`, `venue`, `publisher`, `files`, scalar `doi/pmid/isbn/…` aliases, plus `open_access` / `peer_reviewed` mirrored at the root). Prefers `raw.primary_publication` when present and falls back to `pickPrimaryPublication(raw)` otherwise; keeps the v2 root `files[]` array (which carries `publication_id`) over the per-publication files, and preserves root-level `publication_year` / `open_access` / `peer_reviewed` when the primary lacks them. No-op when there is neither a `primary_publication` nor any `publications[]` (i.e. already-flat list items).
  - `normalizePersonDetail(raw)` — shims `primary_affiliation` into `affiliations[]` for PersonPage.
  - `normalizePersonWorkItem(raw)` — maps `/persons/{id}/works` items (`publication.year`, `publication.journal`, `authors.author_string`) to the canonical list-item shape (`publication_year`, `venue.name`, `authors_preview[]`).
- `src/lib/work-export.ts` — shared citation/export functions: `normWork`, `toBibTeX`, `toRIS`, `toApaParagraph`, `normAuthor`, `buildAccessUrl`, `buildDoiUrl` (used by both `work-actions.tsx` and `ListPageClient.tsx`). `normWork` pre-flattens new-shape detail payloads via `normalizeWorkDetail` before reading fields; it emits a single canonical shape that already carries `id` and `url`. JSON exports use `{ exported_at, count, works }` — never wrap raw + normalized side by side. BibTeX text fields are escaped; `url`, `doi`, `abstract`, `note` (MD5) are emitted as standard BibTeX fields, never folded into `annote`.
- `src/components/common/GroupedIdentifiers.tsx` — shared identifier renderer (works detail page). Venues detail page renders each identifier on its own table row instead of grouping.
- `src/components/common/SectionTabs.tsx` — generic client component implementing the WAI-ARIA tabs pattern. Takes `ariaLabel` and `tabs: Array<{ key, label, content }>`; empty/falsy content tabs are filtered out so callers can pass conditional content inline. Uses `<div role="tablist">` with `aria-label`, `role="tab"` buttons with `aria-selected` / `aria-controls` / roving `tabIndex`, and keyboard navigation (Left/Right/Home/End). Panels use `role="tabpanel"` with `aria-labelledby` and `hidden` toggles. Styling: `.title-section.title-section-tabs` + `.section-tab` (selected/hover/focus-visible → `--label-gray`; unselected → `--border-gray`; `gap: var(--spacing-xl)`).
- `src/app/(site)/[locale]/(shells)/works/[id]/WorkSectionTabs.tsx` — thin server wrapper around `SectionTabs`; exposes the fixed **Abstract / References / Citations / Tools** ordering for the work detail page.
- `src/app/(site)/[locale]/(shells)/works/[id]/WorkRelatedList.tsx` — server component that renders a results list for references or cited-by items. Accepts `items`, a `pickAuthors` fn, and a flat `labels` bag so `page.tsx` no longer duplicates the reference/citation item markup.
- `src/app/(site)/[locale]/(shells)/persons/[id]/PersonPage.tsx` — server component for the person detail page. Renders the biographic data table, then uses `SectionTabs` with tabs **Recent / Prominent / Tools** (labels under `persons.sections.*`). "Recent" sorts the fetched page by `publication_year` DESC then `created_at` DESC; pagination nav lives in this tab. "Prominent" is a dedicated `getPersonsWorksProminent` fetch that hits the backend with `sort_by=cited_by_count&cited_by_min=1` and dedupes by work id — it always shows the author's top-cited works, no pagination.
- `src/app/(site)/[locale]/(shells)/persons/[id]/PersonWorksList.tsx` — server component that renders a person's work list with the open-access/badges pattern, empty-state copy, and `common.entities.titleUnavailable` fallback title.
- `src/app/(site)/[locale]/(shells)/persons/[id]/PersonTools.tsx` — client component inside the **Tools** tab. Offers one-click exports that operate on the currently fetched page of works: author metadata (JSON), publications (JSON / BibTeX / RIS / APA .docx). Reuses `normWork`, `toBibTeX`, `toRIS`, `toApaParagraph` from `src/lib/work-export.ts`.
- `src/app/(site)/[locale]/(shells)/venues/[id]/page.tsx` — venue detail page. After the biographic data/description/subjects sections it renders `SectionTabs` with **Recent / Prominent / First** (labels under `venues.sections.*`). "Recent" sorts the current page by `publication_year` DESC then `publication_date` DESC; pagination nav lives in this tab. "Prominent" is a dedicated `getVenueWorksPage` call with `sort_by=cited_by_count&cited_by_min=1&sortOrder=desc` — the venue's top-cited works, no pagination. "First" is a separate `getVenueWorksByOffset` call at `offset = max(0, total - limit)` sorted ASC, so it shows the venue's actual earliest works.
- `src/app/(site)/[locale]/(shells)/venues/page.tsx` + `VenuesList.tsx` — venues catalog page. Renders `SectionTabs` with four tabs (labels under `venues.listSections.*`, tablist aria-label `venues.listSections.navLabel`). Each tab is a server-fetched `VenuesList`:
  - **Melhores** (`best`, default) — `getVenuesPage(sortBy='score', sortOrder='DESC')`, paginated (sort propagates into the `/api/venues` refetch URL).
  - **Proeminentes** (`prominent`) — `sortBy='cited_by_count', sortOrder='DESC'`, fixed top 25.
  - **Recentes** (`recent`) — `sortBy='newest', type='JOURNAL'` (backend alias for `coverage_end_year DESC`), fixed top 25.
  - **Primeiros** (`first`) — `sortBy='oldest', type='JOURNAL'` (backend alias for `coverage_start_year ASC`), fixed top 25.
  Backend sortBy whitelist includes the `oldest` / `newest` aliases plus `{name, type, impact_factor, works_count, id, score, ranking, h_index, cited_by_count}`. `/venues` also accepts coverage filters (`coverage_from`, `coverage_to`, `active_in_year`, etc.) plumbed via `VenuesListFilters`. `VenuesList` accepts `paginated` / `sortBy` / `sortOrder` props to serve both paginated and curated modes. Each row renders an enriched meta line (type · publisher · coverage · ISSN · E-ISSN · works · `cited_by` · h-index · impact · country), plus a badges row with project-palette variants: Open Access (`.badge.open-acess`, yellow solid), DOAJ (`.badge.doaj`, blue outline), SciELO (`.badge.scielo`, red outline), Scopus (`.badge.scopus`, gray outline). Subjects are serialized via `pickSubjectsText` (reads `term` / `display_name` / `name` from subject objects, avoiding the prior "[object Object]" bug).
- `src/app/(site)/[locale]/(shells)/venues/[id]/VenueWorksList.tsx` — server component that renders a venue's publication as a list item with the shared open-access/badges pattern plus empty-state copy.
- `src/i18n/metadata.ts` — SEO metadata builder per locale
- `src/app/api/[...path]/route.ts` — rate-limited API proxy (15s timeout, 502 on backend failure)
- `src/app/.../works/[id]/work-detail.ts` — `loadWork()` wrapped with React `cache()`; fetches `/works/{id}?include_citations=true&include_references=true` and pipes the response through `normalizeWorkDetail`. The works/[id] page reads citation/reference lists from `work.citations.{references,cited_by}` (each entry: `work_id`, `title`, `authors` string, `publication_year`, `venue_name`, `venue_abbreviated_name`, optional `doi`, `open_access`, `citation_type`, `citation_status`, `citation_context`); the metrics row binds to `work.metrics.{citation_count,reference_count,download_count,view_count}`.

## Production Service

The app runs as a **systemd user service** (`ethnos-app.service`). Linger is enabled so it survives logout.

- **Source unit:** `scripts/systemd/ethnos-app.service`
- **Installed to:** `~/.config/systemd/user/ethnos-app.service`
- **Manage:** `systemctl --user {start|stop|restart|status} ethnos-app`
- **Logs:** `journalctl --user -u ethnos-app -f`
- `scripts/manage.sh restart` and `deploy` use `systemctl --user restart` automatically.
- **First-time setup:** `scripts/manage.sh setup_service` installs the unit, enables it, and configures linger.

## Gotchas

- If `Cannot find module './948.js'` on `next start`: ensure Node < 25, run `scripts/manage.sh deploy`.
- CSS changes: edit `public/css/styles.css`, then run `scripts/manage.sh css` to regenerate minified version.
- Three message files must stay structurally identical — adding a key in one requires adding it in all three.
- Export/citation functions (`normWork`, `toBibTeX`, `toRIS`, `toApaParagraph`) live in `src/lib/work-export.ts` — do not duplicate in page components.
- `loadWork()` and `getPersonsWorks()` are wrapped with React `cache()` — safe to call in both `generateMetadata` and page render without double-fetching.
