'use client';
import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Document, Packer, Paragraph } from 'docx';
import { showNotification } from '@/lib/notify';
import { normWork, toBibTeX, toApaParagraph } from '@/lib/work-export';

type Props = { work: any };

const STORAGE_KEY = 'ethnos_app_personal_list';

function readList(): any[] {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v ? normalizeList(JSON.parse(v)) : [];
  } catch {
    return [];
  }
}

function writeList(items: any[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

function updateHeaderCounter() {
  const el = document.getElementById('reading-list-counter');
  if (el) el.textContent = String(readList().length);
}

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

function download(filename: string, content: string, type?: string) {
  const blob = new Blob([content], { type: type || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadBlob(filename: string, content: Blob) {
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ClientActions({ work }: Props) {
  const t = useTranslations();
  const files = Array.isArray(work?.files) ? work.files : [];

  const onAdd = useCallback(() => {
    const list = readList();
    const item = toSavedItem(work);
    if (!item.id) return;
    if (list.some((x) => String(x.id) === String(item.id))) {
      showNotification(t('common.messages.itemExists'), 'info');
      return;
    }
    list.push(item);
    writeList(list);
    updateHeaderCounter();
    showNotification(t('common.messages.added'), 'success');
  }, [work, t]);

  const onExportBib = useCallback(() => {
    const nw = normWork(work);
    const content = nw ? toBibTeX(nw) : '';
    download(`work-${work?.id || 'data'}.bib`, content || ' ', 'application/x-bibtex');
    showNotification(t('common.messages.bibExported'), 'success');
  }, [work, t]);

  const onExportJson = useCallback(() => {
    const nw = normWork(work);
    const works = nw ? [nw] : [];
    const payload = JSON.stringify({
      exported_at: new Date().toISOString(),
      count: works.length,
      works
    }, null, 2);
    download(`work-${work?.id || 'data'}.json`, payload, 'application/json');
    showNotification(t('common.messages.jsonExported'), 'success');
  }, [work, t]);

  const onExportApa = useCallback(() => {
    const run = async () => {
      const nw = normWork(work);
      const paragraph = nw ? toApaParagraph(nw, t('common.entities.authorUnknown')) : null;
      const doc = new Document({ sections: [{ children: [paragraph || new Paragraph(' ')] }] });
      const blob = await Packer.toBlob(doc);
      downloadBlob(`work-${work?.id || 'data'}-apa.docx`, blob);
      showNotification(t('common.messages.apaExported'), 'success');
    };
    void run();
  }, [work, t]);

  const doi = work?.doi || work?.publication?.doi;
  const scimagFile = files.find((file: any) => file?.scimag_id);
  const openAccessFile = files.find((file: any) => file?.best_oa_url || file?.best_oa?.url || file?.openacess_id || file?.openaccess_id);
  const libgenFile = files.find((file: any) => file?.md5 && file?.libgen_id);
  const doiHref = doi ? `https://doi.org/${encodeURIComponent(String(doi))}` : undefined;
  const scihubTarget = scimagFile ? (scimagFile?.doi || doi) : null;
  const scihubHref = scimagFile && scihubTarget ? `https://sci-hub.st/${encodeURIComponent(String(scihubTarget))}` : undefined;
  const openAccessHref = openAccessFile?.best_oa_url || openAccessFile?.best_oa?.url || openAccessFile?.url;
  const libgenHref = libgenFile?.md5 ? `https://libgen.la/ads.php?md5=${encodeURIComponent(String(libgenFile.md5))}` : undefined;

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

function normalizeList(value: any) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === 'object' && 'id' in item);
}
