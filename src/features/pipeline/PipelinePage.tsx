import { useMemo, useState, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Ellipsis, Handshake, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Phase, Placement } from '@/types';
import { ACTIVE_PHASES, PHASES } from '@/types';
import { PHASE_COLORS } from '@/domain/constants';
import { daysBetween, fmtCHF, fullName, normalize, todayISO } from '@/domain/format';
import { useData } from '@/store/data';
import { useLookups } from '@/store/selectors';
import { useCurrentUser } from '@/store/session';
import { confirmDialog, toast } from '@/store/ui';
import { cn } from '@/lib/cn';
import { Avatar, Button, Checkbox, DropdownMenu, IconButton, PageHeader, SearchInput, Select, Toolbar } from '@/components/ui';
import { PlacementDialog } from '@/components/shared/PlacementDialog';

/** Tage seit dem letzten Phasenwechsel */
function daysInPhase(p: Placement, today: string): number {
  const last = p.verlauf[p.verlauf.length - 1]?.datum ?? p.updatedAt;
  return daysBetween(last.slice(0, 10), today);
}

export default function PipelinePage() {
  const placements = useData((s) => s.placements);
  const users = useData((s) => s.users);
  const movePlacement = useData((s) => s.movePlacement);
  const deletePlacement = useData((s) => s.deletePlacement);
  const snapshot = useData((s) => s.snapshot);
  const me = useCurrentUser();
  const l = useLookups();
  const [q, setQ] = useState('');
  const [betreuer, setBetreuer] = useState('');
  const [showClosed, setShowClosed] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overPhase, setOverPhase] = useState<Phase | null>(null);
  const [dialog, setDialog] = useState<{ open: boolean; placement?: Placement | null }>({ open: false });
  const today = todayISO();

  const visible = useMemo(() => {
    const n = normalize(q);
    return placements.filter((p) => {
      const job = l.job.get(p.jobId);
      const cand = l.candidate.get(p.candidateId);
      if (!job || !cand) return false;
      if (betreuer && job.betreuerId !== betreuer) return false;
      if (!n) return true;
      return normalize(`${fullName(cand)} ${job.titel} ${l.company.get(job.companyId)?.name ?? ''}`).includes(n);
    });
  }, [placements, q, betreuer, l]);

  const columns = showClosed ? PHASES : PHASES.filter((p) => p !== 'Absage');
  const byPhase = useMemo(() => {
    const m = new Map<Phase, Placement[]>(PHASES.map((p) => [p, []]));
    for (const p of visible) m.get(p.phase)!.push(p);
    for (const list of m.values()) list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return m;
  }, [visible]);

  const active = visible.filter((p) => ACTIVE_PHASES.includes(p.phase));
  const potenzial = active.reduce((s, p) => s + (p.honorar ?? 0), 0);
  const entschieden = visible.filter((p) => p.phase === 'Vermittelt' || p.phase === 'Absage');
  const quote = entschieden.length ? Math.round((visible.filter((p) => p.phase === 'Vermittelt').length / entschieden.length) * 100) : null;

  const move = (id: string, phase: Phase) => {
    const p = placements.find((x) => x.id === id);
    if (!p || p.phase === phase) return;
    movePlacement(id, phase);
    toast.success(`${fullName(l.candidate.get(p.candidateId))} → ${phase}`);
  };

  const onDrop = (e: DragEvent, phase: Phase) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || dragId;
    setOverPhase(null);
    setDragId(null);
    if (id) move(id, phase);
  };

  const remove = async (p: Placement) => {
    if (!(await confirmDialog({ title: 'Prozess entfernen', message: `${fullName(l.candidate.get(p.candidateId))} aus dem Prozess «${l.job.get(p.jobId)?.titel}» entfernen?`, confirmLabel: 'Entfernen', tone: 'danger' }))) return;
    const restore = snapshot();
    deletePlacement(p.id);
    toast.undo('Prozess entfernt', restore);
  };

  return (
    <>
      <PageHeader
        title="Pipeline"
        subtitle={`${active.length} laufende Prozesse · Honorarpotenzial ${fmtCHF(potenzial)}${quote !== null ? ` · Erfolgsquote ${quote} %` : ''}`}
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setDialog({ open: true })}>
            Kandidat vorschlagen
          </Button>
        }
      />
      <Toolbar>
        <SearchInput className="w-full sm:w-72" value={q} onChange={setQ} placeholder="Kandidat, Vakanz, Kunde…" />
        <Select className="w-auto" value={betreuer} onChange={(e) => setBetreuer(e.target.value)}>
          <option value="">Alle Betreuer/innen</option>
          {me && <option value={me.id}>Nur meine</option>}
          {users
            .filter((u) => u.id !== me?.id)
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
        </Select>
        <Checkbox label="Absagen anzeigen" checked={showClosed} onChange={setShowClosed} />
        <span className="ml-auto hidden text-[12.5px] text-muted md:inline">Karten per Drag & Drop in eine andere Phase ziehen</span>
      </Toolbar>

      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-3">
        {columns.map((phase) => {
          const list = byPhase.get(phase) ?? [];
          const summe = list.reduce((s, p) => s + (p.honorar ?? 0), 0);
          return (
            <section
              key={phase}
              aria-label={phase}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (overPhase !== phase) setOverPhase(phase);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverPhase(null);
              }}
              onDrop={(e) => onDrop(e, phase)}
              className={cn(
                'flex min-h-[420px] w-[272px] shrink-0 flex-col rounded-xl border border-line bg-surface-2/60 transition-colors',
                overPhase === phase && 'border-brand bg-brand-soft/60',
              )}
            >
              <header className="flex items-center gap-2 border-b border-line px-3.5 py-2.5" style={{ borderTop: `3px solid ${PHASE_COLORS[phase]}`, borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
                <h2 className="text-[13.5px] font-bold">{phase}</h2>
                <span className="rounded-full bg-surface px-2 text-xs font-semibold text-muted">{list.length}</span>
                {summe > 0 && <span className="ml-auto text-[11.5px] text-muted">{fmtCHF(summe)}</span>}
              </header>
              <div className="flex flex-1 flex-col gap-2 p-2">
                {list.map((p) => {
                  const cand = l.candidate.get(p.candidateId);
                  const job = l.job.get(p.jobId);
                  const tage = daysInPhase(p, today);
                  const stale = ACTIVE_PHASES.includes(p.phase) && tage >= (p.phase === 'Angebot' ? 5 : 10);
                  return (
                    <article
                      key={p.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', p.id);
                        e.dataTransfer.effectAllowed = 'move';
                        setDragId(p.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverPhase(null);
                      }}
                      className={cn(
                        'cursor-grab rounded-lg border border-line bg-surface p-3 shadow-card transition-opacity active:cursor-grabbing',
                        dragId === p.id && 'opacity-40',
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        <Avatar name={fullName(cand)} size={30} />
                        <div className="min-w-0 flex-1">
                          <Link to={`/kandidaten/${p.candidateId}`} className="block truncate text-[13.5px] font-semibold hover:text-brand">
                            {fullName(cand)}
                          </Link>
                          <Link to={`/vakanzen/${p.jobId}?tab=pipeline`} className="block truncate text-xs text-muted hover:text-brand">
                            {job?.titel}
                          </Link>
                          <div className="truncate text-xs text-subtle">{l.company.get(job?.companyId ?? '')?.name}</div>
                        </div>
                        <DropdownMenu
                          trigger={(_open, toggle) => (
                            <IconButton size="sm" label="Aktionen" onClick={toggle}>
                              <Ellipsis size={15} />
                            </IconButton>
                          )}
                          items={[
                            ...PHASES.filter((ph) => ph !== p.phase).map((ph) => ({ label: `Nach «${ph}»`, icon: <ArrowRight size={14} />, onSelect: () => move(p.id, ph) })),
                            'divider' as const,
                            { label: 'Bearbeiten', icon: <Pencil size={14} />, onSelect: () => setDialog({ open: true, placement: p }) },
                            { label: 'Entfernen', icon: <Trash2 size={14} />, tone: 'danger' as const, onSelect: () => remove(p) },
                          ]}
                        />
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-[11.5px]">
                        <span className={cn('rounded px-1.5 py-0.5 font-semibold', stale ? 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300' : 'bg-surface-2 text-muted')}>
                          {tage === 0 ? 'heute' : `${tage} T.`} in Phase
                        </span>
                        {job?.art === 'Temporär' && <span className="rounded bg-cyan-50 px-1.5 py-0.5 font-semibold text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300">Temporär</span>}
                        {p.honorar ? <span className="ml-auto font-semibold text-muted">{fmtCHF(p.honorar)}</span> : null}
                      </div>
                    </article>
                  );
                })}
                {!list.length && <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-line px-3 py-8 text-center text-xs text-subtle">Keine Prozesse</div>}
              </div>
            </section>
          );
        })}
      </div>
      {!placements.length && (
        <div className="mt-2 flex items-center gap-2 text-sm text-muted">
          <Handshake size={16} /> Noch keine Vermittlungsprozesse – schlagen Sie einen Kandidaten für eine Vakanz vor.
        </div>
      )}
      <PlacementDialog open={dialog.open} onClose={() => setDialog({ open: false })} placement={dialog.placement} />
    </>
  );
}
