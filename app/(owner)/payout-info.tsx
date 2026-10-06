import { t, useLanguage } from '@/src/i18n';
import { useCallback, useState } from 'react';
import { Text, TextInput, StyleSheet, ActivityIndicator, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography, useScale } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { getPayoutInfo, updatePayoutInfo } from '@/src/api/auth';
import { ApiError } from '@/src/api/client';

function onlyDigits(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

/** A CBU's two check digits (BCRA's algorithm, same as auth-service's validator): the 8th
 * covers the bank+branch block, the 22nd the account block. Catches a mistyped digit. */
function cbuCheckDigitsOk(cbu: string): boolean {
  const digits = cbu.split('').map(Number);
  const weighted = (slice: number[], weights: number[]) =>
    slice.reduce((sum, digit, index) => sum + digit * weights[index], 0);
  const bankSum = weighted(digits.slice(0, 7), [7, 1, 3, 9, 7, 1, 3]);
  const accountSum = weighted(digits.slice(8, 21), [3, 9, 7, 1, 3, 9, 7, 1, 3, 9, 7, 1, 3]);
  return (10 - (bankSum % 10)) % 10 === digits[7] && (10 - (accountSum % 10)) % 10 === digits[21];
}

export default function PayoutInfoScreen() {
  useLanguage();
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const typography = useTypography();
  const user = useSessionStore((s) => s.user)!;

  const [cbu, setCbu] = useState('');
  const [titular, setTitular] = useState('');
  const [cuil, setCuil] = useState('');
  const [hasPayoutInfo, setHasPayoutInfo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A failed load must not show an empty form -- the owner would think nothing is on file.
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      setLoadFailed(false);
      getPayoutInfo(user.id)
        .then((info) => {
          if (cancelled) return;
          setCbu(info.cbu ?? '');
          setTitular(info.titular ?? '');
          setCuil(info.cuil ?? '');
          setHasPayoutInfo(info.hasPayoutInfo);
        })
        .catch(() => { if (!cancelled) setLoadFailed(true); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, [user.id, reloadKey])
  );

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 20, gap: 14 },
    loadingContainer: { flex: 1, backgroundColor: colors.background, justifyContent: 'center' },
    failedContainer: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 40 },
    helper: { fontSize: sc(13.5), color: colors.textSecondary, lineHeight: sc(19) },
    banner: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: colors.teal + '18', borderRadius: 10, padding: 12, marginBottom: 4,
    },
    bannerText: { flex: 1, fontSize: sc(13), color: colors.teal, fontWeight: '600' },
    label: { fontSize: sc(13), fontWeight: '600', color: colors.textSecondary, marginBottom: 4 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: sc(15),
      color: colors.text,
    },
    error: { color: '#C62828', fontSize: sc(13) },
  });

  if (loading) {
    return (
      <Screen style={styles.loadingContainer} edges={['left', 'right', 'bottom']}>
        <ActivityIndicator color={colors.teal} />
      </Screen>
    );
  }

  if (loadFailed) {
    return (
      <Screen style={styles.failedContainer} edges={['left', 'right', 'bottom']}>
        <Ionicons name="cloud-offline-outline" size={40} color={colors.textSecondary} />
        <Text style={styles.helper}>{t('common.loadError')}</Text>
        <Button title={t('common.retry')} onPress={() => setReloadKey((key) => key + 1)} />
      </Screen>
    );
  }

  async function handleSave() {
    setError(null);
    const normalizedCbu = onlyDigits(cbu);
    const normalizedCuil = onlyDigits(cuil);
    if (normalizedCbu.length !== 22) {
      setError(t('owner.payoutInfo.error.cbu'));
      return;
    }
    if (!cbuCheckDigitsOk(normalizedCbu)) {
      setError(t('owner.payoutInfo.error.cbuCheckDigit'));
      return;
    }
    if (normalizedCuil.length !== 11) {
      setError(t('owner.payoutInfo.error.cuil'));
      return;
    }
    if (!titular.trim()) {
      setError(t('owner.payoutInfo.error.titular'));
      return;
    }

    setSaving(true);
    try {
      await updatePayoutInfo(user.id, {
        cbu: normalizedCbu,
        titular: titular.trim(),
        cuil: normalizedCuil,
      });
      router.back();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : t('owner.payoutInfo.error.generic'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen form style={styles.container} edges={['left', 'right', 'bottom']}>
      <Text style={typography.h1}>{t('owner.payoutInfo.title')}</Text>
      <Text style={styles.helper}>{t('owner.payoutInfo.helper')}</Text>

      {!hasPayoutInfo && (
        <View style={styles.banner}>
          <Ionicons name="information-circle" size={sc(18)} color={colors.teal} />
          <Text style={styles.bannerText}>{t('owner.payoutInfo.requiredBanner')}</Text>
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View>
        <Text style={styles.label}>{t('owner.payoutInfo.cbu')}</Text>
        <TextInput
          style={styles.input}
          placeholder="0000000000000000000000"
          placeholderTextColor={colors.textSecondary}
          keyboardType="number-pad"
          maxLength={22}
          value={cbu}
          onChangeText={(v) => setCbu(onlyDigits(v))}
        />
      </View>

      <View>
        <Text style={styles.label}>{t('owner.payoutInfo.titular')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('owner.payoutInfo.titularPlaceholder')}
          placeholderTextColor={colors.textSecondary}
          value={titular}
          onChangeText={setTitular}
        />
      </View>

      <View>
        <Text style={styles.label}>{t('owner.payoutInfo.cuil')}</Text>
        <TextInput
          style={styles.input}
          placeholder="20123456789"
          placeholderTextColor={colors.textSecondary}
          keyboardType="number-pad"
          maxLength={11}
          value={cuil}
          onChangeText={(v) => setCuil(onlyDigits(v))}
        />
      </View>

      {saving ? (
        <ActivityIndicator color={colors.teal} />
      ) : (
        <Button title={t('owner.payoutInfo.save')} onPress={handleSave} />
      )}
    </Screen>
  );
}
