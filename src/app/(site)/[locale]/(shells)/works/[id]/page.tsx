import { getTranslations } from 'next-intl/server';
import LocaleLink from '@/components/common/LocaleLink';
import { type IdentifierEntry, renderGroupedIdentifiers } from '@/components/common/GroupedIdentifiers';
import SubjectLinks from '@/components/common/SubjectLinks';
import ClientActions from './work-actions';
import WorkCitationList from './WorkCitationList';
import WorkContributorRows from './WorkContributorRows';
import WorkSectionTabs from './WorkSectionTabs';
import JsonLd from '@/components/common/JsonLd';
import { alternateOpenGraphLocales, buildPageMetadata, fitPageTitle, openGraphLocales, siteOpenGraphImage } from '@/i18n/metadata';
import { composeDescription } from '@/lib/meta-text';
import { SITE_NAME, localeUrl } from '@/lib/site';
import { buildBreadcrumbList, buildDoiIdentifier, withSitePublisher } from '@/lib/structured-data';
import type { Locale } from '@/i18n/config';
import { formatContributorName, formatMetadataAuthors, getWorkAbstractSnippet, groupContributorsByRole, groupContributorsByRoleSet, normalizeDoi, pickContributorEntries, pickContributorsByRole, sanitizeWorkAbstract, toRelatedWorkRow, workDoi } from '@/lib/works';
import { buildIdentifierHref, identifierLabelKey, normalizeIdentifierKey } from '@/lib/identifiers';
import { formatNumber } from '@/lib/format';
import { notFound } from 'next/navigation';
import { buildCoins, buildCitationMeta, formatPublicationDate, splitPages, workKind } from './work-detail';
import { loadWork } from '@/lib/endpoints';
import { exportFilename } from '@/lib/entity-export';
import { buildWorkAccessLinks, toListItem } from '@/lib/work-export';

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
  const publication = work?.primary_publication || {};
  const kind = workKind(work?.type);
  const subtitle = work?.subtitle ? String(work.subtitle) : '';
  const titleBase = work?.title || (typeof base.title === 'string' ? base.title : '');
  const fullTitle = subtitle ? `${titleBase}: ${subtitle}` : titleBase;
  const year = work?.publication_year;
  const yearTag = year ? `(${year})` : '';
  const titleWithYear = fullTitle && yearTag ? `${fullTitle} ${yearTag}` : fullTitle;
  const pageTitle = await fitPageTitle(
    locale,
    [titleWithYear, fullTitle, titleBase && yearTag ? `${titleBase} ${yearTag}` : '', titleBase],
    { text: titleBase || fullTitle, tail: yearTag }
  );
  const authorNames = pickContributorsByRole(pickContributorEntries(work), 'AUTHOR').map(formatContributorName).filter(Boolean);
  const authorSummary = formatMetadataAuthors(work);
  const venueName = work?.venue?.name || '';
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
  const safeLocale = locale as Locale;
  const canonicalUrl = localeUrl(safeLocale, `/works/${id}`);
  const ogLocale = openGraphLocales[safeLocale];
  const alternateLocale = alternateOpenGraphLocales(safeLocale);
  const ogTitle = titleWithYear ? `${titleWithYear} - ${SITE_NAME}` : SITE_NAME;
  const ogImage = siteOpenGraphImage();
  const articleAuthors = Array.from(new Set(authorNames.length ? authorNames : (authorSummary ? [authorSummary] : [])));
  const keywords = [fullTitle, venueName, work?.type, publication.publisher?.name, authorSummary]
    .map((k) => (k ? String(k) : ''))
    .filter(Boolean);
  const releaseDate = publication.publication_date || (year ? String(year) : undefined);
  const openGraph = kind === 'book'
    ? {
        title: ogTitle,
        description: description || base.description || '',
        type: 'book' as const,
        releaseDate,
        authors: articleAuthors,
        locale: ogLocale,
        alternateLocale,
        url: canonicalUrl,
        siteName: SITE_NAME,
        images: [ogImage]
      }
    : {
        title: ogTitle,
        description: description || base.description || '',
        type: 'article' as const,
        publishedTime: releaseDate,
        authors: articleAuthors,
        section: venueName || undefined,
        locale: ogLocale,
        alternateLocale,
        url: canonicalUrl,
        siteName: SITE_NAME,
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
    other: { ...(base.other || {}), ...buildCitationMeta(work, locale, id) }
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
  const publication = work?.primary_publication || {};
  const year = work?.publication_year;
  const volume = publication.volume;
  const issue = publication.issue;
  const pages = publication.pages;
  const pageParts = splitPages(pages);
  const publicationDate = publication.publication_date;
  const publicationDateFormatted = formatPublicationDate(publicationDate, year);
  const openAccess = typeof publication.open_access === 'boolean' ? publication.open_access : null;
  const doi = workDoi(work);
  const venue = work?.venue || {};
  const publisher = publication.publisher || {};
  const workType = work?.type;
  const kind = workKind(workType);
  const language = work?.language;
  const reviewRelations = work?.review_relations;
  const reviewsOf: any[] = Array.isArray(reviewRelations?.reviews_of) ? reviewRelations.reviews_of : [];
  const reviewedBy: any[] = Array.isArray(reviewRelations?.reviewed_by) ? reviewRelations.reviewed_by : [];
  const identifiers: Record<string, any> = work?.identifiers && typeof work.identifiers === 'object' ? work.identifiers : {};
  const workTitle = work?.title || t('works.detail.titleFallback');
  const fullTitle = work?.subtitle ? `${workTitle}: ${work.subtitle}` : workTitle;
  const namesForRole = (role: 'AUTHOR' | 'EDITOR' | 'TRANSLATOR' | 'REVIEWER' | 'OTHER') =>
    (contributorGroups.find((group) => group.role === role)?.contributors || []).map(formatContributorName).filter(Boolean);
  const authorNames = namesForRole('AUTHOR');
  const editorNames = namesForRole('EDITOR');
  const translatorNames = namesForRole('TRANSLATOR');
  const otherContributorNames = [...namesForRole('REVIEWER'), ...namesForRole('OTHER')];
  const toEntry = (key: string, values: any): IdentifierEntry | null => {
    const labelKey = identifierLabelKey(key);
    const texts = Array.from(new Set((Array.isArray(values) ? values : [values]).map((value) => (value ? String(value).trim() : '')).filter(Boolean)));
    if (!labelKey || !texts.length) return null;
    return {
      label: t(labelKey),
      values: texts.map((text) => {
        const href = buildIdentifierHref(key, text, 'work');
        return href ? { text, href } : { text };
      })
    };
  };
  const ids = [
    toEntry('doi', doi),
    ...Object.entries(identifiers)
      .filter(([key]) => normalizeIdentifierKey(key) !== 'doi')
      .map(([key, values]) => toEntry(key, values))
  ].filter(Boolean) as IdentifierEntry[];
  const venueIds = [toEntry('issn', venue.issn), toEntry('eissn', venue.eissn)].filter(Boolean) as IdentifierEntry[];
  const cleanedAbstract = sanitizeWorkAbstract(work?.abstract);
  const refs = (Array.isArray(work?.citations?.references) ? work.citations.references : []).map(toRelatedWorkRow);
  const citedBy = (Array.isArray(work?.citations?.cited_by) ? work.citations.cited_by : []).map(toRelatedWorkRow);
  const workSubjects = Array.from(new Set<string>((Array.isArray(work?.subjects) ? work.subjects : [])
    .map((subject: any) => String(subject?.term || '').trim())
    .filter(Boolean)))
    .map((term) => ({ term }));
  const metrics = work?.metrics || {};
  const authoritativeMetrics: any = work?.authoritative_metrics || {};
  const citationMetrics: any = authoritativeMetrics?.citation_metrics || {};
  const citingWorks = Number(citationMetrics?.unique_citing_works);
  const referencesMade = Number(citationMetrics?.total_references_made);
  const citationsTotal = Number.isFinite(citingWorks) && citingWorks > 0 ? citingWorks : (Number(metrics?.citation_count) || 0);
  const referencesTotal = Number.isFinite(referencesMade) && referencesMade > 0 ? referencesMade : (Number(metrics?.reference_count) || 0);
  const coins = buildCoins(work, locale, id);

  const impactPanel = (() => {
    const tm: any = authoritativeMetrics?.temporal_metrics || {};
    const ii: any = authoritativeMetrics?.impact_indicators || {};
    const perYear = Number(citationMetrics?.citations_per_year);
    const firstYear = Number(tm?.first_citation_year) || null;
    const latestYear = Number(tm?.latest_citation_year) || null;
    const spanYears = Number(tm?.citation_span_years);
    const highlyCited = typeof ii?.highly_cited === 'boolean' ? ii.highly_cited : null;
    const hasImpact = (Number.isFinite(perYear) && perYear > 0) || (firstYear && latestYear) || highlyCited !== null;
    if (!hasImpact) return null;
    return (
      <table className="data-table item-detail-table">
        <tbody>
          {Number.isFinite(perYear) && perYear > 0 ? (
            <tr>
              <th scope="row">{t('works.detail.impact.citationsPerYear')}</th>
              <td className="field-value">{formatNumber(perYear, locale)}</td>
            </tr>
          ) : null}
          {firstYear && latestYear ? (
            <tr>
              <th scope="row">{t('works.detail.impact.citationSpan')}</th>
              <td className="field-value">{firstYear} - {latestYear}{Number.isFinite(spanYears) && spanYears > 0 ? ` (${formatNumber(spanYears, locale)})` : ''}</td>
            </tr>
          ) : null}
          {highlyCited !== null ? (
            <tr>
              <th scope="row">{t('works.detail.impact.highlyCited')}</th>
              <td className="field-value">{highlyCited ? t('common.values.yes') : t('common.values.no')}</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    );
  })();

  const publicUrl = localeUrl(locale as Locale, `/works/${id}`);
  const jsonLd: Record<string, any> = withSitePublisher({
    '@context': 'https://schema.org',
    '@type': kind === 'book' ? 'Book' : kind === 'chapter' ? 'Chapter' : 'ScholarlyArticle',
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
  const publisherNode = publisher.name ? { '@type': 'Organization', name: publisher.name } : undefined;
  if (publisherNode) jsonLd.publisher = publisherNode;
  if (doi) {
    jsonLd.identifier = buildDoiIdentifier(String(doi));
    jsonLd.sameAs = `https://doi.org/${normalizeDoi(doi)}`;
  }
  if (workSubjects.length) jsonLd.keywords = workSubjects.map((subject) => subject.term);
  if (typeof openAccess === 'boolean') jsonLd.isAccessibleForFree = openAccess;
  if (/^https?:\/\//i.test(String(publication.license_url || ''))) jsonLd.license = String(publication.license_url);
  if (venue.name && kind === 'article') {
    jsonLd.isPartOf = {
      '@type': 'Periodical',
      name: venue.name,
      issn: [venue.issn, venue.eissn].filter(Boolean),
      publisher: publisherNode
    };
  }
  if (venue.name && kind === 'chapter') jsonLd.isPartOf = { '@type': 'Book', name: venue.name, publisher: publisherNode };
  if (volume) jsonLd.volumeNumber = String(volume);
  if (issue) jsonLd.issueNumber = String(issue);
  if (pageParts.first) jsonLd.pageStart = pageParts.first;
  if (pageParts.last) jsonLd.pageEnd = pageParts.last;
  if (cleanedAbstract) jsonLd.description = getWorkAbstractSnippet(work, 700);
  const breadcrumb = buildBreadcrumbList(locale as Locale, [
    { name: t('metadata.breadcrumbs.home'), path: '/' },
    { name: fullTitle, path: `/works/${id}` }
  ]);
  const describeRelation = (rel: any) => [
    rel?.subtitle ? `${rel.title || ''}: ${rel.subtitle}` : (rel?.title || ''),
    rel?.contributors_preview?.[0]?.name || '',
    rel?.publication_year || ''
  ].filter(Boolean).join(', ');

  return (
    <div className="page-header" aria-labelledby="page-title">
      <JsonLd data={jsonLd} />
      <JsonLd data={breadcrumb} />
      <span className="Z3988 visually-hidden" title={coins} />
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
            {reviewsOf.map((rel: any) => (
              <tr key={`review-of-${rel.work_id}`}>
                <th scope="row">{t('works.detail.labels.reviewOf')}</th>
                <td className="field-value">
                  <LocaleLink className="action-link table-link" href={`/works/${rel.work_id}`}>{describeRelation(rel)}</LocaleLink>
                </td>
              </tr>
            ))}
            {reviewedBy.map((rel: any) => (
              <tr key={`reviewed-by-${rel.publication_id}`}>
                <th scope="row">{t('works.detail.labels.reviewedBy')}</th>
                <td className="field-value">
                  <LocaleLink className="action-link table-link" href={`/works/${rel.work_id}`}>{describeRelation(rel)}</LocaleLink>
                </td>
              </tr>
            ))}
            {venue.name ? (
              <tr>
                <th scope="row">{t('works.detail.labels.venue')}</th>
                <td className="field-value">
                  <LocaleLink className="action-link table-link" href={`/venues/${venue.id}`}>{venue.name}</LocaleLink>
                  {venue.type ? ` (${venue.type})` : ''}
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
            {publisher.name ? (
              <tr>
                <th scope="row">{t('works.detail.labels.publisher')}</th>
                <td className="field-value">
                  {publisher.name}
                  {publisher.type || publisher.country ? ` (${[publisher.type, publisher.country].filter(Boolean).join(' • ')})` : ''}
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
            {citationsTotal > 0 ? (
              <tr>
                <th scope="row">{t('works.detail.labels.citations')}</th>
                <td className="field-value">{formatNumber(citationsTotal, locale)}</td>
              </tr>
            ) : null}
            {referencesTotal > 0 ? (
              <tr>
                <th scope="row">{t('works.detail.labels.references')}</th>
                <td className="field-value">{formatNumber(referencesTotal, locale)}</td>
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
        abstract={(cleanedAbstract || workSubjects.length > 0) ? (
          <>
            {cleanedAbstract ? <p className="description">{cleanedAbstract}</p> : null}
            <SubjectLinks subjects={workSubjects} />
          </>
        ) : null}
        citations={(citationsTotal > 0 || citedBy.length > 0) ? (
          <WorkCitationList workId={id} kind="citations" initialItems={citedBy} total={citationsTotal} />
        ) : null}
        references={(referencesTotal > 0 || refs.length > 0) ? (
          <WorkCitationList workId={id} kind="references" initialItems={refs} total={referencesTotal} />
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
