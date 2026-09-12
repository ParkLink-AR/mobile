import { t } from '@/src/i18n';
import { StayBreakdown } from '@/src/api/parking';

export function delay<T>(value: T, ms = 400): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

const SERVICE_FEE_RATE = 0.05;

export function getDriverVisiblePrice(basePricePerHour: number): number {
  return Math.round(basePricePerHour * (1 + SERVICE_FEE_RATE));
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
