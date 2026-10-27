import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlarmClock, CircleCheck, Download, FilePlus2, Receipt, Wallet } from 'lucide-react';
import type { Invoice, InvoiceStatus } from '@/types';
import { INVOICE_STATUS } from '@/types';
import { billableGroups, isInvoiceOverdue } from '@/domain/billing';
import { fmtCHF, fmtDate, fmtHours, monthKey, monthLabel, normalize, todayISO } from '@/domain/format';
import { useData } from '@/store/data';
import { useLookups } from '@/store/selectors';
import { toast } from '@/store/ui';
import { downloadCsv } from '@/lib/download';
import { Badge, Button, Card, CardHeader, CellStack, DataTable, EmptyState, KpiCard, PageHeader, SearchInput, Select, StatusBadge, Toolbar, type Column } from '@/components/ui';

type StatusFilter = InvoiceStatus | 'ueberfaellig' | '';

export default function InvoicesPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const invoices = useData((s) => s.invoices);
  const timesheets = useData((s) => s.timesheets);
  const assignments = useData((s) => s.assignments);
  const createVerleihInvoice = useData((s) => s.createVerleihInvoice);
  const l = useLookups();
  const [q, setQ] = useState('');
  const status = (params.get('status') ?? '') as StatusFilter;
  const today = todayISO();

  const setStatus = (v: StatusFilter) =>
    setParams((p) => {
      const n = new URLSearchParams(p);
      if (v) n.set('status', v);
      else n.delete('status');
      return n;
    });

  const groups = useMemo(() => billableGroups(timesheets, assignments), [timesheets, assignments]);

  const rows = useMemo(() => {
    const n = normalize(q);
    return invoices.filter((i) => {
      if (status === 'ueberfaellig' && !isInvoiceOverdue(i, today)) return false;
      if (status && status !== 'ueberfaellig' && i.status !== status) return false;
      return !n || normalize(`${i.nr} ${l.company.get(i.companyId)?.name ?? ''} ${i.typ}`).includes(n);
    });
  }, [invoices, q, status, l, today]);

  const offen = invoices.filter((i) => i.status === 'Offen');
  const overdue = offen.filter((i) => isInvoiceOverdue(i, today));
  const bezahltMonat = invoices.filter((i) => i.status === 'Bezahlt' && monthKey(i.bezahltAm) === monthKey(today));
  const sum = (list: Invoice[]) => list.reduce((s, i) => s + i.total, 0);

  const bill = (companyId: string, ids: string[], silent = false) => {
    const res = createVerleihInvoice(companyId, ids);
    if (!res.ok) {
      toast.error(res.error);
      return null;
    }
    if (!silent) toast.success(`Rechnung ${res.value.nr} erstellt`);
    return res.value;
  };

  const billAll = () => {
    const created = groups.map((g) => bill(g.companyId, g.timesheets.map((t) => t.id), true)).filter(Boolean);
    if (created.length) toast.success(`${created.length} Rechnungen erstellt`);
  };

  const exportCsv = () =>
    downloadCsv(
      `rechnungen-${today}.csv`,
      ['Nr', 'Kunde', 'Typ', 'Datum', 'Fällig', 'Periode', 'Netto', 'MWST', 'Total', 'Status', 'Bezahlt am'],
      rows.map((i) => [i.nr, l.company.get(i.companyId)?.name ?? '', i.typ, i.datum, i.faelligAm, i.periode, i.netto, i.mwst, i.total, i.status, i.bezahltAm]),
    );

  const columns: Column<Invoice>[] = [
    { key: 'nr', header: 'Nr', sortValue: (i) => i.nr, cell: (i) => <b>{i.nr}</b> },
    { key: 'kunde', header: 'Kunde', sortValue: (i) => l.company.get(i.companyId)?.name, cell: (i) => <CellStack main={l.company.get(i.companyId)?.name ?? '–'} sub={i.typ === 'Verleih' ? `Personalverleih ${i.periode ? monthLabel(i.periode) : ''}` : 'Vermittlungshonorar'} /> },
    { key: 'datum', header: 'Datum', sortValue: (i) => i.datum, cell: (i) => fmtDate(i.datum), hideOnMobile: true },
    {
      key: 'faellig',
      header: 'Fällig',
      sortValue: (i) => i.faelligAm,
      cell: (i) => (isInvoiceOverdue(i, today) ? <span className="font-semibold text-red-600">{fmtDate(i.faelligAm)}</span> : fmtDate(i.faelligAm)),
    },
    { key: 'total', header: 'Total', align: 'right', sortValue: (i) => i.total, cell: (i) => <span className="tabular-nums">{fmtCHF(i.total, { decimals: true })}</span> },
    { key: 'status', header: 'Status', sortValue: (i) => i.status, cell: (i) => (isInvoiceOverdue(i, today) ? <Badge tone="red">Überfällig</Badge> : <StatusBadge value={i.status} />) },
  ];

  return (
    <>
      <PageHeader
        title="Rechnungen"
        subtitle="Verleih- und Honorarrechnungen mit Swiss QR-Zahlteil"
        actions={
          <Button icon={<Download size={16} />} onClick={exportCsv} disabled={!rows.length}>
            CSV für Buchhaltung
          </Button>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard icon={<Wallet size={20} />} tone="blue" label="Offene Forderungen" value={fmtCHF(sum(offen))} hint={`${offen.length} Rechnungen`} />
        <KpiCard icon={<AlarmClock size={20} />} tone="red" label="Überfällig" value={fmtCHF(sum(overdue))} hint={`${overdue.length} Rechnungen`} to="/rechnungen?status=ueberfaellig" />
        <KpiCard icon={<CircleCheck size={20} />} tone="green" label="Zahlungseingang diesen Monat" value={fmtCHF(sum(bezahltMonat))} />
        <KpiCard icon={<FilePlus2 size={20} />} tone="amber" label="Bereit zur Verrechnung (netto)" value={fmtCHF(groups.reduce((s, g) => s + g.netto, 0))} hint={`${groups.length} Kunden-Perioden`} />
      </div>

      {groups.length > 0 && (
        <Card className="mb-5">
          <CardHeader
            title="Zur Verrechnung bereit"
            subtitle="Freigegebene Rapporte, gruppiert nach Kunde und Monat"
            actions={
              groups.length > 1 && (
                <Button size="sm" variant="primary" icon={<FilePlus2 size={14} />} onClick={billAll}>
                  Alle verrechnen
                </Button>
              )
            }
          />
          <DataTable
            rows={groups}
            rowKey={(g) => `${g.companyId}|${g.periode}`}
            columns={[
              { key: 'k', header: 'Kunde', cell: (g) => <b>{l.company.get(g.companyId)?.name ?? '–'}</b> },
              { key: 'p', header: 'Periode', cell: (g) => monthLabel(g.periode) },
              { key: 'r', header: 'Rapporte', align: 'center', cell: (g) => g.timesheets.length },
              { key: 'h', header: 'Stunden', align: 'right', cell: (g) => fmtHours(g.stunden) },
              { key: 'n', header: 'Netto', align: 'right', cell: (g) => <b className="tabular-nums">{fmtCHF(g.netto, { decimals: true })}</b> },
              {
                key: 'a',
                header: '',
                align: 'right',
                cell: (g) => (
                  <Button
                    size="sm"
                    variant="soft"
                    icon={<Receipt size={13} />}
                    onClick={() => {
                      const inv = bill(g.companyId, g.timesheets.map((t) => t.id));
                      if (inv) navigate(`/rechnungen/${inv.id}`);
                    }}
                  >
                    Rechnung erstellen
                  </Button>
                ),
              },
            ]}
          />
        </Card>
      )}

      <Toolbar>
        <SearchInput className="w-full sm:w-72" value={q} onChange={setQ} placeholder="Nr, Kunde…" />
        <Select className="w-auto" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
          <option value="">Alle Status</option>
          <option value="ueberfaellig">Überfällig</option>
          {INVOICE_STATUS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
        <span className="ml-auto text-[12.5px] text-muted">
          {rows.length} Rechnungen · {fmtCHF(sum(rows))}
        </span>
      </Toolbar>
      <Card>
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(i) => i.id}
          onRowClick={(i) => navigate(`/rechnungen/${i.id}`)}
          defaultSort={{ key: 'datum', dir: 'desc' }}
          empty={<EmptyState icon={<Receipt size={22} />} title="Keine Rechnungen" text="Rechnungen entstehen aus freigegebenen Rapporten oder vermittelten Festanstellungen." />}
        />
      </Card>
    </>
  );
}
