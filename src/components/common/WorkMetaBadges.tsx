'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { getWorkOpenAccessDoiUrl } from '@/lib/works';
import { showNotification } from '@/lib/notify';

type SavedItem = {
  id: number | string;
  title?: string | null;
  authors?: any;
  publication_year?: number | string | null;
  venue_id?: number | string | null;
  venue_name?: string | null;
  type?: string | null;
  added_at?: string;
};

type Props = {
  work: any;
  openAccess: boolean;
  openAccessLabel: string;
  addToListLabel: string;
  inListLabel: string;
  removeFromListLabel: string;
  addedMessage: string;
  removedMessage: string;
  showOpenAccessBadge?: boolean;
  showListBadge?: boolean;
};

const STORAGE_KEY = 'ethnos_app_personal_list';
const LIST_UPDATED_EVENT = 'ethnos:personal-list-updated';

function normalizeList(value: any): SavedItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === 'object' && 'id' in item) as SavedItem[];
}

function readList(): SavedItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeList(JSON.parse(raw)) : [];
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

function dispatchListUpdatedEvent() {
  window.dispatchEvent(new Event(LIST_UPDATED_EVENT));
}

function toSavedItem(work: any, id: string | number): SavedItem {
  return {
    id,
    title: work?.title || null,
    authors: work?.authors || work?.authors_preview || work?.author_string || null,
    publication_year: work?.publication?.year || work?.publication_year || work?.year || null,
    venue_id: work?.venue?.id || work?.venue_id || null,
    venue_name: work?.venue?.name || work?.venue_name || null,
    type: work?.work_type || work?.type || null,
    added_at: new Date().toISOString()
  };
}

export default function WorkMetaBadges({
  work,
  openAccess,
  openAccessLabel,
  addToListLabel,
  inListLabel,
  removeFromListLabel,
  addedMessage,
  removedMessage,
  showOpenAccessBadge = true,
  showListBadge = true
}: Props) {
  const openAccessHref = useMemo(() => (openAccess && showOpenAccessBadge ? getWorkOpenAccessDoiUrl(work) : ''), [openAccess, showOpenAccessBadge, work]);
  const workId = useMemo(() => {
    const raw = work?.id ?? work?.work_id;
    if (raw === null || raw === undefined) return '';
    const normalized = String(raw).trim();
    return normalized || '';
  }, [work]);
  const canToggleList = Boolean(showListBadge && workId);
  const inList = useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === 'undefined') return () => undefined;
      const onStorage = () => onStoreChange();
      const onListUpdate = () => onStoreChange();
      window.addEventListener('storage', onStorage);
      window.addEventListener(LIST_UPDATED_EVENT, onListUpdate as EventListener);
      return () => {
        window.removeEventListener('storage', onStorage);
        window.removeEventListener(LIST_UPDATED_EVENT, onListUpdate as EventListener);
      };
    },
    () => {
      if (!canToggleList || !workId) return false;
      return readList().some((item) => String(item.id) === String(workId));
    },
    () => false
  );

  const onToggleList = useCallback(() => {
    if (!canToggleList || !workId) return;
    const list = readList();
    const idx = list.findIndex((item) => String(item.id) === String(workId));
    if (idx >= 0) {
      const next = list.filter((item) => String(item.id) !== String(workId));
      if (writeList(next)) {
        updateHeaderCounter();
        dispatchListUpdatedEvent();
        showNotification(removedMessage, 'error');
      }
      return;
    }
    const next = [...list, toSavedItem(work, workId)];
    if (writeList(next)) {
      updateHeaderCounter();
      dispatchListUpdatedEvent();
      showNotification(addedMessage, 'success');
    }
  }, [addedMessage, canToggleList, removedMessage, work, workId]);

  const showOpenAccess = Boolean(openAccess && showOpenAccessBadge);
  const showListToggleBadge = Boolean(canToggleList);
  if (!showOpenAccess && !showListToggleBadge) return null;

  return (
    <>
      {showOpenAccess ? (
        openAccessHref ? (
          <a className="badge open-acess badge-link" href={openAccessHref} target="_blank" rel="noopener noreferrer">
            {openAccessLabel}
          </a>
        ) : (
          <span className="badge open-acess">{openAccessLabel}</span>
        )
      ) : null}
      {showListToggleBadge ? (
        <button
          type="button"
          className={`badge badge-list-toggle${inList ? ' in-list' : ''}`}
          onClick={onToggleList}
          aria-label={inList ? removeFromListLabel : addToListLabel}
        >
          {inList ? (
            <>
              <span className="badge-list-label">{inListLabel}</span>
              <span className="badge-list-label-hover">{removeFromListLabel}</span>
            </>
          ) : (
            addToListLabel
          )}
        </button>
      ) : null}
    </>
  );
}
