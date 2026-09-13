import { Booking } from '@/src/types';
import { mockBookingsForDriver, mockBookingsForOwner } from '@/src/mocks/bookings';
import { delay } from './utils';

const allBookings: Booking[] = [...mockBookingsForDriver, ...mockBookingsForOwner];

export async function getBookingById(id: string): Promise<Booking | undefined> {
  return delay(allBookings.find((b) => b.id === id));
}

export async function cancelBooking(id: string): Promise<Booking> {
  const booking = allBookings.find((b) => b.id === id);
  if (!booking) {
    throw new Error(`Booking ${id} not found`);
  }
  booking.status = 'CANCELLED';
  return delay(booking);
}
