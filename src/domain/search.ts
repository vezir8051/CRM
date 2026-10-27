/* ============================================================
   Kandidatensuche: Filter-Modell, URL-Serialisierung, Anwendung
   und lokale Auswertung natürlichsprachiger Suchanfragen.
   ============================================================ */
import type { Candidate, CandidateFilter, CandidateStatus, EmploymentType, Permit } from '@/types';
import { CANDIDATE_STATUS, EMPLOYMENT_TYPES, PERMITS } from '@/types';
import { addDays, normalize, todayISO } from './format';

export function emptyFilter(): CandidateFilter {
  return { q: '', skills: [], orte: [], berufe: [], status: [], bewilligungen: [], anstellungsart: '', verfuegbarBis: '', minErfahrung: null };
}

export function isFilterEmpty(f: CandidateFilter): boolean {
  return (
    !f.q && !f.skills.length && !f.orte.length && !f.berufe.length && !f.status.length &&
    !f.bewilligungen.length && !f.anstellungsart && !f.verfuegbarBis && f.minErfahrung === null
  );
}

const list = (v: string | null) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);

/** URL-Parameter → Filter (?q=&skills=a,b&orte=&berufe=&status=&bew=&art=&bis=&erf=) */
export function filterFromParams(p: URLSearchParams): CandidateFilter {
  const erf = p.get('erf');
  return {
    q: p.get('q') ?? '',
    skills: list(p.get('skills')),
    orte: list(p.get('orte')),
    berufe: list(p.get('berufe')),
    status: list(p.get('status')).filter((s): s is CandidateStatus => (CANDIDATE_STATUS as readonly string[]).includes(s)),
    bewilligungen: list(p.get('bew')).filter((s): s is Exclude<Permit, ''> => (PERMITS as readonly string[]).includes(s)),
    anstellungsart: ((EMPLOYMENT_TYPES as readonly string[]).includes(p.get('art') ?? '') ? p.get('art') : '') as EmploymentType | '',
    verfuegbarBis: /^\d{4}-\d{2}-\d{2}$/.test(p.get('bis') ?? '') ? p.get('bis')! : '',
    minErfahrung: erf && !Number.isNaN(Number(erf)) ? Number(erf) : null,
  };
}

/** Filter → URL-Parameter (leere Werte werden weggelassen) */
export function filterToParams(f: CandidateFilter): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.skills.length) p.set('skills', f.skills.join(','));
  if (f.orte.length) p.set('orte', f.orte.join(','));
  if (f.berufe.length) p.set('berufe', f.berufe.join(','));
  if (f.status.length) p.set('status', f.status.join(','));
  if (f.bewilligungen.length) p.set('bew', f.bewilligungen.join(','));
  if (f.anstellungsart) p.set('art', f.anstellungsart);
  if (f.verfuegbarBis) p.set('bis', f.verfuegbarBis);
  if (f.minErfahrung !== null) p.set('erf', String(f.minErfahrung));
  return p;
}

function containsNorm(hay: string, needle: string): boolean {
  return normalize(hay).includes(normalize(needle));
}

/** Volltext über Name, Beruf, Nr, Ort, Skills, Notizen, Tags und Lebenslauf-Text */
export function candidateMatchesText(c: Candidate, q: string): boolean {
  if (!q.trim()) return true;
  const hay = [
    c.vorname, c.nachname, c.beruf, c.nr, c.ort, c.plz, c.email, c.ausbildung, c.notizen,
    ...c.skills, ...c.tags, ...c.dokumente.map((d) => d.text ?? ''),
  ].join(' ');
  const h = normalize(hay);
  return normalize(q).split(/\s+/).filter(Boolean).every((t) => h.includes(t));
}

export function applyCandidateFilter(candidates: Candidate[], f: CandidateFilter): Candidate[] {
  return candidates.filter((c) => {
    if (!candidateMatchesText(c, f.q)) return false;
    if (f.skills.length && !f.skills.every((s) => c.skills.some((cs) => containsNorm(cs, s) || containsNorm(s, cs)))) return false;
    if (f.orte.length && !f.orte.some((o) => containsNorm(c.ort, o) || c.plz === o)) return false;
    if (f.berufe.length && !f.berufe.some((b) => containsNorm(c.beruf, b))) return false;
    if (f.status.length && !f.status.includes(c.status)) return false;
    if (f.bewilligungen.length && !f.bewilligungen.includes(c.bewilligung as Exclude<Permit, ''>)) return false;
    if (f.anstellungsart && c.anstellungsarten.length && !c.anstellungsarten.includes(f.anstellungsart)) return false;
    if (f.verfuegbarBis && (!c.verfuegbarAb || c.verfuegbarAb > f.verfuegbarBis)) return false;
    if (f.minErfahrung !== null && (c.erfahrungJahre ?? 0) < f.minErfahrung) return false;
    return true;
  });
}

export interface SearchVocabulary {
  skills: string[];
  orte: string[];
  berufe: string[];
}

export function vocabularyFrom(candidates: Candidate[]): SearchVocabulary {
  const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))];
  return {
    skills: uniq(candidates.flatMap((c) => c.skills)),
    orte: uniq(candidates.map((c) => c.ort)),
    berufe: uniq(candidates.map((c) => c.beruf)),
  };
}

/**
 * Lokale Interpretation einer Suchanfrage wie
 * «Elektriker in Winterthur ab sofort, mind. 5 Jahre Erfahrung».
 */
/** Umgangssprachliche Berufsbezeichnungen → Wortstamm der erfassten Berufe */
const JOB_SYNONYMS: [RegExp, string][] = [
  [/\belektriker(in)?\b/, 'elektroinstallateur'],
  [/\b(pfleger(in)?|krankenschwester|krankenpfleger(in)?)\b/, 'pflegefach'],
  [/\b(lagerist(in)?|staplerfahrer(in)?)\b/, 'logistiker'],
  [/\b(informatiker(in)?|it[- ]?support(er)?)\b/, 'ict-supporter'],
  [/\b(entwickler(in)?|programmierer(in)?|developer)\b/, 'softwareentwickler'],
];

export function heuristicQueryToFilter(query: string, vocab: SearchVocabulary, today: string = todayISO()): CandidateFilter {
  const f = emptyFilter();
  let rest = ` ${query} `;
  const raw = normalize(query);
  const n = [raw, ...JOB_SYNONYMS.filter(([re]) => re.test(raw)).map(([, stem]) => stem)].join(' ');

  const take = (re: RegExp) => {
    rest = rest.replace(re, ' ');
  };

  for (const s of vocab.skills) {
    if (s.length >= 2 && new RegExp(`(^|[^a-z0-9])${escapeRe(normalize(s))}([^a-z0-9]|$)`).test(n)) {
      f.skills.push(s);
      take(new RegExp(escapeRe(s), 'i'));
    }
  }
  for (const o of vocab.orte) {
    if (o && n.includes(normalize(o))) {
      f.orte.push(o);
      take(new RegExp(`(?:\\b(?:in|aus|bei|um|region)\\s+)?${escapeRe(o)}`, 'i'));
    }
  }
  for (const b of vocab.berufe) {
    const stem = normalize(b).split(/\s+/)[0];
    if (stem.length >= 5 && n.includes(stem.slice(0, Math.max(5, stem.length - 3)))) {
      f.berufe.push(stem.length > 6 ? b.split(/\s+/)[0] : b);
      take(new RegExp(escapeRe(b.split(/\s+/)[0]).slice(0, 6) + '\\S*', 'i'));
      for (const [re] of JOB_SYNONYMS) take(new RegExp(re.source, 'i'));
    }
  }

  const erf = n.match(/(?:mind(?:estens|\.)?|ab|>=?|über)\s*(\d{1,2})\s*jahre?/) ?? n.match(/(\d{1,2})\+?\s*jahre?\s*(?:berufs)?erfahrung/);
  if (erf) {
    f.minErfahrung = Number(erf[1]);
    take(/(mind(?:estens|\.)?|ab|über)?\s*\d{1,2}\+?\s*jahre?n?\s*(berufs)?(erfahrung)?/i);
  }

  if (/ab sofort|sofort verfuegbar|sofort/.test(n)) {
    f.verfuegbarBis = today;
    take(/(ab\s+)?sofort(\s+verfügbar)?/i);
  } else {
    const wochen = n.match(/(?:in|innert|innerhalb)\s*(\d{1,2})\s*wochen?/);
    const monat = /(naechsten|nächsten|kommenden)\s+monat/.test(n);
    if (wochen) f.verfuegbarBis = addDays(today, Number(wochen[1]) * 7);
    else if (monat) f.verfuegbarBis = addDays(today, 31);
  }

  if (/\btemporaer|\btemporär|\btemp\b/.test(n)) f.anstellungsart = 'Temporär';
  else if (/festanstellung|festangestellt/.test(n)) f.anstellungsart = 'Festanstellung';

  const bew = n.match(/bewilligung\s*([cblg])\b|\b([cblg])[- ]bewilligung/);
  if (bew) {
    f.bewilligungen = [((bew[1] || bew[2]) as string).toUpperCase() as Exclude<Permit, ''>];
    take(/(?:\b[cblg][- ])?bewilligung(?:\s*[cblg]\b)?/i);
  }

  // Übrig gebliebene, bedeutungstragende Wörter als Volltext
  const leftovers = rest
    .replace(/\b(in|aus|bei|mit|und|oder|ab|der|die|das|alle|zeige|zeig|suche|finde|kandidaten?|personen?|leute|verfügbar|verfuegbar|erfahrung|jahre?n?|mind\.?|mindestens|region|wochen?|nächsten|naechsten|monat|innert|innerhalb|temporär|temporaer|festanstellung)\b/gi, ' ')
    .replace(/[,.;:!?]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
  if (!f.skills.length && !f.berufe.length && leftovers.length) f.q = leftovers.join(' ');

  return f;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Kurzbeschreibung eines Filters für Chips/Überschriften */
export function describeFilter(f: CandidateFilter): string[] {
  const out: string[] = [];
  if (f.q) out.push(`«${f.q}»`);
  if (f.berufe.length) out.push(`Beruf: ${f.berufe.join(', ')}`);
  if (f.skills.length) out.push(`Skills: ${f.skills.join(', ')}`);
  if (f.orte.length) out.push(`Ort: ${f.orte.join(', ')}`);
  if (f.status.length) out.push(`Status: ${f.status.join(', ')}`);
  if (f.bewilligungen.length) out.push(`Bewilligung: ${f.bewilligungen.join(', ')}`);
  if (f.anstellungsart) out.push(f.anstellungsart);
  if (f.verfuegbarBis) out.push(`verfügbar bis ${f.verfuegbarBis.split('-').reverse().join('.')}`);
  if (f.minErfahrung !== null) out.push(`≥ ${f.minErfahrung} Jahre Erfahrung`);
  return out;
}
