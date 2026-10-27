import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { IconButton } from './Button';

const SIZES = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' } as const;

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof SIZES;
  /** Klick auf den Hintergrund schliesst nicht (z.B. bei ungespeicherten Formularen) */
  persistent?: boolean;
}

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md', persistent }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Erstes Eingabefeld fokussieren
    const t = window.setTimeout(() => {
      const el = panelRef.current?.querySelector<HTMLElement>('input:not([type=hidden]):not([disabled]), select, textarea, [data-autofocus]');
      (el ?? panelRef.current)?.focus();
    }, 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 pt-[6vh] animate-fade-in"
      onMouseDown={(e) => {
        if (!persistent && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className={cn('flex max-h-[88vh] w-full flex-col rounded-2xl border border-line bg-surface shadow-pop outline-none animate-slide-up', SIZES[size])}
      >
        <div className="flex items-start gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[15.5px] font-bold">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[12.5px] text-muted">{subtitle}</p>}
          </div>
          <IconButton label="Schliessen" className="ml-auto -mr-1 -mt-1" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 rounded-b-2xl border-t border-line bg-surface-2 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
