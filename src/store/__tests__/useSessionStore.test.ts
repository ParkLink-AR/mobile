import { useSessionStore } from '@/src/store/useSessionStore';
import { AuthUser, AuthTokens } from '@/src/types';

const mockAuthUser: AuthUser = {
  id: 'user-1',
  name: 'Martín',
  lastName: 'Pérez',
  email: 'martin@example.com',
  phone: '+5491100000000',
  emailVerified: true,
};

const mockTokens: AuthTokens = {
  accessToken: 'access-123',
  refreshToken: 'refresh-123',
  expiresIn: 900,
};

describe('useSessionStore', () => {
  afterEach(() => {
    useSessionStore.getState().clearSession();
  });

  it('starts with no user', () => {
    expect(useSessionStore.getState().user).toBeNull();
  });

  it('sets the user and tokens on setSession, and clears them on clearSession', () => {
    useSessionStore.getState().setSession(mockAuthUser, mockTokens);
    expect(useSessionStore.getState().user).toEqual(mockAuthUser);
    expect(useSessionStore.getState().accessToken).toBe(mockTokens.accessToken);
    expect(useSessionStore.getState().refreshToken).toBe(mockTokens.refreshToken);

    useSessionStore.getState().clearSession();
    expect(useSessionStore.getState().user).toBeNull();
    expect(useSessionStore.getState().accessToken).toBeNull();
    expect(useSessionStore.getState().refreshToken).toBeNull();
  });

  it('setActiveMode switches driver/owner mode', () => {
    expect(useSessionStore.getState().activeMode).toBe('driver');
    useSessionStore.getState().setActiveMode('owner');
    expect(useSessionStore.getState().activeMode).toBe('owner');
  });
});
