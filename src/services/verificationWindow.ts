import { t } from '@/src/i18n';

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

/** "Disponible desde las 14:30" (hoy) or "Disponible el 12/10 desde las 14:30". */
export function verificationAvailableFromLabel(startAt: string, now: Date = new Date()): string {
  const opensAt = verificationOpensAt(startAt);
  const time = opensAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (opensAt.toDateString() === now.toDateString()) {
    return t('owner.verify.availableFromTime', { time });
  }
  const date = opensAt.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
  return t('owner.verify.availableFromDate', { date, time });
}
