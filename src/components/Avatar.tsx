import { View, Image, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/theme/colors';

export function Avatar({
  initials,
  size = 36,
  uri,
}: {
  initials: string;
  size?: number;
  uri?: string;
}) {
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      ) : initials ? (
        <Text style={[styles.initials, { fontSize: size * 0.4 }]}>{initials}</Text>
      ) : (
        <Ionicons name="person" size={size * 0.52} color={colors.white} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: {
    color: colors.white,
    fontWeight: '700',
  },
});
