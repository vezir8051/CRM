import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface MenuItem {
  label: ReactNode;
  icon?: ReactNode;
  onSelect: () => void;
  tone?: 'default' | 'danger';
  disabled?: boolean;
}

/** Aufklappmenü: trigger erhält onClick über render-prop */
export function DropdownMenu({ trigger, items, align = 'right', className }: { trigger: (open: boolean, toggle: () => void) => ReactNode; items: (MenuItem | 'divider')[]; align?: 'left' | 'right'; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn('relative', className)}>
      {trigger(open, () => setOpen((o) => !o))}
      {open && (
        <div
          role="menu"
          className={cn(
            'absolute top-[calc(100%+6px)] z-50 min-w-[210px] rounded-xl border border-line bg-surface p-1.5 shadow-pop animate-fade-in',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((it, i) =>
            it === 'divider' ? (
              <div key={i} className="my-1 h-px bg-line" />
            ) : (
              <button
                key={i}
                type="button"
                role="menuitem"
                disabled={it.disabled}
                onClick={() => {
                  setOpen(false);
                  it.onSelect();
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium disabled:opacity-50',
                  it.tone === 'danger' ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50' : 'text-fg hover:bg-surface-2',
                )}
              >
                {it.icon && <span className="text-muted">{it.icon}</span>}
                {it.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
