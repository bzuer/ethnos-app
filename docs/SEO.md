# SEO and indexability contract

This document is the reference for everything that makes Ethnos crawlable, indexable and
correctly represented in search engines, social cards and app installers. Every rule below is
enforced by `scripts/seo/audit.mjs`, which is the acceptance test for this contract.

## Quick reference

| Surface | Path | Source |
|---------|------|--------|
| Robots | `/robots.txt` | `public/robots.txt` (static) |
| Sitemap index | `/sitemap.xml` | `src/app/sitemap.xml/route.ts` |
| Sitemap sections | `/sitemaps/{pages,works,venues,persons}.xml` | `src/app/sitemaps/[section]/route.ts` |
| Web manifest (default locale) | `/site.webmanifest` | `src/app/site.webmanifest/route.ts` |
| Web manifest (pt, es) | `/{locale}/site.webmanifest` | `src/app/(site)/[locale]/site.webmanifest/route.ts` |
| IndexNow key | `/1358c048396643579a50845cc52a92bf.txt` | `public/` |
| Audit | `scripts/manage.sh seo audit` | `scripts/seo/audit.mjs` |
| IndexNow submit | `scripts/manage.sh seo indexnow` | `scripts/seo/indexnow.mjs` |

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

**Titles carry no brand suffix in `messages/*.json`.** The layout template appends
`| Ethnos Bibliography`; a message title that also spelled out the brand would double it.

### Localized site metadata

`metadata.site.{title,titleTemplate,description,abstract,keywords}` in each message file drives the
root layout. There is no English fallback baked into `layout.tsx`: `/pt` and `/es` get their own
title template, description, abstract and keyword set.

### Indexable vs non-indexable

| Page | Robots |
|------|--------|
| `/`, `/search`, `/venues`, `/privacy`, `/license`, and every entity detail page | index, follow |
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
- Every detail page also emits a `BreadcrumbList`. A breadcrumb level is only added when a real
  listing page exists — venues get `Home › Journals › name`, everything else gets `Home › name`,
  because works, persons, institutions and subjects have no catalog route.

## Sitemaps

`/sitemap.xml` is a **sitemap index** over four sections. Each section lists one `<url>` per locale
per resource, and every entry carries the full `xhtml:link` alternate set including itself and
`x-default` — the bidirectional form Google requires.

| Section | Contents | Source | changefreq / priority |
|---------|----------|--------|-----------------------|
| `pages` | `/`, `/search`, `/venues`, `/privacy`, `/license` | `STATIC_PAGES` in `src/lib/sitemap.ts` | daily–yearly / 1.0–0.2 |
| `works` | curated work ids | `public/xml-list/top_works.xml` | monthly / 0.6 |
| `venues` | curated venue ids | `public/xml-list/top_venues.xml` | weekly / 0.7 |
| `persons` | curated person ids | `public/xml-list/top_persons.xml` | monthly / 0.5 |

- `lastmod` is honest: the mtime of `package.json` for static pages, the mtime of the curated XML
  list for entities. It is never "now".
- Sections are `force-static`, generated at build time from files in the repository, and served
  with `Cache-Control: public, max-age=3600, s-maxage=86400`.
- The curated lists use a bespoke `<item>works/123</item>` format. `normalizeTopItem` tolerates a
  leading origin, a plural or singular prefix, and rejects ids that are not URL-safe.
- Each section is capped at `50000 / locales.length` entries so no file can exceed the 50 000 URL
  limit once tripled across locales; the cap and the "below expectation" floors log to the build.
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
scripts/manage.sh seo indexnow                       # submit the static pages
scripts/manage.sh seo indexnow --section all         # submit every sitemapped URL
scripts/manage.sh seo indexnow --urls changed.txt    # submit an explicit list
scripts/manage.sh seo indexnow --dry-run             # resolve and print, submit nothing
```

Submissions batch at 10 000 URLs. IndexNow is a *change* notification protocol — resubmitting the
whole corpus on every deploy is abuse; submit what actually changed.

Google retired sitemap ping in 2023, so there is no Google ping step: the sitemap is discovered
through `robots.txt` and Search Console.

## Auditing

```bash
scripts/manage.sh seo audit                     # against the public nginx port (1212)
scripts/manage.sh seo audit --sample 5          # more entity samples per type
SEO_BASE=http://127.0.0.1:1210 scripts/manage.sh seo audit
node scripts/seo/audit.mjs --base <url> --skip-entities
```

The audit fails the build on any conformance error and reports advisories separately. Long
bibliographic titles exceeding 70 characters are advisory, not errors: scholarly titles are
legitimately long and Google truncates rather than penalizes.

It verifies robots directives and sitemap reachability, sitemap XML validity, URL and byte limits,
hreflang completeness and reciprocity, manifest validity and asset reachability for all three
locales, and — per sampled page — a single non-empty title, a single description, a single
self-referential canonical, the full hreflang set, `<html lang>`, the robots directive matching the
page's expected indexability, the Open Graph and Twitter set with a reachable image, the locale
manifest link, parseable JSON-LD of the expected types, 404s for unknown entities, and 308s for
legacy routes.
