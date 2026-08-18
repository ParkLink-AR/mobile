import { t, useLanguage } from '@/src/i18n';
import { useState } from 'react';
import { Modal, Pressable, View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/src/components/Avatar';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useSessionStore } from '@/src/store/useSessionStore';
import { useSettingsStore } from '@/src/store/useSettingsStore';

export function AccountMenu({ role }: { role: 'driver' | 'owner' }) {
  const colors = useThemeColors();
  useLanguage();
  const user = useSessionStore((s) => s.user);
  const logout = useSessionStore((s) => s.logout);
  const mode = useSettingsStore((s) => s.mode);
  const toggleMode = useSettingsStore((s) => s.toggleMode);
  const [open, setOpen] = useState(false);

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

  function handleLogout() {
    setOpen(false);
    logout();
    router.replace('/(auth)/login');
  }

  return (
    <>
      <Pressable onPress={() => setOpen(true)}>
        <Avatar initials={user.avatarInitials} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <View style={styles.menu}>
            <MenuItem iconName="person-outline" label={t('account.myAccount')} onPress={() => go(`/(${role})/(tabs)/profile`)} />
            <MenuItem iconName="settings-outline" label={t('account.settings.label')} onPress={() => go(`/(${role})/settings`)} />
            <MenuItem
              iconName={mode === 'dark' ? 'sunny-outline' : 'moon-outline'}
              label={mode === 'dark' ? t('account.menu.theme.light') : t('account.menu.theme.dark')}
              onPress={toggleMode}
            />
            <View style={styles.divider} />
            <MenuItem iconName="log-out-outline" label={t('account.logout')} onPress={handleLogout} muted />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function MenuItem({
  iconName,
  label,
  onPress,
  muted,
}: {
  iconName: IoniconName;
  label: string;
  onPress: () => void;
  muted?: boolean;
}) {
  const colors = useThemeColors();
  const styles = StyleSheet.create({
    item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
    itemLabel: { fontSize: 15, color: colors.text },
    itemLabelMuted: { color: colors.textSecondary },
  });
  return (
    <Pressable style={styles.item} onPress={onPress}>
      <Ionicons name={iconName} size={18} color={muted ? colors.textSecondary : colors.text} />
      <Text style={[styles.itemLabel, muted && styles.itemLabelMuted]}>{label}</Text>
    </Pressable>
  );
}
