import { getParkingSpotsForOwner } from '@/src/services/parkingService';
import { getBookingsForSpotApi, getUserBookingsApi, getBookingReviewsApi, BookingApiResponse } from '@/src/api/booking';
import { getParkingSpotDetail } from '@/src/api/parking';

export type NotificationKind =
  | 'owner_request'
  | 'owner_new_booking'
  | 'driver_confirmed'
  | 'driver_rejected'
  | 'driver_review_prompt'
  | 'owner_review_prompt';

export interface AppNotification {
  /** bookingId -- unique per notification, a booking only ever shows one
   * active kind at a time from a given user's point of view. */
  id: string;
  kind: NotificationKind;
  bookingId: string;
  parkingSpotId: string;
  spotTitle: string;
  date: string;
  startTime: string;
  endTime: string;
  total: number;
  at: string; // ISO timestamp, for sorting (most recent first)
}

function fmt(b: BookingApiResponse, spotTitle: string, kind: NotificationKind): AppNotification {
  const start = new Date(b.start);
  const end = new Date(b.end);
  return {
    id: `${b.id}-${kind}`,
    kind,
    bookingId: b.id,
    parkingSpotId: b.parking_spot_id,
    spotTitle,
    date: b.start.slice(0, 10),
    startTime: start.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }),
    endTime: end.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }),
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

          return [...requests, ...newBookings, ...reviewPrompts];
        })
        .catch(() => []),
    ),
  );
  return perSpot.flat();
}

/** Confirmations, rejections, and review prompts on bookings the user made as a driver.
 * A driver-initiated cancel doesn't exist yet, so every CANCELLED booking today is one
 * the owner rejected (or never answered in time) -- refunded automatically either way. */
async function getDriverNotifications(userId: string): Promise<AppNotification[]> {
  const bookings = await getUserBookingsApi(userId);
  const relevant = bookings.filter(
    (b) => b.status === 'CONFIRMED' || b.status === 'CANCELLED' || b.status === 'COMPLETED',
  );
  if (relevant.length === 0) return [];

  const spotIds = [...new Set(relevant.map((b) => b.parking_spot_id))];
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
    } else if (b.status === 'CANCELLED') {
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

  return [...notifications, ...reviewPrompts];
}

/** Combines both roles' notifications -- the same account can own spots and
 * also book other people's, so both queues matter regardless of which
 * "mode" the app is currently showing. */
export async function getNotifications(userId: string): Promise<AppNotification[]> {
  const [owner, driver] = await Promise.all([
    getOwnerNotifications(userId).catch(() => []),
    getDriverNotifications(userId).catch(() => []),
  ]);
  return [...owner, ...driver].sort((a, b) => (a.at < b.at ? 1 : -1));
}
