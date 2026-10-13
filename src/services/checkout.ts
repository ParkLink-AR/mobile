import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { createPaymentPreference } from '@/src/api/booking';

/**
 * Opens Mercado Pago's checkout and resolves once the driver is back in the app.
 *
 * openAuthSessionAsync (not openBrowserAsync) on native: it watches for the
 * parklink://payment/pending redirect and closes the browser itself as soon as it fires,
 * instead of racing Expo Router's own handling of the deep link.
 *
 * Web only: expo-web-browser opens the auth session via window.open(), which browsers
 * only allow synchronously from the user's tap -- by now there's been at least one API
 * call (the preference), so it'd throw ERR_WEB_BROWSER_BLOCKED. openBrowserAsync doesn't
 * have that restriction there; native has neither.
 */
export async function openCheckout(checkoutUrl: string): Promise<void> {
  const options = {
    dismissButtonStyle: 'cancel' as const,
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
  };
  if (Platform.OS === 'web') {
    await WebBrowser.openBrowserAsync(checkoutUrl, options);
  } else {
    await WebBrowser.openAuthSessionAsync(checkoutUrl, 'parklink://payment', options);
  }
}

/**
 * Takes the driver back to Mercado Pago for a booking still awaiting payment -- e.g. they
 * closed the checkout tab by mistake, or their card was declined. payment-service creates
 * a fresh checkout for the same booking (it charges the booking's own price), as long as
 * its hold hasn't expired. `when` is the booking's dates, for the checkout's description.
 * Throws if the checkout can't be created.
 */
export async function resumeCheckout(
  bookingId: string,
  { spotTitle, when, payerEmail }: { spotTitle?: string | null; when: string; payerEmail?: string },
) {
  const preference = await createPaymentPreference({
    title: spotTitle ? `Cochera ${spotTitle}` : 'Reserva ParkLink',
    description: `Reserva ${when}`,
    payerEmail,
    externalReference: bookingId,
  });
  await openCheckout(preference.checkoutUrl);
}

/** Milliseconds left to pay a PENDING_PAYMENT booking (0 once its hold is over). */
export function holdRemainingMs(holdExpiresAt: string | null | undefined, now = Date.now()): number {
  if (!holdExpiresAt) return 0;
  return Math.max(0, new Date(holdExpiresAt).getTime() - now);
}

/** "4:05" */
export function formatCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** The time left to pay, ticking every second while there is some. */
export function useHoldCountdown(holdExpiresAt: string | null | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  const remaining = holdRemainingMs(holdExpiresAt, now);
  const running = remaining > 0;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);
  return remaining;
}
