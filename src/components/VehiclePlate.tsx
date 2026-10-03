import { View, Text, StyleSheet } from 'react-native';
import { VehicleCountry } from '@/src/types';

// Real plates are always white/blue/black regardless of the app's own light/dark theme --
// this graphic deliberately ignores useThemeColors().
const PLATE_BLUE = '#1452a3';

const COUNTRY_LABELS: Record<VehicleCountry, string> = {
  AR: 'ARGENTINA',
  BR: 'BRASIL',
  UY: 'URUGUAY',
  PY: 'PARAGUAY',
  CL: 'CHILE',
  BO: 'BOLIVIA',
};

/** Splits "AB123CD" into "AB 123 CD" (old-format "ABC123" becomes "ABC 123") purely for
 * display -- the stored plate itself is never reformatted. */
function formatPlate(plate: string): string {
  const clean = plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const match = clean.match(/^([A-Z]{2})(\d{3})([A-Z]{2})$/) ?? clean.match(/^([A-Z]{3})(\d{3})$/);
  if (!match) return clean;
  return match.slice(1).join(' ');
}

interface VehiclePlateProps {
  plate: string;
  country: VehicleCountry;
  /** 'large' for the picker/detail view, 'small' for an inline chip next to other text. */
  size?: 'large' | 'small';
}

/** A Mercosur-style plate graphic (blue band + country name + bold plate number) -- purely
 * cosmetic, so the picker/owner-facing booking screens look like a real plate instead of
 * plain text. Not a facsimile of any single country's exact legal plate (Chile/Bolivia
 * aren't actually Mercosur members), just a consistent, recognizable look across every
 * country the picker offers. */
export function VehiclePlate({ plate, country, size = 'large' }: VehiclePlateProps) {
  const large = size === 'large';
  const styles = StyleSheet.create({
    container: {
      width: large ? 220 : 140,
      borderRadius: large ? 8 : 6,
      borderWidth: 2,
      borderColor: '#111',
      backgroundColor: '#fff',
      overflow: 'hidden',
    },
    band: {
      backgroundColor: PLATE_BLUE,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: large ? 3 : 2,
      gap: 4,
    },
    bandText: {
      color: '#fff',
      fontSize: large ? 9 : 7,
      fontWeight: '700',
      letterSpacing: 1,
    },
    star: { color: '#fff', fontSize: large ? 9 : 7 },
    countryRow: { alignItems: 'center', paddingTop: large ? 2 : 1 },
    countryText: {
      color: '#111',
      fontSize: large ? 8 : 6,
      fontWeight: '600',
      letterSpacing: 0.5,
    },
    plateRow: { alignItems: 'center', paddingVertical: large ? 6 : 3 },
    plateText: {
      color: '#111',
      fontSize: large ? 24 : 15,
      fontWeight: '800',
      letterSpacing: large ? 2 : 1,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.band}>
        <Text style={styles.star}>★</Text>
        <Text style={styles.bandText}>MERCOSUR</Text>
      </View>
      <View style={styles.countryRow}>
        <Text style={styles.countryText}>{COUNTRY_LABELS[country]}</Text>
      </View>
      <View style={styles.plateRow}>
        <Text style={styles.plateText}>{formatPlate(plate)}</Text>
      </View>
    </View>
  );
}

export { COUNTRY_LABELS };
