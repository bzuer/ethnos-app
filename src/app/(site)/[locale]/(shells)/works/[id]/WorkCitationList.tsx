'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { WorkResultList } from '@/components/common/WorkResultItem';
import { actGetWorkCitations, actGetWorkReferences } from '@/lib/actions';
import { formatMetadataAuthors } from '@/lib/works';

type Props = {
  workId: string;
  kind: 'citations' | 'references';
  initialItems: any[];
  total: number;
};

const idOf = (item: any) => (item?.id !== null && item?.id !== undefined ? String(item.id) : '');

export default function WorkCitationList({ workId, kind, initialItems, total }: Props) {
  const t = useTranslations();
  const [items, setItems] = useState<any[]>(initialItems);
  const [nextPage, setNextPage] = useState(kind === 'citations' ? 2 : 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const seenRef = useRef<Set<string>>(new Set(initialItems.map(idOf).filter(Boolean)));

  const labels = {
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
    return Number.isFinite(count) && count > 0 ? t('common.meta.authorsCount', { count }) : '';
  };

  const hasMore = !exhausted && items.length < total;

  const loadMore = async () => {
    setLoading(true);
    setError(false);
    try {
      const load = kind === 'citations' ? actGetWorkCitations : actGetWorkReferences;
      const fresh: any[] = [];
      let page = nextPage;
      let hasNext = true;
      while (hasNext && fresh.length < 25) {
        const res = await load(workId, page);
        page += 1;
        hasNext = res.hasNext && res.items.length > 0;
        res.items.forEach((item: any) => {
          const key = idOf(item);
          if (key && seenRef.current.has(key)) return;
          if (key) seenRef.current.add(key);
          fresh.push(item);
        });
      }
      setItems((prev) => [...prev, ...fresh]);
      setNextPage(page);
      if (!hasNext) setExhausted(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <WorkResultList items={items} labels={labels} pickAuthors={pickAuthors} />
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
