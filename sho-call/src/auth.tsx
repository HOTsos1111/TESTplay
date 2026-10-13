import { createContext, useContext } from 'react';
import type { User } from '../shared/types.ts';

export interface AuthState {
  user: User | null;
  setUser: (u: User | null) => void;
  logout: () => Promise<void>;
}

export const AuthCtx = createContext<AuthState>({ user: null, setUser: () => {}, logout: async () => {} });
export const useAuth = () => useContext(AuthCtx);
