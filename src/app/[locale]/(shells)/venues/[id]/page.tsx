import { getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
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

type IdentifierEntry = { label: string; values: Array<{ text: string; href?: string }> };

const addIdentifierValues = (
  target: IdentifierEntry[],
  label: string,
  raw?: any,
  hrefBuilder?: (value: string) => string | null
) => {
  const list = Array.isArray(raw) ? raw : (raw || raw === 0 ? [raw] : []);
  const values = list
    .map((value: any) => {
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
    })
    .filter(Boolean) as Array<{ text: string; href?: string }>;
  if (!values.length) return;
  const existing = target.find((entry) => entry.label === label);
  const targetValues = existing ? existing.values : [];
  values.forEach((entry) => {
    if (targetValues.some((item) => item.text === entry.text && item.href === entry.href)) return;
    targetValues.push(entry);
  });
  if (!existing) target.push({ label, values: targetValues });
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

export async function generateMetadata(props: { params: Promise<{ locale: string; id: string }> }) {
  const { id, locale } = await props.params;
  return buildPageMetadata(Promise.resolve({ locale }), 'metadata.venuesDetail', `/venues/${id}`);
}

export default async function VenueDetailPage(props: { params: Promise<{ locale: string; id: string }>; searchParams?: Promise<{ page?: string }> }) {
  const { id, locale } = await props.params;
  let venue = await getVenue(id);
  if (!venue) redirect({ href: '/venues?notice=venue-not-found', locale });
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
  const identifierEntries: IdentifierEntry[] = [];
  const venueIdentifiers = (venue as any)?.identifiers;
  let venueIssn = venue?.issn;
  let venueEissn = venue?.eissn;
  const venueIssnL = (venue as any)?.issn_l || (venue as any)?.issnl;
  let venueScopus = (venue as any)?.scopus_id || (venue as any)?.scopus;
  const venueWikidata = (venue as any)?.wikidata_id || (venue as any)?.wikidata;
  const venueOpenalex = (venue as any)?.openalex_id || (venue as any)?.openalex;
  const venueMag = (venue as any)?.mag_id || (venue as any)?.mag;
  addIdentifierValues(identifierEntries, 'ISSN-L', venueIssnL);
  addIdentifierValues(identifierEntries, t('works.detail.labels.wikidata'), venueWikidata, (value) => `https://www.wikidata.org/wiki/${encodeURIComponent(String(value))}`);
  addIdentifierValues(identifierEntries, t('works.detail.labels.openAlex'), venueOpenalex, (value) => `https://openalex.org/${encodeURIComponent(String(value))}`);
  addIdentifierValues(identifierEntries, t('works.detail.labels.mag'), venueMag);
  if (venueIdentifiers && typeof venueIdentifiers === 'object') {
    const identifierLabelMap: Record<string, { label: string; hrefBuilder?: (value: string) => string | null }> = {
      issnl: { label: 'ISSN-L' },
      issn_l: { label: 'ISSN-L' },
      wikidata: { label: t('works.detail.labels.wikidata'), hrefBuilder: (value) => `https://www.wikidata.org/wiki/${encodeURIComponent(String(value))}` },
      openalex: { label: t('works.detail.labels.openAlex'), hrefBuilder: (value) => `https://openalex.org/${encodeURIComponent(String(value))}` },
      openalexid: { label: t('works.detail.labels.openAlex'), hrefBuilder: (value) => `https://openalex.org/${encodeURIComponent(String(value))}` },
      openalex_id: { label: t('works.detail.labels.openAlex'), hrefBuilder: (value) => `https://openalex.org/${encodeURIComponent(String(value))}` },
      mag: { label: t('works.detail.labels.mag') },
      magid: { label: t('works.detail.labels.mag') },
      mag_id: { label: t('works.detail.labels.mag') }
    };
    Object.entries(venueIdentifiers as Record<string, any>).forEach(([rawKey, rawValue]) => {
      const normalized = String(rawKey || '').replace(/[-\s]/g, '').toLowerCase();
      if (!venueIssn && (normalized === 'issn' || normalized === 'eissn')) {
        const first = Array.isArray(rawValue) ? rawValue.find((v) => v) : rawValue;
        if (normalized === 'issn' && first && !venueIssn) venueIssn = String(first);
        if (normalized === 'eissn' && first && !venueEissn) venueEissn = String(first);
        return;
      }
      if (!venueScopus && (normalized === 'scopus' || normalized === 'scopusid' || normalized === 'scopus_id')) {
        const first = Array.isArray(rawValue) ? rawValue.find((v) => v) : rawValue;
        if (first) venueScopus = String(first);
        return;
      }
      const entry = identifierLabelMap[normalized];
      if (!entry) return;
      addIdentifierValues(identifierEntries, entry.label, rawValue, entry.hrefBuilder);
    });
  }
  const issnParts = [venueIssn, venueEissn && venueEissn !== venueIssn ? venueEissn : null].filter(Boolean).map((value) => String(value));
  const issnText = issnParts.join(' / ');

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
              {issnText ? (
                <tr>
                  <th scope="row">{t('venues.detail.issn')}</th>
                  <td className="field-value">{issnText}</td>
                </tr>
              ) : null}
              {venueScopus ? (
                <tr>
                  <th scope="row">{t('works.detail.labels.scopus')}</th>
                  <td className="field-value">{venueScopus}</td>
                </tr>
              ) : null}
              {identifierEntries.length > 0 ? (
                <tr>
                  <th scope="row">{t('venues.detail.ids')}</th>
                  <td className="field-value">
                    {renderGroupedIdentifiers(identifierEntries, 'venue-identifiers')}
                  </td>
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
