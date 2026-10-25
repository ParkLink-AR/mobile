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
  SearchSort,
} from '@/src/api/parking';
import { ApiError } from '@/src/api/client';
import { todayArtDateISO } from './dateUtils';

/** Whether the weekly hours cover every day from 00:00 to 24:00 -- shown as "Acceso 24/7". */
export function isOpenAroundTheClock(schedule: ScheduleEntry[]): boolean {
  for (let day = 0; day < 7; day++) {
    const windows = schedule
      .filter((entry) => entry.dayOfWeek === day)
      .sort((a, b) => a.startHour - b.startHour);
    let reached = 0;
    for (const entry of windows) {
      if (entry.startHour > reached) break;
      reached = Math.max(reached, entry.endHour);
    }
    if (reached < 24) return false;
  }
  return true;
}

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
    halfDayEnabled: raw.stayEnabled === true && raw.halfDayEnabled === true,
    pricePerHalfDay: raw.stayEnabled === true && raw.halfDayEnabled === true ? (raw.pricePerHalfDay ?? null) : null,
    requireVehicle: raw.requireVehicle ?? false,
    rating: raw.rating,
    reviewCount: raw.reviewCount,
    tags: [raw.covered ? 'covered' : 'uncovered', ...(raw.hourlyEnabled && isOpenAroundTheClock(raw.schedule) ? ['access247'] : [])],
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
export function spotNeedsVehicle(spot: ParkingSpot, mode: 'hourly' | 'stay' | 'halfDay'): boolean {
  if (spot.requireVehicle) return true;
  // A half-day is priced from the stay rates, so it depends on the vehicle when they do.
  return mode === 'hourly' ? !!spot.pricePerHourByVehicleType : !!spot.stayPricesByVehicleType;
}

/** The 12-hour price of a half-day for a vehicle type -- its own when the spot prices its
 * stays per vehicle, otherwise the one for everyone. null when the spot doesn't offer it (or,
 * pricing per vehicle, when no vehicle was picked yet). Owner's own price, in pesos. */
export function getHalfDayRate(spot: ParkingSpot, vehicleType: VehicleType | null): number | null {
  if (!spot.halfDayEnabled) return null;
  if (spot.stayPricesByVehicleType) {
    return vehicleType ? spot.stayPricesByVehicleType[vehicleType]?.halfDay ?? null : null;
  }
  return spot.pricePerHalfDay;
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
  // What the driver pays (commission included), per hour -- or per day when looking for
  // stays -- at their vehicle's rate when vehicleType is set.
  minPrice?: number;
  maxPrice?: number;
  covered?: boolean;
  maxDistanceMeters?: number;
  // Only spots that take this vehicle; prices are then that vehicle's.
  vehicleType?: VehicleType;
  // The saved vehicle it was picked from, if any -- only for the filter's label, never sent.
  vehicleId?: string;
  // Only spots rated at least this many stars.
  minRating?: number;
  // Desired reservation window -- date (YYYY-MM-DD, ART) + hour range.
  // Go together: both hours or neither. `date` alone (sin fromHour/toHour)
  // se ignora. undefined = hoy. toHour 24 = medianoche.
  date?: string;
  fromHour?: number;
  toHour?: number;
  // "Disponible ahora": libre desde este momento durante las próximas AVAILABLE_NOW_HOURS.
  // Excluye la franja de arriba.
  availableNow?: boolean;
  // Sólo cocheras con "estadía" habilitada (día/semana/mes) -- ver ParkingSpot.stayEnabled.
  stayOnly?: boolean;
  // Con stayOnly: check-in y check-out (YYYY-MM-DD). Van juntos.
  stayFrom?: string;
  stayTo?: string;
  // Contraparte de stayOnly -- sólo cocheras con alquiler por hora habilitado.
  // Mobile los trata como mutuamente excluyentes en la UI del buscador.
  hourlyOnly?: boolean;
  // Sólo cocheras con media estadía (12 h) -- excluyente con stayOnly/hourlyOnly. Con un
  // horario (fromHour, o availableNow) es la hora de entrada: las 12 horas desde ahí tienen
  // que estar libres; toHour no se usa. Los precios pasan a ser los de 12 horas.
  halfDayOnly?: boolean;
  // Cómo ordenar los resultados -- el servidor los devuelve ya ordenados.
  sort?: SearchSort;
}

/** How long a half-day ("media estadía") lasts -- the same 12 hours parking-service books. */
export const HALF_DAY_HOURS = 12;

/** How long "Disponible ahora" asks a spot to be free for, from this moment. */
export const AVAILABLE_NOW_HOURS = 2;

/**
 * A price the driver typed (commission included) in the owner's own rates, which is what
 * parking-service compares. getDriverVisiblePrice rounds, so the bound is widened by half a
 * peso: a spot the driver sees at exactly their limit still counts.
 */
export function toOwnerPrice(driverPrice: number, ratePercent: number, bound: 'min' | 'max'): number {
  const edge = bound === 'max' ? driverPrice + 0.5 : Math.max(0, driverPrice - 0.5);
  return edge / (1 + ratePercent / 100);
}

/**
 * The price to show for a spot in the results, in the owner's rates: per hour -- or per day
 * when looking for stays, or when it only offers stays, and per 12 hours when looking for
 * half-days -- at the driver's vehicle's rate when
 * one was chosen. `from` when it varies by vehicle and none was chosen ("desde $X").
 */
export function spotListPrice(
  spot: ParkingSpot,
  { stays = false, halfDay = false, vehicleType }: { stays?: boolean; halfDay?: boolean; vehicleType?: VehicleType } = {},
): { amount: number; unit: 'hour' | 'day' | 'halfDay'; from: boolean } | null {
  if (halfDay) {
    if (!spot.halfDayEnabled) return null;
    const byVehicle = spot.stayPricesByVehicleType;
    if (byVehicle && vehicleType) {
      const amount = byVehicle[vehicleType]?.halfDay;
      return amount !== undefined ? { amount, unit: 'halfDay', from: false } : null;
    }
    const prices = [spot.pricePerHalfDay, ...Object.values(byVehicle ?? {}).map((rates) => rates?.halfDay)]
      .filter((v): v is number => typeof v === 'number' && v > 0);
    return prices.length > 0 ? { amount: Math.min(...prices), unit: 'halfDay', from: !!byVehicle } : null;
  }
  if (!stays && spot.hourlyEnabled) {
    const byVehicle = spot.pricePerHourByVehicleType;
    const amount = vehicleType ? getSpotPricePerHour(spot, vehicleType) : getMinPricePerHour(spot);
    return amount !== null ? { amount, unit: 'hour', from: !!byVehicle && !vehicleType } : null;
  }
  if (!spot.stayEnabled) return null;
  const byVehicle = spot.stayPricesByVehicleType;
  if (byVehicle && vehicleType) {
    const amount = byVehicle[vehicleType]?.day;
    return amount !== undefined ? { amount, unit: 'day', from: false } : null;
  }
  const days = [spot.pricePerDay, ...Object.values(byVehicle ?? {}).map((rates) => rates?.day)]
    .filter((v): v is number => typeof v === 'number' && v > 0);
  return days.length > 0 ? { amount: Math.min(...days), unit: 'day', from: !!byVehicle } : null;
}

// Builds an ISO 8601 datetime for `hour` on `dateISO` (YYYY-MM-DD), with a
// fixed -03:00 offset (same assumption the backend makes everywhere else --
// Buenos Aires has no DST) rather than the device's own timezone, which may
// not be ART.
export function toISODateTime(dateISO: string, hour: number): string {
  if (hour >= 24) {
    // 24:00 is the next day's midnight -- written that way, since not every parser takes "T24:00".
    const [year, month, day] = dateISO.split('-').map(Number);
    const next = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
    return toISODateTime(next, hour - 24);
  }
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
  let from: string | undefined;
  let to: string | undefined;
  if (filters.availableNow) {
    const now = new Date();
    from = now.toISOString();
    to = new Date(now.getTime() + AVAILABLE_NOW_HOURS * 60 * 60 * 1000).toISOString();
  } else if (filters.fromHour !== undefined && filters.toHour !== undefined) {
    from = toISODateTime(dateISO, filters.fromHour);
    to = toISODateTime(dateISO, filters.toHour);
  }
  const halfDay = filters.halfDayOnly === true;
  if (halfDay && from !== undefined) {
    // A half-day is the 12 hours from its start hour, whatever "until" the filter had.
    to = new Date(new Date(from).getTime() + HALF_DAY_HOURS * 60 * 60 * 1000).toISOString();
  }
  const stays = !halfDay && filters.stayOnly === true;
  const results = await apiSearchParkingSpots({
    lat: filters.lat,
    lng: filters.lng,
    radius: filters.maxDistanceMeters,
    minPrice: filters.minPrice !== undefined ? toOwnerPrice(filters.minPrice, commissionRatePercent, 'min') : undefined,
    maxPrice: filters.maxPrice !== undefined ? toOwnerPrice(filters.maxPrice, commissionRatePercent, 'max') : undefined,
    covered: filters.covered,
    vehicleType: filters.vehicleType,
    minRating: filters.minRating,
    from: stays ? undefined : from,
    to: stays ? undefined : to,
    stayOnly: stays ? filters.stayOnly : undefined,
    stayFrom: stays ? filters.stayFrom : undefined,
    stayTo: stays ? filters.stayTo : undefined,
    hourlyOnly: halfDay ? undefined : filters.hourlyOnly,
    halfDayOnly: halfDay || undefined,
    sort: filters.sort,
  });
  return results.map(toParkingSpot);
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
  // Cómo entrar -- privado (sólo el conductor de una reserva aceptada).
  accessInstructions?: string;
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
  // "Media estadía (12 h)", only with the stay; its price here or per vehicle above.
  halfDayEnabled?: boolean;
  pricePerHalfDay?: number;
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
    accessInstructions: input.accessInstructions,
    stayEnabled: input.stayEnabled,
    pricePerDay: input.pricePerDay,
    pricePerWeek: input.pricePerWeek,
    pricePerMonth: input.pricePerMonth,
    maxStayDays: input.maxStayDays,
    stayAvailableFrom: input.stayAvailableFrom,
    stayAvailableUntil: input.stayAvailableUntil,
    stayPricesByVehicleType: input.stayPricesByVehicleType,
    halfDayEnabled: input.halfDayEnabled,
    pricePerHalfDay: input.pricePerHalfDay,
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
  halfDayEnabled?: boolean;
  pricePerHalfDay?: number;
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
    halfDayEnabled: updates.halfDayEnabled,
    pricePerHalfDay: updates.pricePerHalfDay,
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
