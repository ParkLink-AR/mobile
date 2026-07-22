import { useState } from 'react';
import { Text, TextInput, StyleSheet } from 'react-native';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';

export default function ForgotPassword() {
  const colors = useThemeColors();
  const typography = useTypography();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface, padding: 24, gap: 12 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 15,
      color: colors.text,
    },
  });

  return (
    <Screen style={styles.container}>
      <Text style={typography.h1}>Recuperar contraseña</Text>
      {sent ? (
        <Text style={typography.body}>
          Si el email existe, vas a recibir un link para restablecer tu contraseña.
        </Text>
      ) : (
        <>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <Button title="Enviar link" onPress={() => setSent(true)} />
        </>
      )}
    </Screen>
  );
}
