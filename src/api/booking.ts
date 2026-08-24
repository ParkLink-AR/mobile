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

export interface CreateBookingBody {
  user_id: string;
  start: string; // RFC3339
  end: string;   // RFC3339
  amount: number;
}

// ── API calls ─────────────────────────────────────────────────────────────────

/**
 * Creates a booking in PENDING_PAYMENT status, atomically reserving the slot
 * for the hold window (default 15 min). Returns the booking with its id.
 *
 * POST /parking-spots/{spotId}/bookings
 */
export async function createBookingApi(
  spotId: string,
  body: CreateBookingBody,
): Promise<BookingApiResponse> {
  return request(`/parking-spots/${spotId}/bookings`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Creates a Mercado Pago checkout preference.
 * The externalReference MUST be the bookingId so the webhook can confirm it.
 *
 * POST /payments/create-preference
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
