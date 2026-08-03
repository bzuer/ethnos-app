'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { showNotification } from '@/lib/notify';
import { EXPORT_MIME, downloadBlob, downloadJson, downloadText } from '@/lib/download';
import {
  buildEntityExport,
  buildWorksExport,
  exportFilename,
  type EntityKind
} from '@/lib/entity-export';
import { normWork, toBibTeX, toRIS } from '@/lib/work-export';

export type { EntityKind };

type Props = {
  kind: EntityKind;
  entity: any;
  works: any[];
  entityExportLabel: string;
};

export default function EntityTools({ kind, entity, works, entityExportLabel }: Props) {
  const t = useTranslations();
  const hasWorks = Array.isArray(works) && works.length > 0;
  const base = exportFilename(kind, entity);

  const onExportEntity = useCallback(() => {
    downloadJson(`${base}.json`, buildEntityExport(kind, entity));
    showNotification(t('common.messages.jsonExported'), 'success');
  }, [base, entity, kind, t]);

  const onExportWorksJson = useCallback(() => {
    if (!hasWorks) return;
    downloadJson(`${base}-works.json`, buildWorksExport(works, { kind, entity }));
    showNotification(t('common.messages.jsonExported'), 'success');
  }, [base, entity, hasWorks, kind, t, works]);

  const onExportWorksBib = useCallback(() => {
    if (!hasWorks) return;
    const entries = works.map((work) => {
      const normalized = normWork(work);
      return normalized ? toBibTeX(normalized) : '';
    }).filter(Boolean);
    downloadText(`${base}-works.bib`, entries.join('\n\n'), EXPORT_MIME.bibtex);
    showNotification(t('common.messages.bibExported'), 'success');
  }, [base, hasWorks, t, works]);

  const onExportWorksRis = useCallback(() => {
    if (!hasWorks) return;
    const entries = works.map((work) => {
      const normalized = normWork(work);
      return normalized ? toRIS(normalized) : '';
    }).filter(Boolean);
    downloadText(`${base}-works.ris`, entries.join('\n\n'), EXPORT_MIME.ris);
    showNotification(t('common.messages.risExported'), 'success');
  }, [base, hasWorks, t, works]);

  const onExportWorksApa = useCallback(() => {
    if (!hasWorks) return;
    const run = async () => {
      const { buildApaDocxBlob } = await import('@/lib/work-export-docx');
      const blob = await buildApaDocxBlob(works, t('common.entities.authorUnknown'), { spacing: true });
      downloadBlob(`${base}-works-apa.docx`, blob);
      showNotification(t('common.messages.apaExported'), 'success');
    };
    void run();
  }, [base, hasWorks, t, works]);

  return (
    <div className="tools-actions">
      <button type="button" className="action-btn btn-positive" onClick={onExportEntity}>{entityExportLabel}</button>
      <button type="button" className="action-btn btn-positive" onClick={onExportWorksJson} disabled={!hasWorks}>{t('common.tools.exportWorksJson')}</button>
      <button type="button" className="action-btn btn-positive" onClick={onExportWorksBib} disabled={!hasWorks}>{t('common.tools.exportWorksBib')}</button>
      <button type="button" className="action-btn btn-positive" onClick={onExportWorksRis} disabled={!hasWorks}>{t('common.tools.exportWorksRis')}</button>
      <button type="button" className="action-btn btn-positive" onClick={onExportWorksApa} disabled={!hasWorks}>{t('common.tools.exportWorksApa')}</button>
    </div>
  );
}
