import { useState } from 'react';
import { Modal, Pressable, View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Avatar } from '@/src/components/Avatar';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useSessionStore } from '@/src/store/useSessionStore';
import { useThemeStore } from '@/src/store/useThemeStore';

export function AccountMenu({ role }: { role: 'driver' | 'owner' }) {
  const colors = useThemeColors();
  const user = useSessionStore((s) => s.user);
  const logout = useSessionStore((s) => s.logout);
  const mode = useThemeStore((s) => s.mode);
  const toggleMode = useThemeStore((s) => s.toggleMode);
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
            <MenuItem icon="👤" label="Mi cuenta" onPress={() => go(`/(${role})/(tabs)/profile`)} />
            <MenuItem icon="⚙️" label="Configuración" onPress={() => go(`/(${role})/settings`)} />
            <MenuItem
              icon={mode === 'dark' ? '☀️' : '🌙'}
              label={mode === 'dark' ? 'Modo claro' : 'Modo oscuro'}
              onPress={toggleMode}
            />
            <View style={styles.divider} />
            <MenuItem icon="🚪" label="Cerrar sesión" onPress={handleLogout} muted />
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
