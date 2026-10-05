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
import { getParkingSpotDetail, getSpotPricePerHour, toISOToday } from '@/src/services/parkingService';
import { getDriverVisiblePrice } from '@/src/services/utils';
import { useCommissionStore } from '@/src/store/useCommissionStore';
import { getAvailability } from '@/src/api/parking';
import { ParkingSpot, Vehicle } from '@/src/types';
import { VehicleType, VEHICLE_TYPE_LABEL_KEYS } from '@/src/constants/vehicleTypes';
import { createBookingApi, createPaymentPreference, type ScheduleEntryBody } from '@/src/api/booking';
import { getVehicles } from '@/src/api/auth';
import { PaymentMethodDisplay } from '@/src/components/PaymentMethodDisplay';
import { VehiclePicker } from '@/src/components/VehiclePicker';

// ── Helpers for availability pre-check ───────────────────────────────────────

function addOneDay(dateISO: string): string {
  const [year, month, day] = dateISO.split('-').map(Number);
  const next = new Date(year, month - 1, day + 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}

/**
 * Checks whether the requested integer-hour slot [startHour:00, endHour:00]
 * is fully covered by at least one free window. Compares epoch-ms so that a
 * free window starting at e.g. 08:30 does NOT falsely cover the 08:00 slot.
 */
function slotIsCoveredByFreeWindows(
  freeWindows: Array<{ start: string; end: string }>,
  startHour: number,
  endHour: number,
  bookingDate: string,
): boolean {
  // Build the exact epoch-ms for slotStart and slotEnd using the booking date.
  const artMidnightMs = artMidnightForDate(bookingDate);
  const slotStartMs = artMidnightMs + startHour * 3600_000;
  const slotEndMs = artMidnightMs + endHour * 3600_000;
  return freeWindows.some((w) => {
    const wStartMs = new Date(w.start).getTime();
    const wEndMs = new Date(w.end).getTime();
    return wStartMs <= slotStartMs && slotEndMs <= wEndMs;
  });
}

/** UTC epoch-ms of Buenos Aires midnight (00:00 ART = 03:00 UTC) for a YYYY-MM-DD date. */
function artMidnightForDate(dateISO: string): number {
  const [year, month, day] = dateISO.split('-').map(Number);
  return Date.UTC(year, month - 1, day, 3, 0, 0, 0); // ART midnight = UTC 03:00
}

export default function ConfirmBooking() {
  useLanguage();
  const group = `/${useSegments()[0]}`;
  const colors = useThemeColors();
  const typography = useTypography();
  const commissionRatePercent = useCommissionStore((s) => s.ratePercent);
  const { spotId, hours, startHour, endHour, bookingDate, vehicleType } = useLocalSearchParams<{
    spotId: string;
    hours: string;
    startHour?: string;
    endHour?: string;
    bookingDate?: string; // YYYY-MM-DD passed from spot/[id].tsx
    vehicleType?: string; // elegido en spot/[id].tsx -- decide el precio si la cochera cobra distinto por vehículo
  }>();
  const user = useSessionStore((s) => s.user);
  const [spot, setSpot] = useState<ParkingSpot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  // Alert.alert with a buttons array is a no-op on web -- see bookings/[id].tsx's
  // handleCancel for the same fix applied to the cancel-booking confirmation.
  const [conflictModalVisible, setConflictModalVisible] = useState(false);

  const reservedHours = Math.max(Number(hours) || 1, 1);
  const start = startHour ? Number(startHour) : 8;
  const end = endHour ? Number(endHour) : start + reservedHours;

  // Use the date selected in spot/[id].tsx; fall back to today.
  function toISO(dateISO: string | undefined, hour: number): string {
    let base = dateISO ?? toISOToday(0).slice(0, 10); // "YYYY-MM-DD"
    // Un turno puede terminar a las 24:00 (p.ej. reservar 23→24hs): 24 no es
    // una hora válida en RFC3339, así que se pasa a las 00:00 del día
    // siguiente para que booking-service no rechace el timestamp.
    if (hour >= 24) {
      base = addOneDay(base);
      hour -= 24;
    }
    const paddedHour = String(hour).padStart(2, '0');
    return `${base}T${paddedHour}:00:00-03:00`;
  }

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

  // Entirely optional -- an empty list just means the "Seleccionar vehículo" picker
  // shows its empty state (see VehiclePicker's "vehicles.pickerEmpty").
  useEffect(() => {
    if (user) getVehicles(user.id).then(setVehicles).catch(() => {});
  }, [user?.id]);

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
    const effectiveVehicleType = (vehicleType as VehicleType) ?? spot.vehicleTypes[0] ?? null;
    const pricePerHour = effectiveVehicleType ? getSpotPricePerHour(spot, effectiveVehicleType) : spot.pricePerHour;
    if (pricePerHour === null) {
      Alert.alert(t('driver.payment.errorTitle'), t('driver.booking.errorCreating'));
      return;
    }
    setProcessing(true);

    // ── Step 0: pre-check availability before creating the booking ─────────
    // This gives a fast, friendly error if the slot was taken while the user
    // was on the confirm screen, without consuming a hold.
    try {
      const dateFrom = bookingDate ?? toISOToday(0).slice(0, 10);
      const dateTo = addOneDay(dateFrom);
      const availability = await getAvailability(spot.id, dateFrom, dateTo);
      const freeWindows = availability.days[0]?.free_windows ?? [];
      const slotIsFree = slotIsCoveredByFreeWindows(freeWindows, start, end, dateFrom);
      if (!slotIsFree) {
        setConflictModalVisible(true);
        setProcessing(false);
        return;
      }
    } catch {
      // If availability check fails (network error), proceed and let the
      // booking-service conflict check be the final gate.
    }

    // ── Step 1: create the booking ──────────────────────────────────────────
    let bookingId: string;
    let chargedTotal: number;
    try {
      const startISO = toISO(bookingDate, start);
      const endISO = toISO(bookingDate, end);
      const schedule: ScheduleEntryBody[] = spot.schedule.map((entry) => ({
        day_of_week: entry.dayOfWeek,
        start_hour: entry.startHour,
        end_hour: entry.endHour,
      }));

      const created = await createBookingApi({
        user_id: user.id,
        start: startISO,
        end: endISO,
        amount: Math.round(pricePerHour * reservedHours * 100), // centavos -- booking-service recomputes this itself and ignores whatever's sent here
        parking_spot: { id: spotId, schedule, capacity: spot.capacity },
        vehicle: selectedVehicle
          ? { plate: selectedVehicle.plate, brand: selectedVehicle.brand, model: selectedVehicle.model, country: selectedVehicle.country }
          : undefined,
      });
      bookingId = created.id;
      // Server-authoritative total (owner's price + the platform commission added on
      // top), in pesos -- the one number the MercadoPago preference below uses, instead of each computing its own estimate (which used to
      // drift apart: MP charged a marked-up total while the booking recorded the raw one).
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

    // ── Step 2: create MercadoPago preference ───────────────────────────────
    let checkoutUrl: string;
    try {
      const preference = await createPaymentPreference({
        amount: chargedTotal,
        title: `Cochera ${spot.title}`,
        description: `Reserva ${bookingDate ?? 'hoy'} ${String(start).padStart(2, '0')}:00–${String(end).padStart(2, '0')}:00`,
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

    // ── Step 3: open MP checkout as an auth session ─────────────────────────
    // openAuthSessionAsync (not openBrowserAsync) is the API built for this
    // exact pattern -- it watches for the parklink://payment/pending redirect
    // and closes the browser itself as soon as it fires, instead of relying
    // on the OS to notice the deep link and dismiss it on its own. That used
    // to race against the router.replace below: Expo Router would sometimes
    // already be navigating from the deep link while this code also
    // navigated, landing the user on whichever screen won the race.
    //
    // Web only: expo-web-browser's web implementation opens the auth session
    // via window.open(), which browsers require to fire synchronously from
    // the user's tap -- by this point we've already awaited two API calls
    // (create booking, create preference), so it no longer qualifies and
    // openAuthSessionAsync throws ERR_WEB_BROWSER_BLOCKED. openBrowserAsync
    // doesn't have that restriction there; native has neither restriction.
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
  const effectiveVehicleType = (vehicleType as VehicleType) ?? spot.vehicleTypes[0] ?? null;
  const pricePerHour = effectiveVehicleType ? getSpotPricePerHour(spot, effectiveVehicleType) : spot.pricePerHour;
  // Ver el comentario en reserve(): esta pantalla sólo se llega desde el
  // flujo de reserva por hora, así que esto no debería pasar en la práctica.
  if (pricePerHour === null) return <ActivityIndicator style={{ marginTop: 40 }} />;

  const visiblePricePerHour = getDriverVisiblePrice(pricePerHour, commissionRatePercent);
  const visibleTotal = visiblePricePerHour * reservedHours;

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
                <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.detailLabel}>{t('driver.booking.date')}</Text>
                <Text style={styles.detailValue}>
                  {bookingDate
                    ? new Date(bookingDate + 'T12:00:00').toLocaleDateString('es-AR')
                    : new Date().toLocaleDateString('es-AR')}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.detailLabel}>{t('driver.booking.time')}</Text>
                <Text style={styles.detailValue}>
                  {String(start).padStart(2, '0')}:00 {t('driver.booking.timeTo')} {String(end).padStart(2, '0')}:00
                </Text>
              </View>
              {spot.pricePerHourByVehicleType && effectiveVehicleType && (
                <View style={styles.detailRow}>
                  <Ionicons name="car-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.detailLabel}>{t('spot.vehicleType')}</Text>
                  <Text style={styles.detailValue}>{t(VEHICLE_TYPE_LABEL_KEYS[effectiveVehicleType])}</Text>
                </View>
              )}
              <View style={styles.detailRow}>
                <Ionicons name="pricetag-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.detailLabel}>{t('driver.booking.pricePerHour')}</Text>
                <Text style={styles.detailValue}>${visiblePricePerHour}</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="hourglass-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.detailLabel}>{t('driver.booking.hours')}</Text>
                <Text style={styles.detailValue}>{reservedHours} {t('driver.booking.hoursUnit')}</Text>
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
              <PaymentMethodDisplay />
            </View>
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
