# Ethnos App — Release Notes

**Version:** 0.1.0
**Release date:** 2026-04-14
**Commit:** `7b5fd39` (2026-04-12)
**Branch:** `main`

Ethnos is a multilingual (en/pt/es) bibliographic discovery frontend for
anthropology and sociology research. It proxies a backend API at
`127.0.0.1:1211` and serves a static-first App Router shell with client-side
pagination and filters.

## Runtime

| Component  | Version              |
|------------|----------------------|
| Next.js    | 16.0.7 (App Router)  |
| React      | 19.2.0               |
| next-intl  | 4.5.0                |
| TypeScript | 5.9.3                |
| Node       | `>=18.18 <25` (24.x LTS preferred) |

## Build Status

- `npm run lint` — clean (eslint 9.39.0, `eslint-config-next` 16.0.1).
- `npm run build` — succeeds. 43 routes generated, 22 prerendered as static
  HTML (home, search form, search results, search/sphinx, venues, lists,
  license, privacy × 3 locales each) and 21 dynamic (`works/[id]`,
  `venues/[id]`, `persons/[id]`, `persons/[id]/works`, redirects,
  localized sitemaps, API proxy).
- `.next` build artifacts ≈ 23 MB.

## Feature Inventory

### Pages & routes
- **Home** (`/`) — static; showcase works, search box with autocomplete.
- **Search form** (`/search`) — static; unified form (no scope selector), filter-only browsing supported.
- **Search results** (`/search/results`) and **Sphinx results** (`/search/sphinx`) — static shells, client-side pagination, summary header and no-results state.
- **Work detail** (`/works/[id]`) — dynamic; metrics, references, files, venue, authors; JSON-LD + COinS metadata; citation/export actions.
- **Venues list** (`/venues`) — static; filter-driven client-side browsing.
- **Venue detail** (`/venues/[id]`) — dynamic; grouped identifiers, venue works list.
- **Person detail** (`/persons/[id]`) — dynamic; parallel-fetched works via `Promise.allSettled`; JSON-LD.
- **Lists** (`/lists`) — client-side personal list with export/citation actions.
- **License** and **Privacy** — static legal pages (three locales each).
- **Redirects** — `/results → /search`, `/works → /search`, `/works/sphinx → /search/sphinx`, `/journals[/all] → /venues`, `/persons/[id]/works → /persons/[id]`.
- **API proxy** (`/api/[...path]`) — server-only passthrough to backend.
- **SEO** — `robots.txt`, top-level `sitemap.xml`, localized `sitemap.xml` per locale, per-page `buildPageMetadata`, `alternates.languages` for `en`/`pt`/`es`, `site.webmanifest`.

### Search domain
- **Universal rule:** every search result is a work, regardless of whether the user searched authors, venues, keywords, or institutions.
- **Autocomplete** across search inputs (`SearchAutocomplete` used by `HomeSearchInput` and `SearchFormClient`).
- **Empty queries** route directly to `/works/showcase` via `searchWorks`.

### Citation & export
- Shared utilities in `src/lib/work-export.ts`: `normWork`, `toBibTeX`, `toRIS`, `toApaParagraph`, `normAuthor`, `buildAccessUrl`, `buildDoiUrl`.
- BibTeX text fields are escaped; `url`, `doi`, `abstract`, and `note` (MD5) are emitted as first-class BibTeX fields (never folded into `annote`).
- JSON exports ship a canonical envelope `{ exported_at, count, works }`.
- DOCX export via `docx` 9.5.1.

### Internationalization
- Locales: `en` (default, no prefix), `pt`, `es`.
- Locale-aware middleware (`src/proxy.ts`) resolves locale from `NEXT_LOCALE` cookie then `Accept-Language`; sets `Vary: accept-language, cookie` on responses.
- Three `messages/*.json` files are line-aligned (379 lines each) and structurally identical.
- Navigation via `@/i18n/routing` and `LocaleLink`.

### API client
- `src/lib/api.ts` — `fetchJson()` with configurable retries (default 2), 8 s timeout, automatic `x-access-key` injection from `ETHNOS_API_KEY`.
- `src/lib/endpoints.ts` — high-level wrappers; `getPersonsWorks` uses `Promise.allSettled` for parallel fetch to eliminate sequential waterfalls.
- `loadWork()` and `getPersonsWorks()` wrapped with React `cache()` so `generateMetadata` and page render share a single request.

## Security Review

### What was checked
- API proxy (`src/app/api/[...path]/route.ts`) request flow and header handling.
- Secret exposure (`ETHNOS_API_KEY`, `ETHNOS_API_KEY_2`).
- Dangerous React patterns (`dangerouslySetInnerHTML`, `eval`, `innerHTML`, `document.write`).
- Input sanitization for abstracts and user-facing content.
- Env file templates and `.gitignore` coverage.

### Findings — OK
- **Secrets stay server-side.** `ETHNOS_API_KEY` is only read in `src/lib/api.ts` and the API proxy route, both server-only. The client talks to `/api/**`, never to the backend directly.
- **Proxy is GET-only.** Non-GET methods return the default 405, so no accidental write passthrough.
- **Per-IP rate limiting** on the proxy: 1200 req/min standard, 120 req/min for suspicious requests (missing/short UA or unknown IP). 15 s backend timeout with `AbortController` and a 502 fallback on backend failure.
- **No unsafe HTML injection.** All four `dangerouslySetInnerHTML` uses emit `JSON.stringify(jsonLd)` into `<script type="application/ld+json">`. No `eval`, `innerHTML`, or `document.write` in the source tree.
- **Abstract sanitization** strips HTML tags (`/<[^>]*>/g`) and noisy strings in `src/lib/works.ts` before rendering.
- **Env example** (`.env.example`, `config/env/next-frontend.env.example`) ships placeholder values only; real envs are not committed.
- **Upstream target is hardcoded** to `http://127.0.0.1:1211`, so the proxy cannot be redirected to an attacker-controlled host via env tampering.

### Findings — recommendations for a future hardening pass
These are **not release blockers** but worth filing:

1. **No security response headers.** `next.config.mjs` only sets `Cache-Control` for the stylesheet. Consider adding `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, and `Permissions-Policy` for a defense-in-depth pass.
2. **Rate limiting is in-memory.** `rateBuckets` is a `Map` local to the Node process; it resets on restart and does not coordinate across multiple workers. Acceptable for the current single-instance systemd service, but would need an external store (Redis / upstream reverse proxy) if the deployment ever scales horizontally.
3. **`x-forwarded-for` is trusted as-is.** The rate limiter reads the first value of `x-forwarded-for` as the client IP. Safe only because the app sits behind a trusted local reverse proxy that sets the header. Document the trust boundary.
4. **Proxy path normalization.** `parts.join('/')` trusts the router-split segments. `fetch()` will resolve `..` against the base URL, but since `API_BASE` has no path component, any traversal still targets `127.0.0.1:1211` — no escape. Worth revisiting if `API_BASE` ever gains a path prefix.

## Operations

- **Prod service:** `ethnos-app.service` (systemd user unit, linger enabled), port **1212**.
- **Dev:** `./bin/dev` or `npm run dev`, port **1210**.
- **Deploy:** `scripts/manage.sh deploy` (rebuilds, restarts via `systemctl --user restart ethnos-app`).
- **Logs:** `journalctl --user -u ethnos-app -f`.
- **CSS pipeline:** edit `public/css/styles.css`, run `scripts/manage.sh css` to regenerate `styles.min.css`.

### Env precedence
`ENV_FILE` → `/etc/next-frontend.env` → `config/env/next-frontend.env` → `.env.local` → `.env`

### Required env
- `ETHNOS_API_KEY` — injected as `x-access-key` on backend calls.
- `ETHNOS_API_KEY_2` — secondary key (reserved).

## Recent Notable Changes (since tagged baseline)

- `7b5fd39` batch commit
- `3cc1a30` update(xml): XML top entities
- `6ab03b8` docs(claude): add search domain rule to CLAUDE.md
- `eb84589` refactor(search): remove scope selector, unify results as works-only
- `22ed9f7` chore(deps): update package-lock.json after dependency resolution
- `82ff0b4` docs(claude): update CLAUDE.md with new shared modules and architecture notes
- `4444a4a` refactor(components): extract `GroupedIdentifiers`, fix unused props and lint
- `665680c` refactor(exports): extract shared citation utilities to `work-export.ts`
- `359fcb9` fix(api): reduce timeouts, add error handling, eliminate sequential waterfalls
- `0715a91` fix(search): remove `search-summary` and `search-stats` elements
- `3c4c591` feat(search): unify search form and support filter-only browsing
- `411541e` feat(search): add search summary, total count, and no-results state
- `74bf6f7` feat(search): add autocomplete and fix person name display

## Known Gotchas

- **Node 25+ breaks `next start`** with `Cannot find module './948.js'`. Stay on 24.x LTS and redeploy via `scripts/manage.sh deploy` after upgrades.
- **Messages files** must stay structurally identical across `en`, `pt`, `es` — add keys in all three.
- **CSS changes** require running `scripts/manage.sh css` to refresh the minified bundle served in production.
- **Export/citation logic** lives in `src/lib/work-export.ts` only — do not duplicate in page components.

## Verification Checklist

- [x] `npm run lint` — clean
- [x] `npm run build` — succeeds, 43 routes generated
- [x] CLAUDE.md reviewed and verified against current source (no updates needed)
- [x] API proxy secrets stay server-side
- [x] Message files aligned across locales
- [x] No unsafe HTML injection in React tree
- [x] Rate limiting and timeouts active on proxy
