import { cancelBooking, getBookingById } from '@/src/services/bookingService';
import { mockBookingsForDriver } from '@/src/mocks/bookings';

describe('bookingService', () => {
  it('cancels a booking by id', async () => {
    const [booking] = mockBookingsForDriver;
    const cancelled = await cancelBooking(booking.id);
    expect(cancelled.status).toBe('CANCELLED');
    const fetched = await getBookingById(booking.id);
    expect(fetched?.status).toBe('CANCELLED');
  });
});
