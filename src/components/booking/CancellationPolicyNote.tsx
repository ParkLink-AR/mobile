import { t, useLanguage } from '@/src/i18n';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useScale } from '@/src/theme/typography';

/** The cancellation policy, shown before paying: what comes back when. */
export function CancellationPolicyNote() {
  useLanguage();
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const styles = StyleSheet.create({
    box: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    texts: { flex: 1, gap: 4 },
    title: { fontSize: sc(13), fontWeight: '700', color: colors.text },
    line: { fontSize: sc(12.5), color: colors.textSecondary, lineHeight: sc(18) },
  });
  return (
    <View style={styles.box}>
      <Ionicons name="shield-checkmark-outline" size={sc(18)} color={colors.teal} />
      <View style={styles.texts}>
        <Text style={styles.title}>{t('booking.policy.title')}</Text>
        <Text style={styles.line}>{t('booking.policy.full')}</Text>
        <Text style={styles.line}>{t('booking.policy.late')}</Text>
        <Text style={styles.line}>{t('booking.policy.owner')}</Text>
      </View>
    </View>
  );
}
