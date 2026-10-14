import { router } from 'expo-router';
import { useAccountTypeStore } from '@/src/store/useAccountTypeStore';

/**
 * Opens a route that starts with its route group ("/(owner)/bookings/..."). If that group is
 * the other mode, the app switches to it first -- an owner notification tapped while
 * driving lands in owner mode, with that mode's notifications tab underneath so Back goes
 * there instead of out of the app.
 */
export function openInMode(path: string): void {
  const match = path.match(/^\/\((driver|owner)\)/);
  const mode = match?.[1] as 'driver' | 'owner' | undefined;
  const store = useAccountTypeStore.getState();
  if (!mode || mode === store.activeMode) {
    router.push(path as never);
    return;
  }
  store.setActiveMode(mode);
  router.replace(`/(${mode})/(tabs)/notifications` as never);
  // Let the other mode's tabs mount before stacking the screen on top of them.
  setTimeout(() => router.push(path as never), 0);
}
