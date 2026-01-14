import { getTranslations } from 'next-intl/server';
import LocaleLink from '@/components/common/LocaleLink';
import ClientActions from './work-actions';
import { buildPageMetadata } from '@/i18n/metadata';
import { getWorkAbstractSnippet, isWorkOpenAccess } from '@/lib/works';
import { formatNumber } from '@/lib/format';
import { redirect } from '@/i18n/routing';
import { buildCoins, buildCitationMeta, loadWork, pickReferenceAuthors } from './work-detail';

export async function generateMetadata(props: { params: Promise<{ locale: string; id: string }> }) {
  const { id, locale } = await props.params;
  const base = await buildPageMetadata(Promise.resolve({ locale }), 'metadata.workDetail', `/works/${id}`);
  const work = await loadWork(id);
  if (!work || !work.id) return base;
  const other = buildCitationMeta(work, locale, id);
  return { ...base, other: { ...(base.other || {}), ...other } };
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function WorkDetailPage(props: { params: Promise<{ locale: string; id: string }> }) {
  const { id, locale } = await props.params;
  const work = await loadWork(id);
  if (!work || !work.id) redirect({ href: '/works?notice=work-not-found', locale });
  const t = await getTranslations({ locale });
  const authorsArr = Array.isArray(work?.authors) ? work.authors : [];
  const onlyAuthors = authorsArr.filter((a: any) => (a?.role || '').toString().toUpperCase() === 'AUTHOR' || !a?.role);
  const editors = authorsArr.filter((a: any) => (a?.role || '').toString().toUpperCase() === 'EDITOR');
  const publication = work?.publication || {};
  const year = publication?.year || work?.publication_year || work?.year;
  const volume = publication?.volume || work?.volume;
  const issue = [publication?.issue, publication?.number, work?.issue, work?.number]
    .find((value) => value !== undefined && value !== null && value !== '' && typeof value !== 'boolean');
  const pages = publication?.pages || work?.pages;
  const publicationDate = publication?.publication_date || work?.publication_date;
  const peerReviewed = typeof publication?.peer_reviewed === 'boolean' ? publication.peer_reviewed : (typeof work?.peer_reviewed === 'boolean' ? work.peer_reviewed : null);
  const openAccess = typeof publication?.open_access === 'boolean' ? publication.open_access : (typeof work?.open_access === 'boolean' ? work.open_access : null);
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
  const metrics = work?.metrics || {};
  const identifiers = work?.identifiers && typeof work.identifiers === 'object' ? work.identifiers : {};
  type IdentifierEntry = { label: string; values: Array<{ text: string; href?: string }> };
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
  const renderGroupedIdentifiers = (entries: IdentifierEntry[], keyPrefix: string) => (
    entries.map((kv, kvIdx) => (
      <span key={`${keyPrefix}-${kv.label}-${kvIdx}`}>
        {kv.label}: {kv.values.map((entry, idx: number) => (
          <span key={`${keyPrefix}-${kv.label}-${entry.text}-${idx}`}>
            {entry.href ? (
              <a className="action-link table-link" href={entry.href} target="_blank" rel="noopener noreferrer">{entry.text}</a>
            ) : (
              <span>{entry.text}</span>
            )}
            {idx < kv.values.length - 1 ? ', ' : ''}
          </span>
        ))}
        {kvIdx < entries.length - 1 ? ' • ' : ''}
      </span>
    ))
  );
  addValues('DOI', work?.doi || publication?.doi, (value) => `https://doi.org/${encodeURIComponent(String(value))}`);
  addValues('PMID', work?.pmid, (value) => `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(String(value))}`);
  addValues('PMCID', work?.pmcid);
  addValues('arXiv', work?.arxiv, (value) => `https://arxiv.org/abs/${encodeURIComponent(String(value))}`);
  addValues('WOS ID', work?.wos_id);
  addValues('Handle', work?.handle, (value) => `https://hdl.handle.net/${encodeURIComponent(String(value))}`);
  addValues('Wikidata', work?.wikidata_id);
  addValues('MAG', work?.mag_id);
  addValues(t('works.detail.labels.openLibraryId'), work?.openlibrary_id, (value) => `https://openlibrary.org/books/${encodeURIComponent(String(value))}`);
  addValues(t('works.detail.labels.isbn'), work?.isbn);
  const idLabelMap: Record<string, string> = {
    openlibrary: t('works.detail.labels.openLibraryId'),
    openlibraryid: t('works.detail.labels.openLibraryId'),
    isbn: t('works.detail.labels.isbn')
  };
  Object.entries(identifiers).forEach(([rawKey, rawValue]) => {
    const key = String(rawKey || '');
    if (!key) return;
    const normalized = key.replace(/_/g, '').toLowerCase();
    if (normalized === 'doi' || normalized === 'openalex' || normalized === 'openalexid') return;
    const label = idLabelMap[normalized] || (normalized.startsWith('isbn') ? t('works.detail.labels.isbn') : key.toUpperCase());
    addValues(label, rawValue, normalized === 'pmid'
      ? (value) => `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(String(value))}`
      : normalized === 'arxiv'
        ? (value) => `https://arxiv.org/abs/${encodeURIComponent(String(value))}`
        : normalized === 'handle'
          ? (value) => `https://hdl.handle.net/${encodeURIComponent(String(value))}`
          : normalized === 'openlibrary' || normalized === 'openlibraryid'
            ? (value) => `https://openlibrary.org/books/${encodeURIComponent(String(value))}`
            : undefined);
  });
  addValues(t('venues.detail.issn'), venueIssn, undefined, venueIds);
  addValues(t('venues.detail.eissn'), venueEissn, undefined, venueIds);
  const abstractText = work?.abstract || '';
  const refs: any[] = Array.isArray(work?.citations?.references) ? work.citations.references : [];
  const citedBy: any[] = Array.isArray(work?.citations?.cited_by) ? work.citations.cited_by : [];
  const coins = buildCoins(work, locale, id);
  return (
    <div className="page-header" aria-labelledby="page-title">
      {coins ? <span className="Z3988 visually-hidden" title={coins} /> : null}
      <h1 className="page-title" id="page-title">{work?.title || t('works.detail.titleFallback')}</h1>
      {work?.subtitle ? (<p className="item-subtitle">{work.subtitle}</p>) : null}

      <section aria-labelledby="bib-block">
        <h2 className="title-section" id="bib-block">{t('works.detail.sections.bibliographic')}</h2>
        <table className="data-table item-detail-table">
          <tbody>
            <tr>
              <th scope="row">{t('works.detail.labels.id')}</th>
              <td className="field-value">{id}</td>
            </tr>
            <tr>
              <th scope="row">{t('works.detail.labels.authors')}</th>
              <td className="field-value">
                {onlyAuthors && onlyAuthors.length > 0 ? (
                  onlyAuthors.map((a: any, idx: number) => {
                    const name = a?.preferred_name || a?.name || [a?.given_names, a?.family_name].filter(Boolean).join(' ');
                    const pid = a?.person_id || a?.id;
                    const href = pid ? `/persons/${pid}` : undefined;
                    const affRaw = a?.affiliation || (Array.isArray(a?.affiliations) ? a.affiliations[0] : undefined) || a?.current_affiliation || null;
                    let aff = '' as string;
                    if (affRaw) {
                      if (typeof affRaw === 'string') aff = affRaw;
                      else {
                        const dep = affRaw?.department || '';
                        const org = affRaw?.name || affRaw?.organization || affRaw?.institution || affRaw?.unit || '';
                        aff = [dep, org].filter((x) => x && String(x).trim()).join(' — ');
                      }
                    }
                    const orcid = a?.identifiers?.orcid || a?.orcid || '';
                    const extra = [orcid, aff].filter((x) => x && String(x).trim()).join(', ');
                    return (
                      <span key={pid || idx}>
                        {href ? (
                          <LocaleLink prefetch={false} className="action-link table-link" href={href}>{name || t('common.entities.authorUnknown')}</LocaleLink>
                        ) : (
                          <span className="field-value">{name || t('common.entities.authorUnknown')}</span>
                        )}
                        {extra ? ` (${extra})` : ''}
                        {idx < onlyAuthors.length - 1 ? ', ' : ''}
                      </span>
                    );
                  })
                ) : t('common.entities.authorUnknown')}
              </td>
            </tr>
            {editors.length > 0 ? (
              <tr>
                <th scope="row">{t('works.detail.labels.editors')}</th>
                <td className="field-value">
                  {editors.map((a: any, idx: number) => {
                    const name = a?.preferred_name || a?.name || [a?.given_names, a?.family_name].filter(Boolean).join(' ');
                    const pid = a?.person_id || a?.id;
                    const href = pid ? `/persons/${pid}` : undefined;
                    return (
                      <span key={pid || idx}>
                        {href ? (
                          <LocaleLink prefetch={false} className="action-link table-link" href={href}>{name || t('common.entities.authorUnknown')}</LocaleLink>
                        ) : (
                          <span className="field-value">{name || t('common.entities.authorUnknown')}</span>
                        )}
                        {idx < editors.length - 1 ? ', ' : ''}
                      </span>
                    );
                  })}
                </td>
              </tr>
            ) : null}
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
            {typeof metrics?.citation_count === 'number' && metrics.citation_count > 0 ? (
              <tr>
                <th scope="row">{t('works.detail.labels.citations')}</th>
                <td className="field-value">{formatNumber(metrics.citation_count)}</td>
              </tr>
            ) : null}
            {typeof metrics?.reference_count === 'number' && metrics.reference_count > 0 ? (
              <tr>
                <th scope="row">{t('works.detail.labels.references')}</th>
                <td className="field-value">{formatNumber(metrics.reference_count)}</td>
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

      {abstractText ? (
        <section aria-labelledby="abstract-block">
          <h2 className="title-section" id="abstract-block">{t('works.detail.sections.abstract')}</h2>
          <p className="description">{abstractText}</p>
        </section>
      ) : null}

      {Array.isArray(refs) && refs.length > 0 ? (
        <section aria-labelledby="references-block">
          <h2 className="title-section" id="references-block">{t('works.detail.sections.references')}</h2>
          <ul className="results-list">
            {refs.map((r: any, idx: number) => {
              const rid = r?.id || r?.work_id;
              const rtitle = r?.title || r?.work_title || t('common.entities.titleUnavailable');
              const rauth = pickReferenceAuthors(r);
              const ryear = r?.publication_year || r?.year || '';
              const rabstract = getWorkAbstractSnippet(r);
              const rOpen = isWorkOpenAccess(r);
              return (
                <li className="result-item" key={rid || idx}>
                  <h3 className="result-title">
                    {rid ? (<LocaleLink className="result-link" href={`/works/${rid}`}>{rtitle}</LocaleLink>) : (<span className="field-value">{rtitle}</span>)}
                  </h3>
                  <p className="result-meta">
                    <span className="result-authors">{rauth || t('common.entities.authorUnknown')}</span>
                    {ryear ? <> • <span className="result-year">{ryear}</span></> : null}
                    {rOpen ? <> • <span className="badge open-acess">{t('common.meta.openAccess')}</span></> : null}
                  </p>
                  {rabstract ? <p className="result-abstract">{rabstract}</p> : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {Array.isArray(citedBy) && citedBy.length > 0 ? (
        <section aria-labelledby="citations-block">
          <h2 className="title-section" id="citations-block">{t('works.detail.sections.citedBy')}</h2>
          <ul className="results-list">
            {citedBy.map((c: any, idx: number) => {
              const cid = c?.id || c?.work_id;
              const ctitle = c?.title || c?.work_title || t('common.entities.titleUnavailable');
              const cauth = pickReferenceAuthors(c);
              const cyear = c?.publication_year || c?.year || '';
              const cabstract = getWorkAbstractSnippet(c);
              const cOpen = isWorkOpenAccess(c);
              return (
                <li className="result-item" key={cid || idx}>
                  <h3 className="result-title">
                    {cid ? (<LocaleLink className="result-link" href={`/works/${cid}`}>{ctitle}</LocaleLink>) : (<span className="field-value">{ctitle}</span>)}
                  </h3>
                  <p className="result-meta">
                    <span className="result-authors">{cauth || t('common.entities.authorUnknown')}</span>
                    {cyear ? <> • <span className="result-year">{cyear}</span></> : null}
                    {cOpen ? <> • <span className="badge open-acess">{t('common.meta.openAccess')}</span></> : null}
                  </p>
                  {cabstract ? <p className="result-abstract">{cabstract}</p> : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="tools-section" className="tools-section">
        <h2 className="title-section" id="tools-section">{t('works.detail.sections.tools')}</h2>
        <div className="tools-actions">
          <ClientActions work={work} />
        </div>
      </section>
    </div>
  );
}
