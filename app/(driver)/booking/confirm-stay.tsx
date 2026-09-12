import { t, useLanguage } from '@/src/i18n';
import { ApiError } from '@/src/api/client';
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useSegments, router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { getParkingSpotDetail } from '@/src/services/parkingService';
import { formatStayBreakdown, getDriverVisiblePrice } from '@/src/services/utils';
import { getStayQuote, type StayQuote } from '@/src/api/parking';
import { ParkingSpot } from '@/src/types';
import { createBookingApi, createPaymentPreference } from '@/src/api/booking';

/**
 * Confirmación + pago de una estadía (rango de fechas + hora de check-in) --
 * contraparte de booking/confirm.tsx (por hora), separada en su propia
 * pantalla en vez de ramificar esa por dos motivos: los parámetros son
 * distintos (startDate/endDate/startHour, no startHour/endHour de una franja
 * horaria) y el monto acá SIEMPRE sale de parking-service (vía
 * getStayQuote), nunca se calcula a mano en el cliente -- ver StaysService
 * en parking-service y el comentario en CreateBookingBody.amount sobre por
 * qué booking-service ignora el amount que mande el cliente para una
 * estadía.
 */
export default function ConfirmStayBooking() {
  useLanguage();
  const group = `/${useSegments()[0]}`;
  const colors = useThemeColors();
  const typography = useTypography();
  const { spotId, startDate, endDate, startHour } = useLocalSearchParams<{
    spotId: string;
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
    startHour: string;
  }>();
  const stayStartHour = Number(startHour) || 0;
  const user = useSessionStore((s) => s.user);
  const [spot, setSpot] = useState<ParkingSpot | null>(null);
  const [quote, setQuote] = useState<StayQuote | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  // Se re-cotiza acá (no se reutiliza la de spot/[id].tsx) porque puede haber
  // pasado tiempo entre que el conductor la vio y llegó a confirmar -- ésta
  // es la que efectivamente se le va a cobrar.
  useEffect(() => {
    getParkingSpotDetail(spotId).then((s) => {
      if (!s) setLoadError(t('driver.booking.spotNotFound'));
      else setSpot(s);
    });
    getStayQuote(spotId, startDate, endDate, stayStartHour)
      .then(setQuote)
      .catch((err) => setLoadError(err instanceof ApiError ? err.detail : t('spot.stay.quoteError')));
  }, [spotId, startDate, endDate, stayStartHour]);

  // Mismo flujo que booking/confirm.tsx (POST /bookings -> POST
  // /payments/create-preference -> WebBrowser -> pending.tsx), sin el
  // pre-check de disponibilidad por hora (no aplica acá) y con kind/
  // stay_end_date en vez de horas -- ver CreateBookingBody.
  async function reserve() {
    if (!spot || !quote || !user || processing) return;
    setProcessing(true);

    let bookingId: string;
    try {
      const created = await createBookingApi({
        user_id: user.id,
        // Instantes reales que ya calculó y validó parking-service (mismo
        // check-in/check-out que se le mostró al conductor acá) -- no un
        // placeholder, aunque booking-service los re-deriva igual desde su
        // propia llamada a GetStayQuote antes de confiar en nada de esto.
        start: quote.startDateTime,
        end: quote.endDateTime,
        amount: quote.amount,
        kind: 'STAY',
        stay_end_date: quote.endDate,
        parking_spot: { id: spotId, schedule: [], capacity: spot.capacity },
      });
      bookingId = created.id;
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

    let checkoutUrl: string;
    try {
      const visibleTotal = getDriverVisiblePrice(quote.amount / 100);
      const preference = await createPaymentPreference({
        amount: visibleTotal,
        title: `Cochera ${spot.title}`,
        description: t('spot.stay.paymentDescription', {
          start: new Date(quote.startDate + 'T12:00:00').toLocaleDateString('es-AR'),
          end: new Date(quote.endDate + 'T12:00:00').toLocaleDateString('es-AR'),
        }),
        payerEmail: user.email,
        externalReference: bookingId,
      });
      checkoutUrl = preference.checkoutUrl;
    } catch (err: any) {
      const msg = err?.detail ?? err?.message ?? t('driver.payment.errorCreatingPreference');
      Alert.alert(t('driver.payment.errorTitle'), msg);
      setProcessing(false);
      return;
    }

    await WebBrowser.openBrowserAsync(checkoutUrl, {
      dismissButtonStyle: 'cancel',
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
    });

    setProcessing(false);
    router.replace({
      pathname: `${group}/payment/pending`,
      params: { bookingId },
    });
  }

  if (loadError) {
    return (
      <Screen style={{ flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' }} edges={['left', 'right', 'bottom']}>
        <Text style={[typography.body, { color: colors.warning, textAlign: 'center' }]}>{loadError}</Text>
        <Button title={t('common.cancel')} onPress={() => router.back()} style={{ marginTop: 16 }} />
      </Screen>
    );
  }

  if (!user || !spot || !quote) return <ActivityIndicator style={{ marginTop: 40 }} />;

  const visibleTotal = getDriverVisiblePrice(quote.amount / 100);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface },
    scrollContent: { padding: 16, gap: 8 },
    sectionTitle: { marginTop: 10, marginBottom: 2 },
    button: { marginTop: 16 },
  });

  return (
    <Screen style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Card>
          <Text style={typography.h2}>{spot.title}</Text>
          <Text style={typography.caption}>{spot.address}</Text>
        </Card>
        <Text style={[typography.caption, styles.sectionTitle]}>{t('driver.booking.summary')}</Text>
        <Row label={t('spot.stay.startDate')} value={new Date(quote.startDate + 'T12:00:00').toLocaleDateString('es-AR')} />
        <Row label={t('spot.stay.endDate')} value={new Date(quote.endDate + 'T12:00:00').toLocaleDateString('es-AR')} />
        <Row label={t('spot.stay.startHour')} value={`${String(stayStartHour).padStart(2, '0')}:00`} />
        <Row label={t('spot.stay.duration')} value={formatStayBreakdown(quote.breakdown)} />
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
