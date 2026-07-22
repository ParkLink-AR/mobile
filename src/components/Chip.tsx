import { Pressable, Text, StyleSheet } from 'react-native';
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
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 6,
      marginRight: 8,
    },
    chipSelected: {
      backgroundColor: colors.teal,
      borderColor: colors.teal,
    },
    text: {
      fontSize: 13,
      color: colors.text,
    },
    textSelected: {
      color: colors.white,
    },
  });
  return (
    <Pressable
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onRemove ?? onPress}
    >
      <Text style={[styles.text, selected && styles.textSelected]}>
        {label}
        {onRemove ? ' ✕' : ''}
      </Text>
    </Pressable>
  );
}
