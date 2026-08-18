import { t, useLanguage } from '@/src/i18n';
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
import { useSettingsStore } from '@/src/store/useSettingsStore';
import { getPaymentMethods } from '@/src/services/paymentService';
import { PaymentMethod } from '@/src/types';

export default function DriverProfile() {
  const colors = useThemeColors();
  const typography = useTypography();
  const language = useSettingsStore((s) => s.language); // also serves as useLanguage()
  const user = useSessionStore((s) => s.user);
  const logout = useSessionStore((s) => s.logout);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);

  useEffect(() => {
    getPaymentMethods().then((methods) => {
      setPaymentMethods(methods);
      setSelectedMethodId((prev) => prev ?? methods[0]?.id ?? null);
    });
  }, [language]); // refetch on language change so labels are translated

  useEffect(() => {
    // no-op: language variable used above to trigger payment method refetch
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
        <Text style={typography.h1}>{t('driver.profile.title')}</Text>
        <Card>
          <Text style={typography.h2}>{user.name}</Text>
          <Text style={typography.caption}>{user.email}</Text>
          <VerifiedBadge />
        </Card>
        <Button title={t('driver.profile.edit')} onPress={() => router.push('/(driver)/profile-edit')} />

        <Text style={[typography.caption, styles.sectionTitle]}>{t('driver.paymentMethods.title')}</Text>
        <PaymentMethodPicker
          methods={paymentMethods}
          selectedId={selectedMethodId}
          onSelect={setSelectedMethodId}
        />

        <Button
          title={t('account.logout')}
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
