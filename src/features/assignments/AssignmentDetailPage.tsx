import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, CalendarCheck, CalendarClock, CalendarPlus, ChevronDown, Clock, Coins, FileSignature, Pencil, Play, Plus, Printer, Square, Trash2, TrendingUp } from 'lucide-react';
import { assignmentEconomics, timesheetHours } from '@/domain/billing';
import { calcMargin, marginTone } from '@/domain/tarif';
import { addDays, daysBetween, fmtCHF, fmtDate, fmtHours, fmtPercent, fullName, todayISO, weekLabel } from '@/domain/format';
import { useData } from '@/store/data';
import { assignmentWeeks, useLookups } from '@/store/selectors';
import { confirmDialog, toast } from '@/store/ui';
import { useTabParam } from '@/lib/hooks';
import { printDialog } from '@/lib/download';
import { Badge, Button, ButtonLink, Card, CardBody, CardHeader, DataTable, DropdownMenu, EmptyState, IconButton, InfoList, StatsCard, Modal, StatusBadge, Tabs } from '@/components/ui';
import { ActivityTimeline } from '@/components/shared/ActivityTimeline';
import { ActivityDialog } from '@/components/shared/ActivityDialog';
import { AuditList } from '@/components/shared/AuditList';
import { AssignmentForm } from './AssignmentForm';

const TABS = ['uebersicht', 'rapporte', 'aktivitaeten', 'verlauf'] as const;
type Tab = (typeof TABS)[number];

export default function AssignmentDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const a = useData((s) => s.assignments.find((x) => x.id === id));
  const timesheets = useData((s) => s.timesheets);
  const settings = useData((s) => s.settings);
  const activities = useData((s) => s.activities);
  const updateAssignment = useData((s) => s.updateAssignment);
  const deleteAssignment = useData((s) => s.deleteAssignment);
  const snapshot = useData((s) => s.snapshot);
  const l = useLookups();
  const [tab, setTab] = useTabParam<Tab>('uebersicht', TABS);
  const [editOpen, setEditOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const today = todayISO();

  const own = useMemo(() => timesheets.filter((t) => t.assignmentId === id), [timesheets, id]);
  const actCount = useMemo(() => activities.filter((x) => x.bezug?.typ === 'assignment' && x.bezug.id === id).length, [activities, id]);

  if (!a) return <EmptyState icon={<CalendarClock size={22} />} title="Einsatz nicht gefunden" action={<ButtonLink to="/einsaetze">Zur Liste</ButtonLink>} />;
  const cand = l.candidate.get(a.candidateId);
  const company = l.company.get(a.companyId);
  const job = l.job.get(a.jobId);
  const eco = assignmentEconomics(a, timesheets, settings);
  const m = calcMargin(a.stundenlohn, a.tarif, settings.tarif);
  const rest = a.ende ? daysBetween(today, a.ende) : null;

  const extend = (days: number) => {
    const base = a.ende && a.ende > today ? a.ende : today;
    const ende = addDays(base, days);
    updateAssignment(a.id, { ende, status: a.status === 'Beendet' ? 'Aktiv' : a.status });
    toast.success(`Einsatz verlängert bis ${fmtDate(ende)}`);
  };

  const remove = async () => {
    if (!(await confirmDialog({ title: 'Einsatz löschen', message: `Einsatz ${a.nr} inkl. ${own.length} Rapport(e) löschen?`, confirmLabel: 'Löschen', tone: 'danger' }))) return;
    const restore = snapshot();
    const res = deleteAssignment(a.id);
    if (!res.ok) return toast.error(res.error);
    toast.undo('Einsatz gelöscht', restore);
    navigate('/einsaetze');
  };

  return (
    <>
      <Link to="/einsaetze" className="no-print mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-brand">
        <ArrowLeft size={15} /> Einsätze
      </Link>
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2.5 text-xl font-bold">
            {fullName(cand)} <span className="font-normal text-muted">·</span> {a.funktion} <StatusBadge value={a.status} />
          </h1>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13.5px] text-muted">
            {company && (
              <Link to={`/unternehmen/${company.id}`} className="inline-flex items-center gap-1 text-brand hover:underline">
                <Building2 size={13} /> {company.name}
              </Link>
            )}
            <span>
              {fmtDate(a.start)} – {a.ende ? fmtDate(a.ende) : 'unbefristet'}
            </span>
            {a.status === 'Aktiv' && rest !== null && rest >= 0 && rest <= 14 && (
              <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
                <Clock size={13} /> endet in {rest} Tagen
              </span>
            )}
            <span>{a.nr}</span>
          </div>
        </div>
        <div className="no-print ml-auto flex flex-wrap gap-2">
          {a.status === 'Geplant' && (
            <Button variant="primary" icon={<Play size={15} />} onClick={() => updateAssignment(a.id, { status: 'Aktiv' })}>
              Einsatz starten
            </Button>
          )}
          {a.status === 'Aktiv' && (
            <Button
              icon={<Square size={14} />}
              onClick={async () => {
                if (!(await confirmDialog({ title: 'Einsatz beenden', message: `Einsatz per heute (${fmtDate(today)}) beenden?`, confirmLabel: 'Beenden' }))) return;
                updateAssignment(a.id, { status: 'Beendet', ende: a.ende && a.ende < today ? a.ende : today });
                toast.success('Einsatz beendet');
              }}
            >
              Beenden
            </Button>
          )}
          <DropdownMenu
            trigger={(_o, toggle) => (
              <Button icon={<CalendarPlus size={15} />} onClick={toggle}>
                Verlängern <ChevronDown size={14} />
              </Button>
            )}
            items={[
              { label: '+ 1 Woche', onSelect: () => extend(7) },
              { label: '+ 4 Wochen', onSelect: () => extend(28) },
              { label: '+ 3 Monate', onSelect: () => extend(91) },
            ]}
          />
          <Button icon={<FileSignature size={15} />} onClick={() => setContractOpen(true)}>
            Einsatzvertrag
          </Button>
          <Button icon={<Pencil size={15} />} onClick={() => setEditOpen(true)}>
            Bearbeiten
          </Button>
          <IconButton label="Löschen" tone="danger" onClick={remove}>
            <Trash2 size={17} />
          </IconButton>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatsCard icon={Clock} gradient="blue" title="Rapportierte Stunden" value={fmtHours(eco.stunden)} hint={`${own.length} Wochenrapporte`} />
        <StatsCard icon={Coins} gradient="cyan" title="Umsatz" value={fmtCHF(eco.umsatz)} hint={`${fmtCHF(a.tarif, { decimals: true })}/h`} />
        <StatsCard icon={TrendingUp} gradient="green" title="Deckungsbeitrag" value={fmtCHF(eco.deckungsbeitrag)} hint={`${fmtCHF(m.deckungsbeitrag, { decimals: true })}/h`} />
        <StatsCard icon={CalendarCheck} gradient={marginTone(m.margeProzent)} title="Marge" value={fmtPercent(m.margeProzent)} hint={`Ziel ${settings.tarif.zielmarge} %`} />
      </div>

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        items={[
          { value: 'uebersicht', label: 'Übersicht' },
          { value: 'rapporte', label: 'Rapporte', count: own.length },
          { value: 'aktivitaeten', label: 'Aktivitäten', count: actCount },
          { value: 'verlauf', label: 'Verlauf' },
        ]}
      />

      {tab === 'uebersicht' && (
        <div className="grid gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader title="Einsatzdaten" />
            <CardBody>
              <InfoList
                items={[
                  ['Mitarbeiter/in', cand ? <Link className="text-brand hover:underline" to={`/kandidaten/${cand.id}`}>{fullName(cand)}</Link> : ''],
                  ['Bewilligung', cand?.bewilligung ?? ''],
                  ['Kunde', company?.name ?? ''],
                  ['Vakanz', job ? <Link className="text-brand hover:underline" to={`/vakanzen/${job.id}`}>{job.titel}</Link> : ''],
                  ['Einsatzort', a.einsatzort],
                  ['Zeitraum', `${fmtDate(a.start)} – ${a.ende ? fmtDate(a.ende) : 'unbefristet'}`],
                  ['Soll-Stunden', `${a.sollStunden} h / Woche`],
                  ['Notiz', a.notiz ? <span className="whitespace-pre-line font-normal">{a.notiz}</span> : ''],
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Tarifkalkulation pro Stunde" subtitle="Sätze gemäss Einstellungen" />
            <table className="w-full text-[13px]">
              <tbody>
                {m.zeilen.map((z) => (
                  <tr key={z.key} className="border-b border-line">
                    <td className="px-5 py-1.5">{z.label}</td>
                    <td className="px-2 py-1.5 text-right text-muted">{z.satz !== null ? fmtPercent(z.satz, 2) : ''}</td>
                    <td className="px-5 py-1.5 text-right tabular-nums">{fmtCHF(z.betrag, { decimals: true })}</td>
                  </tr>
                ))}
                <tr className="border-b border-line font-semibold">
                  <td className="px-5 py-2">Lohnkosten</td>
                  <td />
                  <td className="px-5 py-2 text-right tabular-nums">{fmtCHF(m.lohnkosten, { decimals: true })}</td>
                </tr>
                <tr className="border-b border-line">
                  <td className="px-5 py-2">Verrechnungssatz</td>
                  <td />
                  <td className="px-5 py-2 text-right tabular-nums">{fmtCHF(a.tarif, { decimals: true })}</td>
                </tr>
                <tr className="font-bold">
                  <td className="px-5 py-2.5">Deckungsbeitrag</td>
                  <td className="px-2 py-2.5 text-right">
                    <Badge tone={marginTone(m.margeProzent)}>{fmtPercent(m.margeProzent)}</Badge>
                  </td>
                  <td className="px-5 py-2.5 text-right tabular-nums">{fmtCHF(m.deckungsbeitrag, { decimals: true })}</td>
                </tr>
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {tab === 'rapporte' && <TimesheetTab assignmentId={a.id} />}

      {tab === 'aktivitaeten' && (
        <Card>
          <CardHeader title="Aktivitäten" actions={<Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => setActivityOpen(true)}>Neue Aktivität</Button>} />
          <CardBody className="py-1">
            <ActivityTimeline bezug={{ typ: 'assignment', id: a.id }} />
          </CardBody>
        </Card>
      )}
      {tab === 'verlauf' && (
        <Card>
          <CardHeader title="Änderungsverlauf" />
          <CardBody>
            <AuditList entity="assignment" entityId={a.id} extraIds={own.map((t) => t.id)} />
          </CardBody>
        </Card>
      )}

      <AssignmentForm open={editOpen} onClose={() => setEditOpen(false)} assignment={a} />
      <ActivityDialog open={activityOpen} onClose={() => setActivityOpen(false)} bezug={{ typ: 'assignment', id: a.id }} />
      <ContractModal open={contractOpen} onClose={() => setContractOpen(false)} assignmentId={a.id} />
    </>
  );
}

/* ---------- Rapporte des Einsatzes (alle Wochen seit Start) ---------- */
function TimesheetTab({ assignmentId }: { assignmentId: string }) {
  const a = useData((s) => s.assignments.find((x) => x.id === assignmentId))!;
  const timesheets = useData((s) => s.timesheets);
  const rows = useMemo(() => {
    const weeks = assignmentWeeks(a).reverse();
    return weeks.map((woche) => ({ woche, ts: timesheets.find((t) => t.assignmentId === a.id && t.woche === woche) }));
  }, [a, timesheets]);

  return (
    <Card>
      <CardHeader title="Wochenrapporte" subtitle="Alle Wochen seit Einsatzbeginn" />
      <DataTable
        rows={rows}
        rowKey={(r) => r.woche}
        columns={[
          { key: 'woche', header: 'Woche', cell: (r) => weekLabel(r.woche) },
          { key: 'h', header: 'Stunden', align: 'right', cell: (r) => (r.ts ? <b className="tabular-nums">{fmtHours(timesheetHours(r.ts))}</b> : <span className="text-subtle">–</span>) },
          { key: 's', header: 'Spesen', align: 'right', hideOnMobile: true, cell: (r) => (r.ts?.spesen ? fmtCHF(r.ts.spesen, { decimals: true }) : '–') },
          { key: 'b', header: 'Betrag', align: 'right', cell: (r) => (r.ts ? fmtCHF(timesheetHours(r.ts) * a.tarif + r.ts.spesen) : '–') },
          { key: 'st', header: 'Status', cell: (r) => (r.ts ? <StatusBadge value={r.ts.status} /> : <Badge tone="red">fehlt</Badge>) },
          {
            key: 'go',
            header: '',
            align: 'right',
            cell: (r) =>
              r.ts?.status === 'Verrechnet' ? (
                <Link className="text-xs font-semibold text-brand hover:underline" to={`/rechnungen/${r.ts.invoiceId}`}>
                  Rechnung
                </Link>
              ) : (
                <ButtonLink size="sm" to={`/rapporte?woche=${r.woche}`}>
                  {r.ts ? 'Öffnen' : 'Erfassen'}
                </ButtonLink>
              ),
          },
        ]}
        empty={<EmptyState icon={<Clock size={22} />} title="Noch keine Rapportwochen" text="Rapporte können ab Einsatzbeginn erfasst werden." />}
      />
    </Card>
  );
}

/* ---------- Einsatzvertrag (druckbar) ---------- */
function ContractModal({ open, onClose, assignmentId }: { open: boolean; onClose: () => void; assignmentId: string }) {
  const a = useData((s) => s.assignments.find((x) => x.id === assignmentId));
  const settings = useData((s) => s.settings);
  const l = useLookups();
  if (!a) return null;
  const cand = l.candidate.get(a.candidateId);
  const company = l.company.get(a.companyId);
  const r = settings.tarif;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Einsatzvertrag"
      subtitle="Gemäss Arbeitsvermittlungsgesetz (AVG) Art. 19 – vor Einsatzbeginn schriftlich auszuhändigen"
      footer={
        <>
          <Button onClick={onClose}>Schliessen</Button>
          <Button variant="primary" icon={<Printer size={15} />} onClick={printDialog}>
            Drucken / PDF
          </Button>
        </>
      }
    >
      <div className="print-area space-y-4 text-[13.5px] leading-relaxed">
        <div className="flex justify-between gap-4">
          <div>
            <div className="font-bold">{settings.firmenname}</div>
            <div className="text-muted">
              {settings.strasse}, {settings.plz} {settings.ort}
            </div>
          </div>
          <div className="text-right text-muted">
            Einsatz {a.nr}
            <br />
            {fmtDate(todayISO())}
          </div>
        </div>
        <h2 className="text-lg font-bold">Einsatzvertrag Personalverleih</h2>
        <InfoList
          items={[
            ['Mitarbeiter/in', `${fullName(cand)}${cand?.geburtsdatum ? `, geb. ${fmtDate(cand.geburtsdatum)}` : ''}`],
            ['Einsatzbetrieb', company ? `${company.name}, ${company.strasse}, ${company.plz} ${company.ort}` : ''],
            ['Funktion / Tätigkeit', a.funktion],
            ['Arbeitsort', a.einsatzort],
            ['Einsatzbeginn', fmtDate(a.start)],
            ['Dauer', a.ende ? `bis ${fmtDate(a.ende)}` : 'unbefristet (Kündigungsfristen gemäss GAV Personalverleih)'],
            ['Arbeitszeit', `${a.sollStunden} Stunden pro Woche`],
            ['Grundlohn', `${fmtCHF(a.stundenlohn, { decimals: true })} pro Stunde`],
            ['Ferienentschädigung', fmtPercent(r.ferien, 2)],
            ['Feiertagsentschädigung', fmtPercent(r.feiertage, 2)],
            ['13. Monatslohn', fmtPercent(r.dreizehnter, 2)],
            ['Spesen', 'gemäss Rapport und Belegen'],
          ]}
        />
        <p className="text-muted">
          Es gelten der Rahmenarbeitsvertrag sowie der Gesamtarbeitsvertrag Personalverleih. Die Arbeitszeit ist wöchentlich mit dem Rapport zu bestätigen. Sozialversicherungsabzüge (AHV/IV/EO, ALV, NBU, KTG, BVG) erfolgen gemäss den gesetzlichen Bestimmungen.
        </p>
        <div className="grid grid-cols-2 gap-10 pt-10">
          <div className="border-t border-fg/40 pt-1 text-xs text-muted">Ort, Datum, Unterschrift {settings.firmenname}</div>
          <div className="border-t border-fg/40 pt-1 text-xs text-muted">Ort, Datum, Unterschrift Mitarbeiter/in</div>
        </div>
      </div>
    </Modal>
  );
}
