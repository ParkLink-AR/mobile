import { t, useLanguage } from '@/src/i18n';
import { ApiError } from '@/src/api/client';
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { getParkingSpotDetail, toISOToday } from '@/src/services/parkingService';
import { getDriverVisiblePrice } from '@/src/services/utils';
import { ParkingSpot } from '@/src/types';
import { createBookingApi, confirmBookingApi } from '@/src/api/booking';
import type { ScheduleEntryBody } from '@/src/api/booking';

export default function ConfirmBooking() {
  useLanguage();
  const colors = useThemeColors();
  const typography = useTypography();
  const { spotId, hours, startHour, endHour } = useLocalSearchParams<{
    spotId: string;
    hours: string;
    startHour?: string;
    endHour?: string;
  }>();
  const user = useSessionStore((s) => s.user);
  const [spot, setSpot] = useState<ParkingSpot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const reservedHours = Math.max(Number(hours) || 1, 1);
  const start = startHour ? Number(startHour) : 8;
  const end = endHour ? Number(endHour) : start + reservedHours;

  // Only load the spot detail on mount — no booking is created yet.
  useEffect(() => {
    getParkingSpotDetail(spotId).then((s) => {
      if (!s) {
        setLoadError(t('driver.booking.spotNotFound'));
      } else {
        setSpot(s);
      }
    });
  }, [spotId]);

  // Called when the user explicitly presses "Confirm & Pay". Creates the
  // booking (PENDING_PAYMENT), then confirms it directly with a placeholder
  // payment_id.
  //
  // payment-service doesn't exist in this workspace yet (the gateway 503s on
  // every /payments/* route), so the real Mercado Pago checkout
  // (createPaymentPreference + Linking.openURL + polling on
  // /payment/pending) can't run end-to-end here. Until it does, this treats
  // payment as already succeeded and calls POST /bookings/{id}/confirm
  // itself instead of waiting for the webhook to do it -- the booking ends
  // up CONFIRMED for real, not stuck in PENDING_PAYMENT forever.
  async function reserve() {
    if (!spot || !user || processing) return;
    setProcessing(true);

    try {
      const startISO = toISOToday(start);
      const endISO = toISOToday(end);
      const schedule: ScheduleEntryBody[] = spot.schedule.map((entry) => ({
        day_of_week: entry.dayOfWeek,
        start_hour: entry.startHour,
        end_hour: entry.endHour,
      }));

      const created = await createBookingApi({
        user_id: user.id,
        start: startISO,
        end: endISO,
        amount: Math.round(spot.pricePerHour * reservedHours * 100), // centavos
        parking_spot: { id: spotId, schedule },
      });

      await confirmBookingApi(created.id, `mock-payment-${created.id}`);

      const visibleTotal = getDriverVisiblePrice(spot.pricePerHour) * reservedHours;
      router.replace({
        pathname: '/(driver)/booking/success',
        params: {
          spotTitle: spot.title,
          date: new Date().toLocaleDateString('es-AR'),
          startTime: `${String(start).padStart(2, '0')}:00`,
          endTime: `${String(end).padStart(2, '0')}:00`,
          total: String(visibleTotal),
        },
      });
    } catch (err: any) {
      const isConflict = err instanceof ApiError && err.status === 409;
      if (isConflict) {
        Alert.alert(
          t('driver.payment.errorTitle'),
          t('driver.booking.errorConflict'),
          [{ text: t('driver.booking.errorConflictAction'), onPress: () => router.back() }],
        );
      } else {
        const msg = err?.detail ?? err?.message ?? t('driver.booking.errorCreating');
        Alert.alert(t('driver.payment.errorTitle'), msg);
      }
      setProcessing(false);
    }
  }

  if (loadError) {
    return (
      <Screen style={{ flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={[typography.body, { color: colors.warning, textAlign: 'center' }]}>{loadError}</Text>
        <Button title={t('common.cancel')} onPress={() => router.back()} style={{ marginTop: 16 }} />
      </Screen>
    );
  }

  if (!user || !spot) return <ActivityIndicator style={{ marginTop: 40 }} />;

  const visiblePricePerHour = getDriverVisiblePrice(spot.pricePerHour);
  const visibleTotal = visiblePricePerHour * reservedHours;

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface },
    scrollContent: { padding: 16, gap: 8 },
    sectionTitle: { marginTop: 10, marginBottom: 2 },
    button: { marginTop: 16 },
  });

  return (
    <Screen style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Card>
          <Text style={typography.h2}>{spot.title}</Text>
          <Text style={typography.caption}>{spot.address}</Text>
        </Card>
        <Text style={[typography.caption, styles.sectionTitle]}>{t('driver.booking.summary')}</Text>
        <Row label={t('driver.booking.date')} value={new Date().toLocaleDateString('es-AR')} />
        <Row
          label={t('driver.booking.time')}
          value={`${String(start).padStart(2, '0')}:00 ${t('driver.booking.timeTo')} ${String(end).padStart(2, '0')}:00`}
        />
        <Row label={t('driver.booking.pricePerHour')} value={`$${visiblePricePerHour}`} />
        <Row label={t('driver.booking.hours')} value={`${reservedHours} ${t('driver.booking.hoursUnit')}`} />
        <Row label={t('driver.booking.total')} value={`$${visibleTotal}`} bold />
        <Text style={[typography.caption, styles.sectionTitle]}>{t('driver.booking.methodPayment')}</Text>
        <Card>
          <Text style={typography.body}>Mercado Pago</Text>
        </Card>
        <Button
          title={
            processing
              ? t('driver.booking.processing')
              : t('driver.booking.confirmPay').replace('%{total}', String(visibleTotal))
          }
          onPress={reserve}
          disabled={processing}
          style={styles.button}
        />
      </ScrollView>
    </Screen>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  const colors = useThemeColors();
  const typography = useTypography();
  const styles = StyleSheet.create({
    row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  });
  return (
    <View style={styles.row}>
      <Text style={typography.body}>{label}</Text>
      <Text style={[typography.body, bold && { fontWeight: '700', color: colors.teal }]}>
        {value}
      </Text>
    </View>
  );
}
