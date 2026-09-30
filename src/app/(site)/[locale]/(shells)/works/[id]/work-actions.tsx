'use client';
import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { actGetWorkFull } from '@/lib/actions';
import { showNotification } from '@/lib/notify';
import { EXPORT_MIME, downloadBlob, downloadJson, downloadText } from '@/lib/download';
import { buildWorkExport } from '@/lib/entity-export';
import { readList, writeList, type ReadingListItem } from '@/lib/reading-list';
import { normWork, toBibTeX, toRIS, type WorkAccessLinks } from '@/lib/work-export';

type Props = {
  workId: string;
  filename: string;
  links: WorkAccessLinks;
  listItem: ReadingListItem;
};

export default function ClientActions({ workId, filename, links, listItem }: Props) {
  const t = useTranslations();
  const workRef = useRef<any>(null);
  const [busy, setBusy] = useState(false);

  const onAdd = () => {
    const list = readList();
    if (!listItem.id) return;
    if (list.some((x) => String(x.id) === String(listItem.id))) {
      showNotification(t('common.messages.itemExists'), 'info');
      return;
    }
    writeList([...list, { ...listItem, added_at: new Date().toISOString() }]);
    showNotification(t('common.messages.added'), 'success');
  };

  const withWork = (run: (work: any) => void | Promise<void>) => async () => {
    setBusy(true);
    try {
      workRef.current ??= await actGetWorkFull(workId);
      if (!workRef.current) {
        showNotification(t('common.states.unableToLoadWorks'), 'error');
        return;
      }
      await run(workRef.current);
    } finally {
      setBusy(false);
    }
  };

  const onExportJson = withWork((work) => {
    downloadJson(`${filename}.json`, buildWorkExport(work));
    showNotification(t('common.messages.jsonExported'), 'success');
  });

  const onExportBib = withWork((work) => {
    const normalized = normWork(work);
    downloadText(`${filename}.bib`, normalized ? toBibTeX(normalized) : '', EXPORT_MIME.bibtex);
    showNotification(t('common.messages.bibExported'), 'success');
  });

  const onExportRis = withWork((work) => {
    const normalized = normWork(work);
    downloadText(`${filename}.ris`, normalized ? toRIS(normalized) : '', EXPORT_MIME.ris);
    showNotification(t('common.messages.risExported'), 'success');
  });

  const onExportApa = withWork(async (work) => {
    const { buildApaDocxBlob } = await import('@/lib/work-export-docx');
    downloadBlob(`${filename}-apa.docx`, await buildApaDocxBlob([work], t('common.entities.authorUnknown')));
    showNotification(t('common.messages.apaExported'), 'success');
  });

  const external = (href: string | undefined, label: string) => (href ? (
    <a className="action-btn btn-positive" href={href} target="_blank" rel="noopener noreferrer">{label}</a>
  ) : null);

  return (
    <>
      {external(links.doi, t('common.actions.openDoi'))}
      <button type="button" className="action-btn btn-positive" onClick={onAdd}>{t('common.actions.addToList')}</button>
      {external(links.sciHub, t('common.actions.openSciHub'))}
      {external(links.libgen, t('common.actions.openLibgen'))}
      {external(links.openAccess, t('common.actions.openBestOa'))}
      <button type="button" className="action-btn btn-positive" onClick={onExportJson} disabled={busy}>{t('common.actions.exportJson')}</button>
      <button type="button" className="action-btn btn-positive" onClick={onExportBib} disabled={busy}>{t('common.actions.exportBib')}</button>
      <button type="button" className="action-btn btn-positive" onClick={onExportRis} disabled={busy}>{t('common.actions.exportRis')}</button>
      <button type="button" className="action-btn btn-positive" onClick={onExportApa} disabled={busy}>{t('common.actions.exportApa')}</button>
    </>
  );
}
