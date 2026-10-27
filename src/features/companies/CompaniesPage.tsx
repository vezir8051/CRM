import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Download, Globe, Plus } from 'lucide-react';
import type { Company, CompanyDraft, CompanyStatus, ExtractionResult } from '@/types';
import { COMPANY_STATUS } from '@/types';
import { normalize } from '@/domain/format';
import { useData } from '@/store/data';
import { useLookups } from '@/store/selectors';
import { useUrlAction } from '@/lib/hooks';
import { downloadCsv } from '@/lib/download';
import { Avatar, Button, Card, CellStack, DataTable, EmptyState, PageHeader, SearchInput, Select, StatusBadge, Toolbar, type Column } from '@/components/ui';
import { CompanyForm } from './CompanyForm';
import { WebImportDialog } from './WebImportDialog';

export default function CompaniesPage() {
  const navigate = useNavigate();
  const companies = useData((s) => s.companies);
  const jobs = useData((s) => s.jobs);
  const assignments = useData((s) => s.assignments);
  const l = useLookups();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<CompanyStatus | ''>('');
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importData, setImportData] = useState<ExtractionResult<CompanyDraft> | null>(null);

  useUrlAction('neu', () => {
    setImportData(null);
    setFormOpen(true);
  });
  useUrlAction('import', () => setImportOpen(true));

  const stats = useMemo(() => {
    const m = new Map<string, { vakanzen: number; einsaetze: number }>();
    for (const c of companies) m.set(c.id, { vakanzen: 0, einsaetze: 0 });
    for (const j of jobs) if (j.status === 'Offen' || j.status === 'In Bearbeitung') m.get(j.companyId) && m.get(j.companyId)!.vakanzen++;
    for (const a of assignments) if (a.status === 'Aktiv') m.get(a.companyId) && m.get(a.companyId)!.einsaetze++;
    return m;
  }, [companies, jobs, assignments]);

  const rows = useMemo(() => {
    const n = normalize(q);
    return companies.filter((c) => (!status || c.status === status) && (!n || normalize(`${c.name} ${c.branche} ${c.ort} ${c.nr} ${c.kontakte.map((k) => `${k.vorname} ${k.nachname}`).join(' ')}`).includes(n)));
  }, [companies, q, status]);

  const columns: Column<Company>[] = [
    { key: 'nr', header: 'Nr', cell: (c) => <span className="text-muted">{c.nr}</span>, sortValue: (c) => c.nr, hideOnMobile: true },
    {
      key: 'name',
      header: 'Unternehmen',
      sortValue: (c) => c.name,
      cell: (c) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={c.name} size={34} square />
          <CellStack main={c.name} sub={c.branche || '–'} />
        </div>
      ),
    },
    { key: 'ort', header: 'Ort', cell: (c) => c.ort || '–', sortValue: (c) => c.ort, hideOnMobile: true },
    { key: 'kontakte', header: 'Kontakte', align: 'center', cell: (c) => c.kontakte.length, sortValue: (c) => c.kontakte.length, hideOnMobile: true },
    { key: 'vak', header: 'Offene Vakanzen', align: 'center', cell: (c) => stats.get(c.id)?.vakanzen || '–', sortValue: (c) => stats.get(c.id)?.vakanzen ?? 0 },
    { key: 'eins', header: 'Aktive Einsätze', align: 'center', cell: (c) => stats.get(c.id)?.einsaetze || '–', sortValue: (c) => stats.get(c.id)?.einsaetze ?? 0, hideOnMobile: true },
    { key: 'status', header: 'Status', cell: (c) => <StatusBadge value={c.status} />, sortValue: (c) => c.status },
    { key: 'betreuer', header: 'Betreuer', hideOnMobile: true, cell: (c) => (l.user.get(c.betreuerId) ? <Avatar name={l.user.get(c.betreuerId)!.name} size={26} /> : null) },
  ];

  return (
    <>
      <PageHeader
        title="Unternehmen"
        subtitle={`${companies.length} Unternehmen · ${companies.filter((c) => c.status === 'Aktiv').length} aktive Kunden`}
        actions={
          <>
            <Button
              icon={<Download size={16} />}
              className="hidden sm:inline-flex"
              onClick={() =>
                downloadCsv(
                  `unternehmen-${new Date().toISOString().slice(0, 10)}.csv`,
                  ['Nr', 'Name', 'Branche', 'Strasse', 'PLZ', 'Ort', 'Telefon', 'E-Mail', 'Website', 'Status', 'Honorarsatz %'],
                  rows.map((c) => [c.nr, c.name, c.branche, c.strasse, c.plz, c.ort, c.telefon, c.email, c.website, c.status, c.honorarSatz]),
                )
              }
            >
              CSV
            </Button>
            <Button variant="soft" icon={<Globe size={16} />} onClick={() => setImportOpen(true)}>
              Von Webseite importieren
            </Button>
            <Button
              variant="primary"
              icon={<Plus size={16} />}
              onClick={() => {
                setImportData(null);
                setFormOpen(true);
              }}
            >
              Neues Unternehmen
            </Button>
          </>
        }
      />
      <Toolbar>
        <SearchInput className="w-full sm:w-72" value={q} onChange={setQ} placeholder="Name, Branche, Ort, Kontaktperson…" />
        <Select className="w-auto" value={status} onChange={(e) => setStatus(e.target.value as CompanyStatus | '')}>
          <option value="">Alle Status</option>
          {COMPANY_STATUS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
        <span className="ml-auto text-[12.5px] text-muted">
          {rows.length} von {companies.length}
        </span>
      </Toolbar>
      <Card>
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(c) => c.id}
          onRowClick={(c) => navigate(`/unternehmen/${c.id}`)}
          defaultSort={{ key: 'name', dir: 'asc' }}
          empty={
            <EmptyState
              icon={<Building2 size={22} />}
              title="Keine Unternehmen gefunden"
              text="Tipp: Mit «Von Webseite importieren» genügt der Link zur Firmen-Webseite."
              action={
                <Button variant="primary" icon={<Globe size={15} />} onClick={() => setImportOpen(true)}>
                  Von Webseite importieren
                </Button>
              }
            />
          }
        />
      </Card>
      <WebImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onResult={(r) => {
          setImportOpen(false);
          setImportData(r);
          setFormOpen(true);
        }}
      />
      <CompanyForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setImportData(null);
        }}
        importData={importData}
        onSaved={(c) => navigate(`/unternehmen/${c.id}`)}
      />
    </>
  );
}
