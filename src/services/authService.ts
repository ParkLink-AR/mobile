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
  return delay({ ...user, ...changes });
}
