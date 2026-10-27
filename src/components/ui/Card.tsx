import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('min-w-0 rounded-xl border border-line bg-surface shadow-card', className)}>{children}</div>;
}

export function CardHeader({ title, subtitle, actions, icon, className }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3 border-b border-line px-5 py-3.5', className)}>
      {icon && <span className="text-muted">{icon}</span>}
      <div className="min-w-0">
        <h3 className="truncate text-sm font-bold">{title}</h3>
        {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ children, className, flush }: { children: ReactNode; className?: string; flush?: boolean }) {
  return <div className={cn(flush ? '' : 'p-5', className)}>{children}</div>;
}

/** Seitentitel mit Untertitel und Aktionen */
export function PageHeader({ title, subtitle, actions, children }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start gap-3">
      <div className="min-w-0">
        <h1 className="text-[21px] font-bold tracking-tight">{title}</h1>
        {subtitle && <div className="mt-0.5 text-[13.5px] text-muted">{subtitle}</div>}
        {children}
      </div>
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, text, action, className }: { icon: ReactNode; title: string; text?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('px-5 py-10 text-center', className)}>
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-subtle">{icon}</div>
      <h4 className="text-sm font-semibold">{title}</h4>
      {text && <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Beschriftungs-/Wertliste */
export function InfoList({ items, className }: { items: [ReactNode, ReactNode][]; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-[minmax(110px,150px)_1fr] gap-x-4 gap-y-2.5 text-[13.5px]', className)}>
      {items.map(([k, v], i) => (
        <div key={i} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className="min-w-0 break-words font-medium">{v === null || v === undefined || v === '' ? <span className="text-subtle">–</span> : v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Hinweisbox */
export function Callout({ tone = 'info', icon, children, className }: { tone?: 'info' | 'warn' | 'error' | 'success'; icon?: ReactNode; children: ReactNode; className?: string }) {
  const styles = {
    info: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-200',
    warn: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
    error: 'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200',
    success: 'border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950/50 dark:text-green-200',
  }[tone];
  return (
    <div className={cn('flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-[13px] leading-relaxed', styles, className)}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
