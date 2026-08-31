import { t, useLanguage } from '@/src/i18n';
import { Stack } from 'expo-router';
import { colors } from '@/src/theme/colors';

export default function AuthLayout() {
  useLanguage();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.deepNavy },
        headerTintColor: colors.white,
      }}
    >
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ title: t('layout.auth.register') }} />
      <Stack.Screen name="verify-code" options={{ title: t('layout.auth.verifyEmail') }} />
      <Stack.Screen name="forgot-password" options={{ title: t('auth.forgotPassword.title') }} />
    </Stack>
  );
}
