/* ============================================================
   Textvorlagen (Fallback ohne KI): Kurzprofil, Stelleninserat,
   E-Mail-Entwürfe. Schweizer Rechtschreibung (ss statt ß).
   ============================================================ */
import type { Candidate, Company, Contact, Job, Settings } from '@/types';
import { age, fmtCHF, fmtDate, fullName } from './format';

export type EmailKind = 'vorstellung' | 'einladung' | 'absage' | 'nachfassen' | 'angebot';

export const EMAIL_KINDS: { value: EmailKind; label: string }[] = [
  { value: 'vorstellung', label: 'Kandidat beim Kunden vorstellen' },
  { value: 'einladung', label: 'Einladung zum Interview (an Kandidat)' },
  { value: 'angebot', label: 'Angebot mitteilen (an Kandidat)' },
  { value: 'nachfassen', label: 'Nachfassen beim Kunden' },
  { value: 'absage', label: 'Absage (an Kandidat)' },
];

export interface GeneratedText {
  betreff: string;
  text: string;
}

/** Anonymisiertes oder namentliches Kurzprofil für Kunden */
export function kurzprofilTemplate(c: Candidate, anonym = true): string {
  const alter = age(c.geburtsdatum);
  const kopf = anonym
    ? `${c.anrede === 'Frau' ? 'Kandidatin' : c.anrede === 'Herr' ? 'Kandidat' : 'Kandidat/in'} ${c.nr}`
    : fullName(c);
  const zeilen = [
    `${kopf} – ${c.beruf || 'Fachkraft'}`,
    '',
    [
      alter ? `${alter} Jahre` : null,
      anonym ? (c.ort ? `Region ${c.plz ? c.plz[0] + 'xxx' : ''} ${c.ort}`.trim() : null) : c.ort || null,
      c.bewilligung ? `Bewilligung ${c.bewilligung}` : null,
    ].filter(Boolean).join(' · '),
    '',
    'Profil',
    `${c.erfahrungJahre ? `${c.erfahrungJahre} Jahre Berufserfahrung als ${c.beruf}` : `Fachperson im Bereich ${c.beruf}`}${c.ausbildung ? `, Ausbildung: ${c.ausbildung}` : ''}.`,
  ];
  if (c.skills.length) zeilen.push('', 'Kompetenzen', ...c.skills.slice(0, 8).map((s) => `• ${s}`));
  if (c.sprachen.length) zeilen.push('', 'Sprachen', c.sprachen.map((s) => (s.niveau ? `${s.sprache} (${s.niveau})` : s.sprache)).join(', '));
  zeilen.push(
    '',
    'Rahmenbedingungen',
    `• Verfügbar ab: ${c.verfuegbarAb ? fmtDate(c.verfuegbarAb) : 'nach Absprache'}`,
    `• Pensum: ${c.pensum || 'nach Absprache'}`,
  );
  if (c.anstellungsarten.length) zeilen.push(`• Anstellung: ${c.anstellungsarten.join(', ')}`);
  if (c.lohnvorstellung) zeilen.push(`• Lohnvorstellung: ${fmtCHF(c.lohnvorstellung)} p.a.`);
  return zeilen.join('\n');
}

/** Stelleninserat im Stil von jobs.ch */
export function inseratTemplate(job: Job, company: Company | undefined, settings: Settings): string {
  const firma = company ? `unseren Kunden, die ${company.name}` : 'einen unserer Kunden';
  const zeilen = [
    `${job.titel} (${job.pensum || '100%'})`,
    `${job.ort}${job.art ? ` · ${job.art}` : ''}`,
    '',
    `Für ${firma}${company?.branche ? ` (${company.branche})` : ''}, suchen wir per ${job.deadline ? fmtDate(job.deadline) : 'sofort oder nach Vereinbarung'} eine motivierte Persönlichkeit.`,
    '',
    'Ihre Aufgaben',
    ...(job.beschreibung ? job.beschreibung.split(/(?<=[.!?])\s+/).filter(Boolean).map((s) => `• ${s.trim()}`) : ['• Abwechslungsreiche Tätigkeit im Fachbereich']),
    '',
    'Ihr Profil',
    ...(job.skills.length ? job.skills.map((s) => `• ${s}`) : ['• Abgeschlossene Ausbildung im entsprechenden Bereich']),
    '• Zuverlässige, selbständige Arbeitsweise',
    '',
    'Das erwartet Sie',
    job.art === 'Temporär' ? '• Spannender Einsatz mit Option auf Festanstellung' : '• Unbefristete Festanstellung in einem stabilen Umfeld',
    ...(job.lohnMin || job.lohnMax ? [`• Attraktiver Lohn (${[job.lohnMin, job.lohnMax].filter(Boolean).map((v) => fmtCHF(v)).join(' – ')})`] : []),
    '• Persönliche Begleitung durch unser Team',
    '',
    `Interessiert? Wir freuen uns auf Ihre vollständigen Bewerbungsunterlagen an ${settings.email || 'unser Team'}.`,
    `${settings.firmenname}${settings.ort ? `, ${settings.ort}` : ''}`,
  ];
  return zeilen.join('\n');
}

export interface EmailContext {
  candidate?: Candidate;
  job?: Job;
  company?: Company;
  contact?: Contact;
  settings: Settings;
  absender: string;
}

function anredeKontakt(k?: Contact): string {
  if (!k) return 'Sehr geehrte Damen und Herren';
  return k.anrede === 'Frau' ? `Sehr geehrte Frau ${k.nachname}` : k.anrede === 'Herr' ? `Sehr geehrter Herr ${k.nachname}` : `Guten Tag ${k.vorname} ${k.nachname}`;
}

function anredeKandidat(c?: Candidate): string {
  if (!c) return 'Guten Tag';
  return c.anrede === 'Frau' ? `Liebe Frau ${c.nachname}` : c.anrede === 'Herr' ? `Lieber Herr ${c.nachname}` : `Guten Tag ${fullName(c)}`;
}

export function emailTemplate(kind: EmailKind, ctx: EmailContext): GeneratedText {
  const { candidate: c, job: j, company: f, contact: k, settings: s, absender } = ctx;
  const gruss = `\n\nFreundliche Grüsse\n${absender}\n${s.firmenname}${s.telefon ? `\n${s.telefon}` : ''}`;
  const stelle = j ? `«${j.titel}»` : 'die ausgeschriebene Stelle';
  switch (kind) {
    case 'vorstellung':
      return {
        betreff: `Kandidatenvorschlag: ${j?.titel ?? c?.beruf ?? 'Fachkraft'}`,
        text: `${anredeKontakt(k)}\n\nGerne stelle ich Ihnen für ${stelle} eine sehr passende Persönlichkeit vor: ${c ? `${c.beruf}${c.erfahrungJahre ? ` mit ${c.erfahrungJahre} Jahren Erfahrung` : ''}` : 'eine erfahrene Fachkraft'}${c?.skills.length ? `, mit Stärken in ${c.skills.slice(0, 3).join(', ')}` : ''}.\n\nDas ausführliche Kurzprofil finden Sie im Anhang. ${c?.verfuegbarAb ? `Die Person ist ab ${fmtDate(c.verfuegbarAb)} verfügbar.` : ''}\n\nGerne organisiere ich ein Kennenlernen – passt Ihnen ein Termin in den nächsten Tagen?${gruss}`,
      };
    case 'einladung':
      return {
        betreff: `Einladung zum Vorstellungsgespräch${f ? ` bei ${f.name}` : ''}`,
        text: `${anredeKandidat(c)}\n\nIch freue mich, Ihnen mitzuteilen, dass ${f?.name ?? 'unser Kunde'} Sie für ${stelle} gerne persönlich kennenlernen möchte.\n\nBitte teilen Sie mir mit, welche Termine Ihnen in den nächsten Tagen passen. Gerne bereite ich Sie vorgängig auf das Gespräch vor.${gruss}`,
      };
    case 'angebot':
      return {
        betreff: `Angebot für ${j?.titel ?? 'Ihre neue Stelle'}`,
        text: `${anredeKandidat(c)}\n\nGute Neuigkeiten: ${f?.name ?? 'Unser Kunde'} möchte Ihnen für ${stelle} ein Angebot unterbreiten. Gerne bespreche ich die Details telefonisch mit Ihnen.\n\nWann erreiche ich Sie am besten?${gruss}`,
      };
    case 'nachfassen':
      return {
        betreff: `Rückmeldung zu ${c ? `${c.beruf} ${c.nr}` : 'unserem Kandidatenvorschlag'}`,
        text: `${anredeKontakt(k)}\n\nIch erlaube mir, kurz nachzufragen, ob Sie bereits Gelegenheit hatten, das Profil für ${stelle} anzuschauen. Die Person ist weiterhin sehr interessiert.\n\nÜber eine kurze Rückmeldung freue ich mich.${gruss}`,
      };
    case 'absage':
      return {
        betreff: `Ihre Bewerbung${j ? ` als ${j.titel}` : ''}`,
        text: `${anredeKandidat(c)}\n\nHerzlichen Dank für Ihr Interesse und das Vertrauen. Leider hat sich ${f?.name ?? 'unser Kunde'} für ${stelle} für eine andere Person entschieden.\n\nIhr Profil bleibt gerne in unserer Kartei – sobald sich eine passende Möglichkeit ergibt, melde ich mich bei Ihnen.${gruss}`,
      };
  }
}
