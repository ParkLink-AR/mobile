import { Settlement, SettlementPayout } from '@/src/types';
import { request } from './client';

// ── Wire shapes returned by booking-service ──────────────────────────────────
// Same shape admin-backend's src/api/admin.ts consumes for the draft/confirm
// flow -- this is the read-only, owner-facing half of it.

export interface SettlementPayoutApiResponse {
  id: string;
  booking_id: string;
  gross_amount: number;
  commission_amount: number;
  net_amount: number;
}

export interface SettlementApiResponse {
  id: string;
  owner_id: string;
  gross_amount: number;
  commission_amount: number;
  net_amount: number;
  status: 'PENDING' | 'PAID';
  proof_url: string | null;
  paid_at: string | null;
  paid_by_admin_id: string | null;
  created_by_admin_id: string;
  created_at: string;
  // Only populated on the single-settlement detail fetch, never on the list.
  payouts?: SettlementPayoutApiResponse[];
}

function toSettlementPayout(p: SettlementPayoutApiResponse): SettlementPayout {
  return {
    id: p.id,
    bookingId: p.booking_id,
    grossAmount: p.gross_amount,
    commissionAmount: p.commission_amount,
    netAmount: p.net_amount,
  };
}

export function toSettlement(s: SettlementApiResponse): Settlement {
  return {
    id: s.id,
    ownerId: s.owner_id,
    grossAmount: s.gross_amount,
    commissionAmount: s.commission_amount,
    netAmount: s.net_amount,
    status: s.status,
    proofUrl: s.proof_url,
    paidAt: s.paid_at,
    paidByAdminId: s.paid_by_admin_id,
    createdByAdminId: s.created_by_admin_id,
    createdAt: s.created_at,
    payouts: s.payouts?.map(toSettlementPayout),
  };
}

/**
 * The owner's own settlement history -- PAID ones only (a still-in-progress
 * admin draft is intentionally invisible here, it isn't "their money" until
 * confirmed). Newest first. Doesn't include each settlement's payouts -- see
 * getSettlementApi for the detail fetch.
 *
 * GET /users/{userId}/settlements
 */
export async function getUserSettlementsApi(userId: string): Promise<SettlementApiResponse[]> {
  return request(`/users/${userId}/settlements`);
}

/**
 * A single settlement, with its payouts populated. Self-service -- any
 * logged-in user's token works, but booking-service enforces you can only
 * fetch your own: a 403 (not yours) or 404 (doesn't exist / not yet
 * confirmed) can happen, same as any other ApiError case.
 *
 * GET /settlements/{id}
 */
export async function getSettlementApi(id: string): Promise<SettlementApiResponse> {
  return request(`/settlements/${id}`);
}
