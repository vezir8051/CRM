import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, Check, ChevronLeft, ChevronRight, ClipboardCheck, FileClock, RotateCcw, Send, WandSparkles } from 'lucide-react';
import type { Assignment, Timesheet } from '@/types';
import { timesheetHours } from '@/domain/billing';
import { addDays, fmtCHF, fmtDate, fmtHours, fullName, round2, startOfWeek, todayISO, weekLabel, WEEKDAYS_SHORT } from '@/domain/format';
import { useData } from '@/store/data';
import { useLookups } from '@/store/selectors';
import { toast } from '@/store/ui';
import { cn } from '@/lib/cn';
import { Avatar, Button, Card, CardHeader, CellStack, DataTable, EmptyState, IconButton, PageHeader, SegmentedControl, StatusBadge } from '@/components/ui';

type View = 'woche' | 'freigabe';
type Draft = { stunden: number[]; spesen: number };

const EMPTY_WEEK = [0, 0, 0, 0, 0, 0, 0];

/** Einsatz läuft (mindestens teilweise) in der Woche */
function activeInWeek(a: Assignment, monday: string): boolean {
  if (a.status === 'Geplant' && a.start > addDays(monday, 6)) return false;
  return a.start <= addDays(monday, 6) && (!a.ende || a.ende >= monday);
}

/** Tag liegt innerhalb der Einsatzdauer */
function dayInRange(a: Assignment, day: string): boolean {
  return day >= a.start && (!a.ende || day <= a.ende);
}

export default function TimesheetsPage() {
  const [params, setParams] = useSearchParams();
  const view: View = params.get('status') === 'Eingereicht' || params.get('ansicht') === 'freigabe' ? 'freigabe' : 'woche';
  const woche = startOfWeek(params.get('woche') ?? todayISO());

  const setView = (v: View) =>
    setParams((p) => {
      const n = new URLSearchParams(p);
      n.delete('status');
      if (v === 'freigabe') n.set('ansicht', 'freigabe');
      else n.delete('ansicht');
      return n;
    });
  const setWoche = (w: string) =>
    setParams((p) => {
      const n = new URLSearchParams(p);
      n.set('woche', w);
      return n;
    });

  const timesheets = useData((s) => s.timesheets);
  const pending = timesheets.filter((t) => t.status === 'Eingereicht').length;

  return (
    <>
      <PageHeader
        title="Rapporte"
        subtitle="Wochenrapporte erfassen, einreichen und freigeben"
        actions={
          <SegmentedControl<View>
            value={view}
            onChange={setView}
            options={[
              { value: 'woche', label: 'Wochenerfassung', icon: <CalendarDays size={14} /> },
              { value: 'freigabe', label: `Freigabe${pending ? ` (${pending})` : ''}`, icon: <ClipboardCheck size={14} /> },
            ]}
          />
        }
      />
      {view === 'woche' ? <WeekView woche={woche} onWoche={setWoche} /> : <ApprovalView onOpenWeek={(w) => { setView('woche'); setWoche(w); }} />}
    </>
  );
}

/* ---------- Wochenerfassung ---------- */
function WeekView({ woche, onWoche }: { woche: string; onWoche: (w: string) => void }) {
  const assignments = useData((s) => s.assignments);
  const timesheets = useData((s) => s.timesheets);
  const saveTimesheet = useData((s) => s.saveTimesheet);
  const setTimesheetStatus = useData((s) => s.setTimesheetStatus);
  const l = useLookups();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const today = todayISO();
  const days = WEEKDAYS_SHORT.map((_, i) => addDays(woche, i));

  const rows = useMemo(
    () =>
      assignments
        .filter((a) => activeInWeek(a, woche))
        .sort((a, b) => fullName(l.candidate.get(a.candidateId)).localeCompare(fullName(l.candidate.get(b.candidateId)))),
    [assignments, woche, l],
  );
  const tsFor = (a: Assignment) => timesheets.find((t) => t.assignmentId === a.id && t.woche === woche);
  const valueFor = (a: Assignment): Draft => {
    const ts = tsFor(a);
    return drafts[a.id] ?? { stunden: ts?.stunden ?? EMPTY_WEEK, spesen: ts?.spesen ?? 0 };
  };
  const editable = (ts: Timesheet | undefined) => !ts || ts.status === 'Offen' || ts.status === 'Eingereicht';

  const setDraft = (a: Assignment, patch: Partial<Draft>) => setDrafts((d) => ({ ...d, [a.id]: { ...valueFor(a), ...patch } }));
  const clearDraft = (id: string) =>
    setDrafts((d) => {
      const { [id]: _drop, ...rest } = d;
      return rest;
    });

  const save = (a: Assignment, submit = false): boolean => {
    const v = valueFor(a);
    const res = saveTimesheet(a.id, woche, v);
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    clearDraft(a.id);
    if (submit) {
      if (!timesheetHours(v)) {
        toast.error('Ein Rapport ohne Stunden kann nicht eingereicht werden.');
        return false;
      }
      setTimesheetStatus(res.value.id, 'Eingereicht');
    }
    return true;
  };

  /** Soll-Stunden gleichmässig auf die Arbeitstage im Einsatzzeitraum verteilen */
  const fillSoll = (a: Assignment) => {
    const workdays = days.slice(0, 5).filter((d) => dayInRange(a, d));
    if (!workdays.length) return;
    const proTag = round2(a.sollStunden / 5);
    setDraft(a, { stunden: days.map((d, i) => (i < 5 && dayInRange(a, d) ? proTag : 0)) });
  };

  const dirtyIds = Object.keys(drafts);
  const saveAll = () => {
    let n = 0;
    for (const id of dirtyIds) {
      const a = assignments.find((x) => x.id === id);
      if (a && save(a)) n++;
    }
    if (n) toast.success(`${n} Rapport${n > 1 ? 'e' : ''} gespeichert`);
  };

  const totalWeek = rows.reduce((s, a) => s + timesheetHours(valueFor(a)), 0);

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-1">
            <IconButton label="Vorherige Woche" onClick={() => onWoche(addDays(woche, -7))}>
              <ChevronLeft size={17} />
            </IconButton>
            <span className="whitespace-nowrap px-1 text-center sm:min-w-[230px]">{weekLabel(woche)}</span>
            <IconButton label="Nächste Woche" onClick={() => onWoche(addDays(woche, 7))}>
              <ChevronRight size={17} />
            </IconButton>
          </span>
        }
        subtitle={`${rows.length} Einsätze · ${fmtHours(round2(totalWeek))} erfasst`}
        actions={
          <>
            {woche !== startOfWeek(today) && (
              <Button size="sm" onClick={() => onWoche(startOfWeek(today))}>
                Diese Woche
              </Button>
            )}
            <Button size="sm" variant="primary" disabled={!dirtyIds.length} onClick={saveAll}>
              Alle speichern{dirtyIds.length ? ` (${dirtyIds.length})` : ''}
            </Button>
          </>
        }
      />
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[11.5px] font-semibold uppercase tracking-wide text-muted">
                <th className="px-4 py-2.5">Mitarbeiter/in</th>
                {days.map((d, i) => (
                  <th key={d} className={cn('w-[62px] px-1 py-2.5 text-center', d === today && 'text-brand')}>
                    {WEEKDAYS_SHORT[i]}
                    <div className="font-normal normal-case tracking-normal">{fmtDate(d).slice(0, 6)}</div>
                  </th>
                ))}
                <th className="px-2 py-2.5 text-right">Total</th>
                <th className="w-[90px] px-2 py-2.5">Spesen</th>
                <th className="px-2 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const ts = tsFor(a);
                const v = valueFor(a);
                const canEdit = editable(ts);
                const dirty = !!drafts[a.id];
                const total = timesheetHours(v);
                const c = l.candidate.get(a.candidateId);
                return (
                  <tr key={a.id} className={cn('border-b border-line last:border-0', dirty && 'bg-amber-50/60 dark:bg-amber-950/20')}>
                    <td className="px-4 py-2">
                      <Link to={`/einsaetze/${a.id}`} className="flex items-center gap-2.5 hover:text-brand">
                        <Avatar name={fullName(c)} size={28} />
                        <CellStack main={fullName(c)} sub={`${l.company.get(a.companyId)?.name ?? ''} · Soll ${a.sollStunden} h`} />
                      </Link>
                    </td>
                    {days.map((d, i) => {
                      const inRange = dayInRange(a, d);
                      return (
                        <td key={d} className="px-1 py-2">
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            max={24}
                            step={0.25}
                            aria-label={`${fullName(c)} ${WEEKDAYS_SHORT[i]}`}
                            disabled={!canEdit || !inRange}
                            value={v.stunden[i] || ''}
                            placeholder={inRange ? '0' : ''}
                            onChange={(e) => setDraft(a, { stunden: v.stunden.map((h, j) => (j === i ? Math.min(24, Math.max(0, Number(e.target.value) || 0)) : h)) })}
                            className={cn('input-base h-8 w-full min-w-[48px] px-1 text-center tabular-nums', i >= 5 && 'bg-surface-2', !inRange && 'opacity-30')}
                          />
                        </td>
                      );
                    })}
                    <td className={cn('px-2 py-2 text-right font-semibold tabular-nums', total > a.sollStunden * 1.2 && 'text-amber-600')} title={total > a.sollStunden * 1.2 ? 'Deutlich über Soll – Überstunden prüfen' : undefined}>
                      {fmtHours(total)}
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={5}
                        aria-label={`${fullName(c)} Spesen`}
                        disabled={!canEdit}
                        value={v.spesen || ''}
                        placeholder="0"
                        onChange={(e) => setDraft(a, { spesen: Math.max(0, Number(e.target.value) || 0) })}
                        className="input-base h-8 w-full px-1.5 text-right tabular-nums"
                      />
                    </td>
                    <td className="px-2 py-2">{ts ? <StatusBadge value={ts.status} /> : <span className="text-xs text-subtle">nicht erfasst</span>}</td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-1">
                        {canEdit && (
                          <IconButton size="sm" label="Soll-Stunden übernehmen" onClick={() => fillSoll(a)}>
                            <WandSparkles size={14} />
                          </IconButton>
                        )}
                        {canEdit && dirty && (
                          <Button size="sm" onClick={() => save(a) && toast.success('Gespeichert')}>
                            Speichern
                          </Button>
                        )}
                        {canEdit && (!ts || ts.status === 'Offen') && (
                          <Button size="sm" variant="soft" icon={<Send size={13} />} disabled={!total} onClick={() => save(a, true) && toast.success('Rapport eingereicht')}>
                            Einreichen
                          </Button>
                        )}
                        {ts?.status === 'Eingereicht' && !dirty && (
                          <Button
                            size="sm"
                            variant="primary"
                            icon={<Check size={13} />}
                            onClick={() => {
                              const r = setTimesheetStatus(ts.id, 'Freigegeben');
                              r.ok ? toast.success('Rapport freigegeben') : toast.error(r.error);
                            }}
                          >
                            Freigeben
                          </Button>
                        )}
                        {ts?.status === 'Freigegeben' && (
                          <IconButton size="sm" label="Freigabe aufheben" onClick={() => setTimesheetStatus(ts.id, 'Eingereicht')}>
                            <RotateCcw size={14} />
                          </IconButton>
                        )}
                        {ts?.status === 'Verrechnet' && (
                          <Link to={`/rechnungen/${ts.invoiceId}`} className="text-xs font-semibold text-brand hover:underline">
                            Zur Rechnung
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={<FileClock size={22} />} title="Keine Einsätze in dieser Woche" text="Rapporte können für geplante und aktive Einsätze erfasst werden." />
      )}
    </Card>
  );
}

/* ---------- Freigabe ---------- */
function ApprovalView({ onOpenWeek }: { onOpenWeek: (woche: string) => void }) {
  const timesheets = useData((s) => s.timesheets);
  const setTimesheetStatus = useData((s) => s.setTimesheetStatus);
  const l = useLookups();
  const rows = useMemo(() => timesheets.filter((t) => t.status === 'Eingereicht'), [timesheets]);

  const approveAll = () => {
    rows.forEach((t) => setTimesheetStatus(t.id, 'Freigegeben'));
    toast.success(`${rows.length} Rapporte freigegeben`);
  };

  return (
    <Card>
      <CardHeader
        title="Eingereichte Rapporte"
        subtitle="Nach der Freigabe können die Stunden verrechnet werden"
        actions={
          <Button size="sm" variant="primary" icon={<Check size={14} />} disabled={!rows.length} onClick={approveAll}>
            Alle freigeben
          </Button>
        }
      />
      <DataTable
        rows={rows}
        rowKey={(t) => t.id}
        defaultSort={{ key: 'woche', dir: 'asc' }}
        columns={[
          {
            key: 'ma',
            header: 'Mitarbeiter/in',
            sortValue: (t) => fullName(l.candidate.get(l.assignment.get(t.assignmentId)?.candidateId ?? '')),
            cell: (t) => {
              const a = l.assignment.get(t.assignmentId);
              return <CellStack main={fullName(l.candidate.get(a?.candidateId ?? ''))} sub={`${l.company.get(a?.companyId ?? '')?.name ?? ''} · ${a?.funktion ?? ''}`} />;
            },
          },
          { key: 'woche', header: 'Woche', sortValue: (t) => t.woche, cell: (t) => weekLabel(t.woche) },
          {
            key: 'tage',
            header: 'Stunden Mo–So',
            hideOnMobile: true,
            cell: (t) => <span className="font-mono text-xs text-muted">{t.stunden.map((h) => (h ? String(h) : '·')).join(' / ')}</span>,
          },
          { key: 'h', header: 'Total', align: 'right', sortValue: (t) => timesheetHours(t), cell: (t) => <b className="tabular-nums">{fmtHours(timesheetHours(t))}</b> },
          {
            key: 'betrag',
            header: 'Betrag',
            align: 'right',
            cell: (t) => {
              const a = l.assignment.get(t.assignmentId);
              return a ? fmtCHF(timesheetHours(t) * a.tarif + t.spesen) : '–';
            },
          },
          {
            key: 'a',
            header: '',
            align: 'right',
            cell: (t) => (
              <span className="inline-flex gap-1">
                <Button size="sm" onClick={() => onOpenWeek(t.woche)}>
                  Öffnen
                </Button>
                <IconButton size="sm" label="Zurückweisen" onClick={() => {
                    setTimesheetStatus(t.id, 'Offen');
                    toast.info('Rapport zurückgewiesen');
                  }}>
                  <RotateCcw size={14} />
                </IconButton>
                <Button size="sm" variant="primary" icon={<Check size={13} />} onClick={() => {
                    setTimesheetStatus(t.id, 'Freigegeben');
                    toast.success('Freigegeben');
                  }}>
                  Freigeben
                </Button>
              </span>
            ),
          },
        ]}
        empty={<EmptyState icon={<ClipboardCheck size={22} />} title="Alles erledigt" text="Es warten keine Rapporte auf eine Freigabe." />}
      />
    </Card>
  );
}

