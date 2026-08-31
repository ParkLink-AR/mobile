import { request } from './client';

// ── Wire shapes returned by booking-service ──────────────────────────────────

export interface BookingApiResponse {
  id: string;
  parking_spot_id: string;
  user_id: string;
  start: string;
  end: string;
  status: string;
  hold_expires_at?: string;
  amount: number;
}

// ── Request bodies ────────────────────────────────────────────────────────────

export interface ScheduleEntryBody {
  day_of_week: number;
  start_hour: number;
  end_hour: number;
}

export interface CreateBookingBody {
  user_id: string;
  start: string; // RFC3339
  end: string;   // RFC3339
  amount: number;
  // booking-service validates the requested range against this instead of
  // fetching it itself -- see booking-service PR "CreateBooking validates
  // against caller-supplied schedule".
  parking_spot: {
    id: string;
    schedule: ScheduleEntryBody[];
  };
}

// ── API calls ─────────────────────────────────────────────────────────────────

/**
 * Creates a booking in PENDING_PAYMENT status, atomically reserving the slot
 * for the hold window (default 15 min). Returns the booking with its id.
 *
 * POST /bookings
 */
export async function createBookingApi(body: CreateBookingBody): Promise<BookingApiResponse> {
  return request('/bookings', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Creates a Mercado Pago checkout preference.
 * The externalReference MUST be the bookingId so the webhook can confirm it.
 *
 * POST /payments/create-preference
 *
 * NOTE: payment-service doesn't exist in this workspace yet (the gateway 503s
 * on every /payments/* route) -- this call is unused for now, kept for when
 * it does. See confirm.tsx.
 */
export interface CreatePreferenceBody {
  amount: number;
  title: string;
  description?: string;
  currency?: string;
  payerEmail?: string;
  externalReference: string; // bookingId
}

export interface CreatePreferenceResponse {
  preferenceId: string;
  checkoutUrl: string;
  externalReference: string;
}

export async function createPaymentPreference(
  body: CreatePreferenceBody,
): Promise<CreatePreferenceResponse> {
  return request('/payments/create-preference', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Confirms a PENDING_PAYMENT booking (payment_id is normally the Mercado Pago
 * payment id, attached by the webhook once it fires). Used directly by
 * confirm.tsx for now, with a placeholder payment_id, while payment-service
 * doesn't exist -- see confirm.tsx for why.
 *
 * POST /bookings/{id}/confirm
 */
export async function confirmBookingApi(bookingId: string, paymentId: string): Promise<BookingApiResponse> {
  return request(`/bookings/${bookingId}/confirm`, {
    method: 'POST',
    body: JSON.stringify({ payment_id: paymentId }),
  });
}

/**
 * Returns the booking history for a user.
 *
 * GET /users/{userId}/bookings/history
 */
export async function getUserBookingsApi(userId: string): Promise<BookingApiResponse[]> {
  return request(`/users/${userId}/bookings/history`);
}
