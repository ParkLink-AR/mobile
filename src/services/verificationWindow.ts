import { t } from '@/src/i18n';
import { formatShortDateFromISO, formatTime } from '@/src/services/bookingDates';
import { artDateFromISO } from '@/src/services/dateUtils';

// Mirrors booking-service's VerificationOpensBeforeStart: the owner can enter the driver's
// arrival code from 30 minutes before the booking starts until it ends.
const OPENS_BEFORE_START_MS = 30 * 60 * 1000;

export type VerificationWindowState = 'not_open_yet' | 'open' | 'closed';

export function verificationOpensAt(startAt: string): Date {
  return new Date(new Date(startAt).getTime() - OPENS_BEFORE_START_MS);
}

export function verificationWindowState(startAt: string, endAt: string, now: Date = new Date()): VerificationWindowState {
  if (now < verificationOpensAt(startAt)) return 'not_open_yet';
  if (now >= new Date(endAt)) return 'closed';
  return 'open';
}

/** "Disponible desde las 14:30" (hoy) or "Disponible el 12/10/2026 desde las 14:30". */
export function verificationAvailableFromLabel(startAt: string, now: Date = new Date()): string {
  const opensAt = verificationOpensAt(startAt).toISOString();
  const time = formatTime(opensAt);
  if (artDateFromISO(opensAt) === artDateFromISO(now.toISOString())) {
    return t('owner.verify.availableFromTime', { time });
  }
  return t('owner.verify.availableFromDate', { date: formatShortDateFromISO(opensAt), time });
}
