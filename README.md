# Ethnos Next Frontend

Next.js (App Router) frontend for ethnos_app. This project ports Flask/Jinja screens to Next.js while preserving visual design, semantics, and interactions with a clean, minimal implementation.

## Project Snapshot
- Source of truth: `docs/html-css/**` (templates and CSS) and `docs/tsx/**` (reference TSX).
- Global CSS: `public/css/styles.css` stays aligned with `docs/html-css/static/css/styles.dev.css`.
- App code: `src/app/**`, `src/components/**`, `src/lib/**`, `public/**`.
- Localization messages: `messages/{locale}.json` must stay aligned across `en`, `pt`, `es`.

## Principles
- Keep SSOT CSS tokens and classes without renaming; no inline CSS or JS.
- Preserve semantic structure and accessibility from templates.
- English-only documentation and UI text unless localized via `messages/{locale}.json`.

## Routes
- Home: `/`
- Search form: `/search`
- Search results: `/search/results`
- Search results (Sphinx): `/search/sphinx`
- Work detail: `/works/[id]`
- Venues list: `/venues`
- Venue detail: `/venues/[id]`
- Personal list (CSR): `/lists`
- Person detail: `/persons/[id]` and `/persons/[id]/works`
- Redirects: `/results` → `/search`, `/works` → `/search`, `/works/sphinx` → `/search/sphinx`, `/journals` and `/journals/all` → `/venues`

## Rendering Model
- Home, Search, and Venues are static (`dynamic = 'force-static'` with no `revalidate`).
- Pagination and filters on static pages run client-side via `/api/**` proxy calls.

## Internationalization
- Localized routes live under `src/app/[locale]/**`; default locale is English.
- Locale-aware navigation must use helpers from `@/i18n/routing`.
- Middleware resolves locale via `NEXT_LOCALE` cookie or `Accept-Language` header before rewriting.
- `src/app/sitemap.ts` lists static shells and curated items with `alternates.languages` for `en`, `pt`, `es`.
- `public/site.webmanifest` stays in English and advertises shortcuts for each locale.

## Environment and API
- Environment source: `/etc/next-frontend.env`.
- Typical entries: `NODE_ENV=production`, `ETHNOS_UPSTREAM_API`, `ETHNOS_API_KEY`, `ETHNOS_API_KEY_2`, `NEXT_PUBLIC_DEV_API`.
- Server-side requests add `x-access-key` from `ETHNOS_API_KEY`.
- Client-side data access uses `/api/**` proxy to avoid exposing secrets.
- Default upstream fallback is `http://127.0.0.1:3000` when no overrides exist.

## Commands
- Install: `npm install`
- Dev (1210): `./bin/dev` then open `http://localhost:1210`
- Build: `npm run build`
- Prod (1212): `./bin/start` or `scripts/manage.sh start`
- Daemon control: `scripts/manage.sh start|stop|restart`
- Deploy: `scripts/manage.sh deploy`

## Notes
- Node support: `>=18.18 <25` with Active LTS `24.x` preferred.
- Work detail requests include `metrics,references,files,venue,authors`.
- Theming follows `prefers-color-scheme` using `:root[data-theme="dark"]` palette.
