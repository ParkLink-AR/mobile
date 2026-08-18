import { t, useLanguage } from '@/src/i18n';
import { Stack } from 'expo-router';
import { colors } from '@/src/theme/colors';

export default function OwnerLayout() {
  useLanguage();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.deepNavy },
        headerTintColor: colors.white,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="spots/new" options={{ title: t('layout.owner.newSpot') }} />
      <Stack.Screen name="spots/[id]/edit" options={{ title: t('owner.spot.edit.title') }} />
      <Stack.Screen name="spots/[id]/availability" options={{ title: t('layout.owner.availability') }} />
      <Stack.Screen name="settlements/index" options={{ title: t('layout.owner.settlements') }} />
      <Stack.Screen name="settlements/[id]" options={{ title: t('layout.owner.settlementDetail') }} />
      <Stack.Screen name="review/[bookingId]" options={{ title: t('layout.owner.review') }} />
      <Stack.Screen name="profile-edit" options={{ title: t('driver.profile.edit') }} />
      <Stack.Screen name="settings" options={{ title: t('owner.settings.title') }} />
    </Stack>
  );
}
