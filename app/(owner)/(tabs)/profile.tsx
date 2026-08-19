import { t, useLanguage } from '@/src/i18n';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View, Image, ScrollView, StyleSheet, Pressable, Modal, Animated, TouchableWithoutFeedback } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/Screen';
import { VerifiedBadge } from '@/src/components/VerifiedBadge';
import { ParkingSpotCard } from '@/src/components/ParkingSpotCard';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { logout as logoutRequest } from '@/src/api/auth';
import { useSettingsStore, Language } from '@/src/store/useSettingsStore';
import { getParkingSpotsForOwner } from '@/src/services/parkingService';
import { ParkingSpot } from '@/src/types';

const LANGS: { key: Language; label: string }[] = [
  { key: 'es', label: 'Español' },
  { key: 'en', label: 'English' },
  { key: 'ja', label: '日本語' },
];

export default function OwnerProfile() {
  useLanguage();
  const colors = useThemeColors();
  const typography = useTypography();
  const user = useSessionStore((s) => s.user);
  const refreshToken = useSessionStore((s) => s.refreshToken);
  const clearSession = useSessionStore((s) => s.clearSession);
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const mode = useSettingsStore((s) => s.mode);
  const toggleMode = useSettingsStore((s) => s.toggleMode);
  const [mySpots, setMySpots] = useState<ParkingSpot[]>([]);
  const [langModalVisible, setLangModalVisible] = useState(false);

  const themeAnim = useRef(new Animated.Value(mode === 'dark' ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(themeAnim, {
      toValue: mode === 'dark' ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [mode]);

  useEffect(() => {
    if (user) getParkingSpotsForOwner(user.id).then(setMySpots);
  }, [user]);

  // Re-fetch spots every time this tab comes into focus (e.g. after adding a new spot)
  useFocusEffect(
    useCallback(() => {
      if (user) getParkingSpotsForOwner(user.id).then(setMySpots);
    }, [user?.id])
  );

  if (!user) return null;

  const initials = user.name
    .split(' ').slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() ?? '').join('');

  const currentLang = LANGS.find((l) => l.key === language) ?? LANGS[0];
  const isDark = mode === 'dark';

  const themeIconColor = themeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.textSecondary, colors.teal],
  });

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { padding: 16, paddingBottom: 120, gap: 16 },

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
      paddingHorizontal: 16, paddingVertical: 14,
    },
    prefDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },
    prefLabel: { fontSize: 14, fontWeight: '500', color: colors.text },

    langCurrent: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    langCurrentText: { fontSize: 14, fontWeight: '600', color: colors.teal },

    themeValue: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    themeValueText: { fontSize: 14, fontWeight: '600' },

    modalOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center', alignItems: 'center',
    },
    modalSheet: {
      width: '85%', borderRadius: 20, paddingVertical: 32, paddingHorizontal: 24,
      backgroundColor: colors.surface, alignItems: 'center', gap: 8,
    },
    modalTitle: {
      fontSize: 16, fontWeight: '700', color: colors.text,
      marginBottom: 16, textAlign: 'center',
    },
    langOption: {
      width: '100%', flexDirection: 'row', alignItems: 'center', gap: 14,
      paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12,
    },
    langOptionActive: { backgroundColor: colors.teal + '22' },
    langOptionLabel: { flex: 1, fontSize: 16, fontWeight: '600' },
    langOptionLabelActive: { color: colors.teal },
    langOptionLabelInactive: { color: colors.text },

    spotsEmpty: {
      backgroundColor: colors.surface, borderRadius: 12,
      borderWidth: 1, borderColor: colors.border,
      padding: 24, alignItems: 'center', gap: 8,
    },
    spotsEmptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
    spotsGrid: { gap: 12 },
    addSpotBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 10, paddingVertical: 5,
      borderRadius: 8, borderWidth: 1.5, borderColor: colors.teal,
    },
    addSpotBtnText: { fontSize: 12, fontWeight: '600', color: colors.teal },
  });

  return (
    <Screen style={styles.container} tabBarPadding>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={typography.h1}>{t('owner.profile.title')}</Text>

        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            {user.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={{ width: 64, height: 64, borderRadius: 32 }} />
            ) : (
              <Text style={styles.avatarText}>{initials}</Text>
            )}
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
          <Pressable
            style={({ pressed }) => [styles.addSpotBtn, { opacity: pressed ? 0.75 : 1 }]}
            onPress={() => router.push('/(owner)/spots/new')}
          >
            <Ionicons name="add" size={14} color={colors.teal} />
            <Text style={styles.addSpotBtnText}>{t('profile.mySpots.add')}</Text>
          </Pressable>
        </View>
        {mySpots.length === 0 ? (
          <View style={styles.spotsEmpty}>
            <Ionicons name="car-outline" size={32} color={colors.textSecondary} />
            <Text style={styles.spotsEmptyText}>{t('profile.mySpots.empty')}</Text>
          </View>
        ) : (
          <View style={styles.spotsGrid}>
            {mySpots.map((spot) => (
              <Pressable key={spot.id} onPress={() => router.push(`/(owner)/spots/${spot.id}`)}>
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
          <Pressable
            style={({ pressed }) => [styles.prefRow, { opacity: pressed ? 0.7 : 1 }]}
            onPress={() => setLangModalVisible(true)}
          >
            <Text style={styles.prefLabel}>{t('profile.language')}</Text>
            <View style={styles.langCurrent}>
              <Text style={styles.langCurrentText}>{currentLang.label}</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.teal} />
            </View>
          </Pressable>

          <View style={styles.prefDivider} />

          <Pressable
            style={({ pressed }) => [styles.prefRow, { opacity: pressed ? 0.7 : 1 }]}
            onPress={toggleMode}
          >
            <Text style={styles.prefLabel}>{t('profile.theme')}</Text>
            <Animated.View style={styles.themeValue}>
              {isDark
                ? <Ionicons name="moon" size={16} color={colors.teal} />
                : <Ionicons name="sunny" size={16} color={colors.textSecondary} />
              }
              <Text style={[styles.themeValueText, { color: isDark ? colors.teal : colors.textSecondary }]}>
                {isDark ? t('profile.theme.dark') : t('profile.theme.light')}
              </Text>
              <Ionicons name="swap-horizontal-outline" size={14} color={colors.textSecondary} />
            </Animated.View>
          </Pressable>
        </View>

        {/* Account / Logout */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('account.myAccount')}</Text>
          <View style={styles.sectionLine} />
        </View>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, styles.logoutBtn, { opacity: pressed ? 0.8 : 1 }]}
          onPress={async () => {
            if (refreshToken) await logoutRequest(refreshToken).catch(() => {});
            clearSession();
            router.replace('/(auth)/login');
          }}
        >
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={[styles.actionBtnText, styles.logoutBtnText]}>{t('account.logout')}</Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={langModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLangModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setLangModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalSheet}>
                <Text style={styles.modalTitle}>{t('language.select')}</Text>
                {LANGS.map((l) => {
                  const active = language === l.key;
                  return (
                    <Pressable
                      key={l.key}
                      style={({ pressed }) => [
                        styles.langOption,
                        active && styles.langOptionActive,
                        { opacity: pressed ? 0.7 : 1 },
                      ]}
                      onPress={() => {
                        setLanguage(l.key);
                        setLangModalVisible(false);
                      }}
                    >
                      <Text style={[styles.langOptionLabel, active ? styles.langOptionLabelActive : styles.langOptionLabelInactive]}>
                        {l.label}
                      </Text>
                      {active && (
                        <Ionicons name="checkmark-circle" size={20} color={colors.teal} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </Screen>
  );
}
