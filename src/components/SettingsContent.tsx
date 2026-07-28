import { ReactNode, useState } from 'react';
import { View, Text, Switch, StyleSheet, Pressable } from 'react-native';
import { Screen } from '@/src/components/Screen';
import { Card } from '@/src/components/Card';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSettingsStore, Language } from '@/src/store/useSettingsStore';
import i18n from '@/src/i18n';

export function SettingsContent() {
  const colors = useThemeColors();
  const typography = useTypography();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(false);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 16 },
    sectionTitle: { marginTop: 12, marginBottom: 6 },
    card: { padding: 0 },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    divider: { height: 1, backgroundColor: colors.border },
  });

  return (
    <Screen style={styles.container}>
      <Text style={[typography.caption, styles.sectionTitle]}>NOTIFICACIONES</Text>
      <Card style={styles.card}>
        <Row label="Notificaciones push">
          <Switch value={pushEnabled} onValueChange={setPushEnabled} trackColor={{ true: colors.teal }} />
        </Row>
        <View style={styles.divider} />
        <Row label="Notificaciones por email">
          <Switch value={emailEnabled} onValueChange={setEmailEnabled} trackColor={{ true: colors.teal }} />
        </Row>
      </Card>

      <Text style={[typography.caption, styles.sectionTitle]}>PREFERENCIAS</Text>
      <Card style={styles.card}>
        <Row label="Idioma">
          <LanguagePicker />
        </Row>
        <View style={styles.divider} />
        <Row label="Tema">
          <ThemeToggle />
        </Row>
      </Card>

      <Text style={[typography.caption, styles.sectionTitle]}>ACERCA DE</Text>
      <Card style={styles.card}>
        <Row label="Versión">
          <Text style={typography.caption}>1.0.0</Text>
        </Row>
      </Card>
    </Screen>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  const typography = useTypography();
  const styles = StyleSheet.create({
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
  });
  return (
    <View style={styles.row}>
      <Text style={typography.body}>{label}</Text>
      {children}
    </View>
  );
}

function LanguagePicker() {
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const typography = useTypography();

  const opts: { key: Language; label: string }[] = [
    { key: 'es', label: 'Español' },
    { key: 'en', label: 'English' },
    { key: 'ja', label: '日本語' },
  ];

  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {opts.map((o) => (
        <Pressable key={o.key} onPress={() => setLanguage(o.key)} style={{ padding: 6 }}>
          <Text style={[typography.caption, { opacity: language === o.key ? 1 : 0.6 }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function ThemeToggle() {
  const mode = useSettingsStore((s) => s.mode);
  const toggle = useSettingsStore((s) => s.toggleMode);
  return <Switch value={mode === 'dark'} onValueChange={toggle} />;
}
