import { createElement, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  StyleProp,
  ViewStyle,
  Keyboard,
  Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useScale } from '@/src/theme/typography';
import { palettes } from '@/src/theme/colors';
import { formatShortDate } from '@/src/services/bookingDates';
import { t } from '@/src/i18n';

interface DatePickerFieldProps {
  /** YYYY-MM-DD, o '' si no hay fecha elegida. */
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  minimumDate?: Date;
  /** The last day that can be picked. */
  maximumDate?: Date;
  /** Mismo estilo de caja que usan los TextInput vecinos del formulario. */
  style?: StyleProp<ViewStyle>;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDisplay(iso: string): string {
  return formatShortDate(iso);
}

/**
 * Selector de fecha con la misma caja que los inputs vecinos.
 * En iOS abre una hoja inferior (bottom sheet) con rueda de fecha y botón "Listo" / tick de confirmación.
 * En Android abre el diálogo nativo con OK/Cancel.
 * En Web usa el <input type="date"> nativo.
 */
export function DatePickerField({
  value,
  onChange,
  placeholder,
  minimumDate,
  maximumDate,
  style,
}: DatePickerFieldProps) {
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(() =>
    value ? new Date(`${value}T00:00:00`) : (minimumDate ?? new Date()),
  );

  const styles = StyleSheet.create({
    box: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    text: {
      fontSize: sc(15),
      color: value ? colors.text : colors.textSecondary,
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(4, 35, 71, 0.45)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 28,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    title: {
      fontSize: sc(17),
      fontWeight: '700',
      color: colors.text,
    },
    closeBtn: {
      padding: 4,
    },
    pickerContainer: {
      marginVertical: 8,
      backgroundColor: colors.background,
      borderRadius: 14,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
    },
    wheel: {
      alignSelf: 'center',
    },
    confirmButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 18,
      backgroundColor: colors.teal,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 20,
    },
    confirmButtonText: {
      fontSize: sc(16),
      fontWeight: '600',
      color: colors.white,
    },
  });

  if (Platform.OS === 'web') {
    return createElement('input', {
      type: 'date',
      value,
      min: minimumDate ? toISODate(minimumDate) : undefined,
      max: maximumDate ? toISODate(maximumDate) : undefined,
      onChange: (e: { target: { value: string } }) => onChange(e.target.value),
      style: { ...(StyleSheet.flatten(style) as object), fontFamily: 'inherit' },
    });
  }

  function handleOpen() {
    Keyboard.dismiss();
    const initial = value ? new Date(`${value}T00:00:00`) : (minimumDate ?? new Date());
    setTempDate(initial);
    setShowPicker(true);
  }

  function handleConfirm() {
    onChange(toISODate(tempDate));
    setShowPicker(false);
  }

  return (
    <>
      <View style={[style, styles.box]}>
        <Pressable style={{ flex: 1 }} onPress={handleOpen}>
          <Text style={styles.text}>{value ? formatDisplay(value) : placeholder}</Text>
        </Pressable>
        {!!value && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              onChange('');
            }}
            hitSlop={8}
          >
            <Ionicons name="close-circle" size={sc(18)} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      {/* Android Native Dialog */}
      {showPicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={tempDate}
          mode="date"
          display="default"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={(_, date) => {
            setShowPicker(false);
            if (date) {
              onChange(toISODate(date));
            }
          }}
          onDismiss={() => setShowPicker(false)}
        />
      )}

      {/* iOS Bottom Sheet Modal with spinner and OK/tick button */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={showPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowPicker(false)}
        >
          <Pressable style={styles.overlay} onPress={() => setShowPicker(false)}>
            <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.header}>
                <Text style={styles.title}>{placeholder || t('search.request.datePlaceholder')}</Text>
                <Pressable
                  style={styles.closeBtn}
                  onPress={() => setShowPicker(false)}
                  hitSlop={8}
                  accessibilityLabel={t('common.close')}
                >
                  <Ionicons name="close" size={sc(22)} color={colors.textSecondary} />
                </Pressable>
              </View>

              <View style={styles.pickerContainer}>
                <DateTimePicker
                  value={tempDate}
                  mode="date"
                  display="spinner"
                  locale="es-AR"
                  textColor={colors.text}
                  themeVariant={colors === palettes.dark ? 'dark' : 'light'}
                  minimumDate={minimumDate}
                  maximumDate={maximumDate}
                  onChange={(_, date) => {
                    if (date) setTempDate(date);
                  }}
                  style={styles.wheel}
                />
              </View>

              <Pressable style={styles.confirmButton} onPress={handleConfirm}>
                <Ionicons name="checkmark" size={sc(20)} color={colors.white} style={{ marginRight: 6 }} />
                <Text style={styles.confirmButtonText}>{t('spot.time.done')}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </>
  );
}
