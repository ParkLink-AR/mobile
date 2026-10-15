import * as Sentry from '@sentry/react-native';

// Crash and error reports, sent to Sentry. EXPO_PUBLIC_SENTRY_DSN says where; without it the
// SDK stays off and nothing leaves the phone (development, or before the project exists).
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const monitoringEnabled = !!DSN;

export function initMonitoring(): void {
  if (!DSN) return;
  Sentry.init({
    dsn: DSN,
    environment: __DEV__ ? 'development' : 'production',
    // Errors only: no performance tracing, and no personal data beyond the user's id below.
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
}

/** Ties the reports to who was logged in (just their id), or clears it on logout. */
export function setMonitoringUser(userId: string | null | undefined): void {
  if (!DSN) return;
  Sentry.setUser(userId ? { id: userId } : null);
}

/** Wraps the root component so render crashes are reported too. */
export function wrapRoot(component: () => React.JSX.Element): React.ComponentType {
  return DSN ? Sentry.wrap(component) : component;
}
