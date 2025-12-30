'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import LocaleLink from '@/components/common/LocaleLink';
import { showNotification } from '@/lib/notify';

type SavedItem = { id: number | string; title?: string; authors?: any; publication_year?: number | string; venue_name?: string; type?: string; added_at?: string };
type Work = any;

const STORAGE_KEY = 'ethnos_app_personal_list';

function getApiBase() {
  if (typeof process !== 'undefined' && process.env) {
    const base =
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      process.env.NEXT_PUBLIC_API_BASE ||
      process.env.NEXT_PUBLIC_DEV_API;
    if (base) return String(base);
  }
  if (typeof window !== 'undefined') {
    try {
      const u = new URL(window.location.href);
      return `${u.protocol}//${u.host}`;
    } catch {}
  }
  return 'https://api.ethnos.app';
}

function readList(): SavedItem[] {
  try { const v = localStorage.getItem(STORAGE_KEY); return v ? normalizeList(JSON.parse(v)) : []; } catch { return []; }
}

function writeList(items: SavedItem[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); return true; } catch { return false; }
}

function updateHeaderCounter() {
  const el = document.getElementById('reading-list-counter');
  if (el) el.textContent = String(readList().length);
}

function formatAuthorsForDisplay(authors: any, fallback: string): string {
  if (Array.isArray(authors)) {
    return authors.map((a: any) => {
      if (!a) return '';
      if (typeof a === 'string') return a;
      const preferred = a.preferred_name;
      const given = a.given_names;
      const family = a.family_name;
      const alt = a.name || a.full_name;
      if (preferred && String(preferred).trim()) return preferred;
      if (family && given) return `${given} ${family}`.trim();
      return alt || '';
    }).filter(Boolean).join('; ');
  }
  if (typeof authors === 'string') return authors;
  if (authors && typeof authors === 'object') {
    const named = authors.name || authors.full_name || authors.preferred_name;
    if (named) return String(named);
  }
  return fallback;
}

function downloadFile(filename: string, content: Blob | string, type?: string) {
  const blob = typeof content === 'string' ? new Blob([content], { type: type || 'text/plain;charset=utf-8' }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function fetchWork(id: string | number): Promise<Work | null> {
  const include = 'metrics,references,files,venue,authors';
  const tryUrls = [
    `/api/works/${encodeURIComponent(String(id))}?include=${encodeURIComponent(include)}`,
    `${getApiBase()}/works/${encodeURIComponent(String(id))}?include=${encodeURIComponent(include)}`
  ];
  for (const url of tryUrls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const json: any = await res.json();
      const w = json?.data || json?.work || json || null;
      if (w) return w;
    } catch {}
  }
  return null;
}

function normAuthor(a: any) {
  if (!a) return null;
  if (typeof a === 'string') {
    const parts = a.trim().split(/\s+/);
    const family = parts.length ? parts[parts.length - 1] : '';
    const given = parts.length > 1 ? parts.slice(0, -1).join(' ') : '';
    return { family_name: family || null, given_names: given || null, preferred_name: a, identifiers: {}, affiliation: null };
  }
  const aff = a.affiliation && typeof a.affiliation === 'object' ? a.affiliation.name : a.affiliation || null;
  return { family_name: a.family_name || null, given_names: a.given_names || null, preferred_name: a.preferred_name || a.full_name || a.name || null, identifiers: a.identifiers || (a.orcid ? { orcid: a.orcid } : {}), affiliation: aff || null };
}

function normWork(raw: any) {
  if (!raw) return null;
  const authors = Array.isArray(raw.authors) ? raw.authors.map(normAuthor).filter(Boolean) : [];
  const publication = raw.publication || {};
  const venue = raw.venue || {};
  const publisher = raw.publisher || {};
  return {
    id: raw.id,
    work_type: raw.work_type || raw.type || null,
    title: raw.title || null,
    subtitle: raw.subtitle || null,
    abstract: raw.abstract || null,
    language: raw.language || null,
    doi: raw.doi || null,
    publication: {
      year: publication.year || raw.publication_year || raw.year || null,
      volume: publication.volume || raw.volume || null,
      issue: publication.issue || raw.issue || null,
      pages: publication.pages || raw.pages || null
    },
    venue: { id: venue.id || null, name: venue.name || raw.venue_name || null, issn: venue.issn || venue.eissn || null },
    publisher: { name: publisher.name || raw.publisher_name || null },
    authors
  };
}

function formatEid(id: string | number | null | undefined) {
  if (id === null || id === undefined) return '';
  const value = String(id).trim();
  return value ? `e-id ${value}` : '';
}

function attachEid<T extends Record<string, any>>(item: T, overrideId?: string | number | null) {
  const eid = formatEid(overrideId ?? item?.id ?? null);
  if (!eid) return item;
  return { ...item, 'e-id': eid };
}

function toRIS(nw: any): string {
  const ty = nw.work_type && String(nw.work_type).toUpperCase();
  const risType = ty === 'ARTICLE' ? 'JOUR' : ty === 'BOOK' ? 'BOOK' : ty === 'INPROCEEDINGS' ? 'CPAPER' : 'GEN';
  const lines: string[] = [];
  lines.push(`TY  - ${risType}`);
  if (nw.title) lines.push(`TI  - ${nw.title}`);
  if (Array.isArray(nw.authors)) nw.authors.forEach((a: any) => { const fam = a.family_name || ''; const giv = a.given_names || ''; const p = a.preferred_name || ''; lines.push(`AU  - ${fam && giv ? `${fam}, ${giv}` : (p || fam || giv)}`); });
  if (nw.publication?.year) lines.push(`PY  - ${nw.publication.year}`);
  if (nw.venue?.name) lines.push(`JF  - ${nw.venue.name}`);
  if (nw.publication?.volume) lines.push(`VL  - ${nw.publication.volume}`);
  if (nw.publication?.issue) lines.push(`IS  - ${nw.publication.issue}`);
  if (nw.publication?.pages) { const sp = String(nw.publication.pages).split('-')[0]; const ep = String(nw.publication.pages).split('-')[1]; if (sp) lines.push(`SP  - ${sp}`); if (ep) lines.push(`EP  - ${ep}`); }
  if (nw.doi) lines.push(`DO  - ${nw.doi}`);
  if (nw.language) lines.push(`LA  - ${nw.language}`);
  const eid = formatEid(nw.id);
  if (eid) lines.push(`N1  - ${eid}`);
  lines.push('ER  - ');
  return lines.join('\n');
}

function toBibTeX(nw: any): string {
  const ty = nw.work_type && String(nw.work_type).toLowerCase();
  const bt = ty === 'article' ? 'article' : ty === 'book' ? 'book' : 'misc';
  const keyAuthor = nw.authors && nw.authors[0] ? (nw.authors[0].family_name || nw.authors[0].preferred_name || 'work') : 'work';
  const key = `${String(keyAuthor).toLowerCase().replace(/[^a-z0-9]/g, '')}${nw.publication?.year || ''}` || 'ref';
  const lines: string[] = [];
  lines.push(`@${bt}{${key},`);
  if (Array.isArray(nw.authors)) {
    const s = nw.authors.map((a: any) => {
      const fam = a.family_name || '';
      const giv = a.given_names || '';
      const p = a.preferred_name || '';
      return fam && giv ? `${fam}, ${giv}` : p || fam || giv;
    }).filter(Boolean).join(' and ');
    if (s) lines.push(`  author = {${s}},`);
  }
  if (nw.title) lines.push(`  title = {${nw.title}},`);
  if (nw.publication?.year) lines.push(`  year = {${nw.publication.year}},`);
  if (nw.venue?.name) lines.push(`  journal = {${nw.venue.name}},`);
  if (nw.publisher?.name) lines.push(`  publisher = {${nw.publisher.name}},`);
  if (nw.publication?.volume) lines.push(`  volume = {${nw.publication.volume}},`);
  if (nw.publication?.issue) lines.push(`  number = {${nw.publication.issue}},`);
  if (nw.publication?.pages) lines.push(`  pages = {${nw.publication.pages}},`);
  if (nw.doi) lines.push(`  doi = {${nw.doi}},`);
  const eid = formatEid(nw.id);
  if (eid) lines.push(`  notes = {${eid}},`);
  lines.push('}');
  return lines.join('\n');
}

function toABNTLine(nw: any, fallbackAuthor: string, fallbackTitle: string): string {
  let authors = fallbackAuthor;
  if (Array.isArray(nw.authors) && nw.authors.length > 0) {
    authors = nw.authors.map((a: any) => {
      const fam = a.family_name || '';
      const giv = a.given_names || '';
      const pref = a.preferred_name || '';
      if (fam && giv) return `${String(fam).toUpperCase()}, ${giv}`;
      if (pref) {
        const parts = String(pref).trim().split(/\s+/);
        if (parts.length > 1) { const last = parts.pop() as string; const firsts = parts.join(' '); return `${String(last).toUpperCase()}, ${firsts}`; }
        return String(pref).toUpperCase();
      }
      const any = fam || giv;
      return any ? String(any).toUpperCase() : '';
    }).filter(Boolean).join('; ');
  }
  const title = nw.title || fallbackTitle;
  const subtitle = nw.subtitle ? `: ${nw.subtitle}` : '';
  const year = nw.publication?.year || 'S.d.';
  const venue = nw.venue?.name || '';
  const volume = nw.publication?.volume || '';
  const issue = nw.publication?.issue || '';
  const pages = nw.publication?.pages || '';
  const doi = nw.doi || '';
  let ref = `${authors}. ${title}${subtitle}.`;
  if (venue) ref += ` ${venue}.`;
  const parts: string[] = [];
  if (volume) parts.push(`v. ${volume}`);
  if (issue) parts.push(`n. ${issue}`);
  if (pages) parts.push(`${pages}`);
  if (parts.length) ref += ` ${parts.join(', ')}.`;
  ref += ` ${year}.`;
  if (doi) ref += ` DOI: ${doi}.`;
  const eid = formatEid(nw.id);
  if (eid) ref += ` ${eid}.`;
  return ref;
}

function normalizeList(value: any): SavedItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === 'object' && 'id' in item) as SavedItem[];
}

export default function ListPageClient() {
  const t = useTranslations();
  const [items, setItems] = useState<SavedItem[]>(() => readList());
  const hasItems = items.length > 0;
  const listCountLabel = hasItems ? t(items.length === 1 ? 'lists.itemsInListOne' : 'lists.itemsInListOther', { count: items.length }) : '';
  const listOrderLabel = t('lists.itemsChronological');
  useEffect(() => { updateHeaderCounter(); }, [items.length]);

  const onRemove = (id: number | string) => {
    const list = readList().filter((x) => String(x.id) !== String(id));
    writeList(list);
    setItems(list);
    updateHeaderCounter();
    showNotification(t('common.messages.itemRemoved'), 'info');
  };

  const onClear = () => {
    if (!hasItems) return;
    if (confirm(t('common.messages.confirmClear'))) {
      localStorage.removeItem(STORAGE_KEY);
      setItems([]);
      updateHeaderCounter();
      showNotification(t('common.messages.listCleared'), 'success');
    }
  };

  const exportJson = async () => {
    const ids = items.map((i) => i.id);
    const works = (await Promise.all(ids.map((id) => fetchWork(id)))).filter(Boolean) as any[];
    const resolved = works.length ? works : items;
    const normalizedSource = resolved.map(normWork);
    const normalized = normalizedSource.filter(Boolean).map((entry) => attachEid(entry as Record<string, any>));
    const exportedItems = resolved.map((entry: any) => attachEid(entry));
    const payload = JSON.stringify({ items: exportedItems, normalized }, null, 2);
    downloadFile(`reading-list-${new Date().toISOString().split('T')[0]}.json`, payload, 'application/json');
    showNotification(t('common.messages.jsonExported'), 'success');
  };

  const exportRIS = async () => {
    const ids = items.map((i) => i.id);
    const fetched = (await Promise.all(ids.map((id) => fetchWork(id)))).filter(Boolean) as any[];
    const works = (fetched.length ? fetched : items).map(normWork).filter(Boolean);
    const content = works.map(toRIS).join('\n\n');
    downloadFile(`references-${new Date().toISOString().split('T')[0]}.ris`, content || ' ', 'application/x-research-info-systems');
    showNotification(t('common.messages.risExported'), 'success');
  };

  const exportBib = async () => {
    const ids = items.map((i) => i.id);
    const fetched = (await Promise.all(ids.map((id) => fetchWork(id)))).filter(Boolean) as any[];
    const works = (fetched.length ? fetched : items).map(normWork).filter(Boolean);
    const content = works.map(toBibTeX).join('\n\n');
    downloadFile(`references-${new Date().toISOString().split('T')[0]}.bib`, content || ' ', 'application/x-bibtex');
    showNotification(t('common.messages.bibExported'), 'success');
  };

  const exportABNT = async () => {
    const ids = items.map((i) => i.id);
    const fetched = (await Promise.all(ids.map((id) => fetchWork(id)))).filter(Boolean) as any[];
    const works = (fetched.length ? fetched : items).map(normWork).filter(Boolean);
    const lines = works.map((item) => toABNTLine(item, t('common.entities.authorUnknown'), t('common.entities.titleUnavailable'))).join('\n\n');
    downloadFile(`references-abnt-${new Date().toISOString().split('T')[0]}.docx`, lines || ' ', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    showNotification(t('common.messages.abntExported'), 'success');
  };

  return (
    <div className="page-header" aria-labelledby="page-title">
      <h1 className="page-title" id="page-title">{t('lists.title')}</h1>
      <section aria-labelledby="saved-items-title">
        <h2 className="title-section" id="saved-items-title">{t('lists.savedItems')}</h2>
        <div id="personal-list-container" aria-live="polite">
          {hasItems ? (
            <>
              <div className="list-header">
                <p className="list-stats">
                  <span className="field-value">{listCountLabel}</span>
                  <span className="description">{listOrderLabel}</span>
                </p>
              </div>
              <table className="data-table personal-list-table" aria-label={t('common.meta.ariaPersonalList')}>
                <thead>
                  <tr>
                    <th scope="col">{t('common.table.title')}</th>
                    <th scope="col">{t('common.table.authors')}</th>
                    <th scope="col">{t('common.table.year')}</th>
                    <th scope="col" />
                  </tr>
                </thead>
                <tbody>
                  {[...items].reverse().map((item) => {
                    const authors = formatAuthorsForDisplay(item.authors, t('common.entities.authorUnknown'));
                    return (
                      <tr key={String(item.id)} data-item-id={String(item.id)}>
                        <td className="field-value">
                          <LocaleLink
                            href={`/works/${item.id}`}
                            className="action-link table-link"
                            aria-label={t('common.meta.openWork', { title: item.title || t('common.entities.work') })}
                          >
                            {item.title || t('common.entities.titleUnavailable')}
                          </LocaleLink>
                        </td>
                        <td className="field-value">{authors}</td>
                        <td className="field-value">{item.publication_year || t('common.entities.yearUnavailable')}</td>
                        <td className="field-value">
                          <button type="button" className="action-btn btn-negative" onClick={() => onRemove(item.id)}>×</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          ) : (
            <div className="empty-state">
              <p className="field-value">{t('lists.emptyStateTitle')}</p>
              <p className="description">{t('lists.emptyStateDescription')}</p>
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="export-title">
        <h2 className="title-section" id="export-title">{t('lists.export')}</h2>
        <div className={`tools-actions${hasItems ? '' : ' hidden'}`} id="export-section">
          <button type="button" className="action-btn btn-negative clear-all-btn" id="clear-all-btn" onClick={onClear}>{t('common.actions.clearList')}</button>
          <button type="button" className="action-btn btn-positive" id="export-json-btn" onClick={exportJson}>{t('common.actions.exportJson')}</button>
          <button type="button" className="action-btn btn-positive" id="export-ris-btn" onClick={exportRIS}>{t('common.actions.exportRis')}</button>
          <button type="button" className="action-btn btn-positive" id="export-bib-btn" onClick={exportBib}>{t('common.actions.exportBib')}</button>
          <button type="button" className="action-btn btn-positive" id="export-txt-btn" onClick={exportABNT}>{t('common.actions.exportAbnt')}</button>
        </div>
        <div id="export-empty-message" className={`description${hasItems ? ' hidden' : ''}`}>
          {t('lists.exportUnavailable')}
        </div>
      </section>
    </div>
  );
}
