import { ParkingSpot, ScheduleEntry } from '@/src/types';
import { VehicleType } from '@/src/constants/vehicleTypes';
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
  updateParkingSpotStatus as apiUpdateParkingSpotStatus,
  uploadParkingSpotPhotos as apiUploadParkingSpotPhotos,
  deleteParkingSpotPhoto as apiDeleteParkingSpotPhoto,
  reorderParkingSpotPhotos as apiReorderParkingSpotPhotos,
} from '@/src/api/parking';
import { ApiError } from '@/src/api/client';
import { getDriverVisiblePrice } from './utils';

function toParkingSpot(raw: ParkingSpotApiResponse): ParkingSpot {
  return {
    id: raw.id,
    ownerId: raw.ownerId,
    title: raw.title,
    address: raw.address,
    lat: raw.lat,
    lng: raw.lng,
    hourlyEnabled: raw.hourlyEnabled,
    pricePerHour: raw.pricePerHour,
    // '' significa "sin foto" -- ParkingSpotCard/PhotoGallery muestran un
    // placeholder propio en vez de pedirle una imagen a una URI vacía.
    photoUrl: raw.photos[0] ?? '',
    photos: raw.photos,
    covered: raw.covered,
    vehicleTypes: raw.vehicleTypes,
    capacity: raw.capacity ?? 1,
    stayEnabled: raw.stayEnabled,
    pricePerDay: raw.pricePerDay,
    pricePerWeek: raw.pricePerWeek,
    pricePerMonth: raw.pricePerMonth,
    stayAvailableFrom: raw.stayAvailableFrom,
    stayAvailableUntil: raw.stayAvailableUntil,
    maxStayDays: raw.maxStayDays,
    rating: raw.rating,
    reviewCount: raw.reviewCount,
    tags: raw.covered ? ['Cubierta'] : ['Descubierta'],
    schedule: raw.schedule,
    distanceMeters: raw.distanceMeters ?? 0,
    description: raw.description ?? '',
    active: raw.status === 'active',
    instantBooking: raw.instantBooking,
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
  // Sólo cocheras con "estadía" habilitada (día/semana/mes) -- ver ParkingSpot.stayEnabled.
  stayOnly?: boolean;
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
    stayOnly: filters.stayOnly,
  });
  const spots = results.map(toParkingSpot);
  if (filters.minPrice === undefined) return spots;
  // Una cochera "solo estadía" no tiene pricePerHour -- no aplica al filtro
  // de precio por hora, se excluye igual que ya hace maxPrice del lado del backend.
  return spots.filter((s) => s.pricePerHour !== null && getDriverVisiblePrice(s.pricePerHour) >= filters.minPrice!);
}

export async function getParkingSpotDetail(id: string): Promise<ParkingSpot | undefined> {
  let raw: ParkingSpotApiResponse;
  try {
    raw = await apiGetParkingSpotDetail(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return undefined;
    throw err;
  }

  return toParkingSpot(raw);
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
  // Obligatorio y no vacío -- ver ParkingSpot.vehicleTypes en parking-service.
  vehicleTypes: VehicleType[];
  instantBooking: boolean;
  // Lugares idénticos a alquilar contra el mismo id (playa). Omitido = 1.
  capacity?: number;
  // Default true si se omite -- ver ParkingSpot.hourlyEnabled. pricePerHour
  // es obligatorio salvo que se mande hourlyEnabled: false.
  hourlyEnabled?: boolean;
  pricePerHour?: number;
  schedule?: ScheduleEntry[];
  description?: string;
  // "Estadía" -- ver el comentario en ParkingSpot.stayEnabled. Si
  // stayEnabled es true, parking-service exige las tres tarifas y
  // maxStayDays (stayAvailableFrom es opcional).
  stayEnabled?: boolean;
  pricePerDay?: number;
  pricePerWeek?: number;
  pricePerMonth?: number;
  maxStayDays?: number;
  stayAvailableFrom?: string;
  stayAvailableUntil?: string;
}

export async function createParkingSpot(input: CreateParkingSpotInput): Promise<ParkingSpot> {
  const raw = await apiCreateParkingSpot({
    title: input.title,
    address: input.address,
    lat: input.lat,
    lng: input.lng,
    hourlyEnabled: input.hourlyEnabled,
    pricePerHour: input.pricePerHour,
    covered: input.covered,
    vehicleTypes: input.vehicleTypes,
    instantBooking: input.instantBooking,
    capacity: input.capacity,
    schedule: input.schedule,
    description: input.description,
    stayEnabled: input.stayEnabled,
    pricePerDay: input.pricePerDay,
    pricePerWeek: input.pricePerWeek,
    pricePerMonth: input.pricePerMonth,
    maxStayDays: input.maxStayDays,
    stayAvailableFrom: input.stayAvailableFrom,
    stayAvailableUntil: input.stayAvailableUntil,
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
  hourlyEnabled?: boolean;
  pricePerHour?: number;
  description?: string;
  covered?: boolean;
  vehicleTypes?: VehicleType[];
  instantBooking?: boolean;
  capacity?: number;
  schedule?: ScheduleEntry[];
  // The three go together: send all or none (see UpdateParkingSpotDto).
  address?: string;
  lat?: number;
  lng?: number;
  // "Estadía" -- cada campo es independiente (PATCH parcial), ver el
  // comentario en UpdateParkingSpotApiInput/ParkingSpotsService.update.
  stayEnabled?: boolean;
  pricePerDay?: number;
  pricePerWeek?: number;
  pricePerMonth?: number;
  maxStayDays?: number;
  stayAvailableFrom?: string;
  stayAvailableUntil?: string;
}

export async function updateParkingSpot(
  id: string,
  updates: UpdateParkingSpotInput,
): Promise<ParkingSpot | undefined> {
  const raw = await apiUpdateParkingSpot(id, {
    hourlyEnabled: updates.hourlyEnabled,
    pricePerHour: updates.pricePerHour,
    description: updates.description,
    covered: updates.covered,
    vehicleTypes: updates.vehicleTypes,
    instantBooking: updates.instantBooking,
    capacity: updates.capacity,
    schedule: updates.schedule,
    address: updates.address,
    lat: updates.lat,
    lng: updates.lng,
    stayEnabled: updates.stayEnabled,
    pricePerDay: updates.pricePerDay,
    pricePerWeek: updates.pricePerWeek,
    pricePerMonth: updates.pricePerMonth,
    maxStayDays: updates.maxStayDays,
    stayAvailableFrom: updates.stayAvailableFrom,
    stayAvailableUntil: updates.stayAvailableUntil,
  });
  return toParkingSpot(raw);
}

export async function updateParkingSpotStatus(
  id: string,
  status: 'active' | 'paused',
): Promise<ParkingSpot> {
  const raw = await apiUpdateParkingSpotStatus(id, status);
  return toParkingSpot(raw);
}

export { deleteParkingSpot } from '@/src/api/parking';
