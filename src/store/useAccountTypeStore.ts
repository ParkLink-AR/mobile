import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AccountType } from '@/src/types';

interface AccountTypeState {
  accountType: AccountType;
  hydrated: boolean;
  setAccountType: (t: AccountType) => void;
}

type PersistedAccountTypeState = Pick<AccountTypeState, 'accountType'>;

export const useAccountTypeStore = create(
  persist<AccountTypeState, [], [], PersistedAccountTypeState>(
    (set) => ({
      accountType: 'driver',
      hydrated: false,
      setAccountType: (t) => set({ accountType: t }),
    }),
    {
      name: 'account-type-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state): PersistedAccountTypeState => ({ accountType: state.accountType }),
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
