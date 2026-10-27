import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowDownRight, ArrowRight, ArrowUpRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Farbverläufe als vollständige Klassen (damit Tailwind sie erkennt) */
const GRADIENTS = {
  blue: { tile: 'from-blue-500 to-indigo-500 shadow-blue-500/25', glow: 'from-blue-500 to-indigo-500' },
  cyan: { tile: 'from-cyan-500 to-sky-500 shadow-cyan-500/25', glow: 'from-cyan-500 to-sky-500' },
  green: { tile: 'from-emerald-500 to-teal-500 shadow-emerald-500/25', glow: 'from-emerald-500 to-teal-500' },
  amber: { tile: 'from-amber-500 to-orange-500 shadow-amber-500/25', glow: 'from-amber-500 to-orange-500' },
  red: { tile: 'from-rose-500 to-red-500 shadow-rose-500/25', glow: 'from-rose-500 to-red-500' },
  purple: { tile: 'from-violet-500 to-fuchsia-500 shadow-violet-500/25', glow: 'from-violet-500 to-fuchsia-500' },
  gray: { tile: 'from-slate-400 to-slate-500 shadow-slate-500/20', glow: 'from-slate-400 to-slate-500' },
} as const;

export type StatsGradient = keyof typeof GRADIENTS;

export interface StatsCardProps {
  title: string;
  value: ReactNode;
  icon: LucideIcon;
  gradient?: StatsGradient;
  /** Veränderung; null/undefined = keine Vergleichsbasis */
  change?: number | null;
  /** «percent» (+12 %) oder «count» für Stückzahlen (+3) */
  changeFormat?: 'percent' | 'count';
  /** z.B. «ggü. Vormonat» */
  changeLabel?: string;
  /** Anstieg ist schlecht (z.B. offene Forderungen) → Farben vertauscht */
  invertChange?: boolean;
  hint?: ReactNode;
  /** Ganze Karte verlinken */
  to?: string;
}

function Change({ value, format, label, invert }: { value: number; format: 'percent' | 'count'; label?: string; invert?: boolean }) {
  const good = invert ? value < 0 : value > 0;
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : ArrowRight;
  return (
    <p className="mt-1 flex min-w-0 items-center gap-1 text-[12.5px]">
      <span
        className={cn(
          'inline-flex shrink-0 items-center gap-0.5 font-semibold',
          value === 0 ? 'text-muted' : good ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
        )}
      >
        <Icon size={15} aria-hidden />
        {value > 0 ? '+' : ''}
        {value.toLocaleString('de-CH')}
        {format === 'percent' && ' %'}
      </span>
      {label && <span className="truncate text-subtle">{label}</span>}
    </p>
  );
}

/** Kennzahl-Karte mit Glas-Optik, Farbverlauf-Icon und Trend */
export function StatsCard({ title, value, icon: Icon, gradient = 'blue', change, changeFormat = 'percent', changeLabel, invertChange, hint, to }: StatsCardProps) {
  const reduceMotion = useReducedMotion();
  const g = GRADIENTS[gradient];

  const body = (
    <>
      {/* dezenter Farbschein für die Glas-Optik */}
      <div aria-hidden className={cn('pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-gradient-to-br opacity-[0.14] blur-2xl dark:opacity-25', g.glow)} />
      <div className="relative flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[12.5px] font-medium text-muted">{title}</p>
          <div className="mt-0.5 truncate text-xl font-bold tabular-nums tracking-tight text-fg sm:text-2xl">{value}</div>
          {typeof change === 'number' ? (
            <Change value={change} format={changeFormat} label={changeLabel} invert={invertChange} />
          ) : (
            hint && <p className="mt-1 truncate text-[12px] text-subtle">{hint}</p>
          )}
        </div>
        <div className={cn('hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg sm:flex', g.tile)}>
          <Icon size={21} aria-hidden />
        </div>
      </div>
    </>
  );

  return (
    <motion.div
      whileHover={reduceMotion ? undefined : { y: -4 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className="glass-card h-full transition-shadow hover:shadow-md"
    >
      {to ? (
        <Link to={to} className="relative block h-full rounded-2xl p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 sm:p-5">
          {body}
        </Link>
      ) : (
        <div className="relative h-full p-4 sm:p-5">{body}</div>
      )}
    </motion.div>
  );
}
