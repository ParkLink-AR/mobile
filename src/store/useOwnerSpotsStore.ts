import { create } from 'zustand';
import { ParkingSpot } from '@/src/types';

interface OwnerSpotsState {
  spots: ParkingSpot[];
  /** Incrementado cada vez que se guarda un cambio; observadores pueden reaccionar para re-fetch. */
  lastUpdated: number;
  setSpots: (spots: ParkingSpot[]) => void;
  clearSpots: () => void;
  upsertSpot: (spot: ParkingSpot) => void;
  markUpdated: () => void;
}

export const useOwnerSpotsStore = create<OwnerSpotsState>((set) => ({
  spots: [],
  lastUpdated: 0,
  setSpots: (spots) => set({ spots }),
  clearSpots: () => set({ spots: [] }),
  markUpdated: () => set((state) => ({ lastUpdated: state.lastUpdated + 1 })),
  upsertSpot: (spot) =>
    set((state) => {
      const exists = state.spots.some((s) => s.id === spot.id);
      return {
        spots: exists
          ? state.spots.map((s) => (s.id === spot.id ? spot : s))
          : [...state.spots, spot],
      };
    }),
}));
