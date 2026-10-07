import { t, useLanguage } from '@/src/i18n';
import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/Screen';
import { Card } from '@/src/components/Card';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useScale } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { getAccountDeletionSummary, requestAccountDeletion } from '@/src/api/auth';
import { ApiError } from '@/src/api/client';
import { formatFullDateFromISO } from '@/src/services/bookingDates';
import { AccountDeletionSummary } from '@/src/types';

const DANGER = '#C62828';

/**
 * "Eliminar cuenta", from Editar perfil. Shows what deleting the account would do (it's
 * scheduled 7 days ahead, upcoming bookings are cancelled and refunded, money still owed
 * is paid first) and asks for the password. A booking in progress blocks it.
 */
export default function AccountDeletion() {
  useLanguage();
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const user = useSessionStore((s) => s.user);
  const [summary, setSummary] = useState<AccountDeletionSummary | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;
    getAccountDeletionSummary(user.id)
      .then(setSummary)
      .catch(() => setLoadError(true));
  }, [user]);

  async function confirm() {
    if (!user || !summary) return;
    if (!password.trim()) {
      setError(t('account.deletion.passwordRequired'));
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      const updated = await requestAccountDeletion(user.id, password);
      // The server already closed every session: log out right away. The login screen
      // shows when the account will be deleted, and clears the local session once this
      // stack has finished unmounting (screens below assume a logged-in user).
      router.replace({
        pathname: '/(auth)/login',
        params: { accountDeletionDate: updated.deletionScheduledAt ?? summary.deletionDate },
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : t('account.deletion.error'));
      setDeleting(false);
    }
  }

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 16, gap: 14 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
    heading: { fontSize: sc(13), fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
    item: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
    itemText: { flex: 1, fontSize: sc(14), color: colors.text, lineHeight: sc(20) },
    list: { gap: 12 },
    blockedText: { fontSize: sc(14), color: colors.text, lineHeight: sc(20), textAlign: 'center' },
    blockedTitle: { fontSize: sc(17), fontWeight: '700', color: colors.text, textAlign: 'center' },
    label: { fontSize: sc(14), fontWeight: '600', color: colors.text },
    input: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: sc(12),
      fontSize: sc(15), color: colors.text, backgroundColor: colors.surface,
    },
    error: { color: DANGER, fontSize: sc(13) },
    dangerBtn: { borderRadius: 12, paddingVertical: sc(14), alignItems: 'center', backgroundColor: DANGER },
    dangerBtnDisabled: { opacity: 0.6 },
    btnText: { fontSize: sc(15), fontWeight: '700', color: colors.white },
    secondaryText: { fontSize: sc(14), color: colors.textSecondary, textAlign: 'center', lineHeight: sc(20) },
  });

  if (loadError) {
    return (
      <Screen style={styles.centered} edges={['left', 'right', 'bottom']}>
        <Ionicons name="cloud-offline-outline" size={sc(40)} color={colors.textSecondary} />
        <Text style={styles.secondaryText}>{t('account.deletion.loadError')}</Text>
      </Screen>
    );
  }

  if (!summary) {
    return (
      <Screen style={styles.centered} edges={['left', 'right', 'bottom']}>
        <ActivityIndicator color={colors.teal} />
      </Screen>
    );
  }

  if (summary.blocked) {
    return (
      <Screen style={styles.centered} edges={['left', 'right', 'bottom']}>
        <Ionicons name="car-outline" size={sc(44)} color={colors.textSecondary} />
        <Text style={styles.blockedTitle}>{t('account.deletion.blockedTitle')}</Text>
        <Text style={styles.blockedText}>{summary.blockedReason}</Text>
      </Screen>
    );
  }

  const ownerCount = summary.ownerBookingsToCancel + summary.ownerRequestsToReject;
  const items: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }[] = [
    { icon: 'calendar-outline', text: t('account.deletion.when', { date: formatFullDateFromISO(summary.deletionDate) }) },
    { icon: 'log-out-outline', text: t('account.deletion.sessions') },
  ];
  if (summary.spotCount > 0) items.push({ icon: 'eye-off-outline', text: t('account.deletion.spots') });
  if (summary.driverBookingsToCancel > 0) {
    items.push({ icon: 'close-circle-outline', text: t('account.deletion.driverBookings', { count: summary.driverBookingsToCancel }) });
  }
  if (ownerCount > 0) items.push({ icon: 'close-circle-outline', text: t('account.deletion.ownerBookings', { count: ownerCount }) });
  if (summary.pendingPayoutCount > 0) {
    items.push({
      icon: 'cash-outline',
      text: t('account.deletion.payouts', {
        amount: summary.pendingPayoutAmount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      }),
    });
  }
  items.push({ icon: 'trash-outline', text: t('account.deletion.data') });

  return (
    <Screen form style={styles.container} edges={['left', 'right', 'bottom']}>
      <Text style={styles.heading}>{t('account.deletion.whatHappens')}</Text>
      <Card>
        <View style={styles.list}>
          {items.map((item) => (
            <View key={item.text} style={styles.item}>
              <Ionicons name={item.icon} size={sc(18)} color={colors.textSecondary} />
              <Text style={styles.itemText}>{item.text}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Text style={styles.label}>{t('account.deletion.passwordLabel')}</Text>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder={t('account.deletion.passwordPlaceholder')}
        placeholderTextColor={colors.textSecondary}
        secureTextEntry
        editable={!deleting}
      />
      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={({ pressed }) => [styles.dangerBtn, deleting && styles.dangerBtnDisabled, { opacity: pressed && !deleting ? 0.85 : 1 }]}
        onPress={confirm}
        disabled={deleting}
      >
        {deleting ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.btnText}>{t('account.deletion.confirm')}</Text>}
      </Pressable>
    </Screen>
  );
}
