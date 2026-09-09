import { t } from '@/src/i18n';
import { useState } from 'react';
import { Text, TextInput, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useSessionStore } from '@/src/store/useSessionStore';
import { useAccountTypeStore, tabRouteFor } from '@/src/store/useAccountTypeStore';
import { login } from '@/src/api/auth';
import { ApiError } from '@/src/api/client';

export default function Login() {
  const colors = useThemeColors();
  const { email: prefilledEmail } = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(prefilledEmail ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setSession = useSessionStore((s) => s.setSession);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface, padding: 24, gap: 12, justifyContent: 'center' },
    logo: { width: 200, height: 150, alignSelf: 'center', marginBottom: 12 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 15,
      color: colors.text,
    },
    link: { color: colors.teal, textAlign: 'center', marginTop: 8 },
    error: { color: '#C62828', fontSize: 13, textAlign: 'center' },
  });

  async function handleLogin() {
    setError(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError('Completá email y contraseña.');
      return;
    }

    setLoading(true);
    try {
      const { user, tokens } = await login({ email: normalizedEmail, password });
      setSession(user, tokens);
      const { activeMode } = useAccountTypeStore.getState();
      router.replace(tabRouteFor(activeMode) as never);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        // Not verified yet -- send them to enter the code instead of just
        // showing an error they can't do anything about.
        router.push({ pathname: '/(auth)/verify-code', params: { email: normalizedEmail } });
        return;
      }
      setError(err instanceof ApiError ? err.detail : 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen style={styles.container}>
      <Image
        source={require('@/assets/logo-parklink.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder={t('auth.login.placeholder.password')}
        placeholderTextColor={colors.textSecondary}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {loading ? (
        <ActivityIndicator color={colors.teal} />
      ) : (
        <Button title={t('auth.login.button')} onPress={handleLogin} />
      )}
      <Text style={styles.link} onPress={() => router.push('/(auth)/register')}>
        ¿No tenés cuenta? Registrate
      </Text>
      <Text style={styles.link} onPress={() => router.push('/(auth)/forgot-password')}>
        Olvidé mi contraseña
      </Text>
    </Screen>
  );
}
