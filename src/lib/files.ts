/* ============================================================
   Dateien lesen: PDF (pdf.js), Word (mammoth), Text, Bilder.
   Bibliotheken werden erst bei Bedarf nachgeladen (Code-Splitting).
   ============================================================ */

/** Obergrenze für Uploads an die KI (Vercel-Limit 4.5 MB inkl. Base64-Overhead) */
export const MAX_AI_FILE_BYTES = 3 * 1024 * 1024;
/** Max. gespeicherter Text pro Dokument (localStorage schonen) */
export const MAX_STORED_TEXT = 15_000;

export type FileKind = 'pdf' | 'docx' | 'image' | 'text' | 'unsupported';
export type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

export type PreparedFile =
  | { kind: 'pdf'; base64: string }
  | { kind: 'image'; base64: string; mediaType: ImageMediaType }
  | { kind: 'text'; text: string };

export const CV_ACCEPT = '.pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp,application/pdf,image/*,text/plain';

export function fileKind(file: File): FileKind {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf';
  if (name.endsWith('.docx')) return 'docx';
  if (/\.(png|jpe?g|webp|gif)$/.test(name) || file.type.startsWith('image/')) return 'image';
  if (/\.(txt|md|csv)$/.test(name) || file.type.startsWith('text/')) return 'text';
  return 'unsupported';
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export async function readBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) binary += String.fromCharCode(...buf.subarray(i, i + chunk));
  return btoa(binary);
}

async function pdfToText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= Math.min(pdf.numPages, 12); i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Zeilen anhand der Y-Position rekonstruieren
    const lines: string[] = [];
    let current: string[] = [];
    let lastY: number | null = null;
    for (const item of content.items) {
      if (!('str' in item)) continue;
      const y = Math.round(item.transform[5]);
      if (lastY !== null && Math.abs(y - lastY) > 3) {
        lines.push(current.join(' '));
        current = [];
      }
      current.push(item.str);
      lastY = y;
    }
    if (current.length) lines.push(current.join(' '));
    pages.push(lines.join('\n'));
  }
  return pages.join('\n\n').replace(/[ \t]+/g, ' ').trim();
}

async function docxToText(file: File): Promise<string> {
  const mod = await import('mammoth');
  const mammoth = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const res = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return res.value.trim();
}

/** Lokale Textextraktion (ohne KI). Bilder liefern ''. */
export async function extractText(file: File): Promise<string> {
  switch (fileKind(file)) {
    case 'pdf':
      return pdfToText(file);
    case 'docx':
      return docxToText(file);
    case 'text':
      return (await file.text()).trim();
    case 'image':
      return '';
    default:
      throw new Error('Nicht unterstütztes Format. Bitte PDF, Word (.docx), Text oder Bild verwenden.');
  }
}

/** Datei für den KI-Aufruf vorbereiten: PDF/Bild als Base64, Word/Text als Text */
export async function prepareForAi(file: File, localText?: string): Promise<PreparedFile> {
  const kind = fileKind(file);
  if ((kind === 'pdf' || kind === 'image') && file.size > MAX_AI_FILE_BYTES) {
    if (localText && localText.length > 50) return { kind: 'text', text: localText };
    throw new Error(`Die Datei ist zu gross (${formatBytes(file.size)}, max. ${formatBytes(MAX_AI_FILE_BYTES)}).`);
  }
  if (kind === 'pdf') return { kind: 'pdf', base64: await readBase64(file) };
  if (kind === 'image') {
    const mediaType = (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) ? file.type : 'image/jpeg') as ImageMediaType;
    return { kind: 'image', base64: await readBase64(file), mediaType };
  }
  return { kind: 'text', text: localText ?? (await extractText(file)) };
}
