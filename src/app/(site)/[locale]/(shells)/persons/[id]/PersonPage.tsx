import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import LocaleLink from '@/components/common/LocaleLink';
import SectionTabs, { type SectionTabDescriptor } from '@/components/common/SectionTabs';
import EntityTools from '@/components/common/EntityTools';
import SubjectLinks from '@/components/common/SubjectLinks';
import PersonWorksList from './PersonWorksList';
import { getPersonsWorks, getPersonsWorksFirst, getPersonsWorksProminent } from '@/lib/endpoints';
import { mergeWorkLists } from '@/lib/entity-export';
import { buildIdentifierHref } from '@/lib/identifiers';
import { buildPageMetadata } from '@/i18n/metadata';
import { localizedPath } from '@/i18n/paths';
import { locales, type Locale } from '@/i18n/config';

const pickPersonName = (person: any) => {
  if (!person) return '';
  return person?.preferred_name || person?.name || [person?.given_names, person?.family_name].filter(Boolean).join(' ');
};

const getAffiliationsText = (person: any) => {
  const affiliationsRaw: any = person?.affiliations || person?.affiliation || person?.current_affiliation || [];
  const affiliations: string[] = Array.isArray(affiliationsRaw)
    ? affiliationsRaw.map((a: any) => {
        if (!a) return '';
        if (typeof a === 'string') return a;
        const org = a.organization || a.org || a.name || a.institution || '';
        const role = a.role || a.position || '';
        return [org, role].filter(Boolean).join(' — ');
      }).filter(Boolean)
    : [
        typeof affiliationsRaw === 'string'
          ? affiliationsRaw
          : [
              affiliationsRaw?.organization || affiliationsRaw?.org || affiliationsRaw?.name || affiliationsRaw?.institution || '',
              affiliationsRaw?.role || affiliationsRaw?.position || '',
            ].filter(Boolean).join(' — '),
      ].filter(Boolean);
  return affiliations.join('; ');
};

const uniqueList = (items: Array<string | null | undefined>) => Array.from(new Set(items.map((item) => (item ? String(item).trim() : '')).filter(Boolean)));

const openGraphLocaleMap: Record<string, string> = {
  en: 'en_US',
  pt: 'pt_BR',
  es: 'es_ES'
};

const buildPersonMeta = (person: any, locale: string, id: string) => {
  const name = pickPersonName(person);
  const ids = person?.identifiers || {};
  const orcid = ids?.orcid || person?.orcid;
  const wikidataId = ids?.wikidata_id || person?.wikidata_id;
  const openalexId = ids?.openalex_id || person?.openalex_id;
  const scopusId = ids?.scopus_id || person?.scopus_id;
  const lattesId = ids?.lattes_id || person?.lattes_id;
  const homepageUrl = ids?.url || person?.url;
  const publicUrl = `https://ethnos.app${localizedPath(locale as Locale, `/persons/${id}`)}`;
  const affiliations = getAffiliationsText(person);
  const identifierList = uniqueList([
    publicUrl,
    homepageUrl,
    orcid ? `https://orcid.org/${String(orcid)}` : '',
    wikidataId ? `https://www.wikidata.org/wiki/${String(wikidataId)}` : '',
    openalexId ? `https://openalex.org/${String(openalexId)}` : '',
    scopusId ? String(scopusId) : '',
    lattesId ? String(lattesId) : ''
  ]);
  const other: Record<string, string | string[]> = {};
  if (name) {
    other.citation_title = name;
    other.citation_author = name;
  }
  if (publicUrl) other.citation_public_url = publicUrl;
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

const toYearNumber = (value: any): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const toTimestamp = (value: any): number => {
  if (!value) return 0;
  const t = Date.parse(String(value));
  return Number.isFinite(t) ? t : 0;
};

const sortByRecency = (items: any[]): any[] => {
  return [...items].sort((a: any, b: any) => {
    const yearB = toYearNumber(b?.publication_year || b?.publication?.year || b?.year);
    const yearA = toYearNumber(a?.publication_year || a?.publication?.year || a?.year);
    if (yearB !== yearA) return yearB - yearA;
    return toTimestamp(b?.created_at) - toTimestamp(a?.created_at);
  });
};


export async function generateMetadata(props: { params: Promise<{ locale: string; id: string }> }) {
  const { id, locale } = await props.params;
  const base = await buildPageMetadata(Promise.resolve({ locale }), 'metadata.persons', `/persons/${id}`);
  let data: any = null;
  try {
    data = await getPersonsWorks(id, 1, 25);
  } catch {
    return base;
  }
  const person = data?.person || null;
  if (!person) return base;
  const personName = pickPersonName(person);
  const affiliations = getAffiliationsText(person);
  const ids = person?.identifiers || {};
  const orcid = ids?.orcid || person?.orcid;
  const publicPath = localizedPath(locale as Locale, `/persons/${id}`);
  const publicUrl = `https://ethnos.app${publicPath}`;
  const descriptionParts = [
    personName ? `Researcher profile for ${personName}` : '',
    affiliations ? `Affiliations: ${affiliations}` : '',
    orcid ? `ORCID: ${orcid}` : ''
  ].filter(Boolean);
  const description = descriptionParts.join('. ');
  const ogLocale = openGraphLocaleMap[locale] || 'en_US';
  const alternateLocale = locales.filter((code) => code !== locale).map((code) => openGraphLocaleMap[code] || 'en_US');
  const ogTitle = personName ? `${personName} - Ethnos Bibliography` : 'Ethnos Bibliography';
  const ogImage = {
    url: 'https://ethnos.app/android-chrome-512x512.png',
    width: 512,
    height: 512,
    alt: 'Ethnos Bibliography interface symbol'
  };
  const other = buildPersonMeta(person, locale, id);
  return {
    ...base,
    title: personName || base.title,
    description: description || base.description,
    openGraph: {
      title: ogTitle,
      description: description || base.description || '',
      type: 'profile',
      locale: ogLocale,
      alternateLocale,
      url: publicUrl,
      siteName: 'Ethnos Bibliography',
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

export default async function PersonPage(props: { params: Promise<{ locale: string; id: string }>, searchParams?: Promise<{ page?: string }> }) {
  const { id, locale } = await props.params;
  const sp = (await props.searchParams) || {};
  const page = Number(sp.page || '1') || 1;
  const data: any = await getPersonsWorks(id, page, 25);
  const person = data?.person || null;
  const worksPage = data?.works || null;
  const items: any[] = worksPage?.data || worksPage?.results || worksPage?.items || [];
  const pagination: any = worksPage?.pagination || worksPage?.meta?.pagination || {};
  if (!person) notFound();
  const [prominentItems, firstItems] = await Promise.all([
    getPersonsWorksProminent(id, 25),
    getPersonsWorksFirst(id, 25)
  ]);
  const t = await getTranslations({ locale });

  const personName = pickPersonName(person) || t('common.entities.personNotFound');
  const ids = person?.identifiers || {};
  const givenNames = person?.given_names || '';
  const familyName = person?.family_name || '';
  const nameSignature = person?.name_signature || '';
  const orcid = ids?.orcid || person?.orcid || '';
  const lattesId = ids?.lattes_id || person?.lattes_id || '';
  const scopusId = ids?.scopus_id || person?.scopus_id || '';
  const wikidataId = ids?.wikidata_id || person?.wikidata_id || '';
  const openalexId = ids?.openalex_id || person?.openalex_id || '';
  const magId = ids?.mag_id || person?.mag_id || '';
  const homepageUrl = ids?.url || person?.url || '';
  const isVerified = !!person?.is_verified;
  const metrics = person?.metrics || {};
  const profile = person?.authorship_profile || {};
  const subjectExpertise: any[] = Array.isArray(person?.subject_expertise) ? person.subject_expertise : [];
  const expertiseItems = subjectExpertise.map((subject: any) => {
    const term = subject?.term || subject?.display_name || subject?.name || '';
    const works = Number(subject?.works_count) || 0;
    return { term: String(term || ''), note: works > 0 ? t('common.meta.worksCount', { count: works }) : undefined };
  }).filter((subject) => subject.term);
  const affiliationsRaw: any = person?.affiliations || person?.affiliation || person?.current_affiliation || [];
  const affiliationSource: any[] = Array.isArray(affiliationsRaw) ? affiliationsRaw : (affiliationsRaw ? [affiliationsRaw] : []);
  const affiliationEntries = affiliationSource.map((a: any) => {
    if (!a) return null;
    if (typeof a === 'string') return { name: a, id: null };
    const orgName = a.name || a.organization || a.institution || '';
    return orgName ? { name: String(orgName), id: a.id ?? null } : null;
  }).filter(Boolean) as Array<{ name: string; id: number | string | null }>;
  const affiliations: string[] = affiliationEntries.map((entry) => entry.name);
  const publicUrl = `https://ethnos.app${localizedPath(locale as Locale, `/persons/${id}`)}`;
  const jsonLd: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: personName,
    url: publicUrl
  };
  const sameAs = uniqueList([
    orcid ? `https://orcid.org/${String(orcid)}` : '',
    wikidataId ? `https://www.wikidata.org/wiki/${String(wikidataId)}` : '',
    openalexId ? `https://openalex.org/${String(openalexId)}` : '',
    homepageUrl ? String(homepageUrl) : ''
  ]);
  if (sameAs.length) jsonLd.sameAs = sameAs;
  if (affiliations.length) jsonLd.affiliation = affiliations.map((item) => ({ '@type': 'Organization', name: item }));

  const listLabels = {
    titleUnavailable: t('common.entities.titleUnavailable'),
    authorUnknown: t('common.entities.authorUnknown'),
    roleFallback: t('persons.roleFallback'),
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
  const recentItems = sortByRecency(items);

  const pageHref = (target: number) => `/persons/${id}${target > 1 ? `?page=${target}` : ''}`;
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
      label: t('persons.sections.recent'),
      content: (
        <>
          <PersonWorksList items={recentItems} labels={{ ...listLabels, emptyState: t('persons.empty.recent') }} />
          {paginationNav}
        </>
      )
    },
    {
      key: 'prominent',
      label: t('persons.sections.prominent'),
      content: <PersonWorksList items={prominentItems} labels={{ ...listLabels, emptyState: t('persons.empty.prominent') }} />
    },
    {
      key: 'first',
      label: t('persons.sections.first'),
      content: <PersonWorksList items={firstItems} labels={{ ...listLabels, emptyState: t('persons.empty.first') }} />
    },
    expertiseItems.length > 0 ? {
      key: 'expertise',
      label: t('persons.sections.expertise'),
      content: <SubjectLinks subjects={expertiseItems} filters={{ author: personName }} />
    } : null,
    {
      key: 'tools',
      label: t('persons.sections.tools'),
      content: <EntityTools kind="person" entity={person} works={mergeWorkLists(recentItems, prominentItems, firstItems)} entityExportLabel={t('persons.tools.exportPerson')} />
    }
  ].filter(Boolean) as SectionTabDescriptor[];

  return (
    <div className="page-header" aria-labelledby="page-title">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h1 className="page-title" id="page-title">{personName}</h1>

      {person && (
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
              {affiliationEntries.length > 0 ? (
                <tr>
                  <th scope="row">{t('persons.fields.affiliations').toUpperCase()}</th>
                  <td className="field-value">
                    {affiliationEntries.map((entry, idx) => (
                      <span key={`${entry.id || entry.name}-${idx}`}>
                        {entry.id ? (
                          <LocaleLink prefetch={false} className="action-link table-link" href={`/institutions/${entry.id}`}>{entry.name}</LocaleLink>
                        ) : (
                          <span>{entry.name}</span>
                        )}
                        {idx < affiliationEntries.length - 1 ? '; ' : ''}
                      </span>
                    ))}
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
                  <td className="field-value">{lattesId}</td>
                </tr>
              ) : null}
              {scopusId ? (
                <tr>
                  <th scope="row">{t('persons.fields.scopus').toUpperCase()}</th>
                  <td className="field-value"><a className="action-link table-link" href={buildIdentifierHref('scopus', scopusId, 'person') || undefined} target="_blank" rel="noopener noreferrer">{scopusId}</a></td>
                </tr>
              ) : null}
              {wikidataId ? (
                <tr>
                  <th scope="row">{t('persons.fields.wikidata').toUpperCase()}</th>
                  <td className="field-value"><a className="action-link table-link" href={buildIdentifierHref('wikidata', wikidataId, 'person') || undefined} target="_blank" rel="noopener noreferrer">{wikidataId}</a></td>
                </tr>
              ) : null}
              {openalexId ? (
                <tr>
                  <th scope="row">{t('persons.fields.openalex').toUpperCase()}</th>
                  <td className="field-value"><a className="action-link table-link" href={buildIdentifierHref('openalex', openalexId, 'person') || undefined} target="_blank" rel="noopener noreferrer">{openalexId}</a></td>
                </tr>
              ) : null}
              {magId ? (
                <tr>
                  <th scope="row">{t('persons.fields.mag').toUpperCase()}</th>
                  <td className="field-value">{magId}</td>
                </tr>
              ) : null}
              {homepageUrl ? (
                <tr>
                  <th scope="row">{t('persons.fields.url').toUpperCase()}</th>
                  <td className="field-value"><a className="action-link table-link" href={homepageUrl} target="_blank" rel="noopener noreferrer">{homepageUrl}</a></td>
                </tr>
              ) : null}
              <tr>
                <th scope="row">{t('persons.fields.verified').toUpperCase()}</th>
                <td className="field-value">{isVerified ? t('common.values.yes') : t('common.values.no')}</td>
              </tr>
              {typeof metrics?.works_count === 'number' ? (
                <tr>
                  <th scope="row">{t('persons.fields.totalWorks').toUpperCase()}</th>
                  <td className="field-value">{metrics.works_count}</td>
                </tr>
              ) : null}
              {typeof profile?.total_citations === 'number' ? (
                <tr>
                  <th scope="row">{t('persons.fields.totalCitations').toUpperCase()}</th>
                  <td className="field-value">{profile.total_citations}</td>
                </tr>
              ) : null}
              {typeof profile?.author_count === 'number' ? (
                <tr>
                  <th scope="row">{t('persons.fields.authorCount').toUpperCase()}</th>
                  <td className="field-value">{profile.author_count}</td>
                </tr>
              ) : null}
              {typeof profile?.editor_count === 'number' ? (
                <tr>
                  <th scope="row">{t('persons.fields.editorCount').toUpperCase()}</th>
                  <td className="field-value">{profile.editor_count}</td>
                </tr>
              ) : null}
              {typeof profile?.open_access_works === 'number' ? (
                <tr>
                  <th scope="row">{t('persons.fields.openAccess').toUpperCase()}</th>
                  <td className="field-value">{profile.open_access_works}</td>
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
                  <td className="field-value">{profile.h_index}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      )}

      <SectionTabs ariaLabel={t('persons.sections.navLabel')} tabs={tabs} />
    </div>
  );
}
