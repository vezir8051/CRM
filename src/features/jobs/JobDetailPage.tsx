import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Briefcase, Building2, CalendarCheck, CalendarClock, Clock, Copy, Handshake, Mail, MapPin, Pencil, Plus, Receipt, Sparkles, Trash2, UserRound } from 'lucide-react';
import type { Job, Phase, Placement } from '@/types';
import { PHASES } from '@/types';
import { fmtCHF, fmtDate, fmtRelative, fullName } from '@/domain/format';
import { rankCandidates } from '@/domain/matching';
import { inseratTemplate } from '@/domain/templates';
import { aiRankCandidates, generateText, type AiMatch } from '@/lib/ai';
import { copyToClipboard } from '@/lib/download';
import { useTabParam } from '@/lib/hooks';
import { useData } from '@/store/data';
import { useLookups } from '@/store/selectors';
import { confirmDialog, toast } from '@/store/ui';
import { Avatar, Badge, Button, ButtonLink, Callout, Card, CardBody, CardHeader, CellStack, DataTable, EmptyState, IconButton, InfoList, ScoreBar, Select, StatusBadge, Tabs, Tag, Textarea } from '@/components/ui';
import { ActivityTimeline } from '@/components/shared/ActivityTimeline';
import { ActivityDialog } from '@/components/shared/ActivityDialog';
import { PlacementDialog } from '@/components/shared/PlacementDialog';
import { AuditList } from '@/components/shared/AuditList';
import { EmailComposer } from '@/components/shared/EmailComposer';
import { SourceBadge } from '@/components/shared/AiStatus';
import { JobForm } from './JobForm';
import { lohnText } from './jobUtils';

const TABS = ['uebersicht', 'pipeline', 'matching', 'inserat', 'aktivitaeten', 'verlauf'] as const;
type Tab = (typeof TABS)[number];

export default function JobDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const job = useData((s) => s.jobs.find((j) => j.id === id));
  const placements = useData((s) => s.placements);
  const activities = useData((s) => s.activities);
  const deleteJob = useData((s) => s.deleteJob);
  const updateJob = useData((s) => s.updateJob);
  const snapshot = useData((s) => s.snapshot);
  const l = useLookups();
  const [tab, setTab] = useTabParam<Tab>('uebersicht', TABS);
  const [editOpen, setEditOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [proposeOpen, setProposeOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  const own = useMemo(() => placements.filter((p) => p.jobId === id), [placements, id]);
  const actCount = useMemo(() => activities.filter((a) => a.bezug?.typ === 'job' && a.bezug.id === id).length, [activities, id]);

  if (!job) return <EmptyState icon={<Briefcase size={22} />} title="Vakanz nicht gefunden" action={<ButtonLink to="/vakanzen">Zur Liste</ButtonLink>} />;
  const company = l.company.get(job.companyId);
  const contact = company?.kontakte.find((k) => k.id === job.kontaktId);

  const remove = async () => {
    if (!(await confirmDialog({ title: 'Vakanz löschen', message: `«${job.titel}» inkl. ${own.length} Vermittlungsprozess(en) löschen?`, confirmLabel: 'Löschen', tone: 'danger' }))) return;
    const restore = snapshot();
    deleteJob(job.id);
    toast.undo('Vakanz gelöscht', restore);
    navigate('/vakanzen');
  };

  return (
    <>
      <Link to="/vakanzen" className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-brand">
        <ArrowLeft size={15} /> Vakanzen
      </Link>
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2.5 text-xl font-bold">
            {job.titel} <StatusBadge value={job.status} /> <StatusBadge value={job.prioritaet} />
          </h1>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13.5px] text-muted">
            {company && (
              <Link to={`/unternehmen/${company.id}`} className="inline-flex items-center gap-1 text-brand hover:underline">
                <Building2 size={13} /> {company.name}
              </Link>
            )}
            <span className="inline-flex items-center gap-1">
              <MapPin size={13} /> {job.ort || '–'}
            </span>
            <span>{job.pensum}</span>
            <StatusBadge value={job.art} />
            {job.deadline && (
              <span className="inline-flex items-center gap-1">
                <Clock size={13} /> Antritt {fmtRelative(job.deadline)}
              </span>
            )}
            <span>{job.nr}</span>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button icon={<CalendarCheck size={16} />} onClick={() => setActivityOpen(true)}>
            Aktivität
          </Button>
          <Button icon={<Mail size={16} />} onClick={() => setEmailOpen(true)}>
            E-Mail
          </Button>
          <Button variant="primary" icon={<Handshake size={16} />} onClick={() => setProposeOpen(true)}>
            Kandidat vorschlagen
          </Button>
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
          { value: 'pipeline', label: 'Pipeline', count: own.length },
          { value: 'matching', label: 'Matching', icon: <Sparkles size={13} /> },
          { value: 'inserat', label: 'Inserat' },
          { value: 'aktivitaeten', label: 'Aktivitäten', count: actCount },
          { value: 'verlauf', label: 'Verlauf' },
        ]}
      />

      {tab === 'uebersicht' && (
        <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
          <div className="space-y-5">
            <Card>
              <CardHeader title="Stellenbeschreibung" />
              <CardBody>{job.beschreibung ? <p className="whitespace-pre-line text-[13.5px] leading-relaxed">{job.beschreibung}</p> : <span className="text-sm text-subtle">Keine Beschreibung.</span>}</CardBody>
            </Card>
            <Card>
              <CardHeader title="Anforderungen" />
              <CardBody className="flex flex-wrap gap-1.5">{job.skills.length ? job.skills.map((s) => <Tag key={s}>{s}</Tag>) : <span className="text-sm text-subtle">Keine Anforderungen erfasst.</span>}</CardBody>
            </Card>
          </div>
          <Card>
            <CardHeader title="Eckdaten" />
            <CardBody>
              <InfoList
                items={[
                  ['Unternehmen', company?.name ?? ''],
                  ['Kontakt', contact ? <span>{fullName(contact)}{contact.funktion && <span className="text-muted"> · {contact.funktion}</span>}{contact.email && <a className="block text-brand hover:underline" href={`mailto:${contact.email}`}>{contact.email}</a>}</span> : ''],
                  [job.art === 'Temporär' ? 'Tarif' : 'Lohn', lohnText(job)],
                  ['Stellen', String(job.anzahl)],
                  ['Antritt', fmtDate(job.deadline)],
                  ['Betreuer/in', l.user.get(job.betreuerId)?.name ?? ''],
                  ['Erfasst', fmtDate(job.createdAt)],
                ]}
              />
            </CardBody>
          </Card>
        </div>
      )}

      {tab === 'pipeline' && <PipelineTab job={job} placements={own} onPropose={() => setProposeOpen(true)} />}
      {tab === 'matching' && <MatchingTab job={job} />}
      {tab === 'inserat' && (
        <InseratTab
          job={job}
          onSave={(inserat) => {
            updateJob(job.id, { inserat });
            toast.success('Inserat gespeichert');
          }}
        />
      )}
      {tab === 'aktivitaeten' && (
        <Card>
          <CardHeader title="Aktivitäten" actions={<Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => setActivityOpen(true)}>Neue Aktivität</Button>} />
          <CardBody className="py-1">
            <ActivityTimeline bezug={{ typ: 'job', id: job.id }} />
          </CardBody>
        </Card>
      )}
      {tab === 'verlauf' && (
        <Card>
          <CardHeader title="Änderungsverlauf" />
          <CardBody>
            <AuditList entity="job" entityId={job.id} extraIds={own.map((p) => p.id)} />
          </CardBody>
        </Card>
      )}

      <JobForm open={editOpen} onClose={() => setEditOpen(false)} job={job} />
      <ActivityDialog open={activityOpen} onClose={() => setActivityOpen(false)} bezug={{ typ: 'job', id: job.id }} />
      <PlacementDialog open={proposeOpen} onClose={() => setProposeOpen(false)} jobId={job.id} />
      <EmailComposer open={emailOpen} onClose={() => setEmailOpen(false)} job={job} company={company} contact={contact} defaultKind="nachfassen" />
    </>
  );
}

/* ---------- Pipeline dieser Vakanz ---------- */
function PipelineTab({ job, placements, onPropose }: { job: Job; placements: Placement[]; onPropose: () => void }) {
  const navigate = useNavigate();
  const l = useLookups();
  const movePlacement = useData((s) => s.movePlacement);
  const deletePlacement = useData((s) => s.deletePlacement);
  const createHonorarInvoice = useData((s) => s.createHonorarInvoice);
  const invoices = useData((s) => s.invoices);
  const snapshot = useData((s) => s.snapshot);
  const [edit, setEdit] = useState<Placement | null>(null);
  const invoiced = (pid: string) => invoices.some((i) => i.status !== 'Storniert' && i.positionen.some((p) => p.ref?.id === pid));

  return (
    <Card>
      <CardHeader title="Kandidaten im Prozess" actions={<Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={onPropose}>Vorschlagen</Button>} />
      <DataTable
        rows={placements}
        rowKey={(p) => p.id}
        defaultSort={{ key: 'seit', dir: 'desc' }}
        columns={[
          {
            key: 'k',
            header: 'Kandidat',
            sortValue: (p) => fullName(l.candidate.get(p.candidateId)),
            cell: (p) => {
              const c = l.candidate.get(p.candidateId);
              return (
                <Link to={`/kandidaten/${p.candidateId}`} className="flex items-center gap-2.5 hover:text-brand">
                  <Avatar name={fullName(c)} size={32} />
                  <CellStack main={fullName(c)} sub={c?.beruf} />
                </Link>
              );
            },
          },
          {
            key: 'phase',
            header: 'Phase',
            cell: (p) => (
              <Select
                className="h-8 w-[150px] text-[13px]"
                value={p.phase}
                onChange={(e) => {
                  movePlacement(p.id, e.target.value as Phase);
                  toast.success(`Phase: ${e.target.value}`);
                }}
              >
                {PHASES.map((ph) => (
                  <option key={ph}>{ph}</option>
                ))}
              </Select>
            ),
          },
          { key: 'seit', header: 'Seit', sortValue: (p) => p.updatedAt, cell: (p) => fmtRelative(p.updatedAt) },
          { key: 'h', header: 'Honorar', align: 'right', cell: (p) => fmtCHF(p.honorar) },
          {
            key: 'next',
            header: 'Nächster Schritt',
            cell: (p) => {
              if (p.phase !== 'Vermittelt') return <span className="text-subtle">–</span>;
              if (job.art === 'Temporär')
                return (
                  <ButtonLink size="sm" variant="soft" icon={<CalendarClock size={13} />} to={`/einsaetze?neu=1&placement=${p.id}`}>
                    Einsatz erstellen
                  </ButtonLink>
                );
              if (invoiced(p.id)) return <Badge tone="green">Verrechnet</Badge>;
              return (
                <Button
                  size="sm"
                  variant="soft"
                  icon={<Receipt size={13} />}
                  onClick={() => {
                    const res = createHonorarInvoice(p.id);
                    if (!res.ok) return toast.error(res.error);
                    toast.success(`Rechnung ${res.value.nr} erstellt`);
                    navigate(`/rechnungen/${res.value.id}`);
                  }}
                >
                  Honorar verrechnen
                </Button>
              );
            },
          },
          {
            key: 'a',
            header: '',
            align: 'right',
            cell: (p) => (
              <span className="inline-flex">
                <IconButton size="sm" label="Bearbeiten" onClick={() => setEdit(p)}>
                  <Pencil size={14} />
                </IconButton>
                <IconButton
                  size="sm"
                  tone="danger"
                  label="Entfernen"
                  onClick={async () => {
                    if (!(await confirmDialog({ title: 'Aus Pipeline entfernen', message: `${fullName(l.candidate.get(p.candidateId))} aus dem Prozess entfernen?`, confirmLabel: 'Entfernen' }))) return;
                    const restore = snapshot();
                    deletePlacement(p.id);
                    toast.undo('Entfernt', restore);
                  }}
                >
                  <Trash2 size={14} />
                </IconButton>
              </span>
            ),
          },
        ]}
        empty={<EmptyState icon={<UserRound size={22} />} title="Noch niemand vorgeschlagen" text="Im Tab «Matching» finden Sie passende Kandidaten." />}
      />
      <PlacementDialog open={!!edit} onClose={() => setEdit(null)} placement={edit} />
    </Card>
  );
}

/* ---------- Matching ---------- */
function MatchingTab({ job }: { job: Job }) {
  const candidates = useData((s) => s.candidates);
  const placements = useData((s) => s.placements);
  const addPlacement = useData((s) => s.addPlacement);
  const l = useLookups();
  const [ai, setAi] = useState<{ results: AiMatch[]; source: 'ki' | 'lokal' } | null>(null);
  const [busy, setBusy] = useState(false);
  const local = useMemo(() => rankCandidates(job, candidates, placements, 15), [job, candidates, placements]);
  const inProcess = useMemo(() => new Set(placements.filter((p) => p.jobId === job.id && p.phase !== 'Absage').map((p) => p.candidateId)), [placements, job.id]);

  const runAi = async () => {
    setBusy(true);
    const pool = local.map((m) => l.candidate.get(m.candidateId)!).filter(Boolean);
    const res = await aiRankCandidates(job, pool);
    if (res.warning) toast.info(res.warning);
    setAi(res);
    setBusy(false);
  };

  const propose = (candidateId: string) => {
    const res = addPlacement({ candidateId, jobId: job.id, notiz: 'Über Matching vorgeschlagen.' });
    if (!res.ok) return toast.error(res.error);
    toast.success(`${fullName(l.candidate.get(candidateId))} vorgeschlagen`);
  };

  const rows = ai
    ? ai.results.map((r) => ({ candidateId: r.candidateId, score: r.score, text: r.begruendung, plus: r.staerken, minus: r.luecken }))
    : local.map((m) => ({ candidateId: m.candidateId, score: m.score, text: m.reasons.join(' · '), plus: m.matched, minus: m.missing }));

  return (
    <Card>
      <CardHeader
        title="Passende Kandidaten"
        subtitle={ai ? 'Bewertung mit Begründung' : 'Automatisches Matching nach Skills, Beruf, Region, Verfügbarkeit und Lohn'}
        actions={
          <>
            {ai && <SourceBadge source={ai.source} />}
            <Button size="sm" variant="soft" icon={<Sparkles size={14} />} loading={busy} onClick={runAi} disabled={!local.length}>
              {ai ? 'Neu bewerten' : 'KI-Bewertung'}
            </Button>
          </>
        }
      />
      {!job.skills.length && (
        <Callout tone="warn" className="m-4 mb-0">
          Für ein genaueres Matching bitte Anforderungen/Skills bei der Vakanz erfassen.
        </Callout>
      )}
      {rows.length ? (
        <ul className="divide-y divide-line">
          {rows.map((r) => {
            const c = l.candidate.get(r.candidateId);
            if (!c) return null;
            return (
              <li key={r.candidateId} className="flex flex-wrap items-center gap-4 px-5 py-3.5">
                <Link to={`/kandidaten/${c.id}`} className="flex min-w-[220px] items-center gap-2.5 hover:text-brand">
                  <Avatar name={fullName(c)} size={36} />
                  <CellStack main={fullName(c)} sub={`${c.beruf} · ${c.ort}${c.verfuegbarAb ? ` · verfügbar ${fmtRelative(c.verfuegbarAb).toLowerCase()}` : ''}`} />
                </Link>
                <div className="min-w-[220px] flex-1">
                  <div className="mb-1 flex flex-wrap gap-1">
                    {r.plus.map((s) => (
                      <Tag key={`p${s}`} active>
                        {s}
                      </Tag>
                    ))}
                    {r.minus.map((s) => (
                      <Tag key={`m${s}`} className="line-through opacity-70">
                        {s}
                      </Tag>
                    ))}
                  </div>
                  {r.text && <div className="text-xs text-muted">{r.text}</div>}
                </div>
                <ScoreBar value={r.score} className="w-40" />
                {inProcess.has(c.id) ? (
                  <Badge tone="blue">Im Prozess</Badge>
                ) : (
                  <Button size="sm" variant="primary" icon={<Handshake size={13} />} onClick={() => propose(c.id)}>
                    Vorschlagen
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={<UserRound size={22} />} title="Keine passenden Kandidaten" text="Alle aktiven Kandidaten sind bereits im Prozess oder es fehlen Kandidaten mit passendem Profil." />
      )}
    </Card>
  );
}

/* ---------- Stelleninserat ---------- */
function InseratTab({ job, onSave }: { job: Job; onSave: (text: string) => void }) {
  const settings = useData((s) => s.settings);
  const l = useLookups();
  const [text, setText] = useState(job.inserat);
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<'ki' | 'vorlage' | null>(null);
  const company = l.company.get(job.companyId);

  const generate = async () => {
    setBusy(true);
    const res = await generateText(
      { kind: 'inserat', job, company, agentur: `${settings.firmenname}, ${settings.ort} · ${settings.email}` },
      () => ({ betreff: job.titel, text: inseratTemplate(job, company, settings) }),
    );
    setText(res.text);
    setSource(res.source);
    if (res.warning) toast.info(res.warning);
    setBusy(false);
  };

  return (
    <Card>
      <CardHeader title="Stelleninserat" subtitle="Für jobs.ch, LinkedIn oder die eigene Website" actions={source ? <SourceBadge source={source} /> : undefined} />
      <CardBody className="space-y-3">
        <div className="flex justify-end">
          <Button variant="soft" icon={<Sparkles size={15} />} loading={busy} onClick={generate}>
            {text ? 'Neu erstellen' : 'Inserat erstellen'}
          </Button>
        </div>
        <Textarea rows={18} value={text} onChange={(e) => setText(e.target.value)} placeholder="Noch kein Inserat – klicken Sie auf «Inserat erstellen»." />
        <div className="flex justify-end gap-2">
          <Button icon={<Copy size={15} />} disabled={!text} onClick={async () => toast[(await copyToClipboard(text)) ? 'success' : 'error']('In die Zwischenablage kopiert')}>
            Kopieren
          </Button>
          <Button variant="primary" disabled={text === job.inserat} onClick={() => onSave(text)}>
            Speichern
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
