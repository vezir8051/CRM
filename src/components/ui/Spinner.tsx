import { cn } from '@/lib/cn';

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <span
      role="status"
      aria-label="Lädt"
      style={{ width: size, height: size }}
      className={cn('inline-block shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80', className)}
    />
  );
}
