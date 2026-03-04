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
- Runtime scripts: `scripts/**` and lightweight wrappers in `bin/**`.
- Runtime env templates: `config/env/**` and `.env.example`.
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
- Dev (1210): `./bin/dev` or `npm run dev` serves `http://localhost:1210`.
- Build: `npm run build`.
- Prod (1212): `./bin/start` or `scripts/manage.sh start` runs the daemon on `:1212`.
- Foreground prod: `scripts/manage.sh start_foreground` (for service managers).
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
- Env source precedence in `scripts/manage.sh`: `ENV_FILE` -> `/etc/next-frontend.env` -> `config/env/next-frontend.env` -> `.env.local` -> `.env`.
- Keep templates aligned in `.env.example` and `config/env/next-frontend.env.example`.
- Core variables: `NODE_ENV=production`, `ETHNOS_UPSTREAM_API`, `ETHNOS_API_KEY`, `ETHNOS_API_KEY_2`, `NEXT_PUBLIC_DEV_API`.
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
- Linux `systemd` template: `scripts/systemd/ethnos-next.service` using `scripts/manage.sh start_foreground`.
- macOS `launchd` template: `scripts/launchd/ethnos-next.plist` using `scripts/manage.sh start_foreground`.
- Service templates assume checkout path `~/app`; adjust paths when repository location differs.
- Set `SYSTEMD_SERVICE=ethnos-next.service` for `scripts/manage.sh restart` and `scripts/manage.sh deploy` when using systemd.
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
- Use `next-intl` with `src/i18n/{config,metadata,request,routing}.ts`, keep the locale-aware proxy at `src/proxy.ts`, and store messages in `/messages/{locale}.json`.
- App Router pages live in `src/app/(site)/[locale]/**` so `/` is English and `/pt`, `/es` are localized variants.
- Static rendering is required per locale, and locale-specific shells must be generated at build time. Locale targeting does not make a page dynamic.
- Home, Search, and Venues stay fully static with `dynamic = 'force-static'` and no `revalidate`.
- Avoid request-bound APIs in static shells and layouts. Locale resolution must be handled by the proxy and static params, not by `headers()` or `cookies()` in server components for these routes.
- Navigation helpers must come from `@/i18n/routing`.
- Every localized page calls `buildPageMetadata` with the matching message key.
- Proxy resolves the active locale from the `NEXT_LOCALE` cookie or the `Accept-Language` header before rewriting to the locale-prefixed path.
