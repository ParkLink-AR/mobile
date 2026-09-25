import { t, useLanguage } from '@/src/i18n';
import { useCallback, useState } from 'react';
import { Text, TextInput, StyleSheet, ActivityIndicator, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { getPayoutInfo, updatePayoutInfo } from '@/src/api/auth';
import { ApiError } from '@/src/api/client';

function onlyDigits(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

export default function PayoutInfoScreen() {
  useLanguage();
  const colors = useThemeColors();
  const typography = useTypography();
  const user = useSessionStore((s) => s.user)!;

  const [cbu, setCbu] = useState('');
  const [titular, setTitular] = useState('');
  const [cuil, setCuil] = useState('');
  const [hasPayoutInfo, setHasPayoutInfo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getPayoutInfo(user.id)
        .then((info) => {
          if (cancelled) return;
          setCbu(info.cbu ?? '');
          setTitular(info.titular ?? '');
          setCuil(info.cuil ?? '');
          setHasPayoutInfo(info.hasPayoutInfo);
        })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, [user.id])
  );

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 20, gap: 14 },
    loadingContainer: { flex: 1, backgroundColor: colors.background, justifyContent: 'center' },
    helper: { fontSize: 13.5, color: colors.textSecondary, lineHeight: 19 },
    banner: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: colors.teal + '18', borderRadius: 10, padding: 12, marginBottom: 4,
    },
    bannerText: { flex: 1, fontSize: 13, color: colors.teal, fontWeight: '600' },
    label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 15,
      color: colors.text,
    },
    error: { color: '#C62828', fontSize: 13 },
  });

  if (loading) {
    return (
      <Screen style={styles.loadingContainer} edges={['left', 'right', 'bottom']}>
        <ActivityIndicator color={colors.teal} />
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
    <Screen style={styles.container} edges={['left', 'right', 'bottom']}>
      <Text style={typography.h1}>{t('owner.payoutInfo.title')}</Text>
      <Text style={styles.helper}>{t('owner.payoutInfo.helper')}</Text>

      {!hasPayoutInfo && (
        <View style={styles.banner}>
          <Ionicons name="information-circle" size={18} color={colors.teal} />
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
