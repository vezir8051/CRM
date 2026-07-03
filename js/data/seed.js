/* ============================================================
   PersoCRM – Demo-Daten (Seed)
   Alle Datumsangaben werden relativ zum heutigen Datum erzeugt,
   damit die Demo immer aktuell wirkt.
   ============================================================ */
window.Seed = (() => {

  function iso(d) { return d.toISOString().slice(0, 10); }
  function daysFromNow(n) { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); }
  function daysAgo(n) { return daysFromNow(-n); }
  function dt(daysOffset, hour, minute) {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    d.setHours(hour || 9, minute || 0, 0, 0);
    const p = (x) => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function create() {
    const users = [
      { id: 1, username: 'admin',    password: 'admin', name: 'Sandra Meier',  rolle: 'Administrator', email: 'sandra.meier@persocrm.ch',  farbe: '#2563eb' },
      { id: 2, username: 'mmueller', password: 'demo',  name: 'Marco Müller',  rolle: 'Berater',       email: 'marco.mueller@persocrm.ch', farbe: '#7c3aed' },
      { id: 3, username: 'lweber',   password: 'demo',  name: 'Laura Weber',   rolle: 'Beraterin',     email: 'laura.weber@persocrm.ch',   farbe: '#0e7490' }
    ];

    const candidates = [
      { id: 101, nr: 'K-1001', anrede: 'Herr', vorname: 'Lukas', nachname: 'Brunner', email: 'lukas.brunner@mail.ch', telefon: '+41 79 512 33 41', geburtsdatum: '1990-04-12', strasse: 'Seestrasse 14', plz: '8038', ort: 'Zürich',
        beruf: 'Softwareentwickler', qualifikationen: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'SQL'], sprachen: [{ sprache: 'Deutsch', niveau: 'Muttersprache' }, { sprache: 'Englisch', niveau: 'C1' }],
        ausbildung: 'BSc Informatik, ZHAW', berufserfahrung: 8, verfuegbarAb: daysFromNow(30), pensum: '100%', anstellungsart: 'Festanstellung', lohnvorstellung: 110000,
        status: 'Aktiv', quelle: 'jobs.ch', betreuerId: 2, notizen: 'Sehr kommunikativ, sucht neue Herausforderung im Fintech-Umfeld.',
        dokumente: [{ id: 1, name: 'Lebenslauf_Brunner.pdf', typ: 'Lebenslauf', datum: daysAgo(40) }, { id: 2, name: 'Arbeitszeugnis_TechAG.pdf', typ: 'Arbeitszeugnis', datum: daysAgo(40) }], erstelltAm: daysAgo(45) },
      { id: 102, nr: 'K-1002', anrede: 'Frau', vorname: 'Nina', nachname: 'Keller', email: 'nina.keller@bluewin.ch', telefon: '+41 78 224 91 07', geburtsdatum: '1993-09-02', strasse: 'Bahnhofweg 3', plz: '6003', ort: 'Luzern',
        beruf: 'Pflegefachfrau HF', qualifikationen: ['Akutpflege', 'Notfallpflege', 'Wunddokumentation', 'BLS-AED'], sprachen: [{ sprache: 'Deutsch', niveau: 'Muttersprache' }, { sprache: 'Französisch', niveau: 'B2' }],
        ausbildung: 'Dipl. Pflegefachfrau HF', berufserfahrung: 6, verfuegbarAb: daysFromNow(60), pensum: '80-100%', anstellungsart: 'Festanstellung', lohnvorstellung: 85000,
        status: 'Aktiv', quelle: 'Empfehlung', betreuerId: 3, notizen: 'Bevorzugt Region Zentralschweiz, Schichtbereitschaft vorhanden.',
        dokumente: [{ id: 1, name: 'CV_Keller_2026.pdf', typ: 'Lebenslauf', datum: daysAgo(30) }], erstelltAm: daysAgo(38) },
      { id: 103, nr: 'K-1003', anrede: 'Herr', vorname: 'David', nachname: 'Steiner', email: 'd.steiner@gmx.ch', telefon: '+41 76 330 18 52', geburtsdatum: '1987-01-25', strasse: 'Industriestrasse 22', plz: '8404', ort: 'Winterthur',
        beruf: 'Elektroinstallateur EFZ', qualifikationen: ['Elektroinstallation', 'NIN-Kenntnisse', 'Störungsbehebung', 'Photovoltaik'], sprachen: [{ sprache: 'Deutsch', niveau: 'Muttersprache' }],
        ausbildung: 'Elektroinstallateur EFZ', berufserfahrung: 12, verfuegbarAb: daysFromNow(14), pensum: '100%', anstellungsart: 'Temporär', lohnvorstellung: 78000,
        status: 'Aktiv', quelle: 'Website', betreuerId: 2, notizen: 'Sofort verfügbar nach Kündigungsfrist, eigener Werkzeugkoffer, Führerschein B.',
        dokumente: [{ id: 1, name: 'Lebenslauf_Steiner.pdf', typ: 'Lebenslauf', datum: daysAgo(20) }], erstelltAm: daysAgo(25) },
      { id: 104, nr: 'K-1004', anrede: 'Frau', vorname: 'Sarah', nachname: 'Baumann', email: 'sarah.baumann@outlook.com', telefon: '+41 79 667 44 20', geburtsdatum: '1995-06-17', strasse: 'Rosenweg 8', plz: '3013', ort: 'Bern',
        beruf: 'Buchhalterin', qualifikationen: ['Finanzbuchhaltung', 'Abacus', 'MWST-Abrechnung', 'Lohnbuchhaltung', 'Jahresabschluss'], sprachen: [{ sprache: 'Deutsch', niveau: 'Muttersprache' }, { sprache: 'Englisch', niveau: 'B2' }],
        ausbildung: 'Fachausweis Finanz- und Rechnungswesen', berufserfahrung: 7, verfuegbarAb: daysFromNow(90), pensum: '80%', anstellungsart: 'Festanstellung', lohnvorstellung: 92000,
        status: 'In Prüfung', quelle: 'LinkedIn', betreuerId: 3, notizen: 'Kündigungsfrist 3 Monate. Referenzen ausstehend.',
        dokumente: [{ id: 1, name: 'CV_Baumann.pdf', typ: 'Lebenslauf', datum: daysAgo(10) }, { id: 2, name: 'Diplom_Fachausweis.pdf', typ: 'Diplom', datum: daysAgo(10) }], erstelltAm: daysAgo(12) },
      { id: 105, nr: 'K-1005', anrede: 'Herr', vorname: 'Thomas', nachname: 'Huber', email: 'thomas.huber@sunrise.ch', telefon: '+41 78 901 27 65', geburtsdatum: '1982-11-30', strasse: 'Dorfstrasse 45', plz: '5000', ort: 'Aarau',
        beruf: 'Projektleiter Hochbau', qualifikationen: ['Bauleitung', 'Projektmanagement', 'Kostenkontrolle', 'SIA-Normen', 'MS Project'], sprachen: [{ sprache: 'Deutsch', niveau: 'Muttersprache' }, { sprache: 'Italienisch', niveau: 'B1' }],
        ausbildung: 'Dipl. Bauleiter HF', berufserfahrung: 16, verfuegbarAb: daysFromNow(45), pensum: '100%', anstellungsart: 'Festanstellung', lohnvorstellung: 125000,
        status: 'Vermittelt', quelle: 'jobs.ch', betreuerId: 2, notizen: 'Erfolgreich vermittelt an Helvetia Bau AG.',
        dokumente: [{ id: 1, name: 'Dossier_Huber.pdf', typ: 'Lebenslauf', datum: daysAgo(120) }], erstelltAm: daysAgo(130) },
      { id: 106, nr: 'K-1006', anrede: 'Frau', vorname: 'Elena', nachname: 'Rossi', email: 'elena.rossi@icloud.com', telefon: '+41 76 118 90 34', geburtsdatum: '1991-03-08', strasse: 'Via Monte 6', plz: '4051', ort: 'Basel',
        beruf: 'Marketing Managerin', qualifikationen: ['Digital Marketing', 'SEO/SEA', 'Content Marketing', 'Google Analytics', 'Social Media'], sprachen: [{ sprache: 'Deutsch', niveau: 'C2' }, { sprache: 'Italienisch', niveau: 'Muttersprache' }, { sprache: 'Englisch', niveau: 'C1' }],
        ausbildung: 'MSc Marketing, Universität Basel', berufserfahrung: 5, verfuegbarAb: daysFromNow(30), pensum: '80-100%', anstellungsart: 'Festanstellung', lohnvorstellung: 98000,
        status: 'Aktiv', quelle: 'LinkedIn', betreuerId: 3, notizen: 'Starkes Portfolio im B2B-Bereich, wünscht Homeoffice-Anteil.',
        dokumente: [{ id: 1, name: 'CV_Rossi_DE.pdf', typ: 'Lebenslauf', datum: daysAgo(18) }], erstelltAm: daysAgo(22) },
      { id: 107, nr: 'K-1007', anrede: 'Herr', vorname: 'Pascal', nachname: 'Frei', email: 'pascal.frei@hispeed.ch', telefon: '+41 79 445 12 88', geburtsdatum: '1998-08-21', strasse: 'Lindenhof 2', plz: '8400', ort: 'Winterthur',
        beruf: 'ICT-Supporter', qualifikationen: ['1st/2nd Level Support', 'Windows Server', 'Microsoft 365', 'Active Directory', 'ITIL'], sprachen: [{ sprache: 'Deutsch', niveau: 'Muttersprache' }, { sprache: 'Englisch', niveau: 'B2' }],
        ausbildung: 'Informatiker EFZ Systemtechnik', berufserfahrung: 4, verfuegbarAb: daysFromNow(7), pensum: '100%', anstellungsart: 'Try & Hire', lohnvorstellung: 72000,
        status: 'Aktiv', quelle: 'Website', betreuerId: 2, notizen: 'Sehr motiviert, kurzfristig verfügbar.',
        dokumente: [], erstelltAm: daysAgo(9) },
      { id: 108, nr: 'K-1008', anrede: 'Frau', vorname: 'Julia', nachname: 'Graf', email: 'julia.graf@bluewin.ch', telefon: '+41 78 559 30 71', geburtsdatum: '1989-12-05', strasse: 'Hauptgasse 19', plz: '4500', ort: 'Solothurn',
        beruf: 'HR-Fachfrau', qualifikationen: ['Rekrutierung', 'Personaladministration', 'Sozialversicherungen', 'SAP HCM', 'Arbeitsrecht'], sprachen: [{ sprache: 'Deutsch', niveau: 'Muttersprache' }, { sprache: 'Französisch', niveau: 'C1' }],
        ausbildung: 'HR-Fachfrau mit eidg. Fachausweis', berufserfahrung: 9, verfuegbarAb: daysFromNow(60), pensum: '60-80%', anstellungsart: 'Festanstellung', lohnvorstellung: 88000,
        status: 'In Prüfung', quelle: 'Empfehlung', betreuerId: 3, notizen: 'Sucht Teilzeitstelle mit Verantwortung, zweisprachig DE/FR.',
        dokumente: [{ id: 1, name: 'Bewerbungsdossier_Graf.pdf', typ: 'Lebenslauf', datum: daysAgo(6) }], erstelltAm: daysAgo(7) },
      { id: 109, nr: 'K-1009', anrede: 'Herr', vorname: 'Reto', nachname: 'Zimmermann', email: 'reto.zimmermann@gmail.com', telefon: '+41 76 882 45 09', geburtsdatum: '1985-05-14', strasse: 'Feldweg 31', plz: '6300', ort: 'Zug',
        beruf: 'Polymechaniker EFZ', qualifikationen: ['CNC-Fräsen', 'CNC-Drehen', 'CAD/CAM', 'Qualitätskontrolle', 'Heidenhain'], sprachen: [{ sprache: 'Deutsch', niveau: 'Muttersprache' }],
        ausbildung: 'Polymechaniker EFZ', berufserfahrung: 14, verfuegbarAb: daysFromNow(0), pensum: '100%', anstellungsart: 'Temporär', lohnvorstellung: 82000,
        status: 'Aktiv', quelle: 'jobs.ch', betreuerId: 2, notizen: 'Sofort verfügbar, Schichtarbeit möglich.',
        dokumente: [{ id: 1, name: 'CV_Zimmermann.pdf', typ: 'Lebenslauf', datum: daysAgo(15) }], erstelltAm: daysAgo(16) },
      { id: 110, nr: 'K-1010', anrede: 'Frau', vorname: 'Corinne', nachname: 'Widmer', email: 'c.widmer@bluemail.ch', telefon: '+41 79 210 66 43', geburtsdatum: '1994-02-27', strasse: 'Bergstrasse 7', plz: '7000', ort: 'Chur',
        beruf: 'Sachbearbeiterin Treuhand', qualifikationen: ['Treuhand', 'Steuererklärungen', 'Abacus', 'Debitoren/Kreditoren', 'Revision'], sprachen: [{ sprache: 'Deutsch', niveau: 'Muttersprache' }, { sprache: 'Rätoromanisch', niveau: 'Muttersprache' }],
        ausbildung: 'Kauffrau EFZ, Treuhand-Assistentin', berufserfahrung: 5, verfuegbarAb: daysFromNow(30), pensum: '100%', anstellungsart: 'Festanstellung', lohnvorstellung: 75000,
        status: 'Neu', quelle: 'Website', betreuerId: 3, notizen: 'Erstgespräch noch nicht erfolgt.',
        dokumente: [{ id: 1, name: 'CV_Widmer.pdf', typ: 'Lebenslauf', datum: daysAgo(2) }], erstelltAm: daysAgo(2) },
      { id: 111, nr: 'K-1011', anrede: 'Herr', vorname: 'Michael', nachname: 'Bachmann', email: 'm.bachmann@swissonline.ch', telefon: '+41 78 774 21 90', geburtsdatum: '1980-07-19', strasse: 'Talackerstrasse 55', plz: '8152', ort: 'Glattbrugg',
        beruf: 'Verkaufsleiter', qualifikationen: ['Key Account Management', 'Vertriebsleitung', 'CRM-Systeme', 'Verhandlungsführung', 'B2B-Vertrieb'], sprachen: [{ sprache: 'Deutsch', niveau: 'Muttersprache' }, { sprache: 'Englisch', niveau: 'C1' }, { sprache: 'Französisch', niveau: 'B2' }],
        ausbildung: 'Verkaufsleiter mit eidg. Diplom', berufserfahrung: 18, verfuegbarAb: daysFromNow(90), pensum: '100%', anstellungsart: 'Festanstellung', lohnvorstellung: 140000,
        status: 'Aktiv', quelle: 'Headhunting', betreuerId: 2, notizen: 'Diskret behandeln – aktuell in ungekündigter Stellung.',
        dokumente: [{ id: 1, name: 'Profil_Bachmann.pdf', typ: 'Lebenslauf', datum: daysAgo(28) }], erstelltAm: daysAgo(33) },
      { id: 112, nr: 'K-1012', anrede: 'Frau', vorname: 'Vanessa', nachname: 'Koch', email: 'vanessa.koch@gmail.com', telefon: '+41 76 651 08 27', geburtsdatum: '1997-10-03', strasse: 'Mühlegasse 12', plz: '9000', ort: 'St. Gallen',
        beruf: 'Data Analystin', qualifikationen: ['Python', 'SQL', 'Power BI', 'Tableau', 'Statistik'], sprachen: [{ sprache: 'Deutsch', niveau: 'Muttersprache' }, { sprache: 'Englisch', niveau: 'C2' }],
        ausbildung: 'MSc Data Science, Universität St. Gallen', berufserfahrung: 3, verfuegbarAb: daysFromNow(30), pensum: '80-100%', anstellungsart: 'Festanstellung', lohnvorstellung: 95000,
        status: 'Aktiv', quelle: 'LinkedIn', betreuerId: 3, notizen: 'Top-Profil, mehrere Interessenten.',
        dokumente: [{ id: 1, name: 'CV_Koch_EN.pdf', typ: 'Lebenslauf', datum: daysAgo(11) }], erstelltAm: daysAgo(14) },
      { id: 113, nr: 'K-1013', anrede: 'Herr', vorname: 'Stefan', nachname: 'Wyss', email: 'stefan.wyss@gmx.ch', telefon: '+41 79 093 55 12', geburtsdatum: '1992-01-09', strasse: 'Unterdorf 3', plz: '3600', ort: 'Thun',
        beruf: 'Logistiker EFZ', qualifikationen: ['Lagerbewirtschaftung', 'Staplerausweis', 'SAP WM', 'Kommissionierung', 'Zolldeklaration'], sprachen: [{ sprache: 'Deutsch', niveau: 'Muttersprache' }],
        ausbildung: 'Logistiker EFZ', berufserfahrung: 8, verfuegbarAb: daysFromNow(14), pensum: '100%', anstellungsart: 'Temporär', lohnvorstellung: 68000,
        status: 'Aktiv', quelle: 'jobs.ch', betreuerId: 2, notizen: 'Staplerausweis R1/R2, bereit für Schichtarbeit.',
        dokumente: [], erstelltAm: daysAgo(19) },
      { id: 114, nr: 'K-1014', anrede: 'Frau', vorname: 'Andrea', nachname: 'Lüthi', email: 'andrea.luethi@bluewin.ch', telefon: '+41 78 336 74 58', geburtsdatum: '1988-04-22', strasse: 'Kirchplatz 5', plz: '8500', ort: 'Frauenfeld',
        beruf: 'Köchin EFZ', qualifikationen: ['À-la-carte-Küche', 'Bankett', 'Menüplanung', 'HACCP', 'Diätküche'], sprachen: [{ sprache: 'Deutsch', niveau: 'Muttersprache' }, { sprache: 'Französisch', niveau: 'A2' }],
        ausbildung: 'Köchin EFZ', berufserfahrung: 11, verfuegbarAb: daysFromNow(30), pensum: '100%', anstellungsart: 'Festanstellung', lohnvorstellung: 62000,
        status: 'Inaktiv', quelle: 'Website', betreuerId: 3, notizen: 'Aktuell nicht auf Stellensuche – Wiedervorlage in 6 Monaten.',
        dokumente: [{ id: 1, name: 'CV_Luethi.pdf', typ: 'Lebenslauf', datum: daysAgo(200) }], erstelltAm: daysAgo(210) },
      { id: 115, nr: 'K-1015', anrede: 'Herr', vorname: 'Adrian', nachname: 'Schmid', email: 'adrian.schmid@mail.ch', telefon: '+41 76 402 89 31', geburtsdatum: '1996-11-11', strasse: 'Weiherweg 27', plz: '4600', ort: 'Olten',
        beruf: 'Servicetechniker', qualifikationen: ['Wartung & Instandhaltung', 'Hydraulik', 'Pneumatik', 'Elektrotechnik', 'Kundendienst'], sprachen: [{ sprache: 'Deutsch', niveau: 'Muttersprache' }, { sprache: 'Englisch', niveau: 'B1' }],
        ausbildung: 'Automatiker EFZ', berufserfahrung: 6, verfuegbarAb: daysFromNow(45), pensum: '100%', anstellungsart: 'Festanstellung', lohnvorstellung: 80000,
        status: 'Aktiv', quelle: 'Empfehlung', betreuerId: 2, notizen: 'Reisebereitschaft ganze Deutschschweiz.',
        dokumente: [{ id: 1, name: 'CV_Schmid.pdf', typ: 'Lebenslauf', datum: daysAgo(5) }], erstelltAm: daysAgo(6) },
      { id: 116, nr: 'K-1016', anrede: 'Frau', vorname: 'Melanie', nachname: 'Hofer', email: 'melanie.hofer@icloud.com', telefon: '+41 79 728 16 02', geburtsdatum: '1999-03-30', strasse: 'Gartenstrasse 9', plz: '2502', ort: 'Biel',
        beruf: 'Kauffrau EFZ', qualifikationen: ['Administration', 'Korrespondenz DE/FR', 'MS Office', 'Empfang', 'Offertwesen'], sprachen: [{ sprache: 'Deutsch', niveau: 'Muttersprache' }, { sprache: 'Französisch', niveau: 'C1' }],
        ausbildung: 'Kauffrau EFZ E-Profil', berufserfahrung: 3, verfuegbarAb: daysFromNow(14), pensum: '80-100%', anstellungsart: 'Try & Hire', lohnvorstellung: 60000,
        status: 'Neu', quelle: 'jobs.ch', betreuerId: 3, notizen: '',
        dokumente: [{ id: 1, name: 'CV_Hofer.pdf', typ: 'Lebenslauf', datum: daysAgo(1) }], erstelltAm: daysAgo(1) }
    ];

    const companies = [
      { id: 201, nr: 'F-2001', name: 'Helvetia Bau AG', branche: 'Bauwesen', strasse: 'Baslerstrasse 101', plz: '8048', ort: 'Zürich', telefon: '+41 44 555 20 20', email: 'info@helvetiabau.ch', website: 'www.helvetiabau.ch',
        status: 'Aktiv', honorarSatz: 25, betreuerId: 2, notizen: 'Langjähriger Kunde, Rahmenvertrag seit 2022. Wachstum im Bereich Umbau/Renovation.',
        ansprechpartner: [
          { id: 1, anrede: 'Herr', vorname: 'Beat', nachname: 'Odermatt', funktion: 'Leiter HR', email: 'b.odermatt@helvetiabau.ch', telefon: '+41 44 555 20 21' },
          { id: 2, anrede: 'Frau', vorname: 'Petra', nachname: 'Gasser', funktion: 'HR Business Partnerin', email: 'p.gasser@helvetiabau.ch', telefon: '+41 44 555 20 22' }
        ], erstelltAm: daysAgo(400) },
      { id: 202, nr: 'F-2002', name: 'TechNova GmbH', branche: 'Informatik / Software', strasse: 'Innovationspark 7', plz: '6300', ort: 'Zug', telefon: '+41 41 720 88 00', email: 'hr@technova.ch', website: 'www.technova.ch',
        status: 'Aktiv', honorarSatz: 28, betreuerId: 2, notizen: 'Fintech-Scale-up, stellt laufend Entwickler ein. Schnelle Entscheidungswege.',
        ansprechpartner: [
          { id: 1, anrede: 'Frau', vorname: 'Simone', nachname: 'Vogel', funktion: 'Head of Talent', email: 's.vogel@technova.ch', telefon: '+41 41 720 88 01' }
        ], erstelltAm: daysAgo(280) },
      { id: 203, nr: 'F-2003', name: 'Spital Limmattal', branche: 'Gesundheitswesen', strasse: 'Urdorferstrasse 100', plz: '8952', ort: 'Schlieren', telefon: '+41 44 733 11 11', email: 'personal@spital-limmattal.ch', website: 'www.spital-limmattal.ch',
        status: 'Aktiv', honorarSatz: 22, betreuerId: 3, notizen: 'Hoher Bedarf an Pflegepersonal, auch Temporäreinsätze.',
        ansprechpartner: [
          { id: 1, anrede: 'Herr', vorname: 'Daniel', nachname: 'Furrer', funktion: 'Personalleiter', email: 'd.furrer@spital-limmattal.ch', telefon: '+41 44 733 11 22' },
          { id: 2, anrede: 'Frau', vorname: 'Rita', nachname: 'Anderhub', funktion: 'Leiterin Pflege', email: 'r.anderhub@spital-limmattal.ch', telefon: '+41 44 733 11 33' }
        ], erstelltAm: daysAgo(350) },
      { id: 204, nr: 'F-2004', name: 'Alpina Treuhand AG', branche: 'Treuhand / Revision', strasse: 'Pilatusstrasse 18', plz: '6003', ort: 'Luzern', telefon: '+41 41 210 45 45', email: 'info@alpina-treuhand.ch', website: 'www.alpina-treuhand.ch',
        status: 'Aktiv', honorarSatz: 25, betreuerId: 3, notizen: 'Sucht regelmässig Fachkräfte im Finanz- und Treuhandbereich.',
        ansprechpartner: [
          { id: 1, anrede: 'Herr', vorname: 'Urs', nachname: 'Kaufmann', funktion: 'Partner', email: 'u.kaufmann@alpina-treuhand.ch', telefon: '+41 41 210 45 46' }
        ], erstelltAm: daysAgo(190) },
      { id: 205, nr: 'F-2005', name: 'Muster Logistik AG', branche: 'Logistik / Transport', strasse: 'Hafenstrasse 66', plz: '4057', ort: 'Basel', telefon: '+41 61 631 77 77', email: 'jobs@musterlogistik.ch', website: 'www.musterlogistik.ch',
        status: 'Aktiv', honorarSatz: 20, betreuerId: 2, notizen: 'Grosser Temporär-Bedarf in Stosszeiten (Q4).',
        ansprechpartner: [
          { id: 1, anrede: 'Frau', vorname: 'Claudia', nachname: 'Berger', funktion: 'HR-Verantwortliche', email: 'c.berger@musterlogistik.ch', telefon: '+41 61 631 77 78' }
        ], erstelltAm: daysAgo(160) },
      { id: 206, nr: 'F-2006', name: 'Gastro Seeblick GmbH', branche: 'Gastronomie / Hotellerie', strasse: 'Seepromenade 2', plz: '3600', ort: 'Thun', telefon: '+41 33 222 90 90', email: 'info@seeblick-thun.ch', website: 'www.seeblick-thun.ch',
        status: 'Interessent', honorarSatz: 18, betreuerId: 3, notizen: 'Erstkontakt an der Gastro-Messe. Noch kein Auftrag erteilt.',
        ansprechpartner: [
          { id: 1, anrede: 'Herr', vorname: 'Franco', nachname: 'Bianchi', funktion: 'Geschäftsführer', email: 'f.bianchi@seeblick-thun.ch', telefon: '+41 33 222 90 91' }
        ], erstelltAm: daysAgo(35) },
      { id: 207, nr: 'F-2007', name: 'ElektroPlus AG', branche: 'Elektroinstallation', strasse: 'Zürcherstrasse 210', plz: '8406', ort: 'Winterthur', telefon: '+41 52 208 33 33', email: 'personal@elektroplus.ch', website: 'www.elektroplus.ch',
        status: 'Aktiv', honorarSatz: 23, betreuerId: 2, notizen: 'Wächst stark im Bereich Photovoltaik, sucht laufend Monteure.',
        ansprechpartner: [
          { id: 1, anrede: 'Herr', vorname: 'Roger', nachname: 'Stalder', funktion: 'Geschäftsleiter', email: 'r.stalder@elektroplus.ch', telefon: '+41 52 208 33 34' },
          { id: 2, anrede: 'Frau', vorname: 'Monika', nachname: 'Ryf', funktion: 'Personaladministration', email: 'm.ryf@elektroplus.ch', telefon: '+41 52 208 33 35' }
        ], erstelltAm: daysAgo(220) },
      { id: 208, nr: 'F-2008', name: 'MediCare Services AG', branche: 'Gesundheitswesen', strasse: 'Weltpoststrasse 5', plz: '3015', ort: 'Bern', telefon: '+41 31 350 60 60', email: 'hr@medicare-services.ch', website: 'www.medicare-services.ch',
        status: 'Inaktiv', honorarSatz: 22, betreuerId: 3, notizen: 'Zusammenarbeit pausiert – internes Einstellungsstopp bis Q4.',
        ansprechpartner: [
          { id: 1, anrede: 'Frau', vorname: 'Karin', nachname: 'Aebischer', funktion: 'HR-Leiterin', email: 'k.aebischer@medicare-services.ch', telefon: '+41 31 350 60 61' }
        ], erstelltAm: daysAgo(310) }
    ];

    const vacancies = [
      { id: 301, nr: 'V-3001', titel: 'Senior Softwareentwickler Fullstack', companyId: 202, ansprechpartnerId: 1, einsatzort: 'Zug', pensum: '80-100%', anstellungsart: 'Festanstellung',
        lohnMin: 105000, lohnMax: 125000, anforderungen: ['JavaScript', 'TypeScript', 'React', 'Node.js'], beschreibung: 'Entwicklung der Kern-Plattform (Zahlungsverkehr), Tech-Lead-Perspektive, moderner Stack, Remote-Anteil 60%.',
        status: 'Offen', prioritaet: 'Hoch', deadline: daysFromNow(21), betreuerId: 2, erstelltAm: daysAgo(30) },
      { id: 302, nr: 'V-3002', titel: 'Pflegefachperson HF/FH Notfall', companyId: 203, ansprechpartnerId: 2, einsatzort: 'Schlieren', pensum: '80-100%', anstellungsart: 'Festanstellung',
        lohnMin: 82000, lohnMax: 95000, anforderungen: ['Notfallpflege', 'Akutpflege', 'BLS-AED'], beschreibung: 'Interdisziplinäres Notfallzentrum, 3-Schicht-Betrieb, Zulagen nach GAV.',
        status: 'Offen', prioritaet: 'Hoch', deadline: daysFromNow(14), betreuerId: 3, erstelltAm: daysAgo(25) },
      { id: 303, nr: 'V-3003', titel: 'Elektroinstallateur EFZ Photovoltaik', companyId: 207, ansprechpartnerId: 1, einsatzort: 'Winterthur / Region', pensum: '100%', anstellungsart: 'Temporär',
        lohnMin: 70000, lohnMax: 82000, anforderungen: ['Elektroinstallation', 'Photovoltaik', 'NIN-Kenntnisse'], beschreibung: 'Montage von PV-Anlagen auf EFH/MFH, Einsatz ab sofort, Übernahme in Festanstellung möglich.',
        status: 'In Bearbeitung', prioritaet: 'Hoch', deadline: daysFromNow(7), betreuerId: 2, erstelltAm: daysAgo(20) },
      { id: 304, nr: 'V-3004', titel: 'Buchhalter/in 80%', companyId: 204, ansprechpartnerId: 1, einsatzort: 'Luzern', pensum: '80%', anstellungsart: 'Festanstellung',
        lohnMin: 85000, lohnMax: 95000, anforderungen: ['Finanzbuchhaltung', 'Abacus', 'Jahresabschluss'], beschreibung: 'Selbständige Führung von Kundenbuchhaltungen, Steuererklärungen, direkter Kundenkontakt.',
        status: 'In Bearbeitung', prioritaet: 'Mittel', deadline: daysFromNow(30), betreuerId: 3, erstelltAm: daysAgo(15) },
      { id: 305, nr: 'V-3005', titel: 'Projektleiter Hochbau', companyId: 201, ansprechpartnerId: 1, einsatzort: 'Zürich', pensum: '100%', anstellungsart: 'Festanstellung',
        lohnMin: 115000, lohnMax: 135000, anforderungen: ['Bauleitung', 'Projektmanagement', 'SIA-Normen'], beschreibung: 'Gesamtleitung anspruchsvoller Umbauprojekte, Budgetverantwortung bis CHF 15 Mio.',
        status: 'Besetzt', prioritaet: 'Mittel', deadline: daysAgo(60), betreuerId: 2, erstelltAm: daysAgo(120) },
      { id: 306, nr: 'V-3006', titel: 'ICT-Supporter 1st/2nd Level', companyId: 202, ansprechpartnerId: 1, einsatzort: 'Zug', pensum: '100%', anstellungsart: 'Try & Hire',
        lohnMin: 68000, lohnMax: 78000, anforderungen: ['1st/2nd Level Support', 'Microsoft 365', 'Active Directory'], beschreibung: 'Support für 250 interne User, Onsite & Remote, nach 3 Monaten Übernahme geplant.',
        status: 'Offen', prioritaet: 'Mittel', deadline: daysFromNow(28), betreuerId: 2, erstelltAm: daysAgo(10) },
      { id: 307, nr: 'V-3007', titel: 'Data Analyst (m/w/d)', companyId: 202, ansprechpartnerId: 1, einsatzort: 'Zug / Remote', pensum: '80-100%', anstellungsart: 'Festanstellung',
        lohnMin: 90000, lohnMax: 110000, anforderungen: ['Python', 'SQL', 'Power BI'], beschreibung: 'Aufbau des BI-Teams, Reporting für Management, moderne Datenplattform (Snowflake).',
        status: 'Offen', prioritaet: 'Hoch', deadline: daysFromNow(35), betreuerId: 3, erstelltAm: daysAgo(12) },
      { id: 308, nr: 'V-3008', titel: 'Logistiker EFZ Lager', companyId: 205, ansprechpartnerId: 1, einsatzort: 'Basel', pensum: '100%', anstellungsart: 'Temporär',
        lohnMin: 60000, lohnMax: 70000, anforderungen: ['Lagerbewirtschaftung', 'Staplerausweis', 'Kommissionierung'], beschreibung: 'Verstärkung fürs Zentrallager, 2-Schicht-Betrieb, Einsatzdauer 6 Monate mit Option.',
        status: 'Offen', prioritaet: 'Mittel', deadline: daysFromNow(10), betreuerId: 2, erstelltAm: daysAgo(8) },
      { id: 309, nr: 'V-3009', titel: 'Koch/Köchin EFZ Saisonstelle', companyId: 206, ansprechpartnerId: 1, einsatzort: 'Thun', pensum: '100%', anstellungsart: 'Festanstellung',
        lohnMin: 58000, lohnMax: 66000, anforderungen: ['À-la-carte-Küche', 'Bankett', 'HACCP'], beschreibung: 'Sommersaison am See, Unterkunft vorhanden, junges Team.',
        status: 'On Hold', prioritaet: 'Niedrig', deadline: daysFromNow(45), betreuerId: 3, erstelltAm: daysAgo(18) },
      { id: 310, nr: 'V-3010', titel: 'Sachbearbeiter/in Treuhand', companyId: 204, ansprechpartnerId: 1, einsatzort: 'Luzern', pensum: '100%', anstellungsart: 'Festanstellung',
        lohnMin: 70000, lohnMax: 80000, anforderungen: ['Treuhand', 'Abacus', 'Steuererklärungen'], beschreibung: 'Unterstützung des Mandatsleiters, Debitoren/Kreditoren, Steuererklärungen natürliche Personen.',
        status: 'Offen', prioritaet: 'Mittel', deadline: daysFromNow(40), betreuerId: 3, erstelltAm: daysAgo(5) }
    ];

    // Vermittlungen – verteilt über die letzten Monate für aussagekräftige Auswertungen
    const placements = [
      { id: 401, candidateId: 105, vacancyId: 305, phase: 'Vermittelt', honorar: 31250, startdatum: daysAgo(45), notiz: 'Vertrag unterschrieben, Antritt erfolgt.',
        verlauf: [
          { datum: dt(-110, 10, 0), phase: 'Vorgeschlagen', notiz: 'Dossier an Herrn Odermatt gesendet.' },
          { datum: dt(-95, 14, 0), phase: 'Interview', notiz: 'Erstgespräch vor Ort, sehr positiv.' },
          { datum: dt(-80, 11, 30), phase: 'Angebot', notiz: 'Offerte CHF 128\'000, Bedenkzeit 1 Woche.' },
          { datum: dt(-72, 9, 0), phase: 'Vermittelt', notiz: 'Zusage erhalten, Vertrag unterschrieben.' }
        ], erstelltAm: daysAgo(110) },
      { id: 402, candidateId: 101, vacancyId: 301, phase: 'Interview', honorar: null, startdatum: null, notiz: 'Zweitgespräch mit CTO geplant.',
        verlauf: [
          { datum: dt(-12, 9, 15), phase: 'Vorgeschlagen', notiz: 'Profil anonymisiert vorgestellt.' },
          { datum: dt(-5, 15, 0), phase: 'Interview', notiz: 'Techn. Interview bestanden, Feedback sehr gut.' }
        ], erstelltAm: daysAgo(12) },
      { id: 403, candidateId: 102, vacancyId: 302, phase: 'Angebot', honorar: 19800, startdatum: null, notiz: 'Offerte liegt vor, Kandidatin prüft.',
        verlauf: [
          { datum: dt(-18, 10, 0), phase: 'Vorgeschlagen', notiz: 'Dossier an Frau Anderhub.' },
          { datum: dt(-10, 13, 30), phase: 'Interview', notiz: 'Schnuppertag absolviert.' },
          { datum: dt(-2, 16, 0), phase: 'Angebot', notiz: 'Offerte 88k + Zulagen.' }
        ], erstelltAm: daysAgo(18) },
      { id: 404, candidateId: 103, vacancyId: 303, phase: 'Interview', honorar: null, startdatum: null, notiz: 'Probetag vereinbart.',
        verlauf: [
          { datum: dt(-8, 8, 45), phase: 'Vorgeschlagen', notiz: 'Telefonisch vorgestellt, grosses Interesse.' },
          { datum: dt(-3, 10, 0), phase: 'Interview', notiz: 'Gespräch mit Hr. Stalder, Probetag folgt.' }
        ], erstelltAm: daysAgo(8) },
      { id: 405, candidateId: 104, vacancyId: 304, phase: 'Vorgeschlagen', honorar: null, startdatum: null, notiz: '',
        verlauf: [
          { datum: dt(-4, 11, 0), phase: 'Vorgeschlagen', notiz: 'Dossier eingereicht, Rückmeldung ausstehend.' }
        ], erstelltAm: daysAgo(4) },
      { id: 406, candidateId: 112, vacancyId: 307, phase: 'Interview', honorar: null, startdatum: null, notiz: 'Case Study erhalten.',
        verlauf: [
          { datum: dt(-9, 9, 0), phase: 'Vorgeschlagen', notiz: 'Profil vorgestellt.' },
          { datum: dt(-4, 14, 0), phase: 'Interview', notiz: 'Erstgespräch remote, Case Study folgt.' }
        ], erstelltAm: daysAgo(9) },
      { id: 407, candidateId: 107, vacancyId: 306, phase: 'Vorgeschlagen', honorar: null, startdatum: null, notiz: '',
        verlauf: [
          { datum: dt(-2, 15, 30), phase: 'Vorgeschlagen', notiz: 'Dossier an Frau Vogel gesendet.' }
        ], erstelltAm: daysAgo(2) },
      { id: 408, candidateId: 113, vacancyId: 308, phase: 'Angebot', honorar: 13000, startdatum: null, notiz: 'Einsatzvertrag in Vorbereitung.',
        verlauf: [
          { datum: dt(-6, 10, 0), phase: 'Vorgeschlagen', notiz: 'Telefonische Vorstellung.' },
          { datum: dt(-4, 9, 0), phase: 'Interview', notiz: 'Kurzes Kennenlernen im Lager.' },
          { datum: dt(-1, 11, 0), phase: 'Angebot', notiz: 'Einsatz ab nächstem Monat geplant.' }
        ], erstelltAm: daysAgo(6) },
      { id: 409, candidateId: 109, vacancyId: 303, phase: 'Absage', honorar: null, startdatum: null, notiz: 'Kunde bevorzugt Kandidat mit PV-Erfahrung.',
        verlauf: [
          { datum: dt(-14, 9, 0), phase: 'Vorgeschlagen', notiz: 'Als Alternative vorgestellt.' },
          { datum: dt(-7, 14, 0), phase: 'Absage', notiz: 'Absage durch Kunde – Profil passt nicht ganz.' }
        ], erstelltAm: daysAgo(14) },
      { id: 410, candidateId: 106, vacancyId: 301, phase: 'Absage', honorar: null, startdatum: null, notiz: 'Kandidatin hat anderes Angebot angenommen.',
        verlauf: [
          { datum: dt(-20, 10, 0), phase: 'Vorgeschlagen', notiz: 'Quereinstieg als Product Marketing vorgeschlagen.' },
          { datum: dt(-13, 11, 0), phase: 'Absage', notiz: 'Kandidatin zieht zurück.' }
        ], erstelltAm: daysAgo(20) },
      // Historische, erfolgreiche Vermittlungen für die Statistik
      { id: 411, candidateId: 111, vacancyId: 305, phase: 'Vermittelt', honorar: 28000, startdatum: daysAgo(150), notiz: 'Historische Vermittlung (Archiv).',
        verlauf: [ { datum: dt(-170, 9, 0), phase: 'Vorgeschlagen', notiz: '' }, { datum: dt(-155, 9, 0), phase: 'Vermittelt', notiz: 'Abschluss.' } ], erstelltAm: daysAgo(170) },
      { id: 412, candidateId: 115, vacancyId: 303, phase: 'Vermittelt', honorar: 17500, startdatum: daysAgo(75), notiz: 'Temporäreinsatz erfolgreich gestartet.',
        verlauf: [ { datum: dt(-95, 9, 0), phase: 'Vorgeschlagen', notiz: '' }, { datum: dt(-88, 9, 0), phase: 'Interview', notiz: '' }, { datum: dt(-80, 9, 0), phase: 'Vermittelt', notiz: 'Einsatz gestartet.' } ], erstelltAm: daysAgo(95) },
      { id: 413, candidateId: 116, vacancyId: 310, phase: 'Vermittelt', honorar: 15200, startdatum: daysAgo(20), notiz: 'Vermittlung im Vormonat abgeschlossen.',
        verlauf: [ { datum: dt(-40, 9, 0), phase: 'Vorgeschlagen', notiz: '' }, { datum: dt(-32, 9, 0), phase: 'Interview', notiz: '' }, { datum: dt(-25, 9, 0), phase: 'Vermittelt', notiz: 'Zusage.' } ], erstelltAm: daysAgo(40) }
    ];

    const activities = [
      { id: 501, typ: 'Anruf', betreff: 'Rückruf Simone Vogel (TechNova)', beschreibung: 'Feedback zum Zweitgespräch Brunner einholen.', faelligAm: dt(0, 10, 30), erledigt: false, bezug: { typ: 'unternehmen', id: 202 }, userId: 2, erstelltAm: daysAgo(1) },
      { id: 502, typ: 'Termin', betreff: 'Zweitgespräch Lukas Brunner bei TechNova', beschreibung: 'Mit CTO, vor Ort in Zug. Kandidat vorbereiten.', faelligAm: dt(2, 14, 0), erledigt: false, bezug: { typ: 'kandidat', id: 101 }, userId: 2, erstelltAm: daysAgo(3) },
      { id: 503, typ: 'Aufgabe', betreff: 'Referenzen einholen Sarah Baumann', beschreibung: 'Zwei Referenzen (ehem. Vorgesetzte) telefonisch prüfen.', faelligAm: dt(-1, 17, 0), erledigt: false, bezug: { typ: 'kandidat', id: 104 }, userId: 3, erstelltAm: daysAgo(5) },
      { id: 504, typ: 'Aufgabe', betreff: 'Dossier Widmer aufbereiten', beschreibung: 'Erstgespräch führen und Profil anonymisieren.', faelligAm: dt(1, 9, 0), erledigt: false, bezug: { typ: 'kandidat', id: 110 }, userId: 3, erstelltAm: daysAgo(2) },
      { id: 505, typ: 'Anruf', betreff: 'Follow-up Franco Bianchi (Gastro Seeblick)', beschreibung: 'Auftragsklärung Saisonstelle – Honorarsatz besprechen.', faelligAm: dt(3, 11, 0), erledigt: false, bezug: { typ: 'unternehmen', id: 206 }, userId: 3, erstelltAm: daysAgo(4) },
      { id: 506, typ: 'Termin', betreff: 'Probetag David Steiner bei ElektroPlus', beschreibung: 'Treffpunkt 07:00 Magazin Winterthur.', faelligAm: dt(4, 7, 0), erledigt: false, bezug: { typ: 'kandidat', id: 103 }, userId: 2, erstelltAm: daysAgo(2) },
      { id: 507, typ: 'E-Mail', betreff: 'Offerte an Spital Limmattal nachfassen', beschreibung: 'Status Offerte Keller – Entscheid bis Ende Woche zugesagt.', faelligAm: dt(1, 8, 30), erledigt: false, bezug: { typ: 'vakanz', id: 302 }, userId: 3, erstelltAm: daysAgo(1) },
      { id: 508, typ: 'Aufgabe', betreff: 'Neue Vakanz Alpina Treuhand erfassen', beschreibung: 'Details zur zweiten Sachbearbeiter-Stelle aufnehmen.', faelligAm: dt(-2, 12, 0), erledigt: true, bezug: { typ: 'unternehmen', id: 204 }, userId: 3, erstelltAm: daysAgo(6) },
      { id: 509, typ: 'Anruf', betreff: 'Erstkontakt Melanie Hofer', beschreibung: 'Telefonisches Screening, Verfügbarkeit klären.', faelligAm: dt(0, 15, 0), erledigt: false, bezug: { typ: 'kandidat', id: 116 }, userId: 3, erstelltAm: daysAgo(1) },
      { id: 510, typ: 'Notiz', betreff: 'Bachmann: Diskretion beachten', beschreibung: 'Kandidat ist in ungekündigter Stellung – keine Weitergabe ohne Rücksprache.', faelligAm: null, erledigt: true, bezug: { typ: 'kandidat', id: 111 }, userId: 2, erstelltAm: daysAgo(28) },
      { id: 511, typ: 'Termin', betreff: 'Quartalsmeeting Helvetia Bau', beschreibung: 'Review Rahmenvertrag, Personalplanung H2.', faelligAm: dt(7, 10, 0), erledigt: false, bezug: { typ: 'unternehmen', id: 201 }, userId: 2, erstelltAm: daysAgo(10) },
      { id: 512, typ: 'E-Mail', betreff: 'Case Study an Vanessa Koch senden', beschreibung: 'Unterlagen von TechNova weiterleiten, Deadline kommunizieren.', faelligAm: dt(-3, 9, 0), erledigt: true, bezug: { typ: 'kandidat', id: 112 }, userId: 3, erstelltAm: daysAgo(4) },
      { id: 513, typ: 'Aufgabe', betreff: 'Staplerausweis Wyss kopieren', beschreibung: 'Für Einsatzdossier Muster Logistik.', faelligAm: dt(0, 16, 0), erledigt: false, bezug: { typ: 'kandidat', id: 113 }, userId: 2, erstelltAm: daysAgo(2) },
      { id: 514, typ: 'Anruf', betreff: 'Wiedervorlage Andrea Lüthi', beschreibung: 'In 6 Monaten Situation neu prüfen (aktuell inaktiv).', faelligAm: dt(120, 10, 0), erledigt: false, bezug: { typ: 'kandidat', id: 114 }, userId: 3, erstelltAm: daysAgo(30) },
      { id: 515, typ: 'E-Mail', betreff: 'Vertragsentwurf an Stefan Wyss', beschreibung: 'Einsatzvertrag Muster Logistik zustellen.', faelligAm: dt(1, 14, 0), erledigt: false, bezug: { typ: 'vakanz', id: 308 }, userId: 2, erstelltAm: daysAgo(1) },
      { id: 516, typ: 'Notiz', betreff: 'MediCare: Einstellungsstopp', beschreibung: 'HR-Leiterin informiert: keine externen Besetzungen bis Q4.', faelligAm: null, erledigt: true, bezug: { typ: 'unternehmen', id: 208 }, userId: 3, erstelltAm: daysAgo(40) },
      { id: 517, typ: 'Termin', betreff: 'Kennenlernen Julia Graf', beschreibung: 'Persönliches Erstgespräch im Büro, Dossier vervollständigen.', faelligAm: dt(5, 9, 30), erledigt: false, bezug: { typ: 'kandidat', id: 108 }, userId: 3, erstelltAm: daysAgo(3) },
      { id: 518, typ: 'Aufgabe', betreff: 'Inserat V-3007 auf jobs.ch prüfen', beschreibung: 'Laufzeit verlängern, Klickzahlen auswerten.', faelligAm: dt(2, 10, 0), erledigt: false, bezug: { typ: 'vakanz', id: 307 }, userId: 3, erstelltAm: daysAgo(5) },
      { id: 519, typ: 'Anruf', betreff: 'Reto Zimmermann: neue Einsatzmöglichkeit', beschreibung: 'Über CNC-Stelle bei Neukunde informieren.', faelligAm: dt(-1, 11, 0), erledigt: false, bezug: { typ: 'kandidat', id: 109 }, userId: 2, erstelltAm: daysAgo(3) },
      { id: 520, typ: 'E-Mail', betreff: 'Monatsreport an Geschäftsleitung', beschreibung: 'KPIs Juni zusammenstellen und versenden.', faelligAm: dt(-2, 17, 0), erledigt: true, bezug: null, userId: 1, erstelltAm: daysAgo(8) },
      { id: 521, typ: 'Aufgabe', betreff: 'Datenschutz-Einwilligung Hofer einholen', beschreibung: 'DSG-konforme Einwilligung für Dossierweitergabe.', faelligAm: dt(1, 12, 0), erledigt: false, bezug: { typ: 'kandidat', id: 116 }, userId: 3, erstelltAm: daysAgo(1) },
      { id: 522, typ: 'Termin', betreff: 'Besichtigung Lager Basel', beschreibung: 'Mit Frau Berger Einsatzort für Temporäre besichtigen.', faelligAm: dt(9, 13, 30), erledigt: false, bezug: { typ: 'unternehmen', id: 205 }, userId: 2, erstelltAm: daysAgo(6) }
    ];

    return {
      version: 1,
      settings: { firmenname: 'PersoCRM Personalberatung AG', ort: 'Zürich' },
      users, candidates, companies, vacancies, placements, activities,
      meta: { lastId: 600, counters: { K: 1016, F: 2008, V: 3010 } }
    };
  }

  return { create };
})();
