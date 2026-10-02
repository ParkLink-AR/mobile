import { t, useLanguage } from '@/src/i18n';
import { useCallback, useState } from 'react';
import { Text, View, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useSegments } from 'expo-router';
import { Card } from '@/src/components/Card';
import { Screen } from '@/src/components/Screen';
import { SettlementStatusBadge } from '@/src/components/SettlementStatusBadge';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { getSettlementsForOwner } from '@/src/services/paymentService';
import { formatFullDateFromISO } from '@/src/services/bookingDates';
import { Settlement } from '@/src/types';

export default function Settlements() {
  useLanguage();
  const group = `/${useSegments()[0]}`;
  const colors = useThemeColors();
  const typography = useTypography();
  const user = useSessionStore((s) => s.user);
  const [settlements, setSettlements] = useState<Settlement[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        getSettlementsForOwner(user.id)
          .then(setSettlements)
          .catch((err) => console.warn('[Settlements] fetch error:', err));
      }
    }, [user?.id])
  );

  if (!user) return null;

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 16, paddingTop: 8, gap: 8 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    amount: { color: colors.teal, fontWeight: '700', fontSize: 20, marginTop: 4 },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
    emptyText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  });

  return (
    <Screen style={styles.container} edges={['left', 'right', 'bottom']}>
      <Text style={typography.h1}>{t('settlements.title')}</Text>
      <FlatList
        data={settlements}
        keyExtractor={(item) => item.id}
        contentContainerStyle={settlements.length === 0 ? { gap: 10, flexGrow: 1 } : { gap: 10 }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cash-outline" size={40} color={colors.textSecondary} />
            <Text style={styles.emptyText}>{t('settlements.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push(`${group}/settlements/${item.id}`)}>
            <Card>
              <View style={styles.headerRow}>
                <Text style={typography.h2}>
                  {item.status === 'PENDING'
                    ? formatFullDateFromISO(item.createdAt)
                    : item.paidAt
                      ? formatFullDateFromISO(item.paidAt)
                      : t('settlements.unknownDate')}
                </Text>
                <SettlementStatusBadge status={item.status} />
              </View>
              <Text style={styles.amount}>
                ${(item.netAmount / 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
              <Text style={typography.caption}>
                {t('settlements.commission', {
                  amount: (item.commissionAmount / 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                })}
              </Text>
            </Card>
          </TouchableOpacity>
        )}
      />
    </Screen>
  );
}
