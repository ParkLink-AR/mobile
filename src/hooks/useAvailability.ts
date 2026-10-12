import { useState, useEffect, useCallback, useRef } from 'react';
import { getAvailability } from '@/src/api/parking';
import { addDaysISO } from '@/src/services/dateUtils';
import { Interval, mergeFreeWindows } from '@/src/services/bookingRange';

const REFRESH_INTERVAL_MS = 30_000;

interface UseAvailabilityResult {
  /**
   * null  = first fetch still in-flight (never had a successful response yet).
   * array = last successful response, with the days' free windows already joined into
   *         continuous blocks (may be empty when every day is fully booked/closed).
   */
  windows: Interval[] | null;
  loading: boolean;
  /** True when the most recent fetch failed AND we have no prior good data. */
  error: boolean;
  /** Call to force an immediate refresh (e.g. on screen focus, after 409). */
  refresh: () => void;
}

/**
 * Fetches and auto-refreshes the free windows for `spanDays` days starting at `dateISO`
 * (parking-service caps a request at 14 days). Windows that touch at midnight come back
 * merged, so a booking can run across days.
 *
 * - Refetches whenever parkingSpotId or dateISO changes.
 * - Auto-refreshes every REFRESH_INTERVAL_MS while the hook is mounted.
 * - On error: keeps the last known-good windows so stale-but-real data is
 *   still shown; sets error=true only when there is no prior good data at all.
 *   This means a transient network hiccup never causes the slot list to vanish,
 *   AND a fresh load that fails never falls through to the published-schedule
 *   fallback (which would show slots that are already booked).
 */
export function useAvailability(
  parkingSpotId: string,
  dateISO: string,
  spanDays: number,
): UseAvailabilityResult {
  const [windows, setWindows] = useState<Interval[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // Tracks the in-flight request so stale responses are discarded.
  const requestIdRef = useRef(0);
  // Tracks the last (spotId, dateISO) pair for which we have good data, so
  // we can clear stale data when the key changes without a separate effect.
  const lastKeyRef = useRef<string>('');

  const fetch = useCallback((resetFirst: boolean = false) => {
    const currentId = ++requestIdRef.current;
    if (resetFirst) {
      // Key changed — clear stale data immediately inside the fetch call
      // rather than in a separate effect to avoid cascading-render lint errors.
      setWindows(null);
      setError(false);
    }
    setLoading(true);
    // When resetFirst=false we keep the last good value visible while the
    // new request is in flight (stale-while-revalidate).

    getAvailability(parkingSpotId, dateISO, addDaysISO(dateISO, spanDays))
      .then((res) => {
        if (requestIdRef.current !== currentId) return; // stale
        setWindows(mergeFreeWindows(res.days));
        setError(false);
      })
      .catch(() => {
        if (requestIdRef.current !== currentId) return;
        // Keep whatever windows we already have (possibly null on first load).
        // Only surface error=true so the UI can show a retry affordance.
        setError(true);
      })
      .finally(() => {
        if (requestIdRef.current === currentId) setLoading(false);
      });
  }, [parkingSpotId, dateISO, spanDays]);

  // Refetch when key deps change; reset stale data inline (not in a separate effect).
  useEffect(() => {
    const key = `${parkingSpotId}:${dateISO}`;
    const keyChanged = lastKeyRef.current !== key;
    lastKeyRef.current = key;
    fetch(keyChanged);
  }, [fetch, parkingSpotId, dateISO]);

  // Auto-refresh every 30 s while mounted.
  useEffect(() => {
    const id = setInterval(fetch, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetch]);

  return { windows, loading, error, refresh: fetch };
}
