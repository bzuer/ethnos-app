'use client';

import { useSyncExternalStore } from 'react';
import { readList, subscribeToList } from '@/lib/reading-list';

export default function ReadingListCounter({ label }: { label: string }) {
  const count = useSyncExternalStore(subscribeToList, () => readList().length, () => 0);
  return <span id="reading-list-counter" className="list-counter" aria-label={label}>{count}</span>;
}
