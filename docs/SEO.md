# SEO and indexability contract

This document is the reference for everything that makes Ethnos crawlable, indexable and
correctly represented in search engines, social cards and app installers. Every rule below is
enforced by `scripts/seo/audit.mjs`, which is the acceptance test for this contract.

## Quick reference

| Surface | Path | Source |
|---------|------|--------|
| Robots | `/robots.txt` | `public/robots.txt` (static) |
| Sitemap index | `/sitemap.xml` | `src/app/sitemap.xml/route.ts` |
| Sitemap sections | `/sitemaps/{pages,recent,works,venues,persons}.xml` | `src/app/sitemaps/[section]/route.ts` |
| Web manifest (default locale) | `/site.webmanifest` | `src/app/site.webmanifest/route.ts` |
| Web manifest (pt, es) | `/{locale}/site.webmanifest` | `src/app/(site)/[locale]/site.webmanifest/route.ts` |
| IndexNow key | `/1358c048396643579a50845cc52a92bf.txt` | `public/` |
| Audit | `scripts/manage.sh seo audit` | `scripts/seo/audit.mjs` |
| IndexNow submit | `scripts/manage.sh seo indexnow` / `seo indexnow:new` | `scripts/seo/indexnow.mjs` |
| IndexNow schedule (production) | `ethnos-indexnow.timer`, hourly | `scripts/systemd/ethnos-indexnow.{service,timer}` |

All four crawler surfaces bypass the locale middleware through `shouldBypassIntl` in
`src/proxy.ts`; adding a new crawler-facing path means adding it there too.

## Origin and URL construction

`src/lib/site.ts` is the single source of truth for the public origin, the site name, the
publisher, the social image and the theme colors. Nothing else may hardcode `https://ethnos.app`.

- `absoluteUrl(path)` — origin + path.
- `localeUrl(locale, path)` — origin + locale-prefixed path, the canonical form of every page URL.
- `alternateUrls(path)` — the `{en, pt, es, x-default}` hreflang map for a path.
- `withQuery(path, query)` / `paginatedPath(path, page)` / `resolvePageParam(value)` — canonical
  URLs for paginated detail pages.

`src/i18n/metadata.ts` re-exports `metadataBase` from the same constant, so `metadataBase`,
`SITE_ORIGIN` and the sitemap all agree by construction.

## Metadata contract

`buildPageMetadata(params, key, path, options)` is the only way a page produces metadata. It
emits, for every page:

- a localized `title` (branded through the layout template `%s | Ethnos Bibliography`), `description`
  and `keywords` read from `messages/{locale}.json` under `metadata.<key>`;
- a self-referential `canonical`, including `?page=N` when `options.query` carries it;
- the complete `en` / `pt` / `es` / `x-default` hreflang set for the same path (query included);
- `robots` — `INDEXABLE_ROBOTS` by default (`index, follow` plus `max-image-preview:large`,
  `max-snippet:-1`, `max-video-preview:-1` for Googlebot), or `NON_INDEXABLE_ROBOTS` when passed;
- `icons`, the locale-specific `manifest`, and optional search-console `verification`;
- Open Graph (`type`, `locale`, `alternateLocale`, `url`, `title`, `description`, `siteName`,
  1200×630 image) and a `summary_large_image` Twitter card.

`options.absoluteTitle` bypasses the title template — used only by the home page, whose title is
already the full brand string.

### Length limits

Bing Webmaster Tools reports a `<title>` over **70** characters as "Title too long" and descriptions
under roughly **120** characters as "too short"; Google truncates past ~160. Every page therefore
emits a title of at most 70 characters and a description of 120–160, enforced by
`src/lib/meta-text.ts` and checked as errors by the audit.

- **Titles.** `fitTitle(template, candidates, truncate?)` — reached through `buildPageMetadata` and
  `fitPageTitle(locale, …)` — takes the candidates in order and keeps the `| Ethnos Bibliography`
  suffix only while the branded title fits; otherwise it emits `{ absolute }` without the brand, and
  only when no candidate fits does it cut on a word boundary with `…`. A work offers
  `title: subtitle (year)`, `title: subtitle`, `title (year)`, `title`, and keeps `(year)` as the tail
  of a truncated title. `citation_title` and `dc.title` always carry the full title; only `<title>` is
  fitted.
- **Descriptions.** `composeDescription(lead, extras, { fill, suffix })` cuts the lead at a sentence
  boundary (or a word boundary with `…` — never an invented full stop), then appends the localized
  extras from `metadata.descriptors.*` until the text reaches 120 characters (`fill: 'min'`) or as much
  as fits in 160 (`fill: 'max'`, used for persons so affiliation, work count and ORCID all make it),
  always reserving room for `pageSuffix` on `?page=N`. Leads and extras per page type:

  | Page | Lead | Extras, in order |
  |------|------|------------------|
  | work | abstract, else the full title | `Authors (year)`, venue (skipped when it repeats the title), `workRecord` → `workRecordMedium` → `workRecordShort` |
  | venue | editorial `summary`, else `venueProfile` | `venuePublisher`, `worksIndexed`, `entityRecord` → `entityRecordShort` |
  | person | `personProfile` | `personAffiliations`, `worksIndexed`, `personOrcid`, `personRecord` → `personRecordShort` |
  | institution / subject | `institutionDetail` / `subjectDetail` | `worksIndexed`, `entityRecord` → `entityRecordShort` |
  | documentation chapter | the chapter `summary` | `docs.chapterContext` |
  | everything else | `metadata.<key>.description`, written to 120–160 in each locale | — |

**Titles carry no brand suffix in `messages/*.json`.** The layout template appends
`| Ethnos Bibliography`; a message title that also spelled out the brand would double it.

### Localized site metadata

`metadata.site.{title,titleTemplate,description,abstract,keywords}` in each message file drives the
root layout. There is no English fallback baked into `layout.tsx`: `/pt` and `/es` get their own
title template, description, abstract and keyword set.

### Indexable vs non-indexable

| Page | Robots |
|------|--------|
| `/`, `/search`, `/venues`, `/privacy`, `/license`, the published `/docs` tree, and every entity detail page | index, follow |
| `/search/results`, `/search/global` | noindex, follow — internal search results |
| `/lists` | noindex, follow — client-only personal reading list |
| `/maintenance` | noindex, follow — also served with HTTP 503 while maintenance is on |
| `/doi/*` | noindex, follow — a resolver that redirects to `/works/{id}` |

Non-indexable pages stay crawlable (never `Disallow`), because a crawler must fetch the page to
see the `noindex`.

### Article-level metadata is works-only

Highwire `citation_*` tags describe a **document**. They are emitted exclusively by
`/works/{id}` (`buildCitationMeta` in `work-detail.ts`) plus the COinS `Z3988` span. Person, venue,
institution and subject pages describe entities, not documents, and carry Dublin Core (`dc.title`,
`dc.creator`, `dc.publisher`, `dc.subject`, `dc.type`, `dc.identifier`, `dc.language`, `dc.relation`)
only. Adding `citation_title` to a non-work page tells Google Scholar the page is an article and is
a conformance bug.

## Structured data

`src/lib/structured-data.ts` builds every JSON-LD node and `src/components/common/JsonLd.tsx` is
the only component allowed to render one. The component prunes empty values and escapes `<`, `>`,
`&` and the U+2028/U+2029 separators, so an entity title containing `</script>` cannot break the
page — never hand-roll `dangerouslySetInnerHTML={{ __html: JSON.stringify(...) }}` again.

- Every page: an `@graph` with `Organization` (`#organization`) and `WebSite` (`#website`, carrying
  the `SearchAction` pointing at `/search/results?q=`).
- `/works/{id}`: `ScholarlyArticle` or `Book`, with authors/editors/translators/contributors split by
  role, `isPartOf` the `WebSite`, DOI as a `PropertyValue` plus `sameAs`, subjects as `keywords`,
  `isAccessibleForFree` from open access, and `license` when the publication carries one.
- `/venues/{id}`: `Periodical`. `/persons/{id}`: `Person`. `/institutions/{id}`: `Organization`.
  `/subjects/{id}`: `DefinedTerm`.
- `/docs/{collection}`: `CollectionPage` wrapping an `ItemList` of its chapters.
  `/docs/{collection}/{slug}`: `TechArticle` carrying `inLanguage: en` — the document body is the
  English source and only the page chrome is localized, so the node must not claim the page locale.
- Every detail page also emits a `BreadcrumbList`. A breadcrumb level is only added when a real
  listing page exists — venues get `Home › Journals › name`, everything else gets `Home › name`,
  because works, persons, institutions and subjects have no catalog route.

## Sitemaps

`/sitemap.xml` is a **sitemap index** over five sections. Each section lists one `<url>` per locale
per resource, and every entry carries the full `xhtml:link` alternate set including itself and
`x-default` — the bidirectional form Google requires.

| Section | Contents | Source | `<lastmod>` |
|---------|----------|--------|-------------|
| `pages` | `/`, `/search`, `/venues`, the published documentation tree, `/privacy`, `/license` | `STATIC_PAGES` + `listDocPages()` in `src/lib/sitemap.ts` | documentation pages only: git commit date of the source |
| `recent` | every work added in the last 30 days, newest first, up to 16,666 works | `listRecentlyAddedWorks` → `/works?sort_by=id&sort_order=DESC` | the work's `added_to_database` |
| `works` | curated most-cited works | `public/xml-list/top_works.xml` | none |
| `venues` | curated best-scored venues | `public/xml-list/top_venues.xml` | none |
| `persons` | curated highest-h-index persons | `public/xml-list/top_persons.xml` | none |

- **Why `recent` exists.** The curated lists are regenerated by hand and do not change between
  regenerations, while the corpus grows by thousands of works a day in bursts. Bing Webmaster Tools
  reported "important new pages are missing from your sitemaps": the home page links to the newest
  works and nothing in the sitemaps did. `recent` follows the corpus by itself.
- **Refresh.** Both routes are `force-static` with `revalidate = 3600`: generated at build, then
  regenerated in the background at most hourly, so `recent` needs no deploy. A failed refresh reuses
  the last good in-memory copy or throws, and ISR keeps serving the previous file; only a build
  that runs while the API is down emits an empty `recent`, which the first revalidation fills.
- **`lastmod` is emitted only when it is true.** A curated list knows when the *list* changed, not
  when a page did, so its URLs carry no `lastmod`; a file mtime is the checkout time, and using it
  re-dated all 6,000 curated URLs on every clone or pull, which teaches crawlers to ignore `lastmod`
  site-wide. Static pages carry none either. The index `<lastmod>` of a section is its newest entry, or
  the git commit date of its curated list. Dates come from `git log -1 --format=%cI` with an mtime
  fallback and are never "now".
- **Curated lists rot.** They are ids only, generated outside this repository (the data project's
  `xml_list` script: works by citations, venues by score, persons by h-index). Merged or deleted
  records keep their id in the file and answer 404 — six top works did until 2026-09-28. After
  regenerating a list, run the audit: its `sitemap targets` group requests a sample of every section.
- **Documentation is listed only while it has content.** `listDocPages()` skips chapters whose source
  file is empty (they answer 404), so the sitemap never advertises a blank page, and the section being
  unlinked from the chrome means the sitemap is its only discovery path while it is published.
- The curated lists use a bespoke `<item>works/123</item>` format. `normalizeTopItem` tolerates a
  leading origin, a plural or singular prefix, and rejects ids that are not URL-safe.
- Each section is capped at `50000 / locales.length` resources so no file can exceed the 50,000 URL
  limit once tripled across locales; the cap and the "below expectation" floors log to the build.
  `recent` fills its file (~28 MB uncompressed, well under the 50 MB limit; served compressed).
- **Noindex pages are never listed.** `/lists` and `/search/global` were removed from the sitemap
  when they became `noindex`.

## Web manifest

The manifest is generated per locale from `messages/{locale}.manifest.*`, so an installed PWA in
Portuguese shows Portuguese naming and shortcuts. All three share one `id` (`/?source=pwa`), so
browsers treat them as the same application.

Declared: `id`, `name`, `short_name`, `description`, `lang`, `dir`, `start_url` (locale-prefixed),
`scope`, `categories`, `display`, `display_override`, `orientation`, `theme_color`,
`background_color`, icons at 16/32/180/192/512 with separate `any` and `maskable` entries,
screenshots with their **real** pixel dimensions, and three functional shortcuts (search, journals,
list) pointing at locale-prefixed paths.

The layout links the manifest through `metadata.manifest`, not a hand-written `<link>`.

## Robots

`public/robots.txt` is static and hand-maintained. It:

- carries the Cloudflare content-signals preamble **and the matching `Content-Signal:` directives**
  (`search=yes, ai-input=no, ai-train=no` for `*`) — the preamble without the directives, which is
  what the file used to ship, grants and restricts nothing;
- allows everything for the wildcard group;
- blocks generative-AI crawlers in one grouped stanza. `Applebot-Extended` is blocked, **not**
  `Applebot`: `Applebot` is Apple's search crawler and blocking it removes the site from Siri,
  Spotlight and Safari suggestions;
- points at `https://ethnos.app/sitemap.xml`.

There are no per-locale robots files. `robots.txt` is only valid at the origin root.

## HTTP status contract

- Missing or malformed entity ids return **404**. The backend answers a malformed id with
  `400 VALIDATION_ERROR`; `isMissingEntityError` in `src/lib/api.ts` folds that into "absent" so the
  page calls `notFound()` instead of surfacing a 500. A 5xx on a bad id makes Search Console report
  server errors and throttles crawl rate.
- Legacy routes under `(redirects)` answer **308 Permanent Redirect** via `permanentRedirect` from
  `@/i18n/routing`, so link equity transfers.
- `/doi/{doi}` keeps a temporary redirect: the DOI-to-work mapping is data, not a URL rename.
- Maintenance mode returns 503 with `Retry-After`, which Google treats as temporary.

## Response headers

`next.config.mjs` sets `X-Content-Type-Options: nosniff`, `Referrer-Policy:
strict-origin-when-cross-origin` and `X-DNS-Prefetch-Control: on` for every path, plus the
crawler cache policy for `robots.txt`, `sitemap.xml` and `/sitemaps/*`.

## Search-console verification

`buildPageMetadata` reads `SEO_GOOGLE_SITE_VERIFICATION`, `SEO_BING_SITE_VERIFICATION` and
`SEO_YANDEX_SITE_VERIFICATION` from the environment and emits the corresponding verification meta
tags when present. Provision them in `/etc/next-frontend.env` like any other secret — never in the
worktree.

## IndexNow

The key lives at `public/<key>.txt` and its content must equal its filename; the audit checks both.

```bash
scripts/manage.sh seo indexnow:new                   # new or re-dated sitemap URLs only (what the timer runs)
scripts/manage.sh seo indexnow:new --dry-run         # list what would be sent
scripts/manage.sh seo indexnow                       # submit the static pages
scripts/manage.sh seo indexnow --urls changed.txt    # submit an explicit list
scripts/manage.sh seo indexnow --section all --dry-run
```

IndexNow is a *change* notification protocol — resubmitting the whole corpus is abuse; submit what
actually changed. `--new` does exactly that: it compares the sitemap entries with
`.cache/indexnow/state.json` (gitignored) and sends only URLs never submitted or whose `lastmod`
changed. The state is written after every accepted batch (10,000 URLs), an HTTP `429` ends the run
with the remainder still pending, and entries that a fetched section no longer lists are pruned (an
empty section is never pruned). `--source http://127.0.0.1:1212` reads the sitemaps from local nginx
while the submitted URLs stay on `https://ethnos.app`.

On production the hourly `ethnos-indexnow.timer` runs `--section all --new --limit 10000`. It is
installed by `scripts/manage.sh systemd:install` (and so by every `deploy`) only when
`INDEXNOW_AUTOSUBMIT=1` is set in `/etc/next-frontend.env` — set it on the production host only.
Bing reported "recently published pages were not submitted via IndexNow" before this existed.

Google retired sitemap ping in 2023 and does not consume IndexNow, so there is no Google step: the
sitemap is discovered through `robots.txt` and Search Console.

## Auditing

```bash
scripts/manage.sh seo audit                     # against the public nginx port (1212)
scripts/manage.sh seo audit --sample 5          # more entity samples per type
scripts/manage.sh seo audit --probe 25          # more sitemap URLs requested per section (0 to skip)
SEO_BASE=http://127.0.0.1:1210 scripts/manage.sh seo audit
node scripts/seo/audit.mjs --base <url> --skip-entities
```

The audit fails the build on any conformance error and reports advisories separately. A title over
70 characters and a description outside 120–160 are errors — `meta-text.ts` makes both impossible,
so a failure means a page bypassed it.

It verifies robots directives and sitemap reachability, sitemap XML validity, URL and byte limits,
`<lastmod>` values that parse and are never in the future (and are present on every `recent` URL), a
sample of every section's URLs answering 200, hreflang completeness and reciprocity, manifest validity and asset reachability for all three
locales, and — per sampled page — a single non-empty title, a single description, a single
self-referential canonical, the full hreflang set, `<html lang>`, the robots directive matching the
page's expected indexability, the Open Graph and Twitter set with a reachable image, the locale
manifest link, parseable JSON-LD of the expected types, 404s for unknown entities, and 308s for
legacy routes.

The documentation tree is audited from the `pages` sitemap: when it lists `/docs`, the hub is audited
in all three locales plus the first collection index (`CollectionPage`) and chapter (`TechArticle`)
it lists; when it lists none, the audit requires `/docs` to answer 404.
