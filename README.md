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
- `scripts/manage.sh` reads only `ENV_FILE` (default `/etc/next-frontend.env`); set `ENV_FILE=` to another path for local dev.
- Environment templates: `.env.example` and `config/env/next-frontend.env.example`.
- Environment should contain only secrets/keys: `ETHNOS_API_KEY`, `ETHNOS_API_KEY_2`.
- Server-side requests add `x-access-key` from `ETHNOS_API_KEY`.
- Client-side data access uses `/api/**` proxy to avoid exposing secrets.
- Upstream API target is defined in code as `http://127.0.0.1:1211`.

## Commands
- Install: `npm install`
- Dev (localhost:1210): `./bin/dev` or `npm run dev`, then open `http://localhost:1210`
- Build: `npm run build`
- Prod: `scripts/manage.sh deploy` — stops the app, rebuilds, (re)installs the system unit `ethnos-app.service` and the nginx vhost (`:1212` → loopback `1202`), starts and validates.
- Control: `scripts/manage.sh start|stop|restart|status` (system unit + nginx; `status` is read-only).
- `scripts/manage.sh help` lists every command; it mirrors `~/api/scripts/manage.sh`.

## Service Managers
- Ubuntu: `scripts/manage.sh systemd:install` renders `scripts/systemd/ethnos-app.service` into the **system** unit `/etc/systemd/system/ethnos-app.service` (`User=` the invoking user) and removes any user-scope copy. Manage it with `sudo systemctl … ethnos-app`; never as a `--user` unit.
- macOS: use `scripts/launchd/ethnos-next.plist` with `launchctl`.
- Both templates assume the repository is in `~/app`; adjust the path if your checkout directory is different.
- For both platforms, run `scripts/manage.sh deploy` after dependency or build-impacting changes.

## Notes
- Node support: `>=18.18 <25` with Active LTS `24.x` preferred.
- Work detail requests include `metrics,references,files,venue,authors`.
- Theming follows `prefers-color-scheme` using `:root[data-theme="dark"]` palette.
