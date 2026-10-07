import { t, useLanguage } from '@/src/i18n';
import { useState } from 'react';
import { Text, TextInput, StyleSheet, ActivityIndicator, View } from 'react-native';
import { router, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography, useScale } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { verifyCurrentPassword, changePassword } from '@/src/api/auth';
import { ApiError } from '@/src/api/client';
import { FormError, FormIntro, useAccountFormStyles } from '@/src/components/AccountForm';

export default function ChangePasswordScreen() {
  useLanguage();
  const group = `/${useSegments()[0]}`;
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const typography = useTypography();
  const user = useSessionStore((s) => s.user)!;

  const [step, setStep] = useState<'current' | 'new' | 'success'>('current');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useAccountFormStyles();
  const styles = StyleSheet.create({
    success: { ...form.container, alignItems: 'center', paddingTop: sc(56) },
    successMessage: { fontSize: sc(15), color: colors.textSecondary, textAlign: 'center', lineHeight: sc(21) },
    successButton: { alignSelf: 'stretch', marginTop: 8 },
  });


  function handleBackFromSuccess() {
    // A full page reload mid-flow (or opening this screen directly, e.g. on
    // web) can leave expo-router with no history entry to pop -- router.back()
    // would then silently no-op instead of navigating anywhere.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(`${group}/profile-edit`);
    }
  }

  async function handleVerifyCurrent() {
    if (loading) return; // guards against a double-tap firing two requests
    setError(null);
    if (!currentPassword) {
      setError(t('changePassword.current.required'));
      return;
    }
    setLoading(true);
    try {
      await verifyCurrentPassword(user.id, currentPassword);
      setStep('new');
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : t('changePassword.error.verify'));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitNew() {
    if (loading) return; // guards against a double-tap firing two requests
    setError(null);
    if (newPassword !== confirmNewPassword) {
      setError(t('changePassword.new.passwordMismatch'));
      return;
    }
    setLoading(true);
    try {
      await changePassword(user.id, currentPassword, newPassword);
      setStep('success');
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : t('changePassword.error.submit'));
    } finally {
      setLoading(false);
    }
  }

  if (step === 'success') {
    return (
      <Screen style={styles.success} edges={['left', 'right', 'bottom']}>
        <Ionicons name="checkmark-circle" size={sc(56)} color={colors.teal} />
        <Text style={typography.h1}>{t('changePassword.success.title')}</Text>
        <Text style={styles.successMessage}>{t('changePassword.success.message')}</Text>
        <Button title={t('common.continue')} onPress={handleBackFromSuccess} style={styles.successButton} />
      </Screen>
    );
  }

  if (step === 'new') {
    return (
      <Screen form style={form.container} edges={['left', 'right', 'bottom']}>
        <FormIntro icon="key-outline" text={t('changePassword.new.hint')} />
        <FormError message={error} />
        <View style={form.field}>
          <Text style={form.label}>{t('changePassword.new.newPassword')}</Text>
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
          <Text style={form.label}>{t('changePassword.new.confirmPassword')}</Text>
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
          <Button title={t('changePassword.new.button')} onPress={handleSubmitNew} />
        )}
      </Screen>
    );
  }

  return (
    <Screen form style={form.container} edges={['left', 'right', 'bottom']}>
      <FormIntro icon="lock-closed-outline" text={t('changePassword.current.hint')} />
      <FormError message={error} />
      <View style={form.field}>
        <Text style={form.label}>{t('changePassword.current.placeholder')}</Text>
        <TextInput
          style={form.input}
          placeholder="••••••••"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          value={currentPassword}
          onChangeText={setCurrentPassword}
        />
      </View>
      {loading ? (
        <ActivityIndicator color={colors.teal} />
      ) : (
        <Button title={t('changePassword.current.button')} onPress={handleVerifyCurrent} />
      )}
    </Screen>
  );
}
