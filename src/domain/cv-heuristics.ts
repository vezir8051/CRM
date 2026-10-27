/* ============================================================
   Lokale Lebenslauf-Auswertung (ohne KI)
   Erkennt Kontaktdaten, Adresse, Geburtsdatum, Beruf, Ausbildung,
   Skills, Sprachen, Pensum, Lohn, Bewilligung und Verfügbarkeit.
   ============================================================ */
import type { CandidateDraft, EmploymentType, ExtractionResult, Language, Permit, Salutation } from '@/types';
import { normalize, todayISO } from './format';

export const SKILL_VOCABULARY = [
  'JavaScript', 'TypeScript', 'React', 'Angular', 'Vue', 'Node.js', 'Python', 'Java', 'C#', '.NET', 'PHP', 'SQL',
  'Docker', 'Kubernetes', 'AWS', 'Azure', 'Power BI', 'Tableau', 'Excel', 'SAP', 'SAP HCM', 'SAP WM', 'SAP FI', 'Abacus',
  'Bexio', 'Projektmanagement', 'Projektleitung', 'Scrum', 'Bauleitung', 'Finanzbuchhaltung', 'Lohnbuchhaltung',
  'Jahresabschluss', 'MWST-Abrechnung', 'Treuhand', 'Steuererklärungen', 'Revision', 'Debitoren', 'Kreditoren',
  'Rekrutierung', 'Personaladministration', 'Sozialversicherungen', 'Arbeitsrecht', 'Digital Marketing', 'SEO', 'SEA',
  'Content Marketing', 'Google Analytics', 'Social Media', 'Key Account Management', 'B2B-Vertrieb', 'Verhandlungsführung',
  'CRM-Systeme', 'Elektroinstallation', 'Photovoltaik', 'NIN-Kenntnisse', 'CNC-Fräsen', 'CNC-Drehen', 'CAD/CAM', 'AutoCAD',
  'Qualitätskontrolle', 'Lagerbewirtschaftung', 'Staplerausweis', 'Kommissionierung', 'Zolldeklaration', 'Akutpflege',
  'Notfallpflege', 'BLS-AED', 'Wunddokumentation', 'HACCP', 'Menüplanung', 'Bankett', 'Hydraulik', 'Pneumatik',
  'Elektrotechnik', 'Wartung & Instandhaltung', 'Kundendienst', '1st/2nd Level Support', 'Microsoft 365', 'Active Directory',
  'Windows Server', 'ITIL', 'MS Office', 'MS Project', 'Statistik', 'Machine Learning', 'Kostenkontrolle', 'SIA-Normen',
  'Offertwesen', 'Korrespondenz', 'Administration', 'Empfang', 'Schweissen', 'MIG/MAG', 'WIG', 'Montage', 'Sanitär',
  'Heizung', 'Lüftung', 'Kältetechnik', 'Maurer', 'Schalungsbau', 'Gerüstbau', 'Malerarbeiten', 'Gipserarbeiten',
  'Führerschein B', 'Führerschein C', 'Kranführer', 'Reinigung', 'Pflege', 'Spitex', 'Kinderbetreuung',
] as const;

const BERUF_PATTERN =
  /(entwickler|ingenieur|kauffrau|kaufmann|leiter|manager|fachfrau|fachmann|monteur|installateur|techniker|berater|analyst|pflegefach|koch\b|köchin|logistiker|mechaniker|informatiker|buchhalter|sachbearbeiter|supporter|architekt|designer|spezialist|assistent|controller|treuhänder|polier|bauführer|elektriker|maurer|schreiner|zimmermann|maler|gipser|sanitär|heizungs|schweisser|chauffeur|lagerist|verkäufer|consultant|engineer|developer)/i;

const LANGUAGES = ['Deutsch', 'Englisch', 'Französisch', 'Italienisch', 'Spanisch', 'Portugiesisch', 'Rätoromanisch', 'Albanisch', 'Serbisch', 'Kroatisch', 'Türkisch', 'Polnisch'];
const LEVEL_PATTERN = '(muttersprache|c2|c1|b2|b1|a2|a1|fliessend|fließend|verhandlungssicher|sehr gut|gut|grundkenntnisse)';

export const CANDIDATE_IMPORT_FIELDS = [
  'anrede', 'vorname', 'nachname', 'geburtsdatum', 'email', 'telefon', 'strasse', 'plz', 'ort', 'nationalitaet', 'bewilligung',
  'beruf', 'ausbildung', 'erfahrungJahre', 'skills', 'sprachen', 'verfuegbarAb', 'pensum',
] as const;

export function emptyCandidateDraft(): CandidateDraft {
  return {
    anrede: '', vorname: '', nachname: '', geburtsdatum: '', email: '', telefon: '', strasse: '', plz: '', ort: '',
    nationalitaet: '', bewilligung: '', beruf: '', ausbildung: '', erfahrungJahre: null, skills: [], sprachen: [],
    verfuegbarAb: '', pensum: '', anstellungsarten: [], lohnvorstellung: null, stundenlohn: null, kurzprofil: '',
  };
}

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'number') return false;
  return String(v).trim() === '';
}

/** Liste der nicht befüllten Import-Felder */
export function missingFields<T extends object>(data: T, fields: readonly string[]): string[] {
  return fields.filter((f) => isEmpty((data as Record<string, unknown>)[f]));
}

function toISO(d: number, m: number, y: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function extractEmail(text: string): string {
  const m = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return m ? m[0] : '';
}

/** Schweizer Telefonnummer, normalisiert auf +41 XX XXX XX XX */
export function extractPhone(text: string): string {
  const m = text.match(/(?:\+41|0041|\b0)[\s./-]?\(?0?\)?\s?([1-9]\d)[\s./-]?(\d{3})[\s./-]?(\d{2})[\s./-]?(\d{2})\b/);
  if (!m) return '';
  return `+41 ${m[1]} ${m[2]} ${m[3]} ${m[4]}`;
}

export function extractCvHeuristic(raw: string, today: string = todayISO()): ExtractionResult<CandidateDraft> {
  const text = raw.replace(/\r/g, '');
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const d = emptyCandidateDraft();
  const uncertain: string[] = [];

  d.email = extractEmail(text);
  d.telefon = extractPhone(text);

  // Geburtsdatum (mit Label bevorzugt, sonst plausibles Datum 1940–2010)
  const gebLabel = text.match(/(?:geburtsdatum|geboren(?:\s+am)?|geb\.|jahrgang)[^\d]{0,15}(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})/i);
  const gebFrei = text.match(/\b(\d{1,2})\.(\d{1,2})\.(19[4-9]\d|200\d|2010)\b/);
  const geb = gebLabel ?? gebFrei;
  if (geb) {
    const [t, mo, y] = [Number(geb[1]), Number(geb[2]), Number(geb[3])];
    if (y >= 1940 && y <= 2012 && mo >= 1 && mo <= 12 && t >= 1 && t <= 31) {
      d.geburtsdatum = toISO(t, mo, y);
      if (!gebLabel) uncertain.push('geburtsdatum');
    }
  }

  // Adresse
  // Zeilengebunden ([ \t] statt \s), damit kein Name aus der Vorzeile mitkommt
  const str = text.match(/\b([A-ZÄÖÜ][a-zäöüéè.-]*(?:[ \t][a-zäöüéè.-]+)*(?:strasse|straße|str\.|weg|gasse|platz|allee|ring|rain|halde|matt|acker)[ \t]*\d+[a-z]?)\b/i);
  if (str) d.strasse = str[1].trim();
  const plzOrt = text.match(/\b(?:CH-)?([1-9]\d{3})\s+([A-ZÄÖÜ][A-Za-zäöüéèâ.-]+(?:\s(?:[A-ZÄÖÜ][A-Za-zäöüéèâ.-]+|am|an|bei|im)){0,2})/);
  if (plzOrt) {
    d.plz = plzOrt[1];
    d.ort = plzOrt[2].replace(/\s+(Tel|Telefon|E-Mail|Mobile|Natel).*$/i, '').trim();
  }

  // Name: Label oder erste Zeile mit 2–3 grossgeschriebenen Wörtern
  const nameLabel = text.match(/\b(?:name|vorname\s*\/\s*name)\s*[:\-]\s*([A-ZÄÖÜ][^\n,;|]{2,50})/i);
  let nameLine = nameLabel ? nameLabel[1].trim() : '';
  if (!nameLine) {
    for (const l of lines.slice(0, 8)) {
      if (/lebenslauf|curriculum|vitae|bewerbung|\bcv\b|profil|kontakt|persönlich/i.test(l)) continue;
      const w = l.split(/\s+/);
      if (w.length >= 2 && w.length <= 3 && w.every((x) => /^[A-ZÄÖÜ][a-zäöüéèëï'-]+$/.test(x)) && !BERUF_PATTERN.test(l)) {
        nameLine = l;
        break;
      }
    }
  }
  if (nameLine) {
    const w = nameLine.split(/\s+/);
    d.vorname = w[0];
    d.nachname = w.slice(1).join(' ');
  }

  // Anrede aus Kontext (unsicher)
  if (/\b(herr|mr\.?)\b/i.test(text.slice(0, 400))) d.anrede = 'Herr';
  else if (/\b(frau|mrs\.?|ms\.?)\b/i.test(text.slice(0, 400))) d.anrede = 'Frau';
  else if (/\b\w+(?:in|frau)\s+(?:EFZ|HF|FH)\b/.test(text) || /\b(managerin|leiterin|beraterin|analystin|fachfrau|kauffrau|köchin)\b/i.test(text)) {
    d.anrede = 'Frau' as Salutation;
    uncertain.push('anrede');
  }

  // Beruf
  const berufLabel = text.match(/\b(?:beruf|position|funktion|aktuelle\s+stelle|tätigkeit)\s*[:\-]\s*([^\n]{3,60})/i);
  if (berufLabel) d.beruf = berufLabel[1].trim();
  if (!d.beruf) {
    const l = lines.find((x) => x.length < 70 && BERUF_PATTERN.test(x) && !/erfahrung|kenntnisse|ausbildung|@/i.test(x));
    if (l) {
      d.beruf = l.replace(/^[-•*\d.\s–]+/, '').replace(/^\d{4}\s*[–-]\s*(\d{4}|heute)?\s*/i, '').trim();
      uncertain.push('beruf');
    }
  }

  // Ausbildung
  const ausb = lines.find((l) => /\b(EFZ|EBA|HF|FH|BSc|MSc|BA|MA|Bachelor|Master|Diplom|Fachausweis|eidg\.|Matura|Lehre als|Dr\.)\b/.test(l));
  if (ausb) {
    d.ausbildung = ausb
      .replace(/^(ausbildung|abschluss|bildung)\s*[:\-]\s*/i, '')
      .replace(/^\d{4}\s*[–-]\s*(\d{4})?\s*/, '')
      .trim()
      .slice(0, 100);
  }

  // Berufserfahrung
  const erf = text.match(/(\d{1,2})\+?\s*Jahre?n?\s*(?:Berufs|Arbeits)?erfahrung/i);
  if (erf) d.erfahrungJahre = Number(erf[1]);
  else {
    const jahre = [...text.matchAll(/\b(19[89]\d|20[0-2]\d)\s*[–-]\s*(?:(19[89]\d|20[0-2]\d)|heute|jetzt|dato)/gi)].map((m) => Number(m[1]));
    if (jahre.length) {
      d.erfahrungJahre = Math.max(0, Number(today.slice(0, 4)) - Math.min(...jahre));
      uncertain.push('erfahrungJahre');
    }
  }

  // Lohn (Jahreslohn) und Stundenlohn
  const lohn = text.match(/(?:lohn|gehalt|salär)[^\n]{0,30}?(?:CHF|Fr\.)\s?([\d'’.]{4,9})/i) ?? text.match(/(?:CHF|Fr\.)\s?([\d'’]{5,9})/);
  if (lohn) {
    const n = Number(lohn[1].replace(/['’.]/g, ''));
    if (n >= 20_000 && n <= 500_000) d.lohnvorstellung = n;
  }
  const std = text.match(/(?:CHF|Fr\.)\s?(\d{2,3}(?:[.,]\d{1,2})?)\s*(?:\/\s*h|pro\s+stunde|\/std)/i);
  if (std) d.stundenlohn = Number(std[1].replace(',', '.'));

  // Pensum
  const pensum = text.match(/\b(\d{2,3})\s?(?:[-–]|bis)\s?(\d{2,3})\s?%|\b(\d{2,3})\s?%\s*(?:pensum|arbeitspensum)?/i);
  if (pensum) d.pensum = pensum[1] ? `${pensum[1]}-${pensum[2]}%` : `${pensum[3]}%`;

  // Verfügbarkeit
  if (/\b(ab sofort|sofort verfügbar|per sofort)\b/i.test(text)) d.verfuegbarAb = today;
  else {
    const verf = text.match(/(?:verfügbar|eintritt|kündigungsfrist)[^\n]{0,25}?(\d{1,2})\.(\d{1,2})\.(\d{4})/i);
    if (verf) d.verfuegbarAb = toISO(Number(verf[1]), Number(verf[2]), Number(verf[3]));
  }

  // Bewilligung / Nationalität
  const bew = text.match(/(?:bewilligung|ausweis|permit)\s*[:\-]?\s*([CBLG])\b/i);
  if (bew) d.bewilligung = bew[1].toUpperCase() as Permit;
  const nat = text.match(/(?:nationalität|staatsangehörigkeit|nationality)\s*[:\-]\s*([A-Za-zÄÖÜäöü\s/-]{3,30})/i);
  if (nat) {
    d.nationalitaet = nat[1].trim().split('\n')[0];
    if (!d.bewilligung && /schweiz|swiss|ch\b/i.test(d.nationalitaet)) d.bewilligung = 'CH';
  }

  // Anstellungsart
  const arten: EmploymentType[] = [];
  if (/festanstellung|unbefristet/i.test(text)) arten.push('Festanstellung');
  if (/temporär|temporaer|temp\b/i.test(text)) arten.push('Temporär');
  d.anstellungsarten = arten;

  // Skills (Vokabular)
  const n = normalize(text);
  d.skills = SKILL_VOCABULARY.filter((s) => n.includes(normalize(s))).slice(0, 12);

  // Sprachen
  const sprachen: Language[] = [];
  for (const sp of LANGUAGES) {
    const m = text.match(new RegExp(`${sp}[^\\n]{0,40}?${LEVEL_PATTERN}`, 'i'));
    if (m) {
      let niveau = m[1].toLowerCase();
      niveau = /^[abc][12]$/.test(niveau) ? niveau.toUpperCase() : niveau.charAt(0).toUpperCase() + niveau.slice(1);
      sprachen.push({ sprache: sp, niveau });
    } else if (new RegExp(`\\b${sp}\\b`, 'i').test(text) && /sprach/i.test(text)) {
      sprachen.push({ sprache: sp, niveau: '' });
    }
  }
  d.sprachen = sprachen;

  return {
    data: d,
    missing: missingFields(d, CANDIDATE_IMPORT_FIELDS),
    uncertain: uncertain.filter((f) => !isEmpty((d as unknown as Record<string, unknown>)[f])),
    source: 'heuristik',
  };
}
