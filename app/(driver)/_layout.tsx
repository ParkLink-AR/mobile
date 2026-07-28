import { t } from '@/src/i18n';
import { Stack } from 'expo-router';
import { colors } from '@/src/theme/colors';

export default function DriverLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.deepNavy },
        headerTintColor: colors.white,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="spot/[id]" options={{ title: 'Detalle' }} />
      <Stack.Screen name="spot/[id]/reviews" options={{ title: 'Reseñas' }} />
      <Stack.Screen name="booking/confirm" options={{ title: t('driver.booking.confirm.title') }} />
      <Stack.Screen name="booking/success" options={{ title: '', headerBackVisible: false }} />
      <Stack.Screen name="bookings/[id]" options={{ title: 'Reserva' }} />
      <Stack.Screen name="review/[bookingId]" options={{ title: 'Calificar' }} />
      <Stack.Screen name="profile-edit" options={{ title: t('driver.profile.edit') }} />
      <Stack.Screen name="settings" options={{ title: t('owner.settings.title') }} />
    </Stack>
  );
}
