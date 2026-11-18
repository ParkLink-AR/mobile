import { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  StyleProp,
  ViewStyle,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WheelPicker, type WheelPickerItem } from '@/src/components/WheelPicker';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useScale } from '@/src/theme/typography';
import { t } from '@/src/i18n';

interface HourPickerFieldProps {
  value: number;
  onChange: (value: number) => void;
  minHour?: number;
  maxHour?: number;
  label?: string;
  title?: string;
  style?: StyleProp<ViewStyle>;
}

export function formatHour(hour: number): string {
  if (hour === 24) return '24:00';
  return `${String(hour % 24).padStart(2, '0')}:00`;
}

/**
 * An interactive hour selector field that displays the chosen hour and opens
 * a rotating wheel (spinner) sheet when tapped, enabling quick, effortless selection.
 */
export function HourPickerField({
  value,
  onChange,
  minHour = 0,
  maxHour = 23,
  label,
  title,
  style,
}: HourPickerFieldProps) {
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const [showPicker, setShowPicker] = useState(false);
  const [tempValue, setTempValue] = useState(value);

  const hours: WheelPickerItem<number>[] = useMemo(() => {
    const list: WheelPickerItem<number>[] = [];
    const min = Math.max(0, minHour);
    const max = Math.min(24, Math.max(min, maxHour));
    for (let h = min; h <= max; h++) {
      list.push({ value: h, label: formatHour(h) });
    }
    return list;
  }, [minHour, maxHour]);

  function handleOpen() {
    Keyboard.dismiss();
    // Clamp to available range
    const clamped = Math.max(minHour, Math.min(maxHour, value));
    setTempValue(clamped);
    setShowPicker(true);
  }

  function handleConfirm() {
    onChange(tempValue);
    setShowPicker(false);
  }

  const styles = StyleSheet.create({
    box: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    text: {
      fontSize: sc(15),
      fontWeight: '600',
      color: colors.text,
      fontVariant: ['tabular-nums'],
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
    wheelContainer: {
      marginVertical: 8,
      backgroundColor: colors.background,
      borderRadius: 14,
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

  return (
    <>
      <Pressable style={[style, styles.box]} onPress={handleOpen} accessibilityRole="combobox">
        <Text style={styles.text}>{formatHour(value)}</Text>
        <Ionicons name="time-outline" size={sc(18)} color={colors.textSecondary} />
      </Pressable>

      <Modal
        visible={showPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPicker(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setShowPicker(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.header}>
              <Text style={styles.title}>{title || label || t('search.filters.schedule')}</Text>
              <Pressable
                style={styles.closeBtn}
                onPress={() => setShowPicker(false)}
                hitSlop={8}
                accessibilityLabel={t('common.close')}
              >
                <Ionicons name="close" size={sc(22)} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.wheelContainer}>
              <WheelPicker
                items={hours}
                selectedValue={tempValue}
                onValueChange={setTempValue}
              />
            </View>

            <Pressable style={styles.confirmButton} onPress={handleConfirm}>
              <Ionicons name="checkmark" size={sc(20)} color={colors.white} style={{ marginRight: 6 }} />
              <Text style={styles.confirmButtonText}>{t('spot.time.done')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
