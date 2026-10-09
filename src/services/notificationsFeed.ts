import { InboxNotificationApi, listNotificationsApi } from '@/src/api/notifications';
import { getPublicProfileApi } from '@/src/api/auth';
import { mapBookingDateRange } from '@/src/services/bookingDates';

// The notifications tab is the user's inbox on notifications-service: one entry per thing
// that happened to them (a booking confirmed, a request to answer, a message...), saved
// when it happened and read/unread on the server. This file only turns those entries into
// what the screen renders.

export type NotificationKind =
  | 'owner_request'
  | 'driver_confirmed'
  | 'driver_rejected'
  // The owner never answered the request in time; the driver was refunded.
  | 'driver_request_expired'
  // The owner's account was closed or suspended, so the booking was cancelled and refunded.
  | 'driver_spot_unavailable'
  // The driver cancelled, or their account was closed: the slot is free again.
  | 'owner_booking_cancelled'
  | 'driver_review_prompt'
  | 'owner_review_prompt'
  | 'driver_verified'
  | 'message_received'
  | 'ticket_replied'
  | 'owner_settlement_paid'
  // An admin approved (it's published) or rejected (with a reason) the owner's new spot.
  | 'owner_spot_approved'
  | 'owner_spot_rejected';

const KNOWN_KINDS = new Set<NotificationKind>([
  'owner_request',
  'driver_confirmed',
  'driver_rejected',
  'driver_request_expired',
  'driver_spot_unavailable',
  'owner_booking_cancelled',
  'driver_review_prompt',
  'owner_review_prompt',
  'driver_verified',
  'message_received',
  'ticket_replied',
  'owner_settlement_paid',
  'owner_spot_approved',
  'owner_spot_rejected',
]);

/** Which side of the app a notification belongs to -- shown as the car/building icon on
 * each one, and decides which side of a booking tapping it opens, regardless of the mode
 * the user happens to be in. */
export type NotificationRole = 'driver' | 'owner';

const OWNER_KINDS = new Set<NotificationKind>([
  'owner_request',
  'owner_booking_cancelled',
  'owner_review_prompt',
  'owner_settlement_paid',
  'owner_spot_approved',
  'owner_spot_rejected',
]);

/** item.role, falling back by kind for an entry the server saved without one. */
export function notificationRole(item: Pick<AppNotification, 'kind'> & { role?: NotificationRole | null }): NotificationRole {
  return item.role ?? (OWNER_KINDS.has(item.kind) ? 'owner' : 'driver');
}

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  role: NotificationRole | null;
  bookingId: string;
  parkingSpotId: string;
  /** Rendered as the notification's title. For ticket_replied it's the ticket's subject;
   * for owner_settlement_paid it's blank and the screen shows a fixed, translated title. */
  spotTitle: string;
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  /** Pesos: the booking's total, or the settlement's deposited amount. */
  total: number;
  /** When it happened (ISO), newest first. */
  at: string;
  readAt: string | null;
  /** owner_request only: true once it no longer waits for the owner's answer. */
  resolved: boolean;
  /** message_received / ticket_replied: the start of the message; owner_spot_rejected: the
   * admin's reason. */
  preview?: string;
  /** The other person on the booking, by name -- "Calificá a Juan Pérez" instead of
   * "Calificá al conductor". Best-effort: absent if their profile couldn't be loaded. */
  counterpartName?: string;
  /** owner_review_prompt: who to review. */
  driverId?: string;
  settlementId?: string;
  ticketId?: string;
}

const str = (value: unknown): string => (typeof value === 'string' ? value : '');
const num = (value: unknown): number => (typeof value === 'number' ? value : 0);

/** One inbox entry as the screen renders it, or null for a kind this version of the app
 * doesn't know yet (sent by a newer backend). */
export function toAppNotification(entry: InboxNotificationApi): AppNotification | null {
  if (!KNOWN_KINDS.has(entry.kind as NotificationKind)) return null;
  const kind = entry.kind as NotificationKind;
  const data = entry.data ?? {};
  const start = str(data.start);
  const end = str(data.end);
  const dates = start && end
    ? mapBookingDateRange(start, end)
    : { date: '', endDate: '', startTime: '', endTime: '' };

  return {
    id: entry.id,
    kind,
    role: entry.role,
    bookingId: str(data.booking_id),
    parkingSpotId: str(data.parking_spot_id),
    spotTitle: kind === 'ticket_replied' ? str(data.subject) : str(data.spot_title),
    date: dates.date,
    endDate: dates.endDate,
    startTime: dates.startTime,
    endTime: dates.endTime,
    total: kind === 'owner_settlement_paid' ? num(data.net_amount) / 100 : num(data.amount) / 100,
    at: entry.created_at,
    readAt: entry.read_at,
    resolved: !!entry.resolved_at,
    preview: str(data.preview) || str(data.notes) || undefined,
    driverId: str(data.driver_user_id) || undefined,
    settlementId: str(data.settlement_id) || undefined,
    ticketId: str(data.ticket_id) || undefined,
  };
}

// Display names barely ever change -- cached for the session instead of refetched each
// time the inbox reloads.
const nameCache = new Map<string, string>();

async function displayName(userId: string): Promise<string | undefined> {
  const cached = nameCache.get(userId);
  if (cached) return cached;
  try {
    const { name } = await getPublicProfileApi(userId);
    if (name) nameCache.set(userId, name);
    return name || undefined;
  } catch {
    return undefined;
  }
}

/** "Calificá a Juan Pérez": puts the driver's name on the owner's review prompts. */
async function withCounterpartNames(items: AppNotification[]): Promise<AppNotification[]> {
  const ids = [...new Set(items.filter((i) => i.kind === 'owner_review_prompt' && i.driverId).map((i) => i.driverId!))];
  const names = new Map<string, string | undefined>();
  await Promise.all(ids.map(async (id) => names.set(id, await displayName(id))));
  return items.map((item) =>
    item.driverId && names.get(item.driverId) ? { ...item, counterpartName: names.get(item.driverId) } : item,
  );
}

export interface NotificationsPage {
  items: AppNotification[];
  unreadCount: number;
  nextBefore: string | null;
}

/** One page of the inbox (the newest one without `before`), or null when the session
 * ended meanwhile (request() resolves undefined while logging the user out). */
export async function getNotificationsPage(before?: string): Promise<NotificationsPage | null> {
  const page = await listNotificationsApi(before);
  if (!page) return null;
  const items = page.items.map(toAppNotification).filter((n): n is AppNotification => n !== null);
  return {
    items: await withCounterpartNames(items),
    unreadCount: page.unread_count,
    nextBefore: page.next_before,
  };
}
