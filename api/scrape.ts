/* ============================================================
   PersoCRM – Webseiten-Abruf für den Firmen-Import
   GET /api/scrape?url=www.beispiel.ch

   Lädt die Startseite und bis zu drei Kontakt-/Impressumsseiten,
   liest schema.org-Daten (JSON-LD), E-Mails, Telefonnummern,
   Meta-Angaben und LinkedIn-Link aus.

   Sicherheit: nur http(s) auf Port 80/443, DNS-Auflösung wird gegen
   private/interne Adressbereiche geprüft (auch nach Weiterleitungen),
   Zeit- und Grössenlimits.
   ============================================================ */
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 4;
const EXTRA_PAGES = 3;
const CONTACT_PATH = /kontakt|contact|impressum|imprint|ueber-uns|uber-uns|über-uns|about|team|standort|legal/i;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': status === 200 ? 'private, max-age=300' : 'no-store' },
  });
}

/* ---------- Schutz vor Zugriffen auf interne Netze (SSRF) ---------- */
function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith('::ffff:')) return isPrivateIp(v6.slice(7));
  return v6 === '::1' || v6 === '::' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80');
}

async function assertPublicUrl(u: URL): Promise<void> {
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Nur http(s)-Adressen sind erlaubt.');
  if (u.port && u.port !== '80' && u.port !== '443') throw new Error('Dieser Port ist nicht erlaubt.');
  if (u.username || u.password) throw new Error('Adressen mit Zugangsdaten sind nicht erlaubt.');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (!host.includes('.') || /\.(local|internal|localhost)$/i.test(host)) throw new Error('Diese Adresse ist nicht erlaubt.');
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error('Diese Adresse ist nicht erlaubt.');
}

/* ---------- Abruf mit geprüften Weiterleitungen ---------- */
async function fetchHtml(start: URL): Promise<{ url: URL; html: string } | null> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(url);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; PersoCRM-Import/2.0)',
          accept: 'text/html,application/xhtml+xml',
          'accept-language': 'de-CH,de;q=0.9,fr;q=0.6,en;q=0.5',
        },
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (!loc) return null;
        url = new URL(loc, url);
        continue;
      }
      if (!res.ok || !res.body) return null;
      const type = res.headers.get('content-type') ?? '';
      if (!/html|xml|text\/plain/i.test(type)) return null;

      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        chunks.push(value);
        if (size > MAX_BYTES) {
          controller.abort();
          break;
        }
      }
      const bytes = new Uint8Array(size > MAX_BYTES ? MAX_BYTES : size);
      let offset = 0;
      for (const c of chunks) {
        const part = c.subarray(0, Math.min(c.length, bytes.length - offset));
        bytes.set(part, offset);
        offset += part.length;
        if (offset >= bytes.length) break;
      }
      return { url, html: decode(bytes, type) };
    } catch (e) {
      if ((e as Error).message?.includes('nicht erlaubt')) throw e;
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

/** Zeichensatz aus Header oder <meta charset> (z.B. ältere ISO-8859-1-Seiten) */
function decode(bytes: Uint8Array, contentType: string): string {
  let charset = contentType.match(/charset=([\w-]+)/i)?.[1];
  if (!charset) {
    const head = new TextDecoder('latin1').decode(bytes.subarray(0, 4096));
    charset = head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1];
  }
  try {
    return new TextDecoder(charset || 'utf-8').decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

/* ---------- Auswertung ---------- */
const ENTITIES: Record<string, string> = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü',
  eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç', szlig: 'ss', ndash: '–', mdash: '—', middot: '·',
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n] ?? m);
}

function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/address|\/section|\/footer)[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t ]{2,}/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

function meta(html: string, name: string): string {
  const a = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i');
  const b = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`, 'i');
  return decodeEntities((html.match(a) ?? html.match(b))?.[1]?.trim() ?? '');
}

interface OrgInfo {
  name?: string;
  telephone?: string;
  email?: string;
  streetAddress?: string;
  postalCode?: string;
  addressLocality?: string;
  description?: string;
}

const ORG_TYPES = /Organization|Corporation|LocalBusiness|Company|Store|ProfessionalService|MedicalOrganization|EmploymentAgency|Restaurant|Hotel/i;

/** schema.org-Daten (JSON-LD) einer Organisation */
function extractOrg(html: string): OrgInfo | null {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const nodes: Record<string, unknown>[] = [];
  const collect = (x: unknown) => {
    if (Array.isArray(x)) x.forEach(collect);
    else if (x && typeof x === 'object') {
      const o = x as Record<string, unknown>;
      nodes.push(o);
      if (o['@graph']) collect(o['@graph']);
    }
  };
  for (const b of blocks) {
    try {
      collect(JSON.parse(b[1].trim()));
    } catch {
      /* ungültiges JSON-LD ignorieren */
    }
  }
  const org = nodes.find((n) => ORG_TYPES.test(String(n['@type'] ?? '')));
  if (!org) return null;
  const addrRaw = Array.isArray(org.address) ? org.address[0] : org.address;
  const addr = (addrRaw && typeof addrRaw === 'object' ? addrRaw : {}) as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === 'string' ? decodeEntities(v).trim() : undefined);
  return {
    name: s(org.legalName) ?? s(org.name),
    telephone: s(org.telephone),
    email: s(org.email)?.replace(/^mailto:/i, ''),
    streetAddress: s(addr.streetAddress),
    postalCode: s(addr.postalCode) ?? (typeof addr.postalCode === 'number' ? String(addr.postalCode) : undefined),
    addressLocality: s(addr.addressLocality),
    description: s(org.description),
  };
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:\+41|0041|\b0)[\s./-]?\(?0?\)?\s?[1-9]\d[\s./-]?\d{3}[\s./-]?\d{2}[\s./-]?\d{2}\b/g;

export async function GET(request: Request): Promise<Response> {
  const raw = new URL(request.url).searchParams.get('url')?.trim() ?? '';
  let target: URL;
  try {
    target = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return json({ error: 'Ungültige Webseiten-Adresse.' }, 400);
  }

  let start: { url: URL; html: string } | null;
  try {
    start = await fetchHtml(target);
  } catch (e) {
    return json({ error: (e as Error).message || 'Diese Adresse ist nicht erlaubt.' }, 400);
  }
  if (!start) return json({ error: 'Die Webseite konnte nicht geladen werden (nicht erreichbar oder kein HTML).' }, 502);

  const pages: { url: string; html: string }[] = [{ url: start.url.href, html: start.html }];
  const seen = new Set([start.url.href.replace(/\/+$/, '')]);
  const links = [...start.html.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi)];
  // Kontakt-/Impressumsseiten zuerst (anhand Pfad oder Linktext)
  const candidates = links
    .filter(([, href, label]) => CONTACT_PATH.test(href) || CONTACT_PATH.test(htmlToText(label)))
    .map(([, href]) => href);
  for (const href of candidates) {
    if (pages.length > EXTRA_PAGES) break;
    let u: URL;
    try {
      u = new URL(href, start.url);
    } catch {
      continue;
    }
    if (u.hostname.replace(/^www\./, '') !== start.url.hostname.replace(/^www\./, '')) continue;
    const key = u.href.replace(/\/+$/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const page = await fetchHtml(u);
      if (page) pages.push({ url: page.url.href, html: page.html });
    } catch {
      /* nicht erlaubte Unterseite überspringen */
    }
  }

  const emails = new Set<string>();
  const phones = new Set<string>();
  let org: OrgInfo | null = null;
  let linkedin = '';
  const result = pages.map((p) => {
    org = org ?? extractOrg(p.html);
    for (const m of p.html.matchAll(/mailto:([^"'?<>\s]+)/gi)) {
      const mail = decodeURIComponent(m[1]).toLowerCase();
      if (/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(mail)) emails.add(mail);
    }
    for (const m of p.html.matchAll(/href=["']tel:([+\d][\d\s().\/-]{6,20})["']/gi)) phones.add(m[1].trim());
    linkedin ||= p.html.match(/https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/company\/[^"'\s<>]+/i)?.[0] ?? '';
    const text = htmlToText(p.html);
    for (const m of text.matchAll(EMAIL_RE)) {
      const mail = m[0].toLowerCase();
      if (!/\.(png|jpe?g|gif|svg|webp|css|js)$/.test(mail) && !/example\.|sentry|wixpress/.test(mail)) emails.add(mail);
    }
    for (const m of text.matchAll(PHONE_RE)) phones.add(m[0].replace(/\s+/g, ' ').trim());
    return { url: p.url, text: text.slice(0, 20_000) };
  });

  const home = pages[0].html;
  return json({
    url: start.url.href,
    title: decodeEntities(home.match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() ?? ''),
    description: meta(home, '(?:og:)?description'),
    siteName: meta(home, 'og:site_name'),
    emails: [...emails].slice(0, 10),
    phones: [...phones].slice(0, 6),
    org,
    socials: linkedin ? { linkedin } : {},
    pages: result,
  });
}
