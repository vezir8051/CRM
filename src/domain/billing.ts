/* ============================================================
   Rapporte & Abrechnung
   ============================================================ */
import type { Assignment, Candidate, Company, Invoice, InvoiceLine, Job, Placement, Settings, Timesheet } from '@/types';
import { addDays, fmtDate, fullName, monthKey, round05, round2, weekLabel } from './format';
import { calcMargin } from './tarif';

export function timesheetHours(ts: Pick<Timesheet, 'stunden'>): number {
  return round2((ts.stunden ?? []).reduce((a, b) => a + (Number(b) || 0), 0));
}

export function timesheetAmount(ts: Timesheet, a: Assignment): number {
  return round2(timesheetHours(ts) * a.tarif + (ts.spesen || 0));
}

/** Periode eines Rapports = Monat des Montags der Woche */
export function timesheetPeriod(ts: Pick<Timesheet, 'woche'>): string {
  return monthKey(ts.woche);
}

export interface BillingGroup {
  companyId: string;
  periode: string;
  timesheets: Timesheet[];
  stunden: number;
  netto: number;
}

/** Freigegebene, noch nicht verrechnete Rapporte gruppiert nach Kunde und Monat */
export function billableGroups(timesheets: Timesheet[], assignments: Assignment[]): BillingGroup[] {
  const byId = new Map(assignments.map((a) => [a.id, a]));
  const groups = new Map<string, BillingGroup>();
  for (const ts of timesheets) {
    if (ts.status !== 'Freigegeben') continue;
    const a = byId.get(ts.assignmentId);
    if (!a) continue;
    const periode = timesheetPeriod(ts);
    const key = `${a.companyId}|${periode}`;
    const g = groups.get(key) ?? { companyId: a.companyId, periode, timesheets: [], stunden: 0, netto: 0 };
    g.timesheets.push(ts);
    g.stunden = round2(g.stunden + timesheetHours(ts));
    g.netto = round2(g.netto + timesheetAmount(ts, a));
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => a.periode.localeCompare(b.periode));
}

export function invoiceTotals(lines: InvoiceLine[], mwstSatz: number): Pick<Invoice, 'netto' | 'mwst' | 'total'> {
  const netto = round2(lines.reduce((s, l) => s + l.betrag, 0));
  const mwst = round05(netto * (mwstSatz / 100));
  return { netto, mwst, total: round05(netto + mwst) };
}

type InvoiceDraft = Omit<Invoice, 'id' | 'nr' | 'createdAt'>;

/** Verleih-Rechnung aus Rapporten eines Kunden */
export function buildVerleihInvoice(
  company: Company,
  timesheets: Timesheet[],
  assignments: Assignment[],
  candidates: Candidate[],
  settings: Settings,
  datum: string,
): InvoiceDraft {
  const aById = new Map(assignments.map((a) => [a.id, a]));
  const cById = new Map(candidates.map((c) => [c.id, c]));
  const lines: InvoiceLine[] = [];
  const sorted = [...timesheets].sort((x, y) => x.woche.localeCompare(y.woche));
  for (const ts of sorted) {
    const a = aById.get(ts.assignmentId);
    if (!a) continue;
    const name = fullName(cById.get(a.candidateId));
    const std = timesheetHours(ts);
    lines.push({
      beschreibung: `${name} – ${a.funktion}, ${weekLabel(ts.woche)}`,
      menge: std,
      einheit: 'Std.',
      preis: a.tarif,
      betrag: round2(std * a.tarif),
      ref: { typ: 'timesheet', id: ts.id },
    });
    if (ts.spesen > 0) {
      lines.push({ beschreibung: `Spesen ${name}, ${weekLabel(ts.woche)}`, menge: 1, einheit: 'Pauschal', preis: ts.spesen, betrag: round2(ts.spesen) });
    }
  }
  const periode = sorted.length ? timesheetPeriod(sorted[0]) : monthKey(datum);
  return {
    companyId: company.id,
    typ: 'Verleih',
    datum,
    faelligAm: addDays(datum, company.zahlungsfrist || 30),
    periode,
    positionen: lines,
    mwstSatz: settings.mwstSatz,
    ...invoiceTotals(lines, settings.mwstSatz),
    status: 'Offen',
    bezahltAm: '',
  };
}

/** Honorar-Rechnung für eine erfolgreiche Festanstellung */
export function buildHonorarInvoice(
  placement: Placement,
  job: Job,
  company: Company,
  candidate: Candidate,
  settings: Settings,
  datum: string,
): InvoiceDraft {
  const honorar = placement.honorar ?? 0;
  const lines: InvoiceLine[] = [
    {
      beschreibung: `Vermittlungshonorar ${fullName(candidate)} als ${job.titel}${placement.startdatum ? `, Stellenantritt ${fmtDate(placement.startdatum)}` : ''}`,
      menge: 1,
      einheit: 'Pauschal',
      preis: honorar,
      betrag: honorar,
      ref: { typ: 'placement', id: placement.id },
    },
  ];
  return {
    companyId: company.id,
    typ: 'Honorar',
    datum,
    faelligAm: addDays(datum, company.zahlungsfrist || 30),
    periode: '',
    positionen: lines,
    mwstSatz: settings.mwstSatz,
    ...invoiceTotals(lines, settings.mwstSatz),
    status: 'Offen',
    bezahltAm: '',
  };
}

/** Honorar-Vorschlag: Satz × Jahreslohn (Mitte der Lohnspanne bzw. Lohnvorstellung) */
export function suggestHonorar(job: Job, company: Company | undefined, candidate: Candidate | undefined): number | null {
  const satz = company?.honorarSatz;
  if (!satz) return null;
  const lohn =
    candidate?.lohnvorstellung ??
    (job.lohnMin && job.lohnMax ? (job.lohnMin + job.lohnMax) / 2 : job.lohnMax ?? job.lohnMin ?? null);
  if (!lohn) return null;
  return Math.round((lohn * satz) / 100 / 50) * 50;
}

export interface AssignmentEconomics {
  stunden: number;
  umsatz: number;
  lohnkosten: number;
  deckungsbeitrag: number;
  margeProzent: number;
}

/** Wirtschaftlichkeit eines Einsatzes aus allen erfassten Rapporten */
export function assignmentEconomics(a: Assignment, timesheets: Timesheet[], settings: Settings): AssignmentEconomics {
  const own = timesheets.filter((t) => t.assignmentId === a.id);
  const stunden = round2(own.reduce((s, t) => s + timesheetHours(t), 0));
  const m = calcMargin(a.stundenlohn, a.tarif, settings.tarif);
  return {
    stunden,
    umsatz: round2(stunden * a.tarif),
    lohnkosten: round2(stunden * m.lohnkosten),
    deckungsbeitrag: round2(stunden * m.deckungsbeitrag),
    margeProzent: m.margeProzent,
  };
}

/** Rechnung überfällig? */
export function isInvoiceOverdue(inv: Invoice, today: string): boolean {
  return inv.status === 'Offen' && inv.faelligAm < today;
}
