import { firstFreeStayStart } from '../stayAvailability';
import type { StayDayAvailability } from '@/src/api/parking';

jest.mock('@/src/api/parking', () => ({}));

const days = (statuses: Record<string, 'available' | 'unavailable'>): StayDayAvailability[] =>
  Object.entries(statuses).map(([date, status]) => ({ date, status }));

describe('firstFreeStayStart', () => {
  it('skips taken days and lands on the first day free along with the next', () => {
    const calendar = days({
      '2026-10-12': 'unavailable',
      '2026-10-13': 'available',
      '2026-10-14': 'unavailable',
      '2026-10-15': 'available',
      '2026-10-16': 'available',
    });
    expect(firstFreeStayStart(calendar, '2026-10-13')).toBe('2026-10-15');
  });

  it('never goes before the given day', () => {
    const calendar = days({ '2026-10-12': 'available', '2026-10-13': 'available', '2026-10-14': 'available' });
    expect(firstFreeStayStart(calendar, '2026-10-13')).toBe('2026-10-13');
  });

  it('is null when no two free days in a row are left', () => {
    const calendar = days({ '2026-10-13': 'available', '2026-10-14': 'unavailable', '2026-10-15': 'available' });
    expect(firstFreeStayStart(calendar, '2026-10-13')).toBeNull();
  });
});
