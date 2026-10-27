/* ============================================================
   Kennzahlen für Dashboard und Berichte (reine Funktionen)
   ============================================================ */
import type { Candidate, CandidateSource, Invoice, Job, Phase, Placement, User } from '@/types';
import { CANDIDATE_SOURCES, PHASES } from '@/types';
import { daysBetween, monthKey, round2 } from './format';

const billed = (i: Invoice) => i.status !== 'Storniert';

export interface MonthRevenue {
  month: string;
  verleih: number;
  honorar: number;
  total: number;
}

/** Netto-Umsatz je Rechnungsmonat (ohne Stornos) */
export function revenueByMonth(invoices: Invoice[], months: string[]): MonthRevenue[] {
  const rows = new Map(months.map((m) => [m, { month: m, verleih: 0, honorar: 0, total: 0 }]));
  for (const i of invoices) {
    if (!billed(i)) continue;
    const r = rows.get(monthKey(i.datum));
    if (!r) continue;
    if (i.typ === 'Verleih') r.verleih += i.netto;
    else r.honorar += i.netto;
    r.total += i.netto;
  }
  return [...rows.values()].map((r) => ({ ...r, verleih: round2(r.verleih), honorar: round2(r.honorar), total: round2(r.total) }));
}

/** Netto-Umsatz je Kunde im Zeitraum [from, to] (Monate YYYY-MM, inklusive) */
export function revenueByCompany(invoices: Invoice[], from: string, to: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const i of invoices) {
    const k = monthKey(i.datum);
    if (!billed(i) || k < from || k > to) continue;
    m.set(i.companyId, round2((m.get(i.companyId) ?? 0) + i.netto));
  }
  return m;
}

/** Wie viele Prozesse haben eine Phase mindestens einmal erreicht (Trichter) */
export function funnel(placements: Placement[]): { phase: Phase; count: number }[] {
  const steps: Phase[] = PHASES.filter((p) => p !== 'Absage');
  const reached = placements.map((p) => Math.max(...[p.phase, ...p.verlauf.map((v) => v.phase)].map((ph) => steps.indexOf(ph))));
  return steps.map((phase, idx) => ({ phase, count: reached.filter((r) => r >= idx).length }));
}

/** Durchschnittliche Tage vom Vorschlag bis zur Vermittlung */
export function avgDaysToPlacement(placements: Placement[]): number | null {
  const days = placements
    .map((p) => {
      const won = p.verlauf.find((v) => v.phase === 'Vermittelt');
      return won ? daysBetween(p.createdAt.slice(0, 10), won.datum.slice(0, 10)) : null;
    })
    .filter((d): d is number => d !== null);
  return days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null;
}

export interface SourceStat {
  quelle: CandidateSource;
  kandidaten: number;
  vermittelt: number;
  quote: number;
}

/** Welche Rekrutierungskanäle bringen Vermittlungen? */
export function sourceStats(candidates: Candidate[], placements: Placement[]): SourceStat[] {
  const won = new Set(placements.filter((p) => p.phase === 'Vermittelt').map((p) => p.candidateId));
  return CANDIDATE_SOURCES.map((quelle) => {
    const list = candidates.filter((c) => c.quelle === quelle);
    const vermittelt = list.filter((c) => won.has(c.id) || c.status === 'Vermittelt' || c.status === 'Im Einsatz').length;
    return { quelle, kandidaten: list.length, vermittelt, quote: list.length ? Math.round((vermittelt / list.length) * 100) : 0 };
  }).filter((s) => s.kandidaten > 0);
}

export interface ConsultantStat {
  user: User;
  aktiveProzesse: number;
  vermittlungen: number;
  honorar: number;
  offeneVakanzen: number;
}

/** Leistung je Berater/in (über die betreuten Vakanzen) */
export function consultantStats(users: User[], jobs: Job[], placements: Placement[]): ConsultantStat[] {
  const jobOwner = new Map(jobs.map((j) => [j.id, j.betreuerId]));
  return users
    .map((user) => {
      const own = placements.filter((p) => jobOwner.get(p.jobId) === user.id);
      const won = own.filter((p) => p.phase === 'Vermittelt');
      return {
        user,
        aktiveProzesse: own.filter((p) => p.phase === 'Vorgeschlagen' || p.phase === 'Interview' || p.phase === 'Angebot').length,
        vermittlungen: won.length,
        honorar: won.reduce((s, p) => s + (p.honorar ?? 0), 0),
        offeneVakanzen: jobs.filter((j) => j.betreuerId === user.id && (j.status === 'Offen' || j.status === 'In Bearbeitung')).length,
      };
    })
    .sort((a, b) => b.vermittlungen - a.vermittlungen || b.aktiveProzesse - a.aktiveProzesse);
}
