import { t, useLanguage } from '@/src/i18n';
import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  TouchableWithoutFeedback,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useSessionStore } from '@/src/store/useSessionStore';
import { useAccountTypeStore } from '@/src/store/useAccountTypeStore';
import { updateAccountType } from '@/src/api/auth';
import { ApiError } from '@/src/api/client';
import { AccountType } from '@/src/types';

interface Option {
  type: AccountType;
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: string;
  descKey: string;
}

const OPTIONS: Option[] = [
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

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function AccountTypePicker({ visible, onClose }: Props) {
  useLanguage();
  const colors = useThemeColors();
  const user = useSessionStore((s) => s.user);
  const setUser = useSessionStore((s) => s.setUser);
  const currentType = useAccountTypeStore((s) => s.accountType);
  const setAccountType = useAccountTypeStore((s) => s.setAccountType);

  const [pending, setPending] = useState<AccountType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(type: AccountType) {
    if (type === currentType || !user) return;
    setError(null);
    setLoading(true);
    setPending(type);
    try {
      const updatedUser = await updateAccountType(user.id, type);
      setUser(updatedUser);
      setAccountType(type);
      onClose();
      router.replace(tabRouteFor(type) as never);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'No se pudo guardar el cambio.');
    } finally {
      setLoading(false);
      setPending(null);
    }
  }

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    sheet: {
      width: '88%',
      borderRadius: 20,
      paddingVertical: 28,
      paddingHorizontal: 20,
      backgroundColor: colors.surface,
      gap: 12,
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 4,
    },
    card: {
      borderRadius: 14,
      borderWidth: 2,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    cardCurrent: {
      backgroundColor: colors.teal + '12',
      borderColor: colors.teal,
    },
    cardDefault: {
      backgroundColor: colors.background,
      borderColor: colors.border,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconWrapCurrent: { backgroundColor: colors.teal + '22' },
    iconWrapDefault: { backgroundColor: colors.surface },
    cardText: { flex: 1, gap: 2 },
    cardTitle: { fontSize: 15, fontWeight: '700' },
    cardTitleCurrent: { color: colors.teal },
    cardTitleDefault: { color: colors.text },
    cardDesc: { fontSize: 12, lineHeight: 16 },
    cardDescCurrent: { color: colors.teal + 'BB' },
    cardDescDefault: { color: colors.textSecondary },
    checkCol: { width: 22, alignItems: 'center' },
    errorText: { color: '#C62828', fontSize: 13, textAlign: 'center' },
    cancelBtn: {
      marginTop: 4,
      paddingVertical: 10,
      alignItems: 'center',
    },
    cancelBtnText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheet}>
              <Text style={styles.title}>{t('accountType.change')}</Text>

              {OPTIONS.map((opt) => {
                const isCurrent = currentType === opt.type;
                const isLoading = loading && pending === opt.type;
                return (
                  <Pressable
                    key={opt.type}
                    style={({ pressed }) => [
                      styles.card,
                      isCurrent ? styles.cardCurrent : styles.cardDefault,
                      { opacity: pressed && !loading ? 0.8 : 1 },
                    ]}
                    onPress={() => handleSelect(opt.type)}
                    disabled={loading}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isCurrent }}
                    accessibilityLabel={t(opt.titleKey as any)}
                  >
                    <View style={[styles.iconWrap, isCurrent ? styles.iconWrapCurrent : styles.iconWrapDefault]}>
                      <Ionicons
                        name={opt.icon}
                        size={22}
                        color={isCurrent ? colors.teal : colors.textSecondary}
                      />
                    </View>
                    <View style={styles.cardText}>
                      <Text style={[styles.cardTitle, isCurrent ? styles.cardTitleCurrent : styles.cardTitleDefault]}>
                        {t(opt.titleKey as any)}
                      </Text>
                      <Text style={[styles.cardDesc, isCurrent ? styles.cardDescCurrent : styles.cardDescDefault]}>
                        {t(opt.descKey as any)}
                      </Text>
                    </View>
                    <View style={styles.checkCol}>
                      {isLoading ? (
                        <ActivityIndicator size="small" color={colors.teal} />
                      ) : isCurrent ? (
                        <Ionicons name="checkmark-circle" size={20} color={colors.teal} />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}

              {error && <Text style={styles.errorText}>{error}</Text>}

              <Pressable
                style={({ pressed }) => [styles.cancelBtn, { opacity: pressed ? 0.6 : 1 }]}
                onPress={onClose}
              >
                <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
              </Pressable>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
