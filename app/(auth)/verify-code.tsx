import { useEffect, useState } from 'react';
import { Text, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { confirmEmailCode, resendVerificationCode } from '@/src/api/auth';
import { ApiError } from '@/src/api/client';

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyCode() {
  const colors = useThemeColors();
  const typography = useTypography();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => Math.max(s - 1, 0)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface, padding: 24, gap: 12, justifyContent: 'center' },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 24,
      letterSpacing: 8,
      textAlign: 'center',
      color: colors.text,
    },
    error: { color: '#C62828', fontSize: 13, textAlign: 'center' },
    info: { color: colors.teal, fontSize: 13, textAlign: 'center' },
    link: { color: colors.teal, textAlign: 'center', marginTop: 8 },
    linkDisabled: { color: colors.textSecondary },
  });

  async function handleConfirm() {
    if (!email) return;
    setError(null);
    setInfo(null);
    if (code.length !== 6) {
      setError('Ingresá el código de 6 dígitos que te mandamos por mail.');
      return;
    }

    setLoading(true);
    try {
      await confirmEmailCode(email, code);
      router.replace({ pathname: '/(auth)/login', params: { email } });
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'No se pudo confirmar el código.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!email || cooldown > 0) return;
    setError(null);
    setInfo(null);
    setResending(true);
    try {
      await resendVerificationCode(email);
      setInfo('Te mandamos un código nuevo.');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'No se pudo reenviar el código.');
    } finally {
      setResending(false);
    }
  }

  return (
    <Screen style={styles.container}>
      <Text style={typography.h1}>Confirmá tu email</Text>
      <Text style={typography.body}>
        Te mandamos un código de 6 dígitos a {email}. Ingresalo acá para activar tu cuenta.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {info ? <Text style={styles.info}>{info}</Text> : null}
      <TextInput
        style={styles.input}
        placeholder="000000"
        placeholderTextColor={colors.textSecondary}
        keyboardType="number-pad"
        maxLength={6}
        value={code}
        onChangeText={(v) => setCode(v.replace(/[^0-9]/g, ''))}
      />
      {loading ? (
        <ActivityIndicator color={colors.teal} />
      ) : (
        <Button title="Confirmar" onPress={handleConfirm} />
      )}
      <Text
        style={[styles.link, (cooldown > 0 || resending) && styles.linkDisabled]}
        onPress={handleResend}
      >
        {cooldown > 0 ? `Reenviar código (${cooldown}s)` : 'Reenviar código'}
      </Text>
    </Screen>
  );
}
