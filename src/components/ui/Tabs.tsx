import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface TabItem<T extends string> {
  value: T;
  label: ReactNode;
  count?: number;
  icon?: ReactNode;
}

/** Register-Tabs (kontrolliert) */
export function Tabs<T extends string>({ items, value, onChange, className }: { items: TabItem<T>[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div role="tablist" className={cn('mb-5 flex gap-1 overflow-x-auto border-b border-line', className)}>
      {items.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              '-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[13.5px] font-semibold transition-colors',
              active ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-fg',
            )}
          >
            {t.icon}
            {t.label}
            {t.count !== undefined && (
              <span className={cn('rounded-full px-1.5 text-[11px] tabular-nums', active ? 'bg-brand-soft text-brand' : 'bg-surface-2 text-muted')}>{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Segmentierte Umschaltung (z.B. Board/Liste) */
export function SegmentedControl<T extends string>({ options, value, onChange, className }: { options: { value: T; label: ReactNode; icon?: ReactNode }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cn('inline-flex rounded-lg border border-line bg-surface-2 p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-semibold transition-colors',
            o.value === value ? 'bg-surface text-fg shadow-card' : 'text-muted hover:text-fg',
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}
