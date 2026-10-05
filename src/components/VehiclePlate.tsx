import { useState } from 'react';
import { View, Text, StyleSheet, ImageBackground, NativeSyntheticEvent, TextLayoutEventData } from 'react-native';
import { useFonts } from 'expo-font';

// datacar.com.ar's own plate graphics (resources/images/modern-plate.png / legacy-plate.png)
// -- used directly, by the user's own explicit call after being told these are a
// third-party company's own produced assets rather than public-domain government artwork.
const MODERN_PLATE_BG = require('../../assets/plates/ar-modern-plate.png');
const LEGACY_PLATE_BG = require('../../assets/plates/ar-legacy-plate.png');
// Mercosur motorcycle plate (800x679): nearly square, with the domain on two lines. Its
// white text area, measured on the image: x 21..779, y 138..658.
const MODERN_BIKE_PLATE_BG = require('../../assets/plates/ar-modern-bike-plate.png');
const BIKE_IMAGE_WIDTH = 800;
const BIKE_IMAGE_HEIGHT = 679;
const BIKE_TEXT_TOP = 138 / BIKE_IMAGE_HEIGHT;
const BIKE_TEXT_HEIGHT = (658 - 138) / BIKE_IMAGE_HEIGHT;
// The modern plate PNG is 322x104 (Mercosur plates are 400x130 mm, same proportion). The
// legacy one is 237x104: real pre-2016 plates are 294x129 mm, so datacar's original
// 322px-wide graphic was narrowed to that proportion by removing plain strips between its
// details (shield, bolt slots and "ARGENTINA" kept intact). Both are 104px tall, so the
// text-window offsets below apply to either.
const PLATE_IMAGE_WIDTH = 322;
const LEGACY_PLATE_IMAGE_WIDTH = 237;
const PLATE_IMAGE_HEIGHT = 104;

// GL-Nummernschild-Mtl ("FE-Mittelschrift", the real German/European plate typeface
// Mercosur's own lettering convention descends from) -- freeware, unlimited commercial use,
// downloaded from FontSpace: https://www.fontspace.com/gl-nummernschild-font-f12469
const PLATE_FONT = 'PlateNumber';
// Saira ExtraCondensed Medium (SIL Open Font License, see PlateLegacy-OFL.txt) for the
// pre-2016 black plates: no official typeface was ever published for them, and of the
// freely licensed fonts compared against photos of real plates, this one matches their
// tall, condensed, even-stroke lettering with squared-off curves best.
const LEGACY_PLATE_FONT = 'PlateLegacy';
// The legacy plate's capitals fill 70% of its black lettering band, with a wide gap
// between the letter group and the digit group, as on the real plate.
const LEGACY_CAP_FILL = 0.7;
// Saira's own vertical metrics, per em (from the font file: unitsPerEm 1000, ascender 1135,
// descender 439, capHeight 688). Its line box is far taller than its capitals, so instead
// of trusting each platform's text centering the capitals are placed by these numbers.
const LEGACY_ASCENT_PER_EM = 1.135;
const LEGACY_CAP_HEIGHT_PER_EM = 0.688;
// The legacy plate's black band, measured on the 237x104 image: columns 4..231, rows
// 24..86 -- its center is where the capitals' center goes.
const LEGACY_BAND_CENTER_X = 118 / 237;
const LEGACY_BAND_CENTER_Y = 55.5 / 104;
// An en space rather than two spaces: the web collapses consecutive spaces into one.
const LEGACY_GROUP_GAP = '\u2002';

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
 * Argentina's plate graphic, with the plate number overlaid in the real plate typeface
 * (GL-Nummernschild, a freeware recreation of FE-Schrift):
 *   - a Mercosur motorcycle domain (A123BCD) gets the motorcycle plate, on two lines (see
 *     MercosurBikePlate);
 *   - a Mercosur car domain (AB123CD) gets datacar.com.ar's modern plate;
 *   - a pre-2016 domain (car ABC123 or motorcycle 123ABC) gets datacar's legacy plate, at
 *     the same position/size datacar's own CSS places the text.
 * See isValidArgentinePlate for the four patterns Argentina actually issues.
 */
export function VehiclePlate({ plate, size = 'large' }: VehiclePlateProps) {
  const [fontLoaded] = useFonts({
    [PLATE_FONT]: require('../../assets/fonts/PlateNumber.ttf'),
    [LEGACY_PLATE_FONT]: require('../../assets/fonts/PlateLegacy.ttf'),
  });
  const clean = cleanPlate(plate);
  if (MOTO_MERCOSUR_FORMAT.test(clean)) {
    return <MercosurBikePlate clean={clean} size={size} fontLoaded={fontLoaded} />;
  }
  const large = size === 'large';
  // Every plate is laid out in the modern plate's footprint (slotWidth), so whatever sits
  // next to it in a list starts at the same place; the narrower legacy plate is centered.
  const slotWidth = large ? 220 : 140;
  const height = Math.round(slotWidth * (PLATE_IMAGE_HEIGHT / PLATE_IMAGE_WIDTH));
  const isOldFormat = isOldFormatPlate(clean);
  const plateWidth = isOldFormat ? Math.round(height * (LEGACY_PLATE_IMAGE_WIDTH / PLATE_IMAGE_HEIGHT)) : slotWidth;

  // Modern plate: the text window is its white lettering area, measured on the 322x104
  // image itself (not datacar's CSS offsets, which sat the text ~3px low): rows 29..99.
  // The legacy plate's text is placed by LegacyPlateText instead.
  const windowTop = 29 / PLATE_IMAGE_HEIGHT;
  const windowHeight = 71 / PLATE_IMAGE_HEIGHT;
  // Letter size stays what it was (61px of the image's 104), independent of the window.
  const letterHeight = 61 / PLATE_IMAGE_HEIGHT;
  const styles = StyleSheet.create({
    slot: { width: slotWidth, alignItems: 'center' },
    container: { width: plateWidth, height },
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
      color: '#444',
      // Sized to the plate's lettering height, not a fixed size -- so it actually fills
      // the white space instead of sitting small in the middle of it.
      fontSize: Math.round(height * letterHeight * 1.15),
      letterSpacing: 0.5,
      fontFamily: fontLoaded ? PLATE_FONT : undefined,
      fontWeight: fontLoaded ? 'normal' : '800',
    },
  });

  return (
    <View style={styles.slot}>
      <ImageBackground
        source={isOldFormat ? LEGACY_PLATE_BG : MODERN_PLATE_BG}
        style={styles.container}
        resizeMode="stretch"
      >
        {isOldFormat ? (
          <LegacyPlateText
            text={formatPlate(plate).replace(GROUP_GAP, LEGACY_GROUP_GAP)}
            plateWidth={plateWidth}
            plateHeight={height}
            fontLoaded={fontLoaded}
          />
        ) : (
          <View style={styles.textWindow}>
            <Text style={styles.plateText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
              {formatPlate(plate)}
            </Text>
          </View>
        )}
      </ImageBackground>
    </View>
  );
}

/** A Mercosur motorcycle domain (A123BCD) the way the real plate prints it: two lines,
 * the letter and three digits together on top ("A123", no gap), the three letters below
 * ("BCD"). */
function MercosurBikePlate({
  clean,
  size,
  fontLoaded,
}: {
  clean: string;
  size: 'large' | 'small';
  fontLoaded: boolean;
}) {
  const carWidth = size === 'large' ? 220 : 140;
  const carHeight = Math.round(carWidth * (PLATE_IMAGE_HEIGHT / PLATE_IMAGE_WIDTH));
  // A bit taller than the car plate -- at the exact same height its two lines would be
  // too small to read.
  const height = Math.round(carHeight * 1.35);
  const width = Math.round(height * (BIKE_IMAGE_WIDTH / BIKE_IMAGE_HEIGHT));
  const textHeight = height * BIKE_TEXT_HEIGHT;

  const styles = StyleSheet.create({
    // Takes the same width as a car plate and centers the (narrower) motorcycle plate in
    // it, so whatever sits next to a plate in a list (brand/model, etc.) starts at the same
    // place for both kinds of vehicle.
    slot: { width: carWidth, alignItems: 'center' },
    container: { width, height },
    textWindow: {
      position: 'absolute',
      top: Math.round(height * BIKE_TEXT_TOP),
      left: 0,
      right: 0,
      height: Math.round(textHeight),
      alignItems: 'center',
      justifyContent: 'center',
    },
    line: {
      width: '100%',
      textAlign: 'center',
      color: '#444',
      fontSize: Math.round((textHeight / 2) * 1.05),
      lineHeight: Math.round(textHeight / 2),
      letterSpacing: 0.5,
      fontFamily: fontLoaded ? PLATE_FONT : undefined,
      fontWeight: fontLoaded ? 'normal' : '800',
    },
  });

  return (
    <View style={styles.slot}>
      <ImageBackground source={MODERN_BIKE_PLATE_BG} style={styles.container} resizeMode="stretch">
        <View style={styles.textWindow}>
          <Text style={styles.line} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {clean.slice(0, 4)}
          </Text>
          <Text style={styles.line} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {clean.slice(4)}
          </Text>
        </View>
      </ImageBackground>
    </View>
  );
}

/** The pre-2016 plate's white lettering, with its capitals centered in the black band.
 * Platforms lay out a text line's box differently (and Saira's box is much taller than its
 * capitals), so the line is first placed from the font's own metrics and then corrected
 * with where the platform actually drew the baseline and capitals (onTextLayout). */
function LegacyPlateText({
  text,
  plateWidth,
  plateHeight,
  fontLoaded,
}: {
  text: string;
  plateWidth: number;
  plateHeight: number;
  fontLoaded: boolean;
}) {
  const bandHeight = (62 / PLATE_IMAGE_HEIGHT) * plateHeight;
  const fontSize = Math.round((bandHeight * LEGACY_CAP_FILL) / LEGACY_CAP_HEIGHT_PER_EM);
  const letterSpacing = Math.round(plateHeight * 0.03);
  const bandCenterY = plateHeight * LEGACY_BAND_CENTER_Y;
  // Distance from the top of the text's own box to the middle of its capitals -- from the
  // font file until the platform reports its real layout.
  const [capCenterOffset, setCapCenterOffset] = useState(
    fontSize * (LEGACY_ASCENT_PER_EM - LEGACY_CAP_HEIGHT_PER_EM / 2),
  );

  function onTextLayout(event: NativeSyntheticEvent<TextLayoutEventData>) {
    const line = event.nativeEvent.lines[0];
    if (!line || !line.capHeight || !line.ascender) return;
    const measured = line.y + line.ascender - line.capHeight / 2;
    if (Math.abs(measured - capCenterOffset) > 0.25) setCapCenterOffset(measured);
  }

  const styles = StyleSheet.create({
    text: {
      position: 'absolute',
      top: bandCenterY - capCenterOffset,
      // Centered on the band's own center (not the image's), and letterSpacing is also
      // added after the last character, so the text is shifted right by half of it.
      left: plateWidth * LEGACY_BAND_CENTER_X * 2 - plateWidth + letterSpacing,
      right: 0,
      textAlign: 'center',
      color: '#fafafa',
      fontSize,
      letterSpacing,
      fontFamily: fontLoaded ? LEGACY_PLATE_FONT : undefined,
      fontWeight: fontLoaded ? 'normal' : '800',
    },
  });

  return (
    <Text style={styles.text} numberOfLines={1} onTextLayout={onTextLayout}>
      {text}
    </Text>
  );
}
