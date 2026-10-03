import { t, useLanguage } from '@/src/i18n';
import { ApiError } from '@/src/api/client';
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView, StyleSheet, Alert, Platform, Modal, Pressable, TouchableWithoutFeedback } from 'react-native';
import { useLocalSearchParams, useSegments, router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { getParkingSpotDetail } from '@/src/services/parkingService';
import { formatStayBreakdown, getDriverVisiblePrice } from '@/src/services/utils';
import { useCommissionStore } from '@/src/store/useCommissionStore';
import { getStayQuote, type StayQuote } from '@/src/api/parking';
import { ParkingSpot, Vehicle } from '@/src/types';
import { createBookingApi, createPaymentPreference, confirmBookingApi, CASH_PAYMENT_ID } from '@/src/api/booking';
import { getVehicles } from '@/src/api/auth';
import { PaymentMethodPicker } from '@/src/components/PaymentMethodPicker';
import { VehiclePicker } from '@/src/components/VehiclePicker';
import { getPaymentOptions, MERCADOPAGO_METHOD_ID, CASH_METHOD_ID } from '@/src/services/paymentOptions';

/** "23/09/2026 · 14:00" -- date and time together for a single instant (check-in/out),
 * as opposed to bookingDates.ts's helpers, which format a *range*. */
function formatStayInstant(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString('es-AR');
  const time = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${day} · ${time}`;
}

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
  const commissionRatePercent = useCommissionStore((s) => s.ratePercent);
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
  const [paymentMethod, setPaymentMethod] = useState(MERCADOPAGO_METHOD_ID);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  // Alert.alert with a buttons array is a no-op on web -- see bookings/[id].tsx's
  // handleCancel for the same fix applied to the cancel-booking confirmation.
  const [conflictModalVisible, setConflictModalVisible] = useState(false);

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

  // Entirely optional -- see the same effect in booking/confirm.tsx.
  useEffect(() => {
    if (user) getVehicles(user.id).then(setVehicles).catch(() => {});
  }, [user?.id]);

  // Mismo flujo que booking/confirm.tsx (POST /bookings -> POST
  // /payments/create-preference -> WebBrowser -> pending.tsx), sin el
  // pre-check de disponibilidad por hora (no aplica acá) y con kind/
  // stay_end_date en vez de horas -- ver CreateBookingBody.
  async function reserve() {
    if (!spot || !quote || !user || processing) return;
    setProcessing(true);

    let bookingId: string;
    let chargedTotal: number;
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
        vehicle: selectedVehicle
          ? { plate: selectedVehicle.plate, brand: selectedVehicle.brand, model: selectedVehicle.model, country: selectedVehicle.country }
          : undefined,
      });
      bookingId = created.id;
      // Server-authoritative total (owner's price + the platform commission added on
      // top), in pesos -- see the same fix in booking/confirm.tsx.
      chargedTotal = created.amount / 100;
    } catch (err: any) {
      const isConflict = err instanceof ApiError && err.status === 409;
      if (isConflict) {
        setConflictModalVisible(true);
      } else {
        const msg = err?.detail ?? err?.message ?? t('driver.booking.errorCreating');
        Alert.alert(t('driver.payment.errorTitle'), msg);
      }
      setProcessing(false);
      return;
    }

    // ── Cash: no MercadoPago involved -- confirm straight away and skip to
    // the owner-approval wait. ─────────────────────────────────────────────
    if (paymentMethod === CASH_METHOD_ID) {
      try {
        await confirmBookingApi(bookingId, CASH_PAYMENT_ID);
      } catch (err: any) {
        const msg = err?.detail ?? err?.message ?? t('driver.booking.errorCreating');
        Alert.alert(t('driver.payment.errorTitle'), msg);
        setProcessing(false);
        return;
      }
      setProcessing(false);
      router.replace({
        pathname: `${group}/booking/cash-pending`,
        params: { total: String(chargedTotal) },
      });
      return;
    }

    let checkoutUrl: string;
    try {
      const preference = await createPaymentPreference({
        amount: chargedTotal,
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

    // openAuthSessionAsync on native, openBrowserAsync on web: see the
    // comment in booking/confirm.tsx's equivalent step for why.
    if (Platform.OS === 'web') {
      await WebBrowser.openBrowserAsync(checkoutUrl, {
        dismissButtonStyle: 'cancel',
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      });
    } else {
      await WebBrowser.openAuthSessionAsync(checkoutUrl, 'parklink://payment', {
        dismissButtonStyle: 'cancel',
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      });
    }

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

  const visibleTotal = getDriverVisiblePrice(quote.amount / 100, commissionRatePercent);

  const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    body: { padding: 16, gap: 14 },

    heroCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 4,
    },
    spotTitle: { fontSize: 19, fontWeight: '700', color: colors.text, letterSpacing: -0.2 },
    addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    spotAddress: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 17 },

    card: { gap: 12 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectionLabel: {
      fontSize: 11, fontWeight: '700', color: colors.textSecondary,
      letterSpacing: 0.8, textTransform: 'uppercase',
    },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    detailLabel: { flex: 1, fontSize: 14, color: colors.textSecondary },
    detailValue: { fontSize: 14, color: colors.text, fontWeight: '600' },
    divider: { height: 1, backgroundColor: colors.border },
    totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    totalLabel: { fontSize: 14, color: colors.text, fontWeight: '600' },
    totalValue: { fontSize: 18, color: colors.teal, fontWeight: '700' },

    button: { marginTop: 2 },

    modalOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center', alignItems: 'center',
    },
    modalSheet: {
      width: '85%', borderRadius: 20, paddingVertical: 32, paddingHorizontal: 24,
      backgroundColor: colors.surface, alignItems: 'center', gap: 8,
    },
    modalTitle: {
      fontSize: 16, fontWeight: '700', color: colors.text,
      marginBottom: 8, textAlign: 'center',
    },
    modalBody: {
      fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 18,
      marginBottom: 8,
    },
    modalConfirmBtn: {
      width: '100%', borderRadius: 10, paddingVertical: 12, alignItems: 'center',
      backgroundColor: colors.teal, marginTop: 8,
    },
    modalConfirmBtnText: { fontSize: 15, fontWeight: '600', color: colors.white },
  });

  return (
    <Screen style={styles.screen} edges={['left', 'right', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.body}>
          <View style={styles.heroCard}>
            <Text style={styles.spotTitle}>{spot.title}</Text>
            <View style={styles.addressRow}>
              <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.spotAddress} numberOfLines={2}>{spot.address}</Text>
            </View>
          </View>

          <Card>
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <Ionicons name="calendar-outline" size={15} color={colors.textSecondary} />
                <Text style={styles.sectionLabel}>{t('driver.booking.summary')}</Text>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="log-in-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.detailLabel}>{t('spot.stay.checkIn')}</Text>
                <Text style={styles.detailValue}>{formatStayInstant(quote.startDateTime)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="log-out-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.detailLabel}>{t('spot.stay.checkOut')}</Text>
                <Text style={styles.detailValue}>{formatStayInstant(quote.endDateTime)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="hourglass-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.detailLabel}>{t('spot.stay.duration')}</Text>
                <Text style={styles.detailValue}>{formatStayBreakdown(quote.breakdown)}</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{t('driver.booking.total')}</Text>
                <Text style={styles.totalValue}>${visibleTotal}</Text>
              </View>
            </View>
          </Card>

          <Card>
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <Ionicons name="car-sport-outline" size={15} color={colors.textSecondary} />
                <Text style={styles.sectionLabel}>{t('driver.booking.vehicle.sectionTitle')}</Text>
              </View>
              <VehiclePicker
                vehicles={vehicles}
                selected={selectedVehicle}
                onSelect={setSelectedVehicle}
                vehiclesScreenPath={`${group}/vehicles`}
              />
            </View>
          </Card>

          <Card>
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <Ionicons name="card-outline" size={15} color={colors.textSecondary} />
                <Text style={styles.sectionLabel}>{t('driver.booking.methodPayment')}</Text>
              </View>
              <PaymentMethodPicker
                methods={getPaymentOptions()}
                selectedId={paymentMethod}
                onSelect={setPaymentMethod}
              />
            </View>
          </Card>

          <Button
            title={
              processing
                ? t('driver.booking.processing')
                : paymentMethod === CASH_METHOD_ID
                  ? t('driver.booking.confirmCash').replace('%{total}', String(visibleTotal))
                  : t('driver.booking.confirmPay').replace('%{total}', String(visibleTotal))
            }
            onPress={reserve}
            disabled={processing}
            style={styles.button}
          />
        </View>
      </ScrollView>

      <Modal
        visible={conflictModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConflictModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setConflictModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalSheet}>
                <Text style={styles.modalTitle}>{t('driver.payment.errorTitle')}</Text>
                <Text style={styles.modalBody}>{t('driver.booking.errorConflict')}</Text>
                <Pressable
                  style={({ pressed }) => [styles.modalConfirmBtn, { opacity: pressed ? 0.85 : 1 }]}
                  onPress={() => {
                    setConflictModalVisible(false);
                    router.back();
                  }}
                >
                  <Text style={styles.modalConfirmBtnText}>{t('driver.booking.errorConflictAction')}</Text>
                </Pressable>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </Screen>
  );
}
