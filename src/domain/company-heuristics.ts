/* ============================================================
   Lokale Auswertung einer abgerufenen Firmen-Webseite (ohne KI)
   Priorität: schema.org JSON-LD → Kontaktseiten-Text → Meta-Daten
   ============================================================ */
import type { CompanyDraft, ExtractionResult } from '@/types';
import { extractPhone, missingFields } from './cv-heuristics';
import { websiteHost } from './format';

/** Antwort von /api/scrape */
export interface ScrapedSite {
  url: string;
  title: string;
  description: string;
  siteName: string;
  emails: string[];
  phones: string[];
  org: {
    name?: string;
    telephone?: string;
    email?: string;
    streetAddress?: string;
    postalCode?: string;
    addressLocality?: string;
    description?: string;
  } | null;
  socials: { linkedin?: string };
  pages: { url: string; text: string }[];
}

export const COMPANY_IMPORT_FIELDS = ['name', 'branche', 'strasse', 'plz', 'ort', 'telefon', 'email', 'website'] as const;

const BRANCHEN: [RegExp, string][] = [
  [/software|informatik|\bit[- ]|cloud|digital|saas/i, 'Informatik / Software'],
  [/spital|klinik|pflege|praxis|gesundheit|spitex/i, 'Gesundheitswesen'],
  [/treuhand|revision|buchhaltung|steuer/i, 'Treuhand / Revision'],
  [/logistik|transport|spedition|lager/i, 'Logistik / Transport'],
  [/bau|hochbau|tiefbau|architektur|immobilien/i, 'Bauwesen'],
  [/elektro|photovoltaik|solar|installation/i, 'Elektroinstallation'],
  [/restaurant|hotel|gastro|catering/i, 'Gastronomie / Hotellerie'],
  [/bank|versicherung|finanz|vermögen/i, 'Finanzdienstleistungen'],
  [/maschinen|mechanik|fertigung|produktion|industrie/i, 'Industrie / Produktion'],
  [/detailhandel|shop|verkauf|retail/i, 'Handel'],
];

function stripTitle(t: string): string {
  return t.split(/\s+[|–\-•:]\s+/)[0].trim();
}

export function extractCompanyHeuristic(site: ScrapedSite): ExtractionResult<CompanyDraft> {
  const text = site.pages.map((p) => p.text).join('\n');
  const org = site.org ?? {};
  const host = websiteHost(site.url);

  const d: CompanyDraft = {
    name: '', branche: '', strasse: '', plz: '', ort: '', telefon: '', email: '', website: host, notizen: '', kontakte: [],
  };

  // Name
  let name = org.name || site.siteName || stripTitle(site.title);
  const rechtsform = text.match(/^\s*([A-ZÄÖÜ0-9][^\n]{1,60}?\s(?:AG|GmbH|SA|Sàrl|KLG|Genossenschaft))\s*$/m);
  if (rechtsform && (!name || rechtsform[1].toLowerCase().includes(name.toLowerCase()))) name = rechtsform[1].trim();
  if (!name) name = host.replace(/^www\./, '').split('.')[0];
  d.name = name.slice(0, 80);

  // Kontakt
  d.email = org.email || site.emails.find((e) => /^(info|kontakt|contact|office|hallo|hello|mail)@/i.test(e)) || site.emails[0] || '';
  d.telefon = (org.telephone && extractPhone(org.telephone)) || (site.phones[0] && extractPhone(site.phones[0])) || extractPhone(text);

  // Adresse
  if (org.streetAddress) d.strasse = org.streetAddress;
  if (org.postalCode) d.plz = org.postalCode;
  if (org.addressLocality) d.ort = org.addressLocality;
  if (!d.strasse) {
    const str = text.match(/\b([A-ZÄÖÜ][a-zäöüéè.-]*(?:strasse|straße|str\.|weg|gasse|platz|allee|ring)\s*\d+[a-z]?)\b/i);
    if (str) d.strasse = str[1].trim();
  }
  if (!d.plz) {
    const plzOrt = text.match(/\b(?:CH-)?([1-9]\d{3})\s+([A-ZÄÖÜ][A-Za-zäöüéèâ.-]+(?:\s[A-ZÄÖÜ][A-Za-zäöüéèâ.-]+)?)/);
    if (plzOrt) {
      d.plz = plzOrt[1];
      d.ort = plzOrt[2].trim();
    }
  }

  // Branche (Schlüsselwörter in Titel/Beschreibung)
  const probe = `${site.title} ${site.description} ${org.description ?? ''}`;
  d.branche = BRANCHEN.find(([re]) => re.test(probe))?.[1] ?? '';

  d.notizen = (org.description || site.description || '').slice(0, 400);
  if (site.socials.linkedin) d.notizen = `${d.notizen}${d.notizen ? '\n' : ''}LinkedIn: ${site.socials.linkedin}`;

  return {
    data: d,
    missing: missingFields(d, COMPANY_IMPORT_FIELDS),
    uncertain: d.branche ? ['branche'] : [],
    source: 'heuristik',
  };
}
