import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '@/src/theme/colors';

interface ButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  // Defaults to the driver/Conductor teal -- pass colors.ownerAccent (+ a dark
  // textColor, since it's a light tone) from Propietario-only screens.
  color?: string;
  textColor?: string;
}

export function Button({ title, onPress, disabled, style, color, textColor }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, color && { backgroundColor: color }, disabled && styles.disabled, style]}
    >
      <Text style={[styles.text, textColor && { color: textColor }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.teal,
    borderRadius: 10,
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
