import { create } from 'zustand';
import { markNotificationsReadApi } from '@/src/api/notifications';
import { AppNotification, getNotificationsPage } from '@/src/services/notificationsFeed';

interface NotificationsState {
  /** Newest first: the first page, plus any older pages loaded by scrolling. */
  items: AppNotification[];
  /** From the server -- the badge on the notifications tab. */
  unreadCount: number;
  nextBefore: string | null;
  loading: boolean;
  loadingMore: boolean;
  /** True once the first refresh() has resolved -- lets the screen show a full-screen
   *  spinner instead of flashing the "no notifications" empty state before the first
   *  fetch completes. Reset on clear() so a new session gets its own first-load spinner. */
  hasLoadedOnce: boolean;
  /** Booking requests the owner just accepted or rejected from this device -- hidden right
   *  away, before the server's own "answered" mark comes back with the next refresh. */
  answeredBookingIds: string[];
  /** The notifications that were unread during the current visit to the notifications
   *  tab: they keep their "new" look for the rest of the visit, even though they're marked
   *  read on the server as soon as they're shown. */
  freshIds: string[];
  /** The user opened the notifications tab: a new visit starts. */
  startVisit: () => void;
  /** Reloads the newest page and the unread count. */
  refresh: () => Promise<void>;
  /** Appends the next older page, if any. */
  loadMore: () => Promise<void>;
  /** Marks everything read (the notifications tab is on screen), remembering what was
   *  unread in freshIds. */
  markAllRead: () => Promise<void>;
  markAnswered: (bookingId: string) => void;
  clear: () => void;
}

// Each refresh() gets a number; only the latest one to start may apply its result, so a
// slow response can never overwrite a newer one (refreshes come from the live socket, the
// tab, pull-to-refresh and returning to the app, and can overlap).
let latestRefresh = 0;

export const useNotificationsStore = create<NotificationsState>()((set, get) => ({
  items: [],
  unreadCount: 0,
  nextBefore: null,
  loading: false,
  loadingMore: false,
  hasLoadedOnce: false,
  answeredBookingIds: [],
  freshIds: [],
  startVisit: () => set({ freshIds: [] }),
  refresh: async () => {
    const ticket = ++latestRefresh;
    set({ loading: true });
    try {
      const page = await getNotificationsPage();
      if (ticket !== latestRefresh || !page) return;
      set({ items: page.items, unreadCount: page.unreadCount, nextBefore: page.nextBefore });
    } catch (err) {
      console.warn('[Notifications] refresh error:', err);
    } finally {
      if (ticket === latestRefresh) set({ loading: false, hasLoadedOnce: true });
    }
  },
  loadMore: async () => {
    const { nextBefore, loadingMore } = get();
    if (!nextBefore || loadingMore) return;
    set({ loadingMore: true });
    try {
      const page = await getNotificationsPage(nextBefore);
      if (!page || get().nextBefore !== nextBefore) return;
      const known = new Set(get().items.map((item) => item.id));
      set({
        items: [...get().items, ...page.items.filter((item) => !known.has(item.id))],
        nextBefore: page.nextBefore,
      });
    } catch (err) {
      console.warn('[Notifications] loadMore error:', err);
    } finally {
      set({ loadingMore: false });
    }
  },
  markAllRead: async () => {
    if (get().unreadCount === 0 && get().items.every((item) => item.readAt)) return;
    const now = new Date().toISOString();
    const unread = get().items.filter((item) => !item.readAt).map((item) => item.id);
    // Optimistic: the badge clears the moment the tab opens.
    set({
      unreadCount: 0,
      items: get().items.map((item) => (item.readAt ? item : { ...item, readAt: now })),
      freshIds: [...new Set([...get().freshIds, ...unread])],
    });
    try {
      const result = await markNotificationsReadApi();
      if (result) set({ unreadCount: result.unread_count });
    } catch (err) {
      console.warn('[Notifications] markAllRead error:', err);
    }
  },
  markAnswered: (bookingId: string) => {
    set({ answeredBookingIds: [...new Set([...get().answeredBookingIds, bookingId])] });
  },
  clear: () => {
    latestRefresh++;
    set({
      items: [],
      unreadCount: 0,
      nextBefore: null,
      loading: false,
      loadingMore: false,
      hasLoadedOnce: false,
      answeredBookingIds: [],
      freshIds: [],
    });
  },
}));

/** The notifications tab's badge. */
export function useUnreadNotificationsCount(): number {
  return useNotificationsStore((s) => s.unreadCount);
}

/** Whether an owner_request still waits for the owner's answer (accept/reject shown). */
export function isOpenRequest(item: AppNotification, answeredBookingIds: string[]): boolean {
  return item.kind === 'owner_request' && !item.resolved && !answeredBookingIds.includes(item.bookingId);
}

/** The owner's "Hoy" tab badge: booking requests still waiting for an answer. */
export function usePendingRequestsCount(): number {
  return useNotificationsStore((s) => s.items.filter((item) => isOpenRequest(item, s.answeredBookingIds)).length);
}
