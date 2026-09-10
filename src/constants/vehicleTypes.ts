// Tipos de vehículo para los que puede ser apta una cochera. Coincide 1:1
// con parking-service's VehicleType (src/parking-spots/vehicle-type.ts) --
// una cochera puede aceptar más de uno a la vez (p.ej. auto y moto).
export const VEHICLE_TYPES = ['car', 'pickup', 'suv', 'motorcycle', 'bicycle'] as const;

export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const VEHICLE_TYPE_LABEL_KEYS: Record<VehicleType, string> = {
  car: 'vehicleType.car',
  pickup: 'vehicleType.pickup',
  suv: 'vehicleType.suv',
  motorcycle: 'vehicleType.motorcycle',
  bicycle: 'vehicleType.bicycle',
};
