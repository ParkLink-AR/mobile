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
        // Just the arrow: iOS would otherwise spell out the previous screen's name
        // next to it ("login", "(tabs)"...).
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ title: t('layout.auth.register') }} />
      {/* A welcome screen of its own, no header bar (there's nowhere to go back to). */}
      <Stack.Screen name="account-type" options={{ headerShown: false }} />
      <Stack.Screen name="verify-code" options={{ title: t('layout.auth.verifyEmail') }} />
      <Stack.Screen name="forgot-password" options={{ title: t('auth.forgotPassword.title') }} />
    </Stack>
  );
}
