import { t } from '@/src/i18n';
import { Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { VerifiedBadge } from '@/src/components/VerifiedBadge';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';

export default function OwnerProfile() {
  const colors = useThemeColors();
  const typography = useTypography();
  const user = useSessionStore((s) => s.user);
  const logout = useSessionStore((s) => s.logout);

  if (!user) return null;

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 16, gap: 12 },
    logout: { backgroundColor: colors.textSecondary },
  });

  return (
    <Screen style={styles.container}>
      <Text style={typography.h1}>Mi perfil</Text>
      <Card>
        <Text style={typography.h2}>{user.name}</Text>
        <Text style={typography.caption}>{user.email}</Text>
        <VerifiedBadge />
      </Card>
      <Button title=t('driver.profile.edit') onPress={() => router.push('/(owner)/profile-edit')} />
      <Button title="Ver liquidaciones" onPress={() => router.push('/(owner)/settlements')} />
      <Button
        title="Cerrar sesión"
        onPress={() => {
          logout();
          router.replace('/(auth)/login');
        }}
        style={styles.logout}
      />
    </Screen>
  );
}
