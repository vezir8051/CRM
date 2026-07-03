/* ============================================================
   PersoCRM – KI- und Automatisierungs-Engine
   - Lebenslauf-Extraktion (Kandidaten): Claude API (optional,
     eigener API-Schlüssel) oder lokale Heuristiken als Fallback.
   - Webseiten-Extraktion (Unternehmen): Abruf über die
     Serverless-Funktion /api/scrape (auf Vercel), Auswertung
     per Claude oder Heuristik.
   - PDF-Textextraktion via pdf.js (wird bei Bedarf von CDN
     geladen; ohne Netz bleibt Text-Einfügen als Fallback).

   API (App.ai.*):
     hasKey() / getKey() / setKey(k) / getModel() / setModel(m)
     testKey() -> Promise<{ok, message}>
     readFile(file) -> Promise<string>            (.pdf/.txt/.md)
     extractCandidate(text) -> Promise<{data, missing, quelle}>
     fetchWebsite(url) -> Promise<{title, description, pages, emails, phones}>
     extractCompany({url, title, description, text, emails, phones})
        -> Promise<{data, ansprechpartner, missing, quelle}>
   ============================================================ */
window.App = window.App || {};

App.ai = (() => {
  const KEY_STORAGE = 'persocrm_ai_key';
  const MODEL_STORAGE = 'persocrm_ai_model';
  const DEFAULT_MODEL = 'claude-opus-4-8';
  const MODELS = [
    { id: 'claude-opus-4-8', label: 'Claude Opus 4.8 – beste Qualität (Standard)' },
    { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 – schnell & günstig' }
  ];

  /* ---------- Konfiguration ---------- */
  function getKey() { return localStorage.getItem(KEY_STORAGE) || ''; }
  function setKey(k) {
    if (k) localStorage.setItem(KEY_STORAGE, k.trim());
    else localStorage.removeItem(KEY_STORAGE);
  }
  function hasKey() { return getKey().length > 10; }
  function getModel() { return localStorage.getItem(MODEL_STORAGE) || DEFAULT_MODEL; }
  function setModel(m) { localStorage.setItem(MODEL_STORAGE, m); }

  /* ---------- Claude API (direkt aus dem Browser) ---------- */
  async function claudeRequest(body) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': getKey(),
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { msg = (await res.json()).error.message || msg; } catch (e) { /* Rohtext ignorieren */ }
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  // Strukturierte Extraktion: Schema wird von der API garantiert eingehalten.
  async function claudeExtract(prompt, schema, maxTokens) {
    const resp = await claudeRequest({
      model: getModel(),
      max_tokens: maxTokens || 4000,
      output_config: { format: { type: 'json_schema', schema } },
      messages: [{ role: 'user', content: prompt }]
    });
    if (resp.stop_reason === 'refusal') throw new Error('Die Anfrage wurde vom Modell abgelehnt.');
    const textBlock = (resp.content || []).find(b => b.type === 'text');
    if (!textBlock) throw new Error('Leere Antwort der KI.');
    return JSON.parse(textBlock.text);
  }

  async function testKey() {
    try {
      const resp = await claudeRequest({
        model: getModel(),
        max_tokens: 32,
        messages: [{ role: 'user', content: 'Antworte nur mit: OK' }]
      });
      const ok = (resp.content || []).some(b => b.type === 'text');
      return { ok, message: ok ? `Verbindung erfolgreich (${resp.model}).` : 'Unerwartete Antwort.' };
    } catch (e) {
      return { ok: false, message: e.status === 401 ? 'API-Schlüssel ungültig.' : `Fehler: ${e.message}` };
    }
  }

  /* ---------- Datei lesen (PDF/Text) ---------- */
  let pdfJsPromise = null;
  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (!pdfJsPromise) {
      pdfJsPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
        s.onload = () => {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
          resolve(window.pdfjsLib);
        };
        s.onerror = () => { pdfJsPromise = null; reject(new Error('PDF-Bibliothek konnte nicht geladen werden (offline?). Bitte Text manuell einfügen.')); };
        document.head.appendChild(s);
      });
    }
    return pdfJsPromise;
  }

  async function readFile(file) {
    const name = (file.name || '').toLowerCase();
    if (name.endsWith('.pdf') || file.type === 'application/pdf') {
      const pdfjs = await loadPdfJs();
      const buf = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: buf }).promise;
      const teile = [];
      const maxSeiten = Math.min(pdf.numPages, 10);
      for (let i = 1; i <= maxSeiten; i++) {
        const page = await pdf.getPage(i);
        const tc = await page.getTextContent();
        // Zeilen anhand der Y-Position rekonstruieren
        let lastY = null, zeile = [];
        const zeilen = [];
        for (const item of tc.items) {
          const y = Math.round(item.transform[5]);
          if (lastY !== null && Math.abs(y - lastY) > 4) { zeilen.push(zeile.join(' ')); zeile = []; }
          zeile.push(item.str);
          lastY = y;
        }
        if (zeile.length) zeilen.push(zeile.join(' '));
        teile.push(zeilen.join('\n'));
      }
      const text = teile.join('\n\n').replace(/[ \t]+/g, ' ').trim();
      if (text.length < 40) throw new Error('Aus dem PDF konnte kein Text gelesen werden (evtl. gescanntes Dokument). Bitte Text manuell einfügen.');
      return text;
    }
    if (name.endsWith('.txt') || name.endsWith('.md') || (file.type || '').startsWith('text/')) {
      return file.text();
    }
    throw new Error('Nicht unterstütztes Format. Bitte PDF- oder Textdatei verwenden – oder den Text direkt einfügen.');
  }

  /* ============================================================
     Kandidaten-Extraktion
     ============================================================ */
  const KANDIDAT_FELDER = ['anrede', 'vorname', 'nachname', 'geburtsdatum', 'email', 'telefon',
    'strasse', 'plz', 'ort', 'beruf', 'ausbildung', 'berufserfahrung', 'qualifikationen',
    'sprachen', 'verfuegbarAb', 'pensum', 'anstellungsart', 'lohnvorstellung'];

  const KANDIDAT_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: KANDIDAT_FELDER,
    properties: {
      anrede: { type: 'string', description: 'Herr oder Frau, leer wenn unklar' },
      vorname: { type: 'string' },
      nachname: { type: 'string' },
      geburtsdatum: { type: 'string', description: 'Format YYYY-MM-DD, leer wenn nicht vorhanden' },
      email: { type: 'string' },
      telefon: { type: 'string' },
      strasse: { type: 'string', description: 'Strasse und Hausnummer' },
      plz: { type: 'string' },
      ort: { type: 'string' },
      beruf: { type: 'string', description: 'Aktuelle/letzte Berufsbezeichnung' },
      ausbildung: { type: 'string', description: 'Höchster/relevantester Abschluss, kurz' },
      berufserfahrung: { type: 'integer', description: 'Jahre Berufserfahrung, 0 wenn unbekannt' },
      qualifikationen: { type: 'array', items: { type: 'string' }, description: 'Fachliche Kompetenzen/Skills, max. 10' },
      sprachen: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false, required: ['sprache', 'niveau'],
          properties: { sprache: { type: 'string' }, niveau: { type: 'string', description: 'z.B. Muttersprache, C1, B2; leer wenn unbekannt' } }
        }
      },
      verfuegbarAb: { type: 'string', description: 'Format YYYY-MM-DD, leer wenn nicht genannt' },
      pensum: { type: 'string', description: 'z.B. 100% oder 80-100%, leer wenn nicht genannt' },
      anstellungsart: { type: 'string', description: 'Festanstellung, Temporär oder Try & Hire; leer wenn unklar' },
      lohnvorstellung: { type: 'integer', description: 'Jahreslohn in CHF, 0 wenn nicht genannt' }
    }
  };

  function leer(v) {
    if (v === null || v === undefined) return true;
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === 'number') return v === 0;
    return String(v).trim() === '';
  }

  function fehlendeFelder(data, felder) {
    return felder.filter(f => leer(data[f]));
  }

  async function extractCandidate(text) {
    text = String(text || '').slice(0, 60000);
    if (text.trim().length < 30) throw new Error('Der Text ist zu kurz für eine Auswertung.');

    if (hasKey()) {
      const prompt =
        'Extrahiere die Kandidatendaten aus folgendem Lebenslauf für ein Schweizer Personalvermittlungs-CRM. ' +
        'Gib NUR Werte zurück, die tatsächlich im Text stehen – erfinde nichts; nicht vorhandene Felder bleiben leer bzw. 0. ' +
        'Datumsangaben als YYYY-MM-DD. Telefonnummern im Format +41 XX XXX XX XX, wenn möglich.\n\n' +
        '=== LEBENSLAUF ===\n' + text;
      const data = await claudeExtract(prompt, KANDIDAT_SCHEMA);
      // Anstellungsart auf gültige Werte normalisieren
      if (!['Festanstellung', 'Temporär', 'Try & Hire'].includes(data.anstellungsart)) data.anstellungsart = '';
      if (!['Herr', 'Frau'].includes(data.anrede)) data.anrede = '';
      data.sprachen = (data.sprachen || []).filter(s => s && s.sprache);
      return { data, missing: fehlendeFelder(data, KANDIDAT_FELDER), quelle: 'ki' };
    }

    const data = heuristikKandidat(text);
    return { data, missing: fehlendeFelder(data, KANDIDAT_FELDER), quelle: 'heuristik' };
  }

  /* ---------- Heuristische Lebenslauf-Auswertung (ohne KI) ---------- */
  const SKILL_LISTE = ['JavaScript', 'TypeScript', 'React', 'Angular', 'Vue', 'Node.js', 'Python', 'Java', 'C#', 'PHP', 'SQL',
    'Docker', 'Kubernetes', 'AWS', 'Azure', 'Power BI', 'Tableau', 'Excel', 'SAP', 'SAP HCM', 'SAP WM', 'Abacus',
    'Projektmanagement', 'Projektleitung', 'Scrum', 'Bauleitung', 'Finanzbuchhaltung', 'Lohnbuchhaltung', 'Jahresabschluss',
    'MWST-Abrechnung', 'Treuhand', 'Steuererklärungen', 'Revision', 'Debitoren', 'Kreditoren', 'Rekrutierung',
    'Personaladministration', 'Sozialversicherungen', 'Arbeitsrecht', 'Digital Marketing', 'SEO', 'SEA', 'Content Marketing',
    'Google Analytics', 'Social Media', 'Key Account Management', 'B2B-Vertrieb', 'Verhandlungsführung', 'CRM',
    'Elektroinstallation', 'Photovoltaik', 'NIN', 'CNC-Fräsen', 'CNC-Drehen', 'CAD', 'CAM', 'Qualitätskontrolle',
    'Lagerbewirtschaftung', 'Staplerausweis', 'Kommissionierung', 'Zolldeklaration', 'Akutpflege', 'Notfallpflege',
    'BLS-AED', 'Wunddokumentation', 'HACCP', 'Menüplanung', 'Bankett', 'Hydraulik', 'Pneumatik', 'Elektrotechnik',
    'Wartung', 'Instandhaltung', 'Kundendienst', '1st Level Support', '2nd Level Support', 'Microsoft 365',
    'Active Directory', 'Windows Server', 'ITIL', 'MS Office', 'MS Project', 'Statistik', 'Machine Learning',
    'Kostenkontrolle', 'SIA-Normen', 'Offertwesen', 'Korrespondenz', 'Administration', 'Empfang'];

  const BERUF_WORTE = /entwickler|ingenieur(in)?|kauffrau|kaufmann|leiter(in)?|manager(in)?|fachfrau|fachmann|monteur|installateur|techniker(in)?|berater(in)?|analyst(in)?|pflegefach|koch|köchin|logistiker(in)?|mechaniker(in)?|informatiker(in)?|buchhalter(in)?|sachbearbeiter(in)?|supporter|architekt(in)?|designer(in)?|spezialist(in)?|assistent(in)?|controller(in)?|treuhänder(in)?|polier|bauführer/i;

  function heuristikKandidat(text) {
    const zeilen = text.split('\n').map(z => z.trim()).filter(Boolean);
    const d = {
      anrede: '', vorname: '', nachname: '', geburtsdatum: '', email: '', telefon: '',
      strasse: '', plz: '', ort: '', beruf: '', ausbildung: '', berufserfahrung: 0,
      qualifikationen: [], sprachen: [], verfuegbarAb: '', pensum: '', anstellungsart: '', lohnvorstellung: 0
    };

    // E-Mail
    const em = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (em) d.email = em[0];

    // Telefon (CH-Formate)
    const tel = text.match(/(\+41|0041)[\s\d().\/-]{9,16}|\b0\d{2}[\s\/]?\d{3}[\s]?\d{2}[\s]?\d{2}\b/);
    if (tel) d.telefon = tel[0].replace(/\s+/g, ' ').trim();

    // Geburtsdatum: dd.mm.yyyy in der Nähe von «geboren/Geburtsdatum» oder Jahrgang 1940–2010
    const gebLabel = text.match(/(geburtsdatum|geboren|geb\.)[^\d]{0,20}(\d{1,2})\.(\d{1,2})\.(\d{4})/i);
    const gebFrei = text.match(/\b(\d{1,2})\.(\d{1,2})\.(19[4-9]\d|200\d|2010)\b/);
    const geb = gebLabel ? gebLabel.slice(2, 5) : (gebFrei ? gebFrei.slice(1, 4) : null);
    if (geb) {
      const [t, m, j] = geb.map(Number);
      if (j >= 1940 && j <= 2012 && m >= 1 && m <= 12 && t >= 1 && t <= 31) {
        d.geburtsdatum = `${j}-${String(m).padStart(2, '0')}-${String(t).padStart(2, '0')}`;
      }
    }

    // Adresse: «Musterstrasse 12» + «8000 Zürich»
    const str = text.match(/\b([A-ZÄÖÜ][a-zäöüéè.\- ]*(?:strasse|straße|str\.|weg|gasse|platz|allee|ring)\s*\d+[a-z]?)\b/i);
    if (str) d.strasse = str[1].trim();
    const plzOrt = text.match(/\b([1-9]\d{3})\s+([A-ZÄÖÜ][A-Za-zäöüéèâ.\-]+(?:\s[A-ZÄÖÜ][A-Za-zäöüéèâ.\-]+)?)/);
    if (plzOrt) { d.plz = plzOrt[1]; d.ort = plzOrt[2].trim(); }

    // Name: Label oder erste plausible Zeile
    const nameLabel = text.match(/\bname\s*[:\-]\s*([A-ZÄÖÜ][^\n,;]{2,50})/i);
    let nameKandidat = nameLabel ? nameLabel[1].trim() : '';
    if (!nameKandidat) {
      for (const z of zeilen.slice(0, 6)) {
        if (/lebenslauf|curriculum|vitae|bewerbung|cv\b/i.test(z)) continue;
        const worte = z.split(/\s+/);
        if (worte.length >= 2 && worte.length <= 4 && worte.every(w => /^[A-ZÄÖÜ][a-zäöüéè\-.]+$/.test(w))) {
          nameKandidat = z;
          break;
        }
      }
    }
    if (nameKandidat) {
      const worte = nameKandidat.split(/\s+/);
      d.vorname = worte[0];
      d.nachname = worte.slice(1).join(' ');
    }

    // Beruf: Label oder erste Zeile mit Berufsbezeichnung
    const berufLabel = text.match(/\b(beruf|position|funktion|tätigkeit)\s*[:\-]\s*([^\n]{3,60})/i);
    if (berufLabel) d.beruf = berufLabel[2].trim();
    if (!d.beruf) {
      const z = zeilen.find(l => l.length < 70 && BERUF_WORTE.test(l) && !/erfahrung|kenntnisse/i.test(l));
      if (z) d.beruf = z.replace(/^[-•*\s]+/, '').trim();
    }

    // Ausbildung
    const ausb = zeilen.find(l => /\b(EFZ|EBA|HF|FH|BSc|MSc|BA|MA|Bachelor|Master|Diplom|Fachausweis|eidg\.|Matura|Lehre als)\b/.test(l));
    if (ausb) {
      d.ausbildung = ausb
        .replace(/^(ausbildung|abschluss|bildung)\s*[:\-]\s*/i, '')
        .replace(/^\d{4}\s*[–\-]\s*(\d{4})?\s*/, '')
        .trim().slice(0, 90);
    }

    // Berufserfahrung
    const erf = text.match(/(\d{1,2})\s*Jahre[n]?\s*(Berufs)?erfahrung/i);
    if (erf) d.berufserfahrung = Number(erf[1]);

    // Lohn
    const lohn = text.match(/(?:CHF|Fr\.)\s?([\d']{4,9})/i);
    if (lohn) {
      const n = Number(lohn[1].replace(/'/g, ''));
      if (n >= 20000 && n <= 400000) d.lohnvorstellung = n;
    }

    // Pensum
    const pensum = text.match(/\b(\d{2,3}\s?[-–]\s?\d{2,3}\s?%|\d{2,3}\s?%)/);
    if (pensum) d.pensum = pensum[1].replace(/\s+/g, '');

    // Qualifikationen: bekannte Skills im Text
    const lower = text.toLowerCase();
    d.qualifikationen = SKILL_LISTE.filter(s => lower.includes(s.toLowerCase())).slice(0, 10);

    // Sprachen mit Niveau in derselben Zeile
    const sprachen = ['Deutsch', 'Englisch', 'Französisch', 'Italienisch', 'Spanisch', 'Portugiesisch', 'Rätoromanisch'];
    for (const sp of sprachen) {
      const re = new RegExp(sp + '[^\\n]{0,40}?(muttersprache|c2|c1|b2|b1|a2|a1|fliessend|verhandlungssicher|sehr gut|gut)', 'i');
      const m = text.match(re);
      if (m) {
        let niveau = m[1];
        niveau = niveau.charAt(0).toUpperCase() + niveau.slice(1).toLowerCase();
        if (/^[abc][12]$/i.test(niveau)) niveau = niveau.toUpperCase();
        d.sprachen.push({ sprache: sp, niveau });
      } else if (new RegExp('\\b' + sp + '\\b', 'i').test(text) && sp !== 'Deutsch') {
        d.sprachen.push({ sprache: sp, niveau: '' });
      }
    }

    return d;
  }

  /* ============================================================
     Unternehmens-Extraktion (Webseite)
     ============================================================ */
  const FIRMA_FELDER = ['name', 'branche', 'strasse', 'plz', 'ort', 'telefon', 'email', 'website'];

  const FIRMA_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: FIRMA_FELDER.concat(['notizen', 'ansprechpartner']),
    properties: {
      name: { type: 'string', description: 'Offizieller Firmenname inkl. Rechtsform (AG, GmbH …)' },
      branche: { type: 'string', description: 'Branche in 1-4 Worten, deutsch' },
      strasse: { type: 'string', description: 'Strasse und Hausnummer des Hauptsitzes' },
      plz: { type: 'string' },
      ort: { type: 'string' },
      telefon: { type: 'string', description: 'Zentrale Telefonnummer' },
      email: { type: 'string', description: 'Allgemeine Kontakt-E-Mail' },
      website: { type: 'string', description: 'Domain ohne Protokoll, z.B. www.beispiel.ch' },
      notizen: { type: 'string', description: 'Kurzbeschreibung des Unternehmens in 1-2 Sätzen, deutsch' },
      ansprechpartner: {
        type: 'array',
        description: 'Namentlich genannte Kontaktpersonen (max. 5), v.a. HR/Geschäftsleitung',
        items: {
          type: 'object', additionalProperties: false,
          required: ['anrede', 'vorname', 'nachname', 'funktion', 'email', 'telefon'],
          properties: {
            anrede: { type: 'string', description: 'Herr oder Frau, leer wenn unklar' },
            vorname: { type: 'string' }, nachname: { type: 'string' },
            funktion: { type: 'string' }, email: { type: 'string' }, telefon: { type: 'string' }
          }
        }
      }
    }
  };

  async function fetchWebsite(url) {
    url = String(url || '').trim();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    let res;
    try {
      res = await fetch('/api/scrape?url=' + encodeURIComponent(url));
    } catch (e) {
      const err = new Error('Der Webseiten-Abruf ist nicht erreichbar.');
      err.code = 'not_deployed';
      throw err;
    }
    if (res.status === 404) {
      const err = new Error('Der Webseiten-Abruf steht nur im Vercel-Deployment zur Verfügung (Serverless-Funktion /api/scrape).');
      err.code = 'not_deployed';
      throw err;
    }
    const json = await res.json().catch(() => null);
    if (!res.ok || !json) {
      const err = new Error((json && json.error) || `Webseite konnte nicht geladen werden (HTTP ${res.status}).`);
      err.code = 'fetch_failed';
      throw err;
    }
    return json; // {url, title, description, siteName, emails, phones, pages:[{url,text}]}
  }

  async function extractCompany(site) {
    const gesamtText = (site.pages || []).map(p => `--- Seite: ${p.url} ---\n${p.text}`).join('\n\n').slice(0, 60000);

    if (hasKey()) {
      const prompt =
        'Extrahiere die Firmendaten aus folgendem Webseiten-Inhalt für ein Schweizer Personalvermittlungs-CRM. ' +
        'Gib NUR Angaben zurück, die im Text stehen – nichts erfinden; Unbekanntes bleibt leer. ' +
        'Bevorzuge Angaben aus Impressum/Kontakt. Telefonnummern im Format +41 XX XXX XX XX, wenn möglich.\n\n' +
        `URL: ${site.url}\nSeitentitel: ${site.title || ''}\nMeta-Beschreibung: ${site.description || ''}\n` +
        (site.emails && site.emails.length ? `Gefundene E-Mails: ${site.emails.join(', ')}\n` : '') +
        (site.phones && site.phones.length ? `Gefundene Telefonnummern: ${site.phones.join(', ')}\n` : '') +
        '\n=== SEITENINHALT ===\n' + gesamtText;
      const data = await claudeExtract(prompt, FIRMA_SCHEMA, 3000);
      const ansprechpartner = (data.ansprechpartner || []).filter(p => p && (p.nachname || p.vorname)).slice(0, 5);
      delete data.ansprechpartner;
      if (!data.website) data.website = site.url.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
      return { data, ansprechpartner, missing: fehlendeFelder(data, FIRMA_FELDER), quelle: 'ki' };
    }

    const data = heuristikFirma(site, gesamtText);
    return { data, ansprechpartner: [], missing: fehlendeFelder(data, FIRMA_FELDER), quelle: 'heuristik' };
  }

  function heuristikFirma(site, text) {
    const d = { name: '', branche: '', strasse: '', plz: '', ort: '', telefon: '', email: '', website: '', notizen: '' };
    d.website = site.url.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');

    // Name: og:site_name > Titel > Zeile mit Rechtsform > erste Textzeile > Domain
    let name = site.siteName || site.title || '';
    name = name.split(/\s+[|–\-•]\s+/)[0].trim();
    if (!name) {
      const rechtsform = text.match(/^\s*([A-ZÄÖÜ][^\n]{1,60}?\s(?:AG|GmbH|SA|Sàrl|KLG))\s*$/m);
      if (rechtsform) name = rechtsform[1].trim();
    }
    if (!name) {
      const ersteZeile = (text.split('\n').map(z => z.trim()).find(z => z.length > 2) || '').split(/\s+[|–\-•]\s+/)[0];
      if (ersteZeile && ersteZeile.length <= 60) name = ersteZeile;
    }
    if (!name) name = d.website.replace(/^www\./, '').split('.')[0];
    d.name = name.slice(0, 80);

    // Rechtsform im Text ergänzt Vertrauen in Firmennamen
    const agMatch = text.match(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+(AG|GmbH|SA|Sàrl)', 'i'));
    if (agMatch) d.name = `${name} ${agMatch[1]}`;

    d.email = (site.emails && site.emails[0]) || (text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/) || [''])[0];
    d.telefon = (site.phones && site.phones[0]) || (text.match(/(\+41|0041)[\s\d().\/-]{9,16}/) || [''])[0].trim();

    const str = text.match(/\b([A-ZÄÖÜ][a-zäöüéè.\- ]*(?:strasse|straße|str\.|weg|gasse|platz|allee|ring)\s*\d+[a-z]?)\b/i);
    if (str) d.strasse = str[1].trim();
    const plzOrt = text.match(/\b([1-9]\d{3})\s+([A-ZÄÖÜ][A-Za-zäöüéèâ.\-]+(?:\s[A-ZÄÖÜ][A-Za-zäöüéèâ.\-]+)?)/);
    if (plzOrt) { d.plz = plzOrt[1]; d.ort = plzOrt[2].trim(); }

    if (site.description) d.notizen = site.description.slice(0, 300);
    return d;
  }

  return {
    MODELS, DEFAULT_MODEL,
    hasKey, getKey, setKey, getModel, setModel, testKey,
    readFile, extractCandidate, fetchWebsite, extractCompany
  };
})();
