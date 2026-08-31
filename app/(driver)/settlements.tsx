import { t, useLanguage } from '@/src/i18n';
import { useCallback, useState } from 'react';
import { Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Card } from '@/src/components/Card';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { getSettlementsForOwner } from '@/src/services/paymentService';
import { Settlement } from '@/src/types';

export default function Settlements() {
  useLanguage();
  const colors = useThemeColors();
  const typography = useTypography();
  const user = useSessionStore((s) => s.user);
  const [settlements, setSettlements] = useState<Settlement[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (user) getSettlementsForOwner(user.id).then(setSettlements);
    }, [user?.id])
  );

  if (!user) return null;

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 16, gap: 12 },
    amount: { color: colors.teal, fontWeight: '700', fontSize: 20, marginTop: 4 },
  });

  return (
    <Screen style={styles.container}>
      <Text style={typography.h1}>{t('settlements.title')}</Text>
      <FlatList
        data={settlements}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 10 }}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push(`/(driver)/settlements/${item.id}`)}>
            <Card>
              <Text style={typography.h2}>{item.period}</Text>
              <Text style={styles.amount}>${item.totalAmount.toLocaleString('es-AR')}</Text>
              <Text style={typography.caption}>
                {t('settlements.commission', { amount: item.commissionRetained.toLocaleString('es-AR') })}
              </Text>
            </Card>
          </TouchableOpacity>
        )}
      />
    </Screen>
  );
}
