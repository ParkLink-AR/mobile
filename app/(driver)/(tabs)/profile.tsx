import { useEffect, useState } from 'react';
import { Text, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { VerifiedBadge } from '@/src/components/VerifiedBadge';
import { PaymentMethodPicker } from '@/src/components/PaymentMethodPicker';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { getPaymentMethods } from '@/src/services/paymentService';
import { PaymentMethod } from '@/src/types';

export default function DriverProfile() {
  const colors = useThemeColors();
  const typography = useTypography();
  const user = useSessionStore((s) => s.user);
  const logout = useSessionStore((s) => s.logout);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);

  useEffect(() => {
    getPaymentMethods().then((methods) => {
      setPaymentMethods(methods);
      setSelectedMethodId(methods[0]?.id ?? null);
    });
  }, []);

  if (!user) return null;

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { padding: 16, gap: 12 },
    sectionTitle: { marginTop: 8 },
    logout: { backgroundColor: colors.textSecondary, marginTop: 8 },
  });

  return (
    <Screen style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={typography.h1}>Mi perfil</Text>
        <Card>
          <Text style={typography.h2}>{user.name}</Text>
          <Text style={typography.caption}>{user.email}</Text>
          <VerifiedBadge />
        </Card>
        <Button title="Editar perfil" onPress={() => router.push('/(driver)/profile-edit')} />

        <Text style={[typography.caption, styles.sectionTitle]}>MÉTODOS DE PAGO</Text>
        <PaymentMethodPicker
          methods={paymentMethods}
          selectedId={selectedMethodId}
          onSelect={setSelectedMethodId}
        />

        <Button
          title="Cerrar sesión"
          onPress={() => {
            logout();
            router.replace('/(auth)/login');
          }}
          style={styles.logout}
        />
      </ScrollView>
    </Screen>
  );
}
