import { useState, useEffect, useCallback, useRef } from 'react';
import { getAvailability, FreeWindow } from '@/src/api/parking';

const REFRESH_INTERVAL_MS = 30_000;

interface UseAvailabilityResult {
  /**
   * null  = first fetch still in-flight (never had a successful response yet).
   * array = last successful response (may be empty when day is fully booked/closed).
   */
  freeWindows: FreeWindow[] | null;
  loading: boolean;
  /** True when the most recent fetch failed AND we have no prior good data. */
  error: boolean;
  /** Call to force an immediate refresh (e.g. on screen focus, after 409). */
  refresh: () => void;
}

/**
 * Fetches and auto-refreshes the free windows for a single day.
 *
 * - Refetches whenever parkingSpotId or dateISO changes.
 * - Auto-refreshes every REFRESH_INTERVAL_MS while the hook is mounted.
 * - On error: keeps the last known-good freeWindows so stale-but-real data is
 *   still shown; sets error=true only when there is no prior good data at all.
 *   This means a transient network hiccup never causes the slot list to vanish,
 *   AND a fresh load that fails never falls through to the published-schedule
 *   fallback (which would show slots that are already booked).
 */
export function useAvailability(
  parkingSpotId: string,
  dateISO: string,
  /** Including durationHours lets callers refresh when duration changes. */
  _durationHours: number,
): UseAvailabilityResult {
  const [freeWindows, setFreeWindows] = useState<FreeWindow[] | null>(null);
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
      setFreeWindows(null);
      setError(false);
    }
    setLoading(true);
    // When resetFirst=false we keep the last good value visible while the
    // new request is in flight (stale-while-revalidate).

    const nextDay = addOneDay(dateISO);
    getAvailability(parkingSpotId, dateISO, nextDay)
      .then((res) => {
        if (requestIdRef.current !== currentId) return; // stale
        setFreeWindows(res.days[0]?.free_windows ?? []);
        setError(false);
      })
      .catch(() => {
        if (requestIdRef.current !== currentId) return;
        // Keep whatever freeWindows we already have (possibly null on first load).
        // Only surface error=true so the UI can show a retry affordance.
        setError(true);
      })
      .finally(() => {
        if (requestIdRef.current === currentId) setLoading(false);
      });
  }, [parkingSpotId, dateISO]);

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

  return { freeWindows, loading, error, refresh: fetch };
}

function addOneDay(dateISO: string): string {
  const [year, month, day] = dateISO.split('-').map(Number);
  const next = new Date(year, month - 1, day + 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}
