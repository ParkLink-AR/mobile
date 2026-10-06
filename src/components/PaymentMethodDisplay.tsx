import { View, Text, StyleSheet } from 'react-native';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { MercadoPagoLogo } from '@/src/components/MercadoPagoLogo';

/** The booking's payment method -- always Mercado Pago: a booking is confirmed solely once
 * payment-service sees its payment approved, so there's nothing to choose between. "Mercado
 * Pago" isn't translated -- it's a brand name, shown the same in every locale. */
export function PaymentMethodDisplay() {
  const colors = useThemeColors();
  const styles = StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: colors.surface,
    },
    label: { flex: 1, fontSize: 14, color: colors.text },
  });

  return (
    <View style={styles.row}>
      <MercadoPagoLogo size={24} />
      <Text style={styles.label} numberOfLines={1}>Mercado Pago</Text>
    </View>
  );
}
