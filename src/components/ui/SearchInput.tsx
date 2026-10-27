import type { ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';

export function SearchInput({ value, onChange, placeholder = 'Suchen…', className, autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; autoFocus?: boolean }) {
  return (
    <div className={cn('relative flex items-center', className)}>
      <Search size={15} className="pointer-events-none absolute left-2.5 text-subtle" />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-base pl-8 pr-8 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button type="button" onClick={() => onChange('')} className="absolute right-2 rounded p-0.5 text-subtle hover:text-fg" aria-label="Suche leeren">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export function Kbd({ children }: { children: string }) {
  return <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-sans text-[10.5px] font-semibold text-muted">{children}</kbd>;
}

/** Werkzeugleiste über Listen */
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mb-3.5 flex flex-wrap items-center gap-2.5', className)}>{children}</div>;
}
