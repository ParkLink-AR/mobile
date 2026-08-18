import { t } from '@/src/i18n';
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { PaymentMethodPicker } from '@/src/components/PaymentMethodPicker';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { getParkingSpotDetail } from '@/src/services/parkingService';
import { createBooking } from '@/src/services/bookingService';
import { payBooking, getPaymentMethods } from '@/src/services/paymentService';
import { getDriverVisiblePrice } from '@/src/services/utils';
import { Booking, ParkingSpot, PaymentMethod } from '@/src/types';

export default function ConfirmBooking() {
  const colors = useThemeColors();
  const typography = useTypography();
  const { spotId, hours } = useLocalSearchParams<{ spotId: string; hours: string }>();
  const user = useSessionStore((s) => s.user);
  const [spot, setSpot] = useState<ParkingSpot | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [paying, setPaying] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getParkingSpotDetail(spotId).then(async (s) => {
      if (!s) return;
      setSpot(s);
      const created = await createBooking({
        parkingSpot: s,
        driverId: user.id,
        driverName: user.name,
        date: 'Hoy',
        startTime: '14:00',
        endTime: '17:00',
        hours: Number(hours),
      });
      setBooking(created);
    });
    getPaymentMethods().then((methods) => {
      setPaymentMethods(methods);
      setSelectedMethodId(methods[0]?.id ?? null);
    });
  }, [spotId, hours, user?.id]);

  async function confirmAndPay() {
    if (!booking) return;
    setPaying(true);
    await payBooking(booking.id);
    router.replace({ pathname: '/(driver)/booking/success', params: { bookingId: booking.id } });
  }

  if (!user || !spot || !booking) return <ActivityIndicator style={{ marginTop: 40 }} />;

  const selectedMethod = paymentMethods.find((m) => m.id === selectedMethodId);
  const isCash = selectedMethod?.type === 'cash';
  const visiblePricePerHour = getDriverVisiblePrice(spot.pricePerHour);

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
        <Text style={[typography.caption, styles.sectionTitle]}>RESUMEN</Text>
        <Row label="Fecha" value={booking.date} />
        <Row label="Horario" value={`${booking.startTime} a ${booking.endTime}`} />
        <Row label={t('driver.booking.pricePerHour')} value={`$${visiblePricePerHour}`} />
        <Row label="Cantidad de horas" value={`${booking.hours} hs`} />
        <Row label="Total" value={`$${booking.total}`} bold />
        <Text style={[typography.caption, styles.sectionTitle]}>MÉTODO DE PAGO</Text>
        <PaymentMethodPicker
          methods={paymentMethods}
          selectedId={selectedMethodId}
          onSelect={setSelectedMethodId}
        />
        <Button
          title={
            paying
              ? 'Procesando...'
              : isCash
                ? `Confirmar reserva · $${booking.total}`
                : `Pagar y confirmar · $${booking.total}`
          }
          onPress={confirmAndPay}
          disabled={paying}
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
