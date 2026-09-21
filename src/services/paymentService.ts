import { Booking, Settlement } from '@/src/types';
import { mockSettlements } from '@/src/mocks/settlements';
import { delay } from './utils';
import { cancelBooking, getBookingById } from './bookingService';

export async function payBooking(bookingId: string): Promise<Booking> {
  const booking = await getBookingById(bookingId);
  if (!booking) {
    throw new Error(`Booking ${bookingId} not found`);
  }
  booking.status = 'CONFIRMED';
  return delay(booking, 800);
}

export async function getSettlementsForOwner(ownerId: string): Promise<Settlement[]> {
  return delay(mockSettlements.filter((s) => s.ownerId === ownerId));
}

export async function getSettlementById(id: string): Promise<Settlement | undefined> {
  return delay(mockSettlements.find((s) => s.id === id));
}

export { cancelBooking };
