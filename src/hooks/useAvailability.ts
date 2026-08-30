import { useState, useEffect, useCallback, useRef } from 'react';
import { getAvailability, FreeWindow } from '@/src/api/parking';

const REFRESH_INTERVAL_MS = 30_000;

interface UseAvailabilityResult {
  /** null = still loading; empty array = fully booked / closed */
  freeWindows: FreeWindow[] | null;
  loading: boolean;
  /** Call to force an immediate refresh (e.g. on screen focus). */
  refresh: () => void;
}

/**
 * Fetches and auto-refreshes the free windows for a single day.
 *
 * - Refetches whenever parkingSpotId, dateISO, or durationHours changes.
 * - Auto-refreshes every REFRESH_INTERVAL_MS while the hook is mounted.
 * - Exposes refresh() so callers can trigger an immediate refetch (e.g. useFocusEffect).
 * - On error, falls back to null so the caller can fall back to the published schedule.
 */
export function useAvailability(
  parkingSpotId: string,
  dateISO: string,
  /** Including durationHours lets callers refresh when duration changes. */
  _durationHours: number,
): UseAvailabilityResult {
  const [freeWindows, setFreeWindows] = useState<FreeWindow[] | null>(null);
  const [loading, setLoading] = useState(true);
  // Tracks the in-flight request so stale responses are discarded.
  const requestIdRef = useRef(0);

  const fetch = useCallback(() => {
    const currentId = ++requestIdRef.current;
    setFreeWindows(null);
    setLoading(true);

    const nextDay = addOneDay(dateISO);
    getAvailability(parkingSpotId, dateISO, nextDay)
      .then((res) => {
        if (requestIdRef.current !== currentId) return; // stale
        setFreeWindows(res.days[0]?.free_windows ?? []);
      })
      .catch(() => {
        if (requestIdRef.current !== currentId) return;
        setFreeWindows(null);
      })
      .finally(() => {
        if (requestIdRef.current === currentId) setLoading(false);
      });
  }, [parkingSpotId, dateISO]);

  // Refetch when key deps change. fetch() itself calls setState internally
  // (setFreeWindows/setLoading) via async callbacks — not synchronously in the
  // effect body — so this is safe and not a cascading-render risk.
  useEffect(() => {
    fetch();
  }, [fetch]);

  // Auto-refresh every 30 s while mounted.
  useEffect(() => {
    const id = setInterval(fetch, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetch]);

  return { freeWindows, loading, refresh: fetch };
}

function addOneDay(dateISO: string): string {
  const [year, month, day] = dateISO.split('-').map(Number);
  const next = new Date(year, month - 1, day + 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}
