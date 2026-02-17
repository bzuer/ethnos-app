'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import LocaleLink from '@/components/common/LocaleLink';
import { showNotification } from '@/lib/notify';
import { AlignmentType, Document, Packer, Paragraph, TextRun } from 'docx';

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

function getFilesList(raw: any) {
  const files = raw?.files;
  if (Array.isArray(files)) return files;
  if (files && typeof files === 'object') {
    if (Array.isArray(files.data)) return files.data;
    if (Array.isArray(files.items)) return files.items;
    if (Array.isArray(files.results)) return files.results;
  }
  return [];
}

function normalizeValue(value: any) {
  return value ? String(value).replace(/\s+/g, ' ').trim() : '';
}

function normalizeDoi(value: any) {
  const raw = normalizeValue(value);
  if (!raw) return '';
  return raw.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '');
}

function formatAccessLink(id: string | number | null | undefined) {
  if (id === null || id === undefined) return '';
  const value = String(id).trim();
  return value ? `ethnos.app/works/${encodeURIComponent(value)}` : '';
}

function normalizeIssue(value: any) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return '';
  const raw = String(value).trim();
  if (!raw || raw.toLowerCase() === 'true' || raw.toLowerCase() === 'false') return '';
  return raw;
}

function getIsbn(raw: any) {
  const direct = raw?.isbn;
  if (Array.isArray(direct)) return direct.map((item: any) => normalizeValue(item)).filter(Boolean).join(' ');
  if (direct) return normalizeValue(direct);
  const identifiers = raw?.identifiers;
  if (Array.isArray(identifiers?.isbn)) return identifiers.isbn.map((item: any) => normalizeValue(item)).filter(Boolean).join(' ');
  if (identifiers?.isbn) return normalizeValue(identifiers.isbn);
  return '';
}

function normWork(raw: any) {
  if (!raw) return null;
  const authors = Array.isArray(raw.authors) ? raw.authors.map(normAuthor).filter(Boolean) : [];
  const publication = raw.publication || {};
  const venue = raw.venue || {};
  const publisher = raw.publisher || {};
  const files = getFilesList(raw);
  const md5 = raw.md5 || files.map((file: any) => file?.md5 || file?.md5_hash || file?.md5sum || file?.md5Hash || file?.checksum).find(Boolean) || null;
  const isbn = getIsbn(raw);
  return {
    id: raw.id,
    work_type: raw.work_type || raw.type || null,
    title: raw.title || null,
    subtitle: raw.subtitle || null,
    abstract: raw.abstract || null,
    language: raw.language || null,
    doi: raw.doi || publication.doi || null,
    md5,
    isbn,
    series: raw.series || raw.series_name || raw.series_title || raw.series_title_name || raw.series_title_value || raw.series_title_text || null,
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
  const doi = normalizeDoi(nw.doi);
  if (doi) lines.push(`DO  - ${doi}`);
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
  const accessLink = formatAccessLink(nw.id);
  const doi = normalizeDoi(nw.doi);
  const annoteParts = [];
  if (accessLink) annoteParts.push(`Access: ${accessLink}`);
  if (nw.md5) {
    const abstract = normalizeValue(nw.abstract);
    const fileInfo = `File: pdf \\textbar MD5: ${nw.md5}`;
    annoteParts.push(abstract ? `${fileInfo} \\textbar Abstract: ${abstract}` : fileInfo);
  }
  const annote = annoteParts.join(' \\textbar ');
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
  if (annote) lines.push(`  annote = {${annote}},`);
  if (nw.publisher?.name) lines.push(`  publisher = {${nw.publisher.name}},`);
  if (nw.language) lines.push(`  language = {${nw.language}},`);
  if (nw.isbn) lines.push(`  isbn = {${nw.isbn}},`);
  if (nw.series) lines.push(`  series = {${nw.series}},`);
  if (nw.venue?.name && bt === 'article') lines.push(`  journal = {${nw.venue.name}},`);
  if (nw.publication?.volume) lines.push(`  volume = {${nw.publication.volume}},`);
  if (nw.publication?.issue) lines.push(`  number = {${nw.publication.issue}},`);
  if (nw.publication?.pages) lines.push(`  pages = {${nw.publication.pages}},`);
  if (doi) lines.push(`  doi = {${doi}},`);
  lines.push('}');
  return lines.join('\n');
}

function toApaParagraph(work: any, fallbackAuthor: string) {
  const typeRaw = (work?.work_type || work?.type || '').toString().toLowerCase();
  const isBook = typeRaw === 'book';
  const isArticle = typeRaw === 'article' || typeRaw === 'journal';
  const authors = Array.isArray(work?.authors) ? work.authors.map((item: any) => {
    if (!item) return '';
    if (typeof item === 'string') return item;
    const family = item?.family_name || item?.name || '';
    const given = item?.given_names || '';
    const initials = given
      ? given.split(/\s+/).filter(Boolean).map((part: string) => part.charAt(0).toUpperCase() + '.').join(' ')
      : '';
    const name = family ? `${family}${initials ? `, ${initials}` : ''}` : (item?.preferred_name || '');
    return name;
  }).filter(Boolean) : [];
  let authorText = '';
  if (authors.length === 1) authorText = authors[0];
  else if (authors.length === 2) authorText = `${authors[0]} & ${authors[1]}`;
  else if (authors.length > 2) authorText = `${authors.slice(0, -1).join(', ')}, & ${authors[authors.length - 1]}`;
  if (!authorText) authorText = fallbackAuthor;
  const year = work?.publication?.year || work?.publication_year || work?.year || '';
  const title = work?.title || '';
  const subtitle = work?.subtitle || '';
  const titleText = title ? `${title}${subtitle ? `: ${subtitle}` : ''}` : '';
  const venue = work?.venue?.name || work?.venue_name || '';
  const volume = work?.publication?.volume || '';
  const issue = normalizeIssue(work?.publication?.issue || '');
  const pages = work?.publication?.pages || '';
  const publisher = work?.publisher?.name || work?.publisher_name || '';
  const isbn = work?.isbn || '';
  const doi = normalizeDoi(work?.doi || work?.publication?.doi);
  const accessLink = formatAccessLink(work?.id);
  const children: TextRun[] = [];
  if (authorText) children.push(new TextRun({ text: authorText }));
  if (year) children.push(new TextRun({ text: ` (${year}).` }));
  if (titleText) children.push(new TextRun({ text: ` ${titleText}.`, italics: isBook }));
  if (isArticle && venue) {
    children.push(new TextRun({ text: ` ${venue}`, italics: true }));
    if (volume) children.push(new TextRun({ text: `, ${volume}`, italics: true }));
    if (issue) children.push(new TextRun({ text: `(${issue})` }));
    if (pages) children.push(new TextRun({ text: `, ${pages}` }));
    children.push(new TextRun({ text: '.' }));
  } else {
    if (venue) children.push(new TextRun({ text: ` ${venue}.`, italics: true }));
    if (publisher) children.push(new TextRun({ text: ` ${publisher}.` }));
    if (volume || issue || pages) {
      const volIssue = `${volume ? ` ${volume}` : ''}${issue ? `(${issue})` : ''}`;
      if (volIssue.trim()) children.push(new TextRun({ text: volIssue, italics: true }));
      if (pages) children.push(new TextRun({ text: `${volIssue.trim() ? ', ' : ' '}${pages}.` }));
      else if (volIssue.trim()) children.push(new TextRun({ text: '.' }));
    }
  }
  if (isbn) children.push(new TextRun({ text: ` ISBN: ${isbn}.` }));
  if (doi) children.push(new TextRun({ text: ` DOI: ${doi}.` }));
  if (accessLink) children.push(new TextRun({ text: ` Access: ${accessLink}.` }));
  if (!children.length) return null;
  return new Paragraph({ children, spacing: { after: 240 }, alignment: AlignmentType.JUSTIFIED });
}

async function exportApaDocx(items: any[], filename: string, fallbackAuthor: string) {
  const paragraphs = items.map((item) => toApaParagraph(item, fallbackAuthor)).filter(Boolean) as Paragraph[];
  const doc = new Document({ sections: [{ children: paragraphs.length ? paragraphs : [new Paragraph(' ')] }] });
  const blob = await Packer.toBlob(doc);
  downloadFile(filename, blob, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}

function normalizeList(value: any): SavedItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === 'object' && 'id' in item) as SavedItem[];
}

async function resolveWorksForExport(list: SavedItem[]) {
  const ids = list.map((item) => item.id);
  const fetched = await Promise.all(ids.map((id) => fetchWork(id)));
  const byId = new Map(fetched.filter(Boolean).map((entry: any) => [String(entry.id), entry]));
  return ids.map((id, idx) => byId.get(String(id)) || list[idx]);
}

export default function ListPageClient() {
  const t = useTranslations();
  const [items, setItems] = useState<SavedItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const hasItems = items.length > 0;
  const listCountLabel = hasItems ? t(items.length === 1 ? 'lists.itemsInListOne' : 'lists.itemsInListOther', { count: items.length }) : '';
  const listOrderLabel = t('lists.itemsChronological');
  useEffect(() => {
    const timer = setTimeout(() => {
      setItems(readList());
      setMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => { updateHeaderCounter(); }, [items.length]);

  const onRemove = (id: number | string) => {
    const list = readList().filter((x) => String(x.id) !== String(id));
    writeList(list);
    setItems(list);
    updateHeaderCounter();
    showNotification(t('common.messages.itemRemoved'), 'error');
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
    const resolved = await resolveWorksForExport(items);
    const normalizedSource = resolved.map(normWork);
    const normalized = normalizedSource.filter(Boolean).map((entry) => attachEid(entry as Record<string, any>));
    const exportedItems = resolved.map((entry: any) => attachEid(entry));
    const payload = JSON.stringify({ items: exportedItems, normalized }, null, 2);
    downloadFile(`reading-list-${new Date().toISOString().split('T')[0]}.json`, payload, 'application/json');
    showNotification(t('common.messages.jsonExported'), 'success');
  };

  const exportRIS = async () => {
    const resolved = await resolveWorksForExport(items);
    const works = resolved.map(normWork).filter(Boolean);
    const content = works.map(toRIS).join('\n\n');
    downloadFile(`references-${new Date().toISOString().split('T')[0]}.ris`, content || ' ', 'application/x-research-info-systems');
    showNotification(t('common.messages.risExported'), 'success');
  };

  const exportBib = async () => {
    const resolved = await resolveWorksForExport(items);
    const works = resolved.map(normWork).filter(Boolean);
    const content = works.map(toBibTeX).join('\n\n');
    downloadFile(`references-${new Date().toISOString().split('T')[0]}.bib`, content || ' ', 'application/x-bibtex');
    showNotification(t('common.messages.bibExported'), 'success');
  };

  const exportApa = async () => {
    const resolved = await resolveWorksForExport(items);
    const works = resolved.map(normWork).filter(Boolean);
    await exportApaDocx(works, `references-apa-${new Date().toISOString().split('T')[0]}.docx`, t('common.entities.authorUnknown'));
    showNotification(t('common.messages.apaExported'), 'success');
  };

  return (
    <div className="page-header" aria-labelledby="page-title">
      <h1 className="page-title" id="page-title">{t('lists.title')}</h1>
      <section aria-labelledby="saved-items-title">
        <h2 className="title-section" id="saved-items-title">{t('lists.savedItems')}</h2>
        <div id="personal-list-container" aria-live="polite">
          {mounted && hasItems ? (
            <>
              <div className="list-header">
              </div>
              <table className="data-table personal-list-table" aria-label={t('common.meta.ariaPersonalList')}>
                <thead>
                  <tr>
                    <th scope="col">{t('common.table.title')}</th>
                    <th scope="col">{t('common.table.authors')}</th>
                    <th scope="col">{t('common.table.actions')}</th>
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
                        <td className="field-value">
                          <button type="button" className="list-remove-btn" onClick={() => onRemove(item.id)}>
                            {t('common.actions.removeItem')}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          ) : (
            <div className="empty-state">
              <p className="description">{t('lists.emptyStateTitle')}</p>
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
          <button type="button" className="action-btn btn-positive" id="export-apa-btn" onClick={exportApa}>{t('common.actions.exportApa')}</button>
        </div>
        <div id="export-empty-message" className={`description${hasItems ? ' hidden' : ''}`}>
          {t('lists.exportUnavailable')}
        </div>
      </section>
    </div>
  );
}
