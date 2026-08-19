import { t, useLanguage } from '@/src/i18n';
import { useCallback, useState } from 'react';
import { View, Text, Image, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { AccountMenu } from '@/src/components/AccountMenu';
import { router, useFocusEffect } from 'expo-router';
import { Card } from '@/src/components/Card';
import { StatusBadge } from '@/src/components/StatusBadge';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { getBookingsForUser } from '@/src/services/bookingService';
import { getSettlementsForOwner } from '@/src/services/paymentService';
import { Booking } from '@/src/types';

export default function OwnerHome() {
  useLanguage();
  const colors = useThemeColors();
  const typography = useTypography();
  const user = useSessionStore((s) => s.user);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [monthTotal, setMonthTotal] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      getBookingsForUser(user.id, 'owner').then((all) =>
        setBookings(all.filter((b) => b.status === 'CONFIRMED' || b.status === 'PENDING_PAYMENT'))
      );
      getSettlementsForOwner(user.id).then((s) => setMonthTotal(s[0]?.totalAmount ?? 0));
    }, [user?.id])
  );

  if (!user) return null;

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 16, gap: 12 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerLogo: { width: 32, height: 32 },
    headerGreeting: { flex: 1 },
    earnings: { backgroundColor: colors.deepNavy },
    earningsLabel: { color: colors.white, opacity: 0.8 },
    earningsValue: { color: colors.white, fontSize: 28, fontWeight: '700', marginTop: 4 },
    earningsDelta: { color: colors.success, marginTop: 4 },
    sectionTitle: { marginTop: 4 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    total: { color: colors.teal, fontWeight: '700' },
  });

  return (
    <Screen style={styles.container}>
      <View style={styles.headerRow}>
        <Image
          source={require('@/assets/favicon.png')}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <Text style={[typography.h1, styles.headerGreeting]}>
          {t('common.greeting.hello').replace('%{name}', user.name)}
        </Text>
        <AccountMenu role="owner" />
      </View>
      <Card style={styles.earnings}>
        <Text style={styles.earningsLabel}>{t('owner.home.earningsLabel')}</Text>
        <Text style={styles.earningsValue}>${monthTotal.toLocaleString('es-AR')}</Text>
        <Text style={styles.earningsDelta}>{t('owner.home.earningsDelta')}</Text>
      </Card>
      <Text style={[typography.caption, styles.sectionTitle]}>{t('owner.home.upcomingBookings')}</Text>
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 10 }}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push(`/(owner)/(tabs)/bookings`)}>
            <Card>
              <View style={styles.row}>
                <Text style={typography.h2}>{item.driverName}</Text>
                <StatusBadge status={item.status} />
              </View>
              <View style={styles.row}>
                <Text style={typography.caption}>
                  {item.date} · {item.startTime} {t('driver.booking.timeTo')} {item.endTime}
                </Text>
                <Text style={styles.total}>${item.total}</Text>
              </View>
            </Card>
          </TouchableOpacity>
        )}
      />
    </Screen>
  );
}
