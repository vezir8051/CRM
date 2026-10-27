/* ============================================================
   Formatierung & Datumshilfen (Schweizer Konventionen)
   Alle Datumsfunktionen arbeiten mit lokalen Kalendertagen.
   ============================================================ */
import type { ISODate, ISODateTime } from '@/types';

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toISODateTime(d: Date): ISODateTime {
  return `${toISODate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function todayISO(): ISODate {
  return toISODate(new Date());
}

export function nowISO(): ISODateTime {
  return toISODateTime(new Date());
}

/** Parst YYYY-MM-DD als lokales Datum (nicht UTC) bzw. YYYY-MM-DDTHH:mm */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function addDays(iso: ISODate, days: number): ISODate {
  const d = parseDate(iso) ?? new Date();
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Ganze Kalendertage von a nach b (b − a) */
export function daysBetween(a: string, b: string): number {
  const da = parseDate(a);
  const db = parseDate(b);
  if (!da || !db) return 0;
  const ua = Date.UTC(da.getFullYear(), da.getMonth(), da.getDate());
  const ub = Date.UTC(db.getFullYear(), db.getMonth(), db.getDate());
  return Math.round((ub - ua) / 86_400_000);
}

/** Montag der Woche des Datums */
export function startOfWeek(iso: ISODate = todayISO()): ISODate {
  const d = parseDate(iso) ?? new Date();
  const day = (d.getDay() + 6) % 7; // Mo = 0
  d.setDate(d.getDate() - day);
  return toISODate(d);
}

/** ISO-Kalenderwoche */
export function isoWeek(iso: ISODate): number {
  const d = parseDate(iso) ?? new Date();
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

/** "KW 43 · 20.10.–26.10.2026" */
export function weekLabel(monday: ISODate): string {
  const a = parseDate(monday);
  if (!a) return '–';
  return `KW ${isoWeek(monday)} · ${pad(a.getDate())}.${pad(a.getMonth() + 1)}.–${fmtDate(addDays(monday, 6))}`;
}

export const WEEKDAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;
export const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'] as const;
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'] as const;
const WEEKDAYS_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'] as const;

/** YYYY-MM */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

/** "Oktober 2026" */
export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  if (!y || !m) return key;
  return `${MONTHS[m - 1]} ${y}`;
}

/** Letzte n Monate (älteste zuerst) als YYYY-MM */
export function lastMonths(n: number, from: ISODate = todayISO()): string[] {
  const d = parseDate(from) ?? new Date();
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${x.getFullYear()}-${pad(x.getMonth() + 1)}`);
  }
  return out;
}

/** 27.10.2026 */
export function fmtDate(value: string | null | undefined): string {
  const d = parseDate(value);
  if (!d) return '–';
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** 27.10.2026, 14:30 */
export function fmtDateTime(value: string | null | undefined): string {
  const d = parseDate(value);
  if (!d) return '–';
  const hasTime = /T\d{2}:\d{2}/.test(value ?? '');
  return hasTime ? `${fmtDate(value)}, ${pad(d.getHours())}:${pad(d.getMinutes())}` : fmtDate(value);
}

/** "Dienstag, 27. Oktober 2026" */
export function fmtLongDate(value: string = todayISO()): string {
  const d = parseDate(value);
  if (!d) return '–';
  return `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Heute / Morgen / Gestern / in 5 Tagen / vor 3 Tagen */
export function fmtRelative(value: string | null | undefined, today: ISODate = todayISO()): string {
  if (!value || !parseDate(value)) return '–';
  const diff = daysBetween(today, value.slice(0, 10));
  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Morgen';
  if (diff === -1) return 'Gestern';
  if (diff < 0) return `vor ${-diff} Tagen`;
  return `in ${diff} Tagen`;
}

/** Verfügbarkeit als Satzteil: «sofort», «morgen», «in 5 Tagen» */
export function fmtAvailability(value: string | null | undefined, today: ISODate = todayISO()): string {
  if (!value || !parseDate(value)) return 'ab sofort';
  const diff = daysBetween(today, value.slice(0, 10));
  if (diff <= 0) return 'sofort';
  if (diff === 1) return 'morgen';
  return `in ${diff} Tagen`;
}

/** Fällig und in der Vergangenheit (Datum-only → ab Folgetag überfällig) */
export function isOverdue(value: string | null | undefined, now: Date = new Date()): boolean {
  const d = parseDate(value);
  if (!d) return false;
  if (value && value.length <= 10) return daysBetween(toISODate(now), value) < 0;
  return d.getTime() < now.getTime();
}

const chfFormatter = new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 });
const chf2Formatter = new Intl.NumberFormat('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numFormatter = new Intl.NumberFormat('de-CH', { maximumFractionDigits: 2 });

/** CHF 125’000 bzw. mit Rappen: CHF 42.50 */
export function fmtCHF(value: number | null | undefined, opts: { decimals?: boolean } = {}): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '–';
  return `CHF ${(opts.decimals ? chf2Formatter : chfFormatter).format(value)}`;
}

export function fmtNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '–';
  return numFormatter.format(value);
}

/** Kompakt für Diagrammachsen: 12k, 1.2M */
export function fmtCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (Math.abs(value) >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(Math.round(value));
}

export function fmtHours(value: number): string {
  return `${numFormatter.format(value)} h`;
}

export function fmtPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '–';
  return `${value.toFixed(decimals).replace(/\.0+$/, '')} %`;
}

/** Rundung auf 5 Rappen (Schweizer Rechnungen) */
export function round05(value: number): number {
  return Math.round(value * 20) / 20;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function fullName(p: { vorname?: string; nachname?: string } | null | undefined): string {
  if (!p) return '–';
  return `${p.vorname ?? ''} ${p.nachname ?? ''}`.trim() || '–';
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

/** Alter in Jahren aus Geburtsdatum */
export function age(birth: ISODate, today: ISODate = todayISO()): number | null {
  const b = parseDate(birth);
  const t = parseDate(today);
  if (!b || !t) return null;
  let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
  return a;
}

/** Normalisiert für Suche: Kleinbuchstaben, Umlaute vereinheitlicht */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

export function websiteUrl(w: string): string {
  if (!w) return '';
  return /^https?:\/\//i.test(w) ? w : `https://${w}`;
}

export function websiteHost(w: string): string {
  return w.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
}
