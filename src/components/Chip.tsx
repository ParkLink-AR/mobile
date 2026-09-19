import { Pressable, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/src/theme/useThemeColors';

interface ChipProps {
  label: string;
  onPress?: () => void;
  onRemove?: () => void;
  selected?: boolean;
  /** Optional leading icon (e.g. the instant-booking/requires-approval indicator). */
  icon?: keyof typeof Ionicons.glyphMap;
  // Defaults to the driver/Conductor teal -- pass colors.ownerAccent (+ a dark
  // selectedTextColor, since it's a light tone) from Propietario-only screens.
  color?: string;
  selectedTextColor?: string;
}

export function Chip({ label, onPress, onRemove, selected, icon, color, selectedTextColor }: ChipProps) {
  const colors = useThemeColors();
  const accent = color ?? colors.teal;
  const onAccent = selectedTextColor ?? colors.white;
  const styles = StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      maxWidth: 280,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 7,
      marginRight: 8,
      marginBottom: 6,
      backgroundColor: colors.surface,
    },
    chipSelected: {
      backgroundColor: accent,
      borderColor: accent,
    },
    text: {
      flexShrink: 1,
      minWidth: 0,
      fontSize: 13,
      fontWeight: '500',
      color: colors.text,
    },
    textSelected: {
      color: onAccent,
    },
    removeText: {
      fontSize: 11,
      color: colors.textSecondary,
      marginLeft: 2,
    },
    removeTextSelected: {
      color: 'rgba(255,255,255,0.75)',
    },
  });
  return (
    <Pressable
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onRemove ?? onPress}
    >
      {icon && (
        <Ionicons name={icon} size={13} color={selected ? onAccent : accent} />
      )}
      <Text style={[styles.text, selected && styles.textSelected]} numberOfLines={1} ellipsizeMode="tail">
        {label}
      </Text>
      {onRemove && (
        <Text style={[styles.removeText, selected && styles.removeTextSelected]}>✕</Text>
      )}
    </Pressable>
  );
}
