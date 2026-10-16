import { Alert, Platform } from 'react-native';
import { confirmChangedTotal, debtBookingDay, debtChanged, formatDebtPesos, pendingTotal, toDebt, type Debt } from '../debts';
import { toAppNotification } from '../notificationsFeed';

jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));
jest.mock('@/src/api/booking', () => ({ getMyDebtsApi: jest.fn() }));
jest.mock('@/src/api/notifications', () => ({ listNotificationsApi: jest.fn() }));

function debt(overrides: Partial<Debt> = {}): Debt {
  return {
    id: 'd1', status: 'PENDING', amount: 600, minutes: 20, bookingId: 'b1',
    bookingStart: '2026-10-12T18:00:00-03:00', spotTitle: 'Cochera Centro', ...overrides,
  };
}

describe('toDebt', () => {
  it('turns centavos into pesos and keeps where and when it comes from', () => {
    const mapped = toDebt({
      id: 'd1', status: 'RESERVED', amount: 53333, minutes: 32, booking_id: 'b1',
      booking_start: '2026-10-12T18:00:00-03:00', booking_end: '2026-10-12T20:00:00-03:00',
      parking_spot_id: 's1', parking_spot_title: 'Cochera Centro', charged_booking_id: 'b2',
      created_at: '2026-10-12T20:40:00-03:00',
    });

    expect(mapped).toMatchObject({
      id: 'd1', status: 'RESERVED', amount: 533.33, minutes: 32, bookingId: 'b1',
      spotTitle: 'Cochera Centro', chargedBookingId: 'b2',
    });
  });
});

describe('pendingTotal', () => {
  it('adds up only the balances nobody has asked for yet -- what the next booking carries', () => {
    expect(pendingTotal([
      debt({ amount: 600 }),
      debt({ id: 'd2', amount: 400 }),
      debt({ id: 'd3', amount: 900, status: 'RESERVED' }),
      debt({ id: 'd4', amount: 1200, status: 'PAID' }),
    ])).toBe(1000);
  });

  it('is zero when nothing is owed', () => {
    expect(pendingTotal([])).toBe(0);
  });
});

describe('formatDebtPesos', () => {
  it('shows whole pesos without decimals', () => {
    expect(formatDebtPesos(640)).toBe('$640');
    expect(formatDebtPesos(17280)).toBe('$17.280');
  });

  it('shows centavos when there are some', () => {
    expect(formatDebtPesos(533.33)).toBe('$533,33');
  });
});

describe('debtBookingDay', () => {
  it('is the day of the booking that was overstayed, in Buenos Aires', () => {
    expect(debtBookingDay(debt())).toBe('12/10/2026');
  });
});

describe('debtChanged', () => {
  it('is false when the booking took on exactly what the confirmation showed', () => {
    expect(debtChanged(1000, 100000)).toBe(false);
    expect(debtChanged(0, undefined)).toBe(false);
  });

  it('is true when it took on more, less, or something where none was shown', () => {
    expect(debtChanged(1000, 150000)).toBe(true);
    expect(debtChanged(1000, undefined)).toBe(true);
    expect(debtChanged(0, 60000)).toBe(true);
  });
});

describe('confirmChangedTotal', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('goes on without asking where Alert has no buttons (web)', async () => {
    const original = Platform.OS;
    Platform.OS = 'web';
    try {
      await expect(confirmChangedTotal(1600)).resolves.toBe(true);
    } finally {
      Platform.OS = original;
    }
  });

  it('asks with the new total, and resolves with what the driver chose', async () => {
    const original = Platform.OS;
    Platform.OS = 'android';
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, message, buttons) => {
      expect(message).toContain('$1.600');
      buttons?.find((button) => button.style === 'cancel')?.onPress?.();
    });
    try {
      await expect(confirmChangedTotal(1600)).resolves.toBe(false);
      expect(alert).toHaveBeenCalledTimes(1);
    } finally {
      Platform.OS = original;
    }
  });
});

describe('overstay notifications', () => {
  const entry = (kind: string, role: 'driver' | 'owner', amount: number) => ({
    id: 'n1', kind, role, created_at: '2026-10-12T20:40:00Z', read_at: null, resolved_at: null,
    data: {
      booking_id: 'b1', parking_spot_id: 's1', spot_title: 'Cochera Centro',
      start: '2026-10-12T18:00:00-03:00', end: '2026-10-12T20:00:00-03:00', amount: 240000,
      overstay_minutes: 20, overstay_amount: amount,
    },
  });

  it('carries how long and how much for the driver', () => {
    const item = toAppNotification(entry('driver_overstay_charged', 'driver', 80000) as never);

    expect(item).toMatchObject({ kind: 'driver_overstay_charged', overstayMinutes: 20, overstayAmount: 800 });
  });

  it('carries how long and how much for the owner', () => {
    const item = toAppNotification(entry('owner_overstay_paid', 'owner', 66667) as never);

    expect(item).toMatchObject({ kind: 'owner_overstay_paid', overstayMinutes: 20, overstayAmount: 666.67 });
  });
});
