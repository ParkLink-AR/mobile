import { request } from './client';

export type DevicePlatform = 'android' | 'ios';

/**
 * Registers (or refreshes) this device's FCM token so notifications-service
 * can push to it. Upsert by token on the backend.
 *
 * PUT /notifications/tokens
 */
export async function putDeviceToken(token: string, platform: DevicePlatform): Promise<void> {
  await request('/notifications/tokens', {
    method: 'PUT',
    body: JSON.stringify({ token, platform }),
  });
}

/**
 * Drops this device's token on logout so the next user on this device doesn't
 * inherit the previous one's notifications.
 *
 * DELETE /notifications/tokens/{token}
 */
export async function deleteDeviceToken(token: string): Promise<void> {
  await request(`/notifications/tokens/${encodeURIComponent(token)}`, { method: 'DELETE' });
}

/** One entry of the user's notifications inbox, as notifications-service stores it. */
export interface InboxNotificationApi {
  id: string;
  kind: string;
  role: 'driver' | 'owner' | null;
  /** The Spanish push texts -- the app renders its own, translated text from kind + data. */
  title: string;
  body: string;
  data: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
  /** For a booking request: when it stopped waiting for the owner's answer. */
  resolved_at: string | null;
}

export interface InboxPageApi {
  items: InboxNotificationApi[];
  unread_count: number;
  /** Pass as `before` to get the next (older) page; null when there's none. */
  next_before: string | null;
}

/**
 * The user's notifications, newest first, plus their unread count.
 *
 * GET /notifications
 */
export async function listNotificationsApi(before?: string): Promise<InboxPageApi> {
  const query = before ? `?before=${encodeURIComponent(before)}` : '';
  return request(`/notifications${query}`);
}

/**
 * Marks the given notifications -- or all of them when `ids` is omitted -- as read.
 *
 * POST /notifications/read
 */
export async function markNotificationsReadApi(ids?: string[]): Promise<{ unread_count: number }> {
  return request('/notifications/read', {
    method: 'POST',
    body: JSON.stringify(ids ? { ids } : {}),
  });
}
