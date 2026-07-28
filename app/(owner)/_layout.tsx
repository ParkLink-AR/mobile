import { t } from '@/src/i18n';
import { Stack } from 'expo-router';
import { colors } from '@/src/theme/colors';

export default function OwnerLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.deepNavy },
        headerTintColor: colors.white,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="spots/new" options={{ title: 'Publicar cochera' }} />
      <Stack.Screen name="spots/[id]/edit" options={{ title: t('owner.spot.edit.title') }} />
      <Stack.Screen name="spots/[id]/availability" options={{ title: 'Disponibilidad' }} />
      <Stack.Screen name="settlements/index" options={{ title: 'Liquidaciones' }} />
      <Stack.Screen name="settlements/[id]" options={{ title: 'Detalle de liquidación' }} />
      <Stack.Screen name="review/[bookingId]" options={{ title: 'Calificar' }} />
      <Stack.Screen name="profile-edit" options={{ title: t('driver.profile.edit') }} />
      <Stack.Screen name="settings" options={{ title: t('owner.settings.title') }} />
    </Stack>
  );
}
