import { t, useLanguage } from '@/src/i18n';
import { ApiError } from '@/src/api/client';
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView, StyleSheet, Alert, Modal, Pressable, TouchableWithoutFeedback } from 'react-native';
import { useLocalSearchParams, useSegments, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography, useScale } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { getParkingSpotDetail } from '@/src/services/parkingService';
import { formatStayBreakdown, getDriverVisiblePrice } from '@/src/services/utils';
import { useCommissionStore } from '@/src/store/useCommissionStore';
import { getHalfDayQuote, getStayQuote } from '@/src/api/parking';
import { ParkingSpot } from '@/src/types';
import { openCheckout } from '@/src/services/checkout';
import { createBookingApi, createPaymentPreference } from '@/src/api/booking';
import { bookingVehicleBody, useBookingVehicle, vehicleErrorMessage } from '@/src/services/bookingVehicle';
import { PaymentMethodDisplay } from '@/src/components/PaymentMethodDisplay';
import { SpotSummaryCard } from '@/src/components/SpotSummaryCard';
import { VehiclePicker } from '@/src/components/VehiclePicker';
import { formatLongDateTime, formatShortDate } from '@/src/services/bookingDates';
import { CancellationPolicyNote } from '@/src/components/booking/CancellationPolicyNote';
import { DebtBreakdown } from '@/src/components/booking/DebtBreakdown';
import { confirmChangedTotal, debtChanged, formatDebtPesos, useMyDebts } from '@/src/services/debts';


/** What this screen books, as quoted by parking-service -- a stay's or a half-day's. */
interface Quoted {
  startDateTime: string;
  endDateTime: string;
  endDate: string; // YYYY-MM-DD, a stay's check-out day
  amount: number; // centavos, the owner's own price
  duration: string; // "1 semana + 2 días" / "12 horas"
}

/**
 * Confirmación + pago de una estadía (rango de fechas + hora de check-in) -- o, con
 * mode=halfDay, de una media estadía (12 horas desde la hora elegida, mismo flujo: el precio
 * sale de su propia cotización y se reserva como HALF_DAY) --
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
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const largeText = scale > 1;
  const typography = useTypography();
  const commissionRatePercent = useCommissionStore((s) => s.ratePercent);
  const { spotId, startDate, endDate, startHour, vehicleType, mode } = useLocalSearchParams<{
    spotId: string;
    startDate: string; // YYYY-MM-DD
    endDate?: string; // YYYY-MM-DD -- a stay's check-out day; a half-day has none
    startHour: string;
    vehicleType?: string; // elegido en spot/[id].tsx -- decide la tarifa si la cochera cobra distinto por vehículo
    mode?: 'stay' | 'halfDay';
  }>();
  const isHalfDay = mode === 'halfDay';
  const stayStartHour = Number(startHour) || 0;
  const user = useSessionStore((s) => s.user);
  const [spot, setSpot] = useState<ParkingSpot | null>(null);
  // The quote, with the vehicle type it was priced for -- a spot that prices stays per
  // vehicle is re-quoted when the picked vehicle changes.
  const [quoted, setQuoted] = useState<{ vehicleType: string; quote: Quoted } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const {
    vehicles, selectedVehicle, setSelectedVehicle, onVehicleSaved, needsVehicle, vehicleType: pricingVehicleType,
  } = useBookingVehicle(user?.id, spot, isHalfDay ? 'halfDay' : 'stay', vehicleType);
  // Only a spot that prices stays per vehicle is quoted by type.
  const quoteVehicleType = spot?.stayPricesByVehicleType ? pricingVehicleType : null;
  const quote = quoted && quoted.vehicleType === (quoteVehicleType ?? '') ? quoted.quote : null;
  // Alert.alert with a buttons array is a no-op on web -- see bookings/[id].tsx's
  // handleCancel for the same fix applied to the cancel-booking confirmation.
  const [conflictModalVisible, setConflictModalVisible] = useState(false);
  // What the driver owes for staying past an earlier booking's end rides on this one: shown, itemised,
  // before they pay.
  const { pendingDebts, pending: pendingBalance, loading: debtsLoading } = useMyDebts();

  // Se re-cotiza acá (no se reutiliza la de spot/[id].tsx) porque puede haber
  // pasado tiempo entre que el conductor la vio y llegó a confirmar -- ésta
  // es la que efectivamente se le va a cobrar.
  useEffect(() => {
    getParkingSpotDetail(spotId).then((s) => {
      if (!s) setLoadError(t('driver.booking.spotNotFound'));
      else setSpot(s);
    });
  }, [spotId]);

  const pricedPerVehicle = !!spot?.stayPricesByVehicleType;
  useEffect(() => {
    if (!spot) return;
    // Priced per vehicle and no vehicle yet: nothing to quote until one is picked.
    if (pricedPerVehicle && !quoteVehicleType) return;
    const request: Promise<Quoted> = isHalfDay
      ? getHalfDayQuote(spotId, startDate, stayStartHour, quoteVehicleType).then((q) => ({
          startDateTime: q.startDateTime,
          endDateTime: q.endDateTime,
          endDate: q.endDateTime.slice(0, 10),
          amount: q.amount,
          duration: t('spot.halfDay.duration', { hours: String(q.hours) }),
        }))
      : getStayQuote(spotId, startDate, endDate ?? startDate, stayStartHour, quoteVehicleType).then((q) => ({
          startDateTime: q.startDateTime,
          endDateTime: q.endDateTime,
          endDate: q.endDate,
          amount: q.amount,
          duration: formatStayBreakdown(q.breakdown),
        }));
    request
      .then((result) => setQuoted({ vehicleType: quoteVehicleType ?? '', quote: result }))
      .catch((err) => setLoadError(err instanceof ApiError ? err.detail : t(isHalfDay ? 'spot.halfDay.quoteError' : 'spot.stay.quoteError')));
  }, [spot, pricedPerVehicle, isHalfDay, spotId, startDate, endDate, stayStartHour, quoteVehicleType]);

  // Mismo flujo que booking/confirm.tsx (POST /bookings -> POST
  // /payments/create-preference -> WebBrowser -> pending.tsx), sin el
  // pre-check de disponibilidad por hora (no aplica acá) y con kind/
  // stay_end_date en vez de horas -- ver CreateBookingBody.
  async function reserve() {
    if (!spot || !quote || !user || processing) return;
    // The spot asks for the vehicle, or prices by it -- booking-service refuses it too.
    if (needsVehicle && !selectedVehicle) {
      Alert.alert(t('driver.booking.vehicle.missingTitle'), t('driver.booking.vehicle.error.required'));
      return;
    }
    setProcessing(true);

    let bookingId: string;
    try {
      const created = await createBookingApi({
        // Instantes reales que ya calculó y validó parking-service (mismo
        // check-in/check-out que se le mostró al conductor acá) -- no un
        // placeholder, aunque booking-service los re-deriva igual desde su
        // propia llamada a GetStayQuote antes de confiar en nada de esto.
        start: quote.startDateTime,
        end: quote.endDateTime,
        amount: quote.amount,
        ...(isHalfDay ? { kind: 'HALF_DAY' as const } : { kind: 'STAY' as const, stay_end_date: quote.endDate }),
        parking_spot: { id: spotId, schedule: [], capacity: spot.capacity },
        vehicle: bookingVehicleBody(selectedVehicle),
      });
      bookingId = created.id;
      // No amount travels to the checkout: payment-service charges the booking's own
      // server-side price (owner's price + platform commission), looked up by bookingId.
      if (debtChanged(pendingBalance, created.debt_amount)) {
        // The balance it took on isn't the one shown: say what the total is now before paying.
        const goOn = await confirmChangedTotal(
          Math.round(getDriverVisiblePrice(quote.amount / 100, commissionRatePercent)) + (created.debt_amount ?? 0) / 100,
        );
        if (!goOn) {
          setProcessing(false);
          return;
        }
      }
    } catch (err: any) {
      const isConflict = err instanceof ApiError && err.status === 409;
      if (isConflict) {
        setConflictModalVisible(true);
      } else {
        const msg = vehicleErrorMessage(err) ?? err?.detail ?? err?.message ?? t('driver.booking.errorCreating');
        Alert.alert(t('driver.payment.errorTitle'), msg);
      }
      setProcessing(false);
      return;
    }

    let checkoutUrl: string;
    try {
      const preference = await createPaymentPreference({
        title: `Cochera ${spot.title}`,
        description: isHalfDay
          ? t('spot.halfDay.paymentDescription', { start: formatLongDateTime(quote.startDateTime) })
          : t('spot.stay.paymentDescription', {
              start: formatShortDate(startDate),
              end: formatShortDate(quote.endDate),
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

    // Open the Mercado Pago checkout (see openCheckout).
    await openCheckout(checkoutUrl);

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

  // Priced per vehicle with no vehicle picked yet: the screen shows, asking for the vehicle
  // before the price.
  const awaitingVehicle = pricedPerVehicle && !quoteVehicleType;
  if (!user || !spot || (!quote && !awaitingVehicle)) return <ActivityIndicator style={{ marginTop: 40 }} />;

  const visibleTotal = quote ? getDriverVisiblePrice(quote.amount / 100, commissionRatePercent) : null;

  const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    body: { padding: 16, gap: 14 },


    card: { gap: 12 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectionLabel: {
      fontSize: sc(11), fontWeight: '700', color: colors.textSecondary,
      letterSpacing: 0.8, textTransform: 'uppercase',
    },
    vehicleHint: { fontSize: sc(13), color: colors.textSecondary, lineHeight: sc(18) },
    // The value never squeezes the label: it wraps on its own side instead. With the large
    // text size a long value ("14 de octubre de 2026, 15:00") doesn't fit beside the label
    // at all, so it drops to its own line under it.
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: largeText ? 'wrap' : 'nowrap', rowGap: 2 },
    detailLabel: { flexGrow: 1, flexShrink: 0, fontSize: sc(14), color: colors.textSecondary },
    detailValue: largeText
      ? { width: '100%', paddingLeft: sc(16) + 8, fontSize: sc(14), color: colors.text, fontWeight: '600' }
      : { flexShrink: 1, textAlign: 'right', fontSize: sc(14), color: colors.text, fontWeight: '600' },
    divider: { height: 1, backgroundColor: colors.border },
    totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    totalLabel: { fontSize: sc(14), color: colors.text, fontWeight: '600' },
    totalValue: { fontSize: sc(18), color: colors.teal, fontWeight: '700' },

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
      fontSize: sc(16), fontWeight: '700', color: colors.text,
      marginBottom: 8, textAlign: 'center',
    },
    modalBody: {
      fontSize: sc(13), color: colors.textSecondary, textAlign: 'center', lineHeight: sc(18),
      marginBottom: 8,
    },
    modalConfirmBtn: {
      width: '100%', borderRadius: 10, paddingVertical: 12, alignItems: 'center',
      backgroundColor: colors.teal, marginTop: 8,
    },
    modalConfirmBtnText: { fontSize: sc(15), fontWeight: '600', color: colors.white },
  });

  return (
    <Screen style={styles.screen} edges={['left', 'right', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.body}>
          <SpotSummaryCard spot={spot} />

          <Card>
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <Ionicons name="calendar-outline" size={sc(15)} color={colors.textSecondary} />
                <Text style={styles.sectionLabel}>{t('driver.booking.summary')}</Text>
              </View>

              {!quote ? (
                <Text style={styles.vehicleHint}>{t('driver.booking.vehicle.pickToPrice')}</Text>
              ) : (
                <>
                  <View style={styles.detailRow}>
                    <Ionicons name="log-in-outline" size={sc(16)} color={colors.textSecondary} />
                    <Text style={styles.detailLabel}>{t('spot.stay.checkIn')}</Text>
                    <Text style={styles.detailValue}>{formatLongDateTime(quote.startDateTime)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="log-out-outline" size={sc(16)} color={colors.textSecondary} />
                    <Text style={styles.detailLabel}>{t('spot.stay.checkOut')}</Text>
                    <Text style={styles.detailValue}>{formatLongDateTime(quote.endDateTime)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="hourglass-outline" size={sc(16)} color={colors.textSecondary} />
                    <Text style={styles.detailLabel}>{t('spot.stay.duration')}</Text>
                    <Text style={styles.detailValue}>{quote.duration}</Text>
                  </View>

                  <View style={styles.divider} />

                  <DebtBreakdown bookingTotal={visibleTotal !== null ? Math.round(visibleTotal) : null} debts={pendingDebts} />
                </>
              )}
            </View>
          </Card>

          <Card>
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <Ionicons name="car-sport-outline" size={sc(15)} color={colors.textSecondary} />
                <Text style={styles.sectionLabel}>
                  {t(needsVehicle ? 'driver.booking.vehicle.sectionTitleRequired' : 'driver.booking.vehicle.sectionTitle')}
                </Text>
              </View>
              {needsVehicle ? (
                <Text style={styles.vehicleHint}>
                  {t(spot.stayPricesByVehicleType ? 'driver.booking.vehicle.pricedHint' : 'driver.booking.vehicle.requiredHint')}
                </Text>
              ) : null}
              <VehiclePicker
                userId={user.id}
                vehicles={vehicles}
                selected={selectedVehicle}
                onSelect={setSelectedVehicle}
                onVehicleSaved={onVehicleSaved}
                acceptedTypes={spot.vehicleTypes}
                required={needsVehicle}
              />
            </View>
          </Card>

          <Card>
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <Ionicons name="card-outline" size={sc(15)} color={colors.textSecondary} />
                <Text style={styles.sectionLabel}>{t('driver.booking.methodPayment')}</Text>
              </View>
              <PaymentMethodDisplay />
            </View>
          </Card>

          <CancellationPolicyNote />
          <Button
            title={
              processing
                ? t('driver.booking.processing')
                : t('driver.booking.confirmPay').replace('$%{total}', visibleTotal !== null ? formatDebtPesos(Math.round(visibleTotal) + pendingBalance) : '—')
            }
            onPress={reserve}
            disabled={processing || !quote || debtsLoading}
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
