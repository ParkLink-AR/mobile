import { Redirect } from 'expo-router';
import { useSessionStore } from '@/src/store/useSessionStore';
import { useAccountTypeStore, tabRouteFor } from '@/src/store/useAccountTypeStore';

export default function Index() {
  const user = useSessionStore((s) => s.user);
  const sessionHydrated = useSessionStore((s) => s.hydrated);
  const activeMode = useAccountTypeStore((s) => s.activeMode);
  const accountTypeHydrated = useAccountTypeStore((s) => s.hydrated);

  // Espera a que ambos stores terminen de rehidratar desde storage antes de
  // decidir a dónde redirigir, evitando un flash al footer equivocado.
  if (!sessionHydrated || !accountTypeHydrated) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  return <Redirect href={tabRouteFor(activeMode) as never} />;
}
