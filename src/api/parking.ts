import { Platform } from 'react-native';
import { request, requestMultipart } from './client';
import { ScheduleEntry } from '@/src/types';

// Shape returned by parking-service (see parking-spots.service.ts's
// ParkingSpotResponse) -- flattened lat/lng, no rating/reviews/tags yet
// since booking/reviews aren't wired up.
export interface ParkingSpotApiResponse {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  address: string;
  lat: number;
  lng: number;
  pricePerHour: number;
  covered: boolean;
  schedule: ScheduleEntry[];
  photos: string[];
  rules: string[];
  status: 'active' | 'paused' | 'deleted';
  createdAt: string;
  updatedAt: string;
  distanceMeters?: number;
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
  // both or neither (see SearchParkingSpotDto). Declared for the contract
  // only -- parking-service doesn't filter by them yet.
  from?: string;
  to?: string;
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

export interface CreateParkingSpotInput {
  title: string;
  description?: string;
  address: string;
  lat: number;
  lng: number;
  pricePerHour: number;
  covered?: boolean;
  schedule?: ScheduleEntry[];
  rules?: string[];
}

export interface UpdateParkingSpotApiInput {
  pricePerHour?: number;
  description?: string;
  covered?: boolean;
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
  });
  return request(`/parking-spots/search?${query.toString()}`);
}

export async function getParkingSpotDetail(id: string): Promise<ParkingSpotApiResponse> {
  return request(`/parking-spots/${id}`);
}

export async function getParkingSpotsForOwner(ownerId: string): Promise<ParkingSpotApiResponse[]> {
  return request(`/users/${ownerId}/parking-spots`);
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
