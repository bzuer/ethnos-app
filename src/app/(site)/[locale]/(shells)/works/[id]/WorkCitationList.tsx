'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import WorkRelatedList from './WorkRelatedList';
import { actGetWorkCitations, actGetWorkReferences } from '@/lib/actions';
import { formatMetadataAuthors } from '@/lib/works';

type UnresolvedRef = { doi: string | null; status?: string | null };

type Props = {
  workId: string;
  kind: 'citations' | 'references';
  initialItems: any[];
  initialUnresolved?: UnresolvedRef[];
  total: number;
};

const idOf = (item: any) => {
  const id = item?.id ?? item?.work_id;
  return id !== null && id !== undefined ? String(id) : '';
};

const mergeUnresolved = (prev: UnresolvedRef[], next: UnresolvedRef[]) => {
  const seen = new Set(prev.map((entry) => String(entry.doi || '')));
  const merged = [...prev];
  next.forEach((entry) => {
    const key = String(entry.doi || '');
    if (key && seen.has(key)) return;
    if (key) seen.add(key);
    merged.push(entry);
  });
  return merged;
};

export default function WorkCitationList({ workId, kind, initialItems, initialUnresolved = [], total }: Props) {
  const t = useTranslations();
  const [items, setItems] = useState<any[]>(initialItems);
  const [unresolved, setUnresolved] = useState<UnresolvedRef[]>(initialUnresolved);
  const [nextPage, setNextPage] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const seenRef = useRef<Set<string>>(new Set(initialItems.map(idOf).filter(Boolean)));

  const relatedLabels = {
    titleUnavailable: t('common.entities.titleUnavailable'),
    authorUnknown: t('common.entities.authorUnknown'),
    openAccess: t('common.meta.openAccess'),
    addToList: t('common.actions.addToList'),
    inList: t('common.actions.inList'),
    removeFromList: t('common.actions.removeFromList'),
    added: t('common.messages.added'),
    itemRemoved: t('common.messages.itemRemoved'),
    citedBy: t('common.meta.citedBy'),
    references: t('common.meta.references')
  };

  const pickAuthors = (item: any) => {
    const names = formatMetadataAuthors(item);
    if (names) return names;
    const count = Number(item?.authors_count);
    if (Number.isFinite(count) && count > 0) return t('common.meta.authorsCount', { count });
    return '';
  };

  const hasMore = !exhausted && items.length < total;

  const loadMore = async () => {
    setLoading(true);
    setError(false);
    try {
      const res: any = kind === 'citations'
        ? await actGetWorkCitations(workId, nextPage)
        : await actGetWorkReferences(workId, nextPage);
      const incoming: any[] = Array.isArray(res?.items) ? res.items : [];
      const fresh = incoming.filter((item) => {
        const key = idOf(item);
        if (!key) return true;
        if (seenRef.current.has(key)) return false;
        seenRef.current.add(key);
        return true;
      });
      setItems((prev) => [...prev, ...fresh]);
      if (kind === 'references' && Array.isArray(res?.unresolved)) {
        setUnresolved((prev) => mergeUnresolved(prev, res.unresolved));
      }
      setNextPage((prev) => prev + 1);
      if (!res?.hasNext || incoming.length === 0) setExhausted(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <WorkRelatedList items={items} labels={relatedLabels} pickAuthors={pickAuthors} />
      {kind === 'references' && unresolved.length > 0 ? (
        <section className="unresolved-references" aria-label={t('works.detail.unresolvedReferences')}>
          <h3 className="title-section">{t('works.detail.unresolvedReferences')}</h3>
          <ul className="results-list">
            {unresolved.map((entry, index) => (
              <li className="result-item" key={`${entry.doi || 'unresolved'}-${index}`}>
                {entry.doi ? (
                  <a className="action-link" href={`https://doi.org/${encodeURIComponent(entry.doi)}`} target="_blank" rel="noopener noreferrer">{entry.doi}</a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {error ? (
        <p className="temporary-message temporary-message-error" role="status" aria-live="polite">{t('common.states.unableToLoadWorks')}</p>
      ) : null}
      {hasMore ? (
        <nav className="pagination-nav" aria-label={t('common.labels.pagination')}>
          <button type="button" className="pagination-btn btn-positive" onClick={loadMore} disabled={loading}>
            {loading ? t('common.states.loadingWorks') : t('common.actions.loadMore')}
          </button>
        </nav>
      ) : null}
    </>
  );
}
