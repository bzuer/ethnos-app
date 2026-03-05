# Ethnos App Frontend (Next.js)

[![DOI](https://zenodo.org/badge/1050037172.svg)](https://doi.org/10.5281/zenodo.17050053)


Next.js (App Router) frontend for Ethnos App. This project ports Flask/Jinja screens to Next.js while preserving visual design, semantics, and interactions with a clean, minimal implementation.

## Project Snapshot
- Source of truth: `docs/html-css/**` (templates and CSS) and `docs/tsx/**` (reference TSX).
- Global CSS: `public/css/styles.css` stays aligned with `docs/html-css/static/css/styles.dev.css`.
- App code: `src/app/**`, `src/components/**`, `src/lib/**`, `public/**`.
- Runtime scripts: `scripts/**`, wrappers in `bin/**`, env templates in `config/env/**`.
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
- Localized routes live under `src/app/(site)/[locale]/**`; default locale is English.
- Locale-aware navigation must use helpers from `@/i18n/routing`.
- Proxy resolves locale via `NEXT_LOCALE` cookie or `Accept-Language` header before rewriting.
- `src/app/sitemap.ts` lists static shells and curated items with `alternates.languages` for `en`, `pt`, `es`.
- `public/site.webmanifest` stays in English and advertises shortcuts for each locale.

## Environment and API
- Environment resolution order in `scripts/manage.sh`: `ENV_FILE` -> `/etc/next-frontend.env` -> `config/env/next-frontend.env` -> `.env.local` -> `.env`.
- Environment templates: `.env.example` and `config/env/next-frontend.env.example`.
- Environment should contain only secrets/keys: `ETHNOS_API_KEY`, `ETHNOS_API_KEY_2`.
- Server-side requests add `x-access-key` from `ETHNOS_API_KEY`.
- Client-side data access uses `/api/**` proxy to avoid exposing secrets.
- Upstream API target is defined in code as `http://127.0.0.1:1211`.

## Commands
- Install: `npm install`
- Dev (1210): `./bin/dev` or `npm run dev`, then open `http://localhost:1210`
- Build: `npm run build`
- Prod (1212): `./bin/start` or `scripts/manage.sh start`
- Foreground prod: `scripts/manage.sh start_foreground`
- Daemon control: `scripts/manage.sh start|stop|restart`
- Deploy: `scripts/manage.sh deploy`

## Service Managers
- Ubuntu: use `scripts/systemd/ethnos-next.service` and set `SYSTEMD_SERVICE=ethnos-next.service` for managed restarts.
- macOS: use `scripts/launchd/ethnos-next.plist` with `launchctl`.
- Both templates assume the repository is in `~/app`; adjust the path if your checkout directory is different.
- For both platforms, run `scripts/manage.sh deploy` after dependency or build-impacting changes.

## Notes
- Node support: `>=18.18 <25` with Active LTS `24.x` preferred.
- Work detail requests include `metrics,references,files,venue,authors`.
- Theming follows `prefers-color-scheme` using `:root[data-theme="dark"]` palette.
