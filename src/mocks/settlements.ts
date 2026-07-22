import { Settlement } from '@/src/types';
import { mockOwner } from './users';
import { mockBookingsForOwner } from './bookings';

export const mockSettlements: Settlement[] = [
  {
    id: 'settlement-1',
    ownerId: mockOwner.id,
    period: 'Junio 2026',
    totalAmount: 45300,
    commissionRetained: 4530,
    bookingIds: mockBookingsForOwner
      .filter((b) => b.status === 'COMPLETED')
      .map((b) => b.id),
  },
  {
    id: 'settlement-2',
    ownerId: mockOwner.id,
    period: 'Mayo 2026',
    totalAmount: 38900,
    commissionRetained: 3890,
    bookingIds: [],
  },
];
