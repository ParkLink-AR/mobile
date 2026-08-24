import { t, useLanguage } from '@/src/i18n';
import { ApiError } from '@/src/api/client';
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import * as Linking from 'expo-linking';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { getParkingSpotDetail } from '@/src/services/parkingService';
import { getDriverVisiblePrice } from '@/src/services/utils';
import { ParkingSpot } from '@/src/types';
import { createBookingApi, createPaymentPreference } from '@/src/api/booking';
import type { BookingApiResponse } from '@/src/api/booking';

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
  // processing covers both booking creation and payment preference creation
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

  // Called when the user explicitly presses "Confirm & Pay".
  // Creates the booking (PENDING_PAYMENT) and immediately opens checkout,
  // so there is exactly one booking creation attempt per button press.
  async function goToPay() {
    if (!spot || !user || processing) return;
    setProcessing(true);

    let created: BookingApiResponse;
    try {
      // Build RFC3339 timestamps for today at the requested hours
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), start, 0, 0);
      const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), end, 0, 0);

      created = await createBookingApi(spotId, {
        user_id: user.id,
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        amount: Math.round(spot.pricePerHour * reservedHours * 100), // centavos
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
      return;
    }

    try {
      const visibleTotal = getDriverVisiblePrice(spot.pricePerHour) * reservedHours;
      const preference = await createPaymentPreference({
        amount: visibleTotal,
        title: `Cochera: ${spot.title}`,
        description: `${reservedHours} hs · ${spot.address}`,
        currency: 'ARS',
        payerEmail: user.email,
        externalReference: created.id, // booking id used by webhook to confirm
      });

      // Open Mercado Pago checkout in the device browser
      await Linking.openURL(preference.checkoutUrl);

      // Navigate to pending screen while waiting for the webhook
      router.replace({
        pathname: '/(driver)/payment/pending',
        params: { bookingId: created.id },
      });
    } catch (err: any) {
      const msg = err?.detail ?? err?.message ?? t('driver.payment.errorCreatingPreference');
      Alert.alert(t('driver.payment.errorTitle'), msg);
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
          onPress={goToPay}
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
