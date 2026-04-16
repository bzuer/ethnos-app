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
- Detail endpoint `/works/{id}` is **not** flat: `venue`, `publisher`, `publication_year`, `volume`, `issue`, `pages`, `open_access`, `peer_reviewed`, `files[]` and scalar identifier aliases live **inside `publications[]`**, not at the work root. The frontend must flatten before rendering.
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
- `src/lib/endpoints.ts` — high-level API wrappers (`searchWorks`, `getWork`, `getPublication`, `getPersonsWorks`, `getVenuesPage`, `getVenueWorksPage`, `getHomeRecentWorks`, `getHomeTopVenues`). `searchWorks` routes empty queries to `/works/showcase` and falls back to `/works?search=…` on `/search/works` failure. `getWork` and `getPersonsWorks` apply the schema adapters below.
- `src/lib/works.ts` — display helpers (author formatting, OA detection, abstract sanitization) **and** the v2 schema adapters:
  - `pickPrimaryPublication(raw)` — chooses the canonical publication from `raw.publications[]` (OA+MAIN file wins; then has-files+MAIN; then OA; then any files; then newest `publication_date`; else first).
  - `flattenIdentifierArrays(idsObj)` — reduces `{doi:[…], pmid:[…], …}` to first-scalar per key.
  - `normalizeWorkDetail(raw)` — flattens a `/works/{id}` payload so downstream code reads the legacy flat shape (`publication{year,volume,issue,pages,doi,peer_reviewed,open_access}`, `venue`, `publisher`, `files`, and scalar `doi/pmid/isbn/…` aliases). No-op on already-flat list items.
  - `normalizePersonDetail(raw)` — shims `primary_affiliation` into `affiliations[]` for PersonPage.
  - `normalizePersonWorkItem(raw)` — maps `/persons/{id}/works` items (`publication.year`, `publication.journal`, `authors.author_string`) to the canonical list-item shape (`publication_year`, `venue.name`, `authors_preview[]`).
- `src/lib/work-export.ts` — shared citation/export functions: `normWork`, `toBibTeX`, `toRIS`, `toApaParagraph`, `normAuthor`, `buildAccessUrl`, `buildDoiUrl` (used by both `work-actions.tsx` and `ListPageClient.tsx`). `normWork` pre-flattens new-shape detail payloads via `normalizeWorkDetail` before reading fields; it emits a single canonical shape that already carries `id` and `url`. JSON exports use `{ exported_at, count, works }` — never wrap raw + normalized side by side. BibTeX text fields are escaped; `url`, `doi`, `abstract`, `note` (MD5) are emitted as standard BibTeX fields, never folded into `annote`.
- `src/components/common/GroupedIdentifiers.tsx` — shared identifier renderer (used by works and venues detail pages)
- `src/i18n/metadata.ts` — SEO metadata builder per locale
- `src/app/api/[...path]/route.ts` — rate-limited API proxy (15s timeout, 502 on backend failure)
- `src/app/.../works/[id]/work-detail.ts` — `loadWork()` wrapped with React `cache()`; fetches `/works/{id}?include_citations=true&include_references=true` and pipes the response through `normalizeWorkDetail`.

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
