import { t } from '@/src/i18n';
import { useState } from 'react';
import { Modal, Pressable, View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Avatar } from '@/src/components/Avatar';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useSessionStore } from '@/src/store/useSessionStore';
import { useSettingsStore } from '@/src/store/useSettingsStore';
import { logout as logoutRequest } from '@/src/api/auth';

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || '?';
}

export function AccountMenu({ role }: { role: 'driver' | 'owner' }) {
  const colors = useThemeColors();
  const user = useSessionStore((s) => s.user);
  const refreshToken = useSessionStore((s) => s.refreshToken);
  const clearSession = useSessionStore((s) => s.clearSession);
  const setActiveMode = useSessionStore((s) => s.setActiveMode);
  const mode = useSettingsStore((s) => s.mode);
  const toggleMode = useSettingsStore((s) => s.toggleMode);
  const [open, setOpen] = useState(false);
  const otherRole = role === 'driver' ? 'owner' : 'driver';

  const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(4, 35, 71, 0.2)' },
    menu: {
      position: 'absolute',
      top: 56,
      right: 16,
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingVertical: 6,
      minWidth: 190,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  });

  if (!user) return null;

  function go(path: string) {
    setOpen(false);
    router.push(path);
  }

  async function handleLogout() {
    setOpen(false);
    if (refreshToken) {
      // Best-effort: revoke the session server-side, but don't block the
      // local logout on it (e.g. offline, or the token already expired).
      await logoutRequest(refreshToken).catch(() => {});
    }
    clearSession();
    router.replace('/(auth)/login');
  }

  function handleSwitchMode() {
    setOpen(false);
    setActiveMode(otherRole);
    router.replace(`/(${otherRole})/(tabs)`);
  }

  return (
    <>
      <Pressable onPress={() => setOpen(true)}>
        <Avatar initials={initialsFromName(user.name)} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <View style={styles.menu}>
              <MenuItem icon="👤" label={t('account.myAccount')} onPress={() => go(`/(${role})/(tabs)/profile`)} />
              <MenuItem icon="⚙️" label={t('account.settings.label')} onPress={() => go(`/(${role})/settings`)} />
              <MenuItem
                icon={otherRole === 'owner' ? '🏠' : '🚗'}
                label={otherRole === 'owner' ? 'Cambiar a modo propietario' : 'Cambiar a modo conductor'}
                onPress={handleSwitchMode}
              />
            <MenuItem
              icon={mode === 'dark' ? '☀️' : '🌙'}
              label={mode === 'dark' ? t('account.menu.theme.light') : t('account.menu.theme.dark')}
              onPress={toggleMode}
            />
            <View style={styles.divider} />
              <MenuItem icon="🚪" label={t('account.logout')} onPress={handleLogout} muted />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
  muted,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  muted?: boolean;
}) {
  const colors = useThemeColors();
  const styles = StyleSheet.create({
    item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
    itemIcon: { fontSize: 16 },
    itemLabel: { fontSize: 15, color: colors.text },
    itemLabelMuted: { color: colors.textSecondary },
  });
  return (
    <Pressable style={styles.item} onPress={onPress}>
      <Text style={styles.itemIcon}>{icon}</Text>
      <Text style={[styles.itemLabel, muted && styles.itemLabelMuted]}>{label}</Text>
    </Pressable>
  );
}
