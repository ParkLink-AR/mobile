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
  // When a PENDING_OWNER_APPROVAL booking is auto-cancelled if the owner doesn't answer.
  owner_response_deadline?: string;
  amount: number; // centavos -- what the driver was charged (owner's price + commission)
  // centavos -- what the payment charged on top of `amount`: the pending balances the booking took
  // on (see DebtApiResponse). Only sent to the driver; absent when none.
  debt_amount?: number;
  // centavos -- what the spot's owner earns (their own price). Only sent to the owner;
  // absent for a booking that predates it, whose `amount` was the owner's price itself.
  owner_amount?: number;
  payment_id?: string;
  // Set once, the moment Mercado Pago's payment was actually confirmed -- absent means
  // the booking was never paid, regardless of its current status (e.g. EXPIRED, or
  // CANCELLED before ever reaching PENDING_OWNER_APPROVAL). See booking-service's
  // entity.Booking.PaidAt.
  paid_at?: string;
  // Only set for a CANCELLED booking: 'OWNER_REJECTED', 'OWNER_EXPIRED' (owner never
  // responded in time), or 'DRIVER_CANCELLED' (the driver cancelled it themselves).
  // Absent for a cancelled booking that predates this field. See booking-service's
  // entity.Booking.CancellationReason.
  cancellation_reason?: string;
  kind: BookingKind;
  // Only present when the caller IS this booking's driver -- booking-service omits
  // it for everyone else (e.g. the owner), since the whole point is a verbal,
  // in-person exchange. See VerifyBookingCodeUseCase/bookingResponseFromEntity.
  verification_code?: string;
  verified_at?: string;
  updated_at: string;
  // The vehicle the driver picked (optionally) from their own saved list when booking --
  // absent if they didn't pick one. See booking-service's vehicleResponseFromEntity.
  vehicle?: BookingVehicleApiResponse;
  // centavos -- what went back to the driver when only part did (cancelled in its last
  // hour, or an admin's partial refund). Absent when nothing, or everything, did.
  refunded_amount?: number;
  // OWNER_CANCELLED: the reason the owner gave.
  cancellation_note?: string;
  // Set on an extension: the booking it continues.
  parent_booking_id?: string;
  // This booking's latest extension that's still live (awaiting payment, or paid).
  extension?: { id: string; end: string; status: string };
}

/** One way to extend a booking: until `end`, for `amount` centavos. */
export interface ExtensionOptionApiResponse {
  end: string;
  amount: number;
}

export interface BookingVehicleApiResponse {
  // Absent on a booking made before vehicles had a type.
  type?: string | null;
  // Absent for a bicycle.
  plate?: string | null;
  brand?: string | null;
  model?: string | null;
  country?: string | null;
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

export interface MessageApiResponse {
  id: string;
  booking_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export interface ReviewListApiResponse {
  average_rating: number;
  count: number;
  reviews: ReviewApiResponse[];
}

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export interface TicketApiResponse {
  id: string;
  booking_id: string;
  created_by: string;
  subject: string;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
}

export interface TicketMessageApiResponse {
  id: string;
  ticket_id: string;
  sender_id: string;
  is_admin: boolean;
  body: string;
  created_at: string;
}

// ── Request bodies ────────────────────────────────────────────────────────────

export interface ScheduleEntryBody {
  day_of_week: number;
  start_hour: number;
  end_hour: number;
}

// The driver is always the authenticated caller -- booking-service takes it from the
// session (X-User-Id), never from the body.
export interface CreateBookingBody {
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
  // The saved vehicle the driver picked -- required when the spot asks for it or prices by
  // vehicle type (booking-service refuses the booking otherwise), optional otherwise.
  vehicle?: BookingVehicleApiResponse;
}

// ── API calls ─────────────────────────────────────────────────────────────────

/**
 * Creates a booking in PENDING_PAYMENT status, atomically reserving the slot
 * for the hold window (default 5 min). Returns the booking with its id.
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
 * Creates a Mercado Pago checkout preference for the caller's own booking.
 * The externalReference MUST be the bookingId: payment-service looks the
 * booking up by it and always charges the booking's own server-side price.
 *
 * POST /payments/create-preference
 */
export interface CreatePreferenceBody {
  title: string;
  description?: string;
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
 * Cancels a CONFIRMED or PENDING_OWNER_APPROVAL booking and refunds the
 * driver. Only the booking's own driver can call this, and only when there
 * is more than 1 hour until the booking's start time.
 *
 * POST /bookings/{id}/cancel
 */
export async function cancelBookingApi(bookingId: string): Promise<BookingApiResponse> {
  return request(`/bookings/${bookingId}/cancel`, { method: 'POST' });
}

/**
 * The owner calls off a booking they had already accepted, before it starts, saying why.
 * The driver gets everything back.
 *
 * POST /bookings/{id}/owner-cancel
 */
export async function ownerCancelBookingApi(bookingId: string, reason: string): Promise<BookingApiResponse> {
  return request(`/bookings/${bookingId}/owner-cancel`, { method: 'POST', body: JSON.stringify({ reason }) });
}

/**
 * Until when the driver can extend an hourly booking, an hour at a time, and for how much.
 *
 * GET /bookings/{id}/extension-options
 */
export async function getExtensionOptionsApi(bookingId: string): Promise<ExtensionOptionApiResponse[]> {
  return request(`/bookings/${bookingId}/extension-options`);
}

/**
 * Extends a booking until `end` (one of the options): creates the extension as a new booking
 * awaiting payment, chained to this one. Paying it confirms it straight away.
 *
 * POST /bookings/{id}/extend
 */
export async function extendBookingApi(bookingId: string, end: string): Promise<BookingApiResponse> {
  return request(`/bookings/${bookingId}/extend`, { method: 'POST', body: JSON.stringify({ end }) });
}

/**
 * How to get into the booking's spot (gate code, floor...) -- the driver sees it once the
 * owner accepted the booking. "" when the owner wrote none.
 *
 * GET /bookings/{id}/access
 */
export async function getBookingAccessApi(bookingId: string): Promise<string> {
  const response = await request<{ access_instructions: string }>(`/bookings/${bookingId}/access`);
  return response.access_instructions ?? '';
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

/** How a verified hourly booking ends -- see booking-service's exitResponse. */
export interface BookingExitApiResponse {
  /** True while the vehicle's departure still has to be recorded. */
  awaiting: boolean;
  /** Only for the booking's driver, while it awaits its exit: the code they give the owner. */
  exit_code?: string;
  /** Set once the departure was recorded. */
  exited_at?: string;
  closed_by?: 'OWNER_CODE' | 'SUPPORT';
  /** How long past the booking's end the vehicle stayed, and how much of it is charged (all of it
   * once it went past the grace period, none before). */
  overstay_minutes: number;
  charged_minutes: number;
  /** centavos -- what the driver owes for the charged minutes (the driver's side only). */
  overstay_amount?: number;
  /** centavos -- what the spot's owner is owed for them (the owner's side only). */
  overstay_owner_amount?: number;
}

/**
 * The booking's exit as the caller sees it. The driver, the first time they ask while it awaits
 * its exit, gets the code to give the owner.
 *
 * GET /bookings/{id}/exit
 */
export async function getBookingExitApi(bookingId: string): Promise<BookingExitApiResponse> {
  return request(`/bookings/${bookingId}/exit`);
}

/**
 * The owner enters the code the driver gives them as the vehicle leaves: records when it left
 * and completes the booking.
 *
 * POST /bookings/{id}/verify-exit
 */
export async function verifyBookingExitApi(bookingId: string, code: string): Promise<BookingExitApiResponse> {
  return request(`/bookings/${bookingId}/verify-exit`, {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

/** What the driver owes for staying past the end of a booking -- see booking-service's debtResponse. */
export interface DebtApiResponse {
  id: string;
  /** PENDING: the next booking takes it on. RESERVED: it is on a booking still waiting for its
   * payment. PAID: that booking's payment settled it. */
  status: 'PENDING' | 'RESERVED' | 'PAID';
  /** centavos */
  amount: number;
  /** How long past the end they stayed -- all of it was charged. */
  minutes: number;
  /** The booking that was overstayed, and where. */
  booking_id: string;
  booking_start: string;
  booking_end: string;
  parking_spot_id: string;
  parking_spot_title: string;
  /** The booking whose payment includes it, once one does. */
  charged_booking_id?: string;
  created_at: string;
  paid_at?: string;
}

export interface MyDebtsApiResponse {
  /** centavos -- what a new booking would add to its price right now. */
  pending_amount: number;
  debts: DebtApiResponse[];
}

/**
 * The caller's balances for staying past the end of a booking, newest first, and how much their
 * next reservation will carry.
 *
 * GET /debts
 */
export async function getMyDebtsApi(): Promise<MyDebtsApiResponse> {
  return request('/debts');
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

/**
 * Sends a message on a booking's thread -- either side (the driver or the spot's
 * owner) can call this once the booking exists. Used to coordinate access
 * instructions, arrival, etc.
 *
 * POST /bookings/{id}/messages
 */
export async function sendMessageApi(bookingId: string, body: string): Promise<MessageApiResponse> {
  return request(`/bookings/${bookingId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

/**
 * Every message on a booking's thread, oldest first. Only the booking's driver or
 * its spot's owner can read it.
 *
 * GET /bookings/{id}/messages
 */
export async function getMessagesApi(bookingId: string): Promise<MessageApiResponse[]> {
  return request(`/bookings/${bookingId}/messages`);
}

/**
 * Opens a support ticket on a booking -- either side (the driver or the spot's owner)
 * can call this. `body` becomes the ticket's opening message.
 *
 * POST /bookings/{id}/tickets
 */
export async function createTicketApi(bookingId: string, subject: string, body: string): Promise<TicketApiResponse> {
  return request(`/bookings/${bookingId}/tickets`, {
    method: 'POST',
    body: JSON.stringify({ subject, body }),
  });
}

/**
 * Every ticket the caller opened on this booking, newest first.
 *
 * GET /bookings/{id}/tickets
 */
export async function getMyTicketsApi(bookingId: string): Promise<TicketApiResponse[]> {
  return request(`/bookings/${bookingId}/tickets`);
}

/**
 * A single ticket by id. Only its own creator can read it.
 *
 * GET /tickets/{id}
 */
export async function getTicketApi(ticketId: string): Promise<TicketApiResponse> {
  return request(`/tickets/${ticketId}`);
}

export interface TicketSummaryApiResponse extends TicketApiResponse {
  last_admin_reply_id?: string | null;
  last_admin_reply_at?: string | null;
}

/**
 * Every ticket this user has ever opened, across every booking -- used by the in-app
 * notification feed to surface support.ticket_replied without a per-booking poll.
 *
 * GET /users/{id}/tickets
 */
export async function getUserTicketsApi(userId: string): Promise<TicketSummaryApiResponse[]> {
  return request(`/users/${userId}/tickets`);
}

/**
 * Every message on a ticket's thread, oldest first -- the creator's opening message
 * plus every reply from ParkLink staff.
 *
 * GET /tickets/{id}/messages
 */
export async function getTicketMessagesApi(ticketId: string): Promise<TicketMessageApiResponse[]> {
  return request(`/tickets/${ticketId}/messages`);
}

/**
 * Adds a follow-up message to the caller's own ticket.
 *
 * POST /tickets/{id}/messages
 */
export async function addTicketMessageApi(ticketId: string, body: string): Promise<TicketMessageApiResponse> {
  return request(`/tickets/${ticketId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

/**
 * The platform's current commission rate -- what gets added on top of a spot owner's own
 * price for the driver to pay (the owner always receives their own price in full; see
 * useCommissionStore). Same read as the admin panel's settings screen, at a non-admin path.
 *
 * GET /settings/commission
 */
export async function getCommissionRateApi(): Promise<{ commissionRateBp: number; commissionRatePercent: number }> {
  const response = await request<{ commission_rate_bp: number; commission_rate_percent: number }>(
    '/settings/commission',
  );
  return { commissionRateBp: response.commission_rate_bp, commissionRatePercent: response.commission_rate_percent };
}

export interface RefundStatusResponse {
  /** 'refunded': the money went back. 'in_progress': it's being processed (or retried).
   * 'delayed': every automatic retry failed -- ParkLink staff has to step in.
   * 'none': no Mercado Pago payment on record for this booking. */
  status: 'refunded' | 'in_progress' | 'delayed' | 'none';
  amount?: number; // pesos
  refundedAt?: string | null;
}

/**
 * Where the refund of a cancelled, already-paid booking stands -- only for the booking's
 * own driver.
 *
 * GET /payments/refund-status/{bookingId}
 */
export async function getRefundStatusApi(bookingId: string): Promise<RefundStatusResponse> {
  return request(`/payments/refund-status/${bookingId}`);
}
