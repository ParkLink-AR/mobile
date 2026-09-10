import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AccountType } from '@/src/types';

// Which footer the app currently shows -- every account can be in either
// mode at any time, regardless of what they picked at registration.
// accountType (driver/owner/both) only decides the FIRST screen shown right
// after registering (see account-type.tsx, which seeds activeMode from it
// once); after that, activeMode is the only thing that decides the route --
// see tabRouteFor below -- and the user can flip it from their profile
// whenever they want, forever.
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
export function groupFor(activeMode: ActiveMode): '/(driver)' | '/(owner)' {
  return activeMode === 'owner' ? '/(owner)' : '/(driver)';
}

export function tabRouteFor(activeMode: ActiveMode): string {
  return `${groupFor(activeMode)}/(tabs)`;
}
