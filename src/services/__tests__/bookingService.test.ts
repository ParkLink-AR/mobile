import {
  createBooking,
  cancelBooking,
  getBookingById,
} from '@/src/services/bookingService';
import { mockParkingSpots } from '@/src/mocks/parkingSpots';
import { mockDriver } from '@/src/mocks/users';

describe('bookingService', () => {
  it('creates a booking in PENDING_PAYMENT with the service charge applied', async () => {
    const spot = mockParkingSpots[0];
    const booking = await createBooking({
      parkingSpot: spot,
      driverId: mockDriver.id,
      driverName: mockDriver.name,
      date: 'Hoy',
      startTime: '10:00',
      endTime: '12:00',
      hours: 2,
    });
    expect(booking.status).toBe('PENDING_PAYMENT');
    expect(booking.subtotal).toBe((spot.pricePerHour ?? 0) * 2);
    expect(booking.serviceCharge).toBe(Math.round(booking.subtotal * 0.05));
    expect(booking.total).toBe(booking.subtotal + booking.serviceCharge);
  });

  it('cancels a booking by id', async () => {
    const spot = mockParkingSpots[0];
    const booking = await createBooking({
      parkingSpot: spot,
      driverId: mockDriver.id,
      driverName: mockDriver.name,
      date: 'Hoy',
      startTime: '10:00',
      endTime: '12:00',
      hours: 2,
    });
    const cancelled = await cancelBooking(booking.id);
    expect(cancelled.status).toBe('CANCELLED');
    const fetched = await getBookingById(booking.id);
    expect(fetched?.status).toBe('CANCELLED');
  });
});
