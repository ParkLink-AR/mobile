import { t, useLanguage } from '@/src/i18n';
import { useEffect, useState } from 'react';
import { Text, TextInput, Image, StyleSheet, ActivityIndicator, InteractionManager, View, Modal, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useSessionStore } from '@/src/store/useSessionStore';
import { useAccountTypeStore, tabRouteFor } from '@/src/store/useAccountTypeStore';
import { login, reactivateAccount } from '@/src/api/auth';
import { ApiError } from '@/src/api/client';
import { useScale } from '@/src/theme/typography';
import { formatLongDateFromISO } from '@/src/services/bookingDates';
import { FormError, useAccountFormStyles } from '@/src/components/AccountForm';

export default function Login() {
  useLanguage();
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const { email: prefilledEmail, accountDeletionDate, accountNotice } = useLocalSearchParams<{
    email?: string;
    accountDeletionDate?: string;
    // Why the previous session was ended (e.g. the account got suspended), see app/_layout.tsx.
    accountNotice?: string;
  }>();
  const [email, setEmail] = useState(prefilledEmail ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Set when the account's deletion is scheduled: the "reactivate it?" prompt, with the
  // date it'll be deleted on.
  const [reactivatePrompt, setReactivatePrompt] = useState<string | null>(null);
  const [reactivating, setReactivating] = useState(false);
  const setSession = useSessionStore((s) => s.setSession);
  const clearSession = useSessionStore((s) => s.clearSession);

  // Arriving here right after the user asked to delete their account: the server already
  // closed every session, so drop the local one too -- once the screens of the previous
  // session have finished unmounting, since they assume a logged-in user.
  // Same when the session was ended because the account got suspended or is closing.
  useEffect(() => {
    if (!accountDeletionDate && !accountNotice) return;
    const task = InteractionManager.runAfterInteractions(() => clearSession());
    return () => task.cancel();
  }, [accountDeletionDate, accountNotice, clearSession]);

  const form = useAccountFormStyles();
  const styles = StyleSheet.create({
    container: { ...form.container, paddingTop: sc(40) },
    logo: { width: sc(170), height: sc(120), alignSelf: 'center' },
    heading: { gap: 4, marginBottom: 4 },
    title: { fontSize: sc(24), fontWeight: '800', color: colors.text },
    subtitle: { fontSize: sc(15), color: colors.textSecondary, lineHeight: sc(21) },
    forgotRow: { alignItems: 'flex-end', marginTop: -4 },
    forgot: { fontSize: sc(13), color: colors.teal, fontWeight: '600' },
    footer: { flexDirection: 'row', justifyContent: 'center', gap: 4, marginTop: 8 },
    footerText: { fontSize: sc(14), color: colors.textSecondary },
    notice: { backgroundColor: '#FFF6E0', borderColor: '#F5E2AD', borderWidth: 1, borderRadius: 12, padding: 14, gap: 4 },
    noticeTitle: { fontSize: sc(14), fontWeight: '700', color: '#9A6B00' },
    noticeBody: { fontSize: sc(13), color: '#9A6B00', lineHeight: sc(18) },
    noticeBlocked: { backgroundColor: '#FDECEA', borderColor: '#F5C2C0' },
    noticeBlockedText: { color: '#B42318' },
    overlay: { flex: 1, backgroundColor: 'rgba(4, 35, 71, 0.45)', justifyContent: 'center', padding: 24 },
    sheet: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, gap: 12 },
    sheetTitle: { fontSize: sc(17), fontWeight: '700', color: colors.text, textAlign: 'center' },
    sheetBody: { fontSize: sc(14), color: colors.textSecondary, textAlign: 'center', lineHeight: sc(20) },
    secondaryBtn: { paddingVertical: sc(12), alignItems: 'center', borderRadius: 10, borderWidth: 1.5, borderColor: colors.border },
    secondaryBtnText: { fontSize: sc(15), fontWeight: '600', color: colors.textSecondary },
  });

  async function handleLogin() {
    setError(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError(t('auth.login.error.required'));
      return;
    }

    setLoading(true);
    try {
      enter(await login({ email: normalizedEmail, password }));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ACCOUNT_DELETION_SCHEDULED') {
        // The user asked to delete this account and it's still within the grace period:
        // no session unless they choose to reactivate it.
        setReactivatePrompt(String(err.data.deletion_scheduled_at ?? ''));
        return;
      }
      if (err instanceof ApiError && err.status === 403 && !err.code) {
        // Not verified yet -- send them to enter the code instead of just
        // showing an error they can't do anything about.
        router.push({ pathname: '/(auth)/verify-code', params: { email: normalizedEmail } });
        return;
      }
      // Suspended (with the support email), being deleted, wrong credentials...
      setError(err instanceof ApiError ? err.detail : t('auth.login.error.generic'));
    } finally {
      setLoading(false);
    }
  }

  function enter({ user, tokens }: Awaited<ReturnType<typeof login>>) {
    setSession(user, tokens);
    const { activeMode } = useAccountTypeStore.getState();
    router.replace(tabRouteFor(activeMode) as never);
  }

  async function reactivate() {
    setReactivating(true);
    setError(null);
    try {
      const session = await reactivateAccount({ email: email.trim().toLowerCase(), password });
      setReactivatePrompt(null);
      enter(session);
    } catch (err) {
      setReactivatePrompt(null);
      setError(err instanceof ApiError ? err.detail : t('auth.login.error.generic'));
    } finally {
      setReactivating(false);
    }
  }

  // "No": they stay out -- there's no session to close, the account keeps its date.
  function declineReactivation() {
    setReactivatePrompt(null);
    setPassword('');
  }

  return (
    <Screen form style={styles.container}>
      <Image
        source={require('@/assets/logo-parklink.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <View style={styles.heading}>
        <Text style={styles.title}>{t('auth.login.title')}</Text>
        <Text style={styles.subtitle}>{t('auth.login.subtitle')}</Text>
      </View>
      {accountDeletionDate ? (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>
            {t('account.deletion.successTitle', { date: formatLongDateFromISO(accountDeletionDate) })}
          </Text>
          <Text style={styles.noticeBody}>{t('account.deletion.successMessage')}</Text>
        </View>
      ) : null}
      {accountNotice ? (
        <View style={[styles.notice, styles.noticeBlocked]}>
          <Text style={[styles.noticeTitle, styles.noticeBlockedText]}>{t('auth.login.sessionEnded')}</Text>
          <Text style={[styles.noticeBody, styles.noticeBlockedText]}>{accountNotice}</Text>
        </View>
      ) : null}
      <FormError message={error} />
      <View style={form.field}>
        <Text style={form.label}>{t('auth.login.emailPlaceholder')}</Text>
        <TextInput
          style={form.input}
          placeholder={t('auth.login.emailExample')}
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
      </View>
      <View style={form.field}>
        <Text style={form.label}>{t('auth.login.placeholder.password')}</Text>
        <TextInput
          style={form.input}
          placeholder="••••••••"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          autoComplete="password"
          value={password}
          onChangeText={setPassword}
        />
      </View>
      <View style={styles.forgotRow}>
        <Text style={styles.forgot} onPress={() => router.push('/(auth)/forgot-password')}>
          {t('auth.login.forgot')}
        </Text>
      </View>
      {loading ? (
        <ActivityIndicator color={colors.teal} />
      ) : (
        <Button title={t('auth.login.button')} onPress={handleLogin} />
      )}
      <View style={styles.footer}>
        <Text style={styles.footerText}>{t('auth.login.noAccountQuestion')}</Text>
        <Text style={form.link} onPress={() => router.push('/(auth)/register')}>
          {t('auth.login.register')}
        </Text>
      </View>
      <Modal visible={reactivatePrompt !== null} transparent animationType="fade" onRequestClose={declineReactivation}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t('account.reactivate.title')}</Text>
            <Text style={styles.sheetBody}>
              {reactivatePrompt
                ? t('account.reactivate.body', { date: formatLongDateFromISO(reactivatePrompt) })
                : t('account.reactivate.bodyNoDate')}
            </Text>
            <Button title={t('account.reactivate.confirm')} onPress={reactivate} disabled={reactivating} />
            {reactivating ? <ActivityIndicator color={colors.teal} /> : null}
            <Pressable
              style={({ pressed }) => [styles.secondaryBtn, { opacity: pressed ? 0.7 : 1 }]}
              onPress={declineReactivation}
              disabled={reactivating}
            >
              <Text style={styles.secondaryBtnText}>{t('account.reactivate.decline')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
