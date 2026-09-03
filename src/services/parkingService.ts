import { ParkingSpot, ScheduleEntry } from '@/src/types';
import {
  ParkingSpotApiResponse,
  ParkingSpotPhotoAsset,
  searchParkingSpots as apiSearchParkingSpots,
  getParkingSpotDetail as apiGetParkingSpotDetail,
  getParkingSpotsForOwner as apiGetParkingSpotsForOwner,
  getFavoriteIds as apiGetFavoriteIds,
  getFavoriteSpots as apiGetFavoriteSpots,
  addFavorite,
  removeFavorite,
  createParkingSpot as apiCreateParkingSpot,
  updateParkingSpot as apiUpdateParkingSpot,
  uploadParkingSpotPhotos as apiUploadParkingSpotPhotos,
  deleteParkingSpotPhoto as apiDeleteParkingSpotPhoto,
  reorderParkingSpotPhotos as apiReorderParkingSpotPhotos,
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
    photos: raw.photos,
    covered: raw.covered,
    rating: 0,
    reviewCount: 0,
    tags: raw.covered ? ['Cubierta'] : ['Descubierta'],
    schedule: raw.schedule,
    distanceMeters: raw.distanceMeters ?? 0,
    description: raw.description ?? '',
    active: raw.status === 'active',
  };
}

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const CLOSED = 'Cerrado';

function fmtHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

function windowsLabel(entries: ScheduleEntry[]): string {
  return entries
    .slice()
    .sort((a, b) => a.startHour - b.startHour)
    .map((entry) => `${fmtHour(entry.startHour)}–${fmtHour(entry.endHour)}`)
    .join(', ');
}

export interface ScheduleDisplayLine {
  dayRange: string;
  hours: string;
}

/**
 * Agrupa el horario semanal en líneas por rango de días consecutivos con el
 * mismo horario (ej. "Lun – Vie  08:00 – 22:00"), como cualquier ficha de
 * comercio. Los días sin ninguna entrada se muestran como "Cerrado".
 */
export function formatScheduleForDisplay(schedule: ScheduleEntry[]): ScheduleDisplayLine[] {
  const byDay = new Map<number, ScheduleEntry[]>();
  for (const entry of schedule) {
    const dayEntries = byDay.get(entry.dayOfWeek) ?? [];
    dayEntries.push(entry);
    byDay.set(entry.dayOfWeek, dayEntries);
  }

  const perDayLabel = Array.from({ length: 7 }, (_, dayOfWeek) => {
    const entries = byDay.get(dayOfWeek);
    return entries?.length ? windowsLabel(entries) : CLOSED;
  });

  const lines: ScheduleDisplayLine[] = [];
  let rangeStart = 0;
  for (let day = 1; day <= 7; day++) {
    if (day < 7 && perDayLabel[day] === perDayLabel[rangeStart]) continue;
    const rangeEnd = day - 1;
    const dayRange = rangeStart === rangeEnd ? DAY_LABELS[rangeStart] : `${DAY_LABELS[rangeStart]} – ${DAY_LABELS[rangeEnd]}`;
    lines.push({ dayRange, hours: perDayLabel[rangeStart] });
    rangeStart = day;
  }
  return lines;
}

export interface SearchParkingSpotsFilters {
  minPrice?: number;
  maxPrice?: number;
  covered?: boolean;
  maxDistanceMeters?: number;
  // Desired reservation window, today only (no date picker yet -- see
  // toISOToday). Go together: both or neither.
  fromHour?: number;
  toHour?: number;
}

// Builds an ISO 8601 datetime for `hour` today, with a fixed -03:00 offset
// (same assumption the backend makes everywhere else -- Buenos Aires has no
// DST) rather than the device's own timezone, which may not be ART.
export function toISOToday(hour: number): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const paddedHour = String(hour).padStart(2, '0');
  return `${year}-${month}-${day}T${paddedHour}:00:00-03:00`;
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
    from: filters.fromHour !== undefined ? toISOToday(filters.fromHour) : undefined,
    to: filters.toHour !== undefined ? toISOToday(filters.toHour) : undefined,
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

export async function getFavoriteIds(): Promise<string[]> {
  return apiGetFavoriteIds();
}

export async function getFavoriteSpots(): Promise<ParkingSpot[]> {
  const results = await apiGetFavoriteSpots();
  return results.map(toParkingSpot);
}

export { addFavorite, removeFavorite };

export interface CreateParkingSpotInput {
  title: string;
  address: string;
  lat: number;
  lng: number;
  covered: boolean;
  pricePerHour: number;
  schedule?: ScheduleEntry[];
  description?: string;
}

export async function createParkingSpot(input: CreateParkingSpotInput): Promise<ParkingSpot> {
  const raw = await apiCreateParkingSpot({
    title: input.title,
    address: input.address,
    lat: input.lat,
    lng: input.lng,
    pricePerHour: input.pricePerHour,
    covered: input.covered,
    schedule: input.schedule,
    description: input.description,
  });
  return toParkingSpot(raw);
}

export async function uploadParkingSpotPhotos(
  spotId: string,
  assets: ParkingSpotPhotoAsset[],
): Promise<ParkingSpot> {
  return toParkingSpot(await apiUploadParkingSpotPhotos(spotId, assets));
}

export async function deleteParkingSpotPhoto(spotId: string, url: string): Promise<ParkingSpot> {
  return toParkingSpot(await apiDeleteParkingSpotPhoto(spotId, url));
}

export async function reorderParkingSpotPhotos(spotId: string, photos: string[]): Promise<ParkingSpot> {
  return toParkingSpot(await apiReorderParkingSpotPhotos(spotId, photos));
}

export interface UpdateParkingSpotInput {
  pricePerHour?: number;
  description?: string;
  covered?: boolean;
  schedule?: ScheduleEntry[];
  // The three go together: send all or none (see UpdateParkingSpotDto).
  address?: string;
  lat?: number;
  lng?: number;
}

export async function updateParkingSpot(
  id: string,
  updates: UpdateParkingSpotInput,
): Promise<ParkingSpot | undefined> {
  const raw = await apiUpdateParkingSpot(id, {
    pricePerHour: updates.pricePerHour,
    description: updates.description,
    covered: updates.covered,
    schedule: updates.schedule,
    address: updates.address,
    lat: updates.lat,
    lng: updates.lng,
  });
  return toParkingSpot(raw);
}
