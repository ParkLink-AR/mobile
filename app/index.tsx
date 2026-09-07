import { Redirect } from 'expo-router';
import { useSessionStore } from '@/src/store/useSessionStore';

export default function Index() {
  const user = useSessionStore((s) => s.user);
  const sessionHydrated = useSessionStore((s) => s.hydrated);

  if (!sessionHydrated) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  return <Redirect href="/(both)/(tabs)" />;
}
