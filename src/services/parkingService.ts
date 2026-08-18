import { ParkingSpot } from '@/src/types';
import {
  ParkingSpotApiResponse,
  searchParkingSpots as apiSearchParkingSpots,
  getParkingSpotDetail as apiGetParkingSpotDetail,
  getParkingSpotsForOwner as apiGetParkingSpotsForOwner,
  createParkingSpot as apiCreateParkingSpot,
} from '@/src/api/parking';
import { ApiError } from '@/src/api/client';
import { getDriverVisiblePrice } from './utils';

const PLACEHOLDER_PHOTO_URL = 'https://loremflickr.com/400/300/parking,garage/all';

function toParkingSpot(raw: ParkingSpotApiResponse): ParkingSpot {
  return {
    id: raw.id,
    ownerId: raw.ownerId,
    title: raw.title,
    address: raw.address,
    lat: raw.lat,
    lng: raw.lng,
    pricePerHour: raw.pricePerHour,
    photoUrl: raw.photos[0] ?? PLACEHOLDER_PHOTO_URL,
    covered: raw.covered,
    rating: 0,
    reviewCount: 0,
    tags: raw.covered ? ['Cubierta'] : ['Descubierta'],
    schedule: raw.scheduleText ?? '',
    // No structured schedule hours from the backend yet (scheduleText is
    // free text, same as what the owner types when publishing) -- treat
    // every spot as always-available rather than fake precise hours.
    scheduleStartHour: 0,
    scheduleEndHour: 24,
    distanceMeters: raw.distanceMeters ?? 0,
    description: raw.description ?? '',
    active: raw.status === 'active',
  };
}

export interface SearchParkingSpotsFilters {
  minPrice?: number;
  maxPrice?: number;
  covered?: boolean;
  maxDistanceMeters?: number;
}

export async function searchParkingSpots(
  filters: SearchParkingSpotsFilters & { lat: number; lng: number }
): Promise<ParkingSpot[]> {
  const results = await apiSearchParkingSpots({
    lat: filters.lat,
    lng: filters.lng,
    radius: filters.maxDistanceMeters,
    maxPrice: filters.maxPrice,
    covered: filters.covered,
  });
  const spots = results.map(toParkingSpot);
  if (filters.minPrice === undefined) return spots;
  return spots.filter((s) => getDriverVisiblePrice(s.pricePerHour) >= filters.minPrice!);
}

export async function getParkingSpotDetail(id: string): Promise<ParkingSpot | undefined> {
  try {
    return toParkingSpot(await apiGetParkingSpotDetail(id));
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return undefined;
    throw err;
  }
}

export async function getParkingSpotsForOwner(ownerId: string): Promise<ParkingSpot[]> {
  const results = await apiGetParkingSpotsForOwner(ownerId);
  return results.map(toParkingSpot);
}

export interface CreateParkingSpotInput {
  title: string;
  address: string;
  covered: boolean;
  pricePerHour: number;
  schedule?: string;
  description?: string;
}

export async function createParkingSpot(input: CreateParkingSpotInput): Promise<ParkingSpot> {
  const raw = await apiCreateParkingSpot({
    title: input.title,
    address: input.address,
    pricePerHour: input.pricePerHour,
    covered: input.covered,
    scheduleText: input.schedule,
    description: input.description,
  });
  return toParkingSpot(raw);
}

// Editing a published spot isn't wired to the backend yet (parking-service
// has no update endpoint) -- this only merges the change into what was last
// read, so the edit/availability screens don't crash, without persisting it.
export interface UpdateParkingSpotInput {
  scheduleStartHour?: number;
  scheduleEndHour?: number;
  pricePerHour?: number;
  description?: string;
  /** Per-day schedule; not persisted anywhere yet (see note above). */
  activeDays?: Array<{ dayIndex: number; startHour: number; endHour: number }>;
  schedule?: string;
}

export async function updateParkingSpot(
  id: string,
  updates: UpdateParkingSpotInput
): Promise<ParkingSpot | undefined> {
  const spot = await getParkingSpotDetail(id);
  if (!spot) return undefined;
  return { ...spot, ...updates };
}
