import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import LocaleLink from '@/components/common/LocaleLink';
import SectionTabs, { type SectionTabDescriptor } from '@/components/common/SectionTabs';
import EntityTools from '@/components/common/EntityTools';
import SubjectLinks from '@/components/common/SubjectLinks';
import VenueWorksList from './VenueWorksList';
import { getVenue } from '@/lib/api';
import type { Venue } from '@/lib/api';
import { getVenueWorksPage, getVenueWorksByOffset } from '@/lib/endpoints';
import { buildIdentifierHref, getIdentifierSpec, identifierLabelKey, normalizeIdentifierKey } from '@/lib/identifiers';
import { formatNumber } from '@/lib/format';
import { buildPageMetadata, metadataBase, openGraphLocales } from '@/i18n/metadata';
import { localizedPath } from '@/i18n/paths';
import type { Locale } from '@/i18n/config';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const pickText = (values: Array<string | null | undefined>) => {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return '';
};

const formatSubjectList = (value: unknown) => {
  if (!value) return '';
  if (Array.isArray(value)) {
    const labels = value
      .map((entry) => {
        if (!entry) return '';
        if (typeof entry === 'string') return entry;
        if (typeof entry === 'object') {
          const obj = entry as { term?: string; display_name?: string; name?: string; label?: string; value?: string };
          return obj.term || obj.display_name || obj.name || obj.label || obj.value || '';
        }
        return '';
      })
      .map((entry) => entry.trim())
      .filter(Boolean);
    return labels.join(', ');
  }
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const obj = value as { term?: string; display_name?: string; name?: string; label?: string; value?: string };
    return obj.term || obj.display_name || obj.name || obj.label || obj.value || '';
  }
  return '';
};

const getVenueDescription = (venue?: Venue | null) => {
  if (!venue) return '';
  return pickText([
    venue.summary,
    venue.summary_snapshot?.summary,
    venue.summary_snapshot?.description,
    venue.summary_snapshot?.focus,
    venue.description
  ]);
};

const getVenueSubjectsText = (venue?: Venue | null) => {
  if (!venue) return '';
  return pickText([
    formatSubjectList(venue.summary_snapshot?.subjects),
    venue.summary_snapshot?.subjects_string,
    venue.subjects_string,
    formatSubjectList(venue.subjects)
  ]);
};

const toStringList = (raw: any) => {
  const list = Array.isArray(raw) ? raw : (raw || raw === 0 ? [raw] : []);
  return list.map((value: any) => {
    if (value && typeof value === 'object') {
      const picked = value?.id || value?.identifier || value?.value || value?.code;
      return picked ? String(picked).trim() : '';
    }
    return value === 0 ? '0' : (value ? String(value).trim() : '');
  }).filter((value: string) => value);
};

const uniqueList = (items: Array<string | null | undefined>) => Array.from(new Set(items.map((item) => (item ? String(item).trim() : '')).filter(Boolean)));

const pickAuthorName = (author: any) => {
  if (!author) return '';
  if (typeof author === 'string') return author.trim();
  return author?.preferred_name || author?.name || [author?.given_names, author?.family_name].filter(Boolean).join(' ');
};

const buildVenueMeta = (venue: Venue | null, locale: string, id: string, workTitles: string[]) => {
  if (!venue) return {};
  const name = venue?.name || '';
  const publisherName = venue?.publisher?.name || '';
  const issnValues = uniqueList([
    ...toStringList(venue?.issn),
    ...toStringList(venue?.eissn),
    ...toStringList((venue as any)?.issn_l || (venue as any)?.issnl)
  ]);
  const isbnValues = uniqueList([
    ...toStringList((venue as any)?.isbn13),
    ...toStringList((venue as any)?.identifiers?.isbn13)
  ]);
  const publicUrl = `https://ethnos.app${localizedPath(locale as Locale, `/venues/${id}`)}`;
  const subjectsText = getVenueSubjectsText(venue);
  const titles = uniqueList(workTitles);
  const identifiers = uniqueList([
    publicUrl,
    ...issnValues,
    ...isbnValues
  ]);
  const other: Record<string, string | string[]> = {};
  if (titles.length === 1) other.citation_title = titles[0];
  if (titles.length > 1) other.citation_title = titles;
  if (titles.length === 1) other['dc.relation'] = titles[0];
  if (titles.length > 1) other['dc.relation'] = titles;
  if (name) {
    other.citation_journal_title = name;
    other.citation_title = name;
  }
  if (publisherName) other.citation_publisher = publisherName;
  if (issnValues.length) other.citation_issn = issnValues;
  if (isbnValues.length) other.citation_isbn = isbnValues;
  if (venue?.language) other['dc.language'] = String(venue.language);
  if (publicUrl) other.citation_public_url = publicUrl;
  if (name) other['dc.title'] = name;
  if (publisherName) other['dc.publisher'] = publisherName;
  if (subjectsText) other['dc.subject'] = subjectsText;
  if (venue?.type) other['dc.type'] = String(venue.type);
  if (identifiers.length === 1) other['dc.identifier'] = identifiers[0];
  if (identifiers.length > 1) other['dc.identifier'] = identifiers;
  return other;
};

import { type IdentifierEntry } from '@/components/common/GroupedIdentifiers';

const addIdentifierValues = (
  target: IdentifierEntry[],
  label: string,
  raw?: any,
  hrefBuilder?: (value: string) => string | null
) => {
  const list = Array.isArray(raw) ? raw : (raw || raw === 0 ? [raw] : []);
  const values = list
    .map((value: any) => {
      if (value && typeof value === 'object') {
        const picked = value?.id || value?.identifier || value?.value;
        if (!picked) return null;
        const text = String(picked);
        const href = hrefBuilder ? hrefBuilder(text) : null;
        return href ? { text, href } : { text };
      }
      const text = String(value);
      const href = hrefBuilder ? hrefBuilder(text) : null;
      return href ? { text, href } : { text };
    })
    .filter(Boolean) as Array<{ text: string; href?: string }>;
  if (!values.length) return;
  const existing = target.find((entry) => entry.label === label);
  const targetValues = existing ? existing.values : [];
  values.forEach((entry) => {
    if (targetValues.some((item) => item.text === entry.text && item.href === entry.href)) return;
    targetValues.push(entry);
  });
  if (!existing) target.push({ label, values: targetValues });
};


export async function generateMetadata(props: { params: Promise<{ locale: string; id: string }> }) {
  const { id, locale } = await props.params;
  const base = await buildPageMetadata(Promise.resolve({ locale }), 'metadata.venuesDetail', `/venues/${id}`);
  let venue: Venue | null = null;
  try { venue = await getVenue(id); } catch {}
  if (!venue) return base;
  let worksPage: any = null;
  try { worksPage = await getVenueWorksPage(id, 1, 25); } catch {}
  const works: any[] = worksPage?.data || worksPage?.results || worksPage?.items || [];
  const workTitles = works.map((work) => (work?.title ? String(work.title) : '')).filter(Boolean);
  const workAuthors = works.flatMap((work) => (Array.isArray(work?.authors) ? work.authors : []).map(pickAuthorName)).filter(Boolean);
  const other = buildVenueMeta(venue, locale, id, workTitles);
  const name = venue?.name || base.title || '';
  const descriptionSource = getVenueDescription(venue) || base.description || '';
  const buildDescription = (text: string, limit = 170) => {
    const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    let acc = '';
    for (const sentence of sentences) {
      const candidate = acc ? `${acc} ${sentence}` : sentence;
      if (candidate.length <= limit) {
        acc = candidate;
      } else {
        break;
      }
    }
    if (!acc) acc = text.slice(0, limit).replace(/\s+\S*$/, '').trimEnd();
    if (acc && !/[.!?…]$/.test(acc)) acc = `${acc}.`;
    return acc;
  };
  const description = descriptionSource ? buildDescription(descriptionSource) : undefined;
  const canonicalPath = localizedPath(locale as Locale, `/venues/${id}`);
  const canonicalUrl = new URL(canonicalPath, metadataBase).toString();
  const ogLocale = openGraphLocales[locale as Locale] || openGraphLocales.en;
  const alternateLocale = ['en', 'pt', 'es'].filter((code) => code !== locale).map((code) => openGraphLocales[code as Locale]);
  const ogImage = {
    url: new URL('/og-default.png', metadataBase).toString(),
    width: 1200,
    height: 630,
    alt: 'Ethnos Bibliography catalog interface'
  };
  const keywords = Array.from(new Set([
    name || '',
    venue?.publisher?.name || '',
    getVenueSubjectsText(venue),
    ...(workTitles.slice(0, 3)),
    ...(workAuthors.slice(0, 3))
  ].map((k) => (k ? String(k) : '')).filter(Boolean)));
  return {
    ...base,
    title: name || base.title,
    description: description || base.description,
    keywords: keywords.length ? keywords : base.keywords,
    alternates: {
      canonical: canonicalUrl,
      languages: base.alternates?.languages
    },
    openGraph: {
      type: 'website',
      locale: ogLocale,
      alternateLocale,
      url: canonicalUrl,
      siteName: 'Ethnos Bibliography',
      title: name || base.title || '',
      description: description || base.description || '',
      images: [ogImage]
    },
    twitter: {
      card: 'summary_large_image',
      title: name || base.title || '',
      description: description || base.description || '',
      images: [ogImage.url]
    },
    other: { ...(base.other || {}), ...other }
  };
}

export default async function VenueDetailPage(props: { params: Promise<{ locale: string; id: string }>; searchParams?: Promise<{ page?: string }> }) {
  const { id, locale } = await props.params;
  let venue = await getVenue(id);
  if (!venue) notFound();
  const sp = (await props.searchParams) || {};
  const page = Number(sp.page || '1') || 1;
  const limit = 25;
  let worksPage: any = null;
  try { worksPage = await getVenueWorksPage(id, page, limit); } catch {}
  const works: any[] = worksPage?.data || worksPage?.results || worksPage?.items || [];
  const pagination: any = worksPage?.pagination || worksPage?.meta?.pagination || {};
  const total = Number(pagination?.total) || works.length;
  const oldestOffset = Math.max(0, total - limit);
  let oldestWorks: any[] = [];
  if (total > limit) {
    try {
      const oldestPage = await getVenueWorksByOffset(id, oldestOffset, limit);
      oldestWorks = oldestPage?.data || oldestPage?.results || oldestPage?.items || [];
    } catch {}
  } else {
    oldestWorks = works;
  }
  let prominentWorks: any[] = [];
  try {
    const prominentPage = await getVenueWorksPage(id, 1, limit, { sortBy: 'cited_by_count', sortOrder: 'desc', citedByMin: 1 });
    prominentWorks = prominentPage?.data || prominentPage?.results || prominentPage?.items || [];
  } catch {}
  const t = await getTranslations({ locale });

  const hasVenue = !!venue;
  const name = venue?.name ?? t('common.entities.journalNotFound');
  const descriptionText = getVenueDescription(venue);
  const subjectsText = getVenueSubjectsText(venue);
  const venueSubjectsRaw: any[] = Array.isArray((venue as any)?.subjects)
    ? (venue as any).subjects
    : (Array.isArray((venue as any)?.summary_snapshot?.subjects) ? (venue as any).summary_snapshot.subjects : []);
  const venueSubjectItems = (() => {
    const seen = new Set<string>();
    const out: Array<{ term: string }> = [];
    for (const s of venueSubjectsRaw) {
      if (!s || typeof s !== 'object') continue;
      const term = s.term || s.display_name || s.name || s.label || '';
      if (!term) continue;
      const key = String(term).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ term: String(term) });
    }
    return out;
  })();
  const issnValues = uniqueList([
    ...toStringList(venue?.issn),
    ...toStringList(venue?.eissn),
    ...toStringList((venue as any)?.issn_l || (venue as any)?.issnl)
  ]);
  const canonical = new URL(localizedPath(locale as Locale, `/venues/${id}`), metadataBase).toString();
  const venueIsbn13 = pickText([(venue as any)?.isbn13, (venue as any)?.identifiers?.isbn13]);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Periodical',
    name,
    alternateName: venue?.abbreviated_name && venue.abbreviated_name !== name ? venue.abbreviated_name : undefined,
    issn: issnValues.length ? issnValues : undefined,
    isbn: venueIsbn13 || undefined,
    publisher: venue?.publisher?.name ? { '@type': 'Organization', name: venue.publisher.name } : undefined,
    url: canonical,
    mainEntityOfPage: canonical,
    inLanguage: venue?.language || locale,
    description: descriptionText || undefined
  };

  const metrics = venue?.metrics || venue?.legacy_metrics || null;
  const metricValue = (key: string) => {
    const fromRoot = (venue as any)?.[key];
    if (fromRoot !== undefined && fromRoot !== null) return fromRoot;
    const fromBlock = metrics ? (metrics as any)[key] : null;
    return fromBlock === undefined ? null : fromBlock;
  };
  const sjr = metricValue('sjr');
  const snip = metricValue('snip');
  const citescore = metricValue('citescore');
  const impactFactor = metricValue('impact_factor');
  const sjrQuartile = metricValue('sjr_best_quartile');
  const hIndex = metricValue('h_index');
  const i10Index = metricValue('i10_index');
  const meanCitedness = metricValue('two_yr_mean_citedness');
  const overton = metricValue('overton');
  const femaleShare = metricValue('female_share');
  const accessLabels = [
    venue?.open_access ? t('common.meta.openAccess') : '',
    venue?.is_oa_diamond ? t('venues.detail.oaDiamond') : ''
  ].filter(Boolean);
  const indexingLabels = [
    venue?.is_in_doaj ? t('venues.detail.doaj') : '',
    venue?.is_in_scielo ? 'SciELO' : '',
    venue?.is_indexed_in_scopus ? t('venues.detail.indexedScopus') : ''
  ].filter(Boolean);
  const citedByCount = Number(venue?.cited_by_count);
  const publisherId = venue?.publisher?.id;
  const identifierEntries: IdentifierEntry[] = [];
  const venueIdentifiers = (venue as any)?.identifiers;
  let venueIssn = venue?.issn;
  let venueEissn = venue?.eissn;
  const venueIssnL = (venue as any)?.issn_l || (venue as any)?.issnl;
  let venueScopus = (venue as any)?.scopus_id || (venue as any)?.scopus;
  const venueWikidata = (venue as any)?.wikidata_id || (venue as any)?.wikidata;
  const venueOpenalex = (venue as any)?.openalex_id || (venue as any)?.openalex;
  const venueMag = (venue as any)?.mag_id || (venue as any)?.mag;
  const venueHomepage = pickText([(venue as any)?.homepage_url, (venue as any)?.homepage, (venue as any)?.url]);
  const vIdLabel = (rawKey: string, fallback?: string) => {
    const labelKey = identifierLabelKey(rawKey);
    return labelKey ? t(labelKey) : (fallback || rawKey.toUpperCase());
  };
  const buildScopusHref = (value: string) => buildIdentifierHref('scopus', value, 'venue') || '';
  addIdentifierValues(identifierEntries, vIdLabel('issnl'), venueIssnL);
  addIdentifierValues(identifierEntries, vIdLabel('wikidata'), venueWikidata, (value) => buildIdentifierHref('wikidata', value, 'venue'));
  addIdentifierValues(identifierEntries, vIdLabel('openalex'), venueOpenalex, (value) => buildIdentifierHref('openalex', value, 'venue'));
  addIdentifierValues(identifierEntries, vIdLabel('mag'), venueMag);
  if (venueIdentifiers && typeof venueIdentifiers === 'object') {
    Object.entries(venueIdentifiers as Record<string, any>).forEach(([rawKey, rawValue]) => {
      const normalized = normalizeIdentifierKey(String(rawKey || ''));
      if (normalized === 'issn' || normalized === 'eissn') {
        const first = Array.isArray(rawValue) ? rawValue.find((v) => v) : rawValue;
        if (normalized === 'issn' && first && !venueIssn) venueIssn = String(first);
        if (normalized === 'eissn' && first && !venueEissn) venueEissn = String(first);
        return;
      }
      if (normalized === 'scopus') {
        if (!venueScopus) {
          const first = Array.isArray(rawValue) ? rawValue.find((v) => v) : rawValue;
          if (first) venueScopus = String(first);
        }
        return;
      }
      if (!getIdentifierSpec(normalized)) return;
      addIdentifierValues(identifierEntries, vIdLabel(normalized), rawValue, (value) => buildIdentifierHref(normalized, value, 'venue'));
    });
  }
  const issnParts = [venueIssn, venueEissn && venueEissn !== venueIssn ? venueEissn : null].filter(Boolean).map((value) => String(value));
  const issnText = issnParts.join(' / ');

  return (
    <div className="page-header" aria-labelledby="page-title">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h1 className="page-title" id="page-title">{name}</h1>

      {hasVenue && (
        <section aria-labelledby="venue-info">
          <h2 className="title-section" id="venue-info">{t('venues.detail.data')}</h2>
          <table className="data-table item-detail-table" id="venue-details">
            <tbody>
              {venue?.type ? (
                <tr>
                  <th scope="row">{t('venues.detail.type')}</th>
                  <td className="field-value">{venue.type}</td>
                </tr>
              ) : null}
              {venue?.publisher?.name ? (
                <tr>
                  <th scope="row">{t('venues.detail.publisher')}</th>
                  <td className="field-value">
                    {publisherId ? (
                      <LocaleLink className="action-link table-link" href={`/institutions/${publisherId}`}>{venue.publisher.name}</LocaleLink>
                    ) : (
                      venue.publisher.name
                    )}
                    {venue.publisher.country_code ? ` (${venue.publisher.country_code})` : ''}
                  </td>
                </tr>
              ) : null}
              {issnText ? (
                <tr>
                  <th scope="row">{t('venues.detail.issn')}</th>
                  <td className="field-value">{issnText}</td>
                </tr>
              ) : null}
              {venueScopus ? (
                <tr>
                  <th scope="row">{vIdLabel('scopus')}</th>
                  <td className="field-value">
                    <a className="action-link table-link" href={buildScopusHref(String(venueScopus))} target="_blank" rel="noopener noreferrer">{venueScopus}</a>
                  </td>
                </tr>
              ) : null}
              {identifierEntries.map((entry, idx) => (
                <tr key={`venue-identifier-${entry.label}-${idx}`}>
                  <th scope="row">{entry.label}</th>
                  <td className="field-value">
                    {entry.values.map((value, vIdx) => (
                      <span key={`venue-identifier-${entry.label}-${value.text}-${vIdx}`}>
                        {value.href ? (
                          <a className="action-link table-link" href={value.href} target="_blank" rel="noopener noreferrer">{value.text}</a>
                        ) : (
                          <span>{value.text}</span>
                        )}
                        {vIdx < entry.values.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
              {venueHomepage ? (
                <tr>
                  <th scope="row">{t('venues.detail.website')}</th>
                  <td className="field-value">
                    <a className="action-link table-link" href={venueHomepage} target="_blank" rel="noopener noreferrer">{venueHomepage}</a>
                  </td>
                </tr>
              ) : null}
              <tr>
                <th scope="row">{t('venues.detail.total')}</th>
                <td className="field-value">{formatNumber(venue?.works_count || 0)}</td>
              </tr>
              {venue?.coverage_start_year && venue?.coverage_end_year ? (
                <tr>
                  <th scope="row">{t('venues.detail.coverage')}</th>
                  <td className="field-value">{venue.coverage_start_year} - {venue.coverage_end_year}</td>
                </tr>
              ) : null}
              {venue?.country_code ? (
                <tr>
                  <th scope="row">{t('venues.detail.country')}</th>
                  <td className="field-value">{venue.country_code}</td>
                </tr>
              ) : null}
              {venue?.language ? (
                <tr>
                  <th scope="row">{t('venues.detail.language')}</th>
                  <td className="field-value">{String(venue.language).toUpperCase()}</td>
                </tr>
              ) : null}
              {accessLabels.length ? (
                <tr>
                  <th scope="row">{t('venues.detail.access')}</th>
                  <td className="field-value">{accessLabels.join(' • ')}</td>
                </tr>
              ) : null}
              {indexingLabels.length ? (
                <tr>
                  <th scope="row">{t('venues.detail.indexing')}</th>
                  <td className="field-value">{indexingLabels.join(' • ')}</td>
                </tr>
              ) : null}
              {Number.isFinite(citedByCount) && citedByCount > 0 ? (
                <tr>
                  <th scope="row">{t('common.meta.citedBy')}</th>
                  <td className="field-value">{formatNumber(citedByCount)}</td>
                </tr>
              ) : null}
              {impactFactor ? (
                <tr>
                  <th scope="row">{t('venues.detail.impactFactor')}</th>
                  <td className="field-value">{String(impactFactor)}</td>
                </tr>
              ) : null}
              {sjr ? (
                <tr>
                  <th scope="row">{t('venues.detail.sjr')}</th>
                  <td className="field-value">{String(sjr)}{sjrQuartile ? ` (${sjrQuartile})` : ''}</td>
                </tr>
              ) : null}
              {!sjr && sjrQuartile ? (
                <tr>
                  <th scope="row">{t('venues.detail.sjrQuartile')}</th>
                  <td className="field-value">{String(sjrQuartile)}</td>
                </tr>
              ) : null}
              {snip ? (
                <tr>
                  <th scope="row">{t('venues.detail.snip')}</th>
                  <td className="field-value">{String(snip)}</td>
                </tr>
              ) : null}
              {citescore ? (
                <tr>
                  <th scope="row">{t('venues.detail.citescore')}</th>
                  <td className="field-value">{String(citescore)}</td>
                </tr>
              ) : null}
              {hIndex ? (
                <tr>
                  <th scope="row">{t('venues.detail.hIndexLabel')}</th>
                  <td className="field-value">{formatNumber(Number(hIndex))}</td>
                </tr>
              ) : null}
              {i10Index ? (
                <tr>
                  <th scope="row">{t('venues.detail.i10IndexLabel')}</th>
                  <td className="field-value">{formatNumber(Number(i10Index))}</td>
                </tr>
              ) : null}
              {meanCitedness ? (
                <tr>
                  <th scope="row">{t('venues.detail.meanCitedness')}</th>
                  <td className="field-value">{String(meanCitedness)}</td>
                </tr>
              ) : null}
              {overton ? (
                <tr>
                  <th scope="row">{t('venues.detail.overton')}</th>
                  <td className="field-value">{formatNumber(Number(overton))}</td>
                </tr>
              ) : null}
              {femaleShare ? (
                <tr>
                  <th scope="row">{t('venues.detail.femaleShare')}</th>
                  <td className="field-value">{`${Number(femaleShare).toFixed(1)}%`}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      )}

      {(() => {
        const listLabels = {
          titleUnavailable: t('common.entities.titleUnavailable'),
          authorUnknown: t('common.entities.authorUnknown'),
          openAccess: t('common.meta.openAccess'),
          addToList: t('common.actions.addToList'),
          inList: t('common.actions.inList'),
          removeFromList: t('common.actions.removeFromList'),
          added: t('common.messages.added'),
          itemRemoved: t('common.messages.itemRemoved'),
          citedBy: t('common.meta.citedBy'),
          references: t('common.meta.references'),
          emptyState: ''
        };
        const toYear = (v: any): number => {
          const n = Number(v);
          return Number.isFinite(n) ? n : 0;
        };
        const toTs = (v: any): number => {
          if (!v) return 0;
          const ts = Date.parse(String(v));
          return Number.isFinite(ts) ? ts : 0;
        };
        const byRecency = (a: any, b: any) => {
          const ya = toYear(a?.publication_year || a?.publication?.year || a?.year);
          const yb = toYear(b?.publication_year || b?.publication?.year || b?.year);
          if (yb !== ya) return yb - ya;
          return toTs(b?.publication_date) - toTs(a?.publication_date);
        };
        const byOldest = (a: any, b: any) => {
          const ya = toYear(a?.publication_year || a?.publication?.year || a?.year) || Number.POSITIVE_INFINITY;
          const yb = toYear(b?.publication_year || b?.publication?.year || b?.year) || Number.POSITIVE_INFINITY;
          if (ya !== yb) return ya - yb;
          return toTs(a?.publication_date) - toTs(b?.publication_date);
        };
        const recentItems = [...works].sort(byRecency);
        const firstItems = [...oldestWorks].sort(byOldest);
        const prominentItems = prominentWorks;

        const pageHref = (target: number) => `/venues/${id}${target > 1 ? `?page=${target}` : ''}`;
        const paginationNav = (
          <nav className="pagination-nav" aria-label={t('common.labels.pagination')}>
            {pagination?.hasPrev || page > 1 ? (
              <LocaleLink className="pagination-btn btn-negative" href={pageHref(Math.max(1, page - 1))}>{t('common.actions.previous')}</LocaleLink>
            ) : (
              <button type="button" className="pagination-btn btn-negative" disabled>{t('common.actions.previous')}</button>
            )}
            {pagination?.hasNext ? (
              <LocaleLink className="pagination-btn btn-positive" href={pageHref(page + 1)}>{t('common.actions.next')}</LocaleLink>
            ) : (
              <button type="button" className="pagination-btn btn-positive" disabled>{t('common.actions.next')}</button>
            )}
          </nav>
        );

        const summaryPanel = (descriptionText || venueSubjectItems.length > 0 || subjectsText) ? (
          <>
            {descriptionText ? <p className="description">{descriptionText}</p> : null}
            {venueSubjectItems.length > 0
              ? <SubjectLinks subjects={venueSubjectItems} filters={{ venue: name }} />
              : (subjectsText ? <p className="description subject-list">{subjectsText}</p> : null)}
          </>
        ) : null;

        const tabs: SectionTabDescriptor[] = [
          summaryPanel ? {
            key: 'summary',
            label: t('venues.sections.summary'),
            content: summaryPanel
          } : null,
          {
            key: 'recent',
            label: t('venues.sections.recent'),
            content: (
              <>
                <VenueWorksList items={recentItems} labels={{ ...listLabels, emptyState: t('venues.empty.recent') }} />
                {paginationNav}
              </>
            )
          },
          {
            key: 'prominent',
            label: t('venues.sections.prominent'),
            content: <VenueWorksList items={prominentItems} labels={{ ...listLabels, emptyState: t('venues.empty.prominent') }} />
          },
          {
            key: 'first',
            label: t('venues.sections.first'),
            content: (
              <VenueWorksList items={firstItems} labels={{ ...listLabels, emptyState: t('venues.empty.first') }} />
            )
          },
          {
            key: 'tools',
            label: t('venues.sections.tools'),
            content: <EntityTools kind="venue" entity={venue} worksCount={Number((venue as any)?.works_count) || 0} entityExportLabel={t('venues.tools.exportVenue')} />
          }
        ].filter(Boolean) as SectionTabDescriptor[];

        return <SectionTabs ariaLabel={t('venues.sections.navLabel')} tabs={tabs} />;
      })()}
    </div>
  );
}
