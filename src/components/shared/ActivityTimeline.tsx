import { useMemo, useState } from 'react';
import { Calendar, SquareCheck, Clock, Mail, Pencil, Phone, RotateCcw, StickyNote, Trash2, Check, Sparkles, CalendarCheck } from 'lucide-react';
import type { Activity, ActivityType, EntityRef } from '@/types';
import { fmtDateTime, fmtRelative, isOverdue } from '@/domain/format';
import { useData } from '@/store/data';
import { useLookups } from '@/store/selectors';
import { confirmDialog, toast } from '@/store/ui';
import { cn } from '@/lib/cn';
import { Badge, EmptyState, IconButton, StatusBadge } from '@/components/ui';
import { EntityLink } from './EntityLink';
import { ActivityDialog } from './ActivityDialog';

const ICON: Record<ActivityType, JSX.Element> = {
  Anruf: <Phone size={15} />,
  'E-Mail': <Mail size={15} />,
  Termin: <Calendar size={15} />,
  Aufgabe: <SquareCheck size={15} />,
  Notiz: <StickyNote size={15} />,
};

const ICON_BG: Record<ActivityType, string> = {
  Anruf: 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300',
  'E-Mail': 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300',
  Termin: 'bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-300',
  Aufgabe: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300',
  Notiz: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

export function ActivityIcon({ typ }: { typ: ActivityType }) {
  return <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', ICON_BG[typ])}>{ICON[typ]}</span>;
}

/** Einzelne Aktivität mit Aktionen (Erledigt, Bearbeiten, Löschen) */
export function ActivityRow({ a, showBezug = false, compact = false }: { a: Activity; showBezug?: boolean; compact?: boolean }) {
  const toggle = useData((s) => s.toggleActivity);
  const remove = useData((s) => s.deleteActivity);
  const snapshot = useData((s) => s.snapshot);
  const l = useLookups();
  const [edit, setEdit] = useState(false);
  const overdue = !a.erledigt && isOverdue(a.faelligAm);

  return (
    <li className="flex gap-3 py-3">
      <ActivityIcon typ={a.typ} />
      <div className="min-w-0 flex-1">
        <div className={cn('text-[13.5px] font-semibold', a.erledigt && 'text-subtle line-through')}>{a.betreff}</div>
        {!compact && a.beschreibung && <div className="mt-0.5 break-words text-[12.5px] text-muted">{a.beschreibung}</div>}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-subtle">
          {!compact && <StatusBadge value={a.typ} />}
          {a.auto && (
            <Badge tone="indigo" icon={<Sparkles size={10} />}>
              Automatisch
            </Badge>
          )}
          {a.faelligAm && (
            <span className={cn('inline-flex items-center gap-1', overdue && 'font-semibold text-red-600 dark:text-red-400')}>
              <Clock size={11} />
              {compact ? fmtRelative(a.faelligAm) : `${fmtDateTime(a.faelligAm)} (${fmtRelative(a.faelligAm)})`}
            </span>
          )}
          {!compact && <span>{l.user.get(a.userId)?.name ?? ''}</span>}
          {showBezug && <EntityLink refTo={a.bezug} className="inline-flex items-center gap-1 text-brand hover:underline" />}
        </div>
      </div>
      <div className="flex shrink-0 items-start gap-0.5">
        <IconButton
          size="sm"
          label={a.erledigt ? 'Wieder öffnen' : 'Als erledigt markieren'}
          onClick={() => {
            toggle(a.id);
            if (!a.erledigt) toast.success('Erledigt');
          }}
        >
          {a.erledigt ? <RotateCcw size={14} /> : <Check size={15} />}
        </IconButton>
        {!compact && (
          <>
            <IconButton size="sm" label="Bearbeiten" onClick={() => setEdit(true)}>
              <Pencil size={14} />
            </IconButton>
            <IconButton
              size="sm"
              tone="danger"
              label="Löschen"
              onClick={async () => {
                if (!(await confirmDialog({ title: 'Aktivität löschen', message: `«${a.betreff}» wirklich löschen?`, confirmLabel: 'Löschen', tone: 'danger' }))) return;
                const restore = snapshot();
                remove(a.id);
                toast.undo('Aktivität gelöscht', restore);
              }}
            >
              <Trash2 size={14} />
            </IconButton>
          </>
        )}
      </div>
      <ActivityDialog open={edit} onClose={() => setEdit(false)} activity={a} />
    </li>
  );
}

/** Chronologische Aktivitätenliste, optional auf einen Bezug gefiltert */
export function ActivityTimeline({ bezug, limit, showBezug = false, emptyText }: { bezug?: EntityRef; limit?: number; showBezug?: boolean; emptyText?: string }) {
  const activities = useData((s) => s.activities);
  const list = useMemo(() => {
    const filtered = bezug ? activities.filter((a) => a.bezug?.typ === bezug.typ && a.bezug.id === bezug.id) : activities;
    // Offene zuerst (nach Fälligkeit), dann erledigte (neueste zuerst)
    const open = filtered.filter((a) => !a.erledigt).sort((x, y) => (x.faelligAm || '9999').localeCompare(y.faelligAm || '9999'));
    const done = filtered.filter((a) => a.erledigt).sort((x, y) => (y.faelligAm || y.createdAt).localeCompare(x.faelligAm || x.createdAt));
    const all = [...open, ...done];
    return limit ? all.slice(0, limit) : all;
  }, [activities, bezug, limit]);

  if (!list.length)
    return <EmptyState icon={<CalendarCheck size={22} />} title="Keine Aktivitäten" text={emptyText ?? 'Noch keine Aktivitäten erfasst.'} />;

  return (
    <ul className="divide-y divide-line">
      {list.map((a) => (
        <ActivityRow key={a.id} a={a} showBezug={showBezug} />
      ))}
    </ul>
  );
}
