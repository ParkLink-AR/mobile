import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AccountType } from '@/src/types';

// Which footer a 'both' account is currently looking at. Meaningless for
// 'driver'/'owner' accounts (they only ever have one mode) -- see
// tabRouteFor below, the single place that turns (accountType, activeMode)
// into a route.
type ActiveMode = 'driver' | 'owner';

interface AccountTypeState {
  accountType: AccountType;
  activeMode: ActiveMode;
  hydrated: boolean;
  setAccountType: (t: AccountType) => void;
  setActiveMode: (m: ActiveMode) => void;
}

type PersistedAccountTypeState = Pick<AccountTypeState, 'accountType' | 'activeMode'>;

export const useAccountTypeStore = create(
  persist<AccountTypeState, [], [], PersistedAccountTypeState>(
    (set) => ({
      accountType: 'driver',
      activeMode: 'driver',
      hydrated: false,
      setAccountType: (t) => set({ accountType: t }),
      setActiveMode: (m) => set({ activeMode: m }),
    }),
    {
      name: 'account-type-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state): PersistedAccountTypeState => ({
        accountType: state.accountType,
        activeMode: state.activeMode,
      }),
    }
  )
);

// Igual que useSessionStore: se marca true cuando AsyncStorage termina de
// rehidratar, para que index.tsx espere a ambos stores antes de redirigir.
useAccountTypeStore.persist.onFinishHydration(() => {
  useAccountTypeStore.setState({ hydrated: true });
});
if (useAccountTypeStore.persist.hasHydrated()) {
  useAccountTypeStore.setState({ hydrated: true });
}

/** Single source of truth for "which route group does this account use". */
export function groupFor(accountType: AccountType, activeMode: ActiveMode): '/(driver)' | '/(owner)' {
  if (accountType === 'owner') return '/(owner)';
  if (accountType === 'driver') return '/(driver)';
  return activeMode === 'owner' ? '/(owner)' : '/(driver)';
}

export function tabRouteFor(accountType: AccountType, activeMode: ActiveMode): string {
  return `${groupFor(accountType, activeMode)}/(tabs)`;
}
