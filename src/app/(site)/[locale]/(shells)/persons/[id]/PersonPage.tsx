import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import LocaleLink from '@/components/common/LocaleLink';
import SectionTabs, { type SectionTabDescriptor } from '@/components/common/SectionTabs';
import EntityTools from '@/components/common/EntityTools';
import { exportFilename } from '@/lib/entity-export';
import SubjectLinks from '@/components/common/SubjectLinks';
import { WorkResultList } from '@/components/common/WorkResultItem';
import { getPersonsWorks, getPersonsWorksFirst, getPersonsWorksProminent } from '@/lib/endpoints';
import { buildIdentifierHref } from '@/lib/identifiers';
import { formatNumber } from '@/lib/format';
import JsonLd from '@/components/common/JsonLd';
import { alternateOpenGraphLocales, buildPageMetadata, fitPageTitle, openGraphLocales, siteOpenGraphImage } from '@/i18n/metadata';
import { composeDescription } from '@/lib/meta-text';
import { SITE_NAME, localeUrl, paginatedPath, resolvePageParam } from '@/lib/site';
import { buildBreadcrumbList, withSitePublisher } from '@/lib/structured-data';
import { type Locale } from '@/i18n/config';

const pickPersonName = (person: any) => person?.preferred_name || [person?.given_names, person?.family_name].filter(Boolean).join(' ');

const getAffiliationsText = (person: any) => String(person?.primary_affiliation?.name || '').trim();

const uniqueList = (items: Array<string | null | undefined>) => Array.from(new Set(items.map((item) => (item ? String(item).trim() : '')).filter(Boolean)));

const personLinks = (ids: any) => uniqueList([
  buildIdentifierHref('orcid', ids?.orcid, 'person'),
  buildIdentifierHref('lattes', ids?.lattes_id, 'person'),
  buildIdentifierHref('scopus', ids?.scopus_id, 'person')
]);

const buildPersonMeta = (person: any, locale: string, id: string) => {
  const name = pickPersonName(person);
  const affiliations = getAffiliationsText(person);
  const identifierList = uniqueList([localeUrl(locale as Locale, `/persons/${id}`), ...personLinks(person?.identifiers)]);
  const other: Record<string, string | string[]> = {};
  if (name) {
    other['dc.title'] = name;
    other['dc.creator'] = name;
  }
  if (affiliations) other['dc.description'] = affiliations;
  if (identifierList.length === 1) other['dc.identifier'] = identifierList[0];
  if (identifierList.length > 1) other['dc.identifier'] = identifierList;
  other['dc.type'] = 'Person';
  return other;
};

export async function generateMetadata(props: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { id, locale } = await props.params;
  const page = resolvePageParam((await props.searchParams).page);
  const base = await buildPageMetadata(Promise.resolve({ locale }), 'metadata.persons', `/persons/${id}`, {
    ogType: 'profile',
    query: page > 1 ? { page } : undefined
  });
  let person: any = null;
  try {
    person = (await getPersonsWorks(id, page, 25)).person;
  } catch {
    return base;
  }
  if (!person) return base;
  const safeLocale = locale as Locale;
  const t = await getTranslations({ locale: safeLocale, namespace: 'metadata.descriptors' });
  const personName = pickPersonName(person);
  const affiliations = getAffiliationsText(person);
  const orcid = person?.identifiers?.orcid;
  const publicUrl = localeUrl(safeLocale, paginatedPath(`/persons/${id}`, page));
  const worksCount = Number(person?.metrics?.works_count) || 0;
  const description = personName
    ? composeDescription(t('personProfile', { name: personName }), [
        affiliations ? t('personAffiliations', { value: affiliations }) : '',
        worksCount > 0 ? t('worksIndexed', { count: worksCount }) : '',
        orcid ? t('personOrcid', { value: String(orcid) }) : '',
        t('personRecord'),
        t('personRecordShort')
      ], { fill: 'max', suffix: page > 1 ? t('pageSuffix', { page }) : '' })
    : '';
  const pageTitle = await fitPageTitle(safeLocale, [personName]);
  const ogTitle = personName || SITE_NAME;
  const ogImage = siteOpenGraphImage();
  const other = buildPersonMeta(person, locale, id);
  return {
    ...base,
    title: pageTitle || base.title,
    description: description || base.description,
    openGraph: {
      title: ogTitle,
      description: description || base.description || '',
      type: 'profile',
      locale: openGraphLocales[safeLocale],
      alternateLocale: alternateOpenGraphLocales(safeLocale),
      url: publicUrl,
      siteName: SITE_NAME,
      images: [ogImage]
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description: description || base.description || '',
      images: [ogImage.url]
    },
    other: { ...(base.other || {}), ...other }
  };
}

export default async function PersonPage(props: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ page?: string }> }) {
  const { id, locale } = await props.params;
  const page = resolvePageParam((await props.searchParams).page);
  const { person, works: recentItems, pagination } = await getPersonsWorks(id, page, 25);
  if (!person || (page > 1 && pagination && !recentItems.length)) notFound();
  const [prominentItems, firstItems] = await Promise.all([
    getPersonsWorksProminent(id, 25),
    getPersonsWorksFirst(id, 25)
  ]);
  const t = await getTranslations({ locale });

  const personName = pickPersonName(person) || t('common.entities.personNotFound');
  const ids = person.identifiers || {};
  const givenNames = person.given_names || '';
  const familyName = person.family_name || '';
  const nameSignature = person.name_signature || '';
  const orcid = ids.orcid || '';
  const lattesId = ids.lattes_id || '';
  const scopusId = ids.scopus_id || '';
  const isVerified = !!person.is_verified;
  const metrics = person.metrics || {};
  const profile = person.authorship_profile || {};
  const personWorksCount = Number(metrics.works_count) || 0;
  const subjectExpertise: any[] = Array.isArray(person.subject_expertise) ? person.subject_expertise : [];
  const expertiseItems = subjectExpertise.map((subject: any) => {
    const works = Number(subject?.works_count) || 0;
    return { term: String(subject?.term || ''), note: works > 0 ? t('common.meta.worksCount', { count: works }) : undefined };
  }).filter((subject) => subject.term);
  const affiliation = person.primary_affiliation?.name ? person.primary_affiliation : null;
  const publicUrl = localeUrl(locale as Locale, `/persons/${id}`);
  const jsonLd: Record<string, any> = withSitePublisher({
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${publicUrl}#person`,
    name: personName,
    url: publicUrl,
    mainEntityOfPage: publicUrl
  });
  const sameAs = personLinks(ids);
  if (sameAs.length) jsonLd.sameAs = sameAs;
  if (affiliation) jsonLd.affiliation = { '@type': 'Organization', name: affiliation.name };

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

  const pageHref = (target: number) => `/persons/${id}${target > 1 ? `?page=${target}` : ''}`;
  const paginationNav = (
    <nav className="pagination-nav" aria-label={t('common.labels.pagination')}>
      {page > 1 ? (
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
      label: t('persons.sections.recent'),
      content: (
        <>
          <WorkResultList items={recentItems} labels={{ ...listLabels, emptyState: t('persons.empty.recent') }} titleMaxLength={200} />
          {paginationNav}
        </>
      )
    },
    {
      key: 'prominent',
      label: t('persons.sections.prominent'),
      content: <WorkResultList items={prominentItems} labels={{ ...listLabels, emptyState: t('persons.empty.prominent') }} titleMaxLength={200} />
    },
    {
      key: 'first',
      label: t('persons.sections.first'),
      content: <WorkResultList items={firstItems} labels={{ ...listLabels, emptyState: t('persons.empty.first') }} titleMaxLength={200} />
    },
    expertiseItems.length > 0 ? {
      key: 'expertise',
      label: t('persons.sections.expertise'),
      content: <SubjectLinks subjects={expertiseItems} filters={{ author: personName }} />
    } : null,
    {
      key: 'tools',
      label: t('persons.sections.tools'),
      content: <EntityTools kind="person" entityId={id} filename={exportFilename('person', person)} worksCount={personWorksCount} entityExportLabel={t('persons.tools.exportPerson')} />
    }
  ].filter(Boolean) as SectionTabDescriptor[];

  return (
    <div className="page-header" aria-labelledby="page-title">
      <JsonLd data={jsonLd} />
      <JsonLd data={buildBreadcrumbList(locale as Locale, [
        { name: t('metadata.breadcrumbs.home'), path: '/' },
        { name: personName, path: `/persons/${id}` }
      ])} />
      <h1 className="page-title" id="page-title">{personName}</h1>

      <section aria-labelledby="person-info">
        <h2 className="title-section" id="person-info">{t('persons.dataSection')}</h2>
        <table className="data-table item-detail-table" id="person-details">
          <tbody>
            <tr>
              <th scope="row">{t('persons.fields.id')}</th>
              <td className="field-value">{id}</td>
            </tr>
            {personName ? (
              <tr>
                <th scope="row">{t('persons.fields.name').toUpperCase()}</th>
                <td className="field-value">{personName}</td>
              </tr>
            ) : null}
            {givenNames ? (
              <tr>
                <th scope="row">{t('persons.fields.given').toUpperCase()}</th>
                <td className="field-value">{givenNames}</td>
              </tr>
            ) : null}
            {familyName ? (
              <tr>
                <th scope="row">{t('persons.fields.family').toUpperCase()}</th>
                <td className="field-value">{familyName}</td>
              </tr>
            ) : null}
            {nameSignature ? (
              <tr>
                <th scope="row">{t('persons.fields.signature').toUpperCase()}</th>
                <td className="field-value">{nameSignature}</td>
              </tr>
            ) : null}
            {affiliation ? (
              <tr>
                <th scope="row">{t('persons.fields.affiliations').toUpperCase()}</th>
                <td className="field-value">
                  <LocaleLink prefetch={false} className="action-link table-link" href={`/institutions/${affiliation.id}`}>{affiliation.name}</LocaleLink>
                </td>
              </tr>
            ) : null}
            {orcid ? (
              <tr>
                <th scope="row">{t('persons.fields.orcid').toUpperCase()}</th>
                <td className="field-value"><a className="action-link table-link" href={buildIdentifierHref('orcid', orcid, 'person') || undefined} target="_blank" rel="noopener noreferrer">{orcid}</a></td>
              </tr>
            ) : null}
            {lattesId ? (
              <tr>
                <th scope="row">{t('persons.fields.lattes').toUpperCase()}</th>
                <td className="field-value"><a className="action-link table-link" href={buildIdentifierHref('lattes', lattesId, 'person') || undefined} target="_blank" rel="noopener noreferrer">{lattesId}</a></td>
              </tr>
            ) : null}
            {scopusId ? (
              <tr>
                <th scope="row">{t('persons.fields.scopus').toUpperCase()}</th>
                <td className="field-value"><a className="action-link table-link" href={buildIdentifierHref('scopus', scopusId, 'person') || undefined} target="_blank" rel="noopener noreferrer">{scopusId}</a></td>
              </tr>
            ) : null}
            <tr>
              <th scope="row">{t('persons.fields.verified').toUpperCase()}</th>
              <td className="field-value">{isVerified ? t('common.values.yes') : t('common.values.no')}</td>
            </tr>
            {typeof metrics?.works_count === 'number' ? (
              <tr>
                <th scope="row">{t('persons.fields.totalWorks').toUpperCase()}</th>
                <td className="field-value">{formatNumber(metrics.works_count, locale)}</td>
              </tr>
            ) : null}
            {typeof profile?.total_citations === 'number' ? (
              <tr>
                <th scope="row">{t('persons.fields.totalCitations').toUpperCase()}</th>
                <td className="field-value">{formatNumber(profile.total_citations, locale)}</td>
              </tr>
            ) : null}
            {typeof profile?.author_count === 'number' ? (
              <tr>
                <th scope="row">{t('persons.fields.authorCount').toUpperCase()}</th>
                <td className="field-value">{formatNumber(profile.author_count, locale)}</td>
              </tr>
            ) : null}
            {typeof profile?.editor_count === 'number' ? (
              <tr>
                <th scope="row">{t('persons.fields.editorCount').toUpperCase()}</th>
                <td className="field-value">{formatNumber(profile.editor_count, locale)}</td>
              </tr>
            ) : null}
            {typeof profile?.first_publication_year === 'number' ? (
              <tr>
                <th scope="row">{t('persons.fields.firstYear').toUpperCase()}</th>
                <td className="field-value">{profile.first_publication_year}</td>
              </tr>
            ) : null}
            {typeof profile?.latest_publication_year === 'number' ? (
              <tr>
                <th scope="row">{t('persons.fields.latestYear').toUpperCase()}</th>
                <td className="field-value">{profile.latest_publication_year}</td>
              </tr>
            ) : null}
            {typeof profile?.h_index === 'number' ? (
              <tr>
                <th scope="row">{t('persons.fields.hIndex').toUpperCase()}</th>
                <td className="field-value">{formatNumber(profile.h_index, locale)}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
        </section>

      <SectionTabs ariaLabel={t('persons.sections.navLabel')} tabs={tabs} />
    </div>
  );
}
