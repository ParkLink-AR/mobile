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
import { getParkingSpotDetail, getSpotPricePerHour, toISOToday } from '@/src/services/parkingService';
import { getDriverVisiblePrice } from '@/src/services/utils';
import { getAvailability } from '@/src/api/parking';
import { ParkingSpot } from '@/src/types';
import { VehicleType, VEHICLE_TYPE_LABEL_KEYS } from '@/src/constants/vehicleTypes';
import { createBookingApi, createPaymentPreference, type ScheduleEntryBody } from '@/src/api/booking';

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
        Alert.alert(
          t('driver.payment.errorTitle'),
          t('driver.booking.errorConflict'),
          [{ text: t('driver.booking.errorConflictAction'), onPress: () => router.back() }],
        );
        setProcessing(false);
        return;
      }
    } catch {
      // If availability check fails (network error), proceed and let the
      // booking-service conflict check be the final gate.
    }

    // ── Step 1: create the booking ──────────────────────────────────────────
    let bookingId: string;
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
        amount: Math.round(pricePerHour * reservedHours * 100), // centavos
        parking_spot: { id: spotId, schedule, capacity: spot.capacity },
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

    // ── Step 2: create MercadoPago preference ───────────────────────────────
    let checkoutUrl: string;
    try {
      const visibleTotal = getDriverVisiblePrice(pricePerHour) * reservedHours;
      const preference = await createPaymentPreference({
        amount: visibleTotal,
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

    // ── Step 3: open MP checkout in an in-app browser ───────────────────────
    // The browser closes when MP redirects to parklink://payment/pending
    await WebBrowser.openBrowserAsync(checkoutUrl, {
      dismissButtonStyle: 'cancel',
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
    });

    // ── Step 4: navigate to pending screen to poll for confirmation ─────────
    // This runs after the browser closes (either by redirect or by the user
    // pressing Cancel). pending.tsx polls payment-service until the webhook
    // has confirmed (or rejected) the payment.
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

  const visiblePricePerHour = getDriverVisiblePrice(pricePerHour);
  const visibleTotal = visiblePricePerHour * reservedHours;

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
        <Row
          label={t('driver.booking.date')}
          value={bookingDate
            ? new Date(bookingDate + 'T12:00:00').toLocaleDateString('es-AR')
            : new Date().toLocaleDateString('es-AR')}
        />
        <Row
          label={t('driver.booking.time')}
          value={`${String(start).padStart(2, '0')}:00 ${t('driver.booking.timeTo')} ${String(end).padStart(2, '0')}:00`}
        />
        {spot.pricePerHourByVehicleType && effectiveVehicleType && (
          <Row label={t('spot.vehicleType')} value={t(VEHICLE_TYPE_LABEL_KEYS[effectiveVehicleType])} />
        )}
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
