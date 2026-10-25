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
import { getParkingSpotDetail, getSpotPricePerHour } from '@/src/services/parkingService';
import { getDriverVisiblePrice } from '@/src/services/utils';
import { useCommissionStore } from '@/src/store/useCommissionStore';
import { ParkingSpot } from '@/src/types';
import { VEHICLE_TYPE_LABEL_KEYS } from '@/src/constants/vehicleTypes';
import { openCheckout } from '@/src/services/checkout';
import { createBookingApi, createPaymentPreference, type ScheduleEntryBody } from '@/src/api/booking';
import { bookingVehicleBody, useBookingVehicle, vehicleErrorMessage } from '@/src/services/bookingVehicle';
import { PaymentMethodDisplay } from '@/src/components/PaymentMethodDisplay';
import { SpotSummaryCard } from '@/src/components/SpotSummaryCard';
import { VehiclePicker } from '@/src/components/VehiclePicker';
import { formatLongDateTime, formatShortDate } from '@/src/services/bookingDates';
import { endDateOf, formatArtTime, startDateOf } from '@/src/services/bookingRange';
import { CancellationPolicyNote } from '@/src/components/booking/CancellationPolicyNote';
import { DebtBreakdown } from '@/src/components/booking/DebtBreakdown';
import { confirmChangedTotal, debtChanged, formatDebtPesos, useMyDebts } from '@/src/services/debts';

// ── Helper for availability pre-check ────────────────────────────────────────

/** "$17.280" -- whole pesos with thousands separators, like the rest of the app. */
function formatPesos(amount: number): string {
  return `$${Math.round(amount).toLocaleString('es-AR')}`;
}

export default function ConfirmBooking() {
  useLanguage();
  const group = `/${useSegments()[0]}`;
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const largeText = scale > 1;
  const typography = useTypography();
  const commissionRatePercent = useCommissionStore((s) => s.ratePercent);
  const { spotId, hours, startAt, endAt, vehicleType } = useLocalSearchParams<{
    spotId: string;
    hours: string;
    startAt: string; // RFC3339 con offset de Buenos Aires, armado en spot/[id].tsx
    endAt: string;
    vehicleType?: string; // elegido en spot/[id].tsx -- decide el precio si la cochera cobra distinto por vehículo
  }>();
  const user = useSessionStore((s) => s.user);
  const [spot, setSpot] = useState<ParkingSpot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const {
    vehicles, selectedVehicle, setSelectedVehicle, onVehicleSaved, needsVehicle, vehicleType: pricingVehicleType,
  } = useBookingVehicle(user?.id, spot, 'hourly', vehicleType);
  // Alert.alert with a buttons array is a no-op on web -- see bookings/[id].tsx's
  // handleCancel for the same fix applied to the cancel-booking confirmation.
  const [conflictModalVisible, setConflictModalVisible] = useState(false);
  // What the driver owes for staying past an earlier booking's end rides on this one: shown, itemised,
  // before they pay.
  const { pendingDebts, pending: pendingBalance, loading: debtsLoading } = useMyDebts();

  const reservedHours = Math.max(Number(hours) || 0.5, 0.5);
  const startMs = new Date(startAt).getTime();
  const endMs = new Date(endAt).getTime();
  const startDate = startDateOf(startMs);
  const endDate = endDateOf(endMs);

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

  // Full booking + MercadoPago payment flow:
  //   0. GET /availability        → pre-check: confirm slot is still free
  //   1. POST /bookings          → creates PENDING_PAYMENT booking (15-min hold)
  //   2. POST /payments/create-preference → creates MP preference; externalReference = bookingId
  //   3. Opens checkoutUrl in an in-app WebBrowser
  //   4. User pays on the MP web checkout
  //   5. MP webhook hits payment-service → confirms the booking in booking-service
  //   6. MP redirects to parklink://payment/pending?bookingId=<id>
  //   7. pending.tsx polls payment-service until approved/rejected
  async function reserve() {
    if (!spot || !user || processing) return;
    // Esta pantalla sólo se llega desde el flujo de reserva por hora (ver
    // spot/[id].tsx, que lo esconde si !spot.hourlyEnabled) -- null acá
    // sería un estado inesperado, no algo que el usuario pueda causar.
    // The spot asks for the vehicle, or prices by it -- booking-service refuses it too.
    if (needsVehicle && !selectedVehicle) {
      Alert.alert(t('driver.booking.vehicle.missingTitle'), t('driver.booking.vehicle.error.required'));
      return;
    }
    const effectiveVehicleType = pricingVehicleType ?? spot.vehicleTypes[0] ?? null;
    const pricePerHour = effectiveVehicleType ? getSpotPricePerHour(spot, effectiveVehicleType) : spot.pricePerHour;
    if (pricePerHour === null) {
      Alert.alert(t('driver.payment.errorTitle'), t('driver.booking.errorCreating'));
      return;
    }
    setProcessing(true);

    // No separate availability check first: booking-service checks the slot itself (hours,
    // closed days, room) and a taken slot comes back as a 409 -- the same "ya no está
    // disponible" notice, without holding anything -- one round trip less before paying.

    // ── Step 1: create the booking ──────────────────────────────────────────
    let bookingId: string;
    try {
      const schedule: ScheduleEntryBody[] = spot.schedule.map((entry) => ({
        day_of_week: entry.dayOfWeek,
        start_hour: entry.startHour,
        end_hour: entry.endHour,
      }));

      const created = await createBookingApi({
        start: startAt,
        end: endAt,
        amount: Math.round(pricePerHour * reservedHours * 100), // centavos -- booking-service recomputes this itself and ignores whatever's sent here
        parking_spot: { id: spotId, schedule, capacity: spot.capacity },
        vehicle: bookingVehicleBody(selectedVehicle),
      });
      bookingId = created.id;
      // No amount travels to the checkout: payment-service charges the booking's own
      // server-side price (owner's price + platform commission), looked up by bookingId.
      if (debtChanged(pendingBalance, created.debt_amount)) {
        // The balance it took on isn't the one shown: say what the total is now before paying.
        const goOn = await confirmChangedTotal(Math.round(getDriverVisiblePrice(pricePerHour, commissionRatePercent) * reservedHours) + (created.debt_amount ?? 0) / 100);
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

    // ── Step 2: create MercadoPago preference ───────────────────────────────
    let checkoutUrl: string;
    try {
      const preference = await createPaymentPreference({
        title: `Cochera ${spot.title}`,
        description: `Reserva ${formatShortDate(startDate)} ${formatArtTime(startMs)} – ${formatShortDate(endDate)} ${formatArtTime(endMs, true)}`,
        payerEmail: user.email,
        externalReference: bookingId, // bookingId IS the external reference for the webhook
      });
      checkoutUrl = preference.checkoutUrl;
    } catch (err: any) {
      const msg = err?.detail ?? err?.message ?? t('driver.payment.errorCreatingPreference');
      Alert.alert(t('driver.payment.errorTitle'), msg);
      setProcessing(false);
      return;
    }

    // ── Step 3: open the Mercado Pago checkout (see openCheckout) ─────────────
    await openCheckout(checkoutUrl);

    // ── Step 4: navigate to pending screen to poll for confirmation ─────────
    // This runs after the browser closes (either by redirect or by the user
    // pressing Cancel). pending.tsx polls payment-service until the webhook
    // has confirmed (or rejected) the payment -- it's also where the deep
    // link itself lands now (see payment-service's /payment-return), so this
    // is a no-op re-navigation to the same screen in that case, not a race.
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

  if (!user || !spot) return <ActivityIndicator style={{ marginTop: 40 }} />;
  const effectiveVehicleType = pricingVehicleType ?? spot.vehicleTypes[0] ?? null;
  const pricePerHour = effectiveVehicleType ? getSpotPricePerHour(spot, effectiveVehicleType) : spot.pricePerHour;
  // Ver el comentario en reserve(): esta pantalla sólo se llega desde el
  // flujo de reserva por hora, así que esto no debería pasar en la práctica.
  if (pricePerHour === null) return <ActivityIndicator style={{ marginTop: 40 }} />;

  const visiblePricePerHour = getDriverVisiblePrice(pricePerHour, commissionRatePercent);
  const visibleTotal = visiblePricePerHour * reservedHours;

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

              <View style={styles.detailRow}>
                <Ionicons name="log-in-outline" size={sc(16)} color={colors.textSecondary} />
                <Text style={styles.detailLabel}>{t('driver.booking.from')}</Text>
                <Text style={styles.detailValue}>{formatLongDateTime(startAt)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="log-out-outline" size={sc(16)} color={colors.textSecondary} />
                <Text style={styles.detailLabel}>{t('driver.booking.until')}</Text>
                <Text style={styles.detailValue}>{formatLongDateTime(endAt)}</Text>
              </View>
              {spot.pricePerHourByVehicleType && effectiveVehicleType && (
                <View style={styles.detailRow}>
                  <Ionicons name="car-outline" size={sc(16)} color={colors.textSecondary} />
                  <Text style={styles.detailLabel}>{t('spot.vehicleType')}</Text>
                  <Text style={styles.detailValue}>{t(VEHICLE_TYPE_LABEL_KEYS[effectiveVehicleType])}</Text>
                </View>
              )}
              <View style={styles.detailRow}>
                <Ionicons name="pricetag-outline" size={sc(16)} color={colors.textSecondary} />
                <Text style={styles.detailLabel}>{t('driver.booking.pricePerHour')}</Text>
                <Text style={styles.detailValue}>{formatPesos(visiblePricePerHour)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="hourglass-outline" size={sc(16)} color={colors.textSecondary} />
                <Text style={styles.detailLabel}>{t('driver.booking.hours')}</Text>
                <Text style={styles.detailValue}>{String(Math.round(reservedHours * 100) / 100).replace('.', ',')} {t('driver.booking.hoursUnit')}</Text>
              </View>

              <View style={styles.divider} />

              <DebtBreakdown bookingTotal={Math.round(visibleTotal)} debts={pendingDebts} />
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
                  {t(spot.pricePerHourByVehicleType ? 'driver.booking.vehicle.pricedHint' : 'driver.booking.vehicle.requiredHint')}
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
                : t('driver.booking.confirmPay').replace('$%{total}', formatDebtPesos(Math.round(visibleTotal) + pendingBalance))
            }
            onPress={reserve}
            disabled={processing || debtsLoading}
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
