/* Leere Datensätze als Startwerte für Formulare */
import type { Activity, Assignment, Candidate, Company, Contact, Job } from '@/types';
import { nowISO, startOfWeek, todayISO } from '@/domain/format';

export type CandidateInput = Omit<Candidate, 'id' | 'nr' | 'createdAt' | 'updatedAt'>;
export type CompanyInput = Omit<Company, 'id' | 'nr' | 'createdAt' | 'updatedAt'>;
export type JobInput = Omit<Job, 'id' | 'nr' | 'createdAt' | 'updatedAt'>;
export type AssignmentInput = Omit<Assignment, 'id' | 'nr' | 'createdAt' | 'updatedAt'>;
export type ActivityInput = Omit<Activity, 'id' | 'createdAt'>;
export type ContactInput = Omit<Contact, 'id'> & { id?: string };

export function emptyCandidate(betreuerId: string): CandidateInput {
  return {
    anrede: '', vorname: '', nachname: '', geburtsdatum: '', email: '', telefon: '', strasse: '', plz: '', ort: '',
    nationalitaet: '', bewilligung: '', beruf: '', ausbildung: '', erfahrungJahre: null, skills: [], sprachen: [],
    verfuegbarAb: '', pensum: '100%', anstellungsarten: ['Festanstellung'], lohnvorstellung: null, stundenlohn: null,
    status: 'Neu', quelle: 'Website', betreuerId, notizen: '', tags: [], dokumente: [], kurzprofil: '',
  };
}

export function emptyCompany(betreuerId: string): CompanyInput {
  return {
    name: '', branche: '', strasse: '', plz: '', ort: '', telefon: '', email: '', website: '', status: 'Interessent',
    honorarSatz: 22, zahlungsfrist: 30, betreuerId, notizen: '', kontakte: [],
  };
}

export function emptyJob(betreuerId: string, companyId = ''): JobInput {
  return {
    titel: '', companyId, kontaktId: '', ort: '', pensum: '100%', art: 'Festanstellung', lohnMin: null, lohnMax: null, tarif: null,
    skills: [], beschreibung: '', status: 'Offen', prioritaet: 'Mittel', deadline: '', anzahl: 1, betreuerId, inserat: '',
  };
}

export function emptyAssignment(): AssignmentInput {
  return {
    candidateId: '', companyId: '', jobId: '', funktion: '', einsatzort: '', start: startOfWeek(todayISO()), ende: '',
    stundenlohn: 32, tarif: 0, sollStunden: 42, status: 'Geplant', notiz: '',
  };
}

export function emptyActivity(userId: string): ActivityInput {
  return { typ: 'Aufgabe', betreff: '', beschreibung: '', faelligAm: '', erledigt: false, bezug: null, userId, auto: false };
}

export function emptyContact(): ContactInput {
  return { anrede: '', vorname: '', nachname: '', funktion: '', email: '', telefon: '' };
}

export { nowISO };
