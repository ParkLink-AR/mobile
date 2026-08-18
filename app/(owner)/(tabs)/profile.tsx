import { t, useLanguage } from '@/src/i18n';
import { useEffect, useState } from 'react';
import { Text, View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/Screen';
import { VerifiedBadge } from '@/src/components/VerifiedBadge';
import { ParkingSpotCard } from '@/src/components/ParkingSpotCard';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { useSettingsStore, Language } from '@/src/store/useSettingsStore';
import { getParkingSpotsForOwner } from '@/src/services/parkingService';
import { ParkingSpot } from '@/src/types';

const LANGS: { key: Language; flag: string; label: string }[] = [
  { key: 'es', flag: '🇦🇷', label: 'ES' },
  { key: 'en', flag: '🇺🇸', label: 'EN' },
  { key: 'ja', flag: '🇯🇵', label: '日本語' },
];

export default function OwnerProfile() {
  useLanguage();
  const colors = useThemeColors();
  const typography = useTypography();
  const user = useSessionStore((s) => s.user);
  const logout = useSessionStore((s) => s.logout);
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const mode = useSettingsStore((s) => s.mode);
  const toggleMode = useSettingsStore((s) => s.toggleMode);
  const [mySpots, setMySpots] = useState<ParkingSpot[]>([]);

  useEffect(() => {
    if (user) getParkingSpotsForOwner(user.id).then(setMySpots);
  }, [user]);

  if (!user) return null;

  const initials = user.name
    .split(' ').slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() ?? '').join('');

  const isDark = mode === 'dark';

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { padding: 16, gap: 16 },

    profileCard: {
      backgroundColor: colors.surface, borderRadius: 16, padding: 20,
      borderWidth: 1, borderColor: colors.border,
      flexDirection: 'row', alignItems: 'center', gap: 16,
    },
    avatar: {
      width: 64, height: 64, borderRadius: 32,
      backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { color: colors.white, fontSize: 22, fontWeight: '700' },
    profileInfo: { flex: 1, gap: 4 },
    profileName: { fontSize: 18, fontWeight: '700', color: colors.text },
    profileEmail: { fontSize: 13, color: colors.textSecondary },

    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    sectionTitle: {
      fontSize: 11, fontWeight: '700', color: colors.textSecondary,
      letterSpacing: 0.8, textTransform: 'uppercase',
    },
    sectionLine: { flex: 1, height: 1, backgroundColor: colors.border },

    actionBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16,
    },
    editBtn: { backgroundColor: colors.teal },
    settlementsBtn: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.teal },
    logoutBtn: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: '#EF4444' },
    actionBtnText: { flex: 1, fontSize: 15, fontWeight: '600' },
    editBtnText: { color: colors.white },
    settlementsBtnText: { color: colors.teal },
    logoutBtnText: { color: '#EF4444' },

    prefCard: {
      backgroundColor: colors.surface, borderRadius: 12,
      borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
    },
    prefRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12,
    },
    prefDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },
    prefLabel: { fontSize: 14, fontWeight: '500', color: colors.text },

    langRow: { flexDirection: 'row', gap: 6 },
    langPill: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1.5,
    },
    langPillActive: { backgroundColor: colors.teal, borderColor: colors.teal },
    langPillInactive: { backgroundColor: 'transparent', borderColor: colors.border },
    langPillText: { fontSize: 12, fontWeight: '600' },
    langPillTextActive: { color: colors.white },
    langPillTextInactive: { color: colors.textSecondary },

    themeToggle: { flexDirection: 'row', gap: 6 },
    themePill: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1.5,
    },
    themePillActive: { backgroundColor: colors.teal, borderColor: colors.teal },
    themePillInactive: { backgroundColor: 'transparent', borderColor: colors.border },
    themePillText: { fontSize: 12, fontWeight: '600' },
    themePillTextActive: { color: colors.white },
    themePillTextInactive: { color: colors.textSecondary },

    spotsEmpty: {
      backgroundColor: colors.surface, borderRadius: 12,
      borderWidth: 1, borderColor: colors.border,
      padding: 24, alignItems: 'center', gap: 8,
    },
    spotsEmptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
    spotsGrid: { gap: 12 },
  });

  return (
    <Screen style={styles.container} tabBarPadding>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={typography.h1}>{t('owner.profile.title')}</Text>

        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user.name}</Text>
            <Text style={styles.profileEmail}>{user.email}</Text>
            <VerifiedBadge />
          </View>
        </View>

        {/* Edit profile */}
        <Pressable
          style={({ pressed }) => [styles.actionBtn, styles.editBtn, { opacity: pressed ? 0.85 : 1 }]}
          onPress={() => router.push('/(owner)/profile-edit')}
        >
          <Ionicons name="pencil-outline" size={18} color={colors.white} />
          <Text style={[styles.actionBtnText, styles.editBtnText]}>{t('driver.profile.edit')}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.white} />
        </Pressable>

        {/* My spots */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('profile.mySpots')}</Text>
          <View style={styles.sectionLine} />
        </View>
        {mySpots.length === 0 ? (
          <View style={styles.spotsEmpty}>
            <Ionicons name="car-outline" size={32} color={colors.textSecondary} />
            <Text style={styles.spotsEmptyText}>{t('profile.mySpots.empty')}</Text>
          </View>
        ) : (
          <View style={styles.spotsGrid}>
            {mySpots.map((spot) => (
              <Pressable key={spot.id} onPress={() => router.push(`/(owner)/spot/${spot.id}`)}>
                <ParkingSpotCard spot={spot} />
              </Pressable>
            ))}
          </View>
        )}

        {/* Settlements */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>FINANZAS</Text>
          <View style={styles.sectionLine} />
        </View>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, styles.settlementsBtn, { opacity: pressed ? 0.85 : 1 }]}
          onPress={() => router.push('/(owner)/settlements')}
        >
          <Ionicons name="receipt-outline" size={18} color={colors.teal} />
          <Text style={[styles.actionBtnText, styles.settlementsBtnText]}>{t('owner.view.settlements')}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.teal} />
        </Pressable>

        {/* Preferences */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('profile.preferences')}</Text>
          <View style={styles.sectionLine} />
        </View>
        <View style={styles.prefCard}>
          <View style={styles.prefRow}>
            <Text style={styles.prefLabel}>{t('profile.language')}</Text>
            <View style={styles.langRow}>
              {LANGS.map((l) => {
                const active = language === l.key;
                return (
                  <Pressable
                    key={l.key}
                    style={[styles.langPill, active ? styles.langPillActive : styles.langPillInactive]}
                    onPress={() => setLanguage(l.key)}
                  >
                    <Text>{l.flag}</Text>
                    <Text style={[styles.langPillText, active ? styles.langPillTextActive : styles.langPillTextInactive]}>
                      {l.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={styles.prefDivider} />
          <View style={styles.prefRow}>
            <Text style={styles.prefLabel}>{t('profile.theme')}</Text>
            <View style={styles.themeToggle}>
              <Pressable
                style={[styles.themePill, !isDark ? styles.themePillActive : styles.themePillInactive]}
                onPress={() => isDark && toggleMode()}
              >
                <Ionicons name="sunny-outline" size={13} color={!isDark ? colors.white : colors.textSecondary} />
                <Text style={[styles.themePillText, !isDark ? styles.themePillTextActive : styles.themePillTextInactive]}>
                  {t('profile.theme.light')}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.themePill, isDark ? styles.themePillActive : styles.themePillInactive]}
                onPress={() => !isDark && toggleMode()}
              >
                <Ionicons name="moon-outline" size={13} color={isDark ? colors.white : colors.textSecondary} />
                <Text style={[styles.themePillText, isDark ? styles.themePillTextActive : styles.themePillTextInactive]}>
                  {t('profile.theme.dark')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Account / Logout */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('account.myAccount')}</Text>
          <View style={styles.sectionLine} />
        </View>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, styles.logoutBtn, { opacity: pressed ? 0.8 : 1 }]}
          onPress={() => { logout(); router.replace('/(auth)/login'); }}
        >
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={[styles.actionBtnText, styles.logoutBtnText]}>{t('account.logout')}</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
