import { useEffect } from 'react';
import { router, useLocalSearchParams, useSegments } from 'expo-router';

// Deep-link handler for parklink://payment/failure. Same reasoning as
// payment/success.tsx: payment-service's /payment-return bridge no longer
// sends anyone here, it always targets payment/pending. Kept as a redirect
// in case a stale cached link still points here.
export default function PaymentFailureScreen() {
  const group = `/${useSegments()[0]}`;
  const { bookingId } = useLocalSearchParams<{ bookingId?: string }>();

  useEffect(() => {
    router.replace({ pathname: `${group}/payment/pending`, params: bookingId ? { bookingId } : {} });
  }, [bookingId]);

  return null;
}
