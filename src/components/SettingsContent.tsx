import { ReactNode, useState } from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { Screen } from '@/src/components/Screen';
import { Card } from '@/src/components/Card';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';

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
          <Text style={typography.caption}>Español (Argentina)</Text>
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
