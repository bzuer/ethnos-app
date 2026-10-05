import { getTranslations } from 'next-intl/server';
import LocaleLink from '@/components/common/LocaleLink';
import { type IdentifierEntry, renderGroupedIdentifiers } from '@/components/common/GroupedIdentifiers';
import SubjectLinks from '@/components/common/SubjectLinks';
import ClientActions from './work-actions';
import WorkCitationList from './WorkCitationList';
import WorkContributorRows from './WorkContributorRows';
import WorkSectionTabs from './WorkSectionTabs';
import JsonLd from '@/components/common/JsonLd';
import { buildPageMetadata, fitPageTitle, siteOpenGraphImage } from '@/i18n/metadata';
import { composeDescription } from '@/lib/meta-text';
import { localeUrl } from '@/lib/site';
import { buildBreadcrumbList, buildDoiIdentifier, withSitePublisher } from '@/lib/structured-data';
import { locales, type Locale } from '@/i18n/config';
import { formatContributorName, getWorkAbstractSnippet, groupContributorsByRole, groupContributorsByRoleSet, pickContributorEntries, pickContributorsByRole, sanitizeWorkAbstract } from '@/lib/works';
import { buildIdentifierHref, identifierLabelKey, normalizeIdentifierKey } from '@/lib/identifiers';
import { formatNumber } from '@/lib/format';
import { notFound } from 'next/navigation';
import { buildCoins, buildCitationMeta, pickReferenceAuthors } from './work-detail';
import { loadWork } from '@/lib/endpoints';
import { exportFilename } from '@/lib/entity-export';
import { buildWorkAccessLinks, toListItem } from '@/lib/work-export';

const openGraphLocaleMap: Record<string, string> = {
  en: 'en_US',
  pt: 'pt_BR',
  es: 'es_ES'
};

export async function generateMetadata(props: { params: Promise<{ locale: string; id: string }> }) {
  const { id, locale } = await props.params;
  const base = await buildPageMetadata(Promise.resolve({ locale }), 'metadata.workDetail', `/works/${id}`);
  let work: any = null;
  try {
    work = await loadWork(id);
  } catch {
    return base;
  }
  if (!work || !work.id) return base;
  const publication = work?.publication || {};
  const venue = work?.venue || {};
  const publisher = work?.publisher || {};
  const workType = work?.formatted_type || work?.work_type || work?.type;
  const isBookType = String(workType || '').toUpperCase().includes('BOOK');
  const subtitle = work?.subtitle ? String(work.subtitle) : '';
  const titleBase = work?.title || (typeof base.title === 'string' ? base.title : '');
  const fullTitle = subtitle ? `${titleBase}: ${subtitle}` : titleBase;
  const year = publication?.year || work?.publication_year || work?.year;
  const yearTag = year ? `(${year})` : '';
  const titleWithYear = fullTitle && yearTag ? `${fullTitle} ${yearTag}` : fullTitle;
  const pageTitle = await fitPageTitle(
    locale,
    [titleWithYear, fullTitle, titleBase && yearTag ? `${titleBase} ${yearTag}` : '', titleBase],
    { text: titleBase || fullTitle, tail: yearTag }
  );
  const authorNames = pickContributorsByRole(pickContributorEntries(work), 'AUTHOR').map(formatContributorName).filter(Boolean);
  const authorSummary = pickReferenceAuthors(work);
  const venueName = venue?.name || work?.venue_name || '';
  const comparable = (value: unknown) => String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  const venueLine = venueName && ![titleBase, fullTitle].some((title) => comparable(title) === comparable(venueName)) ? venueName : '';
  const byline = authorSummary ? (yearTag ? `${authorSummary} ${yearTag}` : authorSummary) : (year ? String(year) : '');
  const descriptors = await getTranslations({ locale, namespace: 'metadata.descriptors' });
  const abstractText = getWorkAbstractSnippet(work, 0);
  const description = abstractText
    ? composeDescription(abstractText, [byline, venueLine, descriptors('workRecordMedium'), descriptors('workRecordShort')])
    : composeDescription(fullTitle, [
        byline,
        venueLine,
        descriptors('workRecord'),
        descriptors('workRecordMedium'),
        descriptors('workRecordShort')
      ]);
  const canonicalUrl = localeUrl(locale as Locale, `/works/${id}`);
  const ogLocale = openGraphLocaleMap[locale] || 'en_US';
  const alternateLocale = locales.filter((code) => code !== locale).map((code) => openGraphLocaleMap[code] || 'en_US');
  const ogTitle = titleWithYear ? `${titleWithYear} - Ethnos Bibliography` : 'Ethnos Bibliography';
  const ogImage = siteOpenGraphImage();
  const articleAuthors = Array.from(new Set((authorNames.length ? authorNames : (authorSummary ? [authorSummary] : [])).map((a: any) => String(a))));
  const keywords = [
    fullTitle || '',
    venue?.name || work?.venue_name || '',
    workType || '',
    publisher?.name || work?.publisher_name || '',
    ...(Array.isArray(authorSummary) ? authorSummary : authorSummary ? [authorSummary] : [])
  ].map((k) => (k ? String(k) : '')).filter(Boolean);
  const other = buildCitationMeta(work, locale, id);
  const openGraph = isBookType
    ? {
        title: ogTitle,
        description: description || base.description || '',
        type: 'book' as const,
        releaseDate: publication?.publication_date || work?.publication_date || (year ? String(year) : undefined),
        authors: articleAuthors,
        locale: ogLocale,
        alternateLocale,
        url: canonicalUrl,
        siteName: 'Ethnos Bibliography',
        images: [ogImage]
      }
    : {
        title: ogTitle,
        description: description || base.description || '',
        type: 'article' as const,
        publishedTime: publication?.publication_date || work?.publication_date || (year ? String(year) : undefined),
        authors: articleAuthors,
        section: venue?.name || work?.venue_name || undefined,
        locale: ogLocale,
        alternateLocale,
        url: canonicalUrl,
        siteName: 'Ethnos Bibliography',
        images: [ogImage]
      };
  return {
    ...base,
    title: pageTitle || base.title,
    description: description || base.description,
    keywords: keywords.length ? keywords : undefined,
    openGraph,
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description: description || base.description || '',
      images: [ogImage.url]
    },
    other: { ...(base.other || {}), ...other }
  };
}

export const dynamic = 'force-dynamic';

export default async function WorkDetailPage(props: { params: Promise<{ locale: string; id: string }> }) {
  const { id, locale } = await props.params;
  const work = await loadWork(id);
  if (!work || !work.id) notFound();
  const t = await getTranslations({ locale });
  const contributorEntries = pickContributorEntries(work);
  const contributorGroups = groupContributorsByRole(contributorEntries);
  const contributorRoleSets = groupContributorsByRoleSet(contributorEntries);
  const contributorLabels = {
    roles: {
      AUTHOR: t('works.detail.labels.authors'),
      EDITOR: t('works.detail.labels.editors'),
      TRANSLATOR: t('works.detail.labels.translators'),
      REVIEWER: t('works.detail.labels.reviewers'),
      OTHER: t('works.detail.labels.contributors')
    },
    unknownName: t('common.entities.authorUnknown'),
    corresponding: t('works.detail.labels.corresponding')
  };
  const publication = work?.publication || {};
  const year = publication?.year || work?.publication_year || work?.year;
  const volume = publication?.volume || work?.volume;
  const issue = [publication?.issue, publication?.number, work?.issue, work?.number]
    .find((value) => value !== undefined && value !== null && value !== '' && typeof value !== 'boolean');
  const pages = publication?.pages || work?.pages;
  const pageParts = (() => {
    const text = pages ? String(pages).trim() : '';
    if (!text) return { first: '', last: '' };
    const parts = text.split(/[-–—]/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) return { first: parts[0], last: parts[parts.length - 1] };
    return { first: parts[0], last: '' };
  })();
  const publicationDate = publication?.publication_date || work?.publication_date;
  const publicationDateFormatted = publicationDate ? String(publicationDate).slice(0, 10) : (year ? String(year) : '');
  const peerReviewed = typeof publication?.peer_reviewed === 'boolean' ? publication.peer_reviewed : (typeof work?.peer_reviewed === 'boolean' ? work.peer_reviewed : null);
  const openAccess = typeof publication?.open_access === 'boolean' ? publication.open_access : (typeof work?.open_access === 'boolean' ? work.open_access : null);
  const doi = work?.doi || publication?.doi;
  const venueId = work?.venue?.id || work?.venue_id;
  const venueName = work?.venue?.name || work?.venue_name;
  const venueType = work?.venue?.type || work?.venue_type;
  const venueIssn = work?.venue?.issn || work?.venue_issn;
  const venueEissn = work?.venue?.eissn || work?.venue_eissn;
  const publisherName = work?.publisher?.name || work?.publisher_name;
  const publisherType = work?.publisher?.type;
  const publisherCountry = work?.publisher?.country;
  const workType = work?.formatted_type || work?.work_type || work?.type;
  const isBookType = String(workType || '').toUpperCase().includes('BOOK');
  const language = work?.language;
  const reviewRelations = work?.review_relations;
  const reviewsOf: any[] = Array.isArray(reviewRelations?.reviews_of) ? reviewRelations.reviews_of : [];
  const reviewedBy: any[] = Array.isArray(reviewRelations?.reviewed_by) ? reviewRelations.reviewed_by : [];
  const metrics = work?.metrics || {};
  const identifiers = work?.identifiers && typeof work.identifiers === 'object' ? work.identifiers : {};
  const workTitle = work?.title || t('works.detail.titleFallback');
  const fullTitle = work?.subtitle ? `${workTitle}: ${work.subtitle}` : workTitle;
  const namesForRole = (role: 'AUTHOR' | 'EDITOR' | 'TRANSLATOR' | 'REVIEWER' | 'OTHER') =>
    (contributorGroups.find((group) => group.role === role)?.contributors || []).map(formatContributorName).filter(Boolean);
  const authorNames = namesForRole('AUTHOR');
  const editorNames = namesForRole('EDITOR');
  const translatorNames = namesForRole('TRANSLATOR');
  const otherContributorNames = [...namesForRole('REVIEWER'), ...namesForRole('OTHER')];
  const ids: IdentifierEntry[] = [];
  const venueIds: IdentifierEntry[] = [];
  const addValues = (
    label: string,
    raw?: any,
    hrefBuilder?: (value: string) => string | null,
    targetList: IdentifierEntry[] = ids
  ) => {
    const list = Array.isArray(raw) ? raw : (raw || raw === 0 ? [raw] : []);
    const values = list.map((value: any) => {
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
    }).filter(Boolean) as Array<{ text: string; href?: string }>;
    if (!values.length) return;
    const existing = targetList.find((entry) => entry.label === label);
    const target = existing ? existing.values : [];
    values.forEach((entry) => {
      if (target.some((item) => item.text === entry.text && item.href === entry.href)) return;
      target.push(entry);
    });
    if (!existing) targetList.push({ label, values: target });
  };
  const idLabel = (rawKey: string, fallback?: string) => {
    const labelKey = identifierLabelKey(rawKey);
    return labelKey ? t(labelKey) : (fallback || rawKey.toUpperCase());
  };
  const addId = (rawKey: string, raw: any, targetList: IdentifierEntry[] = ids) => {
    addValues(idLabel(rawKey), raw, (value) => buildIdentifierHref(rawKey, value, 'work'), targetList);
  };
  addId('doi', work?.doi || publication?.doi);
  addId('pmid', work?.pmid);
  addId('pmcid', work?.pmcid);
  addId('arxiv', work?.arxiv);
  addId('wos', work?.wos_id);
  addId('handle', work?.handle);
  addId('wikidata', work?.wikidata_id);
  addId('openalex', work?.openalex_id);
  addId('openlibrary', work?.openlibrary_id);
  addId('isbn', work?.isbn);
  Object.entries(identifiers).forEach(([rawKey, rawValue]) => {
    const key = String(rawKey || '');
    if (!key) return;
    const normalized = normalizeIdentifierKey(key);
    if (normalized === 'doi' || normalized === 'openalex') return;
    addValues(idLabel(key), rawValue, (value) => buildIdentifierHref(key, value, 'work'));
  });
  addValues(t('venues.detail.issn'), venueIssn, undefined, venueIds);
  addValues(t('venues.detail.eissn'), venueEissn, undefined, venueIds);
  const abstractText = work?.abstract || '';
  const cleanedAbstract = sanitizeWorkAbstract(abstractText);
  const refs: any[] = Array.isArray(work?.citations?.references) ? work.citations.references : [];
  const citedBy: any[] = Array.isArray(work?.citations?.cited_by) ? work.citations.cited_by : [];
  const subjectsRaw: any[] = Array.isArray(work?.subjects) ? work.subjects : [];
  const workSubjects = (() => {
    const seen = new Set<string>();
    const out: Array<{ term: string }> = [];
    for (const s of subjectsRaw) {
      const term = s?.term || s?.display_name || s?.name || '';
      if (!term) continue;
      const key = String(term).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ term: String(term) });
    }
    return out;
  })();
  const authoritativeMetrics: any = work?.authoritative_metrics || {};
  const citationMetrics: any = authoritativeMetrics?.citation_metrics || {};
  const citationsReceived = Number(citationMetrics?.total_citations_received);
  const uniqueCiting = Number(citationMetrics?.unique_citing_works);
  const referencesMade = Number(citationMetrics?.total_references_made);
  const citationsCountDisplay = Number.isFinite(citationsReceived) && citationsReceived > 0
    ? citationsReceived
    : (Number(metrics?.citation_count) || 0);
  const referencesCountDisplay = Number.isFinite(referencesMade) && referencesMade > 0
    ? referencesMade
    : (Number(metrics?.reference_count) || 0);
  const citationsTabTotal = Number.isFinite(uniqueCiting) && uniqueCiting > 0
    ? uniqueCiting
    : (citationsCountDisplay || citedBy.length);
  const referencesTabTotal = referencesCountDisplay || refs.length;
  const coins = buildCoins(work, locale, id);

  const impactPanel = (() => {
    const cm: any = authoritativeMetrics?.citation_metrics || {};
    const tm: any = authoritativeMetrics?.temporal_metrics || {};
    const ii: any = authoritativeMetrics?.impact_indicators || {};
    const perYear = Number(cm?.citations_per_year);
    const uniqueCitingWorks = Number(cm?.unique_citing_works);
    const types: any = cm?.citation_types || {};
    const typePos = Number(types?.positive) || 0;
    const typeNeu = Number(types?.neutral) || 0;
    const typeNeg = Number(types?.negative) || 0;
    const typeSelf = Number(types?.self) || 0;
    const hasTypes = typePos + typeNeu + typeNeg + typeSelf > 0;
    const firstYear = Number(tm?.first_citation_year) || null;
    const latestYear = Number(tm?.latest_citation_year) || null;
    const spanYears = Number(tm?.citation_span_years);
    const highlyCited = typeof ii?.highly_cited === 'boolean' ? ii.highly_cited : null;
    const velocity = ii?.citation_velocity ? String(ii.citation_velocity).replace(/_/g, ' ') : '';
    const hasImpact = (Number.isFinite(uniqueCitingWorks) && uniqueCitingWorks > 0)
      || (Number.isFinite(perYear) && perYear > 0)
      || (firstYear && latestYear)
      || highlyCited !== null
      || !!velocity
      || hasTypes;
    if (!hasImpact) return null;
    return (
      <table className="data-table item-detail-table">
        <tbody>
          {Number.isFinite(uniqueCitingWorks) && uniqueCitingWorks > 0 ? (
            <tr>
              <th scope="row">{t('works.detail.impact.uniqueCiting')}</th>
              <td className="field-value">{formatNumber(uniqueCitingWorks)}</td>
            </tr>
          ) : null}
          {Number.isFinite(perYear) && perYear > 0 ? (
            <tr>
              <th scope="row">{t('works.detail.impact.citationsPerYear')}</th>
              <td className="field-value">{formatNumber(perYear)}</td>
            </tr>
          ) : null}
          {firstYear && latestYear ? (
            <tr>
              <th scope="row">{t('works.detail.impact.citationSpan')}</th>
              <td className="field-value">{firstYear} - {latestYear}{Number.isFinite(spanYears) && spanYears > 0 ? ` (${formatNumber(spanYears)})` : ''}</td>
            </tr>
          ) : null}
          {velocity ? (
            <tr>
              <th scope="row">{t('works.detail.impact.velocity')}</th>
              <td className="field-value">{velocity}</td>
            </tr>
          ) : null}
          {highlyCited !== null ? (
            <tr>
              <th scope="row">{t('works.detail.impact.highlyCited')}</th>
              <td className="field-value">{highlyCited ? t('common.values.yes') : t('common.values.no')}</td>
            </tr>
          ) : null}
          {hasTypes ? (
            <tr>
              <th scope="row">{t('works.detail.impact.citationTypes')}</th>
              <td className="field-value">
                {[
                  typePos > 0 ? `${t('works.detail.impact.positive')}: ${formatNumber(typePos)}` : '',
                  typeNeu > 0 ? `${t('works.detail.impact.neutral')}: ${formatNumber(typeNeu)}` : '',
                  typeNeg > 0 ? `${t('works.detail.impact.negative')}: ${formatNumber(typeNeg)}` : '',
                  typeSelf > 0 ? `${t('works.detail.impact.selfCitations')}: ${formatNumber(typeSelf)}` : ''
                ].filter(Boolean).join(' • ')}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    );
  })();

  const publicUrl = localeUrl(locale as Locale, `/works/${id}`);
  const jsonLd: Record<string, any> = withSitePublisher({
    '@context': 'https://schema.org',
    '@type': isBookType ? 'Book' : 'ScholarlyArticle',
    '@id': `${publicUrl}#record`,
    headline: fullTitle,
    name: fullTitle,
    url: publicUrl,
    mainEntityOfPage: publicUrl
  });
  if (publicationDateFormatted) jsonLd.datePublished = publicationDateFormatted;
  if (language) jsonLd.inLanguage = String(language);
  const toPersonNodes = (names: string[]) => names.map((name: string) => ({ '@type': 'Person', name }));
  if (authorNames.length) jsonLd.author = toPersonNodes(authorNames);
  if (editorNames.length) jsonLd.editor = toPersonNodes(editorNames);
  if (translatorNames.length) jsonLd.translator = toPersonNodes(translatorNames);
  if (otherContributorNames.length) jsonLd.contributor = toPersonNodes(otherContributorNames);
  if (publisherName) jsonLd.publisher = { '@type': 'Organization', name: publisherName };
  if (doi) {
    jsonLd.identifier = buildDoiIdentifier(String(doi));
    jsonLd.sameAs = `https://doi.org/${String(doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')}`;
  }
  if (workSubjects.length) jsonLd.keywords = workSubjects.map((subject) => subject.term);
  if (typeof openAccess === 'boolean') jsonLd.isAccessibleForFree = openAccess;
  if (publication?.license_url) jsonLd.license = String(publication.license_url);
  if (venueName && !isBookType) {
    const issn = [venueIssn, venueEissn].flatMap((v) => (Array.isArray(v) ? v : v ? [v] : [])).filter(Boolean);
    jsonLd.isPartOf = {
      '@type': 'Periodical',
      name: venueName,
      issn: issn.length ? issn : undefined,
      publisher: publisherName ? { '@type': 'Organization', name: publisherName } : undefined
    };
  }
  if (volume) jsonLd.volumeNumber = String(volume);
  if (issue) jsonLd.issueNumber = String(issue);
  if (pageParts.first) jsonLd.pageStart = pageParts.first;
  if (pageParts.last) jsonLd.pageEnd = pageParts.last;
  if (cleanedAbstract) jsonLd.description = getWorkAbstractSnippet(work, 700);
  const breadcrumb = buildBreadcrumbList(locale as Locale, [
    { name: t('metadata.breadcrumbs.home'), path: '/' },
    { name: fullTitle, path: `/works/${id}` }
  ]);

  return (
    <div className="page-header" aria-labelledby="page-title">
      <JsonLd data={jsonLd} />
      <JsonLd data={breadcrumb} />
      {coins ? <span className="Z3988 visually-hidden" title={coins} /> : null}
      <h1 className="page-title" id="page-title">{workTitle}</h1>
      {work?.subtitle ? (<p className="item-subtitle">{work.subtitle}</p>) : null}

      <section aria-labelledby="bib-block">
        <h2 className="title-section" id="bib-block">{t('works.detail.sections.bibliographic')}</h2>
        <table className="data-table item-detail-table">
          <tbody>
            <tr>
              <th scope="row">{t('works.detail.labels.id')}</th>
              <td className="field-value">{id}</td>
            </tr>
            {contributorRoleSets.length > 0 ? (
              <WorkContributorRows groups={contributorRoleSets} labels={contributorLabels} />
            ) : (
              <tr>
                <th scope="row">{t('works.detail.labels.authors')}</th>
                <td className="field-value">{t('common.entities.authorUnknown')}</td>
              </tr>
            )}
            {year ? (
              <tr>
                <th scope="row">{t('works.detail.labels.year')}</th>
                <td className="field-value">{year}</td>
              </tr>
            ) : null}
            {volume ? (
              <tr>
                <th scope="row">{t('works.detail.labels.volume')}</th>
                <td className="field-value">{volume}</td>
              </tr>
            ) : null}
            {issue ? (
              <tr>
                <th scope="row">{t('works.detail.labels.issue')}</th>
                <td className="field-value">{issue}</td>
              </tr>
            ) : null}
            {pages ? (
              <tr>
                <th scope="row">{t('works.detail.labels.pages')}</th>
                <td className="field-value">{pages}</td>
              </tr>
            ) : null}
            {publicationDate ? (
              <tr>
                <th scope="row">{t('works.detail.labels.publicationDate')}</th>
                <td className="field-value">{String(publicationDate).slice(0, 10)}</td>
              </tr>
            ) : null}
            {peerReviewed === null || isBookType ? null : (
              <tr>
                <th scope="row">{t('works.detail.labels.peerReviewed')}</th>
                <td className="field-value">{peerReviewed ? t('common.values.yes') : t('common.values.no')}</td>
              </tr>
            )}
            {openAccess === null ? null : (
              <tr>
                <th scope="row">{t('works.detail.labels.openAccess')}</th>
                <td className="field-value">{openAccess ? t('common.values.yes') : t('common.values.no')}</td>
              </tr>
            )}
            {workType ? (
              <tr>
                <th scope="row">{t('works.detail.labels.type')}</th>
                <td className="field-value">{workType}</td>
              </tr>
            ) : null}
            {reviewsOf.map((rel: any) => {
              const relTitle = rel?.subtitle ? `${rel.title || ''}: ${rel.subtitle}` : (rel?.title || '');
              const relAuthor = (rel?.authors_preview?.[0]) || (rel?.contributors_preview?.[0]?.name) || '';
              const relYear = rel?.publication_year || '';
              const desc = [relTitle, relAuthor, relYear].filter(Boolean).join(', ');
              return (
                <tr key={`review-of-${rel.work_id}`}>
                  <th scope="row">{t('works.detail.labels.reviewOf')}</th>
                  <td className="field-value">
                    {rel?.work_id ? (
                      <LocaleLink className="action-link table-link" href={`/works/${rel.work_id}`}>{desc}</LocaleLink>
                    ) : desc}
                  </td>
                </tr>
              );
            })}
            {reviewedBy.map((rel: any) => {
              const relTitle = rel?.subtitle ? `${rel.title || ''}: ${rel.subtitle}` : (rel?.title || '');
              const relAuthor = (rel?.authors_preview?.[0]) || (rel?.contributors_preview?.[0]?.name) || '';
              const relYear = rel?.publication_year || '';
              const desc = [relTitle, relAuthor, relYear].filter(Boolean).join(', ');
              return (
                <tr key={`reviewed-by-${rel.work_id}`}>
                  <th scope="row">{t('works.detail.labels.reviewedBy')}</th>
                  <td className="field-value">
                    {rel?.work_id ? (
                      <LocaleLink className="action-link table-link" href={`/works/${rel.work_id}`}>{desc}</LocaleLink>
                    ) : desc}
                  </td>
                </tr>
              );
            })}
            {venueName ? (
              <tr>
                <th scope="row">{t('works.detail.labels.venue')}</th>
                <td className="field-value">
                  {venueId ? (
                    <LocaleLink className="action-link table-link" href={`/venues/${venueId}`}>{venueName}</LocaleLink>
                  ) : (
                    <span className="field-value">{venueName}</span>
                  )}
                  {venueType ? ` (${venueType})` : ''}
                </td>
              </tr>
            ) : null}
            {venueIds.length > 0 ? (
              <tr>
                <th scope="row">{t('works.detail.labels.venueIds')}</th>
                <td className="field-value">
                  {renderGroupedIdentifiers(venueIds, 'venue-ids')}
                </td>
              </tr>
            ) : null}
            {publisherName ? (
              <tr>
                <th scope="row">{t('works.detail.labels.publisher')}</th>
                <td className="field-value">
                  {publisherName}
                  {publisherType || publisherCountry ? ` (${[publisherType, publisherCountry].filter(Boolean).join(' • ')})` : ''}
                </td>
              </tr>
            ) : null}
            {ids.map((kv) => (
              <tr key={kv.label}>
                <th scope="row">{kv.label}</th>
                <td className="field-value">
                  {kv.values.map((entry, idx: number) => (
                    <span key={`${kv.label}-${entry.text}-${idx}`}>
                      {entry.href ? (
                        <a className="action-link table-link" href={entry.href} target="_blank" rel="noopener noreferrer">{entry.text}</a>
                      ) : (
                        <span>{entry.text}</span>
                      )}
                      {idx < kv.values.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
            {language ? (
              <tr>
                <th scope="row">{t('works.detail.labels.language')}</th>
                <td className="field-value">{String(language).toUpperCase()}</td>
              </tr>
            ) : null}
            {citationsCountDisplay > 0 ? (
              <tr>
                <th scope="row">{t('works.detail.labels.citations')}</th>
                <td className="field-value">{formatNumber(citationsCountDisplay)}</td>
              </tr>
            ) : null}
            {referencesCountDisplay > 0 ? (
              <tr>
                <th scope="row">{t('works.detail.labels.references')}</th>
                <td className="field-value">{formatNumber(referencesCountDisplay)}</td>
              </tr>
            ) : null}
            {typeof metrics?.download_count === 'number' && metrics.download_count > 0 ? (
              <tr>
                <th scope="row">{t('works.detail.labels.downloads')}</th>
                <td className="field-value">{formatNumber(metrics.download_count)}</td>
              </tr>
            ) : null}
            {typeof metrics?.view_count === 'number' && metrics.view_count > 0 ? (
              <tr>
                <th scope="row">{t('works.detail.labels.views')}</th>
                <td className="field-value">{formatNumber(metrics.view_count)}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <WorkSectionTabs
        ariaLabel={t('works.detail.sections.navLabel')}
        abstractLabel={t('works.detail.sections.abstract')}
        citationsLabel={t('works.detail.sections.citedBy')}
        referencesLabel={t('works.detail.sections.references')}
        impactLabel={t('works.detail.sections.impact')}
        abstract={(abstractText || workSubjects.length > 0) ? (
          <>
            {abstractText ? <p className="description">{abstractText}</p> : null}
            <SubjectLinks subjects={workSubjects} />
          </>
        ) : null}
        citations={(citationsTabTotal > 0 || citedBy.length > 0) ? (
          <WorkCitationList workId={id} kind="citations" initialItems={citedBy} total={citationsTabTotal} />
        ) : null}
        references={(referencesTabTotal > 0 || refs.length > 0) ? (
          <WorkCitationList workId={id} kind="references" initialItems={refs} total={referencesTabTotal} />
        ) : null}
        impact={impactPanel}
      />

      <section aria-labelledby="tools-block">
        <h2 className="title-section" id="tools-block">{t('works.detail.sections.tools')}</h2>
        <div className="tools-actions">
          <ClientActions workId={id} filename={exportFilename('work', work)} links={buildWorkAccessLinks(work)} listItem={toListItem(work)} />
        </div>
      </section>
    </div>
  );
}
