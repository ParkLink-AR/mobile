import type { VehicleType } from '@/src/constants/vehicleTypes';
import type { SearchParkingSpotsFilters } from '@/src/services/parkingService';

/**
 * Lo que el conductor tiene que completar antes de ver el mapa: dónde (provincia o CABA),
 * cuándo (un día con horas, o las fechas de una estadía) y con qué tipo de vehículo.
 */
export interface SearchRequest {
  provinceId: string;
  mode: 'hourly' | 'stay';
  // mode 'hourly': YYYY-MM-DD + franja horaria (toHour 24 = medianoche).
  date: string;
  fromHour: number;
  toHour: number;
  // mode 'stay': check-in y check-out, YYYY-MM-DD.
  stayFrom: string;
  stayTo: string;
  // Hora de entrada (check-in) de la estadía.
  stayHour: number;
  vehicleType: VehicleType | null;
  // El vehículo guardado elegido, si lo hay (sólo para marcar su chip).
  vehicleId: string | null;
}

export const CABA_ID = 'caba';

interface Province {
  id: string;
  name: string;
  // Cómo puede aparecer en el texto de una dirección (sin tildes, en minúsculas).
  aliases: string[];
  // Centro de la búsqueda: la capital de la provincia.
  lat: number;
  lng: number;
}

export const PROVINCES: Province[] = [
  { id: CABA_ID, name: 'CABA', aliases: ['caba', 'ciudad autonoma de buenos aires', 'capital federal'], lat: -34.6037, lng: -58.3816 },
  { id: 'buenos-aires', name: 'PBA', aliases: ['buenos aires'], lat: -34.9205, lng: -57.9536 },
  { id: 'cordoba', name: 'Córdoba', aliases: ['cordoba'], lat: -31.4201, lng: -64.1888 },
];

export function findProvince(id: string): Province | undefined {
  return PROVINCES.find((province) => province.id === id);
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^provincia de /, '')
    .trim();
}

/**
 * Whether a spot's address ("calle número, barrio, ciudad, provincia, cp, país") is in the
 * province. The first part is the street, left out so "Av. Santa Fe 3245" or "Córdoba 1500"
 * don't count as being in Santa Fe or Córdoba. CABA addresses also say "Buenos Aires" (the
 * city), so they're never matched to the province of that name.
 */
export function addressInProvince(address: string, provinceId: string): boolean {
  const province = findProvince(provinceId);
  if (!province) return false;
  const parts = address.split(',').slice(1).map(normalize);
  const inCaba = parts.some((part) => PROVINCES[0].aliases.includes(part));
  if (provinceId === CABA_ID) return inCaba;
  if (inCaba) return false;
  return parts.some((part) => province.aliases.includes(part));
}

export function isSearchRequestComplete(request: SearchRequest): boolean {
  if (!request.provinceId || !request.vehicleType) return false;
  if (request.mode === 'stay') return !!request.stayFrom && !!request.stayTo && request.stayTo > request.stayFrom;
  return !!request.date && request.toHour > request.fromHour;
}

/** The search filters a completed request stands for. */
export function requestToFilters(request: SearchRequest): SearchParkingSpotsFilters {
  const common = {
    vehicleType: request.vehicleType ?? undefined,
    vehicleId: request.vehicleId ?? undefined,
  };
  if (request.mode === 'stay') {
    return { ...common, stayOnly: true, stayFrom: request.stayFrom, stayTo: request.stayTo, stayHour: request.stayHour };
  }
  return { ...common, hourlyOnly: true, date: request.date, fromHour: request.fromHour, toHour: request.toHour };
}

/** The route params that carry a search to the spot's detail, so it doesn't ask again. */
export function searchParams(request: SearchRequest): Record<string, string> {
  const vehicle: Record<string, string> = request.vehicleType ? { vehicleType: request.vehicleType } : {};
  if (request.mode === 'stay') {
    return { searchMode: 'stay', searchStayFrom: request.stayFrom,
      searchStayTo: request.stayTo,
      searchStayHour: String(request.stayHour),
      ...vehicle };
  }
  return {
    searchMode: 'hourly',
    searchDate: request.date,
    searchFrom: String(request.fromHour),
    searchTo: String(request.toHour),
    ...vehicle,
  };
}
