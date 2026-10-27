/* ============================================================
   Tarifrechner Personalverleih
   Grundlohn → Bruttolohn (inkl. Ferien, Feiertage, 13. ML)
   → Lohnkosten (inkl. Arbeitgeber-Sozialabgaben, GAV, Verwaltung)
   → Verrechnungssatz bei Zielmarge (Marge vom Verrechnungssatz).
   Alle Sätze sind Richtwerte und in den Einstellungen anpassbar.
   ============================================================ */
import type { TariffRates } from '@/types';
import { round05, round2 } from './format';

export const DEFAULT_TARIFF_RATES: TariffRates = {
  ferien: 8.33, // 4 Wochen (10.64 % bei 5 Wochen)
  feiertage: 3.2,
  dreizehnter: 8.33,
  ahv: 5.3, // AHV/IV/EO Arbeitgeberanteil
  alv: 1.1,
  fak: 1.6,
  uvg: 3.0, // Berufsunfall, branchenabhängig
  ktg: 1.0,
  bvg: 3.5,
  gav: 0.7, // Vollzugs-/Weiterbildungsbeitrag GAV Personalverleih
  verwaltung: 2.0,
  zielmarge: 18,
};

export interface TariffLine {
  key: string;
  label: string;
  satz: number | null;
  betrag: number;
}

export interface TariffResult {
  grundlohn: number;
  bruttolohn: number;
  sozialabgaben: number;
  lohnkosten: number;
  verrechnungssatz: number;
  deckungsbeitrag: number;
  /** Marge in % vom Verrechnungssatz */
  margeProzent: number;
  zeilen: TariffLine[];
}

const SOCIAL_KEYS = [
  ['ahv', 'AHV/IV/EO (AG)'],
  ['alv', 'ALV (AG)'],
  ['fak', 'Familienausgleichskasse'],
  ['uvg', 'UVG Berufsunfall'],
  ['ktg', 'Krankentaggeld (AG)'],
  ['bvg', 'BVG Pensionskasse (AG)'],
  ['gav', 'GAV Personalverleih'],
] as const;

/** Lohnkosten pro Stunde für einen Grundlohn */
export function calcLohnkosten(grundlohn: number, r: TariffRates): Omit<TariffResult, 'verrechnungssatz' | 'deckungsbeitrag' | 'margeProzent'> {
  const g = Math.max(0, grundlohn || 0);
  const ferien = g * (r.ferien / 100);
  const feiertage = g * (r.feiertage / 100);
  const basis13 = g + ferien + feiertage;
  const dreizehnter = basis13 * (r.dreizehnter / 100);
  const bruttolohn = basis13 + dreizehnter;

  const zeilen: TariffLine[] = [
    { key: 'grundlohn', label: 'Grundlohn', satz: null, betrag: g },
    { key: 'ferien', label: 'Ferienentschädigung', satz: r.ferien, betrag: ferien },
    { key: 'feiertage', label: 'Feiertagsentschädigung', satz: r.feiertage, betrag: feiertage },
    { key: 'dreizehnter', label: '13. Monatslohn', satz: r.dreizehnter, betrag: dreizehnter },
  ];

  let sozialabgaben = 0;
  for (const [key, label] of SOCIAL_KEYS) {
    const satz = r[key];
    const betrag = bruttolohn * (satz / 100);
    sozialabgaben += betrag;
    zeilen.push({ key, label, satz, betrag });
  }
  const verwaltung = bruttolohn * (r.verwaltung / 100);
  zeilen.push({ key: 'verwaltung', label: 'Verwaltungskosten', satz: r.verwaltung, betrag: verwaltung });

  return {
    grundlohn: g,
    bruttolohn: round2(bruttolohn),
    sozialabgaben: round2(sozialabgaben),
    lohnkosten: round2(bruttolohn + sozialabgaben + verwaltung),
    zeilen: zeilen.map((z) => ({ ...z, betrag: round2(z.betrag) })),
  };
}

/** Verrechnungssatz für eine Zielmarge (Standard: aus den Sätzen) – auf 5 Rappen gerundet */
export function calcTariff(grundlohn: number, r: TariffRates, zielmarge: number = r.zielmarge): TariffResult {
  const base = calcLohnkosten(grundlohn, r);
  const m = Math.min(Math.max(zielmarge, 0), 95) / 100;
  const verrechnungssatz = base.lohnkosten > 0 ? round05(base.lohnkosten / (1 - m)) : 0;
  return finish(base, verrechnungssatz);
}

/** Marge für einen vorgegebenen Verrechnungssatz */
export function calcMargin(grundlohn: number, tarif: number, r: TariffRates): TariffResult {
  return finish(calcLohnkosten(grundlohn, r), tarif);
}

function finish(base: ReturnType<typeof calcLohnkosten>, verrechnungssatz: number): TariffResult {
  const db = verrechnungssatz - base.lohnkosten;
  return {
    ...base,
    verrechnungssatz: round2(verrechnungssatz),
    deckungsbeitrag: round2(db),
    margeProzent: verrechnungssatz > 0 ? round2((db / verrechnungssatz) * 100) : 0,
  };
}

/** Bewertung der Marge für die Farbanzeige */
export function marginTone(margeProzent: number): 'red' | 'amber' | 'green' {
  if (margeProzent < 10) return 'red';
  if (margeProzent < 16) return 'amber';
  return 'green';
}
