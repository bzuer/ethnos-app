'use client';
import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { showNotification } from '@/lib/notify';
import { AlignmentType, Document, Packer, Paragraph, TextRun } from 'docx';

type Props = { work: any };

const STORAGE_KEY = 'ethnos_app_personal_list';

function readList(): any[] { try { const v = localStorage.getItem(STORAGE_KEY); return v ? normalizeList(JSON.parse(v)) : []; } catch { return []; } }
function writeList(items: any[]) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); return true; } catch { return false; } }

function updateHeaderCounter() { const el = document.getElementById('reading-list-counter'); if (el) el.textContent = String(readList().length); }

function toSavedItem(work: any) {
  return {
    id: work?.id,
    title: work?.title || null,
    authors: work?.authors || work?.authors_preview || work?.author_string || null,
    publication_year: work?.publication?.year || work?.publication_year || work?.year || null,
    venue_id: work?.venue?.id || work?.venue_id || null,
    venue_name: work?.venue?.name || work?.venue_name || null,
    type: work?.work_type || work?.type || null,
    added_at: new Date().toISOString()
  };
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
    doi: raw.doi || publication.doi || null,
    isbn: getIsbn(raw),
    series: raw.series || raw.series_name || raw.series_title || raw.series_title_name || raw.series_title_value || raw.series_title_text || null,
    publication: {
      year: publication.year || raw.publication_year || raw.year || null,
      volume: publication.volume || raw.volume || null,
      pages: publication.pages || raw.pages || null
    },
    venue: {
      id: venue.id || null,
      name: venue.name || raw.venue_name || null,
      issn: venue.issn || null,
      eissn: venue.eissn || null,
      scopus_id: venue.scopus_id || null,
      wikidata_id: venue.wikidata_id || null,
      openalex_id: venue.openalex_id || null,
      mag_id: venue.mag_id || null
    },
    publisher: {
      id: publisher.id || null,
      name: publisher.name || raw.publisher_name || null,
      type: publisher.type || null,
      country: publisher.country || null,
      ror_id: publisher.ror_id || null,
      wikidata_id: publisher.wikidata_id || null,
      openalex_id: publisher.openalex_id || null,
      mag_id: publisher.mag_id || null,
      url: publisher.url || null
    },
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

function download(filename: string, content: string, type?: string) {
  const blob = new Blob([content], { type: type || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

function downloadBlob(filename: string, content: Blob) {
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

export default function ClientActions({ work }: Props) {
  const t = useTranslations();
  const files = Array.isArray(work?.files) ? work.files : [];
  const onAdd = useCallback(() => {
    const list = readList();
    const item = toSavedItem(work);
    if (!item.id) return;
    if (list.some((x) => String(x.id) === String(item.id))) { showNotification(t('common.messages.itemExists'), 'info'); return; }
    list.push(item);
    writeList(list);
    updateHeaderCounter();
    showNotification(t('common.messages.added'), 'success');
  }, [work, t]);

  const onExportBib = useCallback(() => {
    const content = toBibTeX(work);
    download(`work-${work?.id || 'data'}.bib`, content || ' ', 'application/x-bibtex');
    showNotification(t('common.messages.bibExported'), 'success');
  }, [work, t]);

  const onExportJson = useCallback(() => {
    const normalizedSource = [normWork(work)];
    const normalized = normalizedSource.filter(Boolean).map((entry) => attachEid(entry as Record<string, any>));
    const exportedItems = [attachEid(work)];
    const payload = JSON.stringify({ items: exportedItems, normalized }, null, 2);
    download(`work-${work?.id || 'data'}.json`, payload, 'application/json');
    showNotification(t('common.messages.jsonExported'), 'success');
  }, [work, t]);

  const onExportApa = useCallback(() => {
    const run = async () => {
      const paragraph = toApaParagraph(work, t('common.entities.authorUnknown'));
      const doc = new Document({ sections: [{ children: [paragraph || new Paragraph(' ')] }] });
      const blob = await Packer.toBlob(doc);
      downloadBlob(`work-${work?.id || 'data'}-apa.docx`, blob);
      showNotification(t('common.messages.apaExported'), 'success');
    };
    void run();
  }, [work, t]);

  const doi = work?.doi || work?.publication?.doi;
  const scimagFile = files.find((file: any) => file?.scimag_id);
  const openAccessFile = files.find((file: any) => file?.openacess_id || file?.openaccess_id);
  const libgenFile = files.find((file: any) => file?.md5 && file?.libgen_id);
  const doiHref = doi ? `https://doi.org/${encodeURIComponent(String(doi))}` : undefined;
  const scihubTarget = scimagFile ? (scimagFile?.doi || doi) : null;
  const scihubHref = scimagFile && scihubTarget ? `https://sci-hub.se/${encodeURIComponent(String(scihubTarget))}` : undefined;
  const openAccessHref = openAccessFile?.best_oa_url || openAccessFile?.best_oa?.url || openAccessFile?.url;
  const libgenHref = libgenFile?.md5 ? `https://annas-archive.org/md5/${encodeURIComponent(String(libgenFile.md5))}` : undefined;
  const onOpenDoi = useCallback(() => {
    if (!doiHref) return;
    const w = window.open(doiHref, '_blank', 'noopener,noreferrer');
    if (w) w.opener = null;
  }, [doiHref]);
  const onOpenSciHub = useCallback(() => {
    if (!scihubHref) return;
    const w = window.open(scihubHref, '_blank', 'noopener,noreferrer');
    if (w) w.opener = null;
  }, [scihubHref]);
  const onOpenBestOa = useCallback(() => {
    if (!openAccessHref) return;
    const w = window.open(openAccessHref, '_blank', 'noopener,noreferrer');
    if (w) w.opener = null;
  }, [openAccessHref]);
  const onOpenLibgen = useCallback(() => {
    if (!libgenHref) return;
    const w = window.open(libgenHref, '_blank', 'noopener,noreferrer');
    if (w) w.opener = null;
  }, [libgenHref]);

  return (
    <>
      {doiHref ? (
        <button type="button" className="action-btn btn-positive" onClick={onOpenDoi}>{t('common.actions.openDoi')}</button>
      ) : null}
      <button type="button" className="action-btn btn-positive" onClick={onAdd}>{t('common.actions.addToList')}</button>
      {scihubHref ? (
        <button type="button" className="action-btn btn-positive" onClick={onOpenSciHub}>{t('common.actions.openSciHub')}</button>
      ) : null}
      {libgenHref ? (
        <button type="button" className="action-btn btn-positive" onClick={onOpenLibgen}>{t('common.actions.openLibgen')}</button>
      ) : null}
      {openAccessHref ? (
        <button type="button" className="action-btn btn-positive" onClick={onOpenBestOa}>{t('common.actions.openBestOa')}</button>
      ) : null}
      <button type="button" className="action-btn btn-positive" onClick={onExportJson}>{t('common.actions.exportJson')}</button>
      <button type="button" className="action-btn btn-positive" onClick={onExportBib}>{t('common.actions.exportBib')}</button>
      <button type="button" className="action-btn btn-positive" onClick={onExportApa}>{t('common.actions.exportApa')}</button>
    </>
  );
}

function getAuthorTokens(work: any) {
  const raw = work?.authors || work?.authors_preview || work?.author_string || [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') return raw.split(';').map((part) => part.trim()).filter(Boolean);
  return [];
}

function getFilesList(work: any) {
  const files = work?.files;
  if (Array.isArray(files)) return files;
  if (files && typeof files === 'object') {
    if (Array.isArray(files.data)) return files.data;
    if (Array.isArray(files.items)) return files.items;
    if (Array.isArray(files.results)) return files.results;
  }
  return [];
}

function getMd5(work: any) {
  if (!work) return '';
  const direct = work?.md5;
  if (direct) return String(direct);
  const files = getFilesList(work);
  const fromFiles = files.map((file: any) => file?.md5 || file?.md5_hash || file?.md5sum || file?.md5Hash || file?.checksum).find(Boolean);
  return fromFiles ? String(fromFiles) : '';
}

function normalizeValue(value: any) {
  return value ? String(value).replace(/\s+/g, ' ').trim() : '';
}

function formatAccessLink(id: string | number | null | undefined) {
  if (id === null || id === undefined) return '';
  const value = String(id).trim();
  return value ? `ethnos.app/works/${encodeURIComponent(value)}` : '';
}

function normalizeDoi(value: any) {
  const raw = normalizeValue(value);
  if (!raw) return '';
  return raw.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '');
}

function getIsbn(work: any) {
  const direct = work?.isbn;
  if (Array.isArray(direct)) return direct.map((item: any) => normalizeValue(item)).filter(Boolean).join(' ');
  if (direct) return normalizeValue(direct);
  const identifiers = work?.identifiers;
  if (Array.isArray(identifiers?.isbn)) return identifiers.isbn.map((item: any) => normalizeValue(item)).filter(Boolean).join(' ');
  if (identifiers?.isbn) return normalizeValue(identifiers.isbn);
  return '';
}

function toBibTeX(work: any) {
  const idValue = work?.id ? String(work.id) : '';
  const id = idValue || 'entry';
  const typeRaw = (work?.work_type || work?.type || '').toString().toLowerCase();
  const type = typeRaw === 'book' ? 'book' : typeRaw === 'chapter' ? 'incollection' : typeRaw === 'conference' ? 'inproceedings' : 'article';
  const title = work?.title || '';
  const year = work?.publication?.year || work?.publication_year || work?.year || '';
  const venue = work?.venue?.name || work?.venue_name || '';
  const doi = normalizeDoi(work?.doi || work?.publication?.doi);
  const md5 = getMd5(work);
  const isbn = getIsbn(work);
  const language = normalizeValue(work?.language);
  const publisher = normalizeValue(work?.publisher?.name || work?.publisher_name);
  const series = normalizeValue(work?.series?.name || work?.series);
  const accessLink = formatAccessLink(idValue);
  const volume = work?.publication?.volume || work?.volume || '';
  const pages = work?.publication?.pages || work?.pages || '';
  const authors = getAuthorTokens(work).map((item: any) => {
    if (typeof item === 'string') return item;
    const family = item?.family_name || '';
    const given = item?.given_names || '';
    const name = item?.preferred_name || item?.name || '';
    if (family || given) return [family, given].filter(Boolean).join(', ');
    return name;
  }).filter(Boolean).join(' and ');
  const annoteParts = [];
  if (accessLink) annoteParts.push(`Access: ${accessLink}`);
  if (md5) {
    const abstract = normalizeValue(work?.abstract);
    const fileInfo = `File: pdf \\textbar MD5: ${md5}`;
    annoteParts.push(abstract ? `${fileInfo} \\textbar Abstract: ${abstract}` : fileInfo);
  }
  const annote = annoteParts.join(' \\textbar ');
  const fields = [
    ['author', authors],
    ['annote', annote],
    ['publisher', publisher],
    ['language', language],
    ['isbn', isbn],
    ['year', year ? String(year) : ''],
    ['doi', doi],
    ['title', title],
    ['series', series],
    ['journal', type === 'article' ? venue : ''],
    ['volume', volume],
    ['pages', pages]
  ].filter(([, value]) => value);
  const lines = fields.map(([key, value]) => `  ${key} = {${String(value)}}`);
  return `@${type}{${id},\n${lines.join(',\n')}\n}`;
}

function toApaParagraph(work: any, fallbackAuthor: string) {
  const typeRaw = (work?.work_type || work?.type || '').toString().toLowerCase();
  const isBook = typeRaw === 'book';
  const isArticle = typeRaw === 'article' || typeRaw === 'journal';
  const authors = getAuthorTokens(work).map((item: any) => {
    if (typeof item === 'string') return item;
    const family = item?.family_name || item?.name || '';
    const given = item?.given_names || '';
    const initials = given
      ? given.split(/\s+/).filter(Boolean).map((part: string) => part.charAt(0).toUpperCase() + '.').join(' ')
      : '';
    const name = family ? `${family}${initials ? `, ${initials}` : ''}` : (item?.preferred_name || '');
    return name;
  }).filter(Boolean);
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
  const volume = work?.publication?.volume || work?.volume || '';
  const pages = work?.publication?.pages || work?.pages || '';
  const publisher = work?.publisher?.name || work?.publisher_name || '';
  const isbn = getIsbn(work);
  const doi = normalizeDoi(work?.doi || work?.publication?.doi);
  const accessLink = formatAccessLink(work?.id);
  const children: TextRun[] = [];
  if (authorText) children.push(new TextRun({ text: authorText }));
  if (year) children.push(new TextRun({ text: ` (${year}).` }));
  if (titleText) children.push(new TextRun({ text: ` ${titleText}.`, italics: isBook }));
  if (isArticle && venue) {
    children.push(new TextRun({ text: ` ${venue}`, italics: true }));
    if (volume) children.push(new TextRun({ text: `, ${volume}`, italics: true }));
    if (pages) children.push(new TextRun({ text: `, ${pages}` }));
    children.push(new TextRun({ text: '.' }));
  } else {
    if (venue) children.push(new TextRun({ text: ` ${venue}.`, italics: true }));
    if (publisher) children.push(new TextRun({ text: ` ${publisher}.` }));
    if (volume || pages) {
      const volumeText = volume ? ` ${volume}` : '';
      if (volumeText) children.push(new TextRun({ text: volumeText, italics: true }));
      if (pages) children.push(new TextRun({ text: `${volumeText ? ', ' : ' '}${pages}.` }));
      else if (volumeText) children.push(new TextRun({ text: '.' }));
    }
  }
  if (isbn) children.push(new TextRun({ text: ` ISBN: ${isbn}.` }));
  if (doi) children.push(new TextRun({ text: ` DOI: ${doi}.` }));
  if (accessLink) children.push(new TextRun({ text: ` Access: ${accessLink}.` }));
  if (!children.length) return null;
  return new Paragraph({ children, alignment: AlignmentType.JUSTIFIED });
}

function normalizeList(value: any) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === 'object' && 'id' in item);
}
