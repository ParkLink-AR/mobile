import { request } from './client';

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
  scheduleText: string | null;
  photos: string[];
  rules: string[];
  status: 'active' | 'paused' | 'deleted';
  createdAt: string;
  updatedAt: string;
  distanceMeters?: number;
}

export interface SearchParkingSpotsParams {
  lat: number;
  lng: number;
  radius?: number;
  maxPrice?: number;
  covered?: boolean;
}

export interface CreateParkingSpotInput {
  title: string;
  description?: string;
  address: string;
  pricePerHour: number;
  covered?: boolean;
  scheduleText?: string;
  rules?: string[];
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
