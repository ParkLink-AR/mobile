import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/src/theme/colors';
import { t, useLanguage } from '@/src/i18n';

export function VerifiedBadge() {
  useLanguage();
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{t('verifiedBadge.text')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: '#DCFCE7',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  text: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '600',
  },
});
