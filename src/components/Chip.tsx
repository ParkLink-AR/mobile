import { Pressable, Text, StyleSheet, View } from 'react-native';
import { useThemeColors } from '@/src/theme/useThemeColors';

interface ChipProps {
  label: string;
  onPress?: () => void;
  onRemove?: () => void;
  selected?: boolean;
}

export function Chip({ label, onPress, onRemove, selected }: ChipProps) {
  const colors = useThemeColors();
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
      backgroundColor: colors.teal,
      borderColor: colors.teal,
    },
    text: {
      flexShrink: 1,
      minWidth: 0,
      fontSize: 13,
      fontWeight: '500',
      color: colors.text,
    },
    textSelected: {
      color: colors.white,
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
      <Text style={[styles.text, selected && styles.textSelected]} numberOfLines={1} ellipsizeMode="tail">
        {label}
      </Text>
      {onRemove && (
        <Text style={[styles.removeText, selected && styles.removeTextSelected]}>✕</Text>
      )}
    </Pressable>
  );
}
