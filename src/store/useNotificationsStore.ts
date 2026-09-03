import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppNotification, getNotifications } from '@/src/services/notificationsFeed';

interface NotificationsState {
  items: AppNotification[];
  seenIds: string[];
  loading: boolean;
  refresh: (userId: string) => Promise<void>;
  markSeen: (ids: string[]) => void;
  clear: () => void;
}

export const useNotificationsStore = create(
  persist<NotificationsState>(
    (set, get) => ({
      items: [],
      seenIds: [],
      loading: false,
      refresh: async (userId: string) => {
        set({ loading: true });
        try {
          const items = await getNotifications(userId);
          set({ items });
        } catch (err) {
          console.warn('[Notifications] refresh error:', err);
        } finally {
          set({ loading: false });
        }
      },
      markSeen: (ids: string[]) => {
        const seen = new Set(get().seenIds);
        ids.forEach((id) => seen.add(id));
        set({ seenIds: [...seen] });
      },
      clear: () => set({ items: [], seenIds: [] }),
    }),
    {
      name: 'notifications-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/** Reactive unread count -- re-renders whenever items or seenIds change. */
export function useUnseenNotificationsCount(): number {
  const items = useNotificationsStore((s) => s.items);
  const seenIds = useNotificationsStore((s) => s.seenIds);
  const seen = new Set(seenIds);
  return items.filter((item) => !seen.has(item.id)).length;
}
