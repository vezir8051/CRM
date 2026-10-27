import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Führt eine Aktion aus, wenn ein URL-Parameter gesetzt ist (z.B. ?neu=1),
 * und entfernt den Parameter anschliessend wieder.
 */
export function useUrlAction(param: string, action: (value: string) => void) {
  const [params, setParams] = useSearchParams();
  const value = params.get(param);
  const actionRef = useRef(action);
  actionRef.current = action;
  useEffect(() => {
    if (value === null) return;
    actionRef.current(value);
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        next.delete(param);
        return next;
      },
      { replace: true },
    );
  }, [value, param, setParams]);
}

/** Tab-Zustand in der URL (?tab=…), damit Links direkt auf Tabs zeigen können */
export function useTabParam<T extends string>(fallback: T, allowed: readonly T[]): [T, (t: T) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab') as T | null;
  const tab = raw && allowed.includes(raw) ? raw : fallback;
  const setTab = (t: T) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        if (t === fallback) next.delete('tab');
        else next.set('tab', t);
        return next;
      },
      { replace: true },
    );
  return [tab, setTab];
}
