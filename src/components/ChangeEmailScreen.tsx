import { t, useLanguage } from '@/src/i18n';
import { useEffect, useState } from 'react';
import { Text, TextInput, ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useSessionStore } from '@/src/store/useSessionStore';
import { requestEmailChange, confirmEmailChange } from '@/src/api/auth';
import { ApiError } from '@/src/api/client';
import { CodeInput, CurrentValue, FormError, FormIntro, useAccountFormStyles } from '@/src/components/AccountForm';

const RESEND_COOLDOWN_SECONDS = 60;

export default function ChangeEmailScreen() {
  useLanguage();
  const colors = useThemeColors();
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

  const form = useAccountFormStyles();


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
      <Screen form style={form.container} edges={['left', 'right', 'bottom']}>
        <FormIntro
          icon="mail-unread-outline"
          title={t('changeEmail.code.title')}
          text={t('changeEmail.code.helper', { email: newEmail })}
        />
        <FormError message={error} />
        <CodeInput value={code} onChange={setCode} autoFocus />
        {loading ? (
          <ActivityIndicator color={colors.teal} />
        ) : (
          <Button title={t('changeEmail.code.button')} onPress={handleConfirm} />
        )}
        <Text style={[form.link, cooldown > 0 && form.linkDisabled]} onPress={handleResend}>
          {cooldown > 0 ? t('auth.resendCodeCooldown', { seconds: String(cooldown) }) : t('auth.resendCode')}
        </Text>
      </Screen>
    );
  }

  return (
    <Screen form style={form.container} edges={['left', 'right', 'bottom']}>
      <CurrentValue icon="mail-outline" label={t('changeEmail.current')} value={user.email} />
      <FormError message={error} />
      <View style={form.field}>
        <Text style={form.label}>{t('changeEmail.newEmail.label')}</Text>
        <TextInput
          style={form.input}
          placeholder={t('changeEmail.newEmail.placeholder')}
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          keyboardType="email-address"
          value={newEmail}
          onChangeText={setNewEmail}
        />
        <Text style={form.helper}>{t('changeEmail.newEmail.helper')}</Text>
      </View>
      {loading ? (
        <ActivityIndicator color={colors.teal} />
      ) : (
        <Button title={t('changeEmail.newEmail.button')} onPress={handleSendCode} />
      )}
    </Screen>
  );
}
