import { Redirect } from 'expo-router';
import { useSessionStore } from '@/src/store/useSessionStore';

export default function Index() {
  const user = useSessionStore((s) => s.user);
  const activeMode = useSessionStore((s) => s.activeMode);
  const hydrated = useSessionStore((s) => s.hydrated);

  if (!hydrated) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  return <Redirect href={activeMode === 'driver' ? '/(driver)/(tabs)' : '/(owner)/(tabs)'} />;
}
