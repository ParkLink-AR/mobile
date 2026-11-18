import type { VehicleType } from '@/src/constants/vehicleTypes';
import type { SearchParkingSpotsFilters } from '@/src/services/parkingService';

/** Where the driver wants to park: an address they picked, or where they are. */
export interface SearchPlace {
  label: string;
  lat: number;
  lng: number;
}

/**
 * Lo que el conductor tiene que completar antes de ver el mapa: dónde (una dirección o su
 * ubicación), cuándo (un día con horas, o las fechas de una estadía) y con qué vehículo.
 */
export interface SearchRequest {
  place: SearchPlace | null;
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

export function isSearchRequestComplete(request: SearchRequest): boolean {
  if (!request.place || !request.vehicleType) return false;
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
