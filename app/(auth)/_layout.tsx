import { t, useLanguage } from '@/src/i18n';
import { Stack } from 'expo-router';
import { colors } from '@/src/theme/colors';
import { useScale } from '@/src/theme/typography';

export default function AuthLayout() {
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
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ title: t('layout.auth.register') }} />
      {/* A welcome screen of its own, no header bar (there's nowhere to go back to). */}
      <Stack.Screen name="account-type" options={{ headerShown: false }} />
      <Stack.Screen name="verify-code" options={{ title: t('layout.auth.verifyEmail') }} />
      <Stack.Screen name="forgot-password" options={{ title: t('auth.forgotPassword.title') }} />
    </Stack>
  );
}
