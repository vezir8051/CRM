/* ============================================================
   Darstellungs-Konstanten: Farbtöne für Status-Werte etc.
   ============================================================ */
import type { ActivityType, Phase } from '@/types';

export type Tone = 'gray' | 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'cyan' | 'indigo';

/** Farbton je Status-/Kategorie-Wert (für <StatusBadge>) */
export const STATUS_TONES: Record<string, Tone> = {
  // Kandidaten
  Neu: 'blue',
  'In Prüfung': 'amber',
  Aktiv: 'green',
  'Im Einsatz': 'cyan',
  Vermittelt: 'purple',
  Inaktiv: 'gray',
  // Unternehmen
  Interessent: 'cyan',
  // Vakanzen
  Offen: 'blue',
  'In Bearbeitung': 'amber',
  Besetzt: 'green',
  'On Hold': 'gray',
  Storniert: 'red',
  // Pipeline
  Vorgeschlagen: 'blue',
  Interview: 'amber',
  Angebot: 'purple',
  Absage: 'red',
  // Prioritäten
  Hoch: 'red',
  Mittel: 'amber',
  Niedrig: 'gray',
  // Anstellungsarten
  Festanstellung: 'indigo',
  Temporär: 'cyan',
  'Try & Hire': 'purple',
  // Einsätze
  Geplant: 'blue',
  Beendet: 'gray',
  // Rapporte
  Eingereicht: 'amber',
  Freigegeben: 'green',
  Verrechnet: 'purple',
  // Rechnungen
  Bezahlt: 'green',
  Verleih: 'cyan',
  Honorar: 'indigo',
  // Aktivitäten
  Anruf: 'blue',
  'E-Mail': 'cyan',
  Termin: 'purple',
  Aufgabe: 'amber',
  Notiz: 'gray',
  // Bewilligungen
  CH: 'green',
  C: 'green',
  B: 'blue',
  L: 'amber',
  G: 'cyan',
  Andere: 'gray',
  // Rollen
  admin: 'purple',
  berater: 'blue',
};

export function toneOf(value: string | null | undefined): Tone {
  return (value && STATUS_TONES[value]) || 'gray';
}

/** Hex-Farben für Diagramme (validierte Palette, Reihenfolge fix) */
export const CHART_COLORS = ['#2563eb', '#d97706', '#16a34a', '#7c3aed', '#0891b2', '#dc2626'] as const;

export const TONE_HEX: Record<Tone, string> = {
  blue: '#2563eb',
  green: '#16a34a',
  amber: '#d97706',
  red: '#dc2626',
  purple: '#7c3aed',
  cyan: '#0891b2',
  indigo: '#4f46e5',
  gray: '#94a3b8',
};

export const PHASE_COLORS: Record<Phase, string> = {
  Vorgeschlagen: TONE_HEX.blue,
  Interview: TONE_HEX.amber,
  Angebot: TONE_HEX.purple,
  Vermittelt: TONE_HEX.green,
  Absage: TONE_HEX.red,
};

export const ROLE_LABELS: Record<string, string> = { admin: 'Administrator', berater: 'Berater/in' };

export const PERMIT_LABELS: Record<string, string> = {
  CH: 'Schweizer/in',
  C: 'C – Niederlassung',
  B: 'B – Aufenthalt',
  L: 'L – Kurzaufenthalt',
  G: 'G – Grenzgänger/in',
  Andere: 'Andere / in Abklärung',
};

export const ACTIVITY_ICONS: Record<ActivityType, string> = {
  Anruf: 'phone',
  'E-Mail': 'mail',
  Termin: 'calendar',
  Aufgabe: 'check-square',
  Notiz: 'sticky-note',
};

/** Gängige Sprachniveaus für Auswahlfelder */
export const LANGUAGE_LEVELS = ['Muttersprache', 'C2', 'C1', 'B2', 'B1', 'A2', 'A1'] as const;
export const COMMON_LANGUAGES = ['Deutsch', 'Französisch', 'Italienisch', 'Englisch', 'Rätoromanisch', 'Spanisch', 'Portugiesisch', 'Albanisch', 'Serbisch', 'Kroatisch', 'Türkisch'] as const;
