import { create } from 'zustand';
import { ParkingSpot } from '@/src/types';

interface SpotsState {
  spots: ParkingSpot[];
  /** Incremented each time a change is saved; observers react to re-fetch. */
  lastUpdated: number;
  setSpots: (spots: ParkingSpot[]) => void;
  clearSpots: () => void;
  upsertSpot: (spot: ParkingSpot) => void;
  markUpdated: () => void;
}

export const useSpotsStore = create<SpotsState>((set) => ({
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

// Backwards-compat alias — remove once all imports are migrated
export { useSpotsStore as useOwnerSpotsStore };
