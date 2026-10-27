/* ============================================================
   PersoCRM – Datenmodell
   Konstanten-Listen sind die einzige Quelle für Status-Werte;
   die Typen werden daraus abgeleitet.
   ============================================================ */

export type ID = string;
/** Datum im Format YYYY-MM-DD (leerer String = nicht gesetzt) */
export type ISODate = string;
/** Datum mit Uhrzeit im Format YYYY-MM-DDTHH:mm */
export type ISODateTime = string;

/* ---------- Wertelisten ---------- */
export const SALUTATIONS = ['Herr', 'Frau', 'Divers'] as const;
export type Salutation = (typeof SALUTATIONS)[number] | '';

/** Schweizer Aufenthalts-/Arbeitsbewilligungen */
export const PERMITS = ['CH', 'C', 'B', 'L', 'G', 'Andere'] as const;
export type Permit = (typeof PERMITS)[number] | '';

export const EMPLOYMENT_TYPES = ['Festanstellung', 'Temporär', 'Try & Hire'] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const CANDIDATE_STATUS = ['Neu', 'In Prüfung', 'Aktiv', 'Im Einsatz', 'Vermittelt', 'Inaktiv'] as const;
export type CandidateStatus = (typeof CANDIDATE_STATUS)[number];

export const CANDIDATE_SOURCES = ['jobs.ch', 'LinkedIn', 'Website', 'Empfehlung', 'Headhunting', 'RAV', 'Sonstige'] as const;
export type CandidateSource = (typeof CANDIDATE_SOURCES)[number];

export const DOCUMENT_TYPES = ['Lebenslauf', 'Arbeitszeugnis', 'Diplom', 'Zertifikat', 'Bewilligung', 'Sonstiges'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const COMPANY_STATUS = ['Interessent', 'Aktiv', 'Inaktiv'] as const;
export type CompanyStatus = (typeof COMPANY_STATUS)[number];

export const JOB_STATUS = ['Offen', 'In Bearbeitung', 'Besetzt', 'On Hold', 'Storniert'] as const;
export type JobStatus = (typeof JOB_STATUS)[number];

export const PRIORITIES = ['Hoch', 'Mittel', 'Niedrig'] as const;
export type Priority = (typeof PRIORITIES)[number];

/** Phasen eines Vermittlungsprozesses (Pipeline) */
export const PHASES = ['Vorgeschlagen', 'Interview', 'Angebot', 'Vermittelt', 'Absage'] as const;
export type Phase = (typeof PHASES)[number];
export const ACTIVE_PHASES: readonly Phase[] = ['Vorgeschlagen', 'Interview', 'Angebot'];

export const ASSIGNMENT_STATUS = ['Geplant', 'Aktiv', 'Beendet'] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUS)[number];

export const TIMESHEET_STATUS = ['Offen', 'Eingereicht', 'Freigegeben', 'Verrechnet'] as const;
export type TimesheetStatus = (typeof TIMESHEET_STATUS)[number];

export const INVOICE_STATUS = ['Offen', 'Bezahlt', 'Storniert'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUS)[number];
export type InvoiceType = 'Verleih' | 'Honorar';

export const ACTIVITY_TYPES = ['Anruf', 'E-Mail', 'Termin', 'Aufgabe', 'Notiz'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ROLES = ['admin', 'berater'] as const;
export type Role = (typeof ROLES)[number];

/* ---------- Entitäten ---------- */
export interface User {
  id: ID;
  username: string;
  /** SHA-256 (hex) – Demo-Authentifizierung im Browser */
  passwordHash: string;
  name: string;
  rolle: Role;
  email: string;
}

export interface Language {
  sprache: string;
  /** z.B. Muttersprache, C1, B2 – leer wenn unbekannt */
  niveau: string;
}

export interface DocumentRef {
  id: ID;
  name: string;
  typ: DocumentType;
  datum: ISODate;
  /** Grösse in Bytes (Datei selbst wird nicht gespeichert) */
  groesse?: number;
  /** Extrahierter Text (gekürzt) – ermöglicht Volltextsuche */
  text?: string;
}

export interface Candidate {
  id: ID;
  nr: string;
  anrede: Salutation;
  vorname: string;
  nachname: string;
  geburtsdatum: ISODate;
  email: string;
  telefon: string;
  strasse: string;
  plz: string;
  ort: string;
  nationalitaet: string;
  bewilligung: Permit;
  beruf: string;
  ausbildung: string;
  erfahrungJahre: number | null;
  skills: string[];
  sprachen: Language[];
  verfuegbarAb: ISODate;
  /** z.B. "100%" oder "80-100%" */
  pensum: string;
  anstellungsarten: EmploymentType[];
  /** Jahreslohn CHF (Festanstellung) */
  lohnvorstellung: number | null;
  /** Stundenlohn CHF (Temporär) */
  stundenlohn: number | null;
  status: CandidateStatus;
  quelle: CandidateSource;
  betreuerId: ID;
  notizen: string;
  tags: string[];
  dokumente: DocumentRef[];
  /** Kurzprofil (KI- oder Vorlagen-generiert, editierbar) */
  kurzprofil: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Contact {
  id: ID;
  anrede: Salutation;
  vorname: string;
  nachname: string;
  funktion: string;
  email: string;
  telefon: string;
}

export interface Company {
  id: ID;
  nr: string;
  name: string;
  branche: string;
  strasse: string;
  plz: string;
  ort: string;
  telefon: string;
  email: string;
  website: string;
  status: CompanyStatus;
  /** Honorar in % des Jahreslohns bei Festanstellung */
  honorarSatz: number | null;
  /** Zahlungsfrist in Tagen */
  zahlungsfrist: number;
  betreuerId: ID;
  notizen: string;
  kontakte: Contact[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** Vakanz / Auftrag eines Kunden */
export interface Job {
  id: ID;
  nr: string;
  titel: string;
  companyId: ID;
  /** ID eines Kontakts aus company.kontakte ('' = keiner) */
  kontaktId: ID;
  ort: string;
  pensum: string;
  art: EmploymentType;
  lohnMin: number | null;
  lohnMax: number | null;
  /** Stundentarif an Kunde bei Temporär (optional) */
  tarif: number | null;
  skills: string[];
  beschreibung: string;
  status: JobStatus;
  prioritaet: Priority;
  /** Gewünschter Stellenantritt / Deadline */
  deadline: ISODate;
  anzahl: number;
  betreuerId: ID;
  /** Generiertes Stelleninserat (editierbar) */
  inserat: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface PhaseChange {
  datum: ISODateTime;
  phase: Phase;
  notiz: string;
  userId: ID;
}

/** Vermittlungsprozess Kandidat ↔ Vakanz */
export interface Placement {
  id: ID;
  candidateId: ID;
  jobId: ID;
  phase: Phase;
  honorar: number | null;
  startdatum: ISODate;
  notiz: string;
  verlauf: PhaseChange[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** Temporär-Einsatz (Personalverleih) */
export interface Assignment {
  id: ID;
  nr: string;
  candidateId: ID;
  companyId: ID;
  jobId: ID;
  funktion: string;
  einsatzort: string;
  start: ISODate;
  ende: ISODate;
  /** Grundlohn CHF/h an Mitarbeitende */
  stundenlohn: number;
  /** Verrechnungssatz CHF/h an Kunde */
  tarif: number;
  /** Soll-Stunden pro Woche */
  sollStunden: number;
  status: AssignmentStatus;
  notiz: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** Wochenrapport eines Einsatzes */
export interface Timesheet {
  id: ID;
  assignmentId: ID;
  /** Montag der Woche (YYYY-MM-DD) */
  woche: ISODate;
  /** Stunden Mo–So (7 Werte) */
  stunden: number[];
  spesen: number;
  status: TimesheetStatus;
  notiz: string;
  invoiceId: ID;
  updatedAt: ISODateTime;
}

export interface InvoiceLine {
  beschreibung: string;
  menge: number;
  einheit: 'Std.' | 'Pauschal' | 'CHF';
  preis: number;
  betrag: number;
  ref?: { typ: 'timesheet' | 'placement'; id: ID };
}

export interface Invoice {
  id: ID;
  nr: string;
  companyId: ID;
  typ: InvoiceType;
  datum: ISODate;
  faelligAm: ISODate;
  /** Abrechnungsperiode YYYY-MM (Verleih) oder '' */
  periode: string;
  positionen: InvoiceLine[];
  netto: number;
  mwstSatz: number;
  mwst: number;
  total: number;
  status: InvoiceStatus;
  bezahltAm: ISODate;
  createdAt: ISODateTime;
}

export type EntityType = 'candidate' | 'company' | 'job' | 'assignment';
export interface EntityRef {
  typ: EntityType;
  id: ID;
}

export interface Activity {
  id: ID;
  typ: ActivityType;
  betreff: string;
  beschreibung: string;
  faelligAm: ISODateTime;
  erledigt: boolean;
  bezug: EntityRef | null;
  userId: ID;
  /** true = automatisch vom System erstellt */
  auto: boolean;
  createdAt: ISODateTime;
}

export type AuditEntity =
  | EntityType
  | 'placement'
  | 'timesheet'
  | 'invoice'
  | 'activity'
  | 'user'
  | 'settings'
  | 'system';

export interface AuditEntry {
  id: ID;
  ts: ISODateTime;
  userId: ID;
  entity: AuditEntity;
  entityId: ID;
  text: string;
}

/** Zuschläge und Sozialabgaben in Prozent (Richtwerte, editierbar) */
export interface TariffRates {
  ferien: number;
  feiertage: number;
  dreizehnter: number;
  ahv: number;
  alv: number;
  fak: number;
  uvg: number;
  ktg: number;
  bvg: number;
  gav: number;
  verwaltung: number;
  /** Zielmarge in % vom Verrechnungssatz */
  zielmarge: number;
}

export interface Settings {
  firmenname: string;
  strasse: string;
  plz: string;
  ort: string;
  telefon: string;
  email: string;
  website: string;
  /** MWST-Nummer (UID) */
  uid: string;
  iban: string;
  mwstSatz: number;
  autoFollowup: boolean;
  followupTage: number;
  tarif: TariffRates;
}

export type Counters = Record<'K' | 'F' | 'V' | 'E' | 'R', number>;

/** Persistierter Datenbestand */
export interface CrmData {
  users: User[];
  candidates: Candidate[];
  companies: Company[];
  jobs: Job[];
  placements: Placement[];
  assignments: Assignment[];
  timesheets: Timesheet[];
  invoices: Invoice[];
  activities: Activity[];
  audit: AuditEntry[];
  settings: Settings;
  counters: Counters;
}

/* ---------- KI-/Import-Ergebnisse ---------- */
export type CandidateDraft = Omit<
  Candidate,
  'id' | 'nr' | 'status' | 'quelle' | 'betreuerId' | 'notizen' | 'tags' | 'dokumente' | 'createdAt' | 'updatedAt'
>;

export type CompanyDraft = Pick<
  Company,
  'name' | 'branche' | 'strasse' | 'plz' | 'ort' | 'telefon' | 'email' | 'website' | 'notizen'
> & { kontakte: Omit<Contact, 'id'>[] };

export interface ExtractionResult<T> {
  data: T;
  /** Feldnamen, die nicht gefunden wurden → rot markieren */
  missing: string[];
  /** Feldnamen mit unsicherem Wert → gelb markieren */
  uncertain: string[];
  source: 'ki' | 'heuristik';
  /** Hinweis, z.B. wenn KI fehlschlug und auf Heuristik zurückgefallen wurde */
  warning?: string;
}

/** Filter für die Kandidatenliste (auch per URL und KI-Suche befüllbar) */
export interface CandidateFilter {
  q: string;
  skills: string[];
  orte: string[];
  berufe: string[];
  status: CandidateStatus[];
  bewilligungen: Permit[];
  anstellungsart: EmploymentType | '';
  /** verfügbar spätestens am (YYYY-MM-DD) */
  verfuegbarBis: ISODate;
  minErfahrung: number | null;
}
