import { t, useLanguage } from '@/src/i18n';
import { Stack } from 'expo-router';
import { colors } from '@/src/theme/colors';
import { useScale } from '@/src/theme/typography';

export default function DriverLayout() {
  useLanguage();
  const scale = useScale();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.deepNavy },
        // SDK 58 makes the iOS 26+ header see-through (Liquid Glass) with the screen running under
        // it; ours is a solid navy bar the content starts below.
        headerTransparent: false,
        headerTintColor: colors.white,
        // Grows with "Texto: Grande" like the rest of the app; a long title still fits on one line.
        headerTitleStyle: { fontSize: Math.round(17 * scale), fontWeight: '600' },
        // Just the arrow: iOS would otherwise spell out the previous screen's name
        // next to it ("login", "(tabs)"...).
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      {/* Spot (driver view) */}
      <Stack.Screen name="spot/[id]" options={{ title: t('layout.driver.spotDetail') }} />
      <Stack.Screen name="spot/[id]/reviews" options={{ title: t('layout.driver.reviews') }} />
      {/* Booking flow */}
      <Stack.Screen name="booking/confirm" options={{ title: t('driver.booking.confirm.title') }} />
      <Stack.Screen name="booking/confirm-stay" options={{ title: t('driver.booking.confirm.title') }} />
      {/* Its own full-screen result design, no header bar (and nowhere to go back to). */}
      <Stack.Screen name="payment/pending" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="payment/success" options={{ title: '', headerBackVisible: false }} />
      <Stack.Screen name="payment/failure" options={{ title: '', headerBackVisible: false }} />
      <Stack.Screen name="bookings/[id]" options={{ title: t('layout.driver.bookingDetail') }} />
      <Stack.Screen name="bookings/[id]/messages" options={{ title: t('driver.booking.messages.link') }} />
      <Stack.Screen name="bookings/[id]/tickets/index" options={{ title: t('driver.booking.tickets.link') }} />
      <Stack.Screen name="bookings/[id]/tickets/new" options={{ title: t('driver.booking.tickets.new') }} />
      <Stack.Screen name="bookings/[id]/tickets/[ticketId]" options={{ title: t('driver.booking.tickets.link') }} />
      <Stack.Screen name="review/[bookingId]" options={{ title: t('layout.driver.review') }} />
      <Stack.Screen name="profile/[userId]" options={{ title: t('layout.driver.profile') }} />
      {/* Owner / spot management */}
      <Stack.Screen name="spots/new" options={{ title: t('layout.owner.newSpot') }} />
      <Stack.Screen name="spots/[id]" options={{ title: t('owner.spot.detail.headerTitle') }} />
      <Stack.Screen name="spots/[id]/edit" options={{ title: t('owner.spot.edit.title') }} />
      <Stack.Screen name="spots/[id]/availability" options={{ title: t('layout.owner.availability') }} />
      <Stack.Screen name="spots/[id]/blocked-dates" options={{ title: t('owner.blocked.title') }} />
      <Stack.Screen name="spots/[id]/requests" options={{ title: t('owner.spot.requests.title') }} />
      <Stack.Screen name="spots/[id]/documentation" options={{ title: t('owner.spot.documentation.title') }} />
      <Stack.Screen name="settlements" options={{ title: t('layout.owner.settlements') }} />
      <Stack.Screen name="settlements/[id]" options={{ title: t('layout.owner.settlementDetail') }} />
      <Stack.Screen name="vehicles" options={{ title: t('vehicles.title') }} />
      <Stack.Screen name="debts" options={{ title: t('debts.title') }} />
      <Stack.Screen name="legal" options={{ title: t('legal.title') }} />
      <Stack.Screen name="account-deletion" options={{ title: t('account.deletion.title') }} />
      {/* Profile */}
      <Stack.Screen name="profile-edit" options={{ title: t('driver.profile.edit') }} />
      <Stack.Screen name="change-email" options={{ title: t('changeEmail.title') }} />
      <Stack.Screen name="change-password" options={{ title: t('changePassword.title') }} />
      <Stack.Screen name="change-phone" options={{ title: t('changePhone.title') }} />
      <Stack.Screen name="settings" options={{ title: t('owner.settings.title') }} />
    </Stack>
  );
}
