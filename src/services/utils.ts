import { t } from '@/src/i18n';
import { StayBreakdown } from '@/src/api/parking';

/**
 * What the driver actually pays for a given owner-set price: the owner's own price plus
 * the platform's current commission added on top (the owner always receives their price
 * in full -- see useCommissionStore and booking-service's Service.addCommission, which
 * computes this exact same total server-side at the moment a booking is actually created).
 * ratePercent is a plain percentage (5 means 5%), not basis points.
 */
export function getDriverVisiblePrice(ownerPrice: number, ratePercent: number): number {
  return Math.round(ownerPrice * (1 + ratePercent / 100));
}

function pluralKey(base: string, count: number): string {
  return `${base}.${count === 1 ? 'one' : 'other'}`;
}

/** "1 semana + 2 días", "1 mes + 5 días" -- mismo desglose que
 * StaysService.getQuote (parking-service) usa para cobrar, mostrado tal
 * cual en spot/[id].tsx y booking/confirm-stay.tsx. */
export function formatStayBreakdown(breakdown: StayBreakdown): string {
  const parts: string[] = [];
  if (breakdown.months > 0) {
    parts.push(t(pluralKey('spot.stay.breakdown.months', breakdown.months), { count: breakdown.months }));
  }
  if (breakdown.weeks > 0) {
    parts.push(t(pluralKey('spot.stay.breakdown.weeks', breakdown.weeks), { count: breakdown.weeks }));
  }
  if (breakdown.days > 0) {
    parts.push(t(pluralKey('spot.stay.breakdown.days', breakdown.days), { count: breakdown.days }));
  }
  return parts.join(' + ');
}
