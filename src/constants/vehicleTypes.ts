import type { MaterialCommunityIcons } from '@expo/vector-icons';

// Tipos de vehículo: los que acepta una cochera (puede aceptar varios a la vez, p.ej. auto
// y moto) y el de cada vehículo guardado del conductor. Coincide 1:1 con parking-service's
// VehicleType (src/parking-spots/vehicle-type.ts) y auth-service's VEHICLE_TYPES -- el
// tipo del vehículo decide en qué cocheras entra y, si la cochera cobra por vehículo,
// cuánto paga.
export const VEHICLE_TYPES = ['car', 'suv', 'pickup', 'van', 'motorcycle', 'bicycle'] as const;

export type VehicleType = (typeof VEHICLE_TYPES)[number];

// El único tipo sin patente (ni marca/modelo obligatorios).
export const BICYCLE: VehicleType = 'bicycle';

export const VEHICLE_TYPE_LABEL_KEYS: Record<VehicleType, string> = {
  car: 'vehicleType.car',
  suv: 'vehicleType.suv',
  pickup: 'vehicleType.pickup',
  van: 'vehicleType.van',
  motorcycle: 'vehicleType.motorcycle',
  bicycle: 'vehicleType.bicycle',
};

// Ejemplos de cada tipo ("Trafic, Sprinter, Master…"), para que nadie dude dónde va su
// vehículo -- debajo de cada opción al elegirlo.
export const VEHICLE_TYPE_EXAMPLE_KEYS: Record<VehicleType, string> = {
  car: 'vehicleType.car.examples',
  suv: 'vehicleType.suv.examples',
  pickup: 'vehicleType.pickup.examples',
  van: 'vehicleType.van.examples',
  motorcycle: 'vehicleType.motorcycle.examples',
  bicycle: 'vehicleType.bicycle.examples',
};

export const VEHICLE_TYPE_ICONS: Record<VehicleType, keyof typeof MaterialCommunityIcons.glyphMap> = {
  car: 'car-side',
  suv: 'car-estate',
  pickup: 'car-pickup',
  van: 'van-utility',
  motorcycle: 'motorbike',
  bicycle: 'bicycle',
};

export function isVehicleType(value: unknown): value is VehicleType {
  return typeof value === 'string' && (VEHICLE_TYPES as readonly string[]).includes(value);
}
