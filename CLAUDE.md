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
- `src/lib/endpoints.ts` — high-level API wrappers (search, venues, works, persons); `getPersonsWorks` uses `Promise.allSettled` for parallel fetch; `searchWorks` routes empty queries directly to `/works/showcase`
- `src/lib/work-export.ts` — shared citation/export functions: `normWork`, `toBibTeX`, `toRIS`, `toApaParagraph`, `normAuthor`, `attachEid` (used by both `work-actions.tsx` and `ListPageClient.tsx`)
- `src/lib/works.ts` — author formatting, OA detection, abstract sanitization
- `src/components/common/GroupedIdentifiers.tsx` — shared identifier renderer (used by works and venues detail pages)
- `src/i18n/metadata.ts` — SEO metadata builder per locale
- `src/app/api/[...path]/route.ts` — rate-limited API proxy (15s timeout, 502 on backend failure)
- `src/app/.../works/[id]/work-detail.ts` — `loadWork()` wrapped with React `cache()` for request deduplication

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
