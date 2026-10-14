import { t, useLanguage } from '@/src/i18n';
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useScale } from '@/src/theme/typography';
import { getBookingAccessApi } from '@/src/api/booking';

/**
 * "Cómo entrar": what the owner wrote about getting into the spot (gate code, floor, which
 * place). Only shown to the driver of an accepted booking -- booking-service refuses it
 * before -- and only when the owner wrote something.
 */
export function AccessInstructionsCard({ bookingId }: { bookingId: string }) {
  useLanguage();
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const [text, setText] = useState('');

  useEffect(() => {
    let cancelled = false;
    getBookingAccessApi(bookingId)
      .then((value) => !cancelled && setText(value.trim()))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  if (!text) return null;

  const styles = StyleSheet.create({
    card: {
      backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.teal,
      padding: 16, gap: 8,
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { fontSize: sc(15), fontWeight: '700', color: colors.text },
    body: { fontSize: sc(14), color: colors.text, lineHeight: sc(20) },
  });

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="key-outline" size={sc(16)} color={colors.teal} />
        <Text style={styles.title}>{t('booking.access.title')}</Text>
      </View>
      <Text style={styles.body} selectable>{text}</Text>
    </View>
  );
}
