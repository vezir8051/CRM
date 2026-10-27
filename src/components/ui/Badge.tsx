import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { toneOf, type Tone } from '@/domain/constants';

export const TONE_BADGE: Record<Tone, string> = {
  gray: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800/80 dark:text-slate-300 dark:ring-slate-700',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:ring-blue-900',
  green: 'bg-green-50 text-green-700 ring-green-200 dark:bg-green-950/60 dark:text-green-300 dark:ring-green-900',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-900',
  red: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-900',
  purple: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:ring-violet-900',
  cyan: 'bg-cyan-50 text-cyan-700 ring-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:ring-cyan-900',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:ring-indigo-900',
};

/** Farbige Icon-Kachel (z.B. KPI) */
export const TONE_TILE: Record<Tone, string> = {
  gray: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/70 dark:text-blue-300',
  green: 'bg-green-50 text-green-600 dark:bg-green-950/70 dark:text-green-300',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/70 dark:text-amber-300',
  red: 'bg-red-50 text-red-600 dark:bg-red-950/70 dark:text-red-300',
  purple: 'bg-violet-50 text-violet-600 dark:bg-violet-950/70 dark:text-violet-300',
  cyan: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/70 dark:text-cyan-300',
  indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-300',
};

export function Badge({ tone = 'gray', children, className, icon }: { tone?: Tone; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold ring-1 ring-inset', TONE_BADGE[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

/** Badge mit automatischem Farbton für Status-/Kategorie-Werte */
export function StatusBadge({ value, className }: { value: string | null | undefined; className?: string }) {
  if (!value) return null;
  return (
    <Badge tone={toneOf(value)} className={className}>
      {value}
    </Badge>
  );
}

/** Neutrales Schlagwort (Skills, Tags) */
export function Tag({ children, active, onRemove, className }: { children: ReactNode; active?: boolean; onRemove?: () => void; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium',
        active
          ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/60 dark:text-green-300'
          : 'border-line bg-surface-2 text-muted',
        className,
      )}
    >
      {children}
      {onRemove && (
        <button type="button" onClick={onRemove} className="-mr-0.5 rounded px-0.5 text-subtle hover:text-red-600" aria-label="Entfernen">
          ×
        </button>
      )}
    </span>
  );
}

/** Balken für Match-Score / Fortschritt */
export function ScoreBar({ value, className, label }: { value: number; className?: string; label?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const color = v >= 70 ? 'bg-green-600' : v >= 45 ? 'bg-amber-500' : 'bg-slate-400';
  const text = v >= 70 ? 'text-green-700 dark:text-green-400' : v >= 45 ? 'text-amber-700 dark:text-amber-400' : 'text-muted';
  return (
    <div className={cn('flex min-w-[120px] items-center gap-2', className)} title={label}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${v}%` }} />
      </div>
      <span className={cn('w-9 text-right text-xs font-bold tabular-nums', text)}>{v}%</span>
    </div>
  );
}
