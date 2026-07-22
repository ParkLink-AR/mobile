import { useSessionStore } from '@/src/store/useSessionStore';
import { mockDriver } from '@/src/mocks/users';

describe('useSessionStore', () => {
  it('starts with no user', () => {
    expect(useSessionStore.getState().user).toBeNull();
  });

  it('sets the user on login and clears it on logout', () => {
    useSessionStore.getState().login(mockDriver);
    expect(useSessionStore.getState().user).toEqual(mockDriver);
    useSessionStore.getState().logout();
    expect(useSessionStore.getState().user).toBeNull();
  });
});
