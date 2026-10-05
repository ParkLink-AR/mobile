import { t, useLanguage } from '@/src/i18n';
import { Text, View, ScrollView, StyleSheet } from 'react-native';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';

export default function Legal() {
  useLanguage();
  const colors = useThemeColors();

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, gap: 24, paddingBottom: 60 },
    section: { gap: 8 },
    sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
    body: { fontSize: 14, color: colors.textSecondary, lineHeight: 21 },
  });

  return (
    <Screen style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('legal.terms.title')}</Text>
          <Text style={styles.body}>{t('legal.terms.body')}</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('legal.privacy.title')}</Text>
          <Text style={styles.body}>{t('legal.privacy.body')}</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
