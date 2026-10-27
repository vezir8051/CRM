/* ============================================================
   Demo-Daten (Schweiz). Alle Daten relativ zum heutigen Datum,
   damit die Demo immer aktuell wirkt.
   ============================================================ */
import type {
  Activity, Assignment, Candidate, Company, CrmData, Invoice, Job, Placement, Timesheet, User,
} from '@/types';
import { addDays, daysBetween, monthKey, startOfWeek, todayISO } from '@/domain/format';
import { DEFAULT_TARIFF_RATES } from '@/domain/tarif';
import { buildHonorarInvoice, buildVerleihInvoice } from '@/domain/billing';

export const DEMO_PASSWORD_HASHES = {
  admin: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', // «admin»
  demo: '2a97516c354b68848cdbd8f54a226a0a55b21ed138e207ad6c5cbb9c00aa5aea', // «demo»
};

export function createSeed(today: string = todayISO()): CrmData {
  const d = (n: number) => addDays(today, n);
  const dt = (n: number, h = 9, m = 0) => `${d(n)}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

  const users: User[] = [
    { id: 'u1', username: 'admin', passwordHash: DEMO_PASSWORD_HASHES.admin, name: 'Sandra Meier', rolle: 'admin', email: 'sandra.meier@persocrm.ch' },
    { id: 'u2', username: 'mmueller', passwordHash: DEMO_PASSWORD_HASHES.demo, name: 'Marco Müller', rolle: 'berater', email: 'marco.mueller@persocrm.ch' },
    { id: 'u3', username: 'lweber', passwordHash: DEMO_PASSWORD_HASHES.demo, name: 'Laura Weber', rolle: 'berater', email: 'laura.weber@persocrm.ch' },
  ];

  const cand = (p: Partial<Candidate> & Pick<Candidate, 'id' | 'nr' | 'vorname' | 'nachname'>, created: number): Candidate => ({
    anrede: '', geburtsdatum: '', email: '', telefon: '', strasse: '', plz: '', ort: '', nationalitaet: 'Schweiz', bewilligung: 'CH',
    beruf: '', ausbildung: '', erfahrungJahre: null, skills: [], sprachen: [{ sprache: 'Deutsch', niveau: 'Muttersprache' }],
    verfuegbarAb: '', pensum: '100%', anstellungsarten: ['Festanstellung'], lohnvorstellung: null, stundenlohn: null,
    status: 'Aktiv', quelle: 'jobs.ch', betreuerId: 'u2', notizen: '', tags: [], dokumente: [], kurzprofil: '',
    createdAt: dt(-created, 10), updatedAt: dt(-Math.max(0, created - 3), 11),
    ...p,
  });

  const candidates: Candidate[] = [
    cand({ id: 'c1', nr: 'K-1001', anrede: 'Herr', vorname: 'Lukas', nachname: 'Brunner', email: 'lukas.brunner@mail.ch', telefon: '+41 79 512 33 41', geburtsdatum: '1990-04-12', strasse: 'Seestrasse 14', plz: '8038', ort: 'Zürich',
      beruf: 'Softwareentwickler', ausbildung: 'BSc Informatik, ZHAW', erfahrungJahre: 8, skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'SQL'],
      sprachen: [{ sprache: 'Deutsch', niveau: 'Muttersprache' }, { sprache: 'Englisch', niveau: 'C1' }], verfuegbarAb: d(30), lohnvorstellung: 110000,
      notizen: 'Sehr kommunikativ, sucht neue Herausforderung im Fintech-Umfeld.', tags: ['Top-Profil'],
      dokumente: [{ id: 'd1', name: 'Lebenslauf_Brunner.pdf', typ: 'Lebenslauf', datum: d(-40) }, { id: 'd2', name: 'Arbeitszeugnis_TechAG.pdf', typ: 'Arbeitszeugnis', datum: d(-40) }] }, 45),
    cand({ id: 'c2', nr: 'K-1002', anrede: 'Frau', vorname: 'Nina', nachname: 'Keller', email: 'nina.keller@bluewin.ch', telefon: '+41 78 224 91 07', geburtsdatum: '1993-09-02', strasse: 'Bahnhofweg 3', plz: '6003', ort: 'Luzern',
      beruf: 'Pflegefachfrau HF', ausbildung: 'Dipl. Pflegefachfrau HF', erfahrungJahre: 6, skills: ['Akutpflege', 'Notfallpflege', 'Wunddokumentation', 'BLS-AED'],
      sprachen: [{ sprache: 'Deutsch', niveau: 'Muttersprache' }, { sprache: 'Französisch', niveau: 'B2' }], verfuegbarAb: d(60), pensum: '80-100%', lohnvorstellung: 85000,
      quelle: 'Empfehlung', betreuerId: 'u3', notizen: 'Bevorzugt Region Zentralschweiz, Schichtbereitschaft vorhanden.',
      dokumente: [{ id: 'd1', name: 'CV_Keller.pdf', typ: 'Lebenslauf', datum: d(-30) }] }, 38),
    cand({ id: 'c3', nr: 'K-1003', anrede: 'Herr', vorname: 'David', nachname: 'Steiner', email: 'd.steiner@gmx.ch', telefon: '+41 76 330 18 52', geburtsdatum: '1987-01-25', strasse: 'Industriestrasse 22', plz: '8404', ort: 'Winterthur',
      beruf: 'Elektroinstallateur EFZ', ausbildung: 'Elektroinstallateur EFZ', erfahrungJahre: 12, skills: ['Elektroinstallation', 'NIN-Kenntnisse', 'Photovoltaik', 'Führerschein B'],
      verfuegbarAb: d(14), anstellungsarten: ['Temporär', 'Festanstellung'], lohnvorstellung: 78000, stundenlohn: 37, quelle: 'Website',
      notizen: 'Eigener Werkzeugkoffer, Führerschein B.' }, 25),
    cand({ id: 'c4', nr: 'K-1004', anrede: 'Frau', vorname: 'Sarah', nachname: 'Baumann', email: 'sarah.baumann@outlook.com', telefon: '+41 79 667 44 20', geburtsdatum: '1995-06-17', strasse: 'Rosenweg 8', plz: '3013', ort: 'Bern',
      beruf: 'Buchhalterin', ausbildung: 'Fachausweis Finanz- und Rechnungswesen', erfahrungJahre: 7, skills: ['Finanzbuchhaltung', 'Abacus', 'MWST-Abrechnung', 'Lohnbuchhaltung', 'Jahresabschluss'],
      sprachen: [{ sprache: 'Deutsch', niveau: 'Muttersprache' }, { sprache: 'Englisch', niveau: 'B2' }], verfuegbarAb: d(90), pensum: '80%', lohnvorstellung: 92000,
      status: 'In Prüfung', quelle: 'LinkedIn', betreuerId: 'u3', notizen: 'Kündigungsfrist 3 Monate. Referenzen ausstehend.' }, 12),
    cand({ id: 'c5', nr: 'K-1005', anrede: 'Herr', vorname: 'Thomas', nachname: 'Huber', email: 'thomas.huber@sunrise.ch', telefon: '+41 78 901 27 65', geburtsdatum: '1982-11-30', strasse: 'Dorfstrasse 45', plz: '5000', ort: 'Aarau',
      beruf: 'Projektleiter Hochbau', ausbildung: 'Dipl. Bauleiter HF', erfahrungJahre: 16, skills: ['Bauleitung', 'Projektmanagement', 'Kostenkontrolle', 'SIA-Normen', 'MS Project'],
      sprachen: [{ sprache: 'Deutsch', niveau: 'Muttersprache' }, { sprache: 'Italienisch', niveau: 'B1' }], verfuegbarAb: d(-60), lohnvorstellung: 125000,
      status: 'Vermittelt', notizen: 'Erfolgreich vermittelt an Helvetia Bau AG.' }, 130),
    cand({ id: 'c6', nr: 'K-1006', anrede: 'Frau', vorname: 'Elena', nachname: 'Rossi', email: 'elena.rossi@icloud.com', telefon: '+41 76 118 90 34', geburtsdatum: '1991-03-08', strasse: 'Steinenvorstadt 6', plz: '4051', ort: 'Basel',
      nationalitaet: 'Italien', bewilligung: 'C', beruf: 'Marketing Managerin', ausbildung: 'MSc Marketing, Universität Basel', erfahrungJahre: 5,
      skills: ['Digital Marketing', 'SEO', 'Content Marketing', 'Google Analytics', 'Social Media'],
      sprachen: [{ sprache: 'Deutsch', niveau: 'C2' }, { sprache: 'Italienisch', niveau: 'Muttersprache' }, { sprache: 'Englisch', niveau: 'C1' }],
      verfuegbarAb: d(30), pensum: '80-100%', lohnvorstellung: 98000, quelle: 'LinkedIn', betreuerId: 'u3', notizen: 'Starkes B2B-Portfolio, wünscht Homeoffice-Anteil.' }, 22),
    cand({ id: 'c7', nr: 'K-1007', anrede: 'Herr', vorname: 'Pascal', nachname: 'Frei', email: 'pascal.frei@hispeed.ch', telefon: '+41 79 445 12 88', geburtsdatum: '1998-08-21', strasse: 'Lindenhof 2', plz: '8400', ort: 'Winterthur',
      beruf: 'ICT-Supporter', ausbildung: 'Informatiker EFZ Systemtechnik', erfahrungJahre: 4, skills: ['1st/2nd Level Support', 'Windows Server', 'Microsoft 365', 'Active Directory', 'ITIL'],
      sprachen: [{ sprache: 'Deutsch', niveau: 'Muttersprache' }, { sprache: 'Englisch', niveau: 'B2' }], verfuegbarAb: d(7), anstellungsarten: ['Try & Hire', 'Festanstellung'], lohnvorstellung: 72000,
      quelle: 'Website', notizen: 'Sehr motiviert, kurzfristig verfügbar.' }, 9),
    cand({ id: 'c8', nr: 'K-1008', anrede: 'Frau', vorname: 'Julia', nachname: 'Graf', email: 'julia.graf@bluewin.ch', telefon: '+41 78 559 30 71', geburtsdatum: '1989-12-05', strasse: 'Hauptgasse 19', plz: '4500', ort: 'Solothurn',
      beruf: 'HR-Fachfrau', ausbildung: 'HR-Fachfrau mit eidg. Fachausweis', erfahrungJahre: 9, skills: ['Rekrutierung', 'Personaladministration', 'Sozialversicherungen', 'SAP HCM', 'Arbeitsrecht'],
      sprachen: [{ sprache: 'Deutsch', niveau: 'Muttersprache' }, { sprache: 'Französisch', niveau: 'C1' }], verfuegbarAb: d(60), pensum: '60-80%', lohnvorstellung: 88000,
      status: 'In Prüfung', quelle: 'Empfehlung', betreuerId: 'u3', notizen: 'Sucht Teilzeitstelle mit Verantwortung, zweisprachig DE/FR.' }, 7),
    cand({ id: 'c9', nr: 'K-1009', anrede: 'Herr', vorname: 'Reto', nachname: 'Zimmermann', email: 'reto.zimmermann@gmail.com', telefon: '+41 76 882 45 09', geburtsdatum: '1985-05-14', strasse: 'Feldweg 31', plz: '6300', ort: 'Zug',
      beruf: 'Polymechaniker EFZ', ausbildung: 'Polymechaniker EFZ', erfahrungJahre: 14, skills: ['CNC-Fräsen', 'CNC-Drehen', 'CAD/CAM', 'Qualitätskontrolle'],
      verfuegbarAb: d(-40), anstellungsarten: ['Temporär'], stundenlohn: 38, status: 'Im Einsatz', notizen: 'Schichtarbeit möglich. Aktuell im Einsatz bei Präzisa.' }, 50),
    cand({ id: 'c10', nr: 'K-1010', anrede: 'Frau', vorname: 'Corinne', nachname: 'Widmer', email: 'c.widmer@bluemail.ch', telefon: '+41 79 210 66 43', geburtsdatum: '1994-02-27', strasse: 'Bergstrasse 7', plz: '7000', ort: 'Chur',
      beruf: 'Sachbearbeiterin Treuhand', ausbildung: 'Kauffrau EFZ, Treuhand-Assistentin', erfahrungJahre: 5, skills: ['Treuhand', 'Steuererklärungen', 'Abacus', 'Debitoren', 'Kreditoren'],
      sprachen: [{ sprache: 'Deutsch', niveau: 'Muttersprache' }, { sprache: 'Rätoromanisch', niveau: 'Muttersprache' }], verfuegbarAb: d(30), lohnvorstellung: 75000,
      status: 'Neu', quelle: 'Website', betreuerId: 'u3', notizen: 'Erstgespräch noch nicht erfolgt.' }, 2),
    cand({ id: 'c11', nr: 'K-1011', anrede: 'Herr', vorname: 'Michael', nachname: 'Bachmann', email: 'm.bachmann@swissonline.ch', telefon: '+41 78 774 21 90', geburtsdatum: '1980-07-19', strasse: 'Talackerstrasse 55', plz: '8152', ort: 'Glattbrugg',
      beruf: 'Verkaufsleiter', ausbildung: 'Verkaufsleiter mit eidg. Diplom', erfahrungJahre: 18, skills: ['Key Account Management', 'B2B-Vertrieb', 'CRM-Systeme', 'Verhandlungsführung'],
      sprachen: [{ sprache: 'Deutsch', niveau: 'Muttersprache' }, { sprache: 'Englisch', niveau: 'C1' }, { sprache: 'Französisch', niveau: 'B2' }], verfuegbarAb: d(90), lohnvorstellung: 140000,
      quelle: 'Headhunting', notizen: 'Diskret behandeln – aktuell in ungekündigter Stellung.', tags: ['Diskret'] }, 33),
    cand({ id: 'c12', nr: 'K-1012', anrede: 'Frau', vorname: 'Vanessa', nachname: 'Koch', email: 'vanessa.koch@gmail.com', telefon: '+41 76 651 08 27', geburtsdatum: '1997-10-03', strasse: 'Mühlegasse 12', plz: '9000', ort: 'St. Gallen',
      beruf: 'Data Analystin', ausbildung: 'MSc Data Science, Universität St. Gallen', erfahrungJahre: 3, skills: ['Python', 'SQL', 'Power BI', 'Tableau', 'Statistik'],
      sprachen: [{ sprache: 'Deutsch', niveau: 'Muttersprache' }, { sprache: 'Englisch', niveau: 'C2' }], verfuegbarAb: d(30), pensum: '80-100%', lohnvorstellung: 95000,
      quelle: 'LinkedIn', betreuerId: 'u3', notizen: 'Top-Profil, mehrere Interessenten.', tags: ['Top-Profil'] }, 14),
    cand({ id: 'c13', nr: 'K-1013', anrede: 'Herr', vorname: 'Stefan', nachname: 'Wyss', email: 'stefan.wyss@gmx.ch', telefon: '+41 79 093 55 12', geburtsdatum: '1992-01-09', strasse: 'Unterdorf 3', plz: '3600', ort: 'Thun',
      beruf: 'Logistiker EFZ', ausbildung: 'Logistiker EFZ', erfahrungJahre: 8, skills: ['Lagerbewirtschaftung', 'Staplerausweis', 'SAP WM', 'Kommissionierung', 'Zolldeklaration'],
      verfuegbarAb: d(12), anstellungsarten: ['Temporär'], stundenlohn: 29, notizen: 'Staplerausweis R1/R2, bereit für Schichtarbeit.' }, 160),
    cand({ id: 'c14', nr: 'K-1014', anrede: 'Frau', vorname: 'Andrea', nachname: 'Lüthi', email: 'andrea.luethi@bluewin.ch', telefon: '+41 78 336 74 58', geburtsdatum: '1988-04-22', strasse: 'Kirchplatz 5', plz: '8500', ort: 'Frauenfeld',
      beruf: 'Köchin EFZ', ausbildung: 'Köchin EFZ', erfahrungJahre: 11, skills: ['Bankett', 'Menüplanung', 'HACCP'], verfuegbarAb: d(30), lohnvorstellung: 62000,
      status: 'Inaktiv', quelle: 'Website', betreuerId: 'u3', notizen: 'Aktuell nicht auf Stellensuche – Wiedervorlage in 6 Monaten.' }, 210),
    cand({ id: 'c15', nr: 'K-1015', anrede: 'Herr', vorname: 'Adrian', nachname: 'Schmid', email: 'adrian.schmid@mail.ch', telefon: '+41 76 402 89 31', geburtsdatum: '1996-11-11', strasse: 'Weiherweg 27', plz: '4600', ort: 'Olten',
      nationalitaet: 'Deutschland', bewilligung: 'B', beruf: 'Servicetechniker', ausbildung: 'Automatiker EFZ', erfahrungJahre: 6,
      skills: ['Wartung & Instandhaltung', 'Hydraulik', 'Pneumatik', 'Elektrotechnik', 'Photovoltaik'], verfuegbarAb: d(-75), anstellungsarten: ['Temporär'], stundenlohn: 36,
      status: 'Im Einsatz', quelle: 'Empfehlung', notizen: 'Reisebereitschaft ganze Deutschschweiz.' }, 95),
    cand({ id: 'c16', nr: 'K-1016', anrede: 'Frau', vorname: 'Melanie', nachname: 'Hofer', email: 'melanie.hofer@icloud.com', telefon: '+41 79 728 16 02', geburtsdatum: '1999-03-30', strasse: 'Gartenstrasse 9', plz: '2502', ort: 'Biel',
      beruf: 'Kauffrau EFZ', ausbildung: 'Kauffrau EFZ E-Profil', erfahrungJahre: 3, skills: ['Administration', 'Korrespondenz', 'MS Office', 'Empfang', 'Offertwesen'],
      sprachen: [{ sprache: 'Deutsch', niveau: 'Muttersprache' }, { sprache: 'Französisch', niveau: 'C1' }], verfuegbarAb: d(-20), lohnvorstellung: 60000,
      status: 'Vermittelt', betreuerId: 'u3' }, 45),
    // Freie Profile, die zu offenen Vakanzen passen (Demo für das Matching)
    cand({ id: 'c17', nr: 'K-1017', anrede: 'Herr', vorname: 'Marco', nachname: 'Bernasconi', email: 'marco.bernasconi@proton.me', telefon: '+41 78 640 17 22', geburtsdatum: '1988-07-05', strasse: 'Zugerstrasse 41', plz: '6340', ort: 'Baar',
      beruf: 'Softwareentwickler', ausbildung: 'MSc Informatik, ETH Zürich', erfahrungJahre: 10, skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'AWS', 'Docker'],
      sprachen: [{ sprache: 'Deutsch', niveau: 'Muttersprache' }, { sprache: 'Italienisch', niveau: 'C1' }, { sprache: 'Englisch', niveau: 'C1' }], verfuegbarAb: d(30), lohnvorstellung: 118000, pensum: '80-100%',
      quelle: 'LinkedIn', notizen: 'Aktuell Tech Lead in einem Scale-up, sucht mehr Verantwortung.', tags: ['Top-Profil'] }, 4),
    cand({ id: 'c18', nr: 'K-1018', anrede: 'Frau', vorname: 'Jasmin', nachname: 'Huber', email: 'jasmin.huber@bluewin.ch', telefon: '+41 79 233 18 50', geburtsdatum: '1993-11-21', strasse: 'Badenerstrasse 12', plz: '8953', ort: 'Dietikon',
      beruf: 'Pflegefachfrau HF', ausbildung: 'Dipl. Pflegefachfrau HF, NDS Notfallpflege', erfahrungJahre: 7, skills: ['Notfallpflege', 'Akutpflege', 'BLS-AED', 'Triage'],
      verfuegbarAb: d(14), lohnvorstellung: 89000, pensum: '80-100%', betreuerId: 'u3' }, 3),
    cand({ id: 'c19', nr: 'K-1019', anrede: 'Herr', vorname: 'Dario', nachname: 'Kovačević', email: 'dario.k@gmx.ch', telefon: '+41 76 512 19 77', geburtsdatum: '1996-02-14', strasse: 'Hochbergerstrasse 70', plz: '4057', ort: 'Basel',
      nationalitaet: 'Kroatien', bewilligung: 'C', beruf: 'Logistiker EFZ', ausbildung: 'Logistiker EFZ Lager', erfahrungJahre: 6, skills: ['Lagerbewirtschaftung', 'Staplerausweis', 'Kommissionierung', 'SAP'],
      sprachen: [{ sprache: 'Deutsch', niveau: 'C1' }, { sprache: 'Kroatisch', niveau: 'Muttersprache' }], verfuegbarAb: d(-2), anstellungsarten: ['Temporär', 'Festanstellung'], stundenlohn: 29,
      quelle: 'RAV' }, 2),
    cand({ id: 'c20', nr: 'K-1020', anrede: 'Frau', vorname: 'Selin', nachname: 'Aydin', email: 'selin.aydin@outlook.com', telefon: '+41 77 410 20 31', geburtsdatum: '1998-09-03', strasse: 'Obergrundstrasse 3', plz: '6003', ort: 'Luzern',
      beruf: 'ICT-Supporterin', ausbildung: 'Informatikerin EFZ Plattformentwicklung', erfahrungJahre: 4, skills: ['1st/2nd Level Support', 'Microsoft 365', 'Active Directory', 'Intune'],
      sprachen: [{ sprache: 'Deutsch', niveau: 'Muttersprache' }, { sprache: 'Türkisch', niveau: 'Muttersprache' }, { sprache: 'Englisch', niveau: 'B2' }], verfuegbarAb: d(21), anstellungsarten: ['Festanstellung', 'Try & Hire'], lohnvorstellung: 74000,
      quelle: 'Website', status: 'Neu' }, 1),
  ];

  const comp = (p: Partial<Company> & Pick<Company, 'id' | 'nr' | 'name'>, created: number): Company => ({
    branche: '', strasse: '', plz: '', ort: '', telefon: '', email: '', website: '', status: 'Aktiv', honorarSatz: 22, zahlungsfrist: 30,
    betreuerId: 'u2', notizen: '', kontakte: [], createdAt: dt(-created, 9), updatedAt: dt(-Math.max(0, created - 5), 9), ...p,
  });

  const companies: Company[] = [
    comp({ id: 'f1', nr: 'F-2001', name: 'Helvetia Bau AG', branche: 'Bauwesen', strasse: 'Baslerstrasse 101', plz: '8048', ort: 'Zürich', telefon: '+41 44 555 20 20', email: 'info@helvetiabau.ch', website: 'www.helvetiabau.ch',
      honorarSatz: 25, notizen: 'Rahmenvertrag seit 2022. Wachstum im Bereich Umbau/Renovation.',
      kontakte: [
        { id: 'k1', anrede: 'Herr', vorname: 'Beat', nachname: 'Odermatt', funktion: 'Leiter HR', email: 'b.odermatt@helvetiabau.ch', telefon: '+41 44 555 20 21' },
        { id: 'k2', anrede: 'Frau', vorname: 'Petra', nachname: 'Gasser', funktion: 'HR Business Partnerin', email: 'p.gasser@helvetiabau.ch', telefon: '+41 44 555 20 22' },
      ] }, 400),
    comp({ id: 'f2', nr: 'F-2002', name: 'TechNova GmbH', branche: 'Informatik / Software', strasse: 'Innovationspark 7', plz: '6300', ort: 'Zug', telefon: '+41 41 720 88 00', email: 'hr@technova.ch', website: 'www.technova.ch',
      honorarSatz: 28, notizen: 'Fintech-Scale-up, stellt laufend Entwickler ein. Schnelle Entscheidungswege.',
      kontakte: [{ id: 'k1', anrede: 'Frau', vorname: 'Simone', nachname: 'Vogel', funktion: 'Head of Talent', email: 's.vogel@technova.ch', telefon: '+41 41 720 88 01' }] }, 280),
    comp({ id: 'f3', nr: 'F-2003', name: 'Spital Limmattal', branche: 'Gesundheitswesen', strasse: 'Urdorferstrasse 100', plz: '8952', ort: 'Schlieren', telefon: '+41 44 733 11 11', email: 'personal@spital-limmattal.ch', website: 'www.spital-limmattal.ch',
      betreuerId: 'u3', notizen: 'Hoher Bedarf an Pflegepersonal, auch Temporäreinsätze.',
      kontakte: [
        { id: 'k1', anrede: 'Herr', vorname: 'Daniel', nachname: 'Furrer', funktion: 'Personalleiter', email: 'd.furrer@spital-limmattal.ch', telefon: '+41 44 733 11 22' },
        { id: 'k2', anrede: 'Frau', vorname: 'Rita', nachname: 'Anderhub', funktion: 'Leiterin Pflege', email: 'r.anderhub@spital-limmattal.ch', telefon: '+41 44 733 11 33' },
      ] }, 350),
    comp({ id: 'f4', nr: 'F-2004', name: 'Alpina Treuhand AG', branche: 'Treuhand / Revision', strasse: 'Pilatusstrasse 18', plz: '6003', ort: 'Luzern', telefon: '+41 41 210 45 45', email: 'info@alpina-treuhand.ch', website: 'www.alpina-treuhand.ch',
      honorarSatz: 25, betreuerId: 'u3', notizen: 'Sucht regelmässig Fachkräfte im Finanz- und Treuhandbereich.',
      kontakte: [{ id: 'k1', anrede: 'Herr', vorname: 'Urs', nachname: 'Kaufmann', funktion: 'Partner', email: 'u.kaufmann@alpina-treuhand.ch', telefon: '+41 41 210 45 46' }] }, 190),
    comp({ id: 'f5', nr: 'F-2005', name: 'Muster Logistik AG', branche: 'Logistik / Transport', strasse: 'Hafenstrasse 66', plz: '4057', ort: 'Basel', telefon: '+41 61 631 77 77', email: 'jobs@musterlogistik.ch', website: 'www.musterlogistik.ch',
      honorarSatz: 20, zahlungsfrist: 20, notizen: 'Grosser Temporär-Bedarf in Stosszeiten (Q4).',
      kontakte: [{ id: 'k1', anrede: 'Frau', vorname: 'Claudia', nachname: 'Berger', funktion: 'HR-Verantwortliche', email: 'c.berger@musterlogistik.ch', telefon: '+41 61 631 77 78' }] }, 200),
    comp({ id: 'f6', nr: 'F-2006', name: 'Gastro Seeblick GmbH', branche: 'Gastronomie / Hotellerie', strasse: 'Seepromenade 2', plz: '3600', ort: 'Thun', telefon: '+41 33 222 90 90', email: 'info@seeblick-thun.ch', website: 'www.seeblick-thun.ch',
      status: 'Interessent', honorarSatz: 18, betreuerId: 'u3', notizen: 'Erstkontakt an der Gastro-Messe. Noch kein Auftrag erteilt.',
      kontakte: [{ id: 'k1', anrede: 'Herr', vorname: 'Franco', nachname: 'Bianchi', funktion: 'Geschäftsführer', email: 'f.bianchi@seeblick-thun.ch', telefon: '+41 33 222 90 91' }] }, 35),
    comp({ id: 'f7', nr: 'F-2007', name: 'ElektroPlus AG', branche: 'Elektroinstallation', strasse: 'Zürcherstrasse 210', plz: '8406', ort: 'Winterthur', telefon: '+41 52 208 33 33', email: 'personal@elektroplus.ch', website: 'www.elektroplus.ch',
      honorarSatz: 23, notizen: 'Wächst stark im Bereich Photovoltaik, sucht laufend Monteure.',
      kontakte: [
        { id: 'k1', anrede: 'Herr', vorname: 'Roger', nachname: 'Stalder', funktion: 'Geschäftsleiter', email: 'r.stalder@elektroplus.ch', telefon: '+41 52 208 33 34' },
        { id: 'k2', anrede: 'Frau', vorname: 'Monika', nachname: 'Ryf', funktion: 'Personaladministration', email: 'm.ryf@elektroplus.ch', telefon: '+41 52 208 33 35' },
      ] }, 220),
    comp({ id: 'f8', nr: 'F-2008', name: 'MediCare Services AG', branche: 'Gesundheitswesen', strasse: 'Weltpoststrasse 5', plz: '3015', ort: 'Bern', telefon: '+41 31 350 60 60', email: 'hr@medicare-services.ch', website: 'www.medicare-services.ch',
      status: 'Inaktiv', betreuerId: 'u3', notizen: 'Zusammenarbeit pausiert – Einstellungsstopp bis Q1.',
      kontakte: [{ id: 'k1', anrede: 'Frau', vorname: 'Karin', nachname: 'Aebischer', funktion: 'HR-Leiterin', email: 'k.aebischer@medicare-services.ch', telefon: '+41 31 350 60 61' }] }, 310),
    comp({ id: 'f9', nr: 'F-2009', name: 'Präzisa Mechanik AG', branche: 'Industrie / Produktion', strasse: 'Industriestrasse 40', plz: '6312', ort: 'Steinhausen', telefon: '+41 41 748 20 00', email: 'info@praezisa.ch', website: 'www.praezisa.ch',
      honorarSatz: 20, notizen: 'CNC-Fertigung für Medtech. Bedarf an Polymechanikern im Schichtbetrieb.',
      kontakte: [{ id: 'k1', anrede: 'Herr', vorname: 'Kurt', nachname: 'Inderbitzin', funktion: 'Produktionsleiter', email: 'k.inderbitzin@praezisa.ch', telefon: '+41 41 748 20 10' }] }, 70),
  ];

  const job = (p: Partial<Job> & Pick<Job, 'id' | 'nr' | 'titel' | 'companyId'>, created: number): Job => ({
    kontaktId: 'k1', ort: '', pensum: '100%', art: 'Festanstellung', lohnMin: null, lohnMax: null, tarif: null, skills: [], beschreibung: '',
    status: 'Offen', prioritaet: 'Mittel', deadline: '', anzahl: 1, betreuerId: 'u2', inserat: '',
    createdAt: dt(-created, 8), updatedAt: dt(-Math.max(0, created - 2), 8), ...p,
  });

  const jobs: Job[] = [
    job({ id: 'j1', nr: 'V-3001', titel: 'Senior Softwareentwickler Fullstack', companyId: 'f2', ort: 'Zug', pensum: '80-100%', lohnMin: 105000, lohnMax: 125000,
      skills: ['JavaScript', 'TypeScript', 'React', 'Node.js'], beschreibung: 'Entwicklung der Kern-Plattform für den Zahlungsverkehr. Tech-Lead-Perspektive, moderner Stack, 60% Remote.', prioritaet: 'Hoch', deadline: d(21) }, 30),
    job({ id: 'j2', nr: 'V-3002', titel: 'Pflegefachperson HF/FH Notfall', companyId: 'f3', kontaktId: 'k2', ort: 'Schlieren', pensum: '80-100%', lohnMin: 82000, lohnMax: 95000,
      skills: ['Notfallpflege', 'Akutpflege', 'BLS-AED'], beschreibung: 'Interdisziplinäres Notfallzentrum, 3-Schicht-Betrieb, Zulagen nach GAV.', prioritaet: 'Hoch', deadline: d(14), betreuerId: 'u3' }, 25),
    job({ id: 'j3', nr: 'V-3003', titel: 'Elektroinstallateur EFZ Photovoltaik', companyId: 'f7', ort: 'Winterthur', art: 'Temporär', tarif: 58.5, anzahl: 3,
      skills: ['Elektroinstallation', 'Photovoltaik', 'NIN-Kenntnisse'], beschreibung: 'Montage von PV-Anlagen auf EFH/MFH. Einsatz ab sofort, Übernahme möglich.', status: 'In Bearbeitung', prioritaet: 'Hoch', deadline: d(7) }, 90),
    job({ id: 'j4', nr: 'V-3004', titel: 'Buchhalter/in 80%', companyId: 'f4', ort: 'Luzern', pensum: '80%', lohnMin: 85000, lohnMax: 95000,
      skills: ['Finanzbuchhaltung', 'Abacus', 'Jahresabschluss'], beschreibung: 'Selbständige Führung von Kundenbuchhaltungen, Steuererklärungen, direkter Kundenkontakt.', status: 'In Bearbeitung', deadline: d(30), betreuerId: 'u3' }, 15),
    job({ id: 'j5', nr: 'V-3005', titel: 'Projektleiter Hochbau', companyId: 'f1', ort: 'Zürich', lohnMin: 115000, lohnMax: 135000,
      skills: ['Bauleitung', 'Projektmanagement', 'SIA-Normen'], beschreibung: 'Gesamtleitung anspruchsvoller Umbauprojekte, Budgetverantwortung bis CHF 15 Mio.', status: 'Besetzt', deadline: d(-60) }, 120),
    job({ id: 'j6', nr: 'V-3006', titel: 'ICT-Supporter 1st/2nd Level', companyId: 'f2', ort: 'Zug', art: 'Try & Hire', lohnMin: 68000, lohnMax: 78000,
      skills: ['1st/2nd Level Support', 'Microsoft 365', 'Active Directory'], beschreibung: 'Support für 250 interne User, Onsite & Remote, Übernahme nach 3 Monaten geplant.', deadline: d(28) }, 10),
    job({ id: 'j7', nr: 'V-3007', titel: 'Data Analyst (m/w/d)', companyId: 'f2', ort: 'Zug', pensum: '80-100%', lohnMin: 90000, lohnMax: 110000,
      skills: ['Python', 'SQL', 'Power BI'], beschreibung: 'Aufbau des BI-Teams, Reporting für das Management, moderne Datenplattform.', prioritaet: 'Hoch', deadline: d(35), betreuerId: 'u3' }, 12),
    job({ id: 'j8', nr: 'V-3008', titel: 'Logistiker EFZ Lager', companyId: 'f5', ort: 'Basel', art: 'Temporär', tarif: 46.5, anzahl: 2,
      skills: ['Lagerbewirtschaftung', 'Staplerausweis', 'Kommissionierung'], beschreibung: 'Verstärkung im Zentrallager, 2-Schicht-Betrieb, Einsatzdauer 6 Monate mit Option.', deadline: d(10) }, 8),
    job({ id: 'j9', nr: 'V-3009', titel: 'Koch/Köchin EFZ Saisonstelle', companyId: 'f6', ort: 'Thun', lohnMin: 58000, lohnMax: 66000,
      skills: ['Bankett', 'Menüplanung', 'HACCP'], beschreibung: 'Sommersaison am See, Unterkunft vorhanden, junges Team.', status: 'On Hold', prioritaet: 'Niedrig', deadline: d(45), betreuerId: 'u3' }, 18),
    job({ id: 'j10', nr: 'V-3010', titel: 'Sachbearbeiter/in Treuhand', companyId: 'f4', ort: 'Luzern', lohnMin: 70000, lohnMax: 80000,
      skills: ['Treuhand', 'Abacus', 'Steuererklärungen'], beschreibung: 'Unterstützung des Mandatsleiters, Debitoren/Kreditoren, Steuererklärungen.', deadline: d(40), betreuerId: 'u3' }, 9),
  ];

  const pl = (id: string, candidateId: string, jobId: string, verlauf: [number, Placement['phase'], string][], extra: Partial<Placement> = {}): Placement => {
    const v = verlauf.map(([n, phase, notiz]) => ({ datum: dt(n, 10), phase, notiz, userId: 'u2' }));
    return {
      id, candidateId, jobId, phase: v[v.length - 1].phase, honorar: null, startdatum: '', notiz: '', verlauf: v,
      createdAt: v[0].datum, updatedAt: v[v.length - 1].datum, ...extra,
    };
  };

  const placements: Placement[] = [
    pl('p1', 'c5', 'j5', [[-110, 'Vorgeschlagen', 'Dossier an Herrn Odermatt gesendet.'], [-95, 'Interview', 'Erstgespräch vor Ort, sehr positiv.'], [-80, 'Angebot', 'Offerte CHF 128’000.'], [-72, 'Vermittelt', 'Vertrag unterschrieben.']], { honorar: 31250, startdatum: d(-45) }),
    pl('p2', 'c1', 'j1', [[-12, 'Vorgeschlagen', 'Profil anonymisiert vorgestellt.'], [-5, 'Interview', 'Technisches Interview bestanden.']], { notiz: 'Zweitgespräch mit CTO geplant.' }),
    pl('p3', 'c2', 'j2', [[-18, 'Vorgeschlagen', 'Dossier an Frau Anderhub.'], [-10, 'Interview', 'Schnuppertag absolviert.'], [-7, 'Angebot', 'Offerte 88k + Zulagen.']], { honorar: 19800 }),
    pl('p4', 'c3', 'j3', [[-8, 'Vorgeschlagen', 'Telefonisch vorgestellt.'], [-3, 'Interview', 'Probetag vereinbart.']]),
    pl('p5', 'c4', 'j4', [[-4, 'Vorgeschlagen', 'Dossier eingereicht.']]),
    pl('p6', 'c12', 'j7', [[-9, 'Vorgeschlagen', 'Profil vorgestellt.'], [-4, 'Interview', 'Case Study erhalten.']]),
    pl('p7', 'c7', 'j6', [[-2, 'Vorgeschlagen', 'Dossier an Frau Vogel gesendet.']]),
    pl('p8', 'c13', 'j8', [[-6, 'Vorgeschlagen', 'Telefonische Vorstellung.'], [-4, 'Interview', 'Kennenlernen im Lager.'], [-1, 'Angebot', 'Einsatzvertrag in Vorbereitung.']]),
    pl('p9', 'c9', 'j3', [[-60, 'Vorgeschlagen', 'Als Alternative vorgestellt.'], [-55, 'Absage', 'Kunde bevorzugt PV-Erfahrung.']]),
    pl('p10', 'c6', 'j1', [[-20, 'Vorgeschlagen', 'Quereinstieg vorgeschlagen.'], [-13, 'Absage', 'Kandidatin zieht zurück.']]),
    pl('p11', 'c11', 'j5', [[-170, 'Vorgeschlagen', ''], [-155, 'Vermittelt', 'Abschluss (Archiv).']], { honorar: 28000, startdatum: d(-150) }),
    pl('p12', 'c15', 'j3', [[-95, 'Vorgeschlagen', ''], [-88, 'Interview', ''], [-78, 'Vermittelt', 'Temporäreinsatz gestartet.']]),
    pl('p13', 'c16', 'j10', [[-40, 'Vorgeschlagen', ''], [-32, 'Interview', ''], [-25, 'Vermittelt', 'Zusage.']], { honorar: 15200, startdatum: d(-20) }),
  ];

  const asg = (p: Partial<Assignment> & Pick<Assignment, 'id' | 'nr' | 'candidateId' | 'companyId' | 'funktion' | 'start' | 'stundenlohn' | 'tarif'>): Assignment => ({
    jobId: '', einsatzort: '', ende: '', sollStunden: 42, status: 'Aktiv', notiz: '', createdAt: `${p.start}T08:00`, updatedAt: `${p.start}T08:00`, ...p,
  });

  const assignments: Assignment[] = [
    asg({ id: 'e1', nr: 'E-4001', candidateId: 'c15', companyId: 'f7', jobId: 'j3', funktion: 'Servicetechniker PV-Montage', einsatzort: 'Winterthur & Region',
      start: startOfWeek(d(-75)), ende: d(10), stundenlohn: 36, tarif: 58.5, notiz: 'Verlängerung mit Herrn Stalder besprechen.' }),
    asg({ id: 'e2', nr: 'E-4002', candidateId: 'c9', companyId: 'f9', funktion: 'Polymechaniker CNC (Schicht)', einsatzort: 'Steinhausen',
      start: startOfWeek(d(-40)), stundenlohn: 38, tarif: 62, sollStunden: 40 }),
    asg({ id: 'e3', nr: 'E-4003', candidateId: 'c13', companyId: 'f5', jobId: 'j8', funktion: 'Logistiker Zentrallager', einsatzort: 'Basel Hafen',
      start: startOfWeek(d(14)), ende: d(14 + 180), stundenlohn: 29, tarif: 46.5, status: 'Geplant' }),
    asg({ id: 'e4', nr: 'E-4004', candidateId: 'c13', companyId: 'f5', funktion: 'Kommissionierung Saisonspitze', einsatzort: 'Basel Hafen',
      start: startOfWeek(d(-160)), ende: d(-70), stundenlohn: 28, tarif: 45, status: 'Beendet' }),
  ];

  // Rapporte: alle Wochen von Einsatzbeginn bis heute bzw. Einsatzende
  const timesheets: Timesheet[] = [];
  const thisWeek = startOfWeek(today);
  const lastWeek = addDays(thisWeek, -7);
  const curMonth = monthKey(today);
  const patterns = [[8.5, 8.5, 8.5, 8.5, 8, 0, 0], [8.5, 8.5, 9, 8.5, 7.5, 0, 0], [8, 8.5, 8.5, 8.5, 8.5, 0, 0], [9, 8.5, 8.5, 8, 8, 0, 0]];
  for (const a of assignments) {
    if (a.status === 'Geplant') continue;
    const endWeek = a.ende && a.ende < today ? startOfWeek(a.ende) : thisWeek;
    let i = 0;
    for (let w = a.start; w <= endWeek; w = addDays(w, 7), i++) {
      const isThis = w === thisWeek;
      let status: Timesheet['status'];
      if (isThis) status = 'Offen';
      else if (w === lastWeek) status = a.id === 'e1' ? 'Eingereicht' : 'Offen';
      else if (monthKey(w) < curMonth) status = 'Verrechnet';
      else status = 'Freigegeben';
      const base = patterns[i % patterns.length].map((h) => (a.sollStunden === 40 ? Math.min(h, 8) : h));
      // laufende Woche: nur bisher gearbeitete Tage
      const todayIdx = daysBetween(thisWeek, today);
      const stunden = isThis ? base.map((h, idx) => (idx < todayIdx ? h : 0)) : status === 'Offen' && a.id === 'e2' ? base.map(() => 0) : base;
      timesheets.push({
        id: `t-${a.id}-${w}`, assignmentId: a.id, woche: w, stunden, spesen: i % 3 === 0 && status !== 'Offen' ? 45 : 0,
        status, notiz: '', invoiceId: '', updatedAt: `${addDays(w, 5)}T17:00`,
      });
    }
  }

  // Rechnungen: Verleih pro Kunde und Monat aus verrechneten Rapporten
  const settings = {
    firmenname: 'PersoCRM Personalberatung AG', strasse: 'Löwenstrasse 25', plz: '8001', ort: 'Zürich', telefon: '+41 44 210 30 30',
    email: 'info@persocrm.ch', website: 'www.persocrm.ch', uid: 'CHE-123.456.789 MWST', iban: 'CH93 0076 2011 6238 5295 7',
    mwstSatz: 8.1, autoFollowup: true, followupTage: 3, tarif: { ...DEFAULT_TARIFF_RATES },
  };

  const invoices: Invoice[] = [];
  let rNr = 5000;
  const verrechnet = timesheets.filter((t) => t.status === 'Verrechnet');
  const groups = new Map<string, Timesheet[]>();
  for (const t of verrechnet) {
    const a = assignments.find((x) => x.id === t.assignmentId)!;
    const key = `${a.companyId}|${monthKey(t.woche)}`;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  const monthsAgo = (periode: string) => {
    const [y, m] = periode.split('-').map(Number);
    const [cy, cm] = curMonth.split('-').map(Number);
    return (cy - y) * 12 + (cm - m);
  };
  for (const [key, ts] of [...groups.entries()].sort((a, b) => a[0].split('|')[1].localeCompare(b[0].split('|')[1]))) {
    const [companyId, periode] = key.split('|');
    const company = companies.find((c) => c.id === companyId)!;
    const datum = `${addDays(`${periode}-01`, 32).slice(0, 7)}-01`; // 1. des Folgemonats
    const draft = buildVerleihInvoice(company, ts, assignments, candidates, settings, datum);
    const ago = monthsAgo(periode);
    const status: Invoice['status'] = ago >= 3 ? 'Bezahlt' : ago === 2 && companyId !== 'f7' ? 'Bezahlt' : 'Offen';
    const id = `r${++rNr}`;
    invoices.push({ ...draft, id, nr: `R-${rNr}`, status, bezahltAm: status === 'Bezahlt' ? addDays(datum, 18) : '', createdAt: `${datum}T08:00` });
    ts.forEach((t) => (t.invoiceId = id));
  }

  // Honorar-Rechnungen
  for (const [pid, status] of [['p11', 'Bezahlt'], ['p1', 'Bezahlt'], ['p13', 'Offen']] as const) {
    const p = placements.find((x) => x.id === pid)!;
    const j = jobs.find((x) => x.id === p.jobId)!;
    const c = companies.find((x) => x.id === j.companyId)!;
    const k = candidates.find((x) => x.id === p.candidateId)!;
    const datum = p.startdatum || p.updatedAt.slice(0, 10);
    const draft = buildHonorarInvoice(p, j, c, k, settings, datum);
    invoices.push({ ...draft, id: `r${++rNr}`, nr: `R-${rNr}`, status, bezahltAm: status === 'Bezahlt' ? addDays(datum, 21) : '', createdAt: `${datum}T08:00` });
  }

  const act = (id: string, p: Partial<Activity> & Pick<Activity, 'typ' | 'betreff'>, created: number): Activity => ({
    id, beschreibung: '', faelligAm: '', erledigt: false, bezug: null, userId: 'u2', auto: false, createdAt: dt(-created, 8), ...p,
  });

  const activities: Activity[] = [
    act('a1', { typ: 'Anruf', betreff: 'Rückruf Simone Vogel (TechNova)', beschreibung: 'Feedback zum Zweitgespräch Brunner einholen.', faelligAm: dt(0, 10, 30), bezug: { typ: 'company', id: 'f2' } }, 1),
    act('a2', { typ: 'Termin', betreff: 'Zweitgespräch Lukas Brunner bei TechNova', beschreibung: 'Mit CTO, vor Ort in Zug. Kandidat vorbereiten.', faelligAm: dt(2, 14), bezug: { typ: 'candidate', id: 'c1' } }, 3),
    act('a3', { typ: 'Aufgabe', betreff: 'Referenzen einholen Sarah Baumann', beschreibung: 'Zwei Referenzen telefonisch prüfen.', faelligAm: dt(-1, 17), bezug: { typ: 'candidate', id: 'c4' }, userId: 'u3' }, 5),
    act('a4', { typ: 'Aufgabe', betreff: 'Erstgespräch Corinne Widmer', beschreibung: 'Erstgespräch führen und Kurzprofil erstellen.', faelligAm: dt(1, 9), bezug: { typ: 'candidate', id: 'c10' }, userId: 'u3' }, 2),
    act('a5', { typ: 'Anruf', betreff: 'Follow-up Franco Bianchi (Gastro Seeblick)', beschreibung: 'Auftragsklärung Saisonstelle, Honorarsatz besprechen.', faelligAm: dt(3, 11), bezug: { typ: 'company', id: 'f6' }, userId: 'u3' }, 4),
    act('a6', { typ: 'Termin', betreff: 'Probetag David Steiner bei ElektroPlus', beschreibung: 'Treffpunkt 07:00 Magazin Winterthur.', faelligAm: dt(4, 7), bezug: { typ: 'candidate', id: 'c3' } }, 2),
    act('a7', { typ: 'E-Mail', betreff: 'Offerte Spital Limmattal nachfassen', beschreibung: 'Entscheid Nina Keller bis Ende Woche zugesagt.', faelligAm: dt(1, 8, 30), bezug: { typ: 'job', id: 'j2' }, userId: 'u3' }, 1),
    act('a8', { typ: 'Aufgabe', betreff: 'Verlängerung Einsatz Adrian Schmid klären', beschreibung: 'Einsatz endet bald – Bedarf bei ElektroPlus abfragen.', faelligAm: dt(2, 9), bezug: { typ: 'assignment', id: 'e1' } }, 2),
    act('a9', { typ: 'Anruf', betreff: 'Rapport Reto Zimmermann einfordern', beschreibung: 'Stunden der Vorwoche fehlen.', faelligAm: dt(0, 16), bezug: { typ: 'assignment', id: 'e2' } }, 1),
    act('a10', { typ: 'Notiz', betreff: 'Bachmann: Diskretion beachten', beschreibung: 'Ungekündigte Stellung – keine Weitergabe ohne Rücksprache.', erledigt: true, bezug: { typ: 'candidate', id: 'c11' } }, 28),
    act('a11', { typ: 'Termin', betreff: 'Quartalsmeeting Helvetia Bau', beschreibung: 'Review Rahmenvertrag, Personalplanung.', faelligAm: dt(7, 10), bezug: { typ: 'company', id: 'f1' } }, 10),
    act('a12', { typ: 'E-Mail', betreff: 'Einsatzvertrag an Stefan Wyss', beschreibung: 'Vertrag Muster Logistik zustellen.', faelligAm: dt(1, 14), bezug: { typ: 'candidate', id: 'c13' } }, 1),
    act('a13', { typ: 'Aufgabe', betreff: 'Inserat V-3007 auf jobs.ch prüfen', beschreibung: 'Laufzeit verlängern, Klickzahlen auswerten.', faelligAm: dt(2, 10), bezug: { typ: 'job', id: 'j7' }, userId: 'u3' }, 5),
    act('a14', { typ: 'Aufgabe', betreff: 'Datenschutz-Einwilligung Julia Graf', beschreibung: 'Einwilligung zur Dossierweitergabe einholen (DSG).', faelligAm: dt(-2, 12), bezug: { typ: 'candidate', id: 'c8' }, userId: 'u3' }, 3),
    act('a15', { typ: 'Termin', betreff: 'Besichtigung Lager Basel', beschreibung: 'Mit Frau Berger Einsatzort besichtigen.', faelligAm: dt(9, 13, 30), bezug: { typ: 'company', id: 'f5' } }, 6),
    act('a16', { typ: 'E-Mail', betreff: 'Monatsreport an Geschäftsleitung', beschreibung: 'KPIs zusammenstellen und versenden.', faelligAm: dt(-3, 17), erledigt: true, userId: 'u1' }, 8),
  ];

  return {
    users, candidates, companies, jobs, placements, assignments, timesheets, invoices, activities,
    audit: [{ id: 'log0', ts: `${today}T07:00`, userId: 'u1', entity: 'system', entityId: '', text: 'Demo-Daten geladen' }],
    settings,
    counters: { K: 1020, F: 2009, V: 3010, E: 4004, R: rNr },
  };
}
