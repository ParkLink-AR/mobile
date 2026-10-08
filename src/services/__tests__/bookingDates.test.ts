import { setLanguage } from '@/src/i18n';
import {
  formatBookingWhen,
  formatLongDate,
  formatLongDateTime,
  formatShortDate,
  formatShortDateTime,
  mapBookingDateRange,
} from '@/src/services/bookingDates';

describe('date formats', () => {
  afterEach(() => setLanguage('es'));

  it('long: "14 de septiembre de 2026"', () => {
    expect(formatLongDate('2026-09-14')).toBe('14 de septiembre de 2026');
    expect(formatLongDate('2026-01-01')).toBe('1 de enero de 2026');
  });

  it('short: "14/09/2026"', () => {
    expect(formatShortDate('2026-09-14')).toBe('14/09/2026');
  });

  it('always on Buenos Aires time, whatever the phone says', () => {
    // 02:30 UTC on the 15th is still the 14th at 23:30 in Buenos Aires.
    expect(formatShortDateTime('2026-09-15T02:30:00Z')).toBe('14/09/2026 23:30');
    expect(formatLongDateTime('2026-09-15T02:30:00Z')).toBe('14 de septiembre de 2026, 23:30');
  });

  it('follows the app language in the long format', () => {
    setLanguage('en');
    expect(formatLongDate('2026-09-14')).toBe('September 14, 2026');
    setLanguage('ja');
    expect(formatLongDate('2026-09-14')).toBe('2026年9月14日');
  });

  it('booking line, short and long', () => {
    const range = mapBookingDateRange('2026-09-14T13:00:00Z', '2026-09-14T16:00:00Z');
    expect(formatBookingWhen(range, 'a', 'Check-in', 'Check-out')).toBe('14/09/2026 10:00 a 13:00');
    expect(formatBookingWhen(range, 'a', 'Check-in', 'Check-out', 'long')).toBe('14 de septiembre de 2026, 10:00 a 13:00');
  });

  it('multi-day stay gets check-in and check-out', () => {
    const range = mapBookingDateRange('2026-09-14T13:00:00Z', '2026-09-16T13:00:00Z');
    expect(formatBookingWhen(range, 'a', 'Check-in', 'Check-out')).toBe(
      'Check-in 14/09/2026 10:00 — Check-out 16/09/2026 10:00',
    );
  });
});
