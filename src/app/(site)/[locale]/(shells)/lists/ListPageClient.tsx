'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import LocaleLink from '@/components/common/LocaleLink';
import { showNotification } from '@/lib/notify';
import { normWork, toBibTeX, toRIS } from '@/lib/work-export';

type SavedItem = { id: number | string; title?: string; authors?: any; publication_year?: number | string; venue_name?: string; type?: string; added_at?: string };
type Work = any;

const STORAGE_KEY = 'ethnos_app_personal_list';

function readList(): SavedItem[] {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v ? normalizeList(JSON.parse(v)) : [];
  } catch {
    return [];
  }
}

function writeList(items: SavedItem[]) {
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
  const url = `/api/works/${encodeURIComponent(String(id))}?include=${encodeURIComponent(include)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json: any = await res.json();
    return json?.data || json?.work || json || null;
  } catch {
    return null;
  }
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

async function exportApaDocx(items: any[], filename: string, fallbackAuthor: string) {
  const { buildApaDocxBlob } = await import('@/lib/work-export-docx');
  const blob = await buildApaDocxBlob(items, fallbackAuthor, { spacing: true });
  downloadFile(filename, blob, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}

export default function ListPageClient() {
  const t = useTranslations();
  const [items, setItems] = useState<SavedItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const hasItems = items.length > 0;

  useEffect(() => {
    const timer = setTimeout(() => {
      setItems(readList());
      setMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    updateHeaderCounter();
  }, [items.length]);

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
    const works = resolved.map(normWork).filter(Boolean);
    const payload = JSON.stringify({
      exported_at: new Date().toISOString(),
      count: works.length,
      works
    }, null, 2);
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
