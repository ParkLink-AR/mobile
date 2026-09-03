import { searchParkingSpots, getParkingSpotDetail, formatScheduleForDisplay } from '@/src/services/parkingService';
import { getDriverVisiblePrice } from '@/src/services/utils';
import { ApiError } from '@/src/api/client';
import * as parkingApi from '@/src/api/parking';
import type { ParkingSpotApiResponse } from '@/src/api/parking';
import type { ScheduleEntry } from '@/src/types';

jest.mock('@/src/api/parking');

const MON_FRI_8_22: ScheduleEntry[] = [0, 1, 2, 3, 4].map((dayOfWeek) => ({ dayOfWeek, startHour: 8, endHour: 22 }));

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
    instantBooking: true,
    schedule: MON_FRI_8_22,
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
      schedule: MON_FRI_8_22,
      active: true,
    });
  });

  it('composes fromHour/toHour into today\'s ISO datetime with a fixed -03:00 offset', async () => {
    jest.mocked(parkingApi.searchParkingSpots).mockResolvedValue([]);
    // Local calendar date, matching how toISOToday() itself builds "today" --
    // not new Date().toISOString(), which is UTC and can be a different
    // calendar day than local time depending on when the test runs.
    const now = new Date();
    const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    await searchParkingSpots({ lat: -34.6, lng: -58.45, fromHour: 8, toHour: 9 });

    expect(parkingApi.searchParkingSpots).toHaveBeenCalledWith(
      expect.objectContaining({
        from: `${todayISO}T08:00:00-03:00`,
        to: `${todayISO}T09:00:00-03:00`,
      }),
    );
  });

  it('omits from/to when no schedule filter is set', async () => {
    jest.mocked(parkingApi.searchParkingSpots).mockResolvedValue([]);

    await searchParkingSpots({ lat: -34.6, lng: -58.45 });

    const calledWith = jest.mocked(parkingApi.searchParkingSpots).mock.calls[0][0];
    expect(calledWith.from).toBeUndefined();
    expect(calledWith.to).toBeUndefined();
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

describe('formatScheduleForDisplay', () => {
  it('groups consecutive days with identical hours into one line', () => {
    expect(formatScheduleForDisplay(MON_FRI_8_22)).toEqual([
      { dayRange: 'Lun – Vie', hours: '08:00–22:00' },
      { dayRange: 'Sáb – Dom', hours: 'Cerrado' },
    ]);
  });

  it('lists a split shift within the same day sorted by start hour', () => {
    const schedule: ScheduleEntry[] = [
      { dayOfWeek: 0, startHour: 16, endHour: 22 },
      { dayOfWeek: 0, startHour: 8, endHour: 14 },
    ];

    expect(formatScheduleForDisplay(schedule)).toEqual([
      { dayRange: 'Lun', hours: '08:00–14:00, 16:00–22:00' },
      { dayRange: 'Mar – Dom', hours: 'Cerrado' },
    ]);
  });

  it('reports every day closed for an empty schedule', () => {
    expect(formatScheduleForDisplay([])).toEqual([{ dayRange: 'Lun – Dom', hours: 'Cerrado' }]);
  });
});
