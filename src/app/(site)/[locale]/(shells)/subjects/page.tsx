import { getTranslations } from 'next-intl/server';
import LocaleLink from '@/components/common/LocaleLink';
import { getSubjectsStatistics } from '@/lib/endpoints';
import { formatNumber } from '@/lib/format';
import { buildPageMetadata } from '@/i18n/metadata';

export const dynamic = 'force-static';
export const revalidate = false;

export async function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  return buildPageMetadata(props.params, 'metadata.subjects', '/subjects');
}

export default async function SubjectsPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  const t = await getTranslations({ locale });
  const stats: any = await getSubjectsStatistics();
  const topSubjects: any[] = Array.isArray(stats?.top_subjects) ? stats.top_subjects : [];
  const totalSubjects = Number(stats?.total_subjects) || 0;
  const totalRelations = Number(stats?.total_work_subject_relations) || 0;
  const vocabularies = Number(stats?.vocabularies_count) || 0;

  return (
    <div className="page-header" aria-labelledby="page-title">
      <h1 className="page-title" id="page-title">{t('subjects.title')}</h1>
      <p className="description">{t('subjects.intro')}</p>

      {totalSubjects > 0 ? (
        <section aria-labelledby="subjects-overview">
          <h2 className="title-section" id="subjects-overview">{t('subjects.overviewHeading')}</h2>
          <table className="data-table item-detail-table">
            <tbody>
              <tr>
                <th scope="row">{t('subjects.overview.total')}</th>
                <td className="field-value">{formatNumber(totalSubjects)}</td>
              </tr>
              <tr>
                <th scope="row">{t('subjects.overview.relations')}</th>
                <td className="field-value">{formatNumber(totalRelations)}</td>
              </tr>
              <tr>
                <th scope="row">{t('subjects.overview.vocabularies')}</th>
                <td className="field-value">{formatNumber(vocabularies)}</td>
              </tr>
            </tbody>
          </table>
        </section>
      ) : null}

      <section aria-labelledby="subjects-top">
        <h2 className="title-section" id="subjects-top">{t('subjects.topHeading')}</h2>
        {topSubjects.length > 0 ? (
          <ul className="results-list">
            {topSubjects.map((subject: any, idx: number) => {
              const sid = subject?.id ?? subject?.subject_id;
              const term = subject?.term || subject?.display_name || t('common.entities.nameUnavailable');
              const worksCount = Number(subject?.works_count) || 0;
              const vocab = subject?.vocabulary || '';
              return (
                <li className="result-item" key={sid || idx}>
                  <h3 className="result-title">
                    {sid ? (
                      <LocaleLink className="result-link" href={`/subjects/${sid}`}>{term}</LocaleLink>
                    ) : (
                      <span className="field-value">{term}</span>
                    )}
                  </h3>
                  <p className="result-meta">
                    {worksCount > 0 ? <span className="result-total">{t('common.meta.worksCount', { count: worksCount })}</span> : null}
                    {vocab ? (
                      <>
                        <span className="meta-separator" aria-hidden="true">•</span>
                        <span className="result-type">{vocab}</span>
                      </>
                    ) : null}
                  </p>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="result-meta">{t('subjects.empty.top')}</p>
        )}
      </section>
    </div>
  );
}
