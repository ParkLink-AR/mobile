import { t, useLanguage } from '@/src/i18n';
import { Stack } from 'expo-router';
import { colors } from '@/src/theme/colors';

export default function DriverLayout() {
  useLanguage();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.deepNavy },
        headerTintColor: colors.white,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="spot/[id]" options={{ title: t('layout.driver.spotDetail') }} />
      <Stack.Screen name="spot/[id]/reviews" options={{ title: t('layout.driver.reviews') }} />
      <Stack.Screen name="booking/confirm" options={{ title: t('driver.booking.confirm.title') }} />
      <Stack.Screen name="booking/success" options={{ title: '', headerBackVisible: false }} />
      <Stack.Screen name="bookings/[id]" options={{ title: t('layout.driver.bookingDetail') }} />
      <Stack.Screen name="review/[bookingId]" options={{ title: t('layout.driver.review') }} />
      <Stack.Screen name="profile-edit" options={{ title: t('driver.profile.edit') }} />
      <Stack.Screen name="settings" options={{ title: t('owner.settings.title') }} />
    </Stack>
  );
}
