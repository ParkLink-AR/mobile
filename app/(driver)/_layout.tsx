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
      <Stack.Screen name="booking/confirm" options={{ title: 'Confirmar reserva' }} />
      <Stack.Screen name="booking/success" options={{ title: '', headerBackVisible: false }} />
      <Stack.Screen name="bookings/[id]" options={{ title: 'Reserva' }} />
      <Stack.Screen name="review/[bookingId]" options={{ title: 'Calificar' }} />
      <Stack.Screen name="profile-edit" options={{ title: 'Editar perfil' }} />
      <Stack.Screen name="settings" options={{ title: 'Configuración' }} />
    </Stack>
  );
}
