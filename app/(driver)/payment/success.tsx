import { useEffect } from 'react';
import { router, useLocalSearchParams, useSegments } from 'expo-router';

// Deep-link handler for parklink://payment/success. payment-service's
// /payment-return bridge no longer sends anyone here -- it always targets
// payment/pending, the only screen that actually verifies the payment with
// the backend instead of trusting Mercado Pago's redirect at face value.
// Kept as a redirect (not deleted) in case a stale cached link still points
// here.
export default function PaymentSuccessScreen() {
  const group = `/${useSegments()[0]}`;
  const { bookingId } = useLocalSearchParams<{ bookingId?: string }>();

  useEffect(() => {
    router.replace({ pathname: `${group}/payment/pending`, params: bookingId ? { bookingId } : {} });
  }, [bookingId]);

  return null;
}
