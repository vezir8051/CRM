import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarClock, Clock, Coins, Plus, TrendingUp, UserCheck } from 'lucide-react';
import type { Assignment, AssignmentStatus } from '@/types';
import { ASSIGNMENT_STATUS } from '@/types';
import { calcMargin, marginTone } from '@/domain/tarif';
import { daysBetween, fmtCHF, fmtDate, fmtPercent, fullName, normalize, todayISO } from '@/domain/format';
import { useData } from '@/store/data';
import { useLookups } from '@/store/selectors';
import { useUrlAction } from '@/lib/hooks';
import { Avatar, Badge, Button, Card, CellStack, DataTable, EmptyState, StatsCard, PageHeader, SearchInput, Select, StatusBadge, Toolbar, type Column } from '@/components/ui';
import { AssignmentForm, type AssignmentPreset } from './AssignmentForm';

export default function AssignmentsPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const assignments = useData((s) => s.assignments);
  const settings = useData((s) => s.settings);
  const l = useLookups();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<AssignmentStatus | 'laufend' | ''>('laufend');
  const [form, setForm] = useState<{ open: boolean; preset?: AssignmentPreset }>({ open: false });
  const today = todayISO();

  useUrlAction('neu', () =>
    setForm({ open: true, preset: { candidateId: params.get('kandidat') ?? undefined, companyId: params.get('firma') ?? undefined, placementId: params.get('placement') ?? undefined } }),
  );

  const rows = useMemo(() => {
    const n = normalize(q);
    return assignments.filter((a) => {
      if (status === 'laufend' && a.status === 'Beendet') return false;
      if (status && status !== 'laufend' && a.status !== status) return false;
      return !n || normalize(`${a.nr} ${a.funktion} ${a.einsatzort} ${fullName(l.candidate.get(a.candidateId))} ${l.company.get(a.companyId)?.name ?? ''}`).includes(n);
    });
  }, [assignments, q, status, l]);

  const aktive = assignments.filter((a) => a.status === 'Aktiv');
  const dbWoche = aktive.reduce((s, a) => s + calcMargin(a.stundenlohn, a.tarif, settings.tarif).deckungsbeitrag * a.sollStunden, 0);
  const umsatzWoche = aktive.reduce((s, a) => s + a.tarif * a.sollStunden, 0);
  const endendBald = aktive.filter((a) => a.ende && daysBetween(today, a.ende) >= 0 && daysBetween(today, a.ende) <= 14).length;

  const columns: Column<Assignment>[] = [
    { key: 'nr', header: 'Nr', cell: (a) => <span className="text-muted">{a.nr}</span>, sortValue: (a) => a.nr, hideOnMobile: true },
    {
      key: 'ma',
      header: 'Mitarbeiter/in',
      sortValue: (a) => fullName(l.candidate.get(a.candidateId)),
      cell: (a) => {
        const c = l.candidate.get(a.candidateId);
        return (
          <span className="flex items-center gap-2.5">
            <Avatar name={fullName(c)} size={30} />
            <CellStack main={fullName(c)} sub={a.funktion} />
          </span>
        );
      },
    },
    { key: 'kunde', header: 'Kunde', sortValue: (a) => l.company.get(a.companyId)?.name, cell: (a) => <CellStack main={l.company.get(a.companyId)?.name ?? '–'} sub={a.einsatzort} /> },
    {
      key: 'zeit',
      header: 'Zeitraum',
      sortValue: (a) => a.start,
      cell: (a) => {
        const rest = a.ende ? daysBetween(today, a.ende) : null;
        return (
          <CellStack
            main={`${fmtDate(a.start)} – ${a.ende ? fmtDate(a.ende) : 'offen'}`}
            sub={a.status === 'Aktiv' && rest !== null && rest >= 0 && rest <= 14 ? <span className="font-semibold text-amber-600">endet in {rest} Tagen</span> : undefined}
          />
        );
      },
    },
    {
      key: 'tarif',
      header: 'Lohn / Tarif',
      align: 'right',
      hideOnMobile: true,
      sortValue: (a) => a.tarif,
      cell: (a) => <CellStack main={`${fmtCHF(a.tarif, { decimals: true })}/h`} sub={`Lohn ${fmtCHF(a.stundenlohn, { decimals: true })}`} />,
    },
    {
      key: 'marge',
      header: 'Marge',
      align: 'right',
      sortValue: (a) => calcMargin(a.stundenlohn, a.tarif, settings.tarif).margeProzent,
      cell: (a) => {
        const m = calcMargin(a.stundenlohn, a.tarif, settings.tarif).margeProzent;
        return <Badge tone={marginTone(m)}>{fmtPercent(m)}</Badge>;
      },
    },
    { key: 'status', header: 'Status', cell: (a) => <StatusBadge value={a.status} />, sortValue: (a) => a.status },
  ];

  return (
    <>
      <PageHeader
        title="Einsätze"
        subtitle="Temporäre Einsätze im Personalverleih"
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setForm({ open: true })}>
            Neuer Einsatz
          </Button>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatsCard icon={UserCheck} gradient="cyan" title="Aktive Einsätze" value={aktive.length} hint={`${assignments.filter((a) => a.status === 'Geplant').length} geplant`} />
        <StatsCard icon={Coins} gradient="blue" title="Umsatz pro Woche (Soll)" value={fmtCHF(umsatzWoche)} />
        <StatsCard icon={TrendingUp} gradient="green" title="Deckungsbeitrag pro Woche" value={fmtCHF(dbWoche)} hint={umsatzWoche ? `Ø Marge ${fmtPercent((dbWoche / umsatzWoche) * 100)}` : undefined} />
        <StatsCard icon={Clock} gradient="amber" title="Enden in ≤ 14 Tagen" value={endendBald} hint="Verlängerung / Anschluss planen" />
      </div>
      <Toolbar>
        <SearchInput className="w-full sm:w-72" value={q} onChange={setQ} placeholder="Name, Kunde, Funktion…" />
        <Select className="w-auto" value={status} onChange={(e) => setStatus(e.target.value as AssignmentStatus | 'laufend' | '')}>
          <option value="laufend">Geplant & aktiv</option>
          <option value="">Alle Status</option>
          {ASSIGNMENT_STATUS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
        <span className="ml-auto text-[12.5px] text-muted">
          {rows.length} von {assignments.length}
        </span>
      </Toolbar>
      <Card>
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(a) => a.id}
          onRowClick={(a) => navigate(`/einsaetze/${a.id}`)}
          defaultSort={{ key: 'zeit', dir: 'desc' }}
          empty={<EmptyState icon={<CalendarClock size={22} />} title="Keine Einsätze" text="Einsätze entstehen aus vermittelten Temporär-Vakanzen oder direkt über «Neuer Einsatz»." />}
        />
      </Card>
      <AssignmentForm open={form.open} onClose={() => setForm({ open: false })} preset={form.preset} onSaved={(a) => navigate(`/einsaetze/${a.id}`)} />
    </>
  );
}
