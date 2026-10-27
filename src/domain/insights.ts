/* ============================================================
   Smart Insights: regelbasierte Handlungsempfehlungen
   ============================================================ */
import type { CrmData } from '@/types';
import { addDays, daysBetween, fmtDate, fullName, startOfWeek, todayISO } from './format';
import { rankJobs } from './matching';
import { isInvoiceOverdue } from './billing';

export type InsightSeverity = 'hoch' | 'mittel' | 'info';

export interface Insight {
  id: string;
  severity: InsightSeverity;
  icon: 'alert' | 'user' | 'briefcase' | 'clock' | 'file' | 'receipt' | 'handshake';
  title: string;
  text: string;
  action?: { label: string; to: string };
}

const SEVERITY_ORDER: Record<InsightSeverity, number> = { hoch: 0, mittel: 1, info: 2 };

export function computeInsights(data: CrmData, today: string = todayISO()): Insight[] {
  const out: Insight[] = [];
  const { candidates, companies, jobs, placements, assignments, timesheets, invoices, activities } = data;
  const companyName = (id: string) => companies.find((c) => c.id === id)?.name ?? 'Unbekannt';

  // 1. Überfällige Aufgaben
  const overdue = activities.filter((a) => !a.erledigt && a.faelligAm && a.faelligAm.slice(0, 10) < today);
  if (overdue.length) {
    out.push({
      id: 'tasks-overdue',
      severity: 'hoch',
      icon: 'alert',
      title: `${overdue.length} überfällige Aufgabe${overdue.length > 1 ? 'n' : ''}`,
      text: 'Offene Nachfass- und To-do-Aufgaben sind über dem Fälligkeitsdatum.',
      action: { label: 'Aufgaben öffnen', to: '/aktivitaeten' },
    });
  }

  // 2. Offene Vakanzen ohne Kandidaten im Prozess
  for (const j of jobs) {
    if (j.status !== 'Offen' && j.status !== 'In Bearbeitung') continue;
    const active = placements.filter((p) => p.jobId === j.id && p.phase !== 'Absage');
    const alter = daysBetween(j.createdAt.slice(0, 10), today);
    if (!active.length && alter >= 7) {
      out.push({
        id: `job-empty-${j.id}`,
        severity: j.prioritaet === 'Hoch' ? 'hoch' : 'mittel',
        icon: 'briefcase',
        title: `«${j.titel}» ohne Kandidaten`,
        text: `Seit ${alter} Tagen offen bei ${companyName(j.companyId)} – noch niemand vorgeschlagen.`,
        action: { label: 'Matching starten', to: `/vakanzen/${j.id}?tab=matching` },
      });
    }
  }

  // 3. Bald verfügbare Kandidaten ohne laufenden Prozess → beste Vakanz vorschlagen
  for (const c of candidates) {
    if (c.status !== 'Aktiv' || !c.verfuegbarAb) continue;
    const inTagen = daysBetween(today, c.verfuegbarAb);
    if (inTagen > 21) continue;
    const laufend = placements.some((p) => p.candidateId === c.id && p.phase !== 'Absage' && p.phase !== 'Vermittelt');
    const imEinsatz = assignments.some((a) => a.candidateId === c.id && a.status !== 'Beendet');
    if (laufend || imEinsatz) continue;
    const best = rankJobs(c, jobs, 1)[0];
    if (!best || best.score < 50) continue;
    const job = jobs.find((j) => j.id === best.jobId)!;
    out.push({
      id: `cand-available-${c.id}`,
      severity: 'mittel',
      icon: 'user',
      title: `${fullName(c)} ${inTagen <= 0 ? 'ist verfügbar' : `ab ${fmtDate(c.verfuegbarAb)} verfügbar`}`,
      text: `Passt zu «${job.titel}» (${best.score} % Match) – noch in keinem Prozess.`,
      action: { label: 'Kandidat ansehen', to: `/kandidaten/${c.id}` },
    });
  }

  // 4. Angebot-Phase ohne Bewegung seit > 5 Tagen
  for (const p of placements) {
    if (p.phase !== 'Angebot') continue;
    const last = p.verlauf[p.verlauf.length - 1]?.datum ?? p.updatedAt;
    const tage = daysBetween(last.slice(0, 10), today);
    if (tage >= 5) {
      const c = candidates.find((x) => x.id === p.candidateId);
      out.push({
        id: `offer-stale-${p.id}`,
        severity: 'hoch',
        icon: 'handshake',
        title: `Angebot für ${fullName(c)} seit ${tage} Tagen offen`,
        text: 'Jetzt nachfassen, bevor der Kandidat ein anderes Angebot annimmt.',
        action: { label: 'Zur Pipeline', to: '/pipeline' },
      });
    }
  }

  // 5. Einsätze, die in ≤ 14 Tagen enden
  for (const a of assignments) {
    if (a.status !== 'Aktiv' || !a.ende) continue;
    const rest = daysBetween(today, a.ende);
    if (rest >= 0 && rest <= 14) {
      const c = candidates.find((x) => x.id === a.candidateId);
      out.push({
        id: `assignment-ending-${a.id}`,
        severity: 'mittel',
        icon: 'clock',
        title: `Einsatz von ${fullName(c)} endet ${rest === 0 ? 'heute' : `in ${rest} Tagen`}`,
        text: `${a.funktion} bei ${companyName(a.companyId)} – Verlängerung oder Anschlusseinsatz planen.`,
        action: { label: 'Einsatz öffnen', to: `/einsaetze/${a.id}` },
      });
    }
  }

  // 6. Fehlende Rapporte der Vorwoche
  const vorwoche = startOfWeek(addDays(today, -7));
  const fehlend = assignments.filter((a) => {
    if (a.status !== 'Aktiv' || a.start > addDays(vorwoche, 6)) return false;
    const ts = timesheets.find((t) => t.assignmentId === a.id && t.woche === vorwoche);
    return !ts || ts.status === 'Offen';
  });
  if (fehlend.length) {
    out.push({
      id: 'timesheets-missing',
      severity: 'mittel',
      icon: 'file',
      title: `${fehlend.length} Rapport${fehlend.length > 1 ? 'e' : ''} der Vorwoche fehlen`,
      text: 'Stunden der letzten Woche sind noch nicht eingereicht – ohne Rapport keine Lohn- und Rechnungsstellung.',
      action: { label: 'Rapporte erfassen', to: '/rapporte' },
    });
  }

  // 7. Eingereichte Rapporte zur Freigabe
  const zurFreigabe = timesheets.filter((t) => t.status === 'Eingereicht').length;
  if (zurFreigabe) {
    out.push({
      id: 'timesheets-approve',
      severity: 'info',
      icon: 'file',
      title: `${zurFreigabe} Rapport${zurFreigabe > 1 ? 'e' : ''} zur Freigabe`,
      text: 'Eingereichte Stunden prüfen und freigeben, damit sie verrechnet werden können.',
      action: { label: 'Prüfen', to: '/rapporte?status=Eingereicht' },
    });
  }

  // 8. Überfällige Rechnungen
  const ueberfaellig = invoices.filter((i) => isInvoiceOverdue(i, today));
  if (ueberfaellig.length) {
    const summe = ueberfaellig.reduce((s, i) => s + i.total, 0);
    out.push({
      id: 'invoices-overdue',
      severity: 'hoch',
      icon: 'receipt',
      title: `${ueberfaellig.length} überfällige Rechnung${ueberfaellig.length > 1 ? 'en' : ''}`,
      text: `Ausstehend: CHF ${Math.round(summe).toLocaleString('de-CH')} – Zahlungserinnerung senden.`,
      action: { label: 'Rechnungen', to: '/rechnungen?status=ueberfaellig' },
    });
  }

  return out.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
