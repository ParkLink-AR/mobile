jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { markMockNotificationsRead, withReadState } from '@/src/mock/seen';

const unread = (id: string, minutesAgo = 10) => ({
  id,
  created_at: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
  read_at: null as string | null,
});

describe('example notifications marked read', () => {
  it('stay unread until they are marked', () => {
    expect(withReadState(unread('n-1')).read_at).toBeNull();
  });

  it('one marked by id is read, the others are not', () => {
    markMockNotificationsRead(['n-2']);
    expect(withReadState(unread('n-2')).read_at).not.toBeNull();
    expect(withReadState(unread('n-3')).read_at).toBeNull();
  });

  it('opening the tab (mark all) reads every one from before, not the ones that come after', () => {
    markMockNotificationsRead();
    expect(withReadState(unread('n-4')).read_at).not.toBeNull();
    expect(withReadState(unread('n-5', -5)).read_at).toBeNull();
  });

  it('is remembered on the device', () => {
    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });

  it('leaves one already read as it was', () => {
    const read = { ...unread('n-6'), read_at: '2026-10-01T10:00:00.000Z' };
    expect(withReadState(read).read_at).toBe('2026-10-01T10:00:00.000Z');
  });
});
