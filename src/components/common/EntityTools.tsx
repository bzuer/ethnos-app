'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { showNotification } from '@/lib/notify';
import { normWork, toBibTeX, toRIS } from '@/lib/work-export';

export type EntityKind = 'person' | 'venue' | 'institution' | 'subject';

type Props = {
  kind: EntityKind;
  entity: any;
  works: any[];
  entityExportLabel: string;
};

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  downloadBlob(filename, blob);
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

function entityName(entity: any): string {
  if (!entity) return '';
  const candidate = entity?.preferred_name
    || entity?.name
    || entity?.term
    || entity?.title
    || [entity?.given_names, entity?.family_name].filter(Boolean).join(' ');
  return candidate ? String(candidate) : '';
}

function entityFilename(entity: any, kind: EntityKind): string {
  const id = entity?.id ? String(entity.id) : kind;
  const slug = entityName(entity)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return slug ? `${slug}-${id}` : `${kind}-${id}`;
}

export default function EntityTools({ kind, entity, works, entityExportLabel }: Props) {
  const t = useTranslations();
  const hasWorks = Array.isArray(works) && works.length > 0;
  const base = entityFilename(entity, kind);

  const onExportEntity = useCallback(() => {
    const payload = JSON.stringify({
      exported_at: new Date().toISOString(),
      [kind]: entity
    }, null, 2);
    download(`${base}.json`, payload, 'application/json');
    showNotification(t('common.messages.jsonExported'), 'success');
  }, [base, entity, kind, t]);

  const onExportWorksJson = useCallback(() => {
    if (!hasWorks) return;
    const normalized = works.map((w) => normWork(w)).filter(Boolean);
    const payload = JSON.stringify({
      exported_at: new Date().toISOString(),
      [`${kind}_id`]: entity?.id ?? null,
      count: normalized.length,
      works: normalized
    }, null, 2);
    download(`${base}-works.json`, payload, 'application/json');
    showNotification(t('common.messages.jsonExported'), 'success');
  }, [base, entity, hasWorks, kind, t, works]);

  const onExportWorksBib = useCallback(() => {
    if (!hasWorks) return;
    const entries = works.map((w) => {
      const nw = normWork(w);
      return nw ? toBibTeX(nw) : '';
    }).filter(Boolean);
    download(`${base}-works.bib`, entries.join('\n\n'), 'application/x-bibtex');
    showNotification(t('common.messages.bibExported'), 'success');
  }, [base, hasWorks, t, works]);

  const onExportWorksRis = useCallback(() => {
    if (!hasWorks) return;
    const entries = works.map((w) => {
      const nw = normWork(w);
      return nw ? toRIS(nw) : '';
    }).filter(Boolean);
    download(`${base}-works.ris`, entries.join('\n\n'), 'application/x-research-info-systems');
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
