import { useEffect, useState } from 'react';
import { t } from '@/src/i18n';
import { getVehicles } from '@/src/api/auth';
import { ApiError } from '@/src/api/client';
import { isVehicleType, VehicleType } from '@/src/constants/vehicleTypes';
import { spotNeedsVehicle, vehicleFitsSpot } from '@/src/services/parkingService';
import { ParkingSpot, Vehicle } from '@/src/types';

/**
 * The vehicle a booking is for, on the confirm screens: the driver's saved vehicles, which
 * one is picked, and whether one is required (the spot asks for it, or prices by it -- see
 * spotNeedsVehicle). When one is required it starts on the driver's first vehicle that
 * fits -- preferring `preferredType`, the type they priced the spot with -- so it's usually
 * one tap; otherwise it starts on none, as before.
 */
export function useBookingVehicle(
  userId: string | undefined,
  spot: ParkingSpot | null,
  mode: 'hourly' | 'stay',
  preferredType?: string,
) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  // undefined: the driver hasn't chosen yet -- the default below applies.
  const [picked, setPicked] = useState<Vehicle | null | undefined>(undefined);

  useEffect(() => {
    if (userId) getVehicles(userId).then(setVehicles).catch(() => {});
  }, [userId]);

  const needsVehicle = spot ? spotNeedsVehicle(spot, mode) : false;
  const fitting = spot ? vehicles.filter((v) => vehicleFitsSpot(v, spot, needsVehicle)) : [];
  const preferred = isVehicleType(preferredType) ? fitting.find((v) => v.type === preferredType) : undefined;
  const defaultVehicle = needsVehicle ? preferred ?? fitting[0] ?? null : null;
  const selectedVehicle = picked !== undefined ? picked : defaultVehicle;

  // A vehicle added (or whose type was filled in) from the picker -- kept in the list.
  function onVehicleSaved(vehicle: Vehicle) {
    setVehicles((prev) => (prev.some((v) => v.id === vehicle.id) ? prev.map((v) => (v.id === vehicle.id ? vehicle : v)) : [...prev, vehicle]));
  }

  return {
    vehicles,
    selectedVehicle,
    setSelectedVehicle: setPicked as (vehicle: Vehicle | null) => void,
    onVehicleSaved,
    needsVehicle,
    /** The type that prices the booking: the picked vehicle's, else the one the driver
     * priced the spot with. */
    vehicleType: (selectedVehicle?.type ?? (isVehicleType(preferredType) ? preferredType : null)) as VehicleType | null,
  };
}

/** The picked vehicle as the create-booking request's snapshot. */
export function bookingVehicleBody(vehicle: Vehicle | null) {
  if (!vehicle) return undefined;
  return {
    type: vehicle.type,
    plate: vehicle.plate ?? undefined,
    brand: vehicle.brand ?? undefined,
    model: vehicle.model ?? undefined,
    country: vehicle.country,
  };
}

// booking-service's reasons for refusing a booking's vehicle (Service.checkVehicle), in
// the driver's language.
const VEHICLE_ERROR_KEYS = new Map([
  ['VEHICLE_REQUIRED', 'driver.booking.vehicle.error.required'],
  ['VEHICLE_TYPE_NOT_ACCEPTED', 'driver.booking.vehicle.error.notAccepted'],
  ['VEHICLE_PLATE_REQUIRED', 'driver.booking.vehicle.error.plateRequired'],
]);

/** A booking error about the vehicle, translated -- or null for any other error. */
export function vehicleErrorMessage(err: unknown): string | null {
  if (!(err instanceof ApiError) || !err.code) return null;
  const key = VEHICLE_ERROR_KEYS.get(err.code);
  return key ? t(key) : null;
}
