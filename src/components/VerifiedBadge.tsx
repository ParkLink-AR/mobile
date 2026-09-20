import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/theme/colors';
import { t, useLanguage } from '@/src/i18n';
import { useScale } from '@/src/theme/typography';

export function VerifiedBadge() {
  useLanguage();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  return (
    <View style={[styles.badge, { paddingHorizontal: sc(8), paddingVertical: sc(3), gap: sc(4), borderRadius: sc(6) }]}>
      <Ionicons name="checkmark-circle" size={sc(16)} color={colors.success} />
      <Text style={[styles.text, { fontSize: sc(16) }]}>{t('verifiedBadge.text')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    alignSelf: 'center',
    marginTop: 4,
  },
  text: {
    color: colors.success,
    fontWeight: '600',
  },
});
