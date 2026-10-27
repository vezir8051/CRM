import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Briefcase, Building2, CalendarCheck, CalendarClock, Globe, Handshake, Mail, MapPin, Pencil, Phone, Plus, Receipt, Trash2, UserRound, Wallet } from 'lucide-react';
import type { Contact } from '@/types';
import { ACTIVE_PHASES } from '@/types';
import { fmtCHF, fmtDate, fullName, isOverdue, todayISO, websiteHost, websiteUrl } from '@/domain/format';
import { useTabParam } from '@/lib/hooks';
import { useData } from '@/store/data';
import { useLookups } from '@/store/selectors';
import { confirmDialog, toast } from '@/store/ui';
import { Avatar, Button, ButtonLink, Card, CardBody, CardHeader, CellStack, DataTable, EmptyState, IconButton, InfoList, StatsCard, StatusBadge, Tabs } from '@/components/ui';
import { ActivityTimeline } from '@/components/shared/ActivityTimeline';
import { ActivityDialog } from '@/components/shared/ActivityDialog';
import { AuditList } from '@/components/shared/AuditList';
import { CompanyForm } from './CompanyForm';
import { ContactDialog } from './ContactDialog';

const TABS = ['uebersicht', 'kontakte', 'vakanzen', 'einsaetze', 'rechnungen', 'aktivitaeten', 'verlauf'] as const;
type Tab = (typeof TABS)[number];

export default function CompanyDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const f = useData((s) => s.companies.find((c) => c.id === id));
  const jobs = useData((s) => s.jobs);
  const placements = useData((s) => s.placements);
  const assignments = useData((s) => s.assignments);
  const invoices = useData((s) => s.invoices);
  const activities = useData((s) => s.activities);
  const deleteCompany = useData((s) => s.deleteCompany);
  const removeContact = useData((s) => s.removeContact);
  const snapshot = useData((s) => s.snapshot);
  const l = useLookups();
  const [tab, setTab] = useTabParam<Tab>('uebersicht', TABS);
  const [editOpen, setEditOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [contact, setContact] = useState<Contact | null | undefined>(undefined);

  const ownJobs = useMemo(() => jobs.filter((j) => j.companyId === id), [jobs, id]);
  const jobIds = useMemo(() => new Set(ownJobs.map((j) => j.id)), [ownJobs]);
  const ownAssignments = useMemo(() => assignments.filter((a) => a.companyId === id), [assignments, id]);
  const ownInvoices = useMemo(() => invoices.filter((i) => i.companyId === id).sort((a, b) => b.datum.localeCompare(a.datum)), [invoices, id]);
  const kpi = useMemo(() => {
    const jahr = todayISO().slice(0, 4);
    return {
      offen: ownJobs.filter((j) => j.status === 'Offen' || j.status === 'In Bearbeitung').length,
      prozesse: placements.filter((p) => jobIds.has(p.jobId) && ACTIVE_PHASES.includes(p.phase)).length,
      einsaetze: ownAssignments.filter((a) => a.status === 'Aktiv').length,
      umsatz: ownInvoices.filter((i) => i.status !== 'Storniert' && i.datum.startsWith(jahr)).reduce((s, i) => s + i.netto, 0),
      offenBetrag: ownInvoices.filter((i) => i.status === 'Offen').reduce((s, i) => s + i.total, 0),
    };
  }, [ownJobs, placements, jobIds, ownAssignments, ownInvoices]);
  const actCount = useMemo(() => activities.filter((a) => a.bezug?.typ === 'company' && a.bezug.id === id).length, [activities, id]);

  if (!f) return <EmptyState icon={<Building2 size={22} />} title="Unternehmen nicht gefunden" action={<ButtonLink to="/unternehmen">Zur Liste</ButtonLink>} />;

  const remove = async () => {
    if (!(await confirmDialog({ title: 'Unternehmen löschen', message: `«${f.name}» wirklich löschen?`, confirmLabel: 'Löschen', tone: 'danger' }))) return;
    const restore = snapshot();
    const res = deleteCompany(f.id);
    if (!res.ok) return toast.error(res.error);
    toast.undo(`${f.name} gelöscht`, restore);
    navigate('/unternehmen');
  };

  return (
    <>
      <Link to="/unternehmen" className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-brand">
        <ArrowLeft size={15} /> Unternehmen
      </Link>
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <Avatar name={f.name} size={56} square />
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2.5 text-xl font-bold">
            {f.name} <StatusBadge value={f.status} />
          </h1>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13.5px] text-muted">
            <span>{f.branche || 'Branche unbekannt'}</span>
            {f.ort && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={13} /> {f.plz} {f.ort}
              </span>
            )}
            <span>{f.nr}</span>
            {f.website && (
              <a href={websiteUrl(f.website)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline">
                <Globe size={13} /> {websiteHost(f.website)}
              </a>
            )}
          </div>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button icon={<CalendarCheck size={16} />} onClick={() => setActivityOpen(true)}>
            Aktivität
          </Button>
          <ButtonLink variant="primary" icon={<Briefcase size={16} />} to={`/vakanzen?neu=1&firma=${f.id}`}>
            Neue Vakanz
          </ButtonLink>
          <Button icon={<Pencil size={16} />} onClick={() => setEditOpen(true)}>
            Bearbeiten
          </Button>
          <IconButton label="Löschen" tone="danger" onClick={remove}>
            <Trash2 size={17} />
          </IconButton>
        </div>
      </div>

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        items={[
          { value: 'uebersicht', label: 'Übersicht' },
          { value: 'kontakte', label: 'Kontakte', count: f.kontakte.length },
          { value: 'vakanzen', label: 'Vakanzen', count: ownJobs.length },
          { value: 'einsaetze', label: 'Einsätze', count: ownAssignments.length },
          { value: 'rechnungen', label: 'Rechnungen', count: ownInvoices.length },
          { value: 'aktivitaeten', label: 'Aktivitäten', count: actCount },
          { value: 'verlauf', label: 'Verlauf' },
        ]}
      />

      {tab === 'uebersicht' && (
        <>
          <div className="mb-5 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
            <StatsCard icon={Briefcase} gradient="blue" title="Offene Vakanzen" value={kpi.offen} />
            <StatsCard icon={Handshake} gradient="purple" title="Laufende Prozesse" value={kpi.prozesse} />
            <StatsCard icon={CalendarClock} gradient="cyan" title="Aktive Einsätze" value={kpi.einsaetze} />
            <StatsCard icon={Wallet} gradient="green" title={`Umsatz ${todayISO().slice(0, 4)} (netto)`} value={fmtCHF(kpi.umsatz)} hint={kpi.offenBetrag ? `${fmtCHF(kpi.offenBetrag)} offen` : undefined} />
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader title="Firmendaten" />
              <CardBody>
                <InfoList
                  items={[
                    ['Adresse', [f.strasse, `${f.plz} ${f.ort}`.trim()].filter(Boolean).join(', ')],
                    ['Telefon', f.telefon ? <a className="text-brand hover:underline" href={`tel:${f.telefon}`}>{f.telefon}</a> : ''],
                    ['E-Mail', f.email ? <a className="text-brand hover:underline" href={`mailto:${f.email}`}>{f.email}</a> : ''],
                    ['Website', f.website ? <a className="text-brand hover:underline" href={websiteUrl(f.website)} target="_blank" rel="noreferrer">{websiteHost(f.website)}</a> : ''],
                    ['Honorarsatz', f.honorarSatz !== null ? `${f.honorarSatz} %` : ''],
                    ['Zahlungsfrist', `${f.zahlungsfrist} Tage`],
                    ['Betreuer/in', l.user.get(f.betreuerId)?.name ?? ''],
                    ['Kunde seit', fmtDate(f.createdAt)],
                  ]}
                />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Notizen" />
              <CardBody>{f.notizen ? <p className="whitespace-pre-line text-[13.5px]">{f.notizen}</p> : <span className="text-sm text-subtle">Keine Notizen.</span>}</CardBody>
            </Card>
          </div>
        </>
      )}

      {tab === 'kontakte' && (
        <Card>
          <CardHeader title="Kontaktpersonen" actions={<Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => setContact(null)}>Kontakt</Button>} />
          {f.kontakte.length ? (
            <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
              {f.kontakte.map((k) => (
                <div key={k.id} className="rounded-xl border border-line p-4">
                  <div className="flex items-start gap-3">
                    <Avatar name={fullName(k)} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{[k.anrede, k.vorname, k.nachname].filter(Boolean).join(' ')}</div>
                      <div className="text-xs text-muted">{k.funktion || 'Funktion unbekannt'}</div>
                    </div>
                    <IconButton size="sm" label="Bearbeiten" onClick={() => setContact(k)}>
                      <Pencil size={14} />
                    </IconButton>
                    <IconButton
                      size="sm"
                      tone="danger"
                      label="Entfernen"
                      onClick={async () => {
                        if (await confirmDialog({ title: 'Kontakt entfernen', message: `${fullName(k)} entfernen?`, confirmLabel: 'Entfernen' })) removeContact(f.id, k.id);
                      }}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                  <div className="mt-3 space-y-1 text-[13px]">
                    {k.email && (
                      <a href={`mailto:${k.email}`} className="flex items-center gap-2 text-brand hover:underline">
                        <Mail size={13} /> {k.email}
                      </a>
                    )}
                    {k.telefon && (
                      <a href={`tel:${k.telefon}`} className="flex items-center gap-2 text-muted hover:text-fg">
                        <Phone size={13} /> {k.telefon}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<UserRound size={22} />} title="Keine Kontakte" text="Ansprechpartner für Vakanzen und Rechnungen erfassen." />
          )}
        </Card>
      )}

      {tab === 'vakanzen' && (
        <Card>
          <CardHeader title="Vakanzen" actions={<ButtonLink size="sm" variant="primary" icon={<Plus size={14} />} to={`/vakanzen?neu=1&firma=${f.id}`}>Vakanz</ButtonLink>} />
          <DataTable
            rows={ownJobs}
            rowKey={(j) => j.id}
            onRowClick={(j) => navigate(`/vakanzen/${j.id}`)}
            columns={[
              { key: 'nr', header: 'Nr', cell: (j) => <span className="text-muted">{j.nr}</span>, sortValue: (j) => j.nr },
              { key: 't', header: 'Titel', cell: (j) => <CellStack main={j.titel} sub={`${j.ort} · ${j.pensum}`} />, sortValue: (j) => j.titel },
              { key: 'art', header: 'Art', cell: (j) => <StatusBadge value={j.art} /> },
              { key: 'k', header: 'Kandidaten', align: 'center', cell: (j) => placements.filter((p) => p.jobId === j.id && p.phase !== 'Absage').length },
              { key: 's', header: 'Status', cell: (j) => <StatusBadge value={j.status} /> },
            ]}
            empty={<EmptyState icon={<Briefcase size={22} />} title="Keine Vakanzen" />}
          />
        </Card>
      )}

      {tab === 'einsaetze' && (
        <Card>
          <CardHeader title="Einsätze" actions={<ButtonLink size="sm" variant="primary" icon={<Plus size={14} />} to={`/einsaetze?neu=1&firma=${f.id}`}>Einsatz</ButtonLink>} />
          <DataTable
            rows={ownAssignments}
            rowKey={(a) => a.id}
            onRowClick={(a) => navigate(`/einsaetze/${a.id}`)}
            columns={[
              { key: 'nr', header: 'Nr', cell: (a) => a.nr },
              { key: 'm', header: 'Mitarbeitende/r', cell: (a) => <CellStack main={fullName(l.candidate.get(a.candidateId))} sub={a.funktion} /> },
              { key: 'z', header: 'Zeitraum', cell: (a) => `${fmtDate(a.start)} – ${a.ende ? fmtDate(a.ende) : 'offen'}` },
              { key: 't', header: 'Tarif', align: 'right', cell: (a) => `${fmtCHF(a.tarif, { decimals: true })}/h` },
              { key: 's', header: 'Status', cell: (a) => <StatusBadge value={a.status} /> },
            ]}
            empty={<EmptyState icon={<CalendarClock size={22} />} title="Keine Einsätze" />}
          />
        </Card>
      )}

      {tab === 'rechnungen' && (
        <Card>
          <CardHeader title="Rechnungen" />
          <DataTable
            rows={ownInvoices}
            rowKey={(i) => i.id}
            onRowClick={(i) => navigate(`/rechnungen/${i.id}`)}
            columns={[
              { key: 'nr', header: 'Nr', cell: (i) => i.nr },
              { key: 'typ', header: 'Typ', cell: (i) => <StatusBadge value={i.typ} /> },
              { key: 'd', header: 'Datum', cell: (i) => fmtDate(i.datum) },
              { key: 'f', header: 'Fällig', cell: (i) => <span className={i.status === 'Offen' && isOverdue(i.faelligAm) ? 'font-semibold text-red-600' : ''}>{fmtDate(i.faelligAm)}</span> },
              { key: 't', header: 'Total', align: 'right', cell: (i) => fmtCHF(i.total, { decimals: true }) },
              { key: 's', header: 'Status', cell: (i) => <StatusBadge value={i.status} /> },
            ]}
            empty={<EmptyState icon={<Receipt size={22} />} title="Keine Rechnungen" />}
          />
        </Card>
      )}

      {tab === 'aktivitaeten' && (
        <Card>
          <CardHeader title="Aktivitäten" actions={<Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => setActivityOpen(true)}>Neue Aktivität</Button>} />
          <CardBody className="py-1">
            <ActivityTimeline bezug={{ typ: 'company', id: f.id }} />
          </CardBody>
        </Card>
      )}

      {tab === 'verlauf' && (
        <Card>
          <CardHeader title="Änderungsverlauf" />
          <CardBody>
            <AuditList entity="company" entityId={f.id} />
          </CardBody>
        </Card>
      )}

      <CompanyForm open={editOpen} onClose={() => setEditOpen(false)} company={f} />
      <ActivityDialog open={activityOpen} onClose={() => setActivityOpen(false)} bezug={{ typ: 'company', id: f.id }} />
      <ContactDialog open={contact !== undefined} onClose={() => setContact(undefined)} companyId={f.id} contact={contact} />
    </>
  );
}
