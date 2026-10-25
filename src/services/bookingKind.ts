import { Booking } from '@/src/types';

/** The i18n key of a booking's kind, as shown on it ("Por hora", "Media estadía (12 h)", "Estadía"). */
export function bookingKindLabelKey(kind: Booking['kind']): string {
  if (kind === 'STAY') return 'driver.booking.kind.stay';
  if (kind === 'HALF_DAY') return 'driver.booking.kind.halfDay';
  return 'driver.booking.kind.hourly';
}

/** Whether a booking of this kind ends with the exit code once its arrival was verified -- hourly
 * bookings and half-days, like booking-service's BookingKind.TracksExit. */
export function tracksExit(kind: Booking['kind']): boolean {
  return kind === 'HOURLY' || kind === 'HALF_DAY';
}
