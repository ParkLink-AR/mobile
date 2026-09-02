import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/theme/colors';
import { t, useLanguage } from '@/src/i18n';

export function VerifiedBadge() {
  useLanguage();
  return (
    <View style={styles.badge}>
      <Ionicons name="checkmark-circle" size={13} color={colors.success} />
      <Text style={styles.text}>{t('verifiedBadge.text')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
