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
  payment_id?: string;
  updated_at: string;
}

export type ReviewTargetType = 'spot' | 'owner' | 'driver';

export interface ReviewApiResponse {
  id: string;
  booking_id: string;
  reviewer_id: string;
  target_type: ReviewTargetType;
  target_id: string;
  rating: number;
  comment?: string;
  created_at: string;
}

export interface ReviewListApiResponse {
  average_rating: number;
  count: number;
  reviews: ReviewApiResponse[];
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

/**
 * A single booking by id -- used to check whether it landed on CONFIRMED or
 * PENDING_OWNER_APPROVAL once the payment itself is approved.
 *
 * GET /bookings/{id}
 */
export async function getBookingApi(bookingId: string): Promise<BookingApiResponse> {
  return request(`/bookings/${bookingId}`);
}

/**
 * Every booking (any status) for a parking spot -- used by the owner's
 * "solicitudes de reserva" screen. The caller must own the spot.
 *
 * GET /parking-spots/{spotId}/bookings/detailed
 */
export async function getBookingsForSpotApi(spotId: string): Promise<BookingApiResponse[]> {
  return request(`/parking-spots/${spotId}/bookings/detailed`);
}

/**
 * Approves a PENDING_OWNER_APPROVAL booking. Caller must own the spot.
 *
 * POST /bookings/{id}/approve
 */
export async function approveBookingApi(bookingId: string): Promise<BookingApiResponse> {
  return request(`/bookings/${bookingId}/approve`, { method: 'POST' });
}

/**
 * Rejects a PENDING_OWNER_APPROVAL booking and refunds the driver. Caller
 * must own the spot.
 *
 * POST /bookings/{id}/reject
 */
export async function rejectBookingApi(bookingId: string): Promise<BookingApiResponse> {
  return request(`/bookings/${bookingId}/reject`, { method: 'POST' });
}

/**
 * Rates the spot, its owner, or the driver on a COMPLETED booking. The driver can
 * submit 'spot'/'owner', the spot's owner can submit 'driver'.
 *
 * POST /bookings/{id}/reviews
 */
export async function submitReviewApi(
  bookingId: string,
  targetType: ReviewTargetType,
  rating: number,
  comment?: string,
): Promise<ReviewApiResponse> {
  return request(`/bookings/${bookingId}/reviews`, {
    method: 'POST',
    body: JSON.stringify({ targetType, rating, comment }),
  });
}

/**
 * Every review already left on a booking (by anyone, for any target) -- used to know
 * what's still left to review.
 *
 * GET /bookings/{id}/reviews
 */
export async function getBookingReviewsApi(bookingId: string): Promise<ReviewApiResponse[]> {
  return request(`/bookings/${bookingId}/reviews`);
}

/**
 * Reviews left for a person, as owner or as driver -- powers the public profile screen.
 *
 * GET /users/{userId}/reviews?as=owner|driver
 */
export async function getUserReviewsApi(userId: string, as: 'owner' | 'driver'): Promise<ReviewListApiResponse> {
  return request(`/users/${userId}/reviews?as=${as}`);
}
