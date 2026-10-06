import { t, useLanguage } from '@/src/i18n';
import { useEffect, useState } from 'react';
import { Text, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography, useScale } from '@/src/theme/typography';
import { requestPasswordReset, confirmPasswordReset } from '@/src/api/auth';
import { ApiError } from '@/src/api/client';

type Step = 'email' | 'reset';
const RESEND_COOLDOWN_SECONDS = 60;

export default function ForgotPassword() {
  useLanguage();
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const typography = useTypography();

  const [step, setStep] = useState<Step>('email');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => Math.max(s - 1, 0)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface, padding: 24, gap: 12 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: sc(15),
      color: colors.text,
    },
    codeInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: sc(24),
      letterSpacing: 8,
      textAlign: 'center',
      color: colors.text,
    },
    error: { color: '#C62828', fontSize: sc(13) },
    info: { color: colors.teal, fontSize: sc(13) },
    link: { color: colors.teal, textAlign: 'center', marginTop: 4 },
    linkDisabled: { color: colors.textSecondary },
  });

  async function handleRequestCode() {
    setError(null);
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      setError(t('auth.error.emailRequired'));
      return;
    }
    setLoading(true);
    try {
      await requestPasswordReset(normalized);
      setEmail(normalized);
      setStep('reset');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : t('auth.error.sendCode'));
    } finally {
      setLoading(false);
    }
  }

  async function handleResendCode() {
    if (cooldown > 0) return;
    setError(null);
    setInfo(null);
    try {
      await requestPasswordReset(email);
      setInfo(t('auth.resendSuccess'));
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : t('auth.error.resendCode'));
    }
  }

  async function handleConfirmReset() {
    setError(null);
    if (code.length !== 6) {
      setError(t('auth.error.codeLength'));
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError(t('auth.forgotPassword.reset.passwordMismatch'));
      return;
    }
    setLoading(true);
    try {
      await confirmPasswordReset(email, code, newPassword);
      router.replace({ pathname: '/(auth)/login', params: { email } });
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : t('auth.forgotPassword.error.submit'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen form style={styles.container} edges={['left', 'right', 'bottom']}>
      <Text style={typography.h1}>{t('auth.forgotPassword.title')}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {info ? <Text style={styles.info}>{info}</Text> : null}

      {step === 'email' ? (
        <>
          <TextInput
            style={styles.input}
            placeholder={t('auth.emailPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          {loading ? (
            <ActivityIndicator color={colors.teal} />
          ) : (
            <Button title={t('auth.sendCodeButton')} onPress={handleRequestCode} />
          )}
        </>
      ) : (
        <>
          <Text style={typography.body}>
            {t('auth.forgotPassword.reset.helper', { email })}
          </Text>
          <TextInput
            style={styles.codeInput}
            placeholder="000000"
            placeholderTextColor={colors.textSecondary}
            keyboardType="number-pad"
            maxLength={6}
            value={code}
            onChangeText={(v) => setCode(v.replace(/[^0-9]/g, ''))}
          />
          <TextInput
            style={styles.input}
            placeholder={t('auth.forgotPassword.reset.newPassword')}
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
          />
          <TextInput
            style={styles.input}
            placeholder={t('auth.forgotPassword.reset.confirmPassword')}
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            value={confirmNewPassword}
            onChangeText={setConfirmNewPassword}
          />
          {loading ? (
            <ActivityIndicator color={colors.teal} />
          ) : (
            <Button title={t('auth.forgotPassword.reset.button')} onPress={handleConfirmReset} />
          )}
          <Text
            style={[styles.link, cooldown > 0 && styles.linkDisabled]}
            onPress={handleResendCode}
          >
            {cooldown > 0 ? t('auth.resendCodeCooldown', { seconds: String(cooldown) }) : t('auth.resendCode')}
          </Text>
        </>
      )}
    </Screen>
  );
}
