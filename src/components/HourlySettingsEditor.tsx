import { View, Text, TextInput, Switch, StyleSheet } from 'react-native';
import { AvailabilityPicker, DayScheduleGroup } from '@/src/components/AvailabilityPicker';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { VehicleType, VEHICLE_TYPE_LABEL_KEYS } from '@/src/constants/vehicleTypes';
import { useCommissionStore } from '@/src/store/useCommissionStore';
import { getDriverVisiblePrice } from '@/src/services/utils';
import { t } from '@/src/i18n';
import { useScale } from '@/src/theme/typography';

// pricePerHour en string (controlado por TextInput) -- mismo criterio que
// StaySettingsFormValue. El caller (new.tsx/edit.tsx) convierte a number
// recién al armar el body del request.
export interface HourlySettingsFormValue {
  hourlyEnabled: boolean;
  pricePerHour: string;
  // Alternativa a pricePerHour para cocheras donde el precio depende del
  // tipo de vehículo (p.ej. moto más barata que camioneta) -- ver el
  // comentario en ParkingSpot.pricePerHourByVehicleType (parking-service).
  // Cuando pricePerVehicleType es true, pricePerHour deja de pedirse y en
  // su lugar se completa una tarifa acá por cada tipo en `vehicleTypes`
  // (prop, no parte de este value -- lo elige otra sección del formulario).
  pricePerVehicleType: boolean;
  pricePerHourByVehicleType: Partial<Record<VehicleType, string>>;
  schedule: DayScheduleGroup[];
}

export const EMPTY_HOURLY_SETTINGS: HourlySettingsFormValue = {
  hourlyEnabled: false,
  pricePerHour: '',
  pricePerVehicleType: false,
  pricePerHourByVehicleType: {},
  schedule: [],
};

function isPositiveNumber(raw: string | undefined): boolean {
  const n = Number(raw);
  return !!raw?.trim() && !isNaN(n) && n > 0;
}

/**
 * Si el alquiler por hora está prendido, valida que haya precio: uno solo
 * (pricePerHour) o uno por cada tipo de vehículo aceptado, según
 * pricePerVehicleType. Compartido por spots/new.tsx y spots/[id]/edit.tsx
 * para no duplicar esta regla en los dos lados.
 */
export function isHourlyPricingValid(value: HourlySettingsFormValue, vehicleTypes: VehicleType[]): boolean {
  if (!value.hourlyEnabled) return true;
  if (value.pricePerVehicleType) {
    return vehicleTypes.length > 0 && vehicleTypes.every((vt) => isPositiveNumber(value.pricePerHourByVehicleType[vt]));
  }
  return isPositiveNumber(value.pricePerHour);
}

/** Convierte el mapa de precios (strings de TextInput) a números, sólo para
 * los tipos de vehículo que la cochera acepta -- para armar el body del
 * request de creación/edición. Llamar sólo después de isHourlyPricingValid. */
export function hourlyPricesByVehicleTypeToNumbers(
  value: HourlySettingsFormValue,
  vehicleTypes: VehicleType[],
): Partial<Record<VehicleType, number>> {
  const result: Partial<Record<VehicleType, number>> = {};
  for (const vt of vehicleTypes) {
    result[vt] = Number(value.pricePerHourByVehicleType[vt]);
  }
  return result;
}

interface HourlySettingsEditorProps {
  value: HourlySettingsFormValue;
  onChange: (patch: Partial<HourlySettingsFormValue>) => void;
  // Qué tipos de vehículo acepta la cochera -- se elige en otra sección del
  // mismo formulario (VehicleTypePicker), pero el precio-por-vehículo
  // necesita saberlo para pedir una tarifa por cada uno.
  vehicleTypes: VehicleType[];
}

/**
 * Sección de "alquiler por hora" del formulario de publicar/editar cochera --
 * compartida por spots/new.tsx y spots/[id]/edit.tsx, hermana de
 * StaySettingsEditor (mismo patrón: toggle, y sólo si está prendido pide el
 * resto). Antes el alquiler por hora estaba siempre activo con un horario
 * Lun-Vie precargado; ahora es un modo más, igual de opcional que la
 * estadía, y arranca sin nada seleccionado.
 */
export function HourlySettingsEditor({ value, onChange, vehicleTypes }: HourlySettingsEditorProps) {
  const colors = useThemeColors();
  const commissionRatePercent = useCommissionStore((s) => s.ratePercent);
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);

  const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    labelBlock: { flex: 1, gap: 2 },
    hint: { fontSize: sc(12), color: colors.textSecondary },
    fields: { gap: 10, marginTop: 12 },
    input: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 8,
      padding: 12, fontSize: sc(15), color: colors.text,
    },
    fieldLabel: { fontSize: sc(13), fontWeight: '600', color: colors.text, marginBottom: 4 },
    vehiclePriceRow: { gap: 10 },
    warning: { fontSize: sc(12), color: colors.warning },
    priceBreakdown: { fontSize: sc(12), color: colors.textSecondary, marginTop: 4 },
  });

  function setVehiclePrice(vehicleType: VehicleType, text: string) {
    onChange({
      pricePerHourByVehicleType: {
        ...value.pricePerHourByVehicleType,
        [vehicleType]: text.replace(/[^0-9.]/g, ''),
      },
    });
  }

  // Live preview while the owner types a price: what they'll receive in full, and what
  // the driver ends up paying once the platform commission is added on top. Returns null
  // for an empty/invalid input instead of showing a breakdown of "$0".
  function priceBreakdown(raw: string): string | null {
    const ownerPrice = Number(raw);
    if (!raw.trim() || isNaN(ownerPrice) || ownerPrice <= 0) return null;
    const driverPrice = getDriverVisiblePrice(ownerPrice, commissionRatePercent);
    return t('owner.spot.hourly.priceBreakdown', {
      ownerPrice: String(Math.round(ownerPrice)),
      driverPrice: String(driverPrice),
      commissionPercent: String(commissionRatePercent),
    });
  }

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
          <View style={styles.row}>
            <View style={styles.labelBlock}>
              <Text style={styles.fieldLabel}>{t('owner.spot.hourly.pricePerVehicleType')}</Text>
              <Text style={styles.hint}>{t('owner.spot.hourly.pricePerVehicleTypeHint')}</Text>
            </View>
            <Switch
              value={value.pricePerVehicleType}
              onValueChange={(v) => onChange({ pricePerVehicleType: v })}
              trackColor={{ true: colors.teal }}
            />
          </View>

          {value.pricePerVehicleType ? (
            vehicleTypes.length === 0 ? (
              <Text style={styles.warning}>{t('owner.spot.hourly.selectVehicleTypesFirst')}</Text>
            ) : (
              <View style={styles.vehiclePriceRow}>
                {vehicleTypes.map((vehicleType) => {
                  const breakdown = priceBreakdown(value.pricePerHourByVehicleType[vehicleType] ?? '');
                  return (
                    <View key={vehicleType}>
                      <Text style={styles.fieldLabel}>{t(VEHICLE_TYPE_LABEL_KEYS[vehicleType])}</Text>
                      <TextInput
                        style={styles.input}
                        value={value.pricePerHourByVehicleType[vehicleType] ?? ''}
                        onChangeText={(text) => setVehiclePrice(vehicleType, text)}
                        keyboardType="numeric"
                        placeholder="$1.200"
                        placeholderTextColor={colors.textSecondary}
                      />
                      {breakdown && <Text style={styles.priceBreakdown}>{breakdown}</Text>}
                    </View>
                  );
                })}
              </View>
            )
          ) : (
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
              {priceBreakdown(value.pricePerHour) && (
                <Text style={styles.priceBreakdown}>{priceBreakdown(value.pricePerHour)}</Text>
              )}
            </View>
          )}

          <View>
            <Text style={styles.fieldLabel}>{t('owner.spot.new.availability')}</Text>
            <AvailabilityPicker value={value.schedule} onChange={(schedule) => onChange({ schedule })} />
          </View>
        </View>
      )}
    </View>
  );
}
