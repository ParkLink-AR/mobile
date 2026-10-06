import { t, useLanguage } from '@/src/i18n';
import { useState } from 'react';
import { Text, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { router, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography, useScale } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { verifyCurrentPassword, changePassword } from '@/src/api/auth';
import { ApiError } from '@/src/api/client';

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

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface, padding: 24, gap: 12, justifyContent: 'center' },
    hint: { fontSize: sc(13), color: colors.textSecondary },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: sc(15),
      color: colors.text,
    },
    error: { color: '#C62828', fontSize: sc(13), textAlign: 'center' },
    successContainer: { flex: 1, backgroundColor: colors.surface, padding: 24, gap: 12, alignItems: 'center', justifyContent: 'center' },
    successMessage: { fontSize: sc(15), color: colors.textSecondary, textAlign: 'center' },
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
      <Screen style={styles.successContainer} edges={['left', 'right', 'bottom']}>
        <Ionicons name="checkmark-circle" size={sc(44)} color={colors.teal} />
        <Text style={typography.h1}>{t('changePassword.success.title')}</Text>
        <Text style={styles.successMessage}>{t('changePassword.success.message')}</Text>
        <Button title={t('common.continue')} onPress={handleBackFromSuccess} />
      </Screen>
    );
  }

  if (step === 'new') {
    return (
      <Screen style={styles.container} edges={['left', 'right', 'bottom']}>
        <Text style={typography.h1}>{t('changePassword.title')}</Text>
        <Text style={styles.hint}>{t('changePassword.new.hint')}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TextInput
          style={styles.input}
          placeholder={t('changePassword.new.newPassword')}
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
        />
        <TextInput
          style={styles.input}
          placeholder={t('changePassword.new.confirmPassword')}
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          value={confirmNewPassword}
          onChangeText={setConfirmNewPassword}
        />
        {loading ? (
          <ActivityIndicator color={colors.teal} />
        ) : (
          <Button title={t('changePassword.new.button')} onPress={handleSubmitNew} />
        )}
      </Screen>
    );
  }

  return (
    <Screen style={styles.container} edges={['left', 'right', 'bottom']}>
      <Text style={typography.h1}>{t('changePassword.title')}</Text>
      <Text style={styles.hint}>{t('changePassword.current.hint')}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TextInput
        style={styles.input}
        placeholder={t('changePassword.current.placeholder')}
        placeholderTextColor={colors.textSecondary}
        secureTextEntry
        value={currentPassword}
        onChangeText={setCurrentPassword}
      />
      {loading ? (
        <ActivityIndicator color={colors.teal} />
      ) : (
        <Button title={t('changePassword.current.button')} onPress={handleVerifyCurrent} />
      )}
    </Screen>
  );
}
