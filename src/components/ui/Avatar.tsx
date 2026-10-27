import { cn } from '@/lib/cn';
import { initials } from '@/domain/format';

const COLORS = ['#2563eb', '#7c3aed', '#0e7490', '#16a34a', '#c2410c', '#be123c', '#4f46e5', '#0f766e', '#a21caf', '#a16207'];

function colorFor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

/** Initialen-Avatar; square=true für Firmen */
export function Avatar({ name, size = 34, square, className, title }: { name: string; size?: number; square?: boolean; className?: string; title?: string }) {
  return (
    <span
      title={title ?? name}
      className={cn('inline-flex shrink-0 select-none items-center justify-center font-bold tracking-wide text-white', square ? 'rounded-lg' : 'rounded-full', className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38), background: colorFor(name) }}
    >
      {initials(name) || '?'}
    </span>
  );
}
