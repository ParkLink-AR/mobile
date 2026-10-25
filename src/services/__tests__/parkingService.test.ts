import {
  searchParkingSpots, getParkingSpotDetail, formatScheduleForDisplay, spotListPrice, toISODateTime, AVAILABLE_NOW_HOURS,
  isOpenAroundTheClock, getHalfDayRate, spotNeedsVehicle, HALF_DAY_HOURS,
} from '@/src/services/parkingService';
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
    hourlyEnabled: true,
    vehicleTypes: ['car'],
    pricePerHour: 1200,
    pricePerHourByVehicleType: null,
    stayEnabled: false,
    pricePerDay: null,
    pricePerWeek: null,
    pricePerMonth: null,
    stayAvailableFrom: null,
    stayAvailableUntil: null,
    maxStayDays: null,
    covered: true,
    capacity: 1,
    schedule: MON_FRI_8_22,
    photos: [],
    verificationPhotos: [],
    reviewNotes: null,
    suspendedByAdmin: false,
    moderationNote: null,
    blockedDates: [],
    rules: [],
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    distanceMeters: 350,
    rating: 4.5,
    reviewCount: 12,
    ...overrides,
  };
}

describe('parkingService', () => {
  afterEach(() => jest.resetAllMocks());

  it('maps backend spots to the mobile ParkingSpot shape', async () => {
    jest.mocked(parkingApi.searchParkingSpots).mockResolvedValue([makeApiSpot()]);

    const spots = await searchParkingSpots({ lat: -34.6, lng: -58.45 }, 5);

    expect(spots).toHaveLength(1);
    expect(spots[0]).toMatchObject({
      id: 'spot-1',
      covered: true,
      tags: ['covered'],
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

    await searchParkingSpots({ lat: -34.6, lng: -58.45, fromHour: 8, toHour: 9 }, 5);

    expect(parkingApi.searchParkingSpots).toHaveBeenCalledWith(
      expect.objectContaining({
        from: `${todayISO}T08:00:00-03:00`,
        to: `${todayISO}T09:00:00-03:00`,
      }),
    );
  });

  it('omits from/to when no schedule filter is set', async () => {
    jest.mocked(parkingApi.searchParkingSpots).mockResolvedValue([]);

    await searchParkingSpots({ lat: -34.6, lng: -58.45 }, 5);

    const calledWith = jest.mocked(parkingApi.searchParkingSpots).mock.calls[0][0];
    expect(calledWith.from).toBeUndefined();
    expect(calledWith.to).toBeUndefined();
  });

  it("sends the price range in the owner's rates, taking the commission out", async () => {
    jest.mocked(parkingApi.searchParkingSpots).mockResolvedValue([]);

    await searchParkingSpots({ lat: -34.6, lng: -58.45, minPrice: 1050, maxPrice: 2100 }, 5);

    const { minPrice, maxPrice } = jest.mocked(parkingApi.searchParkingSpots).mock.calls[0][0];
    // A spot the driver sees at exactly their limits (owner 1000 -> 1050, 2000 -> 2100) still counts.
    expect(getDriverVisiblePrice(1000, 5)).toBe(1050);
    expect(minPrice!).toBeLessThanOrEqual(1000);
    expect(minPrice!).toBeGreaterThan(999);
    expect(maxPrice!).toBeGreaterThanOrEqual(2000);
    expect(maxPrice!).toBeLessThan(2001);
  });

  it('sends the stay dates only when looking for stays, and drops the hourly window then', async () => {
    jest.mocked(parkingApi.searchParkingSpots).mockResolvedValue([]);

    await searchParkingSpots(
      { lat: -34.6, lng: -58.45, stayOnly: true, stayFrom: '2026-11-02', stayTo: '2026-11-09', fromHour: 8, toHour: 9 },
      5,
    );
    await searchParkingSpots({ lat: -34.6, lng: -58.45, stayFrom: '2026-11-02', stayTo: '2026-11-09' }, 5);

    const [stay, hourly] = jest.mocked(parkingApi.searchParkingSpots).mock.calls.map((call) => call[0]);
    expect(stay).toMatchObject({ stayOnly: true, stayFrom: '2026-11-02', stayTo: '2026-11-09', from: undefined, to: undefined });
    expect(hourly.stayFrom).toBeUndefined();
  });

  it('"Disponible ahora" asks for the next hours from this moment', async () => {
    jest.mocked(parkingApi.searchParkingSpots).mockResolvedValue([]);
    const before = Date.now();

    await searchParkingSpots({ lat: -34.6, lng: -58.45, availableNow: true, vehicleType: 'suv', minRating: 4 }, 5);

    const params = jest.mocked(parkingApi.searchParkingSpots).mock.calls[0][0];
    const from = new Date(params.from!).getTime();
    const to = new Date(params.to!).getTime();
    expect(from).toBeGreaterThanOrEqual(before - 1000);
    expect(to - from).toBe(AVAILABLE_NOW_HOURS * 60 * 60 * 1000);
    expect(params).toMatchObject({ vehicleType: 'suv', minRating: 4 });
  });

  it('a window until midnight ends at 00:00 of the next day', () => {
    expect(toISODateTime('2026-11-02', 24)).toBe('2026-11-03T00:00:00-03:00');
    expect(toISODateTime('2026-12-31', 24)).toBe('2027-01-01T00:00:00-03:00');
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
      { dayRange: 'Lun – Vie', hours: '08:00–22:00', firstDay: 0, lastDay: 4 },
      { dayRange: 'Sáb – Dom', hours: 'Cerrado', firstDay: 5, lastDay: 6 },
    ]);
  });

  it('lists a split shift within the same day sorted by start hour', () => {
    const schedule: ScheduleEntry[] = [
      { dayOfWeek: 0, startHour: 16, endHour: 22 },
      { dayOfWeek: 0, startHour: 8, endHour: 14 },
    ];

    expect(formatScheduleForDisplay(schedule)).toEqual([
      { dayRange: 'Lun', hours: '08:00–14:00, 16:00–22:00', firstDay: 0, lastDay: 0 },
      { dayRange: 'Mar – Dom', hours: 'Cerrado', firstDay: 1, lastDay: 6 },
    ]);
  });

  it('reports every day closed for an empty schedule', () => {
    expect(formatScheduleForDisplay([])).toEqual([{ dayRange: 'Lun – Dom', hours: 'Cerrado', firstDay: 0, lastDay: 6 }]);
  });
});

describe('isOpenAroundTheClock', () => {
  const allDay = (day: number) => ({ dayOfWeek: day, startHour: 0, endHour: 24 });

  it('is true only when every day is open from 00:00 to 24:00, split windows included', () => {
    expect(isOpenAroundTheClock([0, 1, 2, 3, 4, 5, 6].map(allDay))).toBe(true);
    const split = [0, 1, 2, 3, 4, 5].map(allDay).concat([{ dayOfWeek: 6, startHour: 0, endHour: 12 }, { dayOfWeek: 6, startHour: 12, endHour: 24 }]);
    expect(isOpenAroundTheClock(split)).toBe(true);
    expect(isOpenAroundTheClock([0, 1, 2, 3, 4, 5].map(allDay))).toBe(false);
    expect(isOpenAroundTheClock(MON_FRI_8_22)).toBe(false);
  });
});

describe('spotListPrice', () => {
  // Through the same mapping the app uses on what the backend sends.
  async function spot(overrides: Partial<ParkingSpotApiResponse> = {}) {
    jest.mocked(parkingApi.getParkingSpotDetail).mockResolvedValue(makeApiSpot(overrides));
    return (await getParkingSpotDetail('spot-1'))!;
  }

  it("is the hourly price, or the chosen vehicle's", async () => {
    expect(spotListPrice(await spot())).toEqual({ amount: 1200, unit: 'hour', from: false });
    const byVehicle = await spot({ pricePerHour: null, pricePerHourByVehicleType: { car: 900, suv: 1500 } });
    expect(spotListPrice(byVehicle)).toEqual({ amount: 900, unit: 'hour', from: true });
    expect(spotListPrice(byVehicle, { vehicleType: 'suv' })).toEqual({ amount: 1500, unit: 'hour', from: false });
  });

  it('is the daily price when looking for stays, or when the spot only offers stays', async () => {
    const both = await spot({ stayEnabled: true, pricePerDay: 8000 });
    expect(spotListPrice(both, { stays: true })).toEqual({ amount: 8000, unit: 'day', from: false });
    const stayOnly = await spot({ hourlyEnabled: false, pricePerHour: null, stayEnabled: true, pricePerDay: 8000 });
    expect(spotListPrice(stayOnly)).toEqual({ amount: 8000, unit: 'day', from: false });
  });
});

describe('media estadía (12 h)', () => {
  afterEach(() => jest.resetAllMocks());

  async function spot(overrides: Partial<ParkingSpotApiResponse> = {}) {
    jest.mocked(parkingApi.getParkingSpotDetail).mockResolvedValue(makeApiSpot(overrides));
    return (await getParkingSpotDetail('spot-1'))!;
  }
  const HALF_DAY = { stayEnabled: true, pricePerDay: 9000, halfDayEnabled: true, pricePerHalfDay: 5000 };

  it("is off for a spot from before it existed, and never without the stay", async () => {
    expect((await spot()).halfDayEnabled).toBe(false);
    const withoutStay = await spot({ halfDayEnabled: true, pricePerHalfDay: 5000, stayEnabled: false });
    expect(withoutStay.halfDayEnabled).toBe(false);
    expect(withoutStay.pricePerHalfDay).toBeNull();
    const offered = await spot(HALF_DAY);
    expect(offered).toMatchObject({ halfDayEnabled: true, pricePerHalfDay: 5000 });
  });

  it('lists it per 12 hours, the vehicle\'s own when the stay is priced by vehicle', async () => {
    expect(spotListPrice(await spot(HALF_DAY), { halfDay: true })).toEqual({ amount: 5000, unit: 'halfDay', from: false });
    expect(spotListPrice(await spot(), { halfDay: true })).toBeNull();
    const byVehicle = await spot({
      ...HALF_DAY,
      pricePerHalfDay: 5000,
      stayPricesByVehicleType: { car: { day: 9000, week: 1, month: 1, halfDay: 5000 }, suv: { day: 12000, week: 1, month: 1, halfDay: 7000 } },
    });
    expect(spotListPrice(byVehicle, { halfDay: true })).toEqual({ amount: 5000, unit: 'halfDay', from: true });
    expect(spotListPrice(byVehicle, { halfDay: true, vehicleType: 'suv' })).toEqual({ amount: 7000, unit: 'halfDay', from: false });
    expect(getHalfDayRate(byVehicle, 'suv')).toBe(7000);
    expect(getHalfDayRate(byVehicle, null)).toBeNull();
    expect(getHalfDayRate(await spot(HALF_DAY), null)).toBe(5000);
  });

  it('asks for the vehicle when the stay is priced by it, like a stay', async () => {
    const byVehicle = await spot({ ...HALF_DAY, stayPricesByVehicleType: { car: { day: 9000, week: 1, month: 1, halfDay: 5000 } } });
    expect(spotNeedsVehicle(byVehicle, 'halfDay')).toBe(true);
    expect(spotNeedsVehicle(await spot(HALF_DAY), 'halfDay')).toBe(false);
  });

  it('searches for the 12 hours from the chosen hour, and only for that type', async () => {
    jest.mocked(parkingApi.searchParkingSpots).mockResolvedValue([]);
    await searchParkingSpots(
      { lat: -34.6, lng: -58.45, halfDayOnly: true, stayOnly: true, hourlyOnly: true, date: '2026-11-02', fromHour: 20, toHour: 21 },
      5,
    );
    const params = jest.mocked(parkingApi.searchParkingSpots).mock.calls[0][0];
    expect(params.halfDayOnly).toBe(true);
    expect(params.stayOnly).toBeUndefined();
    expect(params.hourlyOnly).toBeUndefined();
    expect(params.from).toBe('2026-11-02T20:00:00-03:00');
    expect(new Date(params.to!).getTime() - new Date(params.from!).getTime()).toBe(HALF_DAY_HOURS * 60 * 60 * 1000);
  });

  it('without an hour, only asks for spots that offer it', async () => {
    jest.mocked(parkingApi.searchParkingSpots).mockResolvedValue([]);
    await searchParkingSpots({ lat: -34.6, lng: -58.45, halfDayOnly: true }, 5);
    const params = jest.mocked(parkingApi.searchParkingSpots).mock.calls[0][0];
    expect(params).toMatchObject({ halfDayOnly: true, from: undefined, to: undefined });
  });
});
