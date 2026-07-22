import { Stack } from 'expo-router';
import { colors } from '@/src/theme/colors';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.deepNavy },
        headerTintColor: colors.white,
      }}
    >
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ title: 'Registro' }} />
      <Stack.Screen name="forgot-password" options={{ title: 'Recuperar contraseña' }} />
    </Stack>
  );
}
