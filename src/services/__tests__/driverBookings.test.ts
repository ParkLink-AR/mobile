import { getDriverBookings, getDriverBookingById } from '@/src/services/bookingService';
import * as bookingApi from '@/src/api/booking';
import * as parkingApi from '@/src/api/parking';
import type { BookingApiResponse } from '@/src/api/booking';
import type { ParkingSpotApiResponse } from '@/src/api/parking';

jest.mock('@/src/api/booking');
jest.mock('@/src/api/parking');

function makeApiBooking(overrides: Partial<BookingApiResponse> = {}): BookingApiResponse {
  return {
    id: 'booking-real-1',
    parking_spot_id: 'spot-1',
    user_id: 'driver-1',
    start: '2026-08-23T15:00:00-03:00',
    end: '2026-08-23T20:00:00-03:00',
    status: 'CONFIRMED',
    amount: 180000,
    ...overrides,
  };
}

function makeApiSpot(overrides: Partial<ParkingSpotApiResponse> = {}): ParkingSpotApiResponse {
  return {
    id: 'spot-1',
    ownerId: 'owner-1',
    title: 'Cochera Cabildo 2980',
    description: null,
    address: 'Cabildo 2980, CABA',
    lat: -34.56,
    lng: -58.46,
    pricePerHour: 400,
    covered: true,
    schedule: [],
    photos: [],
    rules: [],
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('getDriverBookings', () => {
  afterEach(() => jest.resetAllMocks());

  it('joins booking history with a single batch spot lookup, in pesos', async () => {
    jest.mocked(bookingApi.getBookingHistoryApi).mockResolvedValue([makeApiBooking()]);
    jest.mocked(parkingApi.getParkingSpotsByIds).mockResolvedValue([makeApiSpot()]);

    const bookings = await getDriverBookings('driver-1');

    expect(bookings).toEqual([
      {
        id: 'booking-real-1',
        parkingSpotTitle: 'Cochera Cabildo 2980',
        status: 'CONFIRMED',
        date: '2026-08-23',
        startTime: '15:00',
        endTime: '20:00',
        total: 1800,
      },
    ]);
    expect(parkingApi.getParkingSpotsByIds).toHaveBeenCalledWith(['spot-1']);
  });

  it('deduplicates parking spot ids across bookings before the batch call', async () => {
    jest.mocked(bookingApi.getBookingHistoryApi).mockResolvedValue([
      makeApiBooking({ id: 'b1', parking_spot_id: 'spot-1' }),
      makeApiBooking({ id: 'b2', parking_spot_id: 'spot-1' }),
    ]);
    jest.mocked(parkingApi.getParkingSpotsByIds).mockResolvedValue([makeApiSpot()]);

    await getDriverBookings('driver-1');

    expect(parkingApi.getParkingSpotsByIds).toHaveBeenCalledWith(['spot-1']);
  });

  it('skips the batch call entirely when there are no bookings', async () => {
    jest.mocked(bookingApi.getBookingHistoryApi).mockResolvedValue([]);
    jest.mocked(parkingApi.getParkingSpotsByIds).mockResolvedValue([]);

    const bookings = await getDriverBookings('driver-1');

    expect(bookings).toEqual([]);
    expect(parkingApi.getParkingSpotsByIds).toHaveBeenCalledWith([]);
  });

  it('falls back to the raw spot id when the spot is missing from the batch response', async () => {
    jest.mocked(bookingApi.getBookingHistoryApi).mockResolvedValue([makeApiBooking({ parking_spot_id: 'deleted-spot' })]);
    jest.mocked(parkingApi.getParkingSpotsByIds).mockResolvedValue([]);

    const bookings = await getDriverBookings('driver-1');

    expect(bookings[0].parkingSpotTitle).toBe('deleted-spot');
  });
});

describe('getDriverBookingById', () => {
  afterEach(() => jest.resetAllMocks());

  it('fetches the booking and its single parking spot', async () => {
    jest.mocked(bookingApi.getBookingApi).mockResolvedValue(makeApiBooking());
    jest.mocked(parkingApi.getParkingSpotsByIds).mockResolvedValue([makeApiSpot()]);

    const booking = await getDriverBookingById('booking-real-1');

    expect(booking).toEqual({
      id: 'booking-real-1',
      parkingSpotTitle: 'Cochera Cabildo 2980',
      status: 'CONFIRMED',
      date: '2026-08-23',
      startTime: '15:00',
      endTime: '20:00',
      total: 1800,
    });
    expect(parkingApi.getParkingSpotsByIds).toHaveBeenCalledWith(['spot-1']);
  });
});
