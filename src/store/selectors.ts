/* ============================================================
   Abgeleitete Daten als Hooks (memoisiert).
   Regel: Im Zustand-Selektor nur Rohdaten wählen, ableiten mit useMemo.
   ============================================================ */
import { useMemo } from 'react';
import type { Assignment, Candidate, Company, CrmData, Job, User } from '@/types';
import { ACTIVE_PHASES } from '@/types';
import { addDays, fullName, startOfWeek, todayISO } from '@/domain/format';
import { useData } from './data';

/** Maps für schnelle Nachschlagewerke nach ID */
export function useLookups() {
  const candidates = useData((s) => s.candidates);
  const companies = useData((s) => s.companies);
  const jobs = useData((s) => s.jobs);
  const users = useData((s) => s.users);
  const assignments = useData((s) => s.assignments);
  return useMemo(
    () => ({
      candidate: new Map<string, Candidate>(candidates.map((c) => [c.id, c])),
      company: new Map<string, Company>(companies.map((c) => [c.id, c])),
      job: new Map<string, Job>(jobs.map((j) => [j.id, j])),
      user: new Map<string, User>(users.map((u) => [u.id, u])),
      assignment: new Map<string, Assignment>(assignments.map((a) => [a.id, a])),
    }),
    [candidates, companies, jobs, users, assignments],
  );
}

export function useUserName(id: string | null | undefined): string {
  const users = useData((s) => s.users);
  return useMemo(() => users.find((u) => u.id === id)?.name ?? '–', [users, id]);
}

/** Vollständiger Datenbestand (z.B. für Insights/Berichte) */
export function useCrmData(): CrmData {
  const s = useData();
  return useMemo(
    () => ({
      users: s.users, candidates: s.candidates, companies: s.companies, jobs: s.jobs, placements: s.placements,
      assignments: s.assignments, timesheets: s.timesheets, invoices: s.invoices, activities: s.activities,
      audit: s.audit, settings: s.settings, counters: s.counters,
    }),
    [s.users, s.candidates, s.companies, s.jobs, s.placements, s.assignments, s.timesheets, s.invoices, s.activities, s.audit, s.settings, s.counters],
  );
}

/** Zähler für die Navigations-Badges */
export function useNavCounts() {
  const jobs = useData((s) => s.jobs);
  const activities = useData((s) => s.activities);
  const timesheets = useData((s) => s.timesheets);
  const invoices = useData((s) => s.invoices);
  return useMemo(() => {
    const today = todayISO();
    return {
      vakanzen: jobs.filter((j) => j.status === 'Offen' || j.status === 'In Bearbeitung').length,
      aktivitaeten: activities.filter((a) => !a.erledigt && a.faelligAm && a.faelligAm.slice(0, 10) <= today).length,
      rapporte: timesheets.filter((t) => t.status === 'Eingereicht').length,
      rechnungen: invoices.filter((i) => i.status === 'Offen' && i.faelligAm < today).length,
    };
  }, [jobs, activities, timesheets, invoices]);
}

/** Laufende Prozesse eines Kandidaten (nicht abgesagt/vermittelt) */
export function activePlacementCount(data: Pick<CrmData, 'placements'>, candidateId: string): number {
  return data.placements.filter((p) => p.candidateId === candidateId && ACTIVE_PHASES.includes(p.phase)).length;
}

/** Wochen (Montage) seit Einsatzbeginn bis aktuelle Woche bzw. Einsatzende */
export function assignmentWeeks(a: Assignment, today: string = todayISO()): string[] {
  const end = a.ende && a.ende < today ? startOfWeek(a.ende) : startOfWeek(today);
  const out: string[] = [];
  for (let w = startOfWeek(a.start); w <= end; w = addDays(w, 7)) out.push(w);
  return out;
}

export function candidateLabel(c: Candidate | undefined): string {
  return c ? fullName(c) : 'Unbekannt';
}
