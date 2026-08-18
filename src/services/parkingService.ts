import { ParkingSpot } from '@/src/types';
import { getMockParkingSpots } from '@/src/mocks/parkingSpots';
import { delay, getDriverVisiblePrice } from './utils';
import { t } from '@/src/i18n';

const GATEWAY_URL = process.env.EXPO_PUBLIC_GATEWAY_URL ?? '';

let extraSpots: ParkingSpot[] = [];
let nextSpotId = getMockParkingSpots().length + 1;

function getAllSpots(): ParkingSpot[] {
  return [...getMockParkingSpots(), ...extraSpots];
}

export interface SearchParkingSpotsFilters {
  minPrice?: number;
  maxPrice?: number;
  covered?: boolean;
  maxDistanceMeters?: number;
  startHour?: number;
  endHour?: number;
}

export async function searchParkingSpots(
  filters: SearchParkingSpotsFilters = {}
): Promise<ParkingSpot[]> {
  let results = getAllSpots().filter((s) => s.active);
  if (filters.minPrice !== undefined) {
    results = results.filter((s) => getDriverVisiblePrice(s.pricePerHour) >= filters.minPrice!);
  }
  if (filters.maxPrice !== undefined) {
    results = results.filter((s) => getDriverVisiblePrice(s.pricePerHour) <= filters.maxPrice!);
  }
  if (filters.covered !== undefined) {
    results = results.filter((s) => s.covered === filters.covered);
  }
  if (filters.maxDistanceMeters !== undefined) {
    results = results.filter((s) => s.distanceMeters <= filters.maxDistanceMeters!);
  }
  if (filters.startHour !== undefined && filters.endHour !== undefined) {
    results = results.filter(
      (s) => s.scheduleStartHour <= filters.startHour! && s.scheduleEndHour >= filters.endHour!
    );
  }
  return delay(results);
}

export async function getParkingSpotDetail(
  id: string
): Promise<ParkingSpot | undefined> {
  return delay(getAllSpots().find((s) => s.id === id));
}

export async function getParkingSpotsForOwner(ownerId: string): Promise<ParkingSpot[]> {
  return delay(getAllSpots().filter((s) => s.ownerId === ownerId));
}

export interface CreateParkingSpotInput {
  title: string;
  ownerId: string;
  address: string;
  covered: boolean;
  pricePerHour: number;
  schedule?: string;
  scheduleStartHour?: number;
  scheduleEndHour?: number;
  description?: string;
}

export async function createParkingSpot(input: CreateParkingSpotInput): Promise<ParkingSpot> {
  // Try the real parking-service via the gateway when configured.
  if (GATEWAY_URL) {
    const res = await fetch(`${GATEWAY_URL}/parking-spots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: input.title,
        address: input.address,
        pricePerHour: input.pricePerHour,
        description: input.description,
      }),
    });
    if (!res.ok) {
      throw new Error(`parking-service error: ${res.status}`);
    }
    const data = await res.json();
    // Map the server response to the local ParkingSpot shape.
    const spot: ParkingSpot = {
      id: data.id,
      ownerId: data.ownerId ?? input.ownerId,
      title: data.title,
      address: data.address,
      lat: data.location?.coordinates?.[1] ?? -34.6037,
      lng: data.location?.coordinates?.[0] ?? -58.4263,
      pricePerHour: data.pricePerHour,
      photoUrl: 'https://loremflickr.com/400/300/parking,garage/all?lock=' + data.id,
      covered: input.covered,
      rating: 0,
      reviewCount: 0,
      tags: input.covered ? ['covered'] : ['uncovered'],
      schedule: input.schedule || (input.covered ? t('spot.1.schedule') : t('spot.4.schedule')),
      scheduleStartHour: 8,
      scheduleEndHour: 22,
      distanceMeters: Math.floor(Math.random() * 2000) + 300,
      description: data.description || '',
      active: true,
    };
    extraSpots.push(spot);
    return spot;
  }

  // Fallback: in-memory mock (no gateway configured).
  const newSpot: ParkingSpot = {
    id: `spot-${nextSpotId++}`,
    ownerId: input.ownerId,
    title: input.title,
    address: input.address,
    lat: -34.6037 + Math.random() * 0.1,
    lng: -58.4263 + Math.random() * 0.1,
    pricePerHour: input.pricePerHour,
    photoUrl: 'https://loremflickr.com/400/300/parking,garage/all?lock=' + nextSpotId,
    covered: input.covered,
    rating: 0,
    reviewCount: 0,
    tags: input.covered ? ['covered'] : ['uncovered'],
    schedule: input.schedule || (input.covered ? t('spot.1.schedule') : t('spot.4.schedule')),
    scheduleStartHour: input.scheduleStartHour ?? 8,
    scheduleEndHour: input.scheduleEndHour ?? 22,
    distanceMeters: Math.floor(Math.random() * 2000) + 300,
    description: input.description || '',
    active: true,
  };
  extraSpots.push(newSpot);
  return delay(newSpot);
}

export interface UpdateParkingSpotInput {
  scheduleStartHour?: number;
  scheduleEndHour?: number;
  pricePerHour?: number;
  description?: string;
}

export async function updateParkingSpot(id: string, updates: UpdateParkingSpotInput): Promise<ParkingSpot | undefined> {
  const spot = getAllSpots().find((s) => s.id === id);
  if (!spot) return undefined;

  if (updates.scheduleStartHour !== undefined) spot.scheduleStartHour = updates.scheduleStartHour;
  if (updates.scheduleEndHour !== undefined) spot.scheduleEndHour = updates.scheduleEndHour;
  if (updates.pricePerHour !== undefined) spot.pricePerHour = updates.pricePerHour;
  if (updates.description !== undefined) spot.description = updates.description;

  if (updates.scheduleStartHour !== undefined || updates.scheduleEndHour !== undefined) {
    const start = updates.scheduleStartHour ?? spot.scheduleStartHour;
    const end = updates.scheduleEndHour ?? spot.scheduleEndHour;
    spot.schedule = `${String(start).padStart(2, '0')}:00 – ${String(end).padStart(2, '0')}:00`;
  }

  return delay(spot);
}
