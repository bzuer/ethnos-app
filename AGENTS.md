# Repository Guidelines

Operational directive: keep absolute cleanliness, technical clarity, hierarchy, and standardization. Do not version generated artifacts, logs, backups, or dumps. Remove out-of-scope content.
Operational directive: at the end of each session or significant change, create a commit summarizing the work.

## Language and Clean Code
- Keep the entire project in technical English: pages, metadata, documentation, UI text, and CSS/SSOT descriptions.
- Localized content is allowed only in locale-scoped assets: `messages/{locale}.json` for UI strings and `docs/**` files explicitly labeled for that language in the filename and content.
- Source code and scripts must be clean: do not add comments or annotations. When modifying files, remove any comments in the edited sections.
- Keep SSOT CSS tokens and classes without renaming. No inline CSS or JS.
- Use consistent English naming for components, props, variables, tests, commits, and PRs.

## Scope and Goals
- Port Flask/Jinja screens to Next.js while preserving visual design, semantics, and interactions.
- Prioritize simplicity, clean structure, visual parity, and lightweight implementation.
- Home, Search, and Venues must be pre-rendered at build time per locale (`dynamic = 'force-static'`, no `revalidate`) and never rely on per-request data.
- Pagination and filters for those pages are client-side via the `/api/**` proxy, keeping the App Router shell fully static.

## Project Layout
- App: `src/app/**`, `src/components/**`, `src/lib/**`, `public/**`.
- Global CSS: `public/css/styles.css` aligned with `docs/html-css/static/css/styles.dev.css`.
- SSOT references: `docs/html-css/**` (templates/CSS) and `docs/tsx/**` (reference TSX).
- Design guide: `docs/guides/DESIGN_GUIDE.md`.

## Routes
- Home: `/`
- Search form: `/search`
- Search results: `/search/results`
- Search results (Sphinx): `/search/sphinx`
- Work detail: `/works/[id]`
- Venues list: `/venues` (API `/venues`)
- Venue detail: `/venues/[id]`
- Personal list (CSR): `/lists`
- Person detail: `/persons/[id]`
- Person alias: `/persons/[id]/works` (same page)
- Redirects: `/results` -> `/search`, `/works` -> `/search`, `/works/sphinx` -> `/search/sphinx`, `/journals` and `/journals/all` -> `/venues`
 - Search results uses vitrine when `q=*` or when search is empty.

## Commands and Ports
- Dev (1210): `./bin/dev` loads `/etc/next-frontend.env` and serves `http://localhost:1210`.
- Build: `npm run build`.
- Prod (1212): `./bin/start` or `scripts/manage.sh start` runs the daemon on `:1212`.
- Daemon control: `scripts/manage.sh start|stop|restart` with logs at `/tmp/ethnos-next.log`.
- Static preview: `python3 -m http.server -d docs/html-css 8080` then open `templates/pages/home.html`.
- Deploy: `scripts/manage.sh deploy` runs clean, deps install, CSS build, prod build, and daemon restart.

## Build and Runtime
- Node: use Active LTS `24.x` (`.nvmrc`), supported range `>=18.18 <25`.
- Builds and prod start must run with `NODE_ENV=production`.
- If `Cannot find module './948.js'` appears in `next start`, ensure Node is `<25` and run `scripts/manage.sh deploy`.

## Code Style
- TS/React: 2 spaces, semicolons, single quotes.
- Components in PascalCase, props and variables in camelCase.
- One component per file; tests named `ComponentName.test.tsx`.
- CSS: keep SSOT classes and tokens; no inline CSS or JS.

## Theming
- Dark theme follows user `prefers-color-scheme` and reuses palette under `:root[data-theme="dark"]`.
- Avoid manual toggles unless explicitly required.

## UI Semantics and Accessibility
- Headings: page `h1.page-title`; section `h2.title-section`; result titles `h3.result-title`.
- Results list: `ul.results-list > li.result-item`.
- Result titles use `.result-link`; metadata uses `p.result-meta` with `.result-authors`, `.result-year`, `.result-type`.
- Use `.result-link` in non-tabular lists; use `.action-link` inside tables.
- Prefer mono typography (`var(--mono)`) for titles, labels, links, and meta per SSOT.
- Avoid redundant ARIA; add `aria-label` only when needed; use `aria-current` for active nav items.
- Buttons vs links: use `<button type="button">` for non-submit actions and `type="submit"` or `type="reset"` only in forms.
- Use Next.js `Link` or `<a href>` for navigation.
- In toolbars like `.tools-actions`, keep actions as buttons; DOI uses a button and opens a new tab with `noopener noreferrer`.
- User feedback: use `.temporary-message` with `.temporary-message-success|error|info` (or `.notification-*`) and remove after a short timeout.

## Testing
- Suggested: Vitest or Jest with React Testing Library.
- Focus on behavior and a11y (roles, labels, `aria-current`).
- Target at least 80 percent coverage for modified code.

## Commits and PRs
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`), short and imperative.
- PRs: English description, linked issues, screenshots for visual changes, tests and docs updated.
- Always commit at the end of a session or after major changes.

## Configuration and Security
- Env source: `/etc/next-frontend.env` with `NODE_ENV=production`, `ETHNOS_UPSTREAM_API`, `ETHNOS_API_KEY`, `ETHNOS_API_KEY_2`, `NEXT_PUBLIC_DEV_API`.
- Server-side requests add `x-access-key` from `ETHNOS_API_KEY`; never expose secrets to the client.
- Never commit secrets. Sanitize data before inserting into the DOM.
- API proxy rate limit returns 429 for suspicious traffic; optional env overrides: `ETHNOS_RATE_LIMIT_WINDOW_MS`, `ETHNOS_RATE_LIMIT_MAX`, `ETHNOS_RATE_LIMIT_SUSPICIOUS_MAX`.

## Data and Endpoints
- API base: server prefers `ETHNOS_UPSTREAM_API`; client uses `/api/...` proxy.
- When no overrides exist, server fetch helpers and `/api/...` proxy default to `http://127.0.0.1:3000`.
- Search: prefer `GET /search/sphinx`, fallback to `GET /search/works`.
- Work detail: include `metrics,references,files,venue,authors`.
- Personal list: localStorage key `ethnos_app_personal_list` (CSR only); exports JSON, RIS, BibTeX, APA.

## Work Detail Page
- Section order: Bibliographic Data -> Abstract -> References -> Cited By -> Tools.
- Authors in References and Cited By: prefer `authors` or `authors_preview` (first two, add `et al.` when `author_count` > 2); fallback to `formatted_authors` or `author_string`; final fallback `Author not informed`.
- Keep Open Access and Sci-Hub buttons visible only when the work data includes the matching identifiers.

## Not Found
- Custom `src/app/not-found.tsx` with no theme or toggle elements.

## Next.js 16 Dynamic Route Props
- In `app` routes, `params` and `searchParams` are Promises in React 19 and Next 16.
- Always unwrap with `await` or `React.use()` before access.
- Example:
  `export default async function Page(props: { params: Promise<{ id: string }>, searchParams?: Promise<Record<string, string>> }) { const { id } = await props.params; const sp = (await props.searchParams) || {}; }`

## Production Daemon
- `scripts/manage.sh start|stop|restart` runs a background daemon on port 1212 using `/tmp/ethnos-next.pid`.
- Systemd unit: `scripts/ethnos-next.service`; set `SYSTEMD_SERVICE=ethnos-next.service` for `scripts/manage.sh restart` and `scripts/manage.sh deploy`.
- Optional: `SYSTEMD_ARGS=--user` when running in user scope.
- `scripts/manage.sh deploy` is the only deploy pipeline and restarts the service after builds.
- Remove legacy pm2 or alternate managers before deploying.
- Logs are stored at `/tmp/ethnos-next.log`.
- Node `>=20 <25` is validated by `scripts/manage.sh`; 24.x preferred.

## SEO and Indexing
- Keep metadata (head tags, manifest, robots) aligned with the anthropology and sociology focus.
- `/sitemap.xml` lists static shells plus curated works, venues, and persons from `docs/top-list`.
- `src/app/sitemap.ts` provides localized URLs with `alternates.languages` for `en`, `pt`, `es`.
- `public/site.webmanifest` stays in English and declares shortcuts for each locale.
- Robots: allow indexing but disallow `/api/`, `/_next/`, `/works/sphinx`.
- Always expose `Sitemap: https://ethnos.app/sitemap.xml`.
- Sitemap static shells: include `/, /search, /venues, /lists`; do not list legacy redirect aliases.
- Manifest assets live under `public/` and referenced files must exist.
- Detail pages should expose citation/Dublin Core metadata in `generateMetadata` to support connectors and search engines.
- Work and person detail pages must generate item-specific `title`, `description`, `openGraph`, and `twitter` metadata, including the canonical URL, correct locale, and `article` or `profile` type.
- Add JSON-LD for detail pages (`ScholarlyArticle` or `Book` for works, `Person` for persons) with consistent identifiers.
- Metadata abstracts must be sanitized to remove UI strings and acknowledgements; omit `citation_abstract` and JSON-LD `description` when only noise remains.
- Avoid emitting `meta name="author"` lists from related works on person pages.

## Internationalization
- Default locale is English; `pt` and `es` must mirror structure and meaning for every UI label, heading, and metadata entry.
- Use `next-intl` with `src/i18n/{config,metadata,request,routing}.ts`, keep the locale-aware middleware at `src/middleware.ts`, and store messages in `/messages/{locale}.json`.
- App Router pages live in `src/app/(site)/[locale]/**` so `/` is English and `/pt`, `/es` are localized variants.
- Static rendering is required per locale, and locale-specific shells must be generated at build time. Locale targeting does not make a page dynamic.
- Home, Search, and Venues stay fully static with `dynamic = 'force-static'` and no `revalidate`.
- Avoid request-bound APIs in static shells and layouts. Locale resolution must be handled by middleware and static params, not by `headers()` or `cookies()` in server components for these routes.
- Navigation helpers must come from `@/i18n/routing`.
- Every localized page calls `buildPageMetadata` with the matching message key.
- Middleware resolves the active locale from the `NEXT_LOCALE` cookie or the `Accept-Language` header before rewriting to the locale-prefixed path.

## Maintenance Log
- 2026-02-16: Stage 1 executed and validated.
- `src/i18n/request.ts` now resolves locale from `requestLocale` with explicit-locale precedence.
- `src/app/layout.tsx` no longer emits an incorrect `html lang` value when locale context is unavailable at root.
- `src/app/[locale]/license/page.tsx` now uses `metadata.license`.
- `messages/en.json`, `messages/pt.json`, and `messages/es.json` include `metadata.license`.
- Added custom global not-found page at `src/app/not-found.tsx`.
- 2026-02-16: Stage 1 review/validation completed for `docs/ethnos.app`.
- Snapshot integrity issue identified: only `docs/ethnos.app/ethnos.app/index.html` is full HTML; other `.html` files are RSC/Flight fragments and not crawler-ready static documents.
- Validation status: `npm run build` passed; `npm run lint` failed due to pre-existing `react-hooks/set-state-in-effect` errors in list/search/venues client notices.
- 2026-02-16: Application-level corrections executed in source code (`src/app/**`) with focus on content, SEO, and runtime behavior.
- Hook effects refactored to resolve `react-hooks/set-state-in-effect` errors in personal list and notice components.
- Work DOI external link restored to `https://doi.org/...` in work detail identifiers.
- Venue metadata builder no longer emits related-work author arrays as page-level author metadata.
- Locale loading notices now use translated strings in search results and venues client lists.
- Global header brand in locale layout changed from `h1` to non-page heading text to keep one page-level `h1` per page shell.
- Validation status after fixes: `npm run lint` passed and `npm run build` passed.
- 2026-02-16: Next steps executed with incremental validation after each change set.
- Root sitemap switched from dynamic generation to static build output in `src/app/sitemap.ts`.
- Search results error state now uses work-specific i18n key `common.states.unableToLoadWorks` with messages updated in `messages/en.json`, `messages/pt.json`, and `messages/es.json`.
- Search results and venue detail loading components now render localized loading messages via `next-intl`.
- Validation status for next steps: `npm run lint` passed and `npm run build` passed; root `/sitemap.xml` now outputs as static route.
- 2026-02-16: Locale/SSR refactor completed for definitive `html lang` by locale without breaking SSG shells.
- Locale root moved to `src/app/(site)/[locale]/layout.tsx` with SSR `<html lang={locale}>` and locale-scoped head/body.
- Middleware moved to `src/middleware.ts` and continues locale resolution via `NEXT_LOCALE`/`Accept-Language` before rewrite.
- Added locale fallback route `src/app/(site)/[locale]/[...rest]/page.tsx` to trigger localized not-found flow within locale layout.
- Validation status for locale SSR refactor: `npm run lint` passed, `npm run build` passed, and SSG shells remained static for home/search/venues.
- Runtime checks executed on dev `:1210` and production `next start` (`:4010`) confirmed locale rewrite headers and `html lang` SSR for `/`, `/pt`, `/es`.
- 2026-02-17: Work-list badge interactions were extended across result-list pages.
- Added reusable client component `src/components/common/WorkMetaBadges.tsx` to render clickable Open Access badge and personal-list toggle badge in search, Sphinx, person works, venue publications, and work references/cited-by lists.
- Open Access badge now opens `https://oadoi.org/{doi}` in a new tab when DOI is available, preserving existing badge styling.
- Added list-toggle badge states with existing badge styling: neutral `Add to list`, green `In list`, and red hover state showing `Remove from list`.
- Added i18n keys `common.actions.inList` and `common.actions.removeFromList` in `messages/en.json`, `messages/pt.json`, and `messages/es.json`.
- Added helper exports `getWorkDoi` and `getWorkOpenAccessDoiUrl` in `src/lib/works.ts`.
- Validation status for badge feature: `npm run lint` passed and `npm run build` passed.
- 2026-02-17: Work-list badge labels were updated to custom locale wording and hover behavior was refined.
- Locale labels set to `pt: Incluir na lista/Excluir da lista`, `en: Save to list/Drop from list`, `es: Poner en lista/Quitar de lista`.
- Badge interaction now follows `gray + green hover` for non-listed works and `green + red hover` for listed works.
- 2026-02-17: Work-list badge state labels were refined by locale for explicit in-list status.
- Locale states updated to `en: Save to list / Already in list / Drop from list`, `pt: Incluir na lista / Já na lista / Excluir da lista`, `es: Poner en lista / Ya en lista / Quitar de lista`.
- 2026-02-17: Work-list item layout was reorganized into explicit blocks for readability and hierarchy.
- Result item rendering now follows `title -> details -> badges` across search results, Sphinx results, person works, venue publications, and work reference/cited-by lists.
- `WorkMetaBadges` no longer injects separator bullets, and `.result-badges` spacing was added in `public/css/styles.css`.
- Validation status for hierarchy adjustment: `npm run lint` passed and `npm run build` passed.
- 2026-02-17: Badge disposition was refined by action type semantics.
- Open Access badge now remains in `.result-meta` as a metadata qualifier, while personal-list actions render in a dedicated action row below metadata and above abstract content.
- `WorkMetaBadges` now supports independent rendering flags for Open Access and list actions (`showOpenAccessBadge`, `showListBadge`) to preserve the `title -> metadata -> action zone -> abstract` hierarchy.
- Validation status for badge disposition refinement: `npm run lint` passed and `npm run build` passed.
- 2026-02-17: Open Access badge positioning and alignment were refined in metadata rows.
- Open Access now renders at the start of `.result-meta` across work-list contexts, followed by bibliographic metadata.
- Metadata row alignment was adjusted so badges and text share a consistent vertical baseline (`.result-meta` now centers inline items and `.result-meta .badge` uses middle alignment).
- Validation status for OA start-position/alignment adjustment: `npm run lint` passed and `npm run build` passed.
- 2026-02-17: Metadata separators were standardized and language labels were removed from result-list rows.
- Removed language display from work result metadata in search and Sphinx result lists.
- Metadata delimiters are now rendered through a single `.meta-separator` element to avoid mixed glyph/font rendering and keep uniform spacing/alignment.
- Validation status for language/separator normalization: `npm run lint` passed and `npm run build` passed.
- 2026-02-17: Metadata/action spacing and horizontal alignment were refined for work-list items.
- Open Access badge and metadata tokens were normalized to inline-flex alignment for consistent horizontal rhythm and vertical centering.
- Paragraph spacing hierarchy was tuned to `title -> metadata` (2 units), `metadata -> list action` (1 unit), and `list action -> abstract` (2 units).
- Locale action labels were standardized for uniform length and wording in list states/actions (`en`, `es`, `pt`).
- Validation status for spacing/alignment/labels refinement: `npm run lint` passed and `npm run build` passed.
- 2026-02-17: Work-list spacing hierarchy was adjusted to increase action-to-abstract separation.
- Updated `.result-item .result-badges + .result-abstract` to `3` spacing units (`calc(var(--spacing-xs) * 3)`) while preserving `title -> metadata` (2) and `metadata -> action` (1).
- Validation status for spacing increment: `npm run lint` passed and `npm run build` passed.
- 2026-02-17: List-action color palette and removal notices were normalized.
- Replaced green in-list badge state with blue by mapping `--badge-in-list` to the theme blue palette in light/dark modes.
- Item removal notifications now use the red/error channel in both result-list badge actions and personal-list table actions.
- Validation status for color/notification normalization: `npm run lint` passed and `npm run build` passed.
- 2026-02-17: Text hyphenation was enabled for abstract/description/metadata classes.
- Added a unified hyphenation rule for `.abstract`, `.description`, `.metadata`, `.result-abstract`, `.result-meta`, and related metadata text classes to improve wrapping and readability in long entries.
- Validation status for hyphenation update: `npm run lint` passed and `npm run build` passed.
- 2026-02-17: Text hyphenation coverage was expanded to all major UI text blocks.
- Replaced the narrow hyphenation selector in `public/css/styles.css` with a broader text-element rule covering headings, paragraphs, links, labels, table cells, titles, metadata rows, abstracts, and status messages.
- Removed DOI-link overrides that forced normal wrapping so DOI text can follow the global hyphenation and wrap behavior.
- Validation status for global hyphenation expansion: `npm run lint` passed and `npm run build` passed.
- 2026-02-17: Metadata line-wrap behavior was corrected for result rows.
- In `public/css/styles.css`, metadata tokens inside `.result-meta` now allow shrink/wrap (`min-width: 0` on children) and text tokens render as inline text with `white-space: normal`.
- Updated `.result-authors`, `.result-publisher`, `.result-venue`, `.result-country`, `.result-issn`, `.result-eissn`, `.result-year`, `.result-coverage`, `.result-type`, `.result-total`, `.result-cited`, and `.result-doi` to text-flow display to prevent no-wrap behavior from `inline-flex`.
- Validation status for metadata wrap correction: `npm run lint` passed and `npm run build` passed.
- 2026-02-17: Metadata wrapping strength was increased for long venue strings in result lists.
- Updated metadata text tokens in `public/css/styles.css` to `inline-block` with `max-width: 100%`, `min-width: 0`, and `overflow-wrap: anywhere` for stronger line breaking when needed.
- Added flexible sizing for `.result-venue` (`flex: 1 1 24ch`) so long venue names can occupy remaining row width and wrap instead of forcing a single-line token.
- Validation status for stronger metadata wrapping: `npm run lint` passed and `npm run build` passed.
- 2026-02-17: Metadata wrapping was stabilized to avoid visual fragmentation in result rows.
- Removed the flexible growth rule from `.result-venue` and downgraded metadata token wrapping from `overflow-wrap: anywhere` to `overflow-wrap: break-word` in `public/css/styles.css`.
- This preserves wrapping and hyphenation while preventing isolated metadata chunks and large spacing artifacts in mixed-token rows.
- Validation status for metadata wrapping stabilization: `npm run lint` passed and `npm run build` passed.
- 2026-02-17: In-list badge hover labels were fixed to avoid simultaneous rendering.
- Narrowed the metadata span selector in `public/css/styles.css` from descendant scope to direct-child scope so nested spans inside `.badge-list-toggle` are not overridden.
- This restores the expected state behavior: only `In the list` at rest, `Remove item` only on hover/focus.
- Validation status for badge-label fix: `npm run lint` passed and `npm run build` passed.
- 2026-02-17: Automatic hyphenation was disabled globally to prevent fragmented title/metadata wrapping.
- Updated the global text `:where(...)` rule in `public/css/styles.css` from `hyphens: auto` to `hyphens: none` (including vendor-prefixed properties).
- Applied technical-string wrapping rules for `.result-doi`, `.result-doi a`, `.result-link`, and `.md5-code` using `overflow-wrap`/`word-break` tuned for long identifiers and links.
- Updated `.result-abstract` to `text-align: left` with hyphenation disabled for more stable paragraph spacing.
- Validation status for hyphenation/wrapping realignment: `npm run lint` passed and `npm run build` passed.
- 2026-02-17: Metadata entities were normalized with explicit character limits across list views.
- Added reusable metadata formatters in `src/lib/works.ts` (`formatMetadataAuthors`, `formatMetadataVenue`, `formatMetadataType`, `truncateMetadataText`) with centralized limits (`authors: 80`, `venue: 80`, `type: 32`).
- Author rendering now consistently follows `first, second, et al.` logic with truncation applied when metadata strings exceed limits.
- Applied the formatter layer to search results, Sphinx results, person works, venue publications, home recent updates, and work reference/cited-by author rendering.
- Validation status for metadata-limit normalization: `npm run lint` passed and `npm run build` passed.
- 2026-02-19: Venue display names were updated to prioritize abbreviated journal names from venue payloads.
- Added `pickVenueDisplayName` in `src/lib/works.ts` and updated `pickWorkVenue` to prefer abbreviated fields (`abbreviated_name`, journal abbreviation variants) before full names, with fallback compatibility.
- Applied abbreviated venue rendering in home top venues (`src/app/(site)/[locale]/(shells)/page.tsx`) and venues list results (`src/app/(site)/[locale]/(shells)/venues/VenuesList.tsx`).
- Extended work-list metadata rows to include formatted venue names in Sphinx results, person works, and work detail references/cited-by sections.
- Updated venue typing in `src/lib/api.ts` to include `abbreviated_name` and `summary_snapshot.abbreviated_name`.
- Validation status for abbreviated-venue adoption: `npm run lint` passed and `npm run build` passed.
- 2026-02-19: Venue-name scope was refined by page type.
- Restored full journal names for venues-facing pages and detail contexts, including home top venues (`src/app/(site)/[locale]/(shells)/page.tsx`) and venues list (`src/app/(site)/[locale]/(shells)/venues/VenuesList.tsx`).
- Kept abbreviated venue rendering only in work-list contexts requested: search results (`src/app/(site)/[locale]/(shells)/search/results/SearchResultsClient.tsx`) and person works (`src/app/(site)/[locale]/(shells)/persons/[id]/PersonPage.tsx`).
- Removed abbreviated-venue insertion from Sphinx results and work detail references/cited-by sections to preserve full-name behavior in non-requested contexts.
- Validation status for scope refinement: `npm run lint` passed and `npm run build` passed.
- 2026-02-20: Venue metadata labels were constrained to a 50-character limit in target result-list contexts.
- Applied `formatMetadataVenue(item, 50)` in search results (`src/app/(site)/[locale]/(shells)/search/results/SearchResultsClient.tsx`) and person works (`src/app/(site)/[locale]/(shells)/persons/[id]/PersonPage.tsx`).
- Added venue metadata rendering with the same 50-character cap in work detail references and cited-by sections (`src/app/(site)/[locale]/(shells)/works/[id]/page.tsx`) under `references-block` and `citations-block`.
- Retained existing venue-name source behavior and removed session-only abbreviation-enrichment adjustments to keep scope limited to truncation.
- Validation status for venue-length normalization: `npm run lint` passed and `npm run build` passed.
- Runtime checks on `http://localhost:1210/pt/search/results?q=&scope=works&limit=20`, `http://localhost:1210/pt/persons/3753309`, and `http://localhost:1210/pt/works/4620649` confirmed venue rendering with list-context truncation.
