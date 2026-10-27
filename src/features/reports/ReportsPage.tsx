import { useMemo, useState } from 'react';
import { Clock, Download, Handshake, Percent, Wallet } from 'lucide-react';
import { CANDIDATE_STATUS } from '@/types';
import { avgDaysToPlacement, consultantStats, funnel, revenueByCompany, revenueByMonth, sourceStats } from '@/domain/reports';
import { CHART_COLORS, PHASE_COLORS, STATUS_TONES, TONE_HEX } from '@/domain/constants';
import { fmtCHF, fmtCompact, lastMonths, monthLabel, MONTHS_SHORT, todayISO } from '@/domain/format';
import { useCrmData } from '@/store/selectors';
import { downloadCsv } from '@/lib/download';
import { Avatar, Button, Card, CardBody, CardHeader, DataTable, StatsCard, PageHeader, SegmentedControl } from '@/components/ui';
import { BarChart, DonutChart, HBarList } from '@/components/charts/Charts';

type Range = '6' | '12';

export default function ReportsPage() {
  const data = useCrmData();
  const [range, setRange] = useState<Range>('6');
  const today = todayISO();
  const months = useMemo(() => lastMonths(Number(range), today), [range, today]);

  const revenue = useMemo(() => revenueByMonth(data.invoices, months), [data.invoices, months]);
  const byCompany = useMemo(() => revenueByCompany(data.invoices, months[0]!, months[months.length - 1]!), [data.invoices, months]);
  const steps = useMemo(() => funnel(data.placements), [data.placements]);
  const avgDays = useMemo(() => avgDaysToPlacement(data.placements), [data.placements]);
  const sources = useMemo(() => sourceStats(data.candidates, data.placements), [data.candidates, data.placements]);
  const consultants = useMemo(() => consultantStats(data.users, data.jobs, data.placements), [data.users, data.jobs, data.placements]);

  const total = revenue.reduce((s, r) => s + r.total, 0);
  const verleih = revenue.reduce((s, r) => s + r.verleih, 0);
  const decided = data.placements.filter((p) => p.phase === 'Vermittelt' || p.phase === 'Absage');
  const won = decided.filter((p) => p.phase === 'Vermittelt').length;
  const quote = decided.length ? Math.round((won / decided.length) * 100) : null;

  const topCompanies = [...byCompany.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id, value], i) => ({ label: data.companies.find((c) => c.id === id)?.name ?? 'Unbekannt', value, to: `/unternehmen/${id}`, color: CHART_COLORS[i % CHART_COLORS.length] }));

  const statusDonut = CANDIDATE_STATUS.map((s) => ({ label: s, value: data.candidates.filter((c) => c.status === s).length, color: TONE_HEX[STATUS_TONES[s] ?? 'gray'] })).filter((d) => d.value > 0);

  const exportCsv = () =>
    downloadCsv(
      `umsatz-${months[0]}-bis-${months[months.length - 1]}.csv`,
      ['Monat', 'Personalverleih netto', 'Vermittlungshonorare netto', 'Total netto'],
      revenue.map((r) => [monthLabel(r.month), r.verleih, r.honorar, r.total]),
    );

  return (
    <>
      <PageHeader
        title="Berichte"
        subtitle={`${monthLabel(months[0]!)} – ${monthLabel(months[months.length - 1]!)}`}
        actions={
          <>
            <SegmentedControl<Range>
              value={range}
              onChange={setRange}
              options={[
                { value: '6', label: '6 Monate' },
                { value: '12', label: '12 Monate' },
              ]}
            />
            <Button icon={<Download size={16} />} onClick={exportCsv}>
              CSV
            </Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatsCard icon={Wallet} gradient="green" title="Umsatz netto" value={fmtCHF(total)} hint={`Verleih ${total ? Math.round((verleih / total) * 100) : 0} % · Honorare ${total ? 100 - Math.round((verleih / total) * 100) : 0} %`} />
        <StatsCard icon={Handshake} gradient="purple" title="Vermittlungen gesamt" value={won} />
        <StatsCard icon={Percent} gradient="blue" title="Erfolgsquote" value={quote !== null ? `${quote} %` : '–'} hint="Vermittelt / entschiedene Prozesse" />
        <StatsCard icon={Clock} gradient="amber" title="Ø Tage bis Vermittlung" value={avgDays ?? '–'} hint="Vom Vorschlag bis zur Zusage" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader title="Umsatz pro Monat" subtitle="Netto, ohne stornierte Rechnungen" />
          <CardBody>
            <BarChart
              height={230}
              data={revenue.map((r) => ({
                label: MONTHS_SHORT[Number(r.month.slice(5, 7)) - 1]!,
                value: r.total,
                title: `${monthLabel(r.month)}: ${fmtCHF(r.total)} – Verleih ${fmtCHF(r.verleih)}, Honorare ${fmtCHF(r.honorar)}`,
              }))}
              format={fmtCompact}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Top-Kunden nach Umsatz" />
          <CardBody>{topCompanies.length ? <HBarList data={topCompanies} format={fmtCompact} labelWidth={150} /> : <p className="text-sm text-muted">Keine Umsätze im Zeitraum.</p>}</CardBody>
        </Card>

        <Card>
          <CardHeader title="Vermittlungstrichter" subtitle="Anteil der Prozesse, die die jeweilige Phase erreichen" />
          <CardBody className="space-y-3">
            {steps.map((s, i) => {
              const base = steps[0]!.count || 1;
              const prev = i > 0 ? steps[i - 1]!.count : null;
              return (
                <div key={s.phase} className="flex items-center gap-3 text-[13px]">
                  <span className="w-28 shrink-0 text-muted">{s.phase}</span>
                  <div className="h-7 flex-1 rounded-md bg-surface-2">
                    <div className="flex h-full items-center rounded-md px-2 text-xs font-semibold text-white" style={{ width: `${Math.max(8, (s.count / base) * 100)}%`, background: PHASE_COLORS[s.phase] }}>
                      {s.count}
                    </div>
                  </div>
                  <span className="w-24 shrink-0 text-right text-xs text-muted">{prev ? `${Math.round((s.count / prev) * 100)} % vom Vorschritt` : ''}</span>
                </div>
              );
            })}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Kandidaten nach Status" />
          <CardBody>
            <DonutChart data={statusDonut} centerLabel="Kandidaten" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Rekrutierungskanäle" subtitle="Welche Quellen führen zu Vermittlungen?" />
          <DataTable
            rows={sources}
            rowKey={(s) => s.quelle}
            defaultSort={{ key: 'quote', dir: 'desc' }}
            columns={[
              { key: 'quelle', header: 'Quelle', sortValue: (s) => s.quelle, cell: (s) => <b>{s.quelle}</b> },
              { key: 'k', header: 'Kandidaten', align: 'right', sortValue: (s) => s.kandidaten, cell: (s) => s.kandidaten },
              { key: 'v', header: 'Vermittelt / im Einsatz', align: 'right', sortValue: (s) => s.vermittelt, cell: (s) => s.vermittelt },
              {
                key: 'quote',
                header: 'Quote',
                align: 'right',
                sortValue: (s) => s.quote,
                cell: (s) => (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2">
                      <span className="block h-full rounded-full bg-brand" style={{ width: `${s.quote}%` }} />
                    </span>
                    <span className="w-10 tabular-nums">{s.quote} %</span>
                  </span>
                ),
              },
            ]}
          />
        </Card>
        <Card>
          <CardHeader title="Berater/innen" subtitle="Nach betreuten Vakanzen" />
          <DataTable
            rows={consultants}
            rowKey={(c) => c.user.id}
            columns={[
              {
                key: 'u',
                header: 'Name',
                cell: (c) => (
                  <span className="flex items-center gap-2">
                    <Avatar name={c.user.name} size={26} /> {c.user.name}
                  </span>
                ),
              },
              { key: 'o', header: 'Offene Vakanzen', align: 'right', sortValue: (c) => c.offeneVakanzen, cell: (c) => c.offeneVakanzen },
              { key: 'a', header: 'Aktive Prozesse', align: 'right', sortValue: (c) => c.aktiveProzesse, cell: (c) => c.aktiveProzesse },
              { key: 'v', header: 'Vermittelt', align: 'right', sortValue: (c) => c.vermittlungen, cell: (c) => <b>{c.vermittlungen}</b> },
              { key: 'h', header: 'Honorare', align: 'right', hideOnMobile: true, sortValue: (c) => c.honorar, cell: (c) => fmtCHF(c.honorar) },
            ]}
          />
        </Card>
      </div>
    </>
  );
}
