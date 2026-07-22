import { ParkingSpot } from '@/src/types';
import { mockParkingSpots } from '@/src/mocks/parkingSpots';
import { delay } from './utils';

export interface SearchParkingSpotsFilters {
  minPrice?: number;
  maxPrice?: number;
  covered?: boolean;
  maxDistanceMeters?: number;
  startHour?: number;
  endHour?: number;
}

export async function searchParkingSpots(
  filters: SearchParkingSpotsFilters = {}
): Promise<ParkingSpot[]> {
  let results = mockParkingSpots.filter((s) => s.active);
  if (filters.minPrice !== undefined) {
    results = results.filter((s) => s.pricePerHour >= filters.minPrice!);
  }
  if (filters.maxPrice !== undefined) {
    results = results.filter((s) => s.pricePerHour <= filters.maxPrice!);
  }
  if (filters.covered !== undefined) {
    results = results.filter((s) => s.covered === filters.covered);
  }
  if (filters.maxDistanceMeters !== undefined) {
    results = results.filter((s) => s.distanceMeters <= filters.maxDistanceMeters!);
  }
  if (filters.startHour !== undefined && filters.endHour !== undefined) {
    results = results.filter(
      (s) => s.scheduleStartHour <= filters.startHour! && s.scheduleEndHour >= filters.endHour!
    );
  }
  return delay(results);
}

export async function getParkingSpotDetail(
  id: string
): Promise<ParkingSpot | undefined> {
  return delay(mockParkingSpots.find((s) => s.id === id));
}

export async function getParkingSpotsForOwner(ownerId: string): Promise<ParkingSpot[]> {
  return delay(mockParkingSpots.filter((s) => s.ownerId === ownerId));
}
