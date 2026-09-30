'use client';

import { useSyncExternalStore } from 'react';
import { showNotification } from '@/lib/notify';
import { isListed, readList, subscribeToList, writeList, type ReadingListItem } from '@/lib/reading-list';

type Props = {
  item: ReadingListItem;
  labels: { add: string; inList: string; remove: string; added: string; removed: string };
};

export default function ListToggleBadge({ item, labels }: Props) {
  const id = String(item.id);
  const inList = useSyncExternalStore(subscribeToList, () => isListed(id), () => false);

  const onToggle = () => {
    const list = readList();
    if (list.some((entry) => String(entry.id) === id)) {
      writeList(list.filter((entry) => String(entry.id) !== id));
      showNotification(labels.removed, 'error');
    } else {
      writeList([...list, { ...item, added_at: new Date().toISOString() }]);
      showNotification(labels.added, 'success');
    }
  };

  return (
    <button
      type="button"
      className={`badge badge-list-toggle${inList ? ' in-list' : ''}`}
      onClick={onToggle}
      aria-label={inList ? labels.remove : labels.add}
    >
      {inList ? (
        <>
          <span className="badge-list-label">{labels.inList}</span>
          <span className="badge-list-label-hover">{labels.remove}</span>
        </>
      ) : labels.add}
    </button>
  );
}
