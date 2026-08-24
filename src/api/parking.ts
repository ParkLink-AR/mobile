import { request } from './client';
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
