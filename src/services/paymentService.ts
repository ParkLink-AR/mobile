import { Booking, Settlement } from '@/src/types';
import { getUserSettlementsApi, getSettlementApi, toSettlement } from '@/src/api/settlements';
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

/** The owner's own settlement history (PAID only), newest first. */
export async function getSettlementsForOwner(ownerId: string): Promise<Settlement[]> {
  const response = await getUserSettlementsApi(ownerId);
  return response.map(toSettlement);
}

/**
 * A single settlement with its payouts populated. Throws ApiError (403/404)
 * if it doesn't belong to the caller or isn't confirmed yet -- same as any
 * other real API call in this app, callers should catch it.
 */
export async function getSettlementById(id: string): Promise<Settlement> {
  const response = await getSettlementApi(id);
  return toSettlement(response);
}

export { cancelBooking };
