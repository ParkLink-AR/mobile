import { formatCountdown, holdRemainingMs } from '../checkout';

jest.mock('expo-web-browser', () => ({}));
jest.mock('@/src/api/booking', () => ({}));

describe('holdRemainingMs', () => {
  const now = Date.parse('2026-10-12T20:00:00Z');

  it('is the time left until the hold expires', () => {
    expect(holdRemainingMs('2026-10-12T20:04:05Z', now)).toBe(245_000);
  });

  it('is 0 once the hold is over, or without one', () => {
    expect(holdRemainingMs('2026-10-12T19:59:00Z', now)).toBe(0);
    expect(holdRemainingMs(undefined, now)).toBe(0);
  });
});

describe('formatCountdown', () => {
  it('shows minutes and two-digit seconds', () => {
    expect(formatCountdown(245_000)).toBe('4:05');
    expect(formatCountdown(59_000)).toBe('0:59');
  });

  it('rounds a partial second up, so it never shows 0:00 while time is left', () => {
    expect(formatCountdown(400)).toBe('0:01');
  });
});
