import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';
export type ButtonSize = 'sm' | 'md';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-brand-fg shadow-sm hover:bg-brand-hover',
  secondary: 'bg-surface text-fg border border-line shadow-card hover:bg-surface-2',
  ghost: 'text-muted hover:bg-surface-2 hover:text-fg',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700',
  soft: 'bg-brand-soft text-brand hover:bg-brand/15',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-2.5 text-[13px] gap-1.5 rounded-md',
  md: 'h-9 px-3.5 text-sm gap-2 rounded-lg',
};

const base =
  'inline-flex items-center justify-center font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-55';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, loading, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} className={cn(base, VARIANTS[variant], SIZES[size], className)} {...rest}>
      {loading ? <Spinner size={14} /> : icon}
      {children}
    </button>
  );
});

/** Link im Button-Stil */
export function ButtonLink({ variant = 'secondary', size = 'md', icon, className, children, ...rest }: LinkProps & { variant?: ButtonVariant; size?: ButtonSize; icon?: ReactNode }) {
  return (
    <Link className={cn(base, VARIANTS[variant], SIZES[size], className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  tone?: 'default' | 'danger';
  size?: 'sm' | 'md';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, tone = 'default', size = 'md', className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-40',
        size === 'sm' ? 'h-7 w-7' : 'h-8 w-8',
        tone === 'danger' ? 'hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50' : 'hover:bg-surface-2 hover:text-fg',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
