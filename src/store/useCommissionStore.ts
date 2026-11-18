import { create } from 'zustand';
import { getCommissionRateApi } from '@/src/api/booking';

// 5% -- same default booking-service seeds into platform_settings (see
// constants.DefaultCommissionRateBP) -- used only until the real rate loads, so a price
// preview never shows $0 extra. A failed fetch is retried (a few times, spaced out) since
// every driver price on screen depends on it.
const DEFAULT_RATE_PERCENT = 5;
const RETRY_DELAYS_MS = [2000, 5000, 15000, 30000];

interface CommissionState {
  ratePercent: number;
  loaded: boolean;
  fetchRate: () => Promise<void>;
}

let inFlight: Promise<void> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

export const useCommissionStore = create<CommissionState>((set) => {
  const attempt = async (retry: number): Promise<void> => {
    try {
      const { commissionRatePercent } = await getCommissionRateApi();
      set({ ratePercent: commissionRatePercent, loaded: true });
    } catch (err) {
      console.warn('[Commission] fetch error:', err);
      const delay = RETRY_DELAYS_MS[retry];
      if (delay !== undefined && !retryTimer) {
        retryTimer = setTimeout(() => {
          retryTimer = null;
          void attempt(retry + 1);
        }, delay);
      }
    }
  };

  return {
    ratePercent: DEFAULT_RATE_PERCENT,
    loaded: false,
    fetchRate: () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      if (!inFlight) inFlight = attempt(0).finally(() => { inFlight = null; });
      return inFlight;
    },
  };
});
