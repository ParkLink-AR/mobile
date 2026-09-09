import { createElement, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, StyleProp, ViewStyle } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/src/theme/useThemeColors';

interface DatePickerFieldProps {
  /** YYYY-MM-DD, o '' si no hay fecha elegida. */
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  minimumDate?: Date;
  /** Mismo estilo de caja que usan los TextInput vecinos del formulario (borde, radio, padding, fuente) -- así el selector no desentona con el resto. */
  style?: StyleProp<ViewStyle>;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDisplay(iso: string): string {
  // T00:00:00 ancla en horario local -- si no, new Date('YYYY-MM-DD') lo
  // interpreta como UTC medianoche y puede mostrar el día anterior según
  // el huso horario del dispositivo.
  return new Date(`${iso}T00:00:00`).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Selector de fecha opcional, con la misma caja (borde/radio/padding) que
 * los TextInput vecinos del formulario -- el texto y el botón de limpiar
 * viven adentro de esa única caja en vez de al lado, para que el ancho no
 * cambie según haya o no una fecha elegida.
 *
 * Mismo patrón que register.tsx usa para la fecha de nacimiento:
 * DateTimePicker nativo en modo "spinner", con un <input type="date"> del
 * navegador en web porque @react-native-community/datetimepicker no
 * soporta esa plataforma.
 */
export function DatePickerField({ value, onChange, placeholder, minimumDate, style }: DatePickerFieldProps) {
  const colors = useThemeColors();
  const [showPicker, setShowPicker] = useState(false);

  const styles = StyleSheet.create({
    box: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    },
    text: { fontSize: 15, color: value ? colors.text : colors.textSecondary },
  });

  if (Platform.OS === 'web') {
    return createElement('input', {
      type: 'date',
      value,
      min: minimumDate ? toISODate(minimumDate) : undefined,
      onChange: (e: { target: { value: string } }) => onChange(e.target.value),
      // El style del caller (StyleSheet.create) ya es un objeto plano en
      // react-native-web -- se spreadea igual que register.tsx hace con su
      // propio fallback de <input type="date">.
      style: { ...(StyleSheet.flatten(style) as object), fontFamily: 'inherit' },
    });
  }

  return (
    <View style={[style, styles.box]}>
      <Pressable style={{ flex: 1 }} onPress={() => setShowPicker(true)}>
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
          <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
        </Pressable>
      )}
      {showPicker && (
        <DateTimePicker
          value={value ? new Date(`${value}T00:00:00`) : (minimumDate ?? new Date())}
          mode="date"
          display="spinner"
          minimumDate={minimumDate}
          onChange={(_, date) => {
            setShowPicker(false);
            if (date) onChange(toISODate(date));
          }}
        />
      )}
    </View>
  );
}
