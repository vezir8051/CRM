/* ============================================================
   Swiss QR-Rechnung (Zahlteil) – Nutzdaten gemäss
   «Swiss Implementation Guidelines QR-bill» (Version 2.x).
   Unterstützt normale IBAN mit Referenztyp NON (ohne Referenz,
   Rechnungsnummer als unstrukturierte Mitteilung).
   ============================================================ */
import type { Company, Invoice, Settings } from '@/types';

export interface QrAddress {
  name: string;
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
  land: string;
}

export interface QrBillData {
  iban: string;
  creditor: QrAddress;
  debtor: QrAddress | null;
  amount: number | null;
  currency: 'CHF' | 'EUR';
  message: string;
}

export type QrBillCheck = { ok: true; data: QrBillData; payload: string } | { ok: false; error: string };

/** "Bahnhofstrasse 12a" → ["Bahnhofstrasse", "12a"] */
export function splitStreet(strasse: string): [string, string] {
  const m = strasse.trim().match(/^(.*?)\s+(\d+[a-zA-Z]?(?:[-/]\d+[a-zA-Z]?)?)$/);
  return m ? [m[1]!, m[2]!] : [strasse.trim(), ''];
}

export function normalizeIban(iban: string): string {
  return iban.replace(/\s+/g, '').toUpperCase();
}

/** IBAN-Prüfsumme (Modulo 97) */
export function isValidIban(iban: string): boolean {
  const s = normalizeIban(iban);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  const rearranged = s.slice(4) + s.slice(0, 4);
  let rest = 0;
  for (const ch of rearranged) {
    const v = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const d of v) rest = (rest * 10 + Number(d)) % 97;
  }
  return rest === 1;
}

/** QR-IBAN (IID 30000–31999) verlangt eine QR-Referenz – hier nicht unterstützt */
export function isQrIban(iban: string): boolean {
  const iid = Number(normalizeIban(iban).slice(4, 9));
  return iid >= 30000 && iid <= 31999;
}

/** IBAN in 4er-Gruppen: CH93 0076 2011 6238 5295 7 */
export function formatIban(iban: string): string {
  return normalizeIban(iban).replace(/(.{4})/g, '$1 ').trim();
}

const clip = (s: string, n: number) => s.replace(/[\r\n]+/g, ' ').trim().slice(0, n);

function addressFields(a: QrAddress | null): string[] {
  if (!a) return ['', '', '', '', '', '', ''];
  return ['S', clip(a.name, 70), clip(a.strasse, 70), clip(a.hausnummer, 16), clip(a.plz, 16), clip(a.ort, 35), a.land];
}

/** Nutzdaten des QR-Codes (Elemente durch CR LF getrennt) */
export function qrBillPayload(d: QrBillData): string {
  const fields = [
    'SPC', '0200', '1',
    normalizeIban(d.iban),
    ...addressFields(d.creditor),
    '', '', '', '', '', '', '', // Endgültiger Zahlungsempfänger (reserviert)
    d.amount !== null ? d.amount.toFixed(2) : '',
    d.currency,
    ...addressFields(d.debtor),
    'NON', '',
    clip(d.message, 140),
    'EPD',
  ];
  return fields.join('\r\n');
}

/** Zahlteil für eine Rechnung vorbereiten und validieren */
export function buildQrBill(invoice: Invoice, company: Company | undefined, settings: Settings): QrBillCheck {
  if (!settings.iban) return { ok: false, error: 'In den Einstellungen ist keine IBAN hinterlegt.' };
  if (!isValidIban(settings.iban)) return { ok: false, error: 'Die IBAN in den Einstellungen ist ungültig.' };
  const iban = normalizeIban(settings.iban);
  if (!iban.startsWith('CH') && !iban.startsWith('LI')) return { ok: false, error: 'QR-Rechnungen benötigen eine Schweizer oder Liechtensteiner IBAN.' };
  if (isQrIban(iban)) return { ok: false, error: 'QR-IBAN erkannt: dafür ist eine QR-Referenz nötig. Bitte eine normale IBAN hinterlegen.' };
  if (!settings.firmenname || !settings.plz || !settings.ort) return { ok: false, error: 'Firmenname, PLZ und Ort der Agentur fehlen in den Einstellungen.' };

  const [cStreet, cNr] = splitStreet(settings.strasse);
  const creditor: QrAddress = { name: settings.firmenname, strasse: cStreet, hausnummer: cNr, plz: settings.plz, ort: settings.ort, land: 'CH' };
  let debtor: QrAddress | null = null;
  if (company?.name && company.plz && company.ort) {
    const [dStreet, dNr] = splitStreet(company.strasse);
    debtor = { name: company.name, strasse: dStreet, hausnummer: dNr, plz: company.plz, ort: company.ort, land: 'CH' };
  }
  const data: QrBillData = {
    iban,
    creditor,
    debtor,
    amount: invoice.total > 0 ? invoice.total : null,
    currency: 'CHF',
    message: `Rechnung ${invoice.nr}`,
  };
  return { ok: true, data, payload: qrBillPayload(data) };
}
