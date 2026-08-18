import { AuthUser } from '@/src/types';
import { delay } from './utils';

// Profile editing (name/email change) isn't wired to the real backend yet --
// only registration/login/email-verification are (see src/api/auth.ts).
export async function updateProfile(user: AuthUser, changes: Partial<AuthUser>): Promise<AuthUser> {
  return delay({ ...user, ...changes });
}
