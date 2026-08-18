import { searchParkingSpots, getParkingSpotDetail } from '@/src/services/parkingService';
import { getDriverVisiblePrice } from '@/src/services/utils';
import { ApiError } from '@/src/api/client';
import * as parkingApi from '@/src/api/parking';
import type { ParkingSpotApiResponse } from '@/src/api/parking';

jest.mock('@/src/api/parking');

function makeApiSpot(overrides: Partial<ParkingSpotApiResponse> = {}): ParkingSpotApiResponse {
  return {
    id: 'spot-1',
    ownerId: 'owner-1',
    title: 'Av. Santa Fe 3245',
    description: null,
    address: 'Av. Santa Fe 3245, Palermo, CABA',
    lat: -34.588,
    lng: -58.42,
    pricePerHour: 1200,
    covered: true,
    scheduleText: 'Lun a Vie, 8 a 22 hs',
    photos: [],
    rules: [],
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    distanceMeters: 350,
    ...overrides,
  };
}

describe('parkingService', () => {
  afterEach(() => jest.resetAllMocks());

  it('maps backend spots to the mobile ParkingSpot shape', async () => {
    jest.mocked(parkingApi.searchParkingSpots).mockResolvedValue([makeApiSpot()]);

    const spots = await searchParkingSpots({ lat: -34.6, lng: -58.45 });

    expect(spots).toHaveLength(1);
    expect(spots[0]).toMatchObject({
      id: 'spot-1',
      covered: true,
      tags: ['Cubierta'],
      schedule: 'Lun a Vie, 8 a 22 hs',
      active: true,
    });
  });

  it('filters spots by min price client-side (the backend only filters by max)', async () => {
    jest.mocked(parkingApi.searchParkingSpots).mockResolvedValue([
      makeApiSpot({ id: 'cheap', pricePerHour: 500 }),
      makeApiSpot({ id: 'pricey', pricePerHour: 5000 }),
    ]);

    const spots = await searchParkingSpots({ lat: -34.6, lng: -58.45, minPrice: 1000 });

    expect(spots.map((s) => s.id)).toEqual(['pricey']);
    expect(spots.every((s) => getDriverVisiblePrice(s.pricePerHour) >= 1000)).toBe(true);
  });

  it('returns a spot by id', async () => {
    jest.mocked(parkingApi.getParkingSpotDetail).mockResolvedValue(makeApiSpot());

    const spot = await getParkingSpotDetail('spot-1');

    expect(spot?.id).toBe('spot-1');
  });

  it('returns undefined for an unknown id (404)', async () => {
    jest.mocked(parkingApi.getParkingSpotDetail).mockRejectedValue(new ApiError(404, 'Cochera no encontrada'));

    const spot = await getParkingSpotDetail('does-not-exist');

    expect(spot).toBeUndefined();
  });
});
