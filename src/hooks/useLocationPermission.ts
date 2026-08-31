import { useEffect, useState } from 'react';
import * as Location from 'expo-location';

export type PermissionStatus = 'undetermined' | 'granted' | 'denied';

/**
 * Checks the current foreground location permission status WITHOUT showing
 * the system dialog. The caller is responsible for calling
 * Location.requestForegroundPermissionsAsync() (typically inside locateMe())
 * at the right moment — doing it here AND in the caller caused iOS to silently
 * skip the second call because the dialog was already resolved by the first.
 *
 * Returns { status, loading } so callers can decide what to do once the
 * status is known (e.g. auto-trigger GPS when already granted on re-open).
 */
export function useLocationPermission(): { status: PermissionStatus; loading: boolean } {
  const [status, setStatus] = useState<PermissionStatus>('undetermined');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Location.getForegroundPermissionsAsync()
      .then(({ status: s }) => {
        if (!cancelled) setStatus(s === 'granted' ? 'granted' : s === 'undetermined' ? 'undetermined' : 'denied');
      })
      .catch(() => {
        if (!cancelled) setStatus('undetermined');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { status, loading };
}
