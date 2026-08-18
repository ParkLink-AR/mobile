import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/theme/colors';

export function Avatar({ initials, size = 36 }: { initials: string; size?: number }) {
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <Ionicons name="person" size={size * 0.52} color={colors.white} />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
