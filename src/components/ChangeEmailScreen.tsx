import { t, useLanguage } from '@/src/i18n';
import { useEffect, useState } from 'react';
import { Text, TextInput, StyleSheet, ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { requestEmailChange, confirmEmailChange } from '@/src/api/auth';
import { ApiError } from '@/src/api/client';
import { useAccountTypeStore } from '@/src/store/useAccountTypeStore';

const RESEND_COOLDOWN_SECONDS = 60;

export default function ChangeEmailScreen() {
  useLanguage();
  const colors = useThemeColors();
  // Shared by driver's and owner's "cambiar email" (owner re-exports this screen).
  // ownerAccent is a light tone (needs dark text); teal is dark (needs white text).
  const isOwnerMode = useAccountTypeStore((s) => s.activeMode) === 'owner';
  const accent = isOwnerMode ? colors.ownerAccent : colors.teal;
  const accentTextColor = isOwnerMode ? colors.deepNavy : colors.white;
  const typography = useTypography();
  const user = useSessionStore((s) => s.user)!;
  const setUser = useSessionStore((s) => s.setUser);

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [newEmail, setNewEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => Math.max(s - 1, 0)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface, padding: 24, gap: 12, justifyContent: 'center' },
    current: { fontSize: 14, color: colors.textSecondary, marginBottom: 4 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 15,
      color: colors.text,
    },
    codeInput: {
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
    success: { color: accent, fontSize: 15, fontWeight: '600', textAlign: 'center' },
    link: { color: accent, textAlign: 'center', marginTop: 8 },
    linkDisabled: { color: colors.textSecondary },
  });

  async function handleSendCode() {
    setError(null);
    const normalized = newEmail.trim().toLowerCase();
    if (!normalized) {
      setError(t('changeEmail.newEmail.label'));
      return;
    }
    setLoading(true);
    try {
      await requestEmailChange(user.id, normalized);
      setNewEmail(normalized);
      setStep('code');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'No se pudo enviar el código.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0) return;
    setError(null);
    try {
      await requestEmailChange(user.id, newEmail);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'No se pudo reenviar el código.');
    }
  }

  async function handleConfirm() {
    setError(null);
    if (code.length !== 6) {
      setError('Ingresá el código de 6 dígitos.');
      return;
    }
    setLoading(true);
    try {
      const updated = await confirmEmailChange(user.id, code);
      setUser({ ...updated, avatarUrl: user.avatarUrl });
      router.back();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'No se pudo confirmar el código.');
    } finally {
      setLoading(false);
    }
  }

  if (step === 'code') {
    return (
      <Screen style={styles.container} edges={['left', 'right', 'bottom']}>
        <Text style={typography.h1}>{t('changeEmail.code.title')}</Text>
        <Text style={typography.body}>{t('changeEmail.code.helper', { email: newEmail })}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TextInput
          style={styles.codeInput}
          placeholder="000000"
          placeholderTextColor={colors.textSecondary}
          keyboardType="number-pad"
          maxLength={6}
          value={code}
          onChangeText={(v) => setCode(v.replace(/[^0-9]/g, ''))}
        />
        {loading ? (
          <ActivityIndicator color={accent} />
        ) : (
          <Button title={t('changeEmail.code.button')} onPress={handleConfirm} color={accent} textColor={accentTextColor} />
        )}
        <Text style={[styles.link, cooldown > 0 && styles.linkDisabled]} onPress={handleResend}>
          {cooldown > 0 ? `Reenviar código (${cooldown}s)` : 'Reenviar código'}
        </Text>
      </Screen>
    );
  }

  return (
    <Screen style={styles.container} edges={['left', 'right', 'bottom']}>
      <Text style={typography.h1}>{t('changeEmail.title')}</Text>
      <View>
        <Text style={styles.current}>{user.email}</Text>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TextInput
        style={styles.input}
        placeholder={t('changeEmail.newEmail.placeholder')}
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="none"
        keyboardType="email-address"
        value={newEmail}
        onChangeText={setNewEmail}
      />
      {loading ? (
        <ActivityIndicator color={accent} />
      ) : (
        <Button title={t('changeEmail.newEmail.button')} onPress={handleSendCode} color={accent} textColor={accentTextColor} />
      )}
    </Screen>
  );
}
