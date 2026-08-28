import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import LocaleLink from '@/components/common/LocaleLink';
import SectionTabs, { type SectionTabDescriptor } from '@/components/common/SectionTabs';
import EntityTools from '@/components/common/EntityTools';
import { WorkResultList, type WorkResultLabels } from '@/components/common/WorkResultItem';
import { getSubject, getSubjectWorksByTerm, getSubjectWorksPage } from '@/lib/endpoints';
import { subjectTerm } from '@/lib/subjects';
import { formatNumber } from '@/lib/format';
import JsonLd from '@/components/common/JsonLd';
import { buildPageMetadata } from '@/i18n/metadata';
import { localeUrl, paginatedPath, resolvePageParam } from '@/lib/site';
import { buildBreadcrumbList, withSitePublisher } from '@/lib/structured-data';
import type { Locale } from '@/i18n/config';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(props: {
  params: Promise<{ locale: string; id: string }>;
  searchParams?: Promise<{ page?: string }>;
}) {
  const { id, locale } = await props.params;
  const page = resolvePageParam((await props.searchParams)?.page);
  const base = await buildPageMetadata(Promise.resolve({ locale }), 'metadata.subjectsDetail', `/subjects/${id}`, {
    query: page > 1 ? { page } : undefined
  });
  let subject: any = null;
  try {
    subject = await getSubject(id);
  } catch {
    return base;
  }
  if (!subject) return base;
  const term = subjectTerm(subject, locale);
  if (!term) return base;
  const t = await getTranslations({ locale, namespace: 'metadata.descriptors' });
  const description = [t('subjectDetail', { term }), page > 1 ? t('pageSuffix', { page }) : '']
    .filter(Boolean)
    .join(' ');
  const canonicalUrl = localeUrl(locale as Locale, paginatedPath(`/subjects/${id}`, page));
  return {
    ...base,
    title: term,
    description,
    openGraph: base.openGraph ? { ...base.openGraph, title: term, description, url: canonicalUrl } : undefined,
    twitter: { ...(base.twitter || {}), title: term, description }
  };
}

export default async function SubjectDetailPage(props: { params: Promise<{ locale: string; id: string }>; searchParams?: Promise<{ page?: string }> }) {
  const { id, locale } = await props.params;
  const subject = await getSubject(id);
  if (!subject) notFound();
  const sp = (await props.searchParams) || {};
  const page = Number(sp.page || '1') || 1;
  const limit = 25;

  const canonicalTerm = subject.term || '';
  const [worksPage, prominentItems, firstItems] = await Promise.all([
    getSubjectWorksPage(id, page, limit).catch(() => null),
    getSubjectWorksByTerm(canonicalTerm, limit, { sortBy: 'cited_by_count', sortOrder: 'desc', citedByMin: 1 }),
    getSubjectWorksByTerm(canonicalTerm, limit, { sortBy: 'publication_year', sortOrder: 'asc' })
  ]);
  const works: any[] = worksPage?.data || [];
  const pagination: any = worksPage?.pagination || {};

  const t = await getTranslations({ locale });
  const term = subjectTerm(subject, locale) || t('common.entities.nameUnavailable');
  const vocabulary = subject.vocabulary || '';
  const subjectType = subject.subject_type || '';
  const worksCount = subject.works_count;
  const coursesCount = subject.courses_count;
  const childrenCount = subject.children_count;
  const parentId = subject.parent_id;
  const parentTerm = subject.parent_term || '';

  const listLabels: WorkResultLabels = {
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

  const canonical = localeUrl(locale as Locale, `/subjects/${id}`);
  const jsonLd: Record<string, any> = withSitePublisher({
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    '@id': `${canonical}#term`,
    name: term,
    url: canonical,
    mainEntityOfPage: canonical
  });
  if (vocabulary) jsonLd.inDefinedTermSet = vocabulary;

  const toYear = (value: any): number => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const recentItems = [...works].sort((a: any, b: any) => toYear(b?.publication_year || b?.year) - toYear(a?.publication_year || a?.year));

  const pageHref = (target: number) => `/subjects/${id}${target > 1 ? `?page=${target}` : ''}`;
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
      label: t('subjects.sections.recent'),
      content: (
        <>
          <WorkResultList items={recentItems} labels={{ ...listLabels, emptyState: t('subjects.empty.recent') }} showAuthors={false} showVenue={false} />
          {works.length > 0 ? paginationNav : null}
        </>
      )
    },
    {
      key: 'prominent',
      label: t('subjects.sections.prominent'),
      content: <WorkResultList items={prominentItems} labels={{ ...listLabels, emptyState: t('subjects.empty.prominent') }} />
    },
    {
      key: 'first',
      label: t('subjects.sections.first'),
      content: <WorkResultList items={firstItems} labels={{ ...listLabels, emptyState: t('subjects.empty.first') }} />
    },
    {
      key: 'tools',
      label: t('subjects.sections.tools'),
      content: <EntityTools kind="subject" entity={subject} worksCount={Number(worksCount) || 0} entityExportLabel={t('subjects.tools.exportSubject')} />
    }
  ];

  return (
    <div className="page-header" aria-labelledby="page-title">
      <JsonLd data={jsonLd} />
      <JsonLd data={buildBreadcrumbList(locale as Locale, [
        { name: t('metadata.breadcrumbs.home'), path: '/' },
        { name: term, path: `/subjects/${id}` }
      ])} />
      <h1 className="page-title" id="page-title">{term}</h1>

      <section aria-labelledby="subject-info">
        <h2 className="title-section" id="subject-info">{t('subjects.detail.data')}</h2>
        <table className="data-table item-detail-table" id="subject-details">
          <tbody>
            {vocabulary ? (
              <tr>
                <th scope="row">{t('subjects.detail.vocabulary')}</th>
                <td className="field-value">{vocabulary}{subjectType ? ` (${subjectType})` : ''}</td>
              </tr>
            ) : null}
            {typeof worksCount === 'number' ? (
              <tr>
                <th scope="row">{t('subjects.detail.works')}</th>
                <td className="field-value">{formatNumber(worksCount)}</td>
              </tr>
            ) : null}
            {typeof coursesCount === 'number' && coursesCount > 0 ? (
              <tr>
                <th scope="row">{t('subjects.detail.courses')}</th>
                <td className="field-value">{formatNumber(coursesCount)}</td>
              </tr>
            ) : null}
            {typeof childrenCount === 'number' && childrenCount > 0 ? (
              <tr>
                <th scope="row">{t('subjects.detail.children')}</th>
                <td className="field-value">{formatNumber(childrenCount)}</td>
              </tr>
            ) : null}
            {parentId && parentTerm ? (
              <tr>
                <th scope="row">{t('subjects.detail.parent')}</th>
                <td className="field-value">
                  <LocaleLink className="action-link table-link" href={`/subjects/${parentId}`}>{parentTerm}</LocaleLink>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <SectionTabs ariaLabel={t('subjects.sections.navLabel')} tabs={tabs} />
    </div>
  );
}
