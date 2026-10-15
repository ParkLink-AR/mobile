import { t, useLanguage } from '@/src/i18n';
import { Text, View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useScale } from '@/src/theme/typography';
import { PRIVACY_URL, TERMS_URL, openLegalPage } from '@/src/constants/legal';

/** "Legales": the Terms of Service and the Privacy Policy, opened from the website. */
export default function Legal() {
  useLanguage();
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, gap: 14, paddingBottom: 60 },
    intro: { fontSize: sc(14), color: colors.textSecondary, lineHeight: sc(21) },
    card: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
    rowText: { flex: 1, gap: 2 },
    rowTitle: { fontSize: sc(15), fontWeight: '700', color: colors.text },
    rowBody: { fontSize: sc(13), color: colors.textSecondary, lineHeight: sc(18) },
    divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },
  });

  const rows = [
    { icon: 'document-text-outline' as const, title: t('legal.terms.title'), body: t('legal.terms.body'), url: TERMS_URL },
    { icon: 'shield-checkmark-outline' as const, title: t('legal.privacy.title'), body: t('legal.privacy.body'), url: PRIVACY_URL },
  ];

  return (
    <Screen style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>{t('legal.intro')}</Text>
        <View style={styles.card}>
          {rows.map((row, index) => (
            <View key={row.url}>
              {index > 0 && <View style={styles.divider} />}
              <Pressable style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]} onPress={() => openLegalPage(row.url)}>
                <Ionicons name={row.icon} size={sc(22)} color={colors.teal} />
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{row.title}</Text>
                  <Text style={styles.rowBody}>{row.body}</Text>
                </View>
                <Ionicons name="open-outline" size={sc(16)} color={colors.teal} />
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}
