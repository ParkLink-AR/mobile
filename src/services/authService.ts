import { User } from '@/src/types';
import { mockDriver, mockOwner } from '@/src/mocks/users';
import { delay } from './utils';

export async function loginAsDriver(): Promise<User> {
  return delay(mockDriver);
}

export async function loginAsOwner(): Promise<User> {
  return delay(mockOwner);
}

export async function updateProfile(user: User, changes: Partial<User>): Promise<User> {
  // Recompute initials when name or lastName changes
  const updatedUser = { ...user, ...changes };
  const firstName = updatedUser.name?.trim() || '';
  const lastName = updatedUser.lastName?.trim() || '';
  updatedUser.avatarInitials = [firstName[0], lastName[0]]
    .filter(Boolean)
    .map((c) => c.toUpperCase())
    .join('');
  return delay(updatedUser);
}
