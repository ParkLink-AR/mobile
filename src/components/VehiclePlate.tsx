import { View, Text, StyleSheet, ImageBackground } from 'react-native';
import { useFonts } from 'expo-font';

// datacar.com.ar's own plate graphics (resources/images/modern-plate.png / legacy-plate.png)
// -- used directly, by the user's own explicit call after being told these are a
// third-party company's own produced assets rather than public-domain government artwork.
const MODERN_PLATE_BG = require('../../assets/plates/ar-modern-plate.png');
const LEGACY_PLATE_BG = require('../../assets/plates/ar-legacy-plate.png');
// Both PNGs are 322x104 -- these proportions, and the text-window measurements below, are
// pixel offsets measured directly on those two images (see datacar's own app.css:
// .dc-plate{width:300px;height:61px}, .dc-legacy-plate{margin-top:26px},
// .dc-modern-plate{margin-top:37px}, scaled here to fractions of the 322x104 image).
const PLATE_IMAGE_WIDTH = 322;
const PLATE_IMAGE_HEIGHT = 104;

// GL-Nummernschild-Mtl ("FE-Mittelschrift", the real German/European plate typeface
// Mercosur's own lettering convention descends from) -- freeware, unlimited commercial use,
// downloaded from FontSpace: https://www.fontspace.com/gl-nummernschild-font-f12469
const PLATE_FONT = 'PlateNumber';

// Cars: ABC123 (pre-2016) / AB123CD (Mercosur, since 2016). Motorcycles use their own two
// formats, same two eras, one digit/letter shorter on one side: 123ABC (pre-2016) /
// A123ABC (Mercosur) -- see e.g. https://patente.ar/guia-automotor/los-4-formatos-de-patente-argentina.
const CAR_OLD_FORMAT = /^[A-Z]{3}\d{3}$/;
const CAR_MERCOSUR_FORMAT = /^[A-Z]{2}\d{3}[A-Z]{2}$/;
const MOTO_OLD_FORMAT = /^\d{3}[A-Z]{3}$/;
const MOTO_MERCOSUR_FORMAT = /^[A-Z]\d{3}[A-Z]{3}$/;

export function cleanPlate(plate: string): string {
  return plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** The four (and only four) domain formats Argentina actually issues -- two for cars, two
 * for motorcycles -- used both to decide which plate graphic to draw and, in the
 * add-vehicle form, to reject anything else (see auth-service's VehicleCreate, which
 * enforces the same patterns server-side). */
export function isValidArgentinePlate(plate: string): boolean {
  const clean = cleanPlate(plate);
  return (
    CAR_OLD_FORMAT.test(clean) ||
    CAR_MERCOSUR_FORMAT.test(clean) ||
    MOTO_OLD_FORMAT.test(clean) ||
    MOTO_MERCOSUR_FORMAT.test(clean)
  );
}

function isOldFormatPlate(clean: string): boolean {
  return CAR_OLD_FORMAT.test(clean) || MOTO_OLD_FORMAT.test(clean);
}

const GROUP_GAP = ' ';

/** Groups a cleaned plate the way it's actually read/printed, same grouping for all four
 * formats -- car and moto alike, old and Mercosur alike -- splitting the letter run from
 * the digit run: "ABC123" -> "ABC 123", "AB123CD" -> "AB 123 CD", "123ABC" -> "123 ABC",
 * "A123ABC" -> "A 123 ABC". */
function formatPlate(plate: string): string {
  const clean = cleanPlate(plate);
  const groups = clean.match(/[A-Z]+|\d+/g);
  return groups ? groups.join(GROUP_GAP) : clean;
}

interface VehiclePlateProps {
  plate: string;
  /** 'large' for the picker/detail view, 'small' for an inline chip next to other text. */
  size?: 'large' | 'small';
}

/**
 * Argentina's plate graphic -- datacar.com.ar's own two background images (the current
 * Mercosur format for a car's AB123CD or a motorcycle's A123ABC domain, the pre-2016 one
 * for a car's ABC123 or a motorcycle's 123ABC domain -- see isValidArgentinePlate for the
 * four patterns Argentina actually issues; motorcycles get the exact same two graphics as
 * cars, just their own grouping), with the plate number overlaid in the real plate
 * typeface (GL-Nummernschild, a freeware recreation of FE-Schrift) at the same
 * position/size datacar's own CSS places it.
 */
export function VehiclePlate({ plate, size = 'large' }: VehiclePlateProps) {
  const [fontLoaded] = useFonts({ [PLATE_FONT]: require('../../assets/fonts/PlateNumber.ttf') });
  const large = size === 'large';
  const width = large ? 220 : 140;
  const height = Math.round(width * (PLATE_IMAGE_HEIGHT / PLATE_IMAGE_WIDTH));
  const clean = cleanPlate(plate);
  const isOldFormat = isOldFormatPlate(clean);

  // datacar's own text-window measurements (as a fraction of the 322x104 image), one set
  // per plate style -- the window's top offset differs (legacy's black box starts higher)
  // but both are the same height.
  const windowTop = (isOldFormat ? 26 : 37) / PLATE_IMAGE_HEIGHT;
  const windowHeight = 61 / PLATE_IMAGE_HEIGHT;

  const styles = StyleSheet.create({
    container: { width, height },
    textWindow: {
      position: 'absolute',
      top: Math.round(height * windowTop),
      left: 0,
      right: 0,
      height: Math.round(height * windowHeight),
      alignItems: 'center',
      justifyContent: 'center',
    },
    plateText: {
      width: '100%',
      textAlign: 'center',
      color: isOldFormat ? '#fafafa' : '#444',
      // Sized to the text window's own height, not a fixed size -- so it actually fills
      // the white space instead of sitting small in the middle of it.
      fontSize: Math.round(height * windowHeight * 1.15),
      letterSpacing: 0.5,
      fontFamily: fontLoaded ? PLATE_FONT : undefined,
      fontWeight: fontLoaded ? 'normal' : '800',
    },
  });

  return (
    <ImageBackground
      source={isOldFormat ? LEGACY_PLATE_BG : MODERN_PLATE_BG}
      style={styles.container}
      resizeMode="stretch"
    >
      <View style={styles.textWindow}>
        <Text style={styles.plateText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
          {formatPlate(plate)}
        </Text>
      </View>
    </ImageBackground>
  );
}
