import { isQrIban, isValidIban, qrBillPayload, splitStreet } from './qrbill';
import type { Invoice } from '@/types';
import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, fmtCHF, fmtDate, fmtRelative, isoWeek, round05, startOfWeek, weekLabel } from './format';
import { calcMargin, calcTariff, DEFAULT_TARIFF_RATES } from './tarif';
import { billableGroups, invoiceTotals, suggestHonorar, timesheetHours } from './billing';
import { matchCandidate, rankCandidates } from './matching';
import { extractCvHeuristic, extractPhone } from './cv-heuristics';
import { extractCompanyHeuristic, type ScrapedSite } from './company-heuristics';
import { applyCandidateFilter, emptyFilter, filterFromParams, filterToParams, heuristicQueryToFilter, vocabularyFrom } from './search';
import { computeInsights } from './insights';
import { createSeed } from '@/data/seed';
import { activeAssignmentsAt, activePlacementsAt, percentChange, revenueMonthToDate } from './reports';

const TODAY = '2026-10-27'; // Dienstag

describe('format', () => {
  it('rechnet mit lokalen Kalendertagen', () => {
    expect(addDays('2026-10-27', 5)).toBe('2026-11-01');
    expect(daysBetween('2026-10-27', '2026-11-03')).toBe(7);
    expect(startOfWeek('2026-10-27')).toBe('2026-10-26');
    expect(startOfWeek('2026-11-01')).toBe('2026-10-26');
    expect(isoWeek('2026-10-26')).toBe(44);
    expect(weekLabel('2026-10-26')).toBe('KW 44 · 26.10.–01.11.2026');
  });
  it('formatiert Schweizer Werte', () => {
    expect(fmtDate('2026-03-05')).toBe('05.03.2026');
    expect(fmtCHF(125000)).toMatch(/^CHF 125.000$/);
    expect(round05(10.03)).toBe(10.05);
    expect(round05(10.02)).toBe(10);
    expect(fmtRelative('2026-10-28', TODAY)).toBe('Morgen');
    expect(fmtRelative('2026-10-24', TODAY)).toBe('vor 3 Tagen');
  });
});

describe('Tarifrechner', () => {
  it('berechnet Lohnkosten und Verrechnungssatz bei Zielmarge', () => {
    const r = calcTariff(30, DEFAULT_TARIFF_RATES, 20);
    expect(r.bruttolohn).toBeGreaterThan(30 * 1.19);
    expect(r.lohnkosten).toBeGreaterThan(r.bruttolohn);
    expect(r.margeProzent).toBeGreaterThan(19.5);
    expect(r.margeProzent).toBeLessThan(20.5);
    expect(Math.round(r.verrechnungssatz * 20)).toBe(r.verrechnungssatz * 20); // 5-Rappen-Rundung
  });
  it('berechnet Marge für vorgegebenen Tarif', () => {
    const m = calcMargin(36, 58.5, DEFAULT_TARIFF_RATES);
    expect(m.deckungsbeitrag).toBeCloseTo(58.5 - m.lohnkosten, 2);
    expect(m.margeProzent).toBeGreaterThan(5);
  });
});

describe('Abrechnung', () => {
  it('summiert Stunden und MWST mit Rappenrundung', () => {
    expect(timesheetHours({ stunden: [8.5, 8.5, 8, 8, 8, 0, 0] })).toBe(41);
    const t = invoiceTotals([{ beschreibung: 'x', menge: 41, einheit: 'Std.', preis: 58.5, betrag: 2398.5 }], 8.1);
    expect(t.netto).toBe(2398.5);
    expect(t.mwst).toBe(194.3);
    expect(t.total).toBe(2592.8);
  });
  it('gruppiert freigegebene Rapporte nach Kunde und Monat', () => {
    const seed = createSeed(TODAY);
    const groups = billableGroups(seed.timesheets, seed.assignments);
    expect(groups.length).toBeGreaterThan(0);
    for (const g of groups) expect(g.timesheets.every((t) => t.status === 'Freigegeben')).toBe(true);
  });
  it('schlägt Honorar aus Satz und Lohn vor', () => {
    const seed = createSeed(TODAY);
    const job = seed.jobs.find((j) => j.id === 'j1')!;
    const company = seed.companies.find((c) => c.id === job.companyId)!;
    expect(suggestHonorar(job, company, undefined)).toBe(32200);
  });
});

describe('Matching', () => {
  const seed = createSeed(TODAY);
  it('bewertet passende Kandidaten hoch', () => {
    const job = seed.jobs.find((j) => j.id === 'j10')!; // Sachbearbeiter Treuhand
    const widmer = seed.candidates.find((c) => c.id === 'c10')!;
    const brunner = seed.candidates.find((c) => c.id === 'c1')!;
    const a = matchCandidate(job, widmer, TODAY);
    expect(a.score).toBeGreaterThanOrEqual(75);
    expect(a.matched).toEqual(expect.arrayContaining(['Treuhand', 'Abacus']));
    expect(matchCandidate(job, brunner, TODAY).score).toBeLessThan(45);
  });
  it('schliesst Kandidaten im Prozess aus', () => {
    const job = seed.jobs.find((j) => j.id === 'j1')!;
    const ranked = rankCandidates(job, seed.candidates, seed.placements);
    expect(ranked.some((r) => r.candidateId === 'c1')).toBe(false);
  });
});

describe('Lebenslauf-Heuristik', () => {
  const CV = `Lebenslauf

Martina Vogel
Bahnhofstrasse 12
8400 Winterthur
martina.vogel@example.ch
079 555 12 34
Geboren am 14.06.1992
Nationalität: Schweiz

Beruf: Marketing Managerin
Ausbildung: BSc Betriebsökonomie FH, 2016
8 Jahre Berufserfahrung

Kenntnisse: Digital Marketing, SEO, Google Analytics, Social Media, MS Office
Sprachen: Deutsch Muttersprache, Englisch C1, Französisch B1
Pensum: 80-100%
Lohnvorstellung: CHF 95'000
Verfügbar ab sofort`;

  it('erkennt Stammdaten und markiert Fehlendes', () => {
    const r = extractCvHeuristic(CV, TODAY);
    expect(r.data.vorname).toBe('Martina');
    expect(r.data.nachname).toBe('Vogel');
    expect(r.data.email).toBe('martina.vogel@example.ch');
    expect(r.data.telefon).toBe('+41 79 555 12 34');
    expect(r.data.geburtsdatum).toBe('1992-06-14');
    expect(r.data.plz).toBe('8400');
    expect(r.data.ort).toBe('Winterthur');
    expect(r.data.strasse).toBe('Bahnhofstrasse 12');
    expect(r.data.beruf).toBe('Marketing Managerin');
    expect(r.data.ausbildung).toBe('BSc Betriebsökonomie FH, 2016');
    expect(r.data.erfahrungJahre).toBe(8);
    expect(r.data.lohnvorstellung).toBe(95000);
    expect(r.data.pensum).toBe('80-100%');
    expect(r.data.verfuegbarAb).toBe(TODAY);
    expect(r.data.bewilligung).toBe('CH');
    expect(r.data.skills).toEqual(expect.arrayContaining(['SEO', 'Google Analytics']));
    expect(r.data.sprachen).toEqual(expect.arrayContaining([{ sprache: 'Englisch', niveau: 'C1' }]));
    expect(r.missing).not.toContain('email');
    expect(r.source).toBe('heuristik');
  });
  it('normalisiert Telefonnummern', () => {
    expect(extractPhone('Tel. 044 123 45 67')).toBe('+41 44 123 45 67');
    expect(extractPhone('+41 (0)79 555 12 34')).toBe('+41 79 555 12 34');
    expect(extractPhone('0041 31 350 60 60')).toBe('+41 31 350 60 60');
  });
  it('liefert leere Felder als fehlend', () => {
    const r = extractCvHeuristic('Max Muster\nKoch EFZ\nmax@muster.ch', TODAY);
    expect(r.missing).toEqual(expect.arrayContaining(['strasse', 'geburtsdatum', 'telefon']));
  });
});

describe('Webseiten-Heuristik', () => {
  it('nutzt schema.org-Daten vor Freitext', () => {
    const site: ScrapedSite = {
      url: 'https://www.muster-solutions.ch/', title: 'Muster Solutions – IT-Dienstleistungen', description: 'Ihr Partner für Software und Cloud',
      siteName: '', emails: ['info@muster-solutions.ch'], phones: ['052 123 45 67'],
      org: { name: 'Muster Solutions AG', streetAddress: 'Technikumstrasse 8', postalCode: '8401', addressLocality: 'Winterthur' },
      socials: {}, pages: [{ url: 'https://www.muster-solutions.ch/', text: 'Willkommen' }],
    };
    const r = extractCompanyHeuristic(site);
    expect(r.data.name).toBe('Muster Solutions AG');
    expect(r.data.telefon).toBe('+41 52 123 45 67');
    expect(r.data.ort).toBe('Winterthur');
    expect(r.data.website).toBe('www.muster-solutions.ch');
    expect(r.data.branche).toBe('Informatik / Software');
    expect(r.missing).toEqual([]);
  });
});

describe('Suche', () => {
  const seed = createSeed(TODAY);
  it('serialisiert Filter verlustfrei über URL-Parameter', () => {
    const f = { ...emptyFilter(), skills: ['SQL', 'Python'], orte: ['Zug'], minErfahrung: 3, verfuegbarBis: '2026-11-30' };
    expect(filterFromParams(filterToParams(f))).toEqual(f);
  });
  it('versteht natürlichsprachige Anfragen lokal', () => {
    const vocab = vocabularyFrom(seed.candidates);
    const f = heuristicQueryToFilter('Elektroinstallateur in Winterthur ab sofort, mindestens 5 Jahre Erfahrung', vocab, TODAY);
    expect(f.orte).toContain('Winterthur');
    expect(f.minErfahrung).toBe(5);
    expect(f.verfuegbarBis).toBe(TODAY);
    const hits = applyCandidateFilter(seed.candidates, { ...f, verfuegbarBis: addDays(TODAY, 30) });
    expect(hits.map((c) => c.id)).toContain('c3');
  });
});

describe('Insights', () => {
  it('erkennt Handlungsbedarf in den Demo-Daten', () => {
    const ins = computeInsights(createSeed(TODAY), TODAY);
    const ids = ins.map((i) => i.id);
    expect(ids).toContain('tasks-overdue');
    expect(ids).toContain('timesheets-approve');
    expect(ids.some((i) => i.startsWith('assignment-ending-'))).toBe(true);
    expect(ins[0].severity).toBe('hoch');
  });
});

describe('Demo-Daten', () => {
  it('sind referenziell konsistent', () => {
    const s = createSeed(TODAY);
    const ids = (xs: { id: string }[]) => new Set(xs.map((x) => x.id));
    const cand = ids(s.candidates), comp = ids(s.companies), jobs = ids(s.jobs), asg = ids(s.assignments), inv = ids(s.invoices);
    s.jobs.forEach((j) => expect(comp.has(j.companyId)).toBe(true));
    s.placements.forEach((p) => {
      expect(cand.has(p.candidateId)).toBe(true);
      expect(jobs.has(p.jobId)).toBe(true);
    });
    s.assignments.forEach((a) => expect(cand.has(a.candidateId) && comp.has(a.companyId)).toBe(true));
    s.timesheets.forEach((t) => {
      expect(asg.has(t.assignmentId)).toBe(true);
      if (t.status === 'Verrechnet') expect(inv.has(t.invoiceId)).toBe(true);
    });
    expect(s.invoices.length).toBeGreaterThan(3);
  });
});

describe('QR-Rechnung', () => {
  it('prüft IBAN-Prüfsummen und erkennt QR-IBAN', () => {
    expect(isValidIban('CH93 0076 2011 6238 5295 7')).toBe(true);
    expect(isValidIban('CH93 0076 2011 6238 5295 8')).toBe(false);
    expect(isQrIban('CH44 3199 9123 0008 8901 2')).toBe(true);
    expect(isQrIban('CH93 0076 2011 6238 5295 7')).toBe(false);
  });

  it('trennt Hausnummern ab', () => {
    expect(splitStreet('Bahnhofstrasse 12a')).toEqual(['Bahnhofstrasse', '12a']);
    expect(splitStreet('Postfach')).toEqual(['Postfach', '']);
  });

  it('erzeugt 31 Datenelemente im SPC-Format', () => {
    const payload = qrBillPayload({
      iban: 'CH93 0076 2011 6238 5295 7',
      creditor: { name: 'PersoCRM AG', strasse: 'Bahnhofstrasse', hausnummer: '1', plz: '8001', ort: 'Zürich', land: 'CH' },
      debtor: null,
      amount: 1949.75,
      currency: 'CHF',
      message: 'Rechnung R-5001',
    });
    const lines = payload.split('\r\n');
    expect(lines).toHaveLength(31);
    expect(lines.slice(0, 4)).toEqual(['SPC', '0200', '1', 'CH9300762011623852957']);
    expect(lines[18]).toBe('1949.75');
    expect(lines[27]).toBe('NON');
    expect(lines[30]).toBe('EPD');
  });
});

describe('Suche in Alltagssprache (lokal)', () => {
  it('versteht umgangssprachliche Berufe und Bewilligungen', () => {
    const seed = createSeed(TODAY);
    const f = heuristicQueryToFilter('Elektriker in Winterthur ab sofort mit B-Bewilligung', vocabularyFrom(seed.candidates), TODAY);
    expect(f.berufe).toContain('Elektroinstallateur');
    expect(f.orte).toContain('Winterthur');
    expect(f.bewilligungen).toEqual(['B']);
    expect(f.verfuegbarBis).toBe(TODAY);
    expect(f.q).toBe('');
  });
});

describe('Trends', () => {
  it('rechnet Prozentveränderungen', () => {
    expect(percentChange(120, 100)).toBe(20);
    expect(percentChange(75, 100)).toBe(-25);
    expect(percentChange(5, 0)).toBeNull();
  });

  it('vergleicht den Monatsumsatz mit dem gleichen Zeitraum im Vormonat', () => {
    const inv = (datum: string, netto: number, status: Invoice['status'] = 'Offen') => ({ datum, netto, status }) as Invoice;
    const r = revenueMonthToDate(
      [inv('2026-10-05', 1000), inv('2026-09-10', 400), inv('2026-09-29', 999), inv('2026-10-20', 500, 'Storniert')],
      TODAY,
    );
    expect(r).toEqual({ current: 1000, previous: 400 });
  });

  it('rekonstruiert laufende Prozesse und Einsätze zu einem Stichtag', () => {
    const seed = createSeed(TODAY);
    const heute = activePlacementsAt(seed.placements, TODAY);
    expect(heute).toBe(seed.placements.filter((p) => ['Vorgeschlagen', 'Interview', 'Angebot'].includes(p.phase)).length);
    expect(activeAssignmentsAt(seed.assignments, TODAY)).toBe(seed.assignments.filter((a) => a.status === 'Aktiv').length);
  });
});
