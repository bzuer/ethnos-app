import type { toListItem } from './work-export';

export type ReadingListItem = ReturnType<typeof toListItem> & { added_at?: string };

const STORAGE_KEY = 'ethnos_app_personal_list';
const CHANGE_EVENT = 'ethnos:personal-list-updated';

export function readList(): ReadingListItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === 'object' && 'id' in item) : [];
  } catch {
    return [];
  }
}

export function writeList(items: ReadingListItem[]) {
  try {
    if (items.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {}
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function isListed(id: string | number) {
  return readList().some((item) => String(item.id) === String(id));
}

export function subscribeToList(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}
