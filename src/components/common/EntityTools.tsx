'use client';

import { useCallback, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { actGetEntityExportWorks } from '@/lib/actions';
import { showNotification } from '@/lib/notify';
import { EXPORT_MIME, downloadBlob, downloadJson, downloadText } from '@/lib/download';
import {
  buildEntityExport,
  buildWorksExport,
  exportFilename,
  type EntityExportWorks,
  type EntityKind
} from '@/lib/entity-export';
import { normWork, toBibTeX, toRIS } from '@/lib/work-export';

export type { EntityKind };

type Props = {
  kind: EntityKind;
  entity: any;
  worksCount: number;
  entityExportLabel: string;
};

export default function EntityTools({ kind, entity, worksCount, entityExportLabel }: Props) {
  const t = useTranslations();
  const [busy, setBusy] = useState(false);
  const cacheRef = useRef<EntityExportWorks | null>(null);
  const base = exportFilename(kind, entity);
  const hasWorks = Number(worksCount) > 0;
  const disabled = !hasWorks || busy;

  const onExportEntity = useCallback(() => {
    downloadJson(`${base}.json`, buildEntityExport(kind, entity));
    showNotification(t('common.messages.jsonExported'), 'success');
  }, [base, entity, kind, t]);

  const runWorksExport = useCallback((
    exporter: (result: EntityExportWorks) => void | Promise<void>,
    successMessage: string
  ) => {
    if (disabled) return;
    setBusy(true);
    void (async () => {
      try {
        const result = cacheRef.current || await actGetEntityExportWorks(kind, entity?.id);
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
  }, [disabled, entity, kind, t]);

  const onExportWorksJson = useCallback(() => {
    runWorksExport(
      (result) => downloadJson(`${base}-works.json`, buildWorksExport(result.works, { kind, entity, scope: result.scope })),
      t('common.messages.jsonExported')
    );
  }, [base, entity, kind, runWorksExport, t]);

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
      <button type="button" className="action-btn btn-positive" onClick={onExportEntity}>{entityExportLabel}</button>
      <button type="button" className="action-btn btn-positive" onClick={onExportWorksJson} disabled={disabled}>{t('common.tools.exportWorksJson')}</button>
      <button type="button" className="action-btn btn-positive" onClick={onExportWorksBib} disabled={disabled}>{t('common.tools.exportWorksBib')}</button>
      <button type="button" className="action-btn btn-positive" onClick={onExportWorksRis} disabled={disabled}>{t('common.tools.exportWorksRis')}</button>
      <button type="button" className="action-btn btn-positive" onClick={onExportWorksApa} disabled={disabled}>{t('common.tools.exportWorksApa')}</button>
    </div>
  );
}
