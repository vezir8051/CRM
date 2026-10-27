/* ============================================================
   Formular-Bausteine
   <Field label hint error state="missing|uncertain"> umschliesst
   ein Eingabeelement. state markiert KI-Import-Ergebnisse:
     missing   → rot, «Nicht gefunden – bitte ergänzen»
     uncertain → gelb, «Unsicher – bitte prüfen»
   ============================================================ */
import { forwardRef, useState, type InputHTMLAttributes, type KeyboardEvent, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { AlertCircle, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Tag } from './Badge';

export type FieldState = 'missing' | 'uncertain' | undefined;

export interface FieldProps {
  label: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  state?: FieldState;
  /** Text für state=missing, z.B. «Nicht im Lebenslauf gefunden» */
  missingText?: string;
  className?: string;
  /** Feld über beide Spalten eines FormGrid */
  wide?: boolean;
}

export function Field({ label, children, hint, error, required, state, missingText, className, wide }: FieldProps) {
  return (
    <div className={cn('min-w-0', wide && 'sm:col-span-2', state === 'missing' && 'field-missing', state === 'uncertain' && 'field-uncertain', className)}>
      <label className={cn('mb-1.5 block text-[12.5px] font-semibold', state === 'missing' ? 'text-red-600 dark:text-red-400' : state === 'uncertain' ? 'text-amber-700 dark:text-amber-400' : 'text-muted')}>
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {state === 'missing' && (
        <p className="mt-1 flex items-center gap-1 text-[11.5px] font-medium text-red-600 dark:text-red-400">
          <AlertCircle size={12} /> {missingText ?? 'Nicht gefunden – bitte ergänzen'}
        </p>
      )}
      {state === 'uncertain' && (
        <p className="mt-1 flex items-center gap-1 text-[11.5px] font-medium text-amber-700 dark:text-amber-400">
          <HelpCircle size={12} /> Unsicher erkannt – bitte prüfen
        </p>
      )}
      {error && <p className="mt-1 text-[11.5px] font-medium text-red-600">{error}</p>}
      {hint && !error && <p className="mt-1 text-[11.5px] text-subtle">{hint}</p>}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn('input-base', className)} {...rest} />;
});

/** Zahleneingabe, die null für leere Werte liefert */
export function NumberInput({
  value, onChange, className, ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & { value: number | null | undefined; onChange: (v: number | null) => void }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      className={cn('input-base', className)}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      {...rest}
    />
  );
}

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        'input-base appearance-none bg-[length:14px] bg-[right_10px_center] bg-no-repeat pr-8',
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, rows = 3, ...rest }, ref) {
  return <textarea ref={ref} rows={rows} className={cn('input-base h-auto min-h-[76px] resize-y py-2 leading-relaxed', className)} {...rest} />;
});

export function Checkbox({ label, checked, onChange, className, disabled }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; className?: string; disabled?: boolean }) {
  return (
    <label className={cn('inline-flex cursor-pointer select-none items-center gap-2 text-sm text-fg', disabled && 'cursor-not-allowed opacity-60', className)}>
      <input type="checkbox" className="h-4 w-4 rounded border-line accent-[rgb(var(--brand))]" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

/** Mehrfachauswahl als Chips (z.B. Anstellungsarten) */
export function ChipSelect<T extends string>({ options, value, onChange }: { options: readonly T[]; value: T[]; onChange: (v: T[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
              on ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface text-muted hover:text-fg',
            )}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

/** Schlagwort-Eingabe: Enter oder Komma fügt hinzu, Backspace entfernt */
export function TagInput({ value, onChange, placeholder, suggestions = [] }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; suggestions?: string[] }) {
  const [draft, setDraft] = useState('');
  const add = (raw: string) => {
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
    const next = [...value];
    for (const p of parts) if (!next.some((x) => x.toLowerCase() === p.toLowerCase())) next.push(p);
    onChange(next);
    setDraft('');
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (draft.trim()) add(draft);
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };
  const listId = suggestions.length ? `tags-${Math.random().toString(36).slice(2, 8)}` : undefined;
  return (
    <div className="input-base flex h-auto min-h-9 flex-wrap items-center gap-1.5 py-1.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
      {value.map((t) => (
        <Tag key={t} onRemove={() => onChange(value.filter((x) => x !== t))}>
          {t}
        </Tag>
      ))}
      <input
        className="min-w-[120px] flex-1 bg-transparent text-sm outline-none placeholder:text-subtle"
        value={draft}
        list={listId}
        placeholder={value.length ? '' : placeholder}
        onChange={(e) => (e.target.value.endsWith(',') ? add(e.target.value) : setDraft(e.target.value))}
        onKeyDown={onKey}
        onBlur={() => draft.trim() && add(draft)}
      />
      {listId && (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </div>
  );
}

/** Zweispaltiges Formularraster (auf Mobile einspaltig) */
export function FormGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2', className)}>{children}</div>;
}

export function FormSection({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="pt-2 sm:col-span-2">
      <div className="border-b border-line pb-1.5 text-[11px] font-bold uppercase tracking-wider text-subtle">{title}</div>
      {children}
    </div>
  );
}
