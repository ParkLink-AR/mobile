import AsyncStorage from '@react-native-async-storage/async-storage';

// Which example notifications the user already read. The server doesn't know them, so marking
// everything read there leaves them unread -- and the tab's badge came back on every refresh.
// Kept on the device, so they stay read after reopening the app too.

const STORAGE_KEY = 'parklink-mock-notifications-read';

const seenIds = new Set<string>();
// "Mark all read" (opening the tab): every example notification from before then is read.
let allSeenBefore = 0;

AsyncStorage.getItem(STORAGE_KEY)
  .then((raw) => {
    if (!raw) return;
    const saved = JSON.parse(raw) as { ids?: string[]; allSeenBefore?: number };
    saved.ids?.forEach((id) => seenIds.add(id));
    allSeenBefore = Math.max(allSeenBefore, saved.allSeenBefore ?? 0);
  })
  .catch(() => {});

function persist() {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ids: [...seenIds], allSeenBefore })).catch(() => {});
}

/** What POST /notifications/read asked for: those ids, or all of them when there are none. */
export function markMockNotificationsRead(ids?: string[]): void {
  if (ids && ids.length > 0) ids.forEach((id) => seenIds.add(id));
  else allSeenBefore = Date.now();
  persist();
}

/** An example notification as it stands: read if the user already marked it so. */
export function withReadState<T extends { id: string; created_at?: string; read_at?: string | null }>(item: T): T {
  if (item.read_at) return item;
  const createdAt = item.created_at ? new Date(item.created_at).getTime() : 0;
  if (seenIds.has(item.id) || (allSeenBefore > 0 && createdAt <= allSeenBefore)) {
    return { ...item, read_at: new Date(seenIds.has(item.id) ? Date.now() : allSeenBefore).toISOString() };
  }
  return item;
}
