import { bookingKindLabelKey, tracksExit } from '@/src/services/bookingKind';

describe('booking kinds', () => {
  it('each has its own label', () => {
    expect(bookingKindLabelKey('HOURLY')).toBe('driver.booking.kind.hourly');
    expect(bookingKindLabelKey('HALF_DAY')).toBe('driver.booking.kind.halfDay');
    expect(bookingKindLabelKey('STAY')).toBe('driver.booking.kind.stay');
  });

  it('hourly bookings and half-days end with the exit code, stays do not', () => {
    expect(tracksExit('HOURLY')).toBe(true);
    expect(tracksExit('HALF_DAY')).toBe(true);
    expect(tracksExit('STAY')).toBe(false);
  });
});
