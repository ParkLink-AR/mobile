import { t, useLanguage } from '@/src/i18n';
import { useState } from 'react';
import {
  Text, View, ScrollView, StyleSheet, Pressable, Image,
  Modal, TouchableWithoutFeedback,
} from 'react-native';
import { router, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/Screen';
import { VerifiedBadge } from '@/src/components/VerifiedBadge';
import { RoleBadge } from '@/src/components/RoleBadge';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography, useScale } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { useSettingsStore, Language, FontSize } from '@/src/store/useSettingsStore';
import { useAccountTypeStore } from '@/src/store/useAccountTypeStore';
import { logout as logoutRequest } from '@/src/api/auth';

const LANGS: { key: Language; label: string }[] = [
  { key: 'es', label: 'Español' },
  { key: 'en', label: 'English' },
  { key: 'ja', label: '日本語' },
];

export default function Profile() {
  useLanguage();
  const group = `/${useSegments()[0]}`;
  const colors = useThemeColors();
  const typography = useTypography();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const user = useSessionStore((s) => s.user);
  const refreshToken = useSessionStore((s) => s.refreshToken);
  const clearSession = useSessionStore((s) => s.clearSession);
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const mode = useSettingsStore((s) => s.mode);
  const toggleMode = useSettingsStore((s) => s.toggleMode);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const setFontSize = useSettingsStore((s) => s.setFontSize);
  const setActiveMode = useAccountTypeStore((s) => s.setActiveMode);
  const isOwner = group === '/(owner)';
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [fontSizeModalVisible, setFontSizeModalVisible] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  if (!user) return null;

  function switchMode() {
    const nextGroup = isOwner ? '/(driver)' : '/(owner)';
    setActiveMode(isOwner ? 'driver' : 'owner');
    router.replace(`${nextGroup}/(tabs)` as never);
  }

  async function handleLogout() {
    setLogoutModalVisible(false);
    if (refreshToken) await logoutRequest(refreshToken).catch(() => {});
    clearSession();
    router.replace('/(auth)/login');
  }

  const initials = [user.name, user.lastName]
    .filter(Boolean)
    .map((w: string) => w[0]?.toUpperCase() ?? '')
    .join('');

  const currentLang = LANGS.find((l) => l.key === language) ?? LANGS[0];
  const isDark = mode === 'dark';

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, gap: 16 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

    profileCard: {
      backgroundColor: colors.surface, borderRadius: 14, padding: sc(20),
      borderWidth: 1, borderColor: colors.border,
      flexDirection: 'row', alignItems: 'center', gap: sc(16),
    },
    avatar: {
      width: sc(64), height: sc(64), borderRadius: sc(32),
      backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { color: colors.white, fontSize: sc(22), fontWeight: '700' },
    profileInfo: { flex: 1, gap: sc(4) },
    profileName: { fontSize: sc(18), fontWeight: '700', color: colors.text },
    profileEmail: { fontSize: sc(13), color: colors.textSecondary },

    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    sectionTitle: {
      fontSize: sc(11), fontWeight: '700', color: colors.textSecondary,
      letterSpacing: 0.8, textTransform: 'uppercase',
    },
    sectionLine: { flex: 1, height: 1, backgroundColor: colors.border },

    actionBtn: {
      flexDirection: 'row', alignItems: 'center', gap: sc(10),
      borderRadius: 12, paddingVertical: sc(14), paddingHorizontal: sc(16),
    },
    editBtn: { backgroundColor: colors.teal },
    logoutBtn: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: '#EF4444' },
    actionBtnText: { flex: 1, fontSize: sc(15), fontWeight: '600' },
    editBtnText: { color: colors.white },
    logoutBtnText: { color: '#EF4444' },

    prefCard: {
      backgroundColor: colors.surface, borderRadius: 14,
      borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
    },
    prefRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: sc(16), paddingVertical: sc(14),
    },
    prefDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },
    prefRowLeft: { flexDirection: 'row', alignItems: 'center', gap: sc(10) },
    prefLabel: { fontSize: sc(14), fontWeight: '500', color: colors.text },

    langCurrent: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    langCurrentText: { fontSize: sc(14), fontWeight: '600', color: colors.teal },


    modalOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center', alignItems: 'center',
    },
    modalSheet: {
      width: '85%', borderRadius: 20, paddingVertical: 32, paddingHorizontal: 24,
      backgroundColor: colors.surface, alignItems: 'center', gap: 8,
    },
    modalTitle: {
      fontSize: sc(16), fontWeight: '700', color: colors.text,
      marginBottom: 16, textAlign: 'center',
    },
    langOption: {
      width: '100%', flexDirection: 'row', alignItems: 'center', gap: 14,
      paddingVertical: sc(14), paddingHorizontal: 16, borderRadius: 12,
    },
    langOptionActive: { backgroundColor: colors.teal + '22' },
    langOptionLabel: { flex: 1, fontSize: sc(16), fontWeight: '600' },
    langOptionLabelActive: { color: colors.teal },
    langOptionLabelInactive: { color: colors.text },

    deleteWarning: {
      fontSize: sc(13), color: colors.textSecondary, textAlign: 'center', lineHeight: sc(18),
      marginBottom: 16,
    },
    deleteActions: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 8 },
    deleteCancelBtn: {
      flex: 1, borderRadius: 10, paddingVertical: sc(12), alignItems: 'center',
      borderWidth: 1.5, borderColor: colors.border,
    },
    deleteCancelBtnText: { fontSize: sc(15), fontWeight: '600', color: colors.text },
    deleteConfirmBtn: {
      flex: 1, borderRadius: 10, paddingVertical: sc(12), alignItems: 'center',
      backgroundColor: '#EF4444',
    },
    deleteConfirmBtnText: { fontSize: sc(15), fontWeight: '600', color: colors.white },
  });

  return (
    <Screen style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={typography.h1}>{t('driver.profile.title')}</Text>
          <RoleBadge />
        </View>

        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            {user.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={{ width: sc(64), height: sc(64), borderRadius: sc(32) }} />
            ) : (
              <Text style={styles.avatarText}>{initials}</Text>
            )}
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{[user.name, user.lastName].filter(Boolean).join(' ')}</Text>
            <Text style={styles.profileEmail} numberOfLines={1} ellipsizeMode="middle">{user.email}</Text>
            <VerifiedBadge />
          </View>
        </View>

        {/* Edit profile */}
        <Pressable
          style={({ pressed }) => [styles.actionBtn, styles.editBtn, { opacity: pressed ? 0.85 : 1 }]}
          onPress={() => router.push(`${group}/profile-edit`)}
        >
          <Ionicons name="pencil-outline" size={sc(18)} color={colors.white} />
          <Text style={[styles.actionBtnText, styles.editBtnText]}>{t('driver.profile.edit')}</Text>
          <Ionicons name="chevron-forward" size={sc(16)} color={colors.white} />
        </Pressable>

        {/* Mis vehículos -- cualquier cuenta puede reservar como conductor en
            cualquier momento (ver el comentario de profile.changeMode más abajo),
            así que esto vive fuera del bloque isOwner. */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('profile.vehicles.section')}</Text>
          <View style={styles.sectionLine} />
        </View>
        <View style={styles.prefCard}>
          <Pressable
            style={({ pressed }) => [styles.prefRow, { opacity: pressed ? 0.7 : 1 }]}
            onPress={() => router.push(`${group}/vehicles`)}
          >
            <View style={styles.prefRowLeft}>
              <Ionicons name="car-outline" size={sc(18)} color={colors.teal} />
              <Text style={styles.prefLabel}>{t('profile.vehicles')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={sc(16)} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Finanzas / legales — solo propietario. Mismo patrón de tarjeta con filas
            divididas que Preferencias, más abajo -- dos botones sueltos uno arriba
            del otro se leían como dos secciones distintas cuando en realidad son
            la misma categoría (accesos del propietario). */}
        {isOwner && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('profile.owner.section')}</Text>
              <View style={styles.sectionLine} />
            </View>
            <View style={styles.prefCard}>
              <Pressable
                style={({ pressed }) => [styles.prefRow, { opacity: pressed ? 0.7 : 1 }]}
                onPress={() => router.push(`${group}/settlements`)}
              >
                <View style={styles.prefRowLeft}>
                  <Ionicons name="receipt-outline" size={sc(18)} color={colors.teal} />
                  <Text style={styles.prefLabel}>{t('profile.finances')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={sc(16)} color={colors.textSecondary} />
              </Pressable>

              <View style={styles.prefDivider} />

              <Pressable
                style={({ pressed }) => [styles.prefRow, { opacity: pressed ? 0.7 : 1 }]}
                onPress={() => router.push(`${group}/payout-info`)}
              >
                <View style={styles.prefRowLeft}>
                  <Ionicons name="card-outline" size={sc(18)} color={colors.teal} />
                  <Text style={styles.prefLabel}>{t('profile.payoutInfo')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={sc(16)} color={colors.textSecondary} />
              </Pressable>

              <View style={styles.prefDivider} />

              <Pressable
                style={({ pressed }) => [styles.prefRow, { opacity: pressed ? 0.7 : 1 }]}
                onPress={() => router.push(`${group}/legal`)}
              >
                <View style={styles.prefRowLeft}>
                  <Ionicons name="document-text-outline" size={sc(18)} color={colors.teal} />
                  <Text style={styles.prefLabel}>{t('profile.legal')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={sc(16)} color={colors.textSecondary} />
              </Pressable>
            </View>
          </>
        )}

        {/* Preferences */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('profile.preferences')}</Text>
          <View style={styles.sectionLine} />
        </View>
        <View style={styles.prefCard}>

          {/* Cualquier cuenta puede pasar a modo conductor o propietario en
              cualquier momento -- lo que eligió al registrarse sólo decidió
              qué pantalla vio esa primera vez, no lo dejó encerrado en un
              solo modo (ver el comentario en useAccountTypeStore.groupFor). */}
          <Pressable
            style={({ pressed }) => [styles.prefRow, { opacity: pressed ? 0.7 : 1 }]}
            onPress={switchMode}
          >
            <Text style={styles.prefLabel}>{t('profile.changeMode')}</Text>
            <View style={styles.langCurrent}>
              <Text style={styles.langCurrentText}>
                {/* The mode the user is in right now -- tapping the row switches to the other. */}
                {isOwner ? t('accountType.owner.title') : t('accountType.driver.title')}
              </Text>
              <Ionicons name="swap-horizontal-outline" size={sc(14)} color={colors.teal} />
            </View>
          </Pressable>

          <View style={styles.prefDivider} />

          <Pressable
            style={({ pressed }) => [styles.prefRow, { opacity: pressed ? 0.7 : 1 }]}
            onPress={() => setLangModalVisible(true)}
          >
            <Text style={styles.prefLabel}>{t('profile.language')}</Text>
            <View style={styles.langCurrent}>
              <Text style={styles.langCurrentText}>{currentLang.label}</Text>
              <Ionicons name="chevron-forward" size={sc(14)} color={colors.teal} />
            </View>
          </Pressable>

          <View style={styles.prefDivider} />

          <Pressable
            style={({ pressed }) => [styles.prefRow, { opacity: pressed ? 0.7 : 1 }]}
            onPress={toggleMode}
          >
            <Text style={styles.prefLabel}>{t('profile.theme')}</Text>
            <View style={styles.langCurrent}>
              <Ionicons name={isDark ? 'moon' : 'sunny'} size={sc(16)} color={isDark ? colors.teal : colors.textSecondary} />
              <Text style={styles.langCurrentText}>
                {isDark ? t('profile.theme.dark') : t('profile.theme.light')}
              </Text>
              <Ionicons name="swap-horizontal-outline" size={sc(14)} color={colors.teal} />
            </View>
          </Pressable>

          <View style={styles.prefDivider} />

          <Pressable
            style={({ pressed }) => [styles.prefRow, { opacity: pressed ? 0.7 : 1 }]}
            onPress={() => setFontSizeModalVisible(true)}
          >
            <Text style={styles.prefLabel}>{t('settings.fontSize')}</Text>
            <View style={styles.langCurrent}>
              <Text style={styles.langCurrentText}>
                {t(fontSize === 'small' ? 'settings.fontSize.small' : fontSize === 'medium' ? 'settings.fontSize.medium' : 'settings.fontSize.large')}
              </Text>
              <Ionicons name="chevron-forward" size={sc(14)} color={colors.teal} />
            </View>
          </Pressable>
        </View>

        {/* Account / Logout */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('account.myAccount')}</Text>
          <View style={styles.sectionLine} />
        </View>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, styles.logoutBtn, { opacity: pressed ? 0.8 : 1 }]}
          onPress={() => setLogoutModalVisible(true)}
        >
          <Ionicons name="log-out-outline" size={sc(20)} color="#EF4444" />
          <Text style={[styles.actionBtnText, styles.logoutBtnText]}>{t('account.logout')}</Text>
        </Pressable>
      </ScrollView>

      {/* Logout confirmation modal */}
      <Modal
        visible={logoutModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLogoutModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setLogoutModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalSheet}>
                <Text style={styles.modalTitle}>{t('account.logout.confirmTitle')}</Text>
                <Text style={styles.deleteWarning}>{t('account.logout.confirmMessage')}</Text>
                <View style={styles.deleteActions}>
                  <Pressable
                    style={({ pressed }) => [styles.deleteCancelBtn, { opacity: pressed ? 0.7 : 1 }]}
                    onPress={() => setLogoutModalVisible(false)}
                  >
                    <Text style={styles.deleteCancelBtnText}>{t('common.cancel')}</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.deleteConfirmBtn, { opacity: pressed ? 0.85 : 1 }]}
                    onPress={handleLogout}
                  >
                    <Text style={styles.deleteConfirmBtnText}>{t('account.logout.confirm')}</Text>
                  </Pressable>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Language selection modal */}
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

      {/* Font size selection modal */}
      <Modal
        visible={fontSizeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFontSizeModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setFontSizeModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalSheet}>
                <Text style={styles.modalTitle}>{t('settings.fontSize')}</Text>
                {([
                  { key: 'small',  label: t('settings.fontSize.small') },
                  { key: 'medium', label: t('settings.fontSize.medium') },
                  { key: 'large',  label: t('settings.fontSize.large') },
                ] as { key: FontSize; label: string }[]).map((opt) => {
                  const active = fontSize === opt.key;
                  return (
                    <Pressable
                      key={opt.key}
                      style={({ pressed }) => [
                        styles.langOption,
                        active && styles.langOptionActive,
                        { opacity: pressed ? 0.7 : 1 },
                      ]}
                      onPress={() => {
                        setFontSize(opt.key);
                        setFontSizeModalVisible(false);
                      }}
                    >
                      <Text style={[styles.langOptionLabel, active ? styles.langOptionLabelActive : styles.langOptionLabelInactive]}>
                        {opt.label}
                      </Text>
                      {active && <Ionicons name="checkmark-circle" size={20} color={colors.teal} />}
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
