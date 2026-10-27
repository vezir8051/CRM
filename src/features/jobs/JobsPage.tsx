import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Briefcase, Plus } from 'lucide-react';
import type { EmploymentType, Job, JobStatus, Priority } from '@/types';
import { EMPLOYMENT_TYPES, JOB_STATUS } from '@/types';
import { fmtRelative, isOverdue, normalize } from '@/domain/format';
import { useData } from '@/store/data';
import { useLookups } from '@/store/selectors';
import { useUrlAction } from '@/lib/hooks';
import { cn } from '@/lib/cn';
import { Button, Card, CellStack, DataTable, EmptyState, PageHeader, SearchInput, Select, StatusBadge, Toolbar, type Column } from '@/components/ui';
import { JobForm } from './JobForm';
import { lohnText } from './jobUtils';

const PRIO_ORDER: Record<Priority, number> = { Hoch: 0, Mittel: 1, Niedrig: 2 };

export default function JobsPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const jobs = useData((s) => s.jobs);
  const placements = useData((s) => s.placements);
  const l = useLookups();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<JobStatus | 'aktiv' | ''>('aktiv');
  const [art, setArt] = useState<EmploymentType | ''>('');
  const [formOpen, setFormOpen] = useState(false);
  const [presetCompany, setPresetCompany] = useState<string | undefined>();

  useUrlAction('neu', () => {
    setPresetCompany(params.get('firma') ?? undefined);
    setFormOpen(true);
  });

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of placements) if (p.phase !== 'Absage') m.set(p.jobId, (m.get(p.jobId) ?? 0) + 1);
    return m;
  }, [placements]);

  const rows = useMemo(() => {
    const n = normalize(q);
    return jobs.filter((j) => {
      if (status === 'aktiv' && !(j.status === 'Offen' || j.status === 'In Bearbeitung')) return false;
      if (status && status !== 'aktiv' && j.status !== status) return false;
      if (art && j.art !== art) return false;
      return !n || normalize(`${j.titel} ${j.nr} ${j.ort} ${l.company.get(j.companyId)?.name ?? ''} ${j.skills.join(' ')}`).includes(n);
    });
  }, [jobs, q, status, art, l]);

  const columns: Column<Job>[] = [
    { key: 'nr', header: 'Nr', cell: (j) => <span className="text-muted">{j.nr}</span>, sortValue: (j) => j.nr, hideOnMobile: true },
    { key: 'titel', header: 'Vakanz', sortValue: (j) => j.titel, cell: (j) => <CellStack main={j.titel} sub={`${l.company.get(j.companyId)?.name ?? '–'} · ${j.ort}`} /> },
    { key: 'art', header: 'Art', cell: (j) => <StatusBadge value={j.art} />, sortValue: (j) => j.art, hideOnMobile: true },
    { key: 'lohn', header: 'Lohn / Tarif', cell: (j) => <span className="whitespace-nowrap">{lohnText(j)}</span>, hideOnMobile: true },
    { key: 'prio', header: 'Priorität', cell: (j) => <StatusBadge value={j.prioritaet} />, sortValue: (j) => PRIO_ORDER[j.prioritaet] },
    {
      key: 'deadline',
      header: 'Antritt',
      sortValue: (j) => j.deadline,
      cell: (j) => (j.deadline ? <span className={cn((j.status === 'Offen' || j.status === 'In Bearbeitung') && isOverdue(j.deadline) && 'font-semibold text-red-600')}>{fmtRelative(j.deadline)}</span> : '–'),
    },
    { key: 'kand', header: 'Kandidaten', align: 'center', cell: (j) => `${counts.get(j.id) ?? 0}${j.anzahl > 1 ? ` / ${j.anzahl} Stellen` : ''}`, sortValue: (j) => counts.get(j.id) ?? 0 },
    { key: 'status', header: 'Status', cell: (j) => <StatusBadge value={j.status} />, sortValue: (j) => j.status },
  ];

  return (
    <>
      <PageHeader
        title="Vakanzen"
        subtitle={`${jobs.filter((j) => j.status === 'Offen' || j.status === 'In Bearbeitung').length} offen · ${jobs.length} total`}
        actions={
          <Button
            variant="primary"
            icon={<Plus size={16} />}
            onClick={() => {
              setPresetCompany(undefined);
              setFormOpen(true);
            }}
          >
            Neue Vakanz
          </Button>
        }
      />
      <Toolbar>
        <SearchInput className="w-full sm:w-72" value={q} onChange={setQ} placeholder="Titel, Kunde, Ort, Skill…" />
        <Select className="w-auto" value={status} onChange={(e) => setStatus(e.target.value as JobStatus | 'aktiv' | '')}>
          <option value="aktiv">Offen & in Bearbeitung</option>
          <option value="">Alle Status</option>
          {JOB_STATUS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
        <Select className="w-auto" value={art} onChange={(e) => setArt(e.target.value as EmploymentType | '')}>
          <option value="">Alle Arten</option>
          {EMPLOYMENT_TYPES.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </Select>
        <span className="ml-auto text-[12.5px] text-muted">
          {rows.length} von {jobs.length}
        </span>
      </Toolbar>
      <Card>
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(j) => j.id}
          onRowClick={(j) => navigate(`/vakanzen/${j.id}`)}
          defaultSort={{ key: 'prio', dir: 'asc' }}
          empty={<EmptyState icon={<Briefcase size={22} />} title="Keine Vakanzen" text="Passen Sie die Filter an oder erfassen Sie eine neue Vakanz." />}
        />
      </Card>
      <JobForm open={formOpen} onClose={() => setFormOpen(false)} companyId={presetCompany} onSaved={(j) => navigate(`/vakanzen/${j.id}`)} />
    </>
  );
}
