/* ============================================================
   Kandidaten-Matching (lokal, ohne KI)
   Gewichtung: Skills 45 · Beruf/Titel 20 · Anstellungsart 10
              · Region 10 · Verfügbarkeit 10 · Lohn 5
   Liefert neben dem Score nachvollziehbare Begründungen.
   ============================================================ */
import type { Candidate, Job, Placement } from '@/types';
import { daysBetween, normalize, todayISO } from './format';

export interface MatchResult {
  candidateId: string;
  score: number;
  matched: string[];
  missing: string[];
  reasons: string[];
}

function skillHit(required: string, skills: string[]): boolean {
  const r = normalize(required);
  if (!r) return false;
  return skills.some((s) => {
    const n = normalize(s);
    return n === r || (n.length >= 3 && r.includes(n)) || (r.length >= 3 && n.includes(r));
  });
}

const STOPWORDS = new Set(['und', 'mit', 'der', 'die', 'das', 'fuer', 'von', 'als', 'in', 'efz', 'eba', 'hf', 'fh', 'w', 'm', 'd']);

function words(s: string): string[] {
  return normalize(s)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/** Gemeinsame Wortstämme zwischen Beruf und Stellentitel (Präfix-Vergleich ≥ 5 Zeichen) */
function titleSimilarity(beruf: string, titel: string): number {
  const a = words(beruf);
  const b = words(titel);
  if (!a.length || !b.length) return 0;
  let hits = 0;
  for (const w of a) {
    if (b.some((x) => x === w || (w.length >= 5 && x.length >= 5 && (x.startsWith(w.slice(0, 5)) || w.startsWith(x.slice(0, 5)))))) hits++;
  }
  return Math.min(1, hits / Math.min(a.length, 2));
}

export function matchCandidate(job: Job, c: Candidate, today: string = todayISO()): MatchResult {
  const reasons: string[] = [];
  let score = 0;

  // Skills (45)
  const required = job.skills ?? [];
  const matched = required.filter((s) => skillHit(s, c.skills ?? []));
  const missing = required.filter((s) => !matched.includes(s));
  if (required.length) {
    score += (matched.length / required.length) * 45;
    if (matched.length) reasons.push(`${matched.length} von ${required.length} Anforderungen erfüllt`);
  } else {
    score += 22;
  }

  // Beruf ↔ Stellentitel (20)
  const sim = titleSimilarity(c.beruf, job.titel);
  score += sim * 20;
  if (sim >= 0.5) reasons.push(`Beruf passt zur Stelle (${c.beruf})`);

  // Anstellungsart (10)
  if (!c.anstellungsarten?.length || c.anstellungsarten.includes(job.art)) {
    score += 10;
    if (c.anstellungsarten?.includes(job.art)) reasons.push(`Offen für ${job.art}`);
  }

  // Region (10): gleicher Ort, sonst gleiche PLZ-Region (erste Ziffer)
  const jobOrt = normalize(job.ort);
  if (c.ort && jobOrt.includes(normalize(c.ort))) {
    score += 10;
    reasons.push(`Wohnort ${c.ort}`);
  } else if (c.plz && /\d/.test(job.ort) && job.ort.trim()[0] === c.plz[0]) {
    score += 6;
  } else if (c.ort) {
    score += 3;
  }

  // Verfügbarkeit (10)
  const ziel = job.deadline || today;
  if (!c.verfuegbarAb || daysBetween(c.verfuegbarAb, ziel) >= 0) {
    score += 10;
    reasons.push('Rechtzeitig verfügbar');
  } else {
    const verspaetung = daysBetween(ziel, c.verfuegbarAb);
    if (verspaetung <= 30) score += 5;
  }

  // Lohn (5)
  if (job.art !== 'Temporär' && c.lohnvorstellung && (job.lohnMin || job.lohnMax)) {
    const max = job.lohnMax ?? job.lohnMin ?? 0;
    if (c.lohnvorstellung <= max * 1.05) {
      score += 5;
      reasons.push('Lohnvorstellung im Rahmen');
    }
  } else {
    score += 3;
  }

  return { candidateId: c.id, score: Math.round(Math.min(100, score)), matched, missing, reasons };
}

/**
 * Rangliste geeigneter Kandidaten für eine Vakanz.
 * Ausgeschlossen: Inaktive/Vermittelte und Kandidaten, die bereits im Prozess dieser Vakanz sind.
 */
export function rankCandidates(job: Job, candidates: Candidate[], placements: Placement[], limit = 15): MatchResult[] {
  const inProcess = new Set(placements.filter((p) => p.jobId === job.id && p.phase !== 'Absage').map((p) => p.candidateId));
  return candidates
    .filter((c) => !inProcess.has(c.id) && ['Neu', 'In Prüfung', 'Aktiv'].includes(c.status))
    .map((c) => matchCandidate(job, c))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Passende offene Vakanzen für einen Kandidaten */
export function rankJobs(c: Candidate, jobs: Job[], limit = 5): (MatchResult & { jobId: string })[] {
  return jobs
    .filter((j) => j.status === 'Offen' || j.status === 'In Bearbeitung')
    .map((j) => ({ ...matchCandidate(j, c), jobId: j.id }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function scoreTone(score: number): 'green' | 'amber' | 'gray' {
  if (score >= 70) return 'green';
  if (score >= 45) return 'amber';
  return 'gray';
}
