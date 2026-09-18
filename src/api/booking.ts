import { request } from './client';

// ── Wire shapes returned by booking-service ──────────────────────────────────

export type BookingKind = 'HOURLY' | 'STAY';

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
  kind: BookingKind;
  // Only present when the caller IS this booking's driver -- booking-service omits
  // it for everyone else (e.g. the owner), since the whole point is a verbal,
  // in-person exchange. See VerifyBookingCodeUseCase/bookingResponseFromEntity.
  verification_code?: string;
  verified_at?: string;
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
  // RFC3339. For kind "STAY", `start` is the driver's chosen check-in
  // instant (date + hour) -- booking-service re-derives the authoritative
  // start/end/amount itself from a parking-service quote (see below), but
  // it reads the check-in hour straight out of this value, so it must be
  // the real one, not a placeholder.
  start: string;
  end: string; // For kind "STAY", re-derived server-side too -- send the quote's endDateTime.
  amount: number; // Ignored by booking-service for kind "STAY" -- see stay_end_date.
  // "HOURLY" (default, omit for the existing slot-booking flow) or "STAY". For
  // "STAY", stay_end_date is required and booking-service prices the
  // booking itself instead of trusting `amount` -- see getStayQuote in
  // api/parking.ts, which the caller should already have used to show the
  // driver this same price before confirming.
  kind?: BookingKind;
  stay_end_date?: string; // YYYY-MM-DD
  // booking-service validates the requested range against this instead of
  // fetching it itself -- see booking-service PR "CreateBooking validates
  // against caller-supplied schedule". Irrelevant for kind "STAY" -- send [].
  parking_spot: {
    id: string;
    schedule: ScheduleEntryBody[];
    // Number of identical places the spot rents against this id ("playa"):
    // booking-service allows up to `capacity` overlapping active bookings.
    // Omitted/0 is treated as 1.
    capacity?: number;
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
 * Verifies the 4-digit in-person code the driver read aloud to the owner. On a
 * match, transitions the booking CONFIRMED -> IN_PROGRESS. Caller must own the
 * spot; throws ApiError with a human-readable `detail` on a wrong code or once
 * too many wrong codes have been entered.
 *
 * POST /bookings/{id}/verify-code
 */
export async function verifyBookingCodeApi(bookingId: string, code: string): Promise<BookingApiResponse> {
  return request(`/bookings/${bookingId}/verify-code`, {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
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
