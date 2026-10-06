import { create } from 'zustand';
import { addFavorite, removeFavorite, getFavoriteIds } from '@/src/services/parkingService';

interface FavoritesState {
  ids: Set<string>;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  clear: () => void;
  toggle: (parkingSpotId: string) => Promise<void>;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  ids: new Set(),
  hydrated: false,
  hydrate: async () => {
    const ids = await getFavoriteIds();
    set({ ids: new Set(ids), hydrated: true });
  },
  clear: () => set({ ids: new Set(), hydrated: false }),
  toggle: async (parkingSpotId) => {
    const wasFavorite = get().ids.has(parkingSpotId);

    // Optimista: refleja el cambio ya, revierte si el pedido falla.
    set((state) => {
      const ids = new Set(state.ids);
      if (wasFavorite) ids.delete(parkingSpotId);
      else ids.add(parkingSpotId);
      return { ids };
    });

    try {
      if (wasFavorite) await removeFavorite(parkingSpotId);
      else await addFavorite(parkingSpotId);
    } catch (err) {
      set((state) => {
        const ids = new Set(state.ids);
        if (wasFavorite) ids.add(parkingSpotId);
        else ids.delete(parkingSpotId);
        return { ids };
      });
      throw err;
    }
  },
}));
