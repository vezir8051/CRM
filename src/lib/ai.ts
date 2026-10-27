/* ============================================================
   KI-Client: spricht mit der Serverless-Funktion /api/ai.
   Jede Funktion fällt automatisch auf lokale Logik zurück, wenn
   keine KI verfügbar ist oder der Aufruf fehlschlägt.
   ============================================================ */
import { useEffect, useState } from 'react';
import type {
  Candidate, CandidateDraft, CandidateFilter, Company, CompanyDraft, ExtractionResult, Job,
} from '@/types';
import { CANDIDATE_IMPORT_FIELDS, emptyCandidateDraft, extractCvHeuristic, missingFields } from '@/domain/cv-heuristics';
import { COMPANY_IMPORT_FIELDS, extractCompanyHeuristic, type ScrapedSite } from '@/domain/company-heuristics';
import { heuristicQueryToFilter, emptyFilter, type SearchVocabulary } from '@/domain/search';
import { matchCandidate } from '@/domain/matching';
import type { GeneratedText } from '@/domain/templates';
import { todayISO } from '@/domain/format';
import { extractText, fileKind, MAX_STORED_TEXT, prepareForAi } from './files';

/* ---------- Konfiguration (nur im Browser gespeichert) ---------- */
const CONFIG_KEY = 'persocrm-ai';
const CONFIG_EVENT = 'persocrm-ai-config';

export const AI_MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 – beste Qualität (empfohlen)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 – ausgewogen' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 – schnell & günstig' },
] as const;
export const DEFAULT_AI_MODEL = AI_MODELS[0].id;

export interface AiConfig {
  /** Eigener Anthropic-Schlüssel (optional, wenn Server-Schlüssel gesetzt) */
  apiKey: string;
  model: string;
  /** Zugangstoken, falls der Server APP_ACCESS_TOKEN verlangt */
  appToken: string;
}

export function getAiConfig(): AiConfig {
  try {
    const raw = JSON.parse(localStorage.getItem(CONFIG_KEY) ?? '{}') as Partial<AiConfig>;
    return { apiKey: raw.apiKey ?? '', model: raw.model || DEFAULT_AI_MODEL, appToken: raw.appToken ?? '' };
  } catch {
    return { apiKey: '', model: DEFAULT_AI_MODEL, appToken: '' };
  }
}

export function setAiConfig(patch: Partial<AiConfig>) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...getAiConfig(), ...patch }));
  window.dispatchEvent(new Event(CONFIG_EVENT));
}

/* ---------- Verfügbarkeit ---------- */
export interface AiServerStatus {
  reachable: boolean;
  serverKey: boolean;
  tokenRequired: boolean;
}

let statusPromise: Promise<AiServerStatus> | null = null;

export function fetchAiStatus(force = false): Promise<AiServerStatus> {
  if (!statusPromise || force) {
    statusPromise = fetch('/api/ai', { headers: { accept: 'application/json' } })
      .then(async (r) => {
        if (!r.ok) return { reachable: false, serverKey: false, tokenRequired: false };
        const j = (await r.json()) as Partial<AiServerStatus>;
        return { reachable: true, serverKey: !!j.serverKey, tokenRequired: !!j.tokenRequired };
      })
      .catch(() => ({ reachable: false, serverKey: false, tokenRequired: false }));
  }
  return statusPromise;
}

export type AiVia = 'server' | 'eigener-schluessel' | null;

export function resolveAiVia(status: AiServerStatus, cfg: AiConfig = getAiConfig()): AiVia {
  if (!status.reachable) return null;
  if (cfg.apiKey) return 'eigener-schluessel';
  if (status.serverKey && (!status.tokenRequired || cfg.appToken)) return 'server';
  return null;
}

/** Hook: Ist KI verfügbar? Aktualisiert sich bei Änderungen in den Einstellungen. */
export function useAiAvailability() {
  const [state, setState] = useState<{ loading: boolean; status: AiServerStatus; via: AiVia }>({
    loading: true,
    status: { reachable: false, serverKey: false, tokenRequired: false },
    via: null,
  });
  useEffect(() => {
    let alive = true;
    const update = () =>
      fetchAiStatus().then((status) => alive && setState({ loading: false, status, via: resolveAiVia(status) }));
    update();
    window.addEventListener(CONFIG_EVENT, update);
    return () => {
      alive = false;
      window.removeEventListener(CONFIG_EVENT, update);
    };
  }, []);
  return { ...state, available: state.via !== null };
}

async function aiAvailable(): Promise<boolean> {
  return resolveAiVia(await fetchAiStatus()) !== null;
}

/* ---------- Aufruf ---------- */
export class AiError extends Error {
  constructor(message: string, public status = 0) {
    super(message);
  }
}

async function callAi<T>(task: string, payload: Record<string, unknown>): Promise<T> {
  const cfg = getAiConfig();
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (cfg.apiKey) headers['x-anthropic-key'] = cfg.apiKey;
  if (cfg.appToken) headers['x-app-token'] = cfg.appToken;
  let res: Response;
  try {
    res = await fetch('/api/ai', { method: 'POST', headers, body: JSON.stringify({ task, model: cfg.model, ...payload }) });
  } catch {
    throw new AiError('Die KI-Funktion ist nicht erreichbar.');
  }
  const json = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !json) throw new AiError(json?.error ?? `KI-Anfrage fehlgeschlagen (HTTP ${res.status}).`, res.status);
  return json;
}

/* ============================================================
   Lebenslauf → Kandidat
   ============================================================ */
export interface CvImportResult extends ExtractionResult<CandidateDraft> {
  /** Lokal extrahierter Text (für Volltextsuche am Dokument) */
  text: string;
}

export async function extractCandidate(input: { file?: File; text?: string }): Promise<CvImportResult> {
  const { file } = input;
  let localText = input.text?.trim() ?? '';
  let localError = '';
  if (file && !localText) {
    try {
      localText = await extractText(file);
    } catch (e) {
      localError = (e as Error).message;
    }
  }
  const stored = localText.slice(0, MAX_STORED_TEXT);

  if (await aiAvailable()) {
    try {
      const prepared = file ? await prepareForAi(file, localText) : { kind: 'text' as const, text: localText };
      const res = await callAi<{ data: CandidateDraft; uncertain: string[] }>('cv', { input: prepared, today: todayISO() });
      const data = { ...emptyCandidateDraft(), ...res.data };
      return {
        data,
        missing: missingFields(data, CANDIDATE_IMPORT_FIELDS),
        uncertain: (res.uncertain ?? []).filter((f) => !missingFields(data, [f]).length),
        source: 'ki',
        text: stored,
      };
    } catch (e) {
      if (!localText) throw e;
      return { ...extractCvHeuristic(localText), text: stored, warning: `KI nicht verfügbar (${(e as Error).message}) – lokale Erkennung verwendet.` };
    }
  }

  if (!localText) {
    if (file && fileKind(file) === 'image') throw new AiError('Bild-Lebensläufe können nur mit aktivierter KI gelesen werden (Einstellungen → KI).');
    throw new AiError(localError || 'Aus der Datei konnte kein Text gelesen werden (evtl. gescanntes PDF). Mit aktivierter KI werden auch Scans erkannt.');
  }
  return { ...extractCvHeuristic(localText), text: stored };
}

/* ============================================================
   Webseite → Unternehmen
   ============================================================ */
export async function scrapeWebsite(url: string): Promise<ScrapedSite> {
  let res: Response;
  try {
    res = await fetch(`/api/scrape?url=${encodeURIComponent(url)}`);
  } catch {
    throw new AiError('Der Webseiten-Abruf ist nicht erreichbar.', 0);
  }
  const json = (await res.json().catch(() => null)) as (ScrapedSite & { error?: string }) | null;
  if (!res.ok || !json) throw new AiError(json?.error ?? `Webseite konnte nicht geladen werden (HTTP ${res.status}).`, res.status);
  return json;
}

/** Seite aus eingefügtem Text (Fallback, wenn der Abruf nicht möglich ist) */
export function siteFromPastedText(url: string, text: string): ScrapedSite {
  const clean = text.replace(/<[^>]+>/g, ' ').replace(/[ \t]{2,}/g, ' ');
  return {
    url: /^https?:\/\//i.test(url) ? url : `https://${url}`,
    title: '', description: '', siteName: '', emails: [], phones: [], org: null, socials: {},
    pages: [{ url, text: clean }],
  };
}

export async function extractCompany(site: ScrapedSite): Promise<ExtractionResult<CompanyDraft>> {
  const local = extractCompanyHeuristic(site);
  if (!(await aiAvailable())) return local;
  try {
    const res = await callAi<{ data: CompanyDraft; uncertain: string[] }>('company', { site });
    const data: CompanyDraft = {
      ...local.data,
      ...Object.fromEntries(Object.entries(res.data).filter(([, v]) => v !== '' && v !== null && !(Array.isArray(v) && !v.length))),
      kontakte: res.data.kontakte ?? [],
    };
    return { data, missing: missingFields(data, COMPANY_IMPORT_FIELDS), uncertain: res.uncertain ?? [], source: 'ki' };
  } catch (e) {
    return { ...local, warning: `KI nicht verfügbar (${(e as Error).message}) – lokale Erkennung verwendet.` };
  }
}

/* ============================================================
   Texte generieren (Kurzprofil, Inserat, E-Mail)
   ============================================================ */
export type GenerateRequest =
  | { kind: 'kurzprofil'; candidate: Candidate; anonym: boolean }
  | { kind: 'inserat'; job: Job; company: Company | undefined; agentur: string }
  | { kind: 'email'; emailKind: string; context: Record<string, unknown> };

export async function generateText(req: GenerateRequest, fallback: () => GeneratedText): Promise<GeneratedText & { source: 'ki' | 'vorlage'; warning?: string }> {
  if (!(await aiAvailable())) return { ...fallback(), source: 'vorlage' };
  try {
    const payload =
      req.kind === 'kurzprofil'
        ? { kind: req.kind, anonym: req.anonym, candidate: compactCandidate(req.candidate, req.anonym) }
        : req.kind === 'inserat'
          ? { kind: req.kind, job: compactJob(req.job), company: req.company ? { name: req.company.name, branche: req.company.branche, ort: req.company.ort } : null, agentur: req.agentur }
          : { kind: req.kind, emailKind: req.emailKind, context: req.context };
    const res = await callAi<GeneratedText>('generate', payload);
    return { ...res, source: 'ki' };
  } catch (e) {
    return { ...fallback(), source: 'vorlage', warning: `KI nicht verfügbar (${(e as Error).message}) – Vorlage verwendet.` };
  }
}

/* ============================================================
   KI-Matching mit Begründung
   ============================================================ */
export interface AiMatch {
  candidateId: string;
  score: number;
  begruendung: string;
  staerken: string[];
  luecken: string[];
}

export async function aiRankCandidates(job: Job, candidates: Candidate[]): Promise<{ results: AiMatch[]; source: 'ki' | 'lokal'; warning?: string }> {
  const local = (): AiMatch[] =>
    candidates
      .map((c) => {
        const m = matchCandidate(job, c);
        return { candidateId: c.id, score: m.score, begruendung: m.reasons.join(' · ') || 'Geringe Übereinstimmung', staerken: m.matched, luecken: m.missing };
      })
      .sort((a, b) => b.score - a.score);
  if (!candidates.length) return { results: [], source: 'lokal' };
  if (!(await aiAvailable())) return { results: local(), source: 'lokal' };
  try {
    const res = await callAi<{ ergebnisse: AiMatch[] }>('match', {
      job: compactJob(job),
      candidates: candidates.slice(0, 25).map((c) => ({ id: c.id, ...compactCandidate(c, true) })),
    });
    const known = new Set(candidates.map((c) => c.id));
    return { results: res.ergebnisse.filter((r) => known.has(r.candidateId)).sort((a, b) => b.score - a.score), source: 'ki' };
  } catch (e) {
    return { results: local(), source: 'lokal', warning: `KI nicht verfügbar (${(e as Error).message}) – lokales Matching verwendet.` };
  }
}

/* ============================================================
   Natürlichsprachige Suche → Filter
   ============================================================ */
export async function smartSearch(query: string, vocab: SearchVocabulary): Promise<{ filter: CandidateFilter; source: 'ki' | 'lokal'; erklaerung?: string }> {
  const local = () => heuristicQueryToFilter(query, vocab);
  if (!(await aiAvailable())) return { filter: local(), source: 'lokal' };
  try {
    const res = await callAi<CandidateFilter & { erklaerung: string }>('search', {
      query,
      today: todayISO(),
      vocab: { skills: vocab.skills.slice(0, 300), orte: vocab.orte.slice(0, 200), berufe: vocab.berufe.slice(0, 200) },
    });
    const { erklaerung, ...filter } = res;
    return { filter: { ...emptyFilter(), ...filter }, source: 'ki', erklaerung };
  } catch {
    return { filter: local(), source: 'lokal' };
  }
}

/* ---------- Kompakte Darstellungen für Prompts ---------- */
function compactCandidate(c: Candidate, anonym: boolean) {
  return {
    ...(anonym ? { nr: c.nr } : { name: `${c.vorname} ${c.nachname}`, ort: c.ort }),
    anrede: c.anrede,
    region: c.plz ? `${c.plz[0]}xxx ${c.ort}` : c.ort,
    geburtsjahr: c.geburtsdatum.slice(0, 4),
    bewilligung: c.bewilligung,
    beruf: c.beruf,
    ausbildung: c.ausbildung,
    erfahrungJahre: c.erfahrungJahre,
    skills: c.skills,
    sprachen: c.sprachen,
    verfuegbarAb: c.verfuegbarAb,
    pensum: c.pensum,
    anstellungsarten: c.anstellungsarten,
    lohnvorstellung: c.lohnvorstellung,
    notizen: anonym ? '' : c.notizen.slice(0, 300),
  };
}

function compactJob(j: Job) {
  return {
    titel: j.titel, ort: j.ort, pensum: j.pensum, art: j.art, lohnMin: j.lohnMin, lohnMax: j.lohnMax,
    skills: j.skills, beschreibung: j.beschreibung.slice(0, 1500), deadline: j.deadline,
  };
}

/** Verbindungstest für die Einstellungen */
export async function testAiConnection(): Promise<{ ok: true; model: string } | { ok: false; error: string }> {
  try {
    const r = await callAi<{ ok: boolean; model: string }>('ping', {});
    return { ok: true, model: r.model };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unbekannter Fehler' };
  }
}
