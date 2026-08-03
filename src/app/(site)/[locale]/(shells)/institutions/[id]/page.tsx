import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import LocaleLink from '@/components/common/LocaleLink';
import SectionTabs, { type SectionTabDescriptor } from '@/components/common/SectionTabs';
import EntityTools from '@/components/common/EntityTools';
import WorkRelatedList from '../../works/[id]/WorkRelatedList';
import { getInstitution, getInstitutionWorks } from '@/lib/endpoints';
import { buildIdentifierHref } from '@/lib/identifiers';
import { formatMetadataAuthors } from '@/lib/works';
import { formatNumber } from '@/lib/format';
import { buildPageMetadata, metadataBase } from '@/i18n/metadata';
import { localizedPath } from '@/i18n/paths';
import type { Locale } from '@/i18n/config';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(props: { params: Promise<{ locale: string; id: string }> }) {
  const { id, locale } = await props.params;
  const base = await buildPageMetadata(Promise.resolve({ locale }), 'metadata.institutionsDetail', `/institutions/${id}`);
  let institution: any = null;
  try {
    institution = await getInstitution(id);
  } catch {
    return base;
  }
  if (!institution) return base;
  const name = institution.name || base.title;
  const canonicalUrl = new URL(localizedPath(locale as Locale, `/institutions/${id}`), metadataBase).toString();
  return {
    ...base,
    title: name || base.title,
    alternates: { canonical: canonicalUrl, languages: base.alternates?.languages }
  };
}

export default async function InstitutionDetailPage(props: { params: Promise<{ locale: string; id: string }>; searchParams?: Promise<{ page?: string }> }) {
  const { id, locale } = await props.params;
  const institution = await getInstitution(id);
  if (!institution) notFound();
  const sp = (await props.searchParams) || {};
  const page = Number(sp.page || '1') || 1;
  const limit = 25;
  const fundedCount = Number(institution?.funding_role?.funded_works_count) || 0;

  const [worksPage, prominentPage, firstPage, fundedPage] = await Promise.all([
    getInstitutionWorks(id, page, limit).catch(() => null),
    getInstitutionWorks(id, 1, limit, { sortBy: 'cited_by_count', sortOrder: 'DESC' }).catch(() => null),
    getInstitutionWorks(id, 1, limit, { sortBy: 'publication_year', sortOrder: 'ASC' }).catch(() => null),
    fundedCount > 0 ? getInstitutionWorks(id, 1, limit, { funded: true }).catch(() => null) : Promise.resolve(null)
  ]);
  const works: any[] = worksPage?.data || [];
  const pagination: any = worksPage?.pagination || {};
  const prominentWorks: any[] = prominentPage?.data || [];
  const firstWorks: any[] = firstPage?.data || [];
  const fundedWorks: any[] = fundedPage?.data || [];

  const t = await getTranslations({ locale });

  const name = institution.name || t('common.entities.institutionNotFound');
  const type = institution.openalex_type || institution.type || '';
  const status = institution.status || '';
  const country = institution.country_code || '';
  const city = institution.city || '';
  const worksCount = institution.works_count;
  const researchers = institution.researchers_count;
  const citations = institution.total_citations;
  const hIndex = institution.h_index;
  const i10 = institution.i10_index;
  const firstYear = institution.first_publication_year;
  const latestYear = institution.latest_publication_year;
  const rorId = institution.ror_id;
  const gridId = institution.grid_id;
  const wikidataId = institution.wikidata_id;
  const openalexId = institution.openalex_id;
  const website = institution.homepage_url;
  const grants = Number(institution?.funding_role?.grants_count) || 0;
  const altNames: string[] = Array.isArray(institution?.names?.alternative_names) ? institution.names.alternative_names.filter(Boolean) : [];
  const byType: any[] = Array.isArray(institution?.production_summary?.by_work_type) ? institution.production_summary.by_work_type : [];
  const trend: any[] = Array.isArray(institution?.production_summary?.publication_trend) ? institution.production_summary.publication_trend : [];
  const topAuthors: any[] = Array.isArray(institution?.top_authors) ? institution.top_authors : [];
  const relationships = institution?.relationships || {};
  const relatedGroups: Array<{ key: string; label: string; rows: any[] }> = [
    { key: 'parents', label: t('institutions.detail.parents'), rows: Array.isArray(relationships.parents) ? relationships.parents : [] },
    { key: 'children', label: t('institutions.detail.children'), rows: Array.isArray(relationships.children) ? relationships.children : [] },
    { key: 'related', label: t('institutions.detail.related'), rows: Array.isArray(relationships.related) ? relationships.related : [] }
  ].filter((group) => group.rows.length > 0);

  const relatedLabels = {
    titleUnavailable: t('common.entities.titleUnavailable'),
    authorUnknown: t('common.entities.authorUnknown'),
    openAccess: t('common.meta.openAccess'),
    addToList: t('common.actions.addToList'),
    inList: t('common.actions.inList'),
    removeFromList: t('common.actions.removeFromList'),
    added: t('common.messages.added'),
    itemRemoved: t('common.messages.itemRemoved'),
    citedBy: t('common.meta.citedBy'),
    references: t('common.meta.references')
  };
  const pickAuthors = (item: any) => formatMetadataAuthors(item);

  const canonical = new URL(localizedPath(locale as Locale, `/institutions/${id}`), metadataBase).toString();
  const jsonLd: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name,
    url: canonical,
    mainEntityOfPage: canonical
  };
  if (website) jsonLd.sameAs = [website, wikidataId ? `https://www.wikidata.org/wiki/${wikidataId}` : '', openalexId ? `https://openalex.org/${openalexId}` : ''].filter(Boolean);
  if (city || country) jsonLd.location = { '@type': 'Place', address: [city, country].filter(Boolean).join(', ') };

  const pageHref = (target: number) => `/institutions/${id}${target > 1 ? `?page=${target}` : ''}`;
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

  const tabs: SectionTabDescriptor[] = [
    {
      key: 'recent',
      label: t('institutions.sections.recent'),
      content: (
        <>
          <WorkRelatedList items={works} pickAuthors={pickAuthors} labels={{ ...relatedLabels, emptyState: t('institutions.empty.recent') }} />
          {works.length > 0 ? paginationNav : null}
        </>
      )
    },
    {
      key: 'prominent',
      label: t('institutions.sections.prominent'),
      content: <WorkRelatedList items={prominentWorks} pickAuthors={pickAuthors} labels={{ ...relatedLabels, emptyState: t('institutions.empty.prominent') }} />
    },
    {
      key: 'first',
      label: t('institutions.sections.first'),
      content: <WorkRelatedList items={firstWorks} pickAuthors={pickAuthors} labels={{ ...relatedLabels, emptyState: t('institutions.empty.first') }} />
    },
    fundedCount > 0 ? {
      key: 'funded',
      label: t('institutions.sections.funded'),
      content: <WorkRelatedList items={fundedWorks} pickAuthors={pickAuthors} labels={{ ...relatedLabels, emptyState: t('institutions.empty.funded') }} />
    } : null,
    topAuthors.length > 0 ? {
      key: 'authors',
      label: t('institutions.sections.authors'),
      content: (
        <ul className="results-list">
          {topAuthors.map((author: any, idx: number) => (
            <li className="result-item" key={author?.person_id || idx}>
              <h3 className="result-title">
                {author?.person_id ? (
                  <LocaleLink className="result-link" href={`/persons/${author.person_id}`}>{author?.preferred_name || author?.name || t('common.entities.authorUnknown')}</LocaleLink>
                ) : (
                  <span className="field-value">{author?.preferred_name || author?.name || t('common.entities.authorUnknown')}</span>
                )}
              </h3>
              <p className="result-meta">
                <span className="result-total">{t('institutions.detail.works')}: {formatNumber(Number(author?.works_count) || 0)}</span>
                {author?.latest_publication_year ? (
                  <>
                    <span className="meta-separator" aria-hidden="true"> • </span>
                    <span className="result-year">{author.latest_publication_year}</span>
                  </>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      )
    } : null,
    (byType.length > 0 || trend.length > 0) ? {
      key: 'production',
      label: t('institutions.sections.production'),
      content: (
        <div>
          {byType.length > 0 ? (
            <table className="data-table item-detail-table">
              <tbody>
                {byType.map((row: any, idx: number) => (
                  <tr key={`type-${idx}`}>
                    <th scope="row">{String(row?.type || '').toUpperCase()}</th>
                    <td className="field-value">{formatNumber(Number(row?.works_count) || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          {trend.length > 0 ? (
            <table className="data-table item-detail-table">
              <tbody>
                {trend.slice(0, 15).map((row: any, idx: number) => (
                  <tr key={`trend-${idx}`}>
                    <th scope="row">{row?.year}</th>
                    <td className="field-value">{formatNumber(Number(row?.works_count) || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      )
    } : null,
    relatedGroups.length > 0 ? {
      key: 'related',
      label: t('institutions.sections.related'),
      content: (
        <div>
          {relatedGroups.map((group) => (
            <section key={group.key} aria-label={group.label}>
              <h3 className="title-section">{group.label}</h3>
              <ul className="results-list">
                {group.rows.map((row: any, idx: number) => (
                  <li className="result-item" key={row?.id || idx}>
                    <h4 className="result-title">
                      {row?.id ? (
                        <LocaleLink className="result-link" href={`/institutions/${row.id}`}>{row?.name || t('common.entities.nameUnavailable')}</LocaleLink>
                      ) : (
                        <span className="field-value">{row?.name || t('common.entities.nameUnavailable')}</span>
                      )}
                    </h4>
                    {row?.country_code ? <p className="result-meta"><span className="result-country">{String(row.country_code).toUpperCase()}</span></p> : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )
    } : null,
    {
      key: 'tools',
      label: t('institutions.sections.tools'),
      content: <EntityTools kind="institution" entity={institution} works={works} entityExportLabel={t('institutions.tools.exportInstitution')} />
    }
  ].filter(Boolean) as SectionTabDescriptor[];

  return (
    <div className="page-header" aria-labelledby="page-title">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h1 className="page-title" id="page-title">{name}</h1>

      <section aria-labelledby="institution-info">
        <h2 className="title-section" id="institution-info">{t('institutions.detail.data')}</h2>
        <table className="data-table item-detail-table" id="institution-details">
          <tbody>
            {type ? (
              <tr>
                <th scope="row">{t('institutions.detail.type')}</th>
                <td className="field-value">{String(type).toUpperCase()}{status ? ` (${status})` : ''}</td>
              </tr>
            ) : null}
            {city || country ? (
              <tr>
                <th scope="row">{t('institutions.detail.country')}</th>
                <td className="field-value">{[city, country ? String(country).toUpperCase() : ''].filter(Boolean).join(', ')}</td>
              </tr>
            ) : null}
            {typeof worksCount === 'number' ? (
              <tr>
                <th scope="row">{t('institutions.detail.works')}</th>
                <td className="field-value">{formatNumber(worksCount)}</td>
              </tr>
            ) : null}
            {typeof researchers === 'number' && researchers > 0 ? (
              <tr>
                <th scope="row">{t('institutions.detail.researchers')}</th>
                <td className="field-value">{formatNumber(researchers)}</td>
              </tr>
            ) : null}
            {typeof citations === 'number' && citations > 0 ? (
              <tr>
                <th scope="row">{t('institutions.detail.citations')}</th>
                <td className="field-value">{formatNumber(citations)}</td>
              </tr>
            ) : null}
            {typeof hIndex === 'number' && hIndex > 0 ? (
              <tr>
                <th scope="row">{t('institutions.detail.hIndex')}</th>
                <td className="field-value">{hIndex}</td>
              </tr>
            ) : null}
            {typeof i10 === 'number' && i10 > 0 ? (
              <tr>
                <th scope="row">{t('institutions.detail.i10Index')}</th>
                <td className="field-value">{i10}</td>
              </tr>
            ) : null}
            {firstYear && latestYear ? (
              <tr>
                <th scope="row">{t('institutions.detail.coverage')}</th>
                <td className="field-value">{firstYear} - {latestYear}</td>
              </tr>
            ) : null}
            {fundedCount > 0 ? (
              <tr>
                <th scope="row">{t('institutions.detail.fundedWorks')}</th>
                <td className="field-value">{formatNumber(fundedCount)}{grants > 0 ? ` (${t('institutions.detail.grants')}: ${formatNumber(grants)})` : ''}</td>
              </tr>
            ) : null}
            {rorId ? (
              <tr>
                <th scope="row">{t('institutions.detail.ror')}</th>
                <td className="field-value"><a className="action-link table-link" href={buildIdentifierHref('ror', rorId, 'institution') || undefined} target="_blank" rel="noopener noreferrer">{rorId}</a></td>
              </tr>
            ) : null}
            {gridId ? (
              <tr>
                <th scope="row">{t('institutions.detail.grid')}</th>
                <td className="field-value">{gridId}</td>
              </tr>
            ) : null}
            {wikidataId ? (
              <tr>
                <th scope="row">{t('institutions.detail.wikidata')}</th>
                <td className="field-value"><a className="action-link table-link" href={buildIdentifierHref('wikidata', wikidataId, 'institution') || undefined} target="_blank" rel="noopener noreferrer">{wikidataId}</a></td>
              </tr>
            ) : null}
            {openalexId ? (
              <tr>
                <th scope="row">{t('institutions.detail.openAlex')}</th>
                <td className="field-value"><a className="action-link table-link" href={buildIdentifierHref('openalex', openalexId, 'institution') || undefined} target="_blank" rel="noopener noreferrer">{openalexId}</a></td>
              </tr>
            ) : null}
            {website ? (
              <tr>
                <th scope="row">{t('institutions.detail.website')}</th>
                <td className="field-value"><a className="action-link table-link" href={website} target="_blank" rel="noopener noreferrer">{website}</a></td>
              </tr>
            ) : null}
            {altNames.length > 0 ? (
              <tr>
                <th scope="row">{t('institutions.detail.alternativeNames')}</th>
                <td className="field-value">{altNames.join('; ')}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <SectionTabs ariaLabel={t('institutions.sections.navLabel')} tabs={tabs} />
    </div>
  );
}
