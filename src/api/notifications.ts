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
