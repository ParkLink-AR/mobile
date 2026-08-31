import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { AuthUser, AuthTokens } from '@/src/types';
import { secureStorage } from '@/src/services/secureStorage';

interface SessionState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;
  setSession: (user: AuthUser, tokens: AuthTokens) => void;
  setTokens: (tokens: AuthTokens) => void;
  setUser: (user: AuthUser) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      hydrated: false,
      setSession: (user, tokens) =>
        set({
          user,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        }),
      setTokens: (tokens) =>
        set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }),
      setUser: (user) => set({ user }),
      clearSession: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    {
      name: 'session-storage',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
);

// `hydrated` is deliberately excluded from `partialize` (it must always start
// false on load) and flipped once secureStorage rehydration finishes, so
// app/index.tsx can wait for it before deciding where to redirect.
useSessionStore.persist.onFinishHydration(() => {
  useSessionStore.setState({ hydrated: true });
});
if (useSessionStore.persist.hasHydrated()) {
  useSessionStore.setState({ hydrated: true });
}
