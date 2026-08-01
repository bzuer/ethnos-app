import { getTranslations } from 'next-intl/server';
import LocaleLink from '@/components/common/LocaleLink';
import { getSubjectsStatistics, getVenuesStatistics } from '@/lib/endpoints';
import { formatNumber } from '@/lib/format';
import { buildPageMetadata } from '@/i18n/metadata';

export const dynamic = 'force-static';
export const revalidate = false;

export async function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  return buildPageMetadata(props.params, 'metadata.explore', '/explore');
}

export default async function ExplorePage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  const t = await getTranslations({ locale });
  const [venueStats, subjectStats]: [any, any] = await Promise.all([
    getVenuesStatistics(),
    getSubjectsStatistics()
  ]);

  const num = (value: any) => (typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0);
  const impact = venueStats?.avg_impact_factor;
  const topSubjects: any[] = Array.isArray(subjectStats?.top_subjects) ? subjectStats.top_subjects : [];

  const venueRows: Array<[string, string]> = venueStats ? [
    [t('explore.venues.total'), formatNumber(num(venueStats.total_venues))],
    [t('explore.venues.journals'), formatNumber(num(venueStats.journals))],
    [t('explore.venues.doaj'), formatNumber(num(venueStats.indexed_in_doaj))],
    [t('explore.venues.scielo'), formatNumber(num(venueStats.indexed_in_scielo))],
    [t('explore.venues.scopus'), formatNumber(num(venueStats.indexed_in_scopus))],
    ...(impact ? [[t('explore.venues.avgImpact'), String(Number(impact).toFixed(2))]] as Array<[string, string]> : [])
  ] : [];

  const subjectRows: Array<[string, string]> = subjectStats ? [
    [t('subjects.overview.total'), formatNumber(num(subjectStats.total_subjects))],
    [t('subjects.overview.relations'), formatNumber(num(subjectStats.total_work_subject_relations))],
    [t('subjects.overview.vocabularies'), formatNumber(num(subjectStats.vocabularies_count))]
  ] : [];

  return (
    <div className="page-header" aria-labelledby="page-title">
      <h1 className="page-title" id="page-title">{t('explore.title')}</h1>
      <p className="description">{t('explore.intro')}</p>

      {venueRows.length > 0 ? (
        <section aria-labelledby="explore-venues">
          <h2 className="title-section" id="explore-venues">{t('explore.venuesHeading')}</h2>
          <table className="data-table item-detail-table">
            <tbody>
              {venueRows.map(([label, value]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td className="field-value">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="action-links">
            <LocaleLink className="action-btn" href="/venues">{t('explore.browseVenues')}</LocaleLink>
          </div>
        </section>
      ) : null}

      {subjectRows.length > 0 ? (
        <section aria-labelledby="explore-subjects">
          <h2 className="title-section" id="explore-subjects">{t('explore.subjectsHeading')}</h2>
          <table className="data-table item-detail-table">
            <tbody>
              {subjectRows.map(([label, value]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td className="field-value">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {topSubjects.length > 0 ? (
            <ul className="results-list">
              {topSubjects.slice(0, 15).map((subject: any, idx: number) => {
                const sid = subject?.id ?? subject?.subject_id;
                const term = subject?.term || subject?.display_name || t('common.entities.nameUnavailable');
                const worksCount = Number(subject?.works_count) || 0;
                return (
                  <li className="result-item" key={sid || idx}>
                    <h3 className="result-title">
                      {sid ? (
                        <LocaleLink className="result-link" href={`/subjects/${sid}`}>{term}</LocaleLink>
                      ) : (
                        <span className="field-value">{term}</span>
                      )}
                    </h3>
                    {worksCount > 0 ? (
                      <p className="result-meta"><span className="result-total">{t('common.meta.worksCount', { count: worksCount })}</span></p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
          <div className="action-links">
            <LocaleLink className="action-btn" href="/subjects">{t('explore.browseSubjects')}</LocaleLink>
          </div>
        </section>
      ) : null}
    </div>
  );
}
