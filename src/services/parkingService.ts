import { ParkingSpot, ScheduleEntry, StayRates, Vehicle } from '@/src/types';
import { BICYCLE, VEHICLE_TYPES, VehicleType } from '@/src/constants/vehicleTypes';
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
import { todayArtDateISO } from './dateUtils';

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
    pricePerHourByVehicleType: raw.pricePerHourByVehicleType,
    // '' significa "sin foto" -- ParkingSpotCard/PhotoGallery muestran un
    // placeholder propio en vez de pedirle una imagen a una URI vacía.
    photoUrl: raw.photos[0] ?? '',
    photos: raw.photos,
    covered: raw.covered,
    // Always in the same order (car first), whatever order the owner ticked them in.
    vehicleTypes: VEHICLE_TYPES.filter((vt) => raw.vehicleTypes.includes(vt)),
    capacity: raw.capacity ?? 1,
    stayEnabled: raw.stayEnabled,
    pricePerDay: raw.pricePerDay,
    pricePerWeek: raw.pricePerWeek,
    pricePerMonth: raw.pricePerMonth,
    stayAvailableFrom: raw.stayAvailableFrom,
    stayAvailableUntil: raw.stayAvailableUntil,
    maxStayDays: raw.maxStayDays,
    stayPricesByVehicleType: raw.stayPricesByVehicleType ?? null,
    requireVehicle: raw.requireVehicle ?? false,
    rating: raw.rating,
    reviewCount: raw.reviewCount,
    tags: raw.covered ? ['Cubierta'] : ['Descubierta'],
    schedule: raw.schedule,
    distanceMeters: raw.distanceMeters ?? 0,
    description: raw.description ?? '',
    active: raw.status === 'active',
    status: raw.status,
    verificationPhotos: raw.verificationPhotos ?? [],
    reviewNotes: raw.reviewNotes ?? null,
    suspendedByAdmin: raw.suspendedByAdmin ?? false,
    moderationNote: raw.moderationNote ?? null,
    blockedDates: raw.blockedDates ?? [],
  };
}

/**
 * Precio por hora efectivo para un tipo de vehículo dado -- resuelve el
 * override por vehículo cuando el dueño lo cargó, si no cae al pricePerHour
 * único. null si esa cochera no tiene precio por hora para ese vehículo en
 * particular (no debería pasar una vez elegido un vehicleType que la
 * cochera acepta, pero cubre una pantalla de detalle desactualizada si el
 * dueño cambió vehicleTypes mientras tanto).
 */
export function getSpotPricePerHour(spot: ParkingSpot, vehicleType: VehicleType): number | null {
  if (spot.pricePerHourByVehicleType) {
    return spot.pricePerHourByVehicleType[vehicleType] ?? null;
  }
  return spot.pricePerHour;
}

/**
 * La tarifa por hora más baja entre los tipos de vehículo aceptados -- para
 * mostrar un precio representativo ("desde $X") donde todavía no se eligió
 * un vehículo (resultados de búsqueda, preview del mapa, tarjetas de lista).
 */
export function getMinPricePerHour(spot: ParkingSpot): number | null {
  if (spot.pricePerHourByVehicleType) {
    const values = Object.values(spot.pricePerHourByVehicleType).filter(
      (v): v is number => typeof v === 'number',
    );
    return values.length > 0 ? Math.min(...values) : null;
  }
  return spot.pricePerHour;
}

/**
 * Si una reserva de este modo tiene que decir con qué vehículo va el conductor: cuando el
 * dueño lo pide ("Pedir el vehículo al reservar") o cuando el precio de ese modo depende
 * del tipo de vehículo -- es como se sabe qué tarifa cobrar. Misma regla que
 * booking-service (Service.checkVehicle), que la vuelve a exigir al crear la reserva.
 */
export function spotNeedsVehicle(spot: ParkingSpot, mode: 'hourly' | 'stay'): boolean {
  if (spot.requireVehicle) return true;
  return mode === 'stay' ? !!spot.stayPricesByVehicleType : !!spot.pricePerHourByVehicleType;
}

/** Las tarifas de estadía para un tipo de vehículo -- las suyas si la cochera cobra por
 * vehículo, si no las mismas para todos. null si no tiene estadía para ese tipo. */
export function getStayRates(spot: ParkingSpot, vehicleType: VehicleType | null): StayRates | null {
  if (spot.stayPricesByVehicleType) {
    return vehicleType ? spot.stayPricesByVehicleType[vehicleType] ?? null : null;
  }
  if (spot.pricePerDay === null || spot.pricePerWeek === null || spot.pricePerMonth === null) return null;
  return { day: spot.pricePerDay, week: spot.pricePerWeek, month: spot.pricePerMonth };
}

/** Si un vehículo guardado sirve para reservar esta cochera: que la cochera acepte su tipo,
 * y -- si la cochera pide el vehículo -- que tenga patente (salvo una bici). Un vehículo
 * guardado antes de que existieran los tipos no sirve hasta que se le complete el tipo. */
export function vehicleFitsSpot(vehicle: Vehicle, spot: ParkingSpot, needsVehicle: boolean): boolean {
  if (!vehicle.type || !spot.vehicleTypes.includes(vehicle.type)) return false;
  return !needsVehicle || vehicle.type === BICYCLE || !!vehicle.plate;
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
  /** The days this line covers, 0 = Monday ... 6 = Sunday (inclusive). */
  firstDay: number;
  lastDay: number;
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
    lines.push({ dayRange, hours: perDayLabel[rangeStart], firstDay: rangeStart, lastDay: rangeEnd });
    rangeStart = day;
  }
  return lines;
}

export interface SearchParkingSpotsFilters {
  minPrice?: number;
  maxPrice?: number;
  covered?: boolean;
  maxDistanceMeters?: number;
  // Desired reservation window -- date (YYYY-MM-DD, ART) + hour range.
  // Go together: both hours or neither. `date` alone (sin fromHour/toHour)
  // se ignora -- sin franja horaria no hay nada que pedirle a
  // BookingClientService.getBookableSpotIds. undefined = hoy.
  date?: string;
  fromHour?: number;
  toHour?: number;
  // Sólo cocheras con "estadía" habilitada (día/semana/mes) -- ver ParkingSpot.stayEnabled.
  stayOnly?: boolean;
  // Contraparte de stayOnly -- sólo cocheras con alquiler por hora habilitado.
  // Mobile los trata como mutuamente excluyentes en la UI del buscador.
  hourlyOnly?: boolean;
}

// Builds an ISO 8601 datetime for `hour` on `dateISO` (YYYY-MM-DD), with a
// fixed -03:00 offset (same assumption the backend makes everywhere else --
// Buenos Aires has no DST) rather than the device's own timezone, which may
// not be ART.
export function toISODateTime(dateISO: string, hour: number): string {
  const paddedHour = String(hour).padStart(2, '0');
  return `${dateISO}T${paddedHour}:00:00-03:00`;
}

/** Same as toISODateTime, but for today (ART) -- used wherever there's no date picker. */
export function toISOToday(hour: number): string {
  return toISODateTime(todayArtDateISO(), hour);
}

export async function searchParkingSpots(
  filters: SearchParkingSpotsFilters & { lat: number; lng: number },
  commissionRatePercent: number
): Promise<ParkingSpot[]> {
  const dateISO = filters.date ?? todayArtDateISO();
  const results = await apiSearchParkingSpots({
    lat: filters.lat,
    lng: filters.lng,
    radius: filters.maxDistanceMeters,
    maxPrice: filters.maxPrice,
    covered: filters.covered,
    from: filters.fromHour !== undefined ? toISODateTime(dateISO, filters.fromHour) : undefined,
    to: filters.toHour !== undefined ? toISODateTime(dateISO, filters.toHour) : undefined,
    stayOnly: filters.stayOnly,
    hourlyOnly: filters.hourlyOnly,
  });
  const spots = results.map(toParkingSpot);
  if (filters.minPrice === undefined) return spots;
  // Una cochera "solo estadía" no tiene pricePerHour -- no aplica al filtro
  // de precio por hora, se excluye igual que ya hace maxPrice del lado del backend.
  // Cuando el precio varía por vehículo se compara contra la tarifa más
  // baja, mismo criterio que el maxPrice de parking-service.
  return spots.filter((s) => {
    const price = getMinPricePerHour(s);
    return price !== null && getDriverVisiblePrice(price, commissionRatePercent) >= filters.minPrice!;
  });
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
  // Lugares idénticos a alquilar contra el mismo id (playa). Omitido = 1.
  capacity?: number;
  // Default true si se omite -- ver ParkingSpot.hourlyEnabled. pricePerHour
  // es obligatorio salvo que se mande hourlyEnabled: false.
  hourlyEnabled?: boolean;
  pricePerHour?: number;
  pricePerHourByVehicleType?: Partial<Record<VehicleType, number>>;
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
  // Tarifas de estadía por tipo de vehículo, en vez de las tres de arriba.
  stayPricesByVehicleType?: Partial<Record<VehicleType, StayRates>>;
  // "Pedir el vehículo al reservar".
  requireVehicle?: boolean;
}

export async function createParkingSpot(input: CreateParkingSpotInput): Promise<ParkingSpot> {
  const raw = await apiCreateParkingSpot({
    title: input.title,
    address: input.address,
    lat: input.lat,
    lng: input.lng,
    hourlyEnabled: input.hourlyEnabled,
    pricePerHour: input.pricePerHour,
    pricePerHourByVehicleType: input.pricePerHourByVehicleType,
    covered: input.covered,
    vehicleTypes: input.vehicleTypes,
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
    stayPricesByVehicleType: input.stayPricesByVehicleType,
    requireVehicle: input.requireVehicle,
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
  // Cómo entrar -- privado. "" lo borra.
  accessInstructions?: string;
  hourlyEnabled?: boolean;
  pricePerHour?: number;
  // `null` explícito borra el precio-por-vehículo y vuelve a pricePerHour
  // único -- ver UpdateParkingSpotApiInput.
  pricePerHourByVehicleType?: Partial<Record<VehicleType, number>> | null;
  title?: string;
  description?: string;
  covered?: boolean;
  vehicleTypes?: VehicleType[];
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
  // `null` explícito vuelve a las mismas tarifas de estadía para todos.
  stayPricesByVehicleType?: Partial<Record<VehicleType, StayRates>> | null;
  requireVehicle?: boolean;
}

export async function updateParkingSpot(
  id: string,
  updates: UpdateParkingSpotInput,
): Promise<ParkingSpot | undefined> {
  const raw = await apiUpdateParkingSpot(id, {
    hourlyEnabled: updates.hourlyEnabled,
    pricePerHour: updates.pricePerHour,
    pricePerHourByVehicleType: updates.pricePerHourByVehicleType,
    title: updates.title,
    description: updates.description,
    accessInstructions: updates.accessInstructions,
    covered: updates.covered,
    vehicleTypes: updates.vehicleTypes,
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
    stayPricesByVehicleType: updates.stayPricesByVehicleType,
    requireVehicle: updates.requireVehicle,
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
