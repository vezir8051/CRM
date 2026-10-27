import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, CalendarCheck, CalendarClock, Copy, Eye, FileText, Handshake, Mail, MapPin, Pencil, Phone, Plus, Printer, Sparkles, Trash2, User,
} from 'lucide-react';
import type { Candidate, DocumentType } from '@/types';
import { DOCUMENT_TYPES } from '@/types';
import { PERMIT_LABELS } from '@/domain/constants';
import { age, fmtCHF, fmtDate, fmtRelative, fullName, todayISO } from '@/domain/format';
import { rankJobs } from '@/domain/matching';
import { kurzprofilTemplate } from '@/domain/templates';
import { generateText } from '@/lib/ai';
import { copyToClipboard } from '@/lib/download';
import { extractText, formatBytes, MAX_STORED_TEXT } from '@/lib/files';
import { useTabParam } from '@/lib/hooks';
import { useData } from '@/store/data';
import { useLookups } from '@/store/selectors';
import { confirmDialog, toast } from '@/store/ui';
import {
  Avatar, Button, ButtonLink, Card, CardBody, CardHeader, CellStack, Checkbox, DataTable, EmptyState, Field, IconButton, InfoList, Modal, ScoreBar, Select, StatusBadge, Tabs, Tag, Textarea,
} from '@/components/ui';
import { ActivityTimeline } from '@/components/shared/ActivityTimeline';
import { ActivityDialog } from '@/components/shared/ActivityDialog';
import { PlacementDialog } from '@/components/shared/PlacementDialog';
import { AuditList } from '@/components/shared/AuditList';
import { EmailComposer } from '@/components/shared/EmailComposer';
import { FileDropzone } from '@/components/shared/FileDropzone';
import { SourceBadge } from '@/components/shared/AiStatus';
import { CandidateForm } from './CandidateForm';

const TABS = ['profil', 'prozesse', 'einsaetze', 'aktivitaeten', 'dokumente', 'kurzprofil', 'verlauf'] as const;
type Tab = (typeof TABS)[number];

export default function CandidateDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const c = useData((s) => s.candidates.find((x) => x.id === id));
  const placements = useData((s) => s.placements);
  const assignments = useData((s) => s.assignments);
  const activities = useData((s) => s.activities);
  const jobs = useData((s) => s.jobs);
  const deleteCandidate = useData((s) => s.deleteCandidate);
  const snapshot = useData((s) => s.snapshot);
  const l = useLookups();
  const [tab, setTab] = useTabParam<Tab>('profil', TABS);

  const [editOpen, setEditOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [proposeJob, setProposeJob] = useState<string | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);

  const own = useMemo(() => placements.filter((p) => p.candidateId === id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [placements, id]);
  const ownAssignments = useMemo(() => assignments.filter((a) => a.candidateId === id), [assignments, id]);
  const actCount = useMemo(() => activities.filter((a) => a.bezug?.typ === 'candidate' && a.bezug.id === id).length, [activities, id]);
  const suggestions = useMemo(() => (c ? rankJobs(c, jobs, 4).filter((m) => !own.some((p) => p.jobId === m.jobId && p.phase !== 'Absage')) : []), [c, jobs, own]);

  if (!c) {
    return (
      <EmptyState icon={<User size={22} />} title="Kandidat nicht gefunden" text="Der Kandidat existiert nicht oder wurde gelöscht." action={<ButtonLink to="/kandidaten">Zur Liste</ButtonLink>} />
    );
  }

  const remove = async () => {
    if (!(await confirmDialog({ title: 'Kandidat löschen', message: `${fullName(c)} inkl. Vermittlungen, Einsätzen und Aktivitäten löschen?`, confirmLabel: 'Löschen', tone: 'danger' }))) return;
    const restore = snapshot();
    const res = deleteCandidate(c.id);
    if (!res.ok) return toast.error(res.error);
    toast.undo(`${fullName(c)} gelöscht`, restore);
    navigate('/kandidaten');
  };

  return (
    <>
      <Link to="/kandidaten" className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-brand">
        <ArrowLeft size={15} /> Kandidaten
      </Link>

      <div className="mb-5 flex flex-wrap items-center gap-4">
        <Avatar name={fullName(c)} size={56} />
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2.5 text-xl font-bold">
            {fullName(c)} <StatusBadge value={c.status} />
            {c.tags.map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </h1>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13.5px] text-muted">
            <span>{c.beruf || 'Beruf unbekannt'}</span>
            {c.ort && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={13} /> {c.plz} {c.ort}
              </span>
            )}
            <span>{c.nr}</span>
            {c.telefon && (
              <a href={`tel:${c.telefon}`} className="inline-flex items-center gap-1 hover:text-brand">
                <Phone size={13} /> {c.telefon}
              </a>
            )}
          </div>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button icon={<CalendarCheck size={16} />} onClick={() => setActivityOpen(true)}>
            Aktivität
          </Button>
          <Button icon={<Mail size={16} />} onClick={() => setEmailOpen(true)}>
            E-Mail
          </Button>
          <Button variant="primary" icon={<Handshake size={16} />} onClick={() => setProposeJob('')}>
            Vorschlagen
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
          { value: 'profil', label: 'Profil' },
          { value: 'prozesse', label: 'Prozesse', count: own.length },
          { value: 'einsaetze', label: 'Einsätze', count: ownAssignments.length },
          { value: 'aktivitaeten', label: 'Aktivitäten', count: actCount },
          { value: 'dokumente', label: 'Dokumente', count: c.dokumente.length },
          { value: 'kurzprofil', label: 'Kurzprofil', icon: <Sparkles size={13} /> },
          { value: 'verlauf', label: 'Verlauf' },
        ]}
      />

      {tab === 'profil' && (
        <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
          <div className="space-y-5">
            <Card>
              <CardHeader title="Kontakt & Person" />
              <CardBody>
                <InfoList
                  items={[
                    ['E-Mail', c.email ? <a className="text-brand hover:underline" href={`mailto:${c.email}`}>{c.email}</a> : ''],
                    ['Telefon', c.telefon ? <a className="text-brand hover:underline" href={`tel:${c.telefon}`}>{c.telefon}</a> : ''],
                    ['Adresse', [c.strasse, `${c.plz} ${c.ort}`.trim()].filter(Boolean).join(', ')],
                    ['Geburtsdatum', c.geburtsdatum ? `${fmtDate(c.geburtsdatum)} (${age(c.geburtsdatum)} Jahre)` : ''],
                    ['Nationalität', c.nationalitaet],
                    ['Bewilligung', c.bewilligung ? PERMIT_LABELS[c.bewilligung] : ''],
                    ['Quelle', c.quelle],
                    ['Betreuer/in', l.user.get(c.betreuerId)?.name ?? ''],
                    ['Erfasst am', fmtDate(c.createdAt)],
                  ]}
                />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Beruf & Verfügbarkeit" />
              <CardBody>
                <InfoList
                  items={[
                    ['Beruf', c.beruf],
                    ['Ausbildung', c.ausbildung],
                    ['Erfahrung', c.erfahrungJahre !== null ? `${c.erfahrungJahre} Jahre` : ''],
                    ['Verfügbar ab', c.verfuegbarAb ? `${fmtDate(c.verfuegbarAb)} (${fmtRelative(c.verfuegbarAb)})` : ''],
                    ['Pensum', c.pensum],
                    ['Anstellung', c.anstellungsarten.length ? <span className="flex flex-wrap gap-1">{c.anstellungsarten.map((a) => <StatusBadge key={a} value={a} />)}</span> : ''],
                    ['Lohnvorstellung', c.lohnvorstellung ? `${fmtCHF(c.lohnvorstellung)} / Jahr` : ''],
                    ['Stundenlohn', c.stundenlohn ? `${fmtCHF(c.stundenlohn, { decimals: true })} / h` : ''],
                  ]}
                />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Notizen" />
              <CardBody>{c.notizen ? <p className="whitespace-pre-line text-[13.5px]">{c.notizen}</p> : <span className="text-sm text-subtle">Keine Notizen.</span>}</CardBody>
            </Card>
          </div>
          <div className="space-y-5">
            <Card>
              <CardHeader title="Skills" />
              <CardBody className="flex flex-wrap gap-1.5">{c.skills.length ? c.skills.map((s) => <Tag key={s}>{s}</Tag>) : <span className="text-sm text-subtle">Keine Skills erfasst.</span>}</CardBody>
            </Card>
            <Card>
              <CardHeader title="Sprachen" />
              <CardBody className="space-y-1.5 text-[13.5px]">
                {c.sprachen.length ? (
                  c.sprachen.map((s) => (
                    <div key={s.sprache} className="flex justify-between">
                      <span>{s.sprache}</span>
                      <span className="text-muted">{s.niveau || '–'}</span>
                    </div>
                  ))
                ) : (
                  <span className="text-subtle">Keine Sprachen erfasst.</span>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Passende Vakanzen" subtitle="Automatisches Matching" icon={<Sparkles size={15} />} />
              <CardBody className="space-y-3">
                {suggestions.length ? (
                  suggestions.map((m) => {
                    const j = l.job.get(m.jobId)!;
                    return (
                      <div key={m.jobId} className="rounded-lg border border-line p-3">
                        <Link to={`/vakanzen/${j.id}`} className="text-[13.5px] font-semibold hover:text-brand">
                          {j.titel}
                        </Link>
                        <div className="text-xs text-muted">{l.company.get(j.companyId)?.name}</div>
                        <ScoreBar value={m.score} className="mt-2" label={m.reasons.join(' · ')} />
                        <Button size="sm" variant="soft" className="mt-2" icon={<Handshake size={13} />} onClick={() => setProposeJob(j.id)}>
                          Vorschlagen
                        </Button>
                      </div>
                    );
                  })
                ) : (
                  <span className="text-sm text-subtle">Keine passenden offenen Vakanzen.</span>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {tab === 'prozesse' && (
        <Card>
          <CardHeader title="Vermittlungsprozesse" actions={<Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => setProposeJob('')}>Vorschlagen</Button>} />
          <DataTable
            rows={own}
            rowKey={(p) => p.id}
            onRowClick={(p) => navigate(`/vakanzen/${p.jobId}`)}
            columns={[
              { key: 'job', header: 'Vakanz', cell: (p) => <CellStack main={l.job.get(p.jobId)?.titel ?? '–'} sub={l.company.get(l.job.get(p.jobId)?.companyId ?? '')?.name} /> },
              { key: 'phase', header: 'Phase', cell: (p) => <StatusBadge value={p.phase} /> },
              { key: 'seit', header: 'Letzte Änderung', cell: (p) => fmtRelative(p.updatedAt) },
              { key: 'honorar', header: 'Honorar', align: 'right', cell: (p) => fmtCHF(p.honorar) },
            ]}
            empty={<EmptyState icon={<Handshake size={22} />} title="Noch keine Prozesse" text="Schlagen Sie den Kandidaten für eine passende Vakanz vor." />}
          />
        </Card>
      )}

      {tab === 'einsaetze' && (
        <Card>
          <CardHeader title="Temporär-Einsätze" actions={<ButtonLink size="sm" variant="primary" icon={<Plus size={14} />} to={`/einsaetze?neu=1&kandidat=${c.id}`}>Einsatz erstellen</ButtonLink>} />
          <DataTable
            rows={ownAssignments}
            rowKey={(a) => a.id}
            onRowClick={(a) => navigate(`/einsaetze/${a.id}`)}
            columns={[
              { key: 'nr', header: 'Nr', cell: (a) => a.nr },
              { key: 'f', header: 'Funktion', cell: (a) => <CellStack main={a.funktion} sub={l.company.get(a.companyId)?.name} /> },
              { key: 'z', header: 'Zeitraum', cell: (a) => `${fmtDate(a.start)} – ${a.ende ? fmtDate(a.ende) : 'offen'}` },
              { key: 's', header: 'Status', cell: (a) => <StatusBadge value={a.status} /> },
            ]}
            empty={<EmptyState icon={<CalendarClock size={22} />} title="Keine Einsätze" text="Für temporäre Einsätze einen Einsatz mit Lohn und Tarif anlegen." />}
          />
        </Card>
      )}

      {tab === 'aktivitaeten' && (
        <Card>
          <CardHeader title="Aktivitäten" actions={<Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => setActivityOpen(true)}>Neue Aktivität</Button>} />
          <CardBody className="py-1">
            <ActivityTimeline bezug={{ typ: 'candidate', id: c.id }} />
          </CardBody>
        </Card>
      )}

      {tab === 'dokumente' && <DocumentsTab candidate={c} />}
      {tab === 'kurzprofil' && <ProfileTab candidate={c} />}
      {tab === 'verlauf' && (
        <Card>
          <CardHeader title="Änderungsverlauf" />
          <CardBody>
            <AuditList entity="candidate" entityId={c.id} />
          </CardBody>
        </Card>
      )}

      <CandidateForm open={editOpen} onClose={() => setEditOpen(false)} candidate={c} />
      <ActivityDialog open={activityOpen} onClose={() => setActivityOpen(false)} bezug={{ typ: 'candidate', id: c.id }} />
      <PlacementDialog open={proposeJob !== null} onClose={() => setProposeJob(null)} candidateId={c.id} jobId={proposeJob || undefined} />
      <EmailComposer open={emailOpen} onClose={() => setEmailOpen(false)} candidate={c} defaultKind="einladung" />
    </>
  );
}

/* ---------- Dokumente ---------- */
function DocumentsTab({ candidate: c }: { candidate: Candidate }) {
  const addDocument = useData((s) => s.addDocument);
  const removeDocument = useData((s) => s.removeDocument);
  const [file, setFile] = useState<File | null>(null);
  const [typ, setTyp] = useState<DocumentType>('Lebenslauf');
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<{ name: string; text: string } | null>(null);

  const add = async () => {
    if (!file) return;
    setBusy(true);
    let text = '';
    try {
      text = (await extractText(file)).slice(0, MAX_STORED_TEXT);
    } catch {
      /* Text ist optional (nur für die Suche) */
    }
    addDocument(c.id, { name: file.name, typ, datum: todayISO(), groesse: file.size, text });
    toast.success('Dokument hinzugefügt');
    setFile(null);
    setBusy(false);
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
      <Card>
        <CardHeader title="Dokumente" subtitle="Inhalte sind über die Suche auffindbar" />
        <DataTable
          rows={c.dokumente}
          rowKey={(d) => d.id}
          columns={[
            { key: 'n', header: 'Name', cell: (d) => <span className="inline-flex items-center gap-2 font-semibold"><FileText size={15} className="text-muted" />{d.name}</span> },
            { key: 't', header: 'Typ', cell: (d) => d.typ },
            { key: 'd', header: 'Datum', cell: (d) => fmtDate(d.datum) },
            { key: 'g', header: 'Grösse', cell: (d) => (d.groesse ? formatBytes(d.groesse) : '–'), hideOnMobile: true },
            {
              key: 'a', header: '', align: 'right',
              cell: (d) => (
                <span className="inline-flex">
                  <IconButton size="sm" label="Text anzeigen" disabled={!d.text} onClick={() => setView({ name: d.name, text: d.text ?? '' })}>
                    <Eye size={14} />
                  </IconButton>
                  <IconButton
                    size="sm"
                    tone="danger"
                    label="Entfernen"
                    onClick={async () => {
                      if (await confirmDialog({ title: 'Dokument entfernen', message: `«${d.name}» entfernen?`, confirmLabel: 'Entfernen' })) removeDocument(c.id, d.id);
                    }}
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </span>
              ),
            },
          ]}
          empty={<EmptyState icon={<FileText size={22} />} title="Keine Dokumente" text="Lebenslauf, Zeugnisse oder Bewilligung hinzufügen." />}
        />
      </Card>
      <Card>
        <CardHeader title="Dokument hinzufügen" />
        <CardBody className="space-y-3">
          <FileDropzone accept=".pdf,.docx,.txt,.md,image/*" file={file} onFile={setFile} title="Datei wählen" hint="Der Text wird lokal für die Suche gespeichert; die Datei selbst nicht." />
          <Field label="Typ">
            <Select value={typ} onChange={(e) => setTyp(e.target.value as DocumentType)}>
              {DOCUMENT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Button variant="primary" className="w-full" disabled={!file} loading={busy} onClick={add}>
            Hinzufügen
          </Button>
        </CardBody>
      </Card>
      <Modal open={!!view} onClose={() => setView(null)} title={view?.name ?? ''} size="lg">
        <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed">{view?.text}</pre>
      </Modal>
    </div>
  );
}

/* ---------- Kurzprofil (KI/Vorlage) ---------- */
function ProfileTab({ candidate: c }: { candidate: Candidate }) {
  const updateCandidate = useData((s) => s.updateCandidate);
  const [anonym, setAnonym] = useState(true);
  const [text, setText] = useState(c.kurzprofil);
  const [source, setSource] = useState<'ki' | 'vorlage' | null>(null);
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    const res = await generateText({ kind: 'kurzprofil', candidate: c, anonym }, () => ({ betreff: '', text: kurzprofilTemplate(c, anonym) }));
    setText(res.text);
    setSource(res.source);
    if (res.warning) toast.info(res.warning);
    setBusy(false);
  };

  const print = () => {
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) return;
    w.document.write(`<html><head><title>Kurzprofil ${anonym ? c.nr : fullName(c)}</title><style>body{font-family:Inter,Arial,sans-serif;padding:40px;line-height:1.55;color:#0f172a;white-space:pre-wrap;font-size:13px}</style></head><body></body></html>`);
    w.document.body.textContent = text;
    w.document.close();
    w.print();
  };

  return (
    <Card>
      <CardHeader
        title="Kurzprofil für Kunden"
        subtitle="Anonymisiertes Profil zum Versand an Kunden – per KI oder Vorlage erstellt, frei bearbeitbar"
        actions={source ? <SourceBadge source={source} /> : undefined}
      />
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Checkbox label="Anonymisiert (ohne Name und Kontaktdaten)" checked={anonym} onChange={setAnonym} />
          <Button className="ml-auto" variant="soft" icon={<Sparkles size={15} />} loading={busy} onClick={generate}>
            {text ? 'Neu erstellen' : 'Kurzprofil erstellen'}
          </Button>
        </div>
        <Textarea rows={16} value={text} onChange={(e) => setText(e.target.value)} placeholder="Noch kein Kurzprofil – klicken Sie auf «Kurzprofil erstellen»." />
        <div className="flex flex-wrap justify-end gap-2">
          <Button icon={<Copy size={15} />} disabled={!text} onClick={async () => toast[(await copyToClipboard(text)) ? 'success' : 'error']('In die Zwischenablage kopiert')}>
            Kopieren
          </Button>
          <Button icon={<Printer size={15} />} disabled={!text} onClick={print}>
            Drucken / PDF
          </Button>
          <Button
            variant="primary"
            disabled={text === c.kurzprofil}
            onClick={() => {
              updateCandidate(c.id, { kurzprofil: text });
              toast.success('Kurzprofil gespeichert');
            }}
          >
            Speichern
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
