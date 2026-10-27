/* Sitzung (Demo-Authentifizierung im Browser) */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ID } from '@/types';

interface AuthState {
  userId: ID | null;
  setUser: (id: ID | null) => void;
}

export const useAuth = create<AuthState>()(
  persist((set) => ({ userId: null, setUser: (userId) => set({ userId }) }), { name: 'persocrm-session' }),
);

/** Aktuell angemeldete Person (für Audit-Einträge) */
export function actorId(): ID {
  return useAuth.getState().userId ?? 'system';
}
