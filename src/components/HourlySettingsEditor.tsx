import { View, Text, TextInput, Switch, StyleSheet } from 'react-native';
import { AvailabilityPicker, DayScheduleGroup } from '@/src/components/AvailabilityPicker';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { t } from '@/src/i18n';

// pricePerHour en string (controlado por TextInput) -- mismo criterio que
// StaySettingsFormValue. El caller (new.tsx/edit.tsx) convierte a number
// recién al armar el body del request.
export interface HourlySettingsFormValue {
  hourlyEnabled: boolean;
  pricePerHour: string;
  schedule: DayScheduleGroup[];
}

export const EMPTY_HOURLY_SETTINGS: HourlySettingsFormValue = {
  hourlyEnabled: false,
  pricePerHour: '',
  schedule: [],
};

interface HourlySettingsEditorProps {
  value: HourlySettingsFormValue;
  onChange: (patch: Partial<HourlySettingsFormValue>) => void;
}

/**
 * Sección de "alquiler por hora" del formulario de publicar/editar cochera --
 * compartida por spots/new.tsx y spots/[id]/edit.tsx, hermana de
 * StaySettingsEditor (mismo patrón: toggle, y sólo si está prendido pide el
 * resto). Antes el alquiler por hora estaba siempre activo con un horario
 * Lun-Vie precargado; ahora es un modo más, igual de opcional que la
 * estadía, y arranca sin nada seleccionado.
 */
export function HourlySettingsEditor({ value, onChange }: HourlySettingsEditorProps) {
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

  return (
    <View>
      <View style={styles.row}>
        <View style={styles.labelBlock}>
          <Text style={styles.fieldLabel}>{t('owner.spot.hourly.enable')}</Text>
          <Text style={styles.hint}>{t('owner.spot.hourly.enableHint')}</Text>
        </View>
        <Switch
          value={value.hourlyEnabled}
          onValueChange={(v) => onChange({ hourlyEnabled: v })}
          trackColor={{ true: colors.teal }}
        />
      </View>

      {value.hourlyEnabled && (
        <View style={styles.fields}>
          <View>
            <Text style={styles.fieldLabel}>{t('owner.spot.new.pricePerHour')}</Text>
            <TextInput
              style={styles.input}
              value={value.pricePerHour}
              onChangeText={(text) => onChange({ pricePerHour: text.replace(/[^0-9.]/g, '') })}
              keyboardType="numeric"
              placeholder="$1.200"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
          <View>
            <Text style={styles.fieldLabel}>{t('owner.spot.new.availability')}</Text>
            <AvailabilityPicker value={value.schedule} onChange={(schedule) => onChange({ schedule })} />
          </View>
        </View>
      )}
    </View>
  );
}
