import { t, useLanguage } from '@/src/i18n';
import { useState } from 'react';
import {
  Text,
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/Screen';
import { Button } from '@/src/components/Button';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { useAccountTypeStore } from '@/src/store/useAccountTypeStore';
import { updateAccountType } from '@/src/api/auth';
import { ApiError } from '@/src/api/client';
import { AccountType } from '@/src/types';

interface AccountOption {
  type: AccountType;
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: string;
  descKey: string;
}

const OPTIONS: AccountOption[] = [
  {
    type: 'driver',
    icon: 'car-outline',
    titleKey: 'accountType.driver.title',
    descKey: 'accountType.driver.description',
  },
  {
    type: 'owner',
    icon: 'home-outline',
    titleKey: 'accountType.owner.title',
    descKey: 'accountType.owner.description',
  },
  {
    type: 'both',
    icon: 'swap-horizontal-outline',
    titleKey: 'accountType.both.title',
    descKey: 'accountType.both.description',
  },
];

function tabRouteFor(type: AccountType): string {
  if (type === 'owner') return '/(owner)/(tabs)';
  if (type === 'both') return '/(both)/(tabs)';
  return '/(driver)/(tabs)';
}

export default function AccountTypeScreen() {
  useLanguage();
  const colors = useThemeColors();
  const typography = useTypography();

  const user = useSessionStore((s) => s.user);
  const setUser = useSessionStore((s) => s.setUser);
  const setAccountType = useAccountTypeStore((s) => s.setAccountType);

  const [selected, setSelected] = useState<AccountType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    if (!selected || !user) return;
    setError(null);
    setLoading(true);
    try {
      const updatedUser = await updateAccountType(user.id, selected);
      setUser(updatedUser); // syncs useAccountTypeStore via setUser
      setAccountType(selected);
      router.replace(tabRouteFor(selected) as never);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'No se pudo guardar la selección. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 24,
      gap: 16,
      justifyContent: 'center',
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 8,
    },
    card: {
      borderRadius: 16,
      borderWidth: 2,
      padding: 20,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    cardUnselected: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    cardSelected: {
      backgroundColor: colors.teal + '12',
      borderColor: colors.teal,
    },
    iconWrap: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconWrapUnselected: {
      backgroundColor: colors.background,
    },
    iconWrapSelected: {
      backgroundColor: colors.teal + '22',
    },
    cardText: { flex: 1, gap: 2 },
    cardTitle: { fontSize: 16, fontWeight: '700' },
    cardTitleUnselected: { color: colors.text },
    cardTitleSelected: { color: colors.teal },
    cardDesc: { fontSize: 13, lineHeight: 18 },
    cardDescUnselected: { color: colors.textSecondary },
    cardDescSelected: { color: colors.teal + 'CC' },
    checkWrap: { width: 24, alignItems: 'center' },
    errorText: { color: '#C62828', fontSize: 13, textAlign: 'center' },
    btnWrap: { marginTop: 8 },
  });

  return (
    <Screen style={styles.container} edges={['left', 'right', 'bottom', 'top']}>
      <Text style={[typography.h1, { textAlign: 'center' }]}>{t('accountType.title')}</Text>
      <Text style={styles.subtitle}>{t('accountType.subtitle')}</Text>

      {OPTIONS.map((opt) => {
        const isSelected = selected === opt.type;
        return (
          <Pressable
            key={opt.type}
            style={({ pressed }) => [
              styles.card,
              isSelected ? styles.cardSelected : styles.cardUnselected,
              { opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={() => setSelected(opt.type)}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
            accessibilityLabel={t(opt.titleKey as any)}
            accessibilityHint={t(opt.descKey as any)}
          >
            <View style={[styles.iconWrap, isSelected ? styles.iconWrapSelected : styles.iconWrapUnselected]}>
              <Ionicons
                name={opt.icon}
                size={26}
                color={isSelected ? colors.teal : colors.textSecondary}
              />
            </View>
            <View style={styles.cardText}>
              <Text style={[styles.cardTitle, isSelected ? styles.cardTitleSelected : styles.cardTitleUnselected]}>
                {t(opt.titleKey as any)}
              </Text>
              <Text style={[styles.cardDesc, isSelected ? styles.cardDescSelected : styles.cardDescUnselected]}>
                {t(opt.descKey as any)}
              </Text>
            </View>
            <View style={styles.checkWrap}>
              {isSelected && (
                <Ionicons name="checkmark-circle" size={22} color={colors.teal} />
              )}
            </View>
          </Pressable>
        );
      })}

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.btnWrap}>
        {loading ? (
          <ActivityIndicator color={colors.teal} />
        ) : (
          <Button
            title={t('accountType.continue')}
            onPress={handleContinue}
            disabled={!selected}
          />
        )}
      </View>
    </Screen>
  );
}
