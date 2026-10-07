import { t, useLanguage } from '@/src/i18n';
import { useEffect, useState } from 'react';
import { Text, TextInput, ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { requestPasswordReset, confirmPasswordReset } from '@/src/api/auth';
import { ApiError } from '@/src/api/client';
import { CodeInput, FormError, FormIntro, useAccountFormStyles } from '@/src/components/AccountForm';

type Step = 'email' | 'reset';
const RESEND_COOLDOWN_SECONDS = 60;

export default function ForgotPassword() {
  useLanguage();
  const colors = useThemeColors();

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

  const form = useAccountFormStyles();


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
    <Screen form style={form.container} edges={['left', 'right', 'bottom']}>
      {step === 'email' ? (
        <>
          <FormIntro icon="lock-open-outline" text={t('auth.forgotPassword.intro')} />
          <FormError message={error} />
          {info ? <Text style={form.info}>{info}</Text> : null}
          <View style={form.field}>
            <Text style={form.label}>{t('auth.login.emailPlaceholder')}</Text>
            <TextInput
              style={form.input}
              placeholder={t('auth.login.emailExample')}
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </View>
          {loading ? (
            <ActivityIndicator color={colors.teal} />
          ) : (
            <Button title={t('auth.sendCodeButton')} onPress={handleRequestCode} />
          )}
        </>
      ) : (
        <>
          <FormIntro icon="mail-unread-outline" text={t('auth.forgotPassword.reset.helper', { email })} />
          <FormError message={error} />
          {info ? <Text style={form.info}>{info}</Text> : null}
          <View style={form.field}>
            <Text style={form.label}>{t('auth.forgotPassword.reset.code')}</Text>
            <CodeInput value={code} onChange={setCode} autoFocus />
          </View>
          <View style={form.field}>
            <Text style={form.label}>{t('auth.forgotPassword.reset.newPassword')}</Text>
            <TextInput
              style={form.input}
              placeholder="••••••••"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />
          </View>
          <View style={form.field}>
            <Text style={form.label}>{t('auth.forgotPassword.reset.confirmPassword')}</Text>
            <TextInput
              style={form.input}
              placeholder="••••••••"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              value={confirmNewPassword}
              onChangeText={setConfirmNewPassword}
            />
          </View>
          {loading ? (
            <ActivityIndicator color={colors.teal} />
          ) : (
            <Button title={t('auth.forgotPassword.reset.button')} onPress={handleConfirmReset} />
          )}
          <Text style={[form.link, cooldown > 0 && form.linkDisabled]} onPress={handleResendCode}>
            {cooldown > 0 ? t('auth.resendCodeCooldown', { seconds: String(cooldown) }) : t('auth.resendCode')}
          </Text>
        </>
      )}
    </Screen>
  );
}
