import { Redirect } from 'expo-router';
import { useSessionStore } from '@/src/store/useSessionStore';
import { useAccountTypeStore } from '@/src/store/useAccountTypeStore';

export default function Index() {
  const user = useSessionStore((s) => s.user);
  const sessionHydrated = useSessionStore((s) => s.hydrated);
  const accountType = useAccountTypeStore((s) => s.accountType);
  const accountTypeHydrated = useAccountTypeStore((s) => s.hydrated);

  // Espera a que ambos stores terminen de rehidratar desde storage antes de
  // decidir a dónde redirigir, evitando un flash a /(driver) para owners.
  if (!sessionHydrated || !accountTypeHydrated) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (accountType === 'owner') return <Redirect href="/(owner)/(tabs)" />;
  if (accountType === 'both') return <Redirect href="/(both)/(tabs)" />;
  return <Redirect href="/(driver)/(tabs)" />;
}
