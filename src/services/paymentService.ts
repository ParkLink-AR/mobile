import { Settlement } from '@/src/types';
import { getUserSettlementsApi, getSettlementApi, toSettlement } from '@/src/api/settlements';
/** The owner's own settlement history (PENDING drafts and PAID), newest first. */
export async function getSettlementsForOwner(ownerId: string): Promise<Settlement[]> {
  const response = await getUserSettlementsApi(ownerId);
  return response.map(toSettlement);
}

/**
 * A single settlement with its payouts populated. Throws ApiError (403/404)
 * if it doesn't belong to the caller -- same as any other real API call in
 * this app, callers should catch it.
 */
export async function getSettlementById(id: string): Promise<Settlement> {
  const response = await getSettlementApi(id);
  return toSettlement(response);
}
