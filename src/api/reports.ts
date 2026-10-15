import { request } from './client';

export type ReportTargetType = 'spot' | 'user' | 'review' | 'booking';

/**
 * Reports a spot, a person, a review, or a problem with a booking to ParkLink staff, who see it in the admin panel's
 * "Denuncias" queue.
 *
 * POST /reports
 */
export async function createReportApi(
  targetType: ReportTargetType,
  targetId: string,
  reason: string,
  details?: string,
): Promise<void> {
  await request(`/reports`, {
    method: 'POST',
    body: JSON.stringify({ target_type: targetType, target_id: targetId, reason, details: details ?? '' }),
  });
}
