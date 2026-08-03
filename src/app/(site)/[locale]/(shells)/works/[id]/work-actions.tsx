'use client';
import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { showNotification } from '@/lib/notify';
import { EXPORT_MIME, downloadBlob, downloadJson, downloadText } from '@/lib/download';
import { buildWorkExport, exportFilename } from '@/lib/entity-export';
import {
  buildFileOpenAccessUrl,
  normWork,
  pickLibgenFile,
  pickOpenAccessFile,
  pickScimagFile,
  toBibTeX,
  toRIS
} from '@/lib/work-export';

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

export default function ClientActions({ work }: Props) {
  const t = useTranslations();
  const files = Array.isArray(work?.files) ? work.files : [];
  const base = exportFilename('work', work);

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

  const onExportJson = useCallback(() => {
    downloadJson(`${base}.json`, buildWorkExport(work));
    showNotification(t('common.messages.jsonExported'), 'success');
  }, [base, work, t]);

  const onExportBib = useCallback(() => {
    const normalized = normWork(work);
    downloadText(`${base}.bib`, normalized ? toBibTeX(normalized) : '', EXPORT_MIME.bibtex);
    showNotification(t('common.messages.bibExported'), 'success');
  }, [base, work, t]);

  const onExportRis = useCallback(() => {
    const normalized = normWork(work);
    downloadText(`${base}.ris`, normalized ? toRIS(normalized) : '', EXPORT_MIME.ris);
    showNotification(t('common.messages.risExported'), 'success');
  }, [base, work, t]);

  const onExportApa = useCallback(() => {
    const run = async () => {
      const { buildApaDocxBlob } = await import('@/lib/work-export-docx');
      const blob = await buildApaDocxBlob([work], t('common.entities.authorUnknown'));
      downloadBlob(`${base}-apa.docx`, blob);
      showNotification(t('common.messages.apaExported'), 'success');
    };
    void run();
  }, [base, work, t]);

  const doi = work?.doi || work?.publication?.doi;
  const scimagFile = pickScimagFile(files);
  const openAccessFile = pickOpenAccessFile(files);
  const libgenFile = pickLibgenFile(files);
  const doiHref = doi ? `https://doi.org/${encodeURIComponent(String(doi))}` : undefined;
  const scihubTarget = scimagFile ? (scimagFile?.doi || doi) : null;
  const scihubHref = scihubTarget ? `https://sci-hub.st/${encodeURIComponent(String(scihubTarget))}` : undefined;
  const openAccessHref = buildFileOpenAccessUrl(openAccessFile);
  const libgenHref = libgenFile ? `https://libgen.la/ads.php?md5=${encodeURIComponent(String(libgenFile.md5))}` : undefined;

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
      <button type="button" className="action-btn btn-positive" onClick={onExportRis}>{t('common.actions.exportRis')}</button>
      <button type="button" className="action-btn btn-positive" onClick={onExportApa}>{t('common.actions.exportApa')}</button>
    </>
  );
}

function normalizeList(value: any) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === 'object' && 'id' in item);
}
