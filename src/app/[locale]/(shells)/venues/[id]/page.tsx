import { getTranslations } from 'next-intl/server';
import LocaleLink from '@/components/common/LocaleLink';
import { getVenue } from '@/lib/api';
import type { Venue } from '@/lib/api';
import { getVenueWorksPage } from '@/lib/endpoints';
import { formatNumber } from '@/lib/format';
import { buildPageMetadata } from '@/i18n/metadata';
import { getWorkAbstractSnippet, isWorkOpenAccess } from '@/lib/works';

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
          const obj = entry as { display_name?: string; name?: string; label?: string; value?: string };
          return obj.display_name || obj.name || obj.label || obj.value || '';
        }
        return '';
      })
      .map((entry) => entry.trim())
      .filter(Boolean);
    return labels.join(', ');
  }
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const obj = value as { display_name?: string; name?: string; label?: string; value?: string };
    return obj.display_name || obj.name || obj.label || obj.value || '';
  }
  return '';
};

const getVenueDescription = (venue?: Venue | null) => {
  if (!venue) return '';
  return pickText([
    venue.summary_snapshot?.summary,
    venue.summary_snapshot?.description,
    venue.summary_snapshot?.focus,
    venue.description,
    venue.summary
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

export async function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  return buildPageMetadata(props.params, 'metadata.venuesDetail');
}

export default async function VenueDetailPage(props: { params: Promise<{ locale: string; id: string }>; searchParams?: Promise<{ page?: string }> }) {
  const { id, locale } = await props.params;
  let venue = await getVenue(id);
  const sp = (await props.searchParams) || {};
  const page = Number(sp.page || '1') || 1;
  let worksPage: any = null;
  try { worksPage = await getVenueWorksPage(id, page, 25); } catch {}
  const works: any[] = worksPage?.data || worksPage?.results || worksPage?.items || [];
  const pagination: any = worksPage?.pagination || worksPage?.meta?.pagination || {};
  const t = await getTranslations({ locale });

  const hasVenue = !!venue;
  const name = venue?.name ?? t('common.entities.journalNotFound');
  const descriptionText = getVenueDescription(venue);
  const subjectsText = getVenueSubjectsText(venue);

  const metrics = venue?.metrics || venue?.legacy_metrics || null;
  const sjr = (metrics && (metrics as any).sjr) ?? venue?.sjr;
  const snip = (metrics && (metrics as any).snip) ?? venue?.snip;
  const citescore = (metrics && (metrics as any).citescore) ?? venue?.citescore;

  return (
    <div className="page-header" aria-labelledby="page-title">
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
                    {venue.publisher.name}
                    {venue.publisher.country_code ? ` (${venue.publisher.country_code})` : ''}
                  </td>
                </tr>
              ) : null}
              {venue?.issn ? (
                <tr>
                  <th scope="row">{t('venues.detail.issn')}</th>
                  <td className="field-value">{venue.issn}</td>
                </tr>
              ) : null}
              {venue?.eissn && venue.eissn !== venue.issn ? (
                <tr>
                  <th scope="row">{t('venues.detail.eissn')}</th>
                  <td className="field-value">{venue.eissn}</td>
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
              {sjr ? (
                <tr>
                  <th scope="row">{t('venues.detail.sjr')}</th>
                  <td className="field-value">{String(sjr)}</td>
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
            </tbody>
          </table>
        </section>
      )}

      {descriptionText ? (
        <section aria-labelledby="venue-description">
          <h2 className="title-section" id="venue-description">{t('venues.detail.description')}</h2>
          <p className="description">{descriptionText}</p>
        </section>
      ) : null}

      {subjectsText ? (
        <section aria-labelledby="venue-subjects">
          <h2 className="title-section" id="venue-subjects">{t('venues.detail.subjects')}</h2>
          <p className="description">{subjectsText}</p>
        </section>
      ) : null}

      <section aria-labelledby="venue-publications-title">
        <h2 className="title-section" id="venue-publications-title">{t('venues.detail.publications')}</h2>
        <ul className="results-list" id="venue-publications">
          {works.length > 0 ? (
            works.map((pub: any) => {
              const authorsArr = Array.isArray(pub.authors) ? pub.authors : [];
              const year = pub.publication_year || (pub.publication && pub.publication.year) || pub.year || '';
              const type = (pub.work_type || pub.type || '').toString().toUpperCase();
              const abstract = getWorkAbstractSnippet(pub);
              const openAccess = isWorkOpenAccess(pub);
              return (
                <li className="result-item" key={pub.id}>
                  <h3 className="result-title">
                    <LocaleLink href={`/works/${pub.id}`} className="result-link">
                      {pub.title && pub.title.length > 200 ? `${pub.title.slice(0, 200)}…` : (pub.title || t('common.entities.titleUnavailable'))}
                    </LocaleLink>
                  </h3>
                  <p className="result-meta">
                   {openAccess ? <> <span className="badge open-acess">{t('common.meta.openAccess')}</span> • </> : null }
                    <span className="result-authors">
                      {authorsArr.length > 0 ? (
                        authorsArr.slice(0, 2).map((a: any, idx: number) => (
                          <span key={idx}>{typeof a === 'string' ? a : (a?.preferred_name || a?.name)}{idx < Math.min(authorsArr.length, 2) - 1 ? ', ' : ''}</span>
                        ))
                      ) : (
                        t('common.entities.authorUnknown')
                      )}
                    </span>
                    {year ? <span className="result-year"> • {year}</span> : null}
                    {type ? <span className="result-type"> • {type}</span> : null}
                  </p>
                  {abstract ? <p className="result-abstract">{abstract}</p> : null}
                </li>
              );
            })
          ) : (
            <div className="no-results"><p>{t('common.states.noVenueWorks')}</p></div>
          )}
        </ul>
        <nav className="pagination-nav" aria-label={t('common.labels.pagination')}>
          {pagination?.hasPrev || page > 1 ? (
            <LocaleLink className="action-btn btn-negative" href={`?page=${page - 1}`}>{t('common.actions.previous')}</LocaleLink>
          ) : (
            <button type="button" className="pagination-btn btn-negative" disabled>{t('common.actions.previous')}</button>
          )}
          {pagination?.hasNext ? (
            <LocaleLink className="action-btn btn-positive" href={`?page=${page + 1}`}>{t('common.actions.next')}</LocaleLink>
          ) : (
            <button type="button" className="pagination-btn btn-positive" disabled>{t('common.actions.next')}</button>
          )}
        </nav>
      </section>
    </div>
  );
}
