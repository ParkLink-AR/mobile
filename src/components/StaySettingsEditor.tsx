import { View, Text, TextInput, Switch, StyleSheet } from 'react-native';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { t } from '@/src/i18n';

// Todo en string (no number) porque son valores de TextInput controlados --
// mismo criterio que `price`/`capacity` en spots/new.tsx y edit.tsx. El
// caller (new.tsx/edit.tsx) es quien convierte a number recién al armar el
// body del request.
export interface StaySettingsFormValue {
  stayEnabled: boolean;
  pricePerDay: string;
  pricePerWeek: string;
  pricePerMonth: string;
  maxStayDays: string;
  stayAvailableFrom: string; // YYYY-MM-DD, puede quedar vacío
}

export const EMPTY_STAY_SETTINGS: StaySettingsFormValue = {
  stayEnabled: false,
  pricePerDay: '',
  pricePerWeek: '',
  pricePerMonth: '',
  maxStayDays: '',
  stayAvailableFrom: '',
};

interface StaySettingsEditorProps {
  value: StaySettingsFormValue;
  onChange: (patch: Partial<StaySettingsFormValue>) => void;
}

/**
 * Sección de "estadía" (alquiler por día/semana/mes en vez de por hora) del
 * formulario de publicar/editar cochera -- compartida por spots/new.tsx y
 * spots/[id]/edit.tsx. Las tres tarifas y la duración máxima son
 * obligatorias en cuanto el dueño prende el toggle: parking-service las
 * exige igual (ver CreateParkingSpotDto/UpdateParkingSpotDto), pedirlas acá
 * también evita que el dueño llegue hasta "Publicar"/"Guardar" para
 * enterarse.
 */
export function StaySettingsEditor({ value, onChange }: StaySettingsEditorProps) {
  const colors = useThemeColors();

  const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    labelBlock: { flex: 1, gap: 2 },
    hint: { fontSize: 12, color: colors.textSecondary },
    fields: { gap: 10, marginTop: 12 },
    input: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 8,
      padding: 12, fontSize: 15, color: colors.text,
    },
    fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 4 },
  });

  function numericField(text: string, onChangeText: (v: string) => void) {
    // Sólo dígitos y un punto decimal -- mismo saneo que capacity ya hace para enteros.
    onChangeText(text.replace(/[^0-9.]/g, ''));
  }

  return (
    <View>
      <View style={styles.row}>
        <View style={styles.labelBlock}>
          <Text style={styles.fieldLabel}>{t('owner.spot.stay.enable')}</Text>
          <Text style={styles.hint}>{t('owner.spot.stay.enableHint')}</Text>
        </View>
        <Switch
          value={value.stayEnabled}
          onValueChange={(v) => onChange({ stayEnabled: v })}
          trackColor={{ true: colors.teal }}
        />
      </View>

      {value.stayEnabled && (
        <View style={styles.fields}>
          <View>
            <Text style={styles.fieldLabel}>{t('owner.spot.stay.pricePerDay')}</Text>
            <TextInput
              style={styles.input}
              value={value.pricePerDay}
              onChangeText={(text) => numericField(text, (v) => onChange({ pricePerDay: v }))}
              keyboardType="numeric"
              placeholder="$8.000"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
          <View>
            <Text style={styles.fieldLabel}>{t('owner.spot.stay.pricePerWeek')}</Text>
            <TextInput
              style={styles.input}
              value={value.pricePerWeek}
              onChangeText={(text) => numericField(text, (v) => onChange({ pricePerWeek: v }))}
              keyboardType="numeric"
              placeholder="$45.000"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
          <View>
            <Text style={styles.fieldLabel}>{t('owner.spot.stay.pricePerMonth')}</Text>
            <TextInput
              style={styles.input}
              value={value.pricePerMonth}
              onChangeText={(text) => numericField(text, (v) => onChange({ pricePerMonth: v }))}
              keyboardType="numeric"
              placeholder="$150.000"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
          <View>
            <Text style={styles.fieldLabel}>{t('owner.spot.stay.maxStayDays')}</Text>
            <TextInput
              style={styles.input}
              value={value.maxStayDays}
              onChangeText={(text) => onChange({ maxStayDays: text.replace(/[^0-9]/g, '') })}
              keyboardType="number-pad"
              placeholder="90"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
          <View>
            <Text style={styles.fieldLabel}>{t('owner.spot.stay.availableFrom')}</Text>
            <TextInput
              style={styles.input}
              value={value.stayAvailableFrom}
              onChangeText={(text) => onChange({ stayAvailableFrom: text })}
              placeholder="AAAA-MM-DD"
              placeholderTextColor={colors.textSecondary}
            />
            <Text style={styles.hint}>{t('owner.spot.stay.availableFromHint')}</Text>
          </View>
        </View>
      )}
    </View>
  );
}
