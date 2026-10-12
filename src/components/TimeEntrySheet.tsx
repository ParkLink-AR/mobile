import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/src/i18n';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useScale } from '@/src/theme/typography';
import { parseTimeDigits } from '@/src/services/bookingRange';

const ERROR_RED = '#C62828';
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'] as const;

interface TimeEntrySheetProps {
  visible: boolean;
  title: string;
  /** Guía bajo el campo, p. ej. "Libre ese día: 00:00–14:45 · 15:17–24:00". */
  hint: string;
  /** Dígitos con los que arranca el campo ("1917"). */
  initialDigits: string;
  /** Qué instante es lo tipeado, o por qué no sirve (ya traducido). */
  resolve: (hours: number, minutes: number) => { ms: number } | { error: string };
  onConfirm: (ms: number) => void;
  onClose: () => void;
}

/**
 * Hoja desde abajo para escribir una hora exacta (19:17) con un teclado numérico propio -- no el del
 * sistema, que depende del celular (y del teclado físico en el emulador): así siempre hay con qué
 * tipear. Valida mientras se escribe: si la hora no existe o cae en algo ocupado lo dice y deja las
 * franjas libres a la vista; "Listo" sólo confirma una hora válida.
 */
export function TimeEntrySheet(props: TimeEntrySheetProps) {
  return (
    <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onClose}>
      {props.visible && <Entry {...props} />}
    </Modal>
  );
}

// Se monta recién al abrir la hoja, así el campo arranca siempre de cero con la hora actual en vez de
// sincronizarse con un efecto.
function Entry({ title, hint, initialDigits, resolve, onConfirm, onClose }: TimeEntrySheetProps) {
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const [digits, setDigits] = useState(initialDigits);
  // Al abrir, la hora que venía queda "seleccionada": el primer número que se toca la reemplaza entera (como en los
  // selectores del sistema), sin tener que borrarla dígito por dígito.
  const [selected, setSelected] = useState(initialDigits.length > 0);

  const parsed = parseTimeDigits(digits);
  const result = parsed ? resolve(parsed.hours, parsed.minutes) : null;
  const confirmed = result && 'ms' in result ? result.ms : null;
  const hasError = digits.length === 4 && confirmed === null;
  const message =
    digits.length < 4
      ? { text: t('spot.time.typeHint'), color: colors.textSecondary }
      : !parsed
        ? { text: t('spot.time.invalid'), color: ERROR_RED }
        : result && 'error' in result
          ? { text: result.error, color: ERROR_RED }
          : { text: t('spot.time.ok'), color: colors.teal };

  // Lo tipeado ocupa las 4 posiciones de HH:MM; lo que falta se ve como guiones.
  const slots = (digits + '----').slice(0, 4).split('');

  const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(4, 35, 71, 0.45)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 24,
    },
    title: { fontSize: sc(17), fontWeight: '600', color: colors.text },
    display: {
      marginTop: 14,
      borderWidth: 1.5,
      borderColor: hasError ? ERROR_RED : colors.teal,
      borderRadius: 12,
      backgroundColor: colors.background,
      paddingVertical: 12,
      flexDirection: 'row',
      justifyContent: 'center',
    },
    displayText: { fontSize: sc(34), letterSpacing: 2, color: colors.text, fontVariant: ['tabular-nums'] },
    displaySelected: { backgroundColor: colors.teal + '33' },
    displayEmpty: { color: colors.textSecondary },
    message: { fontSize: sc(13), lineHeight: sc(18), marginTop: 10 },
    hint: { fontSize: sc(13), lineHeight: sc(18), color: colors.textSecondary, marginTop: 4 },
    pad: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
    key: {
      width: '31.5%',
      height: sc(48),
      borderRadius: 10,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    keyText: { fontSize: sc(22), color: colors.text },
    button: {
      marginTop: 14,
      backgroundColor: colors.teal,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      opacity: confirmed === null ? 0.45 : 1,
    },
    buttonText: { fontSize: sc(15), fontWeight: '600', color: colors.white },
  });

  function press(key: (typeof KEYS)[number]) {
    if (key === '') return;
    if (key === 'back') {
      setSelected(false);
      setDigits((current) => current.slice(0, -1));
    } else if (selected) {
      setSelected(false);
      setDigits(key);
    } else {
      setDigits((current) => (current.length < 4 ? current + key : current));
    }
  }

  function confirm() {
    if (confirmed !== null) onConfirm(confirmed);
  }

  return (
    <Pressable style={styles.overlay} onPress={onClose}>
      <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.display}>
          <Text style={[styles.displayText, selected && styles.displaySelected]}>
            <Text style={slots[0] === '-' ? styles.displayEmpty : undefined}>{slots[0]}</Text>
            <Text style={slots[1] === '-' ? styles.displayEmpty : undefined}>{slots[1]}</Text>
            <Text>:</Text>
            <Text style={slots[2] === '-' ? styles.displayEmpty : undefined}>{slots[2]}</Text>
            <Text style={slots[3] === '-' ? styles.displayEmpty : undefined}>{slots[3]}</Text>
          </Text>
        </View>
        <Text style={[styles.message, { color: message.color }]}>{message.text}</Text>
        <Text style={styles.hint}>{hint}</Text>
        <View style={styles.pad}>
          {KEYS.map((key, index) =>
            key === '' ? (
              <View key={`blank-${index}`} style={styles.key} />
            ) : (
              <Pressable
                key={key}
                style={styles.key}
                onPress={() => press(key)}
                onLongPress={key === 'back' ? () => { setSelected(false); setDigits(''); } : undefined}
                accessibilityLabel={key === 'back' ? t('spot.time.backspace') : key}
              >
                {key === 'back' ? (
                  <Ionicons name="backspace-outline" size={sc(24)} color={colors.text} />
                ) : (
                  <Text style={styles.keyText}>{key}</Text>
                )}
              </Pressable>
            ),
          )}
        </View>
        <Pressable style={styles.button} onPress={confirm}>
          <Text style={styles.buttonText}>{t('spot.time.done')}</Text>
        </Pressable>
      </Pressable>
    </Pressable>
  );
}
