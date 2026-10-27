import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useUi } from '@/store/ui';
import { Button, Modal } from '@/components/ui';

/** Toast-Benachrichtigungen unten rechts */
export function Toaster() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismissToast);
  return (
    <div className="no-print pointer-events-none fixed bottom-5 right-5 z-[200] flex flex-col items-end gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-xl bg-slate-900 px-4 py-2.5 text-[13.5px] font-medium text-white shadow-pop animate-slide-up dark:bg-slate-800">
          {t.kind === 'success' ? <CircleCheck size={17} className="shrink-0 text-green-400" /> : t.kind === 'error' ? <CircleAlert size={17} className="shrink-0 text-red-400" /> : <Info size={17} className="shrink-0 text-blue-400" />}
          <span className="min-w-0">{t.message}</span>
          {t.action && (
            <button
              type="button"
              className="ml-1 shrink-0 rounded-md px-2 py-0.5 font-semibold text-blue-300 hover:bg-white/10"
              onClick={() => {
                t.action!.onClick();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button type="button" onClick={() => dismiss(t.id)} className={cn('ml-1 shrink-0 rounded p-0.5 text-slate-400 hover:text-white')} aria-label="Schliessen">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

/** Globaler Bestätigungsdialog (siehe confirmDialog in store/ui) */
export function ConfirmHost() {
  const req = useUi((s) => s.confirm);
  const setConfirm = useUi((s) => s.setConfirm);
  const finish = (ok: boolean) => {
    req?.resolve(ok);
    setConfirm(null);
  };
  return (
    <Modal
      open={!!req}
      onClose={() => finish(false)}
      title={req?.title ?? ''}
      size="sm"
      footer={
        <>
          <Button onClick={() => finish(false)}>Abbrechen</Button>
          <Button variant={req?.tone === 'primary' ? 'primary' : 'danger'} onClick={() => finish(true)} data-autofocus>
            {req?.confirmLabel ?? 'Bestätigen'}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed">{req?.message}</p>
    </Modal>
  );
}
