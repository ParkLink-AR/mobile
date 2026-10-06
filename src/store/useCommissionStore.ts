import { create } from 'zustand';
import { getCommissionRateApi } from '@/src/api/booking';

// 5% -- same default booking-service seeds into platform_settings (see
// constants.DefaultCommissionRateBP) -- used only until the real rate loads, or if that
// fetch fails, so a price preview never shows $0 extra.
const DEFAULT_RATE_PERCENT = 5;

interface CommissionState {
  ratePercent: number;
  loaded: boolean;
  fetchRate: () => Promise<void>;
}

export const useCommissionStore = create<CommissionState>((set) => ({
  ratePercent: DEFAULT_RATE_PERCENT,
  loaded: false,
  fetchRate: async () => {
    try {
      const { commissionRatePercent } = await getCommissionRateApi();
      set({ ratePercent: commissionRatePercent, loaded: true });
    } catch (err) {
      console.warn('[Commission] fetch error:', err);
    }
  },
}));
