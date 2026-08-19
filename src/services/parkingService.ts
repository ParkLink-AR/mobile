import { ParkingSpot } from '@/src/types';
import {
  ParkingSpotApiResponse,
  searchParkingSpots as apiSearchParkingSpots,
  getParkingSpotDetail as apiGetParkingSpotDetail,
  getParkingSpotsForOwner as apiGetParkingSpotsForOwner,
  createParkingSpot as apiCreateParkingSpot,
  updateParkingSpot as apiUpdateParkingSpot,
} from '@/src/api/parking';
import { ApiError } from '@/src/api/client';
import { getDriverVisiblePrice } from './utils';

const PLACEHOLDER_PHOTO_URL = 'https://loremflickr.com/400/300/parking,garage/all';

const DAY_LABEL_INDEX: Record<string, number> = {
  Lu: 0, Ma: 1, Mi: 2, Ju: 3, Vi: 4, Sá: 5, Sa: 5, Do: 6,
};

/**
 * Parse a schedule string like "Lu 00:00–24:00, Ma 08:00–22:00" into an
 * array of DaySchedule objects. Returns undefined if parsing fails or empty.
 */
function parseScheduleText(
  text: string | null | undefined,
): Array<{ dayIndex: number; startHour: number; endHour: number }> | undefined {
  if (!text?.trim()) return undefined;
  const entries = text.split(',').map((s) => s.trim());
  const result: Array<{ dayIndex: number; startHour: number; endHour: number }> = [];
  for (const entry of entries) {
    const m = entry.match(/^(\S+)\s+(\d{1,2}):\d{2}[–-](\d{1,2}):\d{2}$/);
    if (!m) return undefined;
    const dayIndex = DAY_LABEL_INDEX[m[1]];
    if (dayIndex === undefined) return undefined;
    result.push({ dayIndex, startHour: Number(m[2]), endHour: Number(m[3]) });
  }
  return result.length ? result : undefined;
}

function toParkingSpot(raw: ParkingSpotApiResponse): ParkingSpot {
  const spot: ParkingSpot = {
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
    scheduleStartHour: 0,
    scheduleEndHour: 24,
    distanceMeters: raw.distanceMeters ?? 0,
    description: raw.description ?? '',
    active: raw.status === 'active',
  };

  // Attach parsed activeDays so the edit screen can read them without a cache.
  const parsed = parseScheduleText(raw.scheduleText);
  if (parsed) (spot as any).activeDays = parsed;

  return spot;
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

export interface UpdateParkingSpotInput {
  scheduleStartHour?: number;
  scheduleEndHour?: number;
  pricePerHour?: number;
  description?: string;
  covered?: boolean;
  activeDays?: Array<{ dayIndex: number; startHour: number; endHour: number }>;
  schedule?: string;
}

export async function updateParkingSpot(
  id: string,
  updates: UpdateParkingSpotInput,
): Promise<ParkingSpot | undefined> {
  const raw = await apiUpdateParkingSpot(id, {
    pricePerHour: updates.pricePerHour,
    description: updates.description,
    covered: updates.covered,
    scheduleText: updates.schedule,
  });
  return toParkingSpot(raw);
}
