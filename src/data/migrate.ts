/* ============================================================
   Übernahme der Daten aus PersoCRM v1 (localStorage-Schlüssel
   «persocrm_data_v1»). Wird einmalig beim ersten Start von v2
   ausgeführt, damit bereits erfasste Daten erhalten bleiben.
   ============================================================ */
import type {
  Activity, Candidate, Company, CrmData, EmploymentType, EntityType, Job, Placement, User,
} from '@/types';
import { EMPLOYMENT_TYPES } from '@/types';
import { sha256 } from '@/domain/ids';
import { createSeed } from './seed';
import { DEFAULT_TARIFF_RATES } from '@/domain/tarif';

export const V1_STORAGE_KEY = 'persocrm_data_v1';

/* eslint-disable @typescript-eslint/no-explicit-any */
type V1 = Record<string, any>;

const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const n = (v: unknown) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const dt = (v: unknown) => {
  const x = s(v);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(x)) return x.slice(0, 16);
  if (/^\d{4}-\d{2}-\d{2}$/.test(x)) return `${x}T09:00`;
  return '';
};
const art = (v: unknown): EmploymentType => ((EMPLOYMENT_TYPES as readonly string[]).includes(s(v)) ? (s(v) as EmploymentType) : 'Festanstellung');
const bezugTyp: Record<string, EntityType> = { kandidat: 'candidate', unternehmen: 'company', vakanz: 'job' };

export async function migrateFromV1(raw: string): Promise<CrmData | null> {
  let v1: V1;
  try {
    v1 = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!v1 || !Array.isArray(v1.candidates) || !Array.isArray(v1.companies)) return null;

  const base = createSeed();
  const id = (v: unknown) => s(v);

  const users: User[] = await Promise.all(
    (v1.users ?? []).map(async (u: V1) => ({
      id: id(u.id),
      username: s(u.username),
      passwordHash: await sha256(s(u.password) || 'demo'),
      name: s(u.name),
      rolle: u.rolle === 'Administrator' ? 'admin' : 'berater',
      email: s(u.email),
    })),
  );

  const candidates: Candidate[] = v1.candidates.map((c: V1) => ({
    id: id(c.id), nr: s(c.nr), anrede: c.anrede === 'Frau' || c.anrede === 'Herr' ? c.anrede : '', vorname: s(c.vorname), nachname: s(c.nachname),
    geburtsdatum: s(c.geburtsdatum), email: s(c.email), telefon: s(c.telefon), strasse: s(c.strasse), plz: s(c.plz), ort: s(c.ort),
    nationalitaet: '', bewilligung: '', beruf: s(c.beruf), ausbildung: s(c.ausbildung), erfahrungJahre: n(c.berufserfahrung),
    skills: Array.isArray(c.qualifikationen) ? c.qualifikationen.map(s) : [],
    sprachen: Array.isArray(c.sprachen) ? c.sprachen.map((l: V1) => ({ sprache: s(l.sprache), niveau: s(l.niveau) })) : [],
    verfuegbarAb: s(c.verfuegbarAb), pensum: s(c.pensum), anstellungsarten: c.anstellungsart ? [art(c.anstellungsart)] : [],
    lohnvorstellung: n(c.lohnvorstellung), stundenlohn: null,
    status: ['Neu', 'In Prüfung', 'Aktiv', 'Vermittelt', 'Inaktiv'].includes(c.status) ? c.status : 'Aktiv',
    quelle: ['jobs.ch', 'LinkedIn', 'Website', 'Empfehlung', 'Headhunting'].includes(c.quelle) ? c.quelle : 'Sonstige',
    betreuerId: id(c.betreuerId), notizen: s(c.notizen), tags: [],
    dokumente: Array.isArray(c.dokumente) ? c.dokumente.map((d: V1) => ({ id: id(d.id), name: s(d.name), typ: d.typ ?? 'Sonstiges', datum: s(d.datum) })) : [],
    kurzprofil: '', createdAt: dt(c.erstelltAm), updatedAt: dt(c.erstelltAm),
  }));

  const companies: Company[] = v1.companies.map((f: V1) => ({
    id: id(f.id), nr: s(f.nr), name: s(f.name), branche: s(f.branche), strasse: s(f.strasse), plz: s(f.plz), ort: s(f.ort),
    telefon: s(f.telefon), email: s(f.email), website: s(f.website),
    status: ['Interessent', 'Aktiv', 'Inaktiv'].includes(f.status) ? f.status : 'Aktiv',
    honorarSatz: n(f.honorarSatz), zahlungsfrist: 30, betreuerId: id(f.betreuerId), notizen: s(f.notizen),
    kontakte: Array.isArray(f.ansprechpartner)
      ? f.ansprechpartner.map((k: V1) => ({ id: id(k.id), anrede: k.anrede === 'Frau' || k.anrede === 'Herr' ? k.anrede : '', vorname: s(k.vorname), nachname: s(k.nachname), funktion: s(k.funktion), email: s(k.email), telefon: s(k.telefon) }))
      : [],
    createdAt: dt(f.erstelltAm), updatedAt: dt(f.erstelltAm),
  }));

  const jobs: Job[] = (v1.vacancies ?? []).map((v: V1) => ({
    id: id(v.id), nr: s(v.nr), titel: s(v.titel), companyId: id(v.companyId), kontaktId: v.ansprechpartnerId ? id(v.ansprechpartnerId) : '',
    ort: s(v.einsatzort), pensum: s(v.pensum), art: art(v.anstellungsart), lohnMin: n(v.lohnMin), lohnMax: n(v.lohnMax), tarif: null,
    skills: Array.isArray(v.anforderungen) ? v.anforderungen.map(s) : [], beschreibung: s(v.beschreibung),
    status: ['Offen', 'In Bearbeitung', 'Besetzt', 'On Hold', 'Storniert'].includes(v.status) ? v.status : 'Offen',
    prioritaet: ['Hoch', 'Mittel', 'Niedrig'].includes(v.prioritaet) ? v.prioritaet : 'Mittel',
    deadline: s(v.deadline), anzahl: 1, betreuerId: id(v.betreuerId), inserat: '', createdAt: dt(v.erstelltAm), updatedAt: dt(v.erstelltAm),
  }));

  const placements: Placement[] = (v1.placements ?? []).map((p: V1) => ({
    id: id(p.id), candidateId: id(p.candidateId), jobId: id(p.vacancyId), phase: p.phase, honorar: n(p.honorar), startdatum: s(p.startdatum),
    notiz: s(p.notiz),
    verlauf: Array.isArray(p.verlauf) ? p.verlauf.map((v: V1) => ({ datum: dt(v.datum), phase: v.phase, notiz: s(v.notiz), userId: '' })) : [],
    createdAt: dt(p.erstelltAm), updatedAt: dt(p.erstelltAm),
  }));

  const activities: Activity[] = (v1.activities ?? []).map((a: V1) => ({
    id: id(a.id), typ: a.typ, betreff: s(a.betreff), beschreibung: s(a.beschreibung), faelligAm: dt(a.faelligAm), erledigt: !!a.erledigt,
    bezug: a.bezug && bezugTyp[a.bezug.typ] ? { typ: bezugTyp[a.bezug.typ], id: id(a.bezug.id) } : null,
    userId: id(a.userId), auto: s(a.betreff).startsWith('Nachfassen:'), createdAt: dt(a.erstelltAm),
  }));

  const settings = v1.settings ?? {};
  const counters = v1.meta?.counters ?? {};

  return {
    users: users.length ? users : base.users,
    candidates, companies, jobs, placements,
    assignments: [], timesheets: [], invoices: [],
    activities,
    audit: [{ id: 'migr', ts: new Date().toISOString().slice(0, 16), userId: users[0]?.id ?? 'u1', entity: 'system', entityId: '', text: 'Daten aus PersoCRM v1 übernommen' }],
    settings: { ...base.settings, firmenname: s(settings.firmenname) || base.settings.firmenname, ort: s(settings.ort) || base.settings.ort, autoFollowup: settings.autoFollowup !== false, tarif: { ...DEFAULT_TARIFF_RATES } },
    counters: { K: Number(counters.K) || 1000, F: Number(counters.F) || 2000, V: Number(counters.V) || 3000, E: 4000, R: 5000 },
  };
}
