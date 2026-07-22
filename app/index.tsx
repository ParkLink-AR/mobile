import { Redirect } from 'expo-router';
import { useSessionStore } from '@/src/store/useSessionStore';

export default function Index() {
  const user = useSessionStore((s) => s.user);
  if (!user) return <Redirect href="/(auth)/login" />;
  return <Redirect href={user.role === 'driver' ? '/(driver)/(tabs)' : '/(owner)/(tabs)'} />;
}
