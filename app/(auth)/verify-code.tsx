import { t, useLanguage } from '@/src/i18n';
import { useEffect, useState } from 'react';
import { Text, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { confirmEmailCode, resendVerificationCode } from '@/src/api/auth';
import { ApiError } from '@/src/api/client';
import { CodeInput, FormError, FormIntro, useAccountFormStyles } from '@/src/components/AccountForm';

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyCode() {
  useLanguage();
  const colors = useThemeColors();
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

  const form = useAccountFormStyles();


  async function handleConfirm() {
    if (!email) return;
    setError(null);
    setInfo(null);
    if (code.length !== 6) {
      setError(t('auth.error.codeLength'));
      return;
    }

    setLoading(true);
    try {
      await confirmEmailCode(email, code);
      router.replace({ pathname: '/(auth)/login', params: { email } });
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : t('auth.error.confirmCode'));
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
      setInfo(t('auth.resendSuccess'));
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : t('auth.error.resendCode'));
    } finally {
      setResending(false);
    }
  }

  return (
    <Screen form style={form.container} edges={['left', 'right', 'bottom']}>
      <FormIntro
        icon="mail-unread-outline"
        title={t('auth.verifyCode.title')}
        text={t('auth.verifyCode.helper', { email })}
      />
      <FormError message={error} />
      {info ? <Text style={form.info}>{info}</Text> : null}
      <CodeInput value={code} onChange={setCode} autoFocus />
      {loading ? (
        <ActivityIndicator color={colors.teal} />
      ) : (
        <Button title={t('common.confirm')} onPress={handleConfirm} />
      )}
      <Text style={[form.link, (cooldown > 0 || resending) && form.linkDisabled]} onPress={handleResend}>
        {cooldown > 0 ? t('auth.resendCodeCooldown', { seconds: String(cooldown) }) : t('auth.resendCode')}
      </Text>
    </Screen>
  );
}
