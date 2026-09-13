import { Platform } from 'react-native';
import { request, requestMultipart } from './client';
import { ScheduleEntry } from '@/src/types';
import { ReviewListApiResponse } from './booking';
import { VehicleType } from '@/src/constants/vehicleTypes';

// Shape returned by parking-service (see parking-spots.service.ts's
// ParkingSpotResponse) -- flattened lat/lng. rating/reviewCount are real
// aggregates parking-service fetches from booking-service's reviews table
// (0/0 when there are no reviews yet).
export interface ParkingSpotApiResponse {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  address: string;
  lat: number;
  lng: number;
  // null cuando hourlyEnabled es false -- ver ParkingSpot.hourlyEnabled en
  // parking-service.
  hourlyEnabled: boolean;
  pricePerHour: number | null;
  // No-null implica que pricePerHour no aplica -- el precio real depende de
  // qué tipo de vehículo elija el conductor. Ver ParkingSpot.pricePerHourByVehicleType
  // en parking-service.
  pricePerHourByVehicleType: Partial<Record<VehicleType, number>> | null;
  // "Estadía": alquiler por día/semana/mes en vez de por hora. Los precios
  // quedan en null cuando stayEnabled es false -- ver ParkingSpot.stayEnabled
  // en parking-service.
  stayEnabled: boolean;
  pricePerDay: number | null;
  pricePerWeek: number | null;
  pricePerMonth: number | null;
  stayAvailableFrom: string | null; // YYYY-MM-DD
  stayAvailableUntil: string | null; // YYYY-MM-DD
  maxStayDays: number | null;
  covered: boolean;
  vehicleTypes: VehicleType[];
  instantBooking: boolean;
  capacity: number;
  schedule: ScheduleEntry[];
  photos: string[];
  rules: string[];
  status: 'active' | 'paused' | 'deleted';
  createdAt: string;
  updatedAt: string;
  distanceMeters?: number;
  rating: number;
  reviewCount: number;
}

// Search always deals in resolved coordinates -- mobile geocodes a
// free-text query first (via GET /geocode, which shows every ambiguous
// match instead of guessing one) or uses device GPS, and only then searches.
export interface SearchParkingSpotsParams {
  lat: number;
  lng: number;
  radius?: number;
  maxPrice?: number;
  covered?: boolean;
  // Desired reservation window, ISO 8601 with offset. Go together: send
  // both or neither (see SearchParkingSpotDto). parking-service uses these
  // to filter out spots that are already booked for that window (see
  // ParkingSpotsService.search -> BookingClientService.getBookableSpotIds).
  from?: string;
  to?: string;
  // Sólo cocheras con la opción de estadía habilitada -- lo usa el buscador
  // cuando el conductor busca específicamente un lugar por día/semana/mes.
  stayOnly?: boolean;
  // Contraparte de stayOnly: sólo cocheras con alquiler por hora habilitado.
  // Mobile los trata como mutuamente excluyentes en su UI (elegir uno
  // deselecciona el otro), pero acá van sueltos -- el back no impone esa regla.
  hourlyOnly?: boolean;
  // Sólo cocheras con confirmación automática (sin esperar aprobación del dueño).
  instantBooking?: boolean;
}

// One candidate match for a free-text address query -- ambiguous street
// names (very common across Argentine cities) can resolve to several real
// places, so the caller shows all of them and lets the user pick the right
// one instead of the backend silently guessing.
export interface GeocodeCandidate {
  lat: number;
  lng: number;
  displayName: string;
  city?: string;
  postcode?: string;
}

export async function geocodeAddress(query: string): Promise<GeocodeCandidate[]> {
  return request(`/geocode?q=${encodeURIComponent(query)}`);
}

export interface ReverseGeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

// The inverse: device coordinates -> a readable address, used when
// publishing a spot with "use my current location" instead of typing one.
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  return request(`/geocode/reverse?lat=${lat}&lng=${lng}`);
}

// Campos de "estadía" comunes a create y update -- si stayEnabled es true,
// parking-service exige las tres tarifas y maxStayDays (ver
// CreateParkingSpotDto/UpdateParkingSpotDto ahí). stayAvailableFrom es
// opcional aun con stayEnabled=true: si no se manda, se interpreta "desde hoy".
interface StayFields {
  stayEnabled?: boolean;
  pricePerDay?: number;
  pricePerWeek?: number;
  pricePerMonth?: number;
  maxStayDays?: number;
  stayAvailableFrom?: string; // YYYY-MM-DD
  stayAvailableUntil?: string; // YYYY-MM-DD
}

export interface CreateParkingSpotInput extends StayFields {
  title: string;
  description?: string;
  address: string;
  lat: number;
  lng: number;
  // Default true si se omite (compatibilidad) -- ver ParkingSpot.hourlyEnabled.
  // pricePerHour es obligatorio salvo que se mande hourlyEnabled: false o
  // pricePerHourByVehicleType (uno de los dos, no ambos).
  hourlyEnabled?: boolean;
  pricePerHour?: number;
  pricePerHourByVehicleType?: Partial<Record<VehicleType, number>>;
  covered?: boolean;
  // Obligatorio y no vacío -- ver ParkingSpot.vehicleTypes en parking-service.
  vehicleTypes: VehicleType[];
  instantBooking?: boolean;
  // Lugares idénticos a alquilar contra el mismo id (playa). Omitido = 1.
  capacity?: number;
  schedule?: ScheduleEntry[];
  rules?: string[];
}

export interface UpdateParkingSpotApiInput extends StayFields {
  hourlyEnabled?: boolean;
  pricePerHour?: number;
  // `null` explícito borra el precio-por-vehículo y vuelve a pricePerHour
  // único -- ver UpdateParkingSpotDto en parking-service.
  pricePerHourByVehicleType?: Partial<Record<VehicleType, number>> | null;
  description?: string;
  covered?: boolean;
  vehicleTypes?: VehicleType[];
  instantBooking?: boolean;
  capacity?: number;
  schedule?: ScheduleEntry[];
  // The three go together: send all or none.
  address?: string;
  lat?: number;
  lng?: number;
}

export async function updateParkingSpot(
  id: string,
  input: UpdateParkingSpotApiInput,
): Promise<ParkingSpotApiResponse> {
  return request(`/parking-spots/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function updateParkingSpotStatus(
  id: string,
  status: 'active' | 'paused',
): Promise<ParkingSpotApiResponse> {
  return request(`/parking-spots/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

// Blocked with a 409 (ApiError) if the spot still has bookings that haven't
// finished -- the caller shows that message as-is.
export async function deleteParkingSpot(id: string): Promise<void> {
  await request(`/parking-spots/${id}`, { method: 'DELETE' });
}

export async function searchParkingSpots(
  params: SearchParkingSpotsParams
): Promise<ParkingSpotApiResponse[]> {
  const query = new URLSearchParams({
    lat: String(params.lat),
    lng: String(params.lng),
    ...(params.radius !== undefined ? { radius: String(params.radius) } : {}),
    ...(params.maxPrice !== undefined ? { maxPrice: String(params.maxPrice) } : {}),
    ...(params.covered !== undefined ? { covered: String(params.covered) } : {}),
    ...(params.from !== undefined ? { from: params.from } : {}),
    ...(params.to !== undefined ? { to: params.to } : {}),
    ...(params.stayOnly !== undefined ? { stayOnly: String(params.stayOnly) } : {}),
    ...(params.hourlyOnly !== undefined ? { hourlyOnly: String(params.hourlyOnly) } : {}),
    ...(params.instantBooking !== undefined ? { instantBooking: String(params.instantBooking) } : {}),
  });
  return request(`/parking-spots/search?${query.toString()}`);
}

export async function getParkingSpotDetail(id: string): Promise<ParkingSpotApiResponse> {
  return request(`/parking-spots/${id}`);
}

/**
 * Detalle de varias cocheras en un solo request (GET /parking-spots?ids=a,b,c)
 * -- usado por la lista de reservas del driver para resolver todos los
 * títulos de una sola vez en vez de un request por cochera. Cualquier id que
 * no exista o no esté ACTIVE/PAUSED simplemente no aparece en el array.
 */
export async function getParkingSpotsByIds(ids: string[]): Promise<ParkingSpotApiResponse[]> {
  if (ids.length === 0) return [];
  return request(`/parking-spots?ids=${ids.join(',')}`);
}

export async function getParkingSpotsForOwner(ownerId: string): Promise<ParkingSpotApiResponse[]> {
  return request(`/users/${ownerId}/parking-spots`);
}

export async function getFavoriteIds(): Promise<string[]> {
  return request('/favorites/ids');
}

export async function getFavoriteSpots(): Promise<ParkingSpotApiResponse[]> {
  return request('/favorites');
}

export async function addFavorite(parkingSpotId: string): Promise<void> {
  await request('/favorites', { method: 'POST', body: JSON.stringify({ parkingSpotId }) });
}

export async function removeFavorite(parkingSpotId: string): Promise<void> {
  await request(`/favorites/${parkingSpotId}`, { method: 'DELETE' });
}

export async function createParkingSpot(
  input: CreateParkingSpotInput
): Promise<ParkingSpotApiResponse> {
  return request('/parking-spots', { method: 'POST', body: JSON.stringify(input) });
}

export interface FreeWindow {
  start: string; // ISO 8601 with -03:00 offset
  end: string;
}

export interface DayAvailability {
  date: string; // YYYY-MM-DD
  status: 'closed' | 'full' | 'available';
  free_windows: FreeWindow[];
}

/**
 * Published schedule minus active bookings, per day in [from, to). from/to
 * are YYYY-MM-DD (date-only -- a different convention from
 * SearchParkingSpotsParams.from/to, which are full ISO datetimes).
 *
 * GET /parking-spots/{id}/availability
 */
// Hasta 10 fotos por cochera, la primera del array es la portada (ver
// ParkingSpotsService.MAX_PHOTOS en parking-service).
export interface ParkingSpotPhotoAsset {
  uri: string;
  name: string;
  type: string;
}

export async function uploadParkingSpotPhotos(
  spotId: string,
  assets: ParkingSpotPhotoAsset[],
): Promise<ParkingSpotApiResponse> {
  const formData = new FormData();
  for (const asset of assets) {
    if (Platform.OS === 'web') {
      // Same reasoning as uploadAvatar in api/auth.ts: react-native-web's
      // FormData needs a real Blob, not RN's {uri, name, type} shape.
      const blob = await (await fetch(asset.uri)).blob();
      formData.append('files', blob, asset.name);
    } else {
      formData.append('files', {
        uri: asset.uri,
        name: asset.name,
        type: asset.type,
      } as unknown as Blob);
    }
  }
  return requestMultipart<ParkingSpotApiResponse>(`/parking-spots/${spotId}/photos`, formData);
}

export async function deleteParkingSpotPhoto(spotId: string, url: string): Promise<ParkingSpotApiResponse> {
  return request(`/parking-spots/${spotId}/photos`, {
    method: 'DELETE',
    body: JSON.stringify({ url }),
  });
}

// `photos` es el array completo reordenado (mismo set, orden nuevo) --
// mover una foto al índice 0 la convierte en portada.
export async function reorderParkingSpotPhotos(
  spotId: string,
  photos: string[],
): Promise<ParkingSpotApiResponse> {
  return request(`/parking-spots/${spotId}/photos/order`, {
    method: 'PUT',
    body: JSON.stringify({ photos }),
  });
}

export async function getAvailability(
  parkingSpotId: string,
  from: string,
  to: string,
): Promise<{ days: DayAvailability[] }> {
  return request(`/parking-spots/${parkingSpotId}/availability?from=${from}&to=${to}`);
}

export async function getSpotReviewsApi(spotId: string): Promise<ReviewListApiResponse> {
  return request(`/parking-spots/${spotId}/reviews`);
}

export interface StayBreakdown {
  months: number;
  weeks: number;
  days: number;
}

export interface StayQuote {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  // RFC3339 con offset de Buenos Aires -- la hora de check-in elegida,
  // aplicada tanto al inicio como al fin (ver confirm-stay.tsx, que los usa
  // tal cual como start/end de la reserva).
  startDateTime: string;
  endDateTime: string;
  totalDays: number;
  // Cómo se descompuso totalDays para cobrar -- p.ej. 9 días = {weeks:1, days:2}.
  breakdown: StayBreakdown;
  // Centavos, mismo criterio que BookingApiResponse.amount (dividir por 100
  // para mostrar pesos -- ver getDriverVisiblePrice / cómo se usa en
  // booking/confirm.tsx).
  amount: number;
}

/**
 * Cotiza una estadía (rango de fechas + hora de check-in) para una cochera --
 * valida que la cochera acepte estadía, que el rango esté dentro de lo que
 * permite el dueño, y que no choque con otra reserva. Devuelve 400/404/409
 * (ApiError) si no es posible; el caller (spot/[id].tsx) muestra ese mensaje
 * tal cual.
 *
 * GET /parking-spots/{id}/stays/quote
 */
export async function getStayQuote(
  parkingSpotId: string,
  startDate: string,
  endDate: string,
  startHour: number,
): Promise<StayQuote> {
  const query = new URLSearchParams({ startDate, endDate, startHour: String(startHour) });
  return request(`/parking-spots/${parkingSpotId}/stays/quote?${query.toString()}`);
}

export interface StayDayAvailability {
  date: string; // YYYY-MM-DD
  status: 'available' | 'unavailable';
}

/**
 * Calendario de disponibilidad para elegir fecha de inicio/fin de estadía --
 * contraparte de getAvailability (horaria) para el otro modo de reserva. Es
 * una guía día por día (¿tiene ESE día alguna reserva encima?), no una
 * garantía para el rango completo que el conductor termine eligiendo -- el
 * chequeo real pasa en getStayQuote, con fecha de inicio, fin y hora de
 * check-in ya elegidas.
 *
 * GET /parking-spots/{id}/stays/availability
 */
export async function getStayAvailability(
  parkingSpotId: string,
  from: string,
  to: string,
): Promise<{ days: StayDayAvailability[] }> {
  const query = new URLSearchParams({ from, to });
  return request(`/parking-spots/${parkingSpotId}/stays/availability?${query.toString()}`);
}
