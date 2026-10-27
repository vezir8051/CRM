/** Datei im Browser herunterladen */
export function downloadFile(filename: string, content: string, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** CSV mit Semikolon (Excel Schweiz) und BOM für Umlaute */
export function downloadCsv(filename: string, header: string[], rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [header, ...rows].map((r) => r.map(esc).join(';')).join('\r\n');
  downloadFile(filename, '﻿' + csv, 'text/csv;charset=utf-8');
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Druckt nur den Inhalt des offenen Dialogs (siehe index.css, body.print-dialog) */
export function printDialog() {
  document.body.classList.add('print-dialog');
  const done = () => {
    document.body.classList.remove('print-dialog');
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  window.print();
}
