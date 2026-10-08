import * as notificationsApi from '@/src/api/notifications';
import type { InboxNotificationApi } from '@/src/api/notifications';
import { toAppNotification } from '@/src/services/notificationsFeed';
import { isOpenRequest, useNotificationsStore } from '@/src/store/useNotificationsStore';

jest.mock('@/src/api/notifications');
jest.mock('@/src/api/auth', () => ({
  getPublicProfileApi: jest.fn().mockResolvedValue({ name: 'Lucas Gomez' }),
}));

const api = notificationsApi as jest.Mocked<typeof notificationsApi>;

function entry(overrides: Partial<InboxNotificationApi> = {}): InboxNotificationApi {
  return {
    id: 'n1',
    kind: 'driver_confirmed',
    role: 'driver',
    title: '✅ ¡Reserva confirmada!',
    body: '…',
    data: {
      booking_id: 'b1',
      parking_spot_id: 's1',
      spot_title: 'Cochera Palermo',
      start: '2026-10-09T13:00:00+00:00',
      end: '2026-10-09T16:00:00+00:00',
      amount: 892500,
    },
    created_at: '2026-10-08T15:00:00+00:00',
    read_at: null,
    resolved_at: null,
    ...overrides,
  };
}

describe('toAppNotification', () => {
  it('maps a booking notification', () => {
    const n = toAppNotification(entry())!;
    expect(n).toMatchObject({
      id: 'n1',
      kind: 'driver_confirmed',
      role: 'driver',
      bookingId: 'b1',
      parkingSpotId: 's1',
      spotTitle: 'Cochera Palermo',
      date: '2026-10-09',
      startTime: '10:00',
      endTime: '13:00',
      total: 8925,
      at: '2026-10-08T15:00:00+00:00',
      readAt: null,
      resolved: false,
    });
  });

  it('uses the subject as title for a ticket reply and keeps the preview', () => {
    const n = toAppNotification(
      entry({ kind: 'ticket_replied', data: { booking_id: 'b1', ticket_id: 't1', subject: 'Cobro doble', preview: 'Ya lo revisamos' } }),
    )!;
    expect(n).toMatchObject({ spotTitle: 'Cobro doble', ticketId: 't1', preview: 'Ya lo revisamos' });
  });

  it('reads the deposited amount of a settlement', () => {
    const n = toAppNotification(entry({ kind: 'owner_settlement_paid', role: 'owner', data: { settlement_id: 'st1', net_amount: 7267500 } }))!;
    expect(n.total).toBe(72675);
    expect(n.settlementId).toBe('st1');
  });

  it('skips a kind this app version does not know', () => {
    expect(toAppNotification(entry({ kind: 'something_new' }))).toBeNull();
  });
});

describe('useNotificationsStore', () => {
  beforeEach(() => {
    useNotificationsStore.getState().clear();
    jest.clearAllMocks();
  });

  it('refresh loads the inbox and the unread count from the server', async () => {
    api.listNotificationsApi.mockResolvedValue({ items: [entry()], unread_count: 1, next_before: null });

    await useNotificationsStore.getState().refresh();

    const state = useNotificationsStore.getState();
    expect(state.items.map((i) => i.id)).toEqual(['n1']);
    expect(state.unreadCount).toBe(1);
    expect(state.hasLoadedOnce).toBe(true);
  });

  it('puts the driver name on an owner review prompt', async () => {
    api.listNotificationsApi.mockResolvedValue({
      items: [entry({ kind: 'owner_review_prompt', role: 'owner', data: { booking_id: 'b1', driver_user_id: 'd1' } })],
      unread_count: 1,
      next_before: null,
    });

    await useNotificationsStore.getState().refresh();

    expect(useNotificationsStore.getState().items[0].counterpartName).toBe('Lucas Gomez');
  });

  it('markAllRead clears the badge right away and remembers what was new', async () => {
    api.listNotificationsApi.mockResolvedValue({ items: [entry()], unread_count: 1, next_before: null });
    api.markNotificationsReadApi.mockResolvedValue({ unread_count: 0 });
    await useNotificationsStore.getState().refresh();

    const pending = useNotificationsStore.getState().markAllRead();
    expect(useNotificationsStore.getState().unreadCount).toBe(0);
    await pending;

    const state = useNotificationsStore.getState();
    expect(api.markNotificationsReadApi).toHaveBeenCalledWith();
    expect(state.items[0].readAt).not.toBeNull();
    expect(state.freshIds).toEqual(['n1']);
  });

  it('a slower, older refresh never overwrites a newer one', async () => {
    let resolveOld: (value: notificationsApi.InboxPageApi) => void = () => {};
    api.listNotificationsApi
      .mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }))
      .mockResolvedValueOnce({ items: [entry({ id: 'new' })], unread_count: 1, next_before: null });

    const older = useNotificationsStore.getState().refresh();
    await useNotificationsStore.getState().refresh();
    resolveOld({ items: [entry({ id: 'old' })], unread_count: 5, next_before: null });
    await older;

    expect(useNotificationsStore.getState().items.map((i) => i.id)).toEqual(['new']);
    expect(useNotificationsStore.getState().unreadCount).toBe(1);
  });

  it('a request stops being open once answered here or resolved on the server', () => {
    const request = toAppNotification(entry({ kind: 'owner_request', role: 'owner' }))!;
    expect(isOpenRequest(request, [])).toBe(true);
    expect(isOpenRequest(request, ['b1'])).toBe(false);
    expect(isOpenRequest({ ...request, resolved: true }, [])).toBe(false);
  });
});
