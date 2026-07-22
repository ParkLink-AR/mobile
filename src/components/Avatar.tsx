import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/src/theme/colors';

export function Avatar({ initials, size = 36 }: { initials: string; size?: number }) {
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.text, { fontSize: size * 0.4 }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: colors.white,
    fontWeight: '700',
  },
});
