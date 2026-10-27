/* ============================================================
   UI-Zustand: Toasts, Bestätigungsdialog, Theme, Command Palette
   ============================================================ */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid } from '@/domain/ids';

export type Theme = 'light' | 'dark' | 'system';
export type ToastKind = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  kind: ToastKind;
  message: string;
  action?: { label: string; onClick: () => void };
}

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
  resolve: (ok: boolean) => void;
}

interface UiState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toasts: ToastItem[];
  pushToast: (t: Omit<ToastItem, 'id'>, durationMs?: number) => void;
  dismissToast: (id: string) => void;
  confirm: ConfirmRequest | null;
  setConfirm: (c: ConfirmRequest | null) => void;
}

export const useUi = create<UiState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },
      paletteOpen: false,
      setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
      sidebarOpen: false,
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      toasts: [],
      pushToast: (t, durationMs) => {
        const id = uid();
        set({ toasts: [...get().toasts.slice(-3), { ...t, id }] });
        window.setTimeout(() => get().dismissToast(id), durationMs ?? (t.action ? 6000 : 3500));
      },
      dismissToast: (id) => set({ toasts: get().toasts.filter((x) => x.id !== id) }),
      confirm: null,
      setConfirm: (confirm) => set({ confirm }),
    }),
    { name: 'persocrm-ui', partialize: (s) => ({ theme: s.theme }) },
  ),
);

export function applyTheme(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

/* ---------- Bequeme APIs für Komponenten ---------- */

/** toast.success('Gespeichert') · toast.error(...) · toast.info(...) · toast.undo('Gelöscht', restore) */
export const toast = {
  success: (message: string) => useUi.getState().pushToast({ kind: 'success', message }),
  error: (message: string) => useUi.getState().pushToast({ kind: 'error', message }, 5000),
  info: (message: string) => useUi.getState().pushToast({ kind: 'info', message }),
  /** Erfolgsmeldung mit «Rückgängig»-Knopf */
  undo: (message: string, restore: () => void) =>
    useUi.getState().pushToast({
      kind: 'success',
      message,
      action: {
        label: 'Rückgängig',
        onClick: () => {
          restore();
          toast.info('Rückgängig gemacht');
        },
      },
    }),
};

/** Promise-basierter Bestätigungsdialog: `if (await confirmDialog({...})) { … }` */
export function confirmDialog(req: Omit<ConfirmRequest, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => {
    useUi.getState().setConfirm({ ...req, resolve });
  });
}
