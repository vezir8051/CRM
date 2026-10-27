/* ============================================================
   Zentraler Datenspeicher (Zustand + localStorage)
   Alle Schreibzugriffe laufen über die Aktionen dieses Stores.
   Sie pflegen Folgestatus (z.B. Kandidat «Im Einsatz»), schreiben
   das Audit-Log und erzeugen automatische Nachfass-Aufgaben.

   Verwendung in Komponenten:
     const candidates = useData((s) => s.candidates);   // Rohdaten
     const addCandidate = useData((s) => s.addCandidate); // Aktion
   Abgeleitete Listen immer mit useMemo bilden (nicht im Selektor).
   ============================================================ */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  Activity, Assignment, AuditEntity, Candidate, Company, Contact, CrmData, DocumentRef, ID, Invoice, InvoiceStatus,
  Job, Phase, Placement, Settings, Timesheet, TimesheetStatus, User,
} from '@/types';
import { ACTIVE_PHASES } from '@/types';
import { createSeed } from '@/data/seed';
import { addDays, nowISO, todayISO } from '@/domain/format';
import { uid } from '@/domain/ids';
import { buildHonorarInvoice, buildVerleihInvoice } from '@/domain/billing';
import { actorId } from './auth';
import type {
  ActivityInput, AssignmentInput, CandidateInput, CompanyInput, ContactInput, JobInput,
} from './factories';

export const STORAGE_KEY = 'persocrm-v2';
const AUDIT_LIMIT = 1500;

export type Result<T = undefined> = { ok: true; value: T } | { ok: false; error: string };
const ok = <T,>(value: T): Result<T> => ({ ok: true, value });
const fail = <T = never,>(error: string): Result<T> => ({ ok: false, error });

export interface DataActions {
  /* Kandidaten */
  addCandidate: (input: CandidateInput) => Candidate;
  updateCandidate: (id: ID, patch: Partial<Candidate>) => void;
  deleteCandidate: (id: ID) => Result;
  addDocument: (candidateId: ID, doc: Omit<DocumentRef, 'id'>) => void;
  removeDocument: (candidateId: ID, docId: ID) => void;
  /* Unternehmen */
  addCompany: (input: CompanyInput) => Company;
  updateCompany: (id: ID, patch: Partial<Company>) => void;
  deleteCompany: (id: ID) => Result;
  upsertContact: (companyId: ID, contact: ContactInput) => Contact | null;
  removeContact: (companyId: ID, contactId: ID) => void;
  /* Vakanzen */
  addJob: (input: JobInput) => Job;
  updateJob: (id: ID, patch: Partial<Job>) => void;
  deleteJob: (id: ID) => Result;
  /* Vermittlungen / Pipeline */
  addPlacement: (input: { candidateId: ID; jobId: ID; phase?: Phase; honorar?: number | null; startdatum?: string; notiz?: string }) => Result<Placement>;
  updatePlacement: (id: ID, patch: Partial<Pick<Placement, 'honorar' | 'startdatum' | 'notiz'>>) => void;
  movePlacement: (id: ID, phase: Phase, notiz?: string) => void;
  deletePlacement: (id: ID) => void;
  /* Einsätze */
  addAssignment: (input: AssignmentInput) => Assignment;
  updateAssignment: (id: ID, patch: Partial<Assignment>) => void;
  deleteAssignment: (id: ID) => Result;
  /* Rapporte */
  saveTimesheet: (assignmentId: ID, woche: string, patch: Partial<Pick<Timesheet, 'stunden' | 'spesen' | 'notiz'>>) => Result<Timesheet>;
  setTimesheetStatus: (id: ID, status: Exclude<TimesheetStatus, 'Verrechnet'>) => Result;
  /* Rechnungen */
  createVerleihInvoice: (companyId: ID, timesheetIds: ID[]) => Result<Invoice>;
  createHonorarInvoice: (placementId: ID) => Result<Invoice>;
  setInvoiceStatus: (id: ID, status: InvoiceStatus) => void;
  /* Aktivitäten */
  addActivity: (input: ActivityInput) => Activity;
  updateActivity: (id: ID, patch: Partial<Activity>) => void;
  toggleActivity: (id: ID) => void;
  deleteActivity: (id: ID) => void;
  /* Benutzer & Einstellungen */
  addUser: (input: Omit<User, 'id'>) => Result<User>;
  updateUser: (id: ID, patch: Partial<User>) => Result;
  deleteUser: (id: ID) => Result;
  updateSettings: (patch: Partial<Settings>) => void;
  /* Daten */
  exportData: () => CrmData;
  importData: (data: unknown) => Result;
  resetDemo: () => void;
  /** Momentaufnahme; Rückgabewert stellt den Zustand wieder her (Undo) */
  snapshot: () => () => void;
  log: (entity: AuditEntity, entityId: ID, text: string) => void;
}

export type DataStore = CrmData & DataActions;

const DATA_KEYS: (keyof CrmData)[] = [
  'users', 'candidates', 'companies', 'jobs', 'placements', 'assignments', 'timesheets', 'invoices', 'activities', 'audit', 'settings', 'counters',
];

function pickData(s: DataStore): CrmData {
  return Object.fromEntries(DATA_KEYS.map((k) => [k, s[k]])) as unknown as CrmData;
}

export const useData = create<DataStore>()(
  persist(
    (set, get) => {
      /* ---------- Hilfsfunktionen ---------- */
      const log = (entity: AuditEntity, entityId: ID, text: string) =>
        set((s) => ({ audit: [{ id: uid(), ts: nowISO(), userId: actorId(), entity, entityId, text }, ...s.audit].slice(0, AUDIT_LIMIT) }));

      const nextNr = (prefix: keyof CrmData['counters']): string => {
        const n = get().counters[prefix] + 1;
        set((s) => ({ counters: { ...s.counters, [prefix]: n } }));
        return `${prefix}-${n}`;
      };

      const patchIn = <T extends { id: ID }>(list: T[], id: ID, patch: Partial<T>, touch = true): T[] =>
        list.map((x) => (x.id === id ? { ...x, ...patch, ...(touch && 'updatedAt' in x ? { updatedAt: nowISO() } : {}) } : x));

      const candidateName = (id: ID) => {
        const c = get().candidates.find((x) => x.id === id);
        return c ? `${c.vorname} ${c.nachname}` : 'Unbekannt';
      };

      /** Automatische Nachfass-Aufgabe bei aktiven Pipeline-Phasen */
      const autoFollowUp = (p: Placement, phase: Phase) => {
        const { settings, activities, jobs, companies } = get();
        if (!settings.autoFollowup || !ACTIVE_PHASES.includes(phase)) return;
        const offen = activities.some((a) => a.auto && !a.erledigt && a.bezug?.typ === 'candidate' && a.bezug.id === p.candidateId);
        if (offen) return;
        const job = jobs.find((j) => j.id === p.jobId);
        const firma = companies.find((c) => c.id === job?.companyId);
        const activity: Activity = {
          id: uid(), typ: 'Aufgabe',
          betreff: `Nachfassen: ${candidateName(p.candidateId)}${firma ? ` bei ${firma.name}` : ''} (${phase})`,
          beschreibung: `Automatisch erstellt beim Phasenwechsel zu «${phase}»${job ? ` für «${job.titel}»` : ''}.`,
          faelligAm: `${addDays(todayISO(), settings.followupTage || 3)}T09:00`,
          erledigt: false, bezug: { typ: 'candidate', id: p.candidateId }, userId: actorId(), auto: true, createdAt: nowISO(),
        };
        set((s) => ({ activities: [activity, ...s.activities] }));
      };

      /** Kandidatenstatus aus Einsätzen ableiten */
      const syncCandidateEinsatz = (candidateId: ID) => {
        const { assignments, candidates } = get();
        const c = candidates.find((x) => x.id === candidateId);
        if (!c) return;
        const aktiv = assignments.some((a) => a.candidateId === candidateId && a.status === 'Aktiv');
        if (aktiv && c.status !== 'Im Einsatz') set((s) => ({ candidates: patchIn(s.candidates, candidateId, { status: 'Im Einsatz' }) }));
        if (!aktiv && c.status === 'Im Einsatz') set((s) => ({ candidates: patchIn(s.candidates, candidateId, { status: 'Aktiv' }) }));
      };

      /** Vakanzstatus aus Anzahl Vermittlungen ableiten */
      const syncJobStatus = (jobId: ID) => {
        const { jobs, placements } = get();
        const job = jobs.find((j) => j.id === jobId);
        if (!job || job.status === 'Storniert' || job.status === 'On Hold') return;
        const vermittelt = placements.filter((p) => p.jobId === jobId && p.phase === 'Vermittelt').length;
        const aktiv = placements.some((p) => p.jobId === jobId && ACTIVE_PHASES.includes(p.phase));
        const status = vermittelt >= Math.max(1, job.anzahl) ? 'Besetzt' : aktiv ? 'In Bearbeitung' : job.status === 'Besetzt' ? 'Offen' : job.status;
        if (status !== job.status) set((s) => ({ jobs: patchIn(s.jobs, jobId, { status }) }));
      };

      return {
        ...createSeed(),

        log,

        /* ---------- Kandidaten ---------- */
        addCandidate: (input) => {
          const c: Candidate = { ...input, id: uid(), nr: nextNr('K'), createdAt: nowISO(), updatedAt: nowISO() };
          set((s) => ({ candidates: [c, ...s.candidates] }));
          log('candidate', c.id, `Kandidat ${c.vorname} ${c.nachname} erfasst`);
          return c;
        },
        updateCandidate: (id, patch) => {
          set((s) => ({ candidates: patchIn(s.candidates, id, patch) }));
          log('candidate', id, 'Kandidat bearbeitet');
        },
        deleteCandidate: (id) => {
          const { assignments, timesheets } = get();
          const own = assignments.filter((a) => a.candidateId === id);
          if (timesheets.some((t) => own.some((a) => a.id === t.assignmentId) && t.status === 'Verrechnet'))
            return fail('Der Kandidat hat bereits verrechnete Einsätze und kann nicht gelöscht werden. Setzen Sie den Status auf «Inaktiv».');
          const name = candidateName(id);
          const ownIds = new Set(own.map((a) => a.id));
          set((s) => ({
            candidates: s.candidates.filter((c) => c.id !== id),
            placements: s.placements.filter((p) => p.candidateId !== id),
            assignments: s.assignments.filter((a) => a.candidateId !== id),
            timesheets: s.timesheets.filter((t) => !ownIds.has(t.assignmentId)),
            activities: s.activities.filter((a) => !(a.bezug?.typ === 'candidate' && a.bezug.id === id) && !(a.bezug?.typ === 'assignment' && ownIds.has(a.bezug.id))),
          }));
          log('candidate', id, `Kandidat ${name} gelöscht`);
          return ok(undefined);
        },
        addDocument: (candidateId, doc) => {
          set((s) => ({
            candidates: patchIn(s.candidates, candidateId, {
              dokumente: [...(s.candidates.find((c) => c.id === candidateId)?.dokumente ?? []), { ...doc, id: uid() }],
            }),
          }));
          log('candidate', candidateId, `Dokument «${doc.name}» hinzugefügt`);
        },
        removeDocument: (candidateId, docId) => {
          set((s) => ({
            candidates: patchIn(s.candidates, candidateId, {
              dokumente: (s.candidates.find((c) => c.id === candidateId)?.dokumente ?? []).filter((d) => d.id !== docId),
            }),
          }));
          log('candidate', candidateId, 'Dokument entfernt');
        },

        /* ---------- Unternehmen ---------- */
        addCompany: (input) => {
          const f: Company = {
            ...input, id: uid(), nr: nextNr('F'), createdAt: nowISO(), updatedAt: nowISO(),
            kontakte: input.kontakte.map((k) => ({ ...k, id: k.id || uid() })),
          };
          set((s) => ({ companies: [f, ...s.companies] }));
          log('company', f.id, `Unternehmen ${f.name} erfasst`);
          return f;
        },
        updateCompany: (id, patch) => {
          set((s) => ({ companies: patchIn(s.companies, id, patch) }));
          log('company', id, 'Unternehmen bearbeitet');
        },
        deleteCompany: (id) => {
          const { jobs, assignments, invoices, companies } = get();
          if (jobs.some((j) => j.companyId === id)) return fail('Bitte zuerst die Vakanzen dieses Unternehmens löschen.');
          if (assignments.some((a) => a.companyId === id)) return fail('Das Unternehmen hat Einsätze und kann nicht gelöscht werden.');
          if (invoices.some((i) => i.companyId === id)) return fail('Für das Unternehmen existieren Rechnungen – Status auf «Inaktiv» setzen.');
          const name = companies.find((c) => c.id === id)?.name ?? '';
          set((s) => ({
            companies: s.companies.filter((c) => c.id !== id),
            activities: s.activities.filter((a) => !(a.bezug?.typ === 'company' && a.bezug.id === id)),
          }));
          log('company', id, `Unternehmen ${name} gelöscht`);
          return ok(undefined);
        },
        upsertContact: (companyId, contact) => {
          const f = get().companies.find((c) => c.id === companyId);
          if (!f) return null;
          const saved: Contact = { ...contact, id: contact.id || uid() };
          const exists = f.kontakte.some((k) => k.id === saved.id);
          const kontakte = exists ? f.kontakte.map((k) => (k.id === saved.id ? saved : k)) : [...f.kontakte, saved];
          set((s) => ({ companies: patchIn(s.companies, companyId, { kontakte }) }));
          log('company', companyId, `Kontakt ${saved.vorname} ${saved.nachname} ${exists ? 'bearbeitet' : 'hinzugefügt'}`);
          return saved;
        },
        removeContact: (companyId, contactId) => {
          set((s) => ({
            companies: patchIn(s.companies, companyId, {
              kontakte: (s.companies.find((c) => c.id === companyId)?.kontakte ?? []).filter((k) => k.id !== contactId),
            }),
            jobs: s.jobs.map((j) => (j.companyId === companyId && j.kontaktId === contactId ? { ...j, kontaktId: '' } : j)),
          }));
          log('company', companyId, 'Kontakt entfernt');
        },

        /* ---------- Vakanzen ---------- */
        addJob: (input) => {
          const j: Job = { ...input, id: uid(), nr: nextNr('V'), createdAt: nowISO(), updatedAt: nowISO() };
          set((s) => ({ jobs: [j, ...s.jobs] }));
          log('job', j.id, `Vakanz «${j.titel}» erfasst`);
          return j;
        },
        updateJob: (id, patch) => {
          set((s) => ({ jobs: patchIn(s.jobs, id, patch) }));
          log('job', id, 'Vakanz bearbeitet');
        },
        deleteJob: (id) => {
          const titel = get().jobs.find((j) => j.id === id)?.titel ?? '';
          set((s) => ({
            jobs: s.jobs.filter((j) => j.id !== id),
            placements: s.placements.filter((p) => p.jobId !== id),
            assignments: s.assignments.map((a) => (a.jobId === id ? { ...a, jobId: '' } : a)),
            activities: s.activities.filter((a) => !(a.bezug?.typ === 'job' && a.bezug.id === id)),
          }));
          log('job', id, `Vakanz «${titel}» gelöscht`);
          return ok(undefined);
        },

        /* ---------- Pipeline ---------- */
        addPlacement: ({ candidateId, jobId, phase = 'Vorgeschlagen', honorar = null, startdatum = '', notiz = '' }) => {
          const { placements, jobs } = get();
          if (placements.some((p) => p.candidateId === candidateId && p.jobId === jobId && p.phase !== 'Absage'))
            return fail('Dieser Kandidat ist für diese Vakanz bereits im Prozess.');
          const job = jobs.find((j) => j.id === jobId);
          if (!job) return fail('Vakanz nicht gefunden.');
          const p: Placement = {
            id: uid(), candidateId, jobId, phase: 'Vorgeschlagen', honorar, startdatum, notiz,
            verlauf: [{ datum: nowISO(), phase: 'Vorgeschlagen', notiz: notiz || 'Kandidat vorgeschlagen.', userId: actorId() }],
            createdAt: nowISO(), updatedAt: nowISO(),
          };
          set((s) => ({ placements: [p, ...s.placements] }));
          log('placement', p.id, `${candidateName(candidateId)} für «${job.titel}» vorgeschlagen`);
          if (phase !== 'Vorgeschlagen') get().movePlacement(p.id, phase, 'Initiale Phase gesetzt.');
          else {
            autoFollowUp(p, 'Vorgeschlagen');
            syncJobStatus(jobId);
          }
          return ok(get().placements.find((x) => x.id === p.id)!);
        },
        updatePlacement: (id, patch) => {
          set((s) => ({ placements: patchIn<Placement>(s.placements, id, patch) }));
        },
        movePlacement: (id, phase, notiz = '') => {
          const p = get().placements.find((x) => x.id === id);
          if (!p || p.phase === phase) return;
          const verlauf = [...p.verlauf, { datum: nowISO(), phase, notiz, userId: actorId() }];
          set((s) => ({ placements: patchIn(s.placements, id, { phase, verlauf }) }));
          log('placement', id, `${candidateName(p.candidateId)}: Phase → ${phase}`);
          const job = get().jobs.find((j) => j.id === p.jobId);
          if (phase === 'Vermittelt' && job?.art !== 'Temporär') {
            set((s) => ({ candidates: patchIn(s.candidates, p.candidateId, { status: 'Vermittelt' }) }));
          }
          syncJobStatus(p.jobId);
          autoFollowUp({ ...p, phase }, phase);
        },
        deletePlacement: (id) => {
          const p = get().placements.find((x) => x.id === id);
          set((s) => ({ placements: s.placements.filter((x) => x.id !== id) }));
          if (p) {
            log('placement', id, `Vermittlung ${candidateName(p.candidateId)} gelöscht`);
            syncJobStatus(p.jobId);
          }
        },

        /* ---------- Einsätze ---------- */
        addAssignment: (input) => {
          const a: Assignment = { ...input, id: uid(), nr: nextNr('E'), createdAt: nowISO(), updatedAt: nowISO() };
          set((s) => ({ assignments: [a, ...s.assignments] }));
          log('assignment', a.id, `Einsatz ${a.nr} für ${candidateName(a.candidateId)} erstellt`);
          syncCandidateEinsatz(a.candidateId);
          return a;
        },
        updateAssignment: (id, patch) => {
          const before = get().assignments.find((a) => a.id === id);
          set((s) => ({ assignments: patchIn(s.assignments, id, patch) }));
          if (before && patch.status && patch.status !== before.status) log('assignment', id, `Einsatzstatus → ${patch.status}`);
          else log('assignment', id, 'Einsatz bearbeitet');
          if (before) syncCandidateEinsatz(before.candidateId);
        },
        deleteAssignment: (id) => {
          const { timesheets, assignments } = get();
          if (timesheets.some((t) => t.assignmentId === id && t.status === 'Verrechnet'))
            return fail('Der Einsatz hat bereits verrechnete Rapporte und kann nicht gelöscht werden. Setzen Sie ihn auf «Beendet».');
          const a = assignments.find((x) => x.id === id);
          set((s) => ({
            assignments: s.assignments.filter((x) => x.id !== id),
            timesheets: s.timesheets.filter((t) => t.assignmentId !== id),
            activities: s.activities.filter((x) => !(x.bezug?.typ === 'assignment' && x.bezug.id === id)),
          }));
          if (a) {
            log('assignment', id, `Einsatz ${a.nr} gelöscht`);
            syncCandidateEinsatz(a.candidateId);
          }
          return ok(undefined);
        },

        /* ---------- Rapporte ---------- */
        saveTimesheet: (assignmentId, woche, patch) => {
          const existing = get().timesheets.find((t) => t.assignmentId === assignmentId && t.woche === woche);
          if (existing && (existing.status === 'Freigegeben' || existing.status === 'Verrechnet'))
            return fail('Freigegebene oder verrechnete Rapporte können nicht mehr geändert werden.');
          const stunden = (patch.stunden ?? existing?.stunden ?? [0, 0, 0, 0, 0, 0, 0]).map((h) => Math.max(0, Math.min(24, Number(h) || 0)));
          const ts: Timesheet = {
            id: existing?.id ?? uid(), assignmentId, woche, stunden,
            spesen: Math.max(0, patch.spesen ?? existing?.spesen ?? 0),
            notiz: patch.notiz ?? existing?.notiz ?? '',
            status: existing?.status ?? 'Offen', invoiceId: existing?.invoiceId ?? '', updatedAt: nowISO(),
          };
          set((s) => ({ timesheets: existing ? s.timesheets.map((t) => (t.id === ts.id ? ts : t)) : [...s.timesheets, ts] }));
          return ok(ts);
        },
        setTimesheetStatus: (id, status) => {
          const ts = get().timesheets.find((t) => t.id === id);
          if (!ts) return fail('Rapport nicht gefunden.');
          if (ts.status === 'Verrechnet') return fail('Verrechnete Rapporte können nur über eine Stornierung der Rechnung geöffnet werden.');
          set((s) => ({ timesheets: patchIn(s.timesheets, id, { status }) }));
          log('timesheet', id, `Rapport ${ts.woche}: ${status}`);
          return ok(undefined);
        },

        /* ---------- Rechnungen ---------- */
        createVerleihInvoice: (companyId, timesheetIds) => {
          const { companies, timesheets, assignments, candidates, settings } = get();
          const company = companies.find((c) => c.id === companyId);
          if (!company) return fail('Unternehmen nicht gefunden.');
          const ids = new Set(timesheetIds);
          const ts = timesheets.filter((t) => ids.has(t.id));
          if (!ts.length) return fail('Keine Rapporte ausgewählt.');
          if (ts.some((t) => t.status !== 'Freigegeben')) return fail('Nur freigegebene Rapporte können verrechnet werden.');
          if (ts.some((t) => assignments.find((a) => a.id === t.assignmentId)?.companyId !== companyId))
            return fail('Alle Rapporte müssen zum selben Kunden gehören.');
          const draft = buildVerleihInvoice(company, ts, assignments, candidates, settings, todayISO());
          const nr = nextNr('R');
          const inv: Invoice = { ...draft, id: uid(), nr, createdAt: nowISO() };
          set((s) => ({
            invoices: [inv, ...s.invoices],
            timesheets: s.timesheets.map((t): Timesheet => (ids.has(t.id) ? { ...t, status: 'Verrechnet', invoiceId: inv.id, updatedAt: nowISO() } : t)),
          }));
          log('invoice', inv.id, `Rechnung ${nr} an ${company.name} erstellt`);
          return ok(inv);
        },
        createHonorarInvoice: (placementId) => {
          const { placements, jobs, companies, candidates, settings, invoices } = get();
          const p = placements.find((x) => x.id === placementId);
          if (!p) return fail('Vermittlung nicht gefunden.');
          if (p.phase !== 'Vermittelt') return fail('Honorare können erst nach erfolgreicher Vermittlung verrechnet werden.');
          if (!p.honorar) return fail('Bitte zuerst ein Honorar erfassen.');
          if (invoices.some((i) => i.status !== 'Storniert' && i.positionen.some((l) => l.ref?.typ === 'placement' && l.ref.id === placementId)))
            return fail('Für diese Vermittlung existiert bereits eine Rechnung.');
          const job = jobs.find((j) => j.id === p.jobId);
          const company = companies.find((c) => c.id === job?.companyId);
          const cand = candidates.find((c) => c.id === p.candidateId);
          if (!job || !company || !cand) return fail('Unvollständige Daten (Vakanz, Unternehmen oder Kandidat fehlt).');
          const nr = nextNr('R');
          const inv: Invoice = { ...buildHonorarInvoice(p, job, company, cand, settings, todayISO()), id: uid(), nr, createdAt: nowISO() };
          set((s) => ({ invoices: [inv, ...s.invoices] }));
          log('invoice', inv.id, `Honorarrechnung ${nr} an ${company.name} erstellt`);
          return ok(inv);
        },
        setInvoiceStatus: (id, status) => {
          const inv = get().invoices.find((i) => i.id === id);
          if (!inv) return;
          set((s) => ({
            invoices: s.invoices.map((i): Invoice => (i.id === id ? { ...i, status, bezahltAm: status === 'Bezahlt' ? todayISO() : '' } : i)),
            // Stornierung gibt die Rapporte wieder zur Verrechnung frei
            timesheets: status === 'Storniert'
              ? s.timesheets.map((t): Timesheet => (t.invoiceId === id ? { ...t, status: 'Freigegeben', invoiceId: '', updatedAt: nowISO() } : t))
              : s.timesheets,
          }));
          log('invoice', id, `Rechnung ${inv.nr}: ${status}`);
        },

        /* ---------- Aktivitäten ---------- */
        addActivity: (input) => {
          const a: Activity = { ...input, id: uid(), createdAt: nowISO() };
          set((s) => ({ activities: [a, ...s.activities] }));
          return a;
        },
        updateActivity: (id, patch) => set((s) => ({ activities: patchIn(s.activities, id, patch, false) })),
        toggleActivity: (id) =>
          set((s) => ({ activities: s.activities.map((a) => (a.id === id ? { ...a, erledigt: !a.erledigt } : a)) })),
        deleteActivity: (id) => set((s) => ({ activities: s.activities.filter((a) => a.id !== id) })),

        /* ---------- Benutzer ---------- */
        addUser: (input) => {
          if (get().users.some((u) => u.username.toLowerCase() === input.username.toLowerCase()))
            return fail('Dieser Benutzername ist bereits vergeben.');
          const u: User = { ...input, id: uid() };
          set((s) => ({ users: [...s.users, u] }));
          log('user', u.id, `Benutzer ${u.username} erstellt`);
          return ok(u);
        },
        updateUser: (id, patch) => {
          const { users } = get();
          const u = users.find((x) => x.id === id);
          if (!u) return fail('Benutzer nicht gefunden.');
          if (u.rolle === 'admin' && patch.rolle === 'berater' && users.filter((x) => x.rolle === 'admin').length <= 1)
            return fail('Der letzte Administrator kann nicht herabgestuft werden.');
          set((s) => ({ users: s.users.map((x) => (x.id === id ? { ...x, ...patch, id } : x)) }));
          log('user', id, 'Benutzer bearbeitet');
          return ok(undefined);
        },
        deleteUser: (id) => {
          const { users } = get();
          const u = users.find((x) => x.id === id);
          if (!u) return fail('Benutzer nicht gefunden.');
          if (id === actorId()) return fail('Sie können Ihr eigenes Konto nicht löschen.');
          if (u.rolle === 'admin' && users.filter((x) => x.rolle === 'admin').length <= 1) return fail('Der letzte Administrator kann nicht gelöscht werden.');
          set((s) => ({ users: s.users.filter((x) => x.id !== id) }));
          log('user', id, `Benutzer ${u.username} gelöscht`);
          return ok(undefined);
        },

        updateSettings: (patch) => {
          set((s) => ({ settings: { ...s.settings, ...patch, tarif: { ...s.settings.tarif, ...(patch.tarif ?? {}) } } }));
          log('settings', '', 'Einstellungen geändert');
        },

        /* ---------- Daten ---------- */
        exportData: () => pickData(get()),
        importData: (data) => {
          const d = data as Partial<CrmData> | null;
          if (!d || typeof d !== 'object') return fail('Ungültige Datei.');
          const required: (keyof CrmData)[] = ['users', 'candidates', 'companies', 'jobs', 'placements', 'activities'];
          if (required.some((k) => !Array.isArray(d[k]))) return fail('Die Datei enthält keinen gültigen PersoCRM-Export (v2).');
          if (!d.users!.length) return fail('Der Export enthält keine Benutzer.');
          const base = createSeed();
          set({
            ...base,
            ...d,
            assignments: d.assignments ?? [], timesheets: d.timesheets ?? [], invoices: d.invoices ?? [], audit: d.audit ?? [],
            settings: { ...base.settings, ...(d.settings ?? {}), tarif: { ...base.settings.tarif, ...(d.settings?.tarif ?? {}) } },
            counters: { ...base.counters, ...(d.counters ?? {}) },
          } as CrmData);
          log('system', '', 'Daten importiert');
          return ok(undefined);
        },
        resetDemo: () => {
          set(createSeed());
        },
        snapshot: () => {
          const saved = pickData(get());
          return () => set(saved);
        },
      };
    },
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => pickData(s),
    },
  ),
);

/** Direkter Zugriff ausserhalb von React (z.B. in Event-Handlern) */
export const dataApi = () => useData.getState();
