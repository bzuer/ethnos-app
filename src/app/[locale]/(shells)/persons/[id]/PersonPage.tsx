import { getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import LocaleLink from '@/components/common/LocaleLink';
import { getPersonsWorks } from '@/lib/endpoints';
import { buildPageMetadata } from '@/i18n/metadata';
import { getWorkAbstractSnippet, isWorkOpenAccess } from '@/lib/works';
import { fetchJson } from '@/lib/api';
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

const buildPersonMeta = (person: any, locale: string, id: string, workTitles: string[]) => {
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
  const titles = uniqueList(workTitles);
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

const loadPerson = async (id: string) => {
  try {
    const res: any = await fetchJson<any>(`/persons/${encodeURIComponent(String(id))}`);
    return res?.data || res?.person || res || null;
  } catch {
    return null;
  }
};

export async function generateMetadata(props: { params: Promise<{ locale: string; id: string }> }) {
  const { id, locale } = await props.params;
  const base = await buildPageMetadata(Promise.resolve({ locale }), 'metadata.persons', `/persons/${id}`);
  const data = await getPersonsWorks(id, 1, 25);
  const person = data?.person || null;
  const works = data?.works || null;
  const items: any[] = works?.data || works?.results || works?.items || [];
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
  const workTitles = items.map((work) => (work?.title ? String(work.title) : '')).filter(Boolean);
  const other = buildPersonMeta(person, locale, id, workTitles);
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
  let data: any = null;
  try { data = await getPersonsWorks(id, page, 25); } catch {}
  const person = data?.person || null;
  const worksPage = data?.works || null;
  const items: any[] = worksPage?.data || worksPage?.results || worksPage?.items || [];
  const pagination: any = worksPage?.pagination || worksPage?.meta?.pagination || {};
  if (!person) redirect({ href: '/search?notice=person-not-found', locale });
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
              {affiliations.length > 0 ? (
                <tr>
                  <th scope="row">{t('persons.fields.affiliations').toUpperCase()}</th>
                  <td className="field-value">{affiliations.join('; ')}</td>
                </tr>
              ) : null}
              {orcid ? (
                <tr>
                  <th scope="row">{t('persons.fields.orcid').toUpperCase()}</th>
                  <td className="field-value"><a className="action-link table-link" href={`https://orcid.org/${orcid}`} target="_blank" rel="noopener noreferrer">{orcid}</a></td>
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
                  <td className="field-value">{scopusId}</td>
                </tr>
              ) : null}
              {wikidataId ? (
                <tr>
                  <th scope="row">{t('persons.fields.wikidata').toUpperCase()}</th>
                  <td className="field-value"><a className="action-link table-link" href={`https://www.wikidata.org/wiki/${wikidataId}`} target="_blank" rel="noopener noreferrer">{wikidataId}</a></td>
                </tr>
              ) : null}
              {openalexId ? (
                <tr>
                  <th scope="row">{t('persons.fields.openalex').toUpperCase()}</th>
                  <td className="field-value"><a className="action-link table-link" href={`https://openalex.org/${openalexId}`} target="_blank" rel="noopener noreferrer">{openalexId}</a></td>
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

      <section aria-labelledby="person-works-title">
        <h2 className="title-section" id="person-works-title">{t('persons.worksHeading')}</h2>
        <ul className="results-list" id="person-works">
          {items.length > 0 ? (
            items.map((pub: any) => {
              const openAccess = isWorkOpenAccess(pub);
              const authorsArr = Array.isArray(pub.authors) ? pub.authors : (Array.isArray(pub.authors_preview) ? pub.authors_preview : []);
              const year = pub.publication_year || (pub.publication && pub.publication.year) || pub.year || '';
              const type = (pub.work_type || pub.type || '').toString().toUpperCase();
              const role = (pub.role || pub.authorship_role || t('persons.roleFallback')).toString().toUpperCase();
              const abstract = getWorkAbstractSnippet(pub);
              return (
                <li className="result-item" key={pub.id}>
                  <h3 className="result-title">
                    <LocaleLink href={`/works/${pub.id}`} className="result-link">{pub.title && pub.title.length > 200 ? `${pub.title.slice(0, 200)}…` : (pub.title || t('common.entities.titleUnavailable'))}</LocaleLink>
                  </h3>
                  <p className="result-meta">
                  {openAccess ? <> <span className="badge open-acess">{t('common.meta.openAccess')}</span> • </> : null }
                    {type ? <span className="result-type"> {type}</span> : null}
                    <span className="result-authors"> • {authorsArr.length > 0 ? (
                        authorsArr.slice(0, 2).map((a: any, idx: number) => (
                          <span key={idx}>{typeof a === 'string' ? a : (a?.preferred_name || a?.name)}{idx < Math.min(authorsArr.length, 2) - 1 ? ', ' : ''}</span>
                        ))
                      ) : (
                        role
                      )}
                    </span>
                    {year ? <span className="result-year"> • {year}</span> : null}
                  </p>
                  {abstract ? <p className="result-abstract">{abstract}</p> : null}
                </li>
              );
            })
          ) : (
            <div className="no-results"><p>{t('common.states.noPersonWorks')}</p></div>
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
