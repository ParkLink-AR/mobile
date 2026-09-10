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
      // Sólo borra la lista en memoria (se vuelve a pedir sola en el
      // próximo login, vía refresh()) -- seenIds NO se toca acá: es el
      // registro persistente de qué notificaciones ya se vieron, y tiene
      // que sobrevivir a un logout/login para que el badge de "no leídas"
      // no vuelva a contar como nuevo algo que el usuario ya abrió antes de
      // cerrar sesión. Los ids son `${bookingId}-${kind}` con bookingId un
      // UUID único global, así que conservarlos entre cuentas en el mismo
      // dispositivo no arrastra el estado de "visto" de un usuario a otro.
      clear: () => set({ items: [] }),
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
