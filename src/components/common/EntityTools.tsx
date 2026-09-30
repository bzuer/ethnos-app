'use client';

import { useCallback, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { actGetEntityExportWorks, actGetEntityRecord } from '@/lib/actions';
import { showNotification } from '@/lib/notify';
import { EXPORT_MIME, downloadBlob, downloadJson, downloadText } from '@/lib/download';
import {
  buildEntityExport,
  buildWorksExport,
  type EntityExportWorks,
  type EntityKind
} from '@/lib/entity-export';
import { normWork, toBibTeX, toRIS } from '@/lib/work-export';

export type { EntityKind };

type Props = {
  kind: EntityKind;
  entityId: string | number;
  filename: string;
  worksCount: number;
  entityExportLabel: string;
};

export default function EntityTools({ kind, entityId, filename: base, worksCount, entityExportLabel }: Props) {
  const t = useTranslations();
  const [busy, setBusy] = useState(false);
  const cacheRef = useRef<EntityExportWorks | null>(null);
  const hasWorks = Number(worksCount) > 0;
  const disabled = !hasWorks || busy;

  const onExportEntity = useCallback(() => {
    setBusy(true);
    void (async () => {
      try {
        const record = await actGetEntityRecord(kind, entityId);
        if (!record) {
          showNotification(t('common.states.unableToLoadWorks'), 'error');
          return;
        }
        downloadJson(`${base}.json`, buildEntityExport(kind, record));
        showNotification(t('common.messages.jsonExported'), 'success');
      } finally {
        setBusy(false);
      }
    })();
  }, [base, entityId, kind, t]);

  const runWorksExport = useCallback((
    exporter: (result: EntityExportWorks) => void | Promise<void>,
    successMessage: string
  ) => {
    if (disabled) return;
    setBusy(true);
    void (async () => {
      try {
        const result = cacheRef.current || await actGetEntityExportWorks(kind, entityId);
        cacheRef.current = result;
        if (!result.works.length) {
          showNotification(
            result.scope.year
              ? t('common.messages.noWorksForYear', { year: result.scope.year })
              : t('common.messages.noWorksToExport'),
            'info'
          );
          return;
        }
        await exporter(result);
        showNotification(successMessage, 'success');
        if (result.scope.truncated) showNotification(t('common.messages.exportTruncated', { count: result.works.length }), 'info');
      } catch {
        showNotification(t('common.states.unableToLoadWorks'), 'error');
      } finally {
        setBusy(false);
      }
    })();
  }, [disabled, entityId, kind, t]);

  const onExportWorksJson = useCallback(() => {
    runWorksExport(
      (result) => downloadJson(`${base}-works.json`, buildWorksExport(result.works, { kind, entity: { id: entityId }, scope: result.scope })),
      t('common.messages.jsonExported')
    );
  }, [base, entityId, kind, runWorksExport, t]);

  const onExportWorksBib = useCallback(() => {
    runWorksExport((result) => {
      const entries = result.works.map((work) => {
        const normalized = normWork(work);
        return normalized ? toBibTeX(normalized) : '';
      }).filter(Boolean);
      downloadText(`${base}-works.bib`, entries.join('\n\n'), EXPORT_MIME.bibtex);
    }, t('common.messages.bibExported'));
  }, [base, runWorksExport, t]);

  const onExportWorksRis = useCallback(() => {
    runWorksExport((result) => {
      const entries = result.works.map((work) => {
        const normalized = normWork(work);
        return normalized ? toRIS(normalized) : '';
      }).filter(Boolean);
      downloadText(`${base}-works.ris`, entries.join('\n\n'), EXPORT_MIME.ris);
    }, t('common.messages.risExported'));
  }, [base, runWorksExport, t]);

  const onExportWorksApa = useCallback(() => {
    runWorksExport(async (result) => {
      const { buildApaDocxBlob } = await import('@/lib/work-export-docx');
      const blob = await buildApaDocxBlob(result.works, t('common.entities.authorUnknown'), { spacing: true });
      downloadBlob(`${base}-works-apa.docx`, blob);
    }, t('common.messages.apaExported'));
  }, [base, runWorksExport, t]);

  return (
    <div className="tools-actions">
      <button type="button" className="action-btn btn-positive" onClick={onExportEntity} disabled={busy}>{entityExportLabel}</button>
      <button type="button" className="action-btn btn-positive" onClick={onExportWorksJson} disabled={disabled}>{t('common.tools.exportWorksJson')}</button>
      <button type="button" className="action-btn btn-positive" onClick={onExportWorksBib} disabled={disabled}>{t('common.tools.exportWorksBib')}</button>
      <button type="button" className="action-btn btn-positive" onClick={onExportWorksRis} disabled={disabled}>{t('common.tools.exportWorksRis')}</button>
      <button type="button" className="action-btn btn-positive" onClick={onExportWorksApa} disabled={disabled}>{t('common.tools.exportWorksApa')}</button>
    </div>
  );
}
