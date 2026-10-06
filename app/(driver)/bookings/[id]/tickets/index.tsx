import { t, useLanguage } from '@/src/i18n';
import { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useSegments, useFocusEffect } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { Card } from '@/src/components/Card';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { getMyTicketsApi, TicketApiResponse, TicketStatus } from '@/src/api/booking';
import { useScale } from '@/src/theme/typography';

const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'ABIERTO',
  IN_PROGRESS: 'EN CURSO',
  RESOLVED: 'RESUELTO',
  CLOSED: 'CERRADO',
};

function formatTicketDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function BookingTickets() {
  useLanguage();
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const group = `/${useSegments()[0]}`;
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tickets, setTickets] = useState<TicketApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      setLoading(true);
      getMyTicketsApi(id)
        .then((list) => {
          setTickets(list);
          setLoadError(false);
        })
        .catch((err) => {
          console.warn('[BookingTickets] fetch error:', err);
          setLoadError(true);
        })
        .finally(() => setLoading(false));
    }, [id]),
  );

  const STATUS_COLORS: Record<TicketStatus, string> = {
    OPEN: colors.warning,
    IN_PROGRESS: colors.teal,
    RESOLVED: colors.success,
    CLOSED: colors.textSecondary,
  };

  const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
    errorText: { fontSize: sc(15), color: colors.textSecondary, textAlign: 'center', lineHeight: sc(22) },
    list: { paddingHorizontal: 16, paddingTop: 16, gap: 10 },
    listEmpty: { flexGrow: 1 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    subject: { fontSize: sc(15), fontWeight: '600', color: colors.text, flex: 1 },
    date: { fontSize: sc(12.5), color: colors.textSecondary, marginTop: 4 },
    badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
    badgeText: { color: colors.white, fontSize: sc(10.5), fontWeight: '700' },
    fab: {
      position: 'absolute', right: 20, bottom: 24,
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: colors.teal, borderRadius: 24, paddingHorizontal: 18, paddingVertical: 13,
    },
    fabText: { color: colors.white, fontSize: sc(14.5), fontWeight: '700' },
  });

  if (loadError) {
    return (
      <Screen style={styles.screen} edges={['left', 'right', 'bottom']}>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={sc(40)} color={colors.textSecondary} />
          <Text style={styles.errorText}>{t('driver.booking.tickets.error')}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen} edges={['left', 'right', 'bottom']}>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.teal} />
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, tickets.length === 0 && styles.listEmpty]}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Ionicons name="help-buoy-outline" size={sc(40)} color={colors.textSecondary} />
              <Text style={styles.errorText}>{t('driver.booking.tickets.empty')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`${group}/bookings/${id}/tickets/${item.id}`)}>
              <Card>
                <View style={styles.row}>
                  <Text style={styles.subject} numberOfLines={1}>{item.subject}</Text>
                  <View style={[styles.badge, { backgroundColor: STATUS_COLORS[item.status] }]}>
                    <Text style={styles.badgeText}>{STATUS_LABELS[item.status]}</Text>
                  </View>
                </View>
                <Text style={styles.date}>{formatTicketDate(item.created_at)}</Text>
              </Card>
            </Pressable>
          )}
        />
      )}

      <Pressable style={styles.fab} onPress={() => router.push(`${group}/bookings/${id}/tickets/new`)}>
        <Ionicons name="add" size={sc(18)} color={colors.white} />
        <Text style={styles.fabText}>{t('driver.booking.tickets.new')}</Text>
      </Pressable>
    </Screen>
  );
}
