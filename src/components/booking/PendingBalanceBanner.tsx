import { t, useLanguage } from '@/src/i18n';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { router, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useScale } from '@/src/theme/typography';
import { formatDebtPesos } from '@/src/services/debts';

/**
 * The heads-up for a driver who owes a balance for staying past the end of a booking: shown
 * before they pick a time, so the extra amount on the confirmation is no surprise. It blocks
 * nothing. Renders nothing when they owe nothing.
 */
export function PendingBalanceBanner({ pending }: { pending: number }) {
  useLanguage();
  const group = `/${useSegments()[0]}`;
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);

  if (pending <= 0) return null;

  const styles = StyleSheet.create({
    card: {
      flexDirection: 'row', gap: 12, padding: 14, borderRadius: 14,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.warning,
    },
    body: { flex: 1, gap: 4 },
    title: { fontSize: sc(14), fontWeight: '700', color: colors.text },
    text: { fontSize: sc(13), color: colors.textSecondary, lineHeight: sc(18) },
    action: { fontSize: sc(13), fontWeight: '700', color: colors.teal, marginTop: 2 },
  });

  return (
    <Pressable
      style={({ pressed }) => [styles.card, { opacity: pressed ? 0.85 : 1 }]}
      onPress={() => router.push(`${group}/debts` as never)}
      accessibilityRole="button"
    >
      <Ionicons name="alert-circle-outline" size={sc(22)} color={colors.warning} />
      <View style={styles.body}>
        <Text style={styles.title}>{t('debts.banner.title')}</Text>
        <Text style={styles.text}>{t('debts.banner.body', { amount: formatDebtPesos(pending) })}</Text>
        <Text style={styles.action}>{t('debts.banner.action')}</Text>
      </View>
    </Pressable>
  );
}
