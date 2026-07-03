/* ============================================================
   PersoCRM – Serverless-Funktion (Vercel): Webseiten-Abruf
   GET /api/scrape?url=https://beispiel.ch
   Lädt die Startseite plus (falls verlinkt) Kontakt-/Impressum-
   Seiten, entfernt Markup und liefert Text, Titel, Meta-Daten
   sowie gefundene E-Mail-Adressen und Telefonnummern zurück.
   ============================================================ */

const MAX_BYTES = 1_500_000;   // pro Seite
const TIMEOUT_MS = 8000;
const EXTRA_PAGE_LIMIT = 2;
const KONTAKT_PFADE = /kontakt|contact|impressum|imprint|about|ueber-uns|über-uns|team|legal/i;

function isPrivateHost(hostname) {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return true;
  // IPv4-Literale in privaten Bereichen
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
  }
  if (h.includes(':')) return true; // IPv6-Literale pauschal ablehnen
  return false;
}

async function fetchPage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; PersoCRM-Import/1.0)',
        'accept': 'text/html,application/xhtml+xml',
        'accept-language': 'de-CH,de;q=0.9,en;q=0.6'
      }
    });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || '';
    if (!type.includes('html') && !type.includes('text')) return null;
    // Grössenbegrenzung beim Lesen
    const reader = res.body.getReader();
    const chunks = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      chunks.push(value);
      if (size > MAX_BYTES) { controller.abort(); break; }
    }
    return Buffer.concat(chunks).toString('utf8');
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&uuml;/g, 'ü').replace(/&ouml;/g, 'ö').replace(/&auml;/g, 'ä')
    .replace(/&Uuml;/g, 'Ü').replace(/&Ouml;/g, 'Ö').replace(/&Auml;/g, 'Ä')
    .replace(/&eacute;/g, 'é').replace(/&egrave;/g, 'è').replace(/&#\d+;/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

function meta(html, pattern) {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${pattern}["'][^>]*content=["']([^"']+)["']`, 'i')
  const reInv = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:name|property)=["']${pattern}["']`, 'i');
  const m = html.match(re) || html.match(reInv);
  return m ? m[1].trim() : '';
}

module.exports = async function handler(req, res) {
  const raw = (req.query && req.query.url) || '';
  let target;
  try {
    target = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw);
  } catch (e) {
    return res.status(400).json({ error: 'Ungültige URL.' });
  }
  if (!/^https?:$/.test(target.protocol) || isPrivateHost(target.hostname) || !target.hostname.includes('.')) {
    return res.status(400).json({ error: 'Diese Adresse ist nicht erlaubt.' });
  }

  const startHtml = await fetchPage(target.href);
  if (!startHtml) {
    return res.status(502).json({ error: 'Die Webseite konnte nicht geladen werden (nicht erreichbar oder kein HTML).' });
  }

  const pages = [{ url: target.href, html: startHtml }];

  // Kontakt-/Impressum-Links auf derselben Domain suchen
  const seen = new Set([target.href.replace(/\/+$/, '')]);
  const links = [...startHtml.matchAll(/href=["']([^"'#]+)["']/gi)].map(m => m[1]);
  for (const href of links) {
    if (pages.length > EXTRA_PAGE_LIMIT) break;
    if (!KONTAKT_PFADE.test(href)) continue;
    let u;
    try { u = new URL(href, target.href); } catch (e) { continue; }
    if (u.hostname !== target.hostname || !/^https?:$/.test(u.protocol)) continue;
    const key = u.href.replace(/\/+$/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    const html = await fetchPage(u.href);
    if (html) pages.push({ url: u.href, html });
  }

  // E-Mails und Telefonnummern über alle Seiten sammeln (inkl. mailto:/tel:)
  const emails = new Set();
  const phones = new Set();
  for (const p of pages) {
    for (const m of p.html.matchAll(/mailto:([^"'?<>\s]+)/gi)) {
      const mail = decodeURIComponent(m[1]).toLowerCase();
      if (/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(mail)) emails.add(mail);
    }
    for (const m of p.html.matchAll(/tel:([+\d][\d\s().\/-]{6,20})/gi)) phones.add(m[1].trim());
    const text = stripHtml(p.html);
    for (const m of text.matchAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)) {
      const mail = m[0].toLowerCase();
      if (!/\.(png|jpg|jpeg|gif|svg|webp|css|js)$/.test(mail)) emails.add(mail);
    }
    for (const m of text.matchAll(/(\+41|0041)[\s\d().\/-]{9,16}/g)) phones.add(m[0].replace(/\s+/g, ' ').trim());
    p.text = text.slice(0, 20000);
    delete p.html;
  }

  res.setHeader('cache-control', 'private, max-age=300');
  return res.status(200).json({
    url: target.href,
    title: (startHtml.match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i) || [, ''])[1].replace(/\s+/g, ' ').trim(),
    description: meta(startHtml, '(?:og:)?description'),
    siteName: meta(startHtml, 'og:site_name'),
    emails: [...emails].slice(0, 10),
    phones: [...phones].slice(0, 6),
    pages: pages.map(p => ({ url: p.url, text: p.text }))
  });
}
