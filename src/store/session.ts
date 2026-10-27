/* Anmeldung, Abmeldung und Zugriff auf die angemeldete Person */
import { useMemo } from 'react';
import type { User } from '@/types';
import { sha256 } from '@/domain/ids';
import { useAuth } from './auth';
import { useData } from './data';

export async function login(username: string, password: string): Promise<User | null> {
  const hash = await sha256(password);
  const user = useData.getState().users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase() && u.passwordHash === hash);
  if (!user) return null;
  useAuth.getState().setUser(user.id);
  useData.getState().log('user', user.id, 'Anmeldung');
  return user;
}

export function logout() {
  useAuth.getState().setUser(null);
}

/** Angemeldete Person (null, wenn nicht angemeldet oder gelöscht) */
export function useCurrentUser(): User | null {
  const userId = useAuth((s) => s.userId);
  const users = useData((s) => s.users);
  return useMemo(() => users.find((u) => u.id === userId) ?? null, [users, userId]);
}

export function useIsAdmin(): boolean {
  return useCurrentUser()?.rolle === 'admin';
}
