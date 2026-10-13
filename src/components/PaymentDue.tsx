import { useState } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { router, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/src/i18n';
import { Button } from '@/src/components/Button';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useScale } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { ApiError } from '@/src/api/client';
import { formatCountdown, resumeCheckout, useHoldCountdown } from '@/src/services/checkout';

/** "Falta pagar · 4:05" under a booking in "Mis reservas", while it can still be paid. */
export function PaymentDueHint({ holdExpiresAt }: { holdExpiresAt?: string }) {
  const colors = useThemeColors();
  const scale = useScale();
  const remaining = useHoldCountdown(holdExpiresAt);
  if (remaining === 0) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
      <Ionicons name="time-outline" size={Math.round(14 * scale)} color={colors.warning} />
      <Text style={{ fontSize: Math.round(13 * scale), fontWeight: '600', color: colors.warning }}>
        {t('driver.payment.resume.listHint', { time: formatCountdown(remaining) })}
      </Text>
    </View>
  );
}

/**
 * A booking still awaiting payment, in its detail: how long is left to pay and a way back
 * to Mercado Pago -- for when the checkout was closed by mistake (or the app was). Gone
 * once the hold runs out.
 */
export function PaymentDueCard({
  bookingId, holdExpiresAt, spotTitle, when,
}: {
  bookingId: string;
  holdExpiresAt?: string;
  spotTitle: string;
  /** The booking's dates, for the checkout's description. */
  when: string;
}) {
  const group = `/${useSegments()[0]}`;
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const payerEmail = useSessionStore((s) => s.user?.email);
  const remaining = useHoldCountdown(holdExpiresAt);
  const [opening, setOpening] = useState(false);

  if (remaining === 0) return null;

  async function pay() {
    setOpening(true);
    try {
      await resumeCheckout(bookingId, { spotTitle, when, payerEmail });
    } catch (err) {
      // 409: it stopped being payable meanwhile -- the pending screen shows how it ended.
      if (!(err instanceof ApiError && err.status === 409)) {
        Alert.alert(t('driver.payment.errorTitle'), t('driver.payment.errorCreatingPreference'));
        setOpening(false);
        return;
      }
    }
    setOpening(false);
    // Same as after the first checkout: that screen confirms the payment with the backend.
    router.push({ pathname: `${group}/payment/pending` as never, params: { bookingId } });
  }

  const styles = StyleSheet.create({
    card: { borderRadius: 16, borderWidth: 1, borderColor: '#FDE68A', backgroundColor: '#FFFBEB', padding: 16, gap: 10 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { fontSize: sc(16), fontWeight: '700', color: '#92400E' },
    body: { fontSize: sc(14), lineHeight: sc(20), color: '#92400E' },
  });

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="time-outline" size={sc(18)} color={colors.warning} />
        <Text style={styles.title}>{t('driver.payment.resume.detailTitle')}</Text>
      </View>
      <Text style={styles.body}>{t('driver.payment.resume.detailBody', { time: formatCountdown(remaining) })}</Text>
      {opening ? (
        <ActivityIndicator color={colors.teal} style={{ paddingVertical: sc(14) }} />
      ) : (
        <Button title={t('driver.payment.resume.button')} onPress={pay} />
      )}
    </View>
  );
}
