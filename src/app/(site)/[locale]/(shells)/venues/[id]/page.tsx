import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import LocaleLink from '@/components/common/LocaleLink';
import SectionTabs, { type SectionTabDescriptor } from '@/components/common/SectionTabs';
import EntityTools from '@/components/common/EntityTools';
import { exportFilename } from '@/lib/entity-export';
import SubjectLinks from '@/components/common/SubjectLinks';
import VenueWorksList from './VenueWorksList';
import { getVenue, getVenueWorksPage, type WorksListOptions } from '@/lib/endpoints';
import { venueSubjectTerms } from '@/lib/venues';
import { buildIdentifierHref, getIdentifierSpec, identifierLabelKey, normalizeIdentifierKey } from '@/lib/identifiers';
import { formatNumber } from '@/lib/format';
import { formatContributorName } from '@/lib/works';
import JsonLd from '@/components/common/JsonLd';
import { alternateOpenGraphLocales, buildPageMetadata, fitPageTitle, openGraphLocales, siteOpenGraphImage } from '@/i18n/metadata';
import { composeDescription } from '@/lib/meta-text';
import { SITE_NAME, localeUrl, paginatedPath, resolvePageParam } from '@/lib/site';
import { buildBreadcrumbList, withSitePublisher } from '@/lib/structured-data';
import type { Locale } from '@/i18n/config';

export const dynamic = 'force-dynamic';

const LIMIT = 25;
const RECENT: WorksListOptions = { sortBy: 'publication_year', sortOrder: 'desc' };
const PROMINENT: WorksListOptions = { sortBy: 'cited_by_count', sortOrder: 'desc', citedByMin: 1 };
const FIRST: WorksListOptions = { sortBy: 'publication_year', sortOrder: 'asc' };
const SEPARATELY_SHOWN = new Set(['issn', 'eissn', 'scopus']);

const uniqueList = (items: Array<string | null | undefined>) => Array.from(new Set(items.map((item) => (item ? String(item).trim() : '')).filter(Boolean)));

const issnList = (venue: any) => uniqueList([venue?.issn, venue?.eissn]);

const loadWorks = async (id: string, page: number, opts: WorksListOptions): Promise<any[]> => {
  try {
    const envelope = await getVenueWorksPage(id, page, LIMIT, opts);
    return Array.isArray(envelope?.data) ? envelope.data : [];
  } catch {
    return [];
  }
};

const buildVenueMeta = (venue: any, locale: string, id: string, workTitles: string[]) => {
  const titles = uniqueList(workTitles);
  const identifiers = uniqueList([localeUrl(locale as Locale, `/venues/${id}`), ...issnList(venue), venue?.isbn13]);
  const subjects = venueSubjectTerms(venue).join(', ');
  const other: Record<string, string | string[]> = {};
  if (titles.length) other['dc.relation'] = titles.length === 1 ? titles[0] : titles;
  if (venue?.language) other['dc.language'] = String(venue.language);
  if (venue?.name) other['dc.title'] = String(venue.name);
  if (venue?.publisher?.name) other['dc.publisher'] = String(venue.publisher.name);
  if (subjects) other['dc.subject'] = subjects;
  if (venue?.type) other['dc.type'] = String(venue.type);
  other['dc.identifier'] = identifiers.length === 1 ? identifiers[0] : identifiers;
  return other;
};

export async function generateMetadata(props: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { id, locale } = await props.params;
  const page = resolvePageParam((await props.searchParams).page);
  const base = await buildPageMetadata(Promise.resolve({ locale }), 'metadata.venuesDetail', `/venues/${id}`, {
    query: page > 1 ? { page } : undefined
  });
  let venue: any = null;
  try { venue = await getVenue(id); } catch {}
  if (!venue) return base;
  const works = await loadWorks(id, page, RECENT);
  const workTitles = works.map((work) => (work?.title ? String(work.title) : '')).filter(Boolean);
  const workAuthors = works.flatMap((work) => (Array.isArray(work?.authors) ? work.authors : []).map(formatContributorName)).filter(Boolean);
  const name = venue.name ? String(venue.name) : '';
  const descriptors = await getTranslations({ locale, namespace: 'metadata.descriptors' });
  const publisherName = venue.publisher?.name ? String(venue.publisher.name) : '';
  const worksCount = Number(venue.works_count) || 0;
  const description = composeDescription(venue.summary || (name ? descriptors('venueProfile', { name }) : base.description), [
    publisherName ? descriptors('venuePublisher', { publisher: publisherName }) : '',
    worksCount > 0 ? descriptors('worksIndexed', { count: worksCount }) : '',
    descriptors('entityRecord'),
    descriptors('entityRecordShort')
  ], { suffix: page > 1 ? descriptors('pageSuffix', { page }) : '' });
  const pageTitle = await fitPageTitle(locale, [name]);
  const safeLocale = locale as Locale;
  const ogImage = siteOpenGraphImage();
  const keywords = uniqueList([name, publisherName, venueSubjectTerms(venue).join(', '), ...workTitles.slice(0, 3), ...workAuthors.slice(0, 3)]);
  return {
    ...base,
    title: pageTitle || base.title,
    description: description || base.description,
    keywords: keywords.length ? keywords : base.keywords,
    openGraph: {
      type: 'website',
      locale: openGraphLocales[safeLocale],
      alternateLocale: alternateOpenGraphLocales(safeLocale),
      url: localeUrl(safeLocale, paginatedPath(`/venues/${id}`, page)),
      siteName: SITE_NAME,
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
    other: { ...(base.other || {}), ...buildVenueMeta(venue, locale, id, workTitles) }
  };
}

export default async function VenueDetailPage(props: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ page?: string }> }) {
  const { id, locale } = await props.params;
  const venue = await getVenue(id);
  if (!venue) notFound();
  const page = resolvePageParam((await props.searchParams).page);
  const [recentEnvelope, prominentItems, firstItems] = await Promise.all([
    getVenueWorksPage(id, page, LIMIT, RECENT).catch(() => null),
    loadWorks(id, 1, PROMINENT),
    loadWorks(id, 1, FIRST)
  ]);
  const recentItems: any[] = Array.isArray(recentEnvelope?.data) ? recentEnvelope.data : [];
  const hasNext = recentEnvelope?.pagination?.hasNext === true;
  const t = await getTranslations({ locale });

  const name = venue.name || t('common.entities.journalNotFound');
  const descriptionText = venue.summary ? String(venue.summary) : '';
  const subjectItems = venueSubjectTerms(venue).map((term) => ({ term }));
  const issnValues = issnList(venue);
  const canonical = localeUrl(locale as Locale, `/venues/${id}`);
  const jsonLd = withSitePublisher({
    '@context': 'https://schema.org',
    '@type': 'Periodical',
    '@id': `${canonical}#periodical`,
    name,
    alternateName: venue.abbreviated_name && venue.abbreviated_name !== name ? venue.abbreviated_name : undefined,
    issn: issnValues.length ? issnValues : undefined,
    isbn: venue.isbn13 || undefined,
    publisher: venue.publisher?.name ? { '@type': 'Organization', name: venue.publisher.name } : undefined,
    url: canonical,
    mainEntityOfPage: canonical,
    inLanguage: venue.language || locale,
    description: descriptionText || undefined
  });

  const idLabel = (key: string) => {
    const labelKey = identifierLabelKey(key);
    return labelKey ? t(labelKey) : key.toUpperCase();
  };
  const identifierRows = Object.entries(venue.identifiers || {})
    .filter(([key, value]) => value && getIdentifierSpec(key) && !SEPARATELY_SHOWN.has(normalizeIdentifierKey(key)))
    .map(([key, value]) => ({ key, label: idLabel(key), text: String(value), href: buildIdentifierHref(key, String(value), 'venue') }));
  const accessLabels = [
    venue.open_access ? t('common.meta.openAccess') : '',
    venue.is_oa_diamond ? t('venues.detail.oaDiamond') : ''
  ].filter(Boolean);
  const indexingLabels = [
    venue.is_in_doaj ? t('venues.detail.doaj') : '',
    venue.is_in_scielo ? 'SciELO' : '',
    venue.is_indexed_in_scopus ? t('venues.detail.indexedScopus') : ''
  ].filter(Boolean);
  const citedByCount = Number(venue.cited_by_count);
  const publisherId = venue.publisher?.id;
  const issnText = issnValues.join(' / ');

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
  const pageHref = (target: number) => `/venues/${id}${target > 1 ? `?page=${target}` : ''}`;
  const paginationNav = (
    <nav className="pagination-nav" aria-label={t('common.labels.pagination')}>
      {page > 1 ? (
        <LocaleLink className="pagination-btn btn-negative" href={pageHref(page - 1)}>{t('common.actions.previous')}</LocaleLink>
      ) : (
        <button type="button" className="pagination-btn btn-negative" disabled>{t('common.actions.previous')}</button>
      )}
      {hasNext ? (
        <LocaleLink className="pagination-btn btn-positive" href={pageHref(page + 1)}>{t('common.actions.next')}</LocaleLink>
      ) : (
        <button type="button" className="pagination-btn btn-positive" disabled>{t('common.actions.next')}</button>
      )}
    </nav>
  );

  const tabs: SectionTabDescriptor[] = [
    descriptionText || subjectItems.length > 0 ? {
      key: 'summary',
      label: t('venues.sections.summary'),
      content: (
        <>
          {descriptionText ? <p className="description">{descriptionText}</p> : null}
          <SubjectLinks subjects={subjectItems} filters={{ venue: name }} />
        </>
      )
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
      content: <VenueWorksList items={firstItems} labels={{ ...listLabels, emptyState: t('venues.empty.first') }} />
    },
    {
      key: 'tools',
      label: t('venues.sections.tools'),
      content: <EntityTools kind="venue" entityId={id} filename={exportFilename('venue', venue)} worksCount={Number(venue.works_count) || 0} entityExportLabel={t('venues.tools.exportVenue')} />
    }
  ].filter(Boolean) as SectionTabDescriptor[];

  const metricRows: Array<{ key: string; label: string; value: string }> = [
    { key: 'impact_factor', label: t('venues.detail.impactFactor'), value: venue.impact_factor ? String(venue.impact_factor) : '' },
    { key: 'sjr', label: t('venues.detail.sjr'), value: venue.sjr ? `${venue.sjr}${venue.sjr_best_quartile ? ` (${venue.sjr_best_quartile})` : ''}` : '' },
    { key: 'sjr_best_quartile', label: t('venues.detail.sjrQuartile'), value: !venue.sjr && venue.sjr_best_quartile ? String(venue.sjr_best_quartile) : '' },
    { key: 'snip', label: t('venues.detail.snip'), value: venue.snip ? String(venue.snip) : '' },
    { key: 'citescore', label: t('venues.detail.citescore'), value: venue.citescore ? String(venue.citescore) : '' },
    { key: 'h_index', label: t('venues.detail.hIndexLabel'), value: venue.h_index ? formatNumber(Number(venue.h_index), locale) : '' },
    { key: 'i10_index', label: t('venues.detail.i10IndexLabel'), value: venue.i10_index ? formatNumber(Number(venue.i10_index), locale) : '' },
    { key: 'two_yr_mean_citedness', label: t('venues.detail.meanCitedness'), value: venue.two_yr_mean_citedness ? String(venue.two_yr_mean_citedness) : '' },
    { key: 'overton', label: t('venues.detail.overton'), value: venue.overton ? formatNumber(Number(venue.overton), locale) : '' },
    { key: 'female_share', label: t('venues.detail.femaleShare'), value: venue.female_share ? `${Number(venue.female_share).toFixed(1)}%` : '' }
  ].filter((row) => row.value);

  return (
    <div className="page-header" aria-labelledby="page-title">
      <JsonLd data={jsonLd} />
      <JsonLd data={buildBreadcrumbList(locale as Locale, [
        { name: t('metadata.breadcrumbs.home'), path: '/' },
        { name: t('metadata.breadcrumbs.venues'), path: '/venues' },
        { name, path: `/venues/${id}` }
      ])} />
      <h1 className="page-title" id="page-title">{name}</h1>

      <section aria-labelledby="venue-info">
        <h2 className="title-section" id="venue-info">{t('venues.detail.data')}</h2>
        <table className="data-table item-detail-table" id="venue-details">
          <tbody>
            {venue.type ? (
              <tr>
                <th scope="row">{t('venues.detail.type')}</th>
                <td className="field-value">{venue.type}</td>
              </tr>
            ) : null}
            {venue.publisher?.name ? (
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
            {venue.scopus_id ? (
              <tr>
                <th scope="row">{idLabel('scopus')}</th>
                <td className="field-value">
                  <a className="action-link table-link" href={buildIdentifierHref('scopus', venue.scopus_id, 'venue') || undefined} target="_blank" rel="noopener noreferrer">{venue.scopus_id}</a>
                </td>
              </tr>
            ) : null}
            {identifierRows.map((row) => (
              <tr key={`venue-identifier-${row.key}`}>
                <th scope="row">{row.label}</th>
                <td className="field-value">
                  {row.href ? (
                    <a className="action-link table-link" href={row.href} target="_blank" rel="noopener noreferrer">{row.text}</a>
                  ) : (
                    <span>{row.text}</span>
                  )}
                </td>
              </tr>
            ))}
            {venue.homepage_url ? (
              <tr>
                <th scope="row">{t('venues.detail.website')}</th>
                <td className="field-value">
                  <a className="action-link table-link" href={venue.homepage_url} target="_blank" rel="noopener noreferrer">{venue.homepage_url}</a>
                </td>
              </tr>
            ) : null}
            <tr>
              <th scope="row">{t('venues.detail.total')}</th>
              <td className="field-value">{formatNumber(Number(venue.works_count) || 0, locale)}</td>
            </tr>
            {venue.coverage_start_year && venue.coverage_end_year ? (
              <tr>
                <th scope="row">{t('venues.detail.coverage')}</th>
                <td className="field-value">{venue.coverage_start_year} - {venue.coverage_end_year}</td>
              </tr>
            ) : null}
            {venue.country_code ? (
              <tr>
                <th scope="row">{t('venues.detail.country')}</th>
                <td className="field-value">{venue.country_code}</td>
              </tr>
            ) : null}
            {venue.language ? (
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
                <td className="field-value">{formatNumber(citedByCount, locale)}</td>
              </tr>
            ) : null}
            {metricRows.map((row) => (
              <tr key={row.key}>
                <th scope="row">{row.label}</th>
                <td className="field-value">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <SectionTabs ariaLabel={t('venues.sections.navLabel')} tabs={tabs} />
    </div>
  );
}
