import { getParkingSpotsForOwner } from '@/src/services/parkingService';
import {
  getBookingsForSpotApi,
  getUserBookingsApi,
  getBookingReviewsApi,
  getMessagesApi,
  getUserTicketsApi,
  BookingApiResponse,
} from '@/src/api/booking';
import { getParkingSpotDetail } from '@/src/api/parking';
import { getSettlementsForOwner } from '@/src/services/paymentService';
import { mapBookingDateRange } from '@/src/services/bookingDates';

export type NotificationKind =
  | 'owner_request'
  | 'owner_new_booking'
  | 'driver_confirmed'
  | 'driver_rejected'
  | 'driver_review_prompt'
  | 'owner_review_prompt'
  | 'driver_verified'
  | 'message_received'
  | 'ticket_replied'
  | 'owner_settlement_paid';

// Bookings whose chat is still realistically "live" -- messaging is about coordinating an
// upcoming/current stay, not something that keeps happening on a booking that's long over.
const MESSAGE_ACTIVE_STATUSES = new Set(['CONFIRMED', 'PENDING_OWNER_APPROVAL', 'IN_PROGRESS']);

export interface AppNotification {
  /** Unique per notification. For the booking-centric kinds this is
   * `${bookingId}-${kind}`; for message_received it's the message's own id (a booking can
   * have several); for ticket_replied it's the last admin reply's message id (so a NEW
   * reply produces a new unread notification instead of staying permanently "seen"); for
   * owner_settlement_paid it's the settlement's id. */
  id: string;
  kind: NotificationKind;
  bookingId: string;
  parkingSpotId: string;
  /** Rendered as the notification's title. For ticket_replied this is the ticket's own
   * subject (there's no "spot" to name); for owner_settlement_paid it's left blank and the
   * screen substitutes a fixed, translated title instead (see app/(driver)/(tabs)/notifications.tsx). */
  spotTitle: string;
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  total: number;
  at: string; // ISO timestamp, for sorting (most recent first)
  /** Extra navigation targets for kinds that don't map onto a single booking/spot. */
  settlementId?: string;
  ticketId?: string;
}

function fmt(b: BookingApiResponse, spotTitle: string, kind: NotificationKind): AppNotification {
  return {
    id: `${b.id}-${kind}`,
    kind,
    bookingId: b.id,
    parkingSpotId: b.parking_spot_id,
    spotTitle,
    ...mapBookingDateRange(b.start, b.end),
    total: typeof b.amount === 'number' ? b.amount / 100 : 0,
    at: b.updated_at,
  };
}

/** Whether userId still has a review left to submit on a COMPLETED booking, given the
 * target types their role is responsible for (driver: spot + owner, owner: driver). */
async function hasPendingReview(bookingId: string, userId: string, targetTypes: string[]): Promise<boolean> {
  try {
    const existing = await getBookingReviewsApi(bookingId);
    const reviewed = new Set(existing.filter((r) => r.reviewer_id === userId).map((r) => r.target_type));
    return targetTypes.some((target) => !reviewed.has(target as never));
  } catch {
    return false;
  }
}

/** One notification per message the OTHER party sent on a still-active booking -- covers
 * `booking.message_sent` for either side. Best-effort: a booking whose messages fail to
 * load just contributes nothing, same as every other per-booking fan-out in this file. */
async function getMessageNotifications(
  bookings: BookingApiResponse[],
  userId: string,
  spotTitle: string,
): Promise<AppNotification[]> {
  const active = bookings.filter((b) => MESSAGE_ACTIVE_STATUSES.has(b.status));
  const perBooking = await Promise.all(
    active.map((b) =>
      getMessagesApi(b.id)
        .then((messages) =>
          messages
            .filter((m) => m.sender_id !== userId)
            .map((m) => ({
              id: `${m.id}-message_received`,
              kind: 'message_received' as const,
              bookingId: b.id,
              parkingSpotId: b.parking_spot_id,
              spotTitle,
              date: '',
              endDate: '',
              startTime: '',
              endTime: '',
              total: 0,
              at: m.created_at,
            })),
        )
        .catch(() => []),
    ),
  );
  return perBooking.flat();
}

/** Pending rental requests and unreviewed-driver prompts across every spot the user
 * owns -- there's no single endpoint for "all my spots' bookings", so this fans out one
 * call per owned spot (owners realistically have a handful, not hundreds). */
async function getOwnerNotifications(ownerId: string): Promise<AppNotification[]> {
  const spots = await getParkingSpotsForOwner(ownerId);
  const perSpot = await Promise.all(
    spots.map((spot) =>
      getBookingsForSpotApi(spot.id)
        .then(async (bookings) => {
          const requests = bookings
            .filter((b) => b.status === 'PENDING_OWNER_APPROVAL')
            .map((b) => fmt(b, spot.title, 'owner_request'));

          // Reserva ya confirmada (instantánea, o aprobada por el dueño hace
          // rato) -- sin esto, un dueño con reserva instantánea prendida
          // nunca se entera de que le reservaron la cochera hasta que la
          // busca a mano. No hace falta distinguir instantánea de "recién
          // la aprobé yo": deja de ser CONFIRMED en cuanto termina (pasa a
          // COMPLETED), así que esto nunca convive con el recordatorio de
          // reseña de abajo para la misma reserva.
          const newBookings = bookings
            .filter((b) => b.status === 'CONFIRMED')
            .map((b) => fmt(b, spot.title, 'owner_new_booking'));

          const completed = bookings.filter((b) => b.status === 'COMPLETED');
          const reviewPrompts = (
            await Promise.all(
              completed.map(async (b) =>
                (await hasPendingReview(b.id, ownerId, ['driver'])) ? fmt(b, spot.title, 'owner_review_prompt') : null,
              ),
            )
          ).filter((n): n is AppNotification => n !== null);

          // Best-effort: a failure fetching messages must never take down requests/
          // newBookings/reviewPrompts above, which are already-working, more important
          // signals -- caught here instead of letting it reject this whole .then() (which
          // would fall through to the outer .catch(() => []) and silently lose everything
          // for this spot, not just the messages).
          const messages = await getMessageNotifications(bookings, ownerId, spot.title).catch(() => []);

          return [...requests, ...newBookings, ...reviewPrompts, ...messages];
        })
        .catch(() => []),
    ),
  );
  return perSpot.flat();
}

/** Confirmations, rejections, review prompts, and arrival-verification notices on bookings
 * the user made as a driver. A CANCELLED booking only becomes a "rejected" notification when
 * cancellation_reason says the *owner* did it (rejected, or never answered in time) -- not
 * when the driver cancelled their own booking themselves, since they already know that
 * happened. Absent cancellation_reason (a cancelled booking that predates that field) is
 * still treated as a rejection, matching this feed's original behavior from before drivers
 * could cancel. */
async function getDriverNotifications(userId: string): Promise<AppNotification[]> {
  const bookings = await getUserBookingsApi(userId);
  const relevant = bookings.filter(
    (b) => b.status === 'CONFIRMED' || b.status === 'CANCELLED' || b.status === 'COMPLETED',
  );

  const spotIds = [...new Set(bookings.map((b) => b.parking_spot_id))];
  const titleById: Record<string, string> = {};
  await Promise.allSettled(
    spotIds.map((id) =>
      getParkingSpotDetail(id).then((spot) => {
        titleById[id] = spot.title;
      }).catch(() => {
        titleById[id] = id;
      }),
    ),
  );

  const notifications: AppNotification[] = [];
  for (const b of relevant) {
    const title = titleById[b.parking_spot_id] ?? b.parking_spot_id;
    if (b.status === 'CONFIRMED') {
      notifications.push(fmt(b, title, 'driver_confirmed'));
    } else if (b.status === 'CANCELLED' && b.cancellation_reason !== 'DRIVER_CANCELLED') {
      notifications.push(fmt(b, title, 'driver_rejected'));
    }
  }

  const completed = relevant.filter((b) => b.status === 'COMPLETED');
  const reviewPrompts = (
    await Promise.all(
      completed.map(async (b) =>
        (await hasPendingReview(b.id, userId, ['spot', 'owner']))
          ? fmt(b, titleById[b.parking_spot_id] ?? b.parking_spot_id, 'driver_review_prompt')
          : null,
      ),
    )
  ).filter((n): n is AppNotification => n !== null);

  // `booking.verified` -- the driver arrived and the owner entered their code. verified_at
  // is set once and never unset, so this is a permanent fact about the booking regardless
  // of its current status (it may since have gone to COMPLETED).
  const verifiedNotifications = bookings
    .filter((b) => !!b.verified_at)
    .map((b) => ({
      ...fmt(b, titleById[b.parking_spot_id] ?? b.parking_spot_id, 'driver_verified'),
      at: b.verified_at!,
    }));

  // Same reasoning as getOwnerNotifications: a failure here must not take down
  // notifications/reviewPrompts/verifiedNotifications above.
  const messages = await getMessageNotifications(bookings, userId, '')
    .then((msgs) => msgs.map((m) => ({ ...m, spotTitle: titleById[m.parkingSpotId] ?? m.parkingSpotId })))
    .catch(() => []);

  return [...notifications, ...reviewPrompts, ...verifiedNotifications, ...messages];
}

/** `settlement.paid` -- every settlement ParkLink has confirmed paying this owner. There's
 * no concept of "recent" here (a Settlement's status never reverts once PAID), but that's
 * fine: useNotificationsStore's seenIds already makes an old, already-opened one stop
 * counting toward the unread badge without it ever disappearing from the list. */
async function getSettlementNotifications(ownerId: string): Promise<AppNotification[]> {
  const settlements = await getSettlementsForOwner(ownerId);
  return settlements.map((s) => ({
    id: `${s.id}-owner_settlement_paid`,
    kind: 'owner_settlement_paid' as const,
    bookingId: '',
    parkingSpotId: '',
    spotTitle: '',
    date: '',
    endDate: '',
    startTime: '',
    endTime: '',
    total: s.netAmount / 100,
    at: s.paidAt ?? s.createdAt,
    settlementId: s.id,
  }));
}

/** `support.ticket_replied` -- every ticket this user opened (as driver or owner, on any
 * booking) that has at least one staff reply. Keyed by the last reply's own message id
 * (not the ticket id) so a brand-new reply on a ticket the user already saw produces a
 * fresh, genuinely-unread notification instead of staying marked seen forever. */
async function getTicketReplyNotifications(userId: string): Promise<AppNotification[]> {
  const tickets = await getUserTicketsApi(userId);
  return tickets
    .filter((t) => !!t.last_admin_reply_id)
    .map((t) => ({
      id: `${t.last_admin_reply_id}-ticket_replied`,
      kind: 'ticket_replied' as const,
      bookingId: t.booking_id,
      parkingSpotId: '',
      spotTitle: t.subject,
      date: '',
      endDate: '',
      startTime: '',
      endTime: '',
      total: 0,
      at: t.last_admin_reply_at ?? t.updated_at,
      ticketId: t.id,
    }));
}

/** Combines every role's and every source's notifications -- the same account can own
 * spots, also book other people's, and has exactly one ticket history regardless of which
 * "mode" the app is currently showing. */
export async function getNotifications(userId: string): Promise<AppNotification[]> {
  const [owner, driver, settlements, tickets] = await Promise.all([
    getOwnerNotifications(userId).catch(() => []),
    getDriverNotifications(userId).catch(() => []),
    getSettlementNotifications(userId).catch(() => []),
    getTicketReplyNotifications(userId).catch(() => []),
  ]);
  return [...owner, ...driver, ...settlements, ...tickets].sort((a, b) => (a.at < b.at ? 1 : -1));
}
