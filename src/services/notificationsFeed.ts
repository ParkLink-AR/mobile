import { getParkingSpotsForOwner } from '@/src/services/parkingService';
import { getBookingsForSpotApi, getUserBookingsApi, BookingApiResponse } from '@/src/api/booking';
import { getParkingSpotDetail } from '@/src/api/parking';

export type NotificationKind = 'owner_request' | 'driver_confirmed' | 'driver_rejected';

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
    id: b.id,
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

/** Pending rental requests across every spot the user owns -- there's no
 * single endpoint for "all my spots' bookings", so this fans out one call
 * per owned spot (owners realistically have a handful, not hundreds). */
async function getOwnerNotifications(ownerId: string): Promise<AppNotification[]> {
  const spots = await getParkingSpotsForOwner(ownerId);
  const perSpot = await Promise.all(
    spots.map((spot) =>
      getBookingsForSpotApi(spot.id)
        .then((bookings) =>
          bookings
            .filter((b) => b.status === 'PENDING_OWNER_APPROVAL')
            .map((b) => fmt(b, spot.title, 'owner_request')),
        )
        .catch(() => []),
    ),
  );
  return perSpot.flat();
}

/** Confirmations and rejections on bookings the user made as a driver. A
 * driver-initiated cancel doesn't exist yet, so every CANCELLED booking
 * today is one the owner rejected (or never answered in time) -- refunded
 * automatically either way. */
async function getDriverNotifications(userId: string): Promise<AppNotification[]> {
  const bookings = await getUserBookingsApi(userId);
  const relevant = bookings.filter((b) => b.status === 'CONFIRMED' || b.status === 'CANCELLED');
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

  return relevant.map((b) =>
    fmt(b, titleById[b.parking_spot_id] ?? b.parking_spot_id, b.status === 'CONFIRMED' ? 'driver_confirmed' : 'driver_rejected'),
  );
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
