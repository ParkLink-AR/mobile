import { create } from 'zustand';
import { User } from '@/src/types';

interface SessionState {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  login: (user) => set({ user }),
  logout: () => set({ user: null }),
}));
