'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { showNotification } from '@/lib/notify';
import { normWork, toBibTeX, toRIS } from '@/lib/work-export';

type Props = {
  person: any;
  works: any[];
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

function personFilename(person: any): string {
  const id = person?.id ? String(person.id) : 'person';
  const name = person?.preferred_name || person?.name || [person?.given_names, person?.family_name].filter(Boolean).join(' ') || '';
  const slug = String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
  return slug ? `${slug}-${id}` : `person-${id}`;
}

export default function PersonTools({ person, works }: Props) {
  const t = useTranslations();
  const hasWorks = Array.isArray(works) && works.length > 0;
  const base = personFilename(person);

  const onExportPerson = useCallback(() => {
    const payload = JSON.stringify({
      exported_at: new Date().toISOString(),
      person
    }, null, 2);
    download(`${base}.json`, payload, 'application/json');
    showNotification(t('common.messages.jsonExported'), 'success');
  }, [base, person, t]);

  const onExportWorksJson = useCallback(() => {
    if (!hasWorks) return;
    const normalized = works.map((w) => normWork(w)).filter(Boolean);
    const payload = JSON.stringify({
      exported_at: new Date().toISOString(),
      person_id: person?.id ?? null,
      count: normalized.length,
      works: normalized
    }, null, 2);
    download(`${base}-works.json`, payload, 'application/json');
    showNotification(t('common.messages.jsonExported'), 'success');
  }, [base, hasWorks, person, t, works]);

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
      <button type="button" className="action-btn btn-positive" onClick={onExportPerson}>{t('persons.tools.exportPerson')}</button>
      <button type="button" className="action-btn btn-positive" onClick={onExportWorksJson} disabled={!hasWorks}>{t('persons.tools.exportWorksJson')}</button>
      <button type="button" className="action-btn btn-positive" onClick={onExportWorksBib} disabled={!hasWorks}>{t('persons.tools.exportWorksBib')}</button>
      <button type="button" className="action-btn btn-positive" onClick={onExportWorksRis} disabled={!hasWorks}>{t('persons.tools.exportWorksRis')}</button>
      <button type="button" className="action-btn btn-positive" onClick={onExportWorksApa} disabled={!hasWorks}>{t('persons.tools.exportWorksApa')}</button>
    </div>
  );
}
