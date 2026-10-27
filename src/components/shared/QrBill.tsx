import { useMemo, type ReactNode } from 'react';
import qrcode from 'qrcode-generator';
import { Scissors } from 'lucide-react';
import { formatIban, type QrAddress, type QrBillData } from '@/domain/qrbill';

/** QR-Code-Module als SVG-Pfad. Der Text wird als UTF-8 kodiert (Vorgabe QR-Rechnung). */
function useQrPath(payload: string) {
  return useMemo(() => {
    const utf8 = String.fromCharCode(...new TextEncoder().encode(payload));
    const qr = qrcode(0, 'M');
    qr.addData(utf8, 'Byte');
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) d += `M${x} ${y}h1v1h-1z`;
    return { n, d };
  }, [payload]);
}

function SwissQrCode({ payload }: { payload: string }) {
  const { n, d } = useQrPath(payload);
  // Schweizerkreuz: 7 × 7 mm auf 46 × 46 mm
  const s = (n * 7) / 46;
  const o = (n - s) / 2;
  const bar = s * 0.19;
  const len = s * 0.6;
  return (
    <svg viewBox={`0 0 ${n} ${n}`} style={{ width: '46mm', height: '46mm' }} shapeRendering="crispEdges" role="img" aria-label="QR-Code für die Zahlung">
      <rect width={n} height={n} fill="#fff" />
      <path d={d} fill="#000" />
      <rect x={o - s * 0.07} y={o - s * 0.07} width={s * 1.14} height={s * 1.14} fill="#fff" />
      <rect x={o} y={o} width={s} height={s} fill="#000" />
      <rect x={(n - bar) / 2} y={(n - len) / 2} width={bar} height={len} fill="#fff" />
      <rect x={(n - len) / 2} y={(n - bar) / 2} width={len} height={bar} fill="#fff" />
    </svg>
  );
}

function Block({ title, children, small }: { title: string; children: ReactNode; small?: boolean }) {
  return (
    <div style={{ marginBottom: small ? '2.5mm' : '3.5mm' }}>
      <div style={{ fontSize: small ? '6pt' : '8pt', fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: small ? '8pt' : '10pt', lineHeight: 1.25 }}>{children}</div>
    </div>
  );
}

function Address({ a }: { a: QrAddress }) {
  return (
    <>
      {a.name}
      <br />
      {[a.strasse, a.hausnummer].filter(Boolean).join(' ')}
      {(a.strasse || a.hausnummer) && <br />}
      {a.plz} {a.ort}
    </>
  );
}

/** Leeres Eckfeld (für handschriftliche Angaben) */
function CornerBox({ w, h }: { w: string; h: string }) {
  const c = '3mm';
  const line = '0.75pt solid #000';
  const corner = (pos: Record<string, string | number>) => <span style={{ position: 'absolute', width: c, height: c, ...pos }} />;
  return (
    <span style={{ position: 'relative', display: 'block', width: w, height: h }}>
      {corner({ top: 0, left: 0, borderTop: line, borderLeft: line })}
      {corner({ top: 0, right: 0, borderTop: line, borderRight: line })}
      {corner({ bottom: 0, left: 0, borderBottom: line, borderLeft: line })}
      {corner({ bottom: 0, right: 0, borderBottom: line, borderRight: line })}
    </span>
  );
}

const fmtAmount = (v: number) => v.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/['’]/g, ' ');

/** Zahlteil mit Empfangsschein (A6 quer, 210 × 105 mm) */
export function QrBillSlip({ data, payload }: { data: QrBillData; payload: string }) {
  const amount = data.amount !== null ? fmtAmount(data.amount) : null;
  return (
    <div className="qr-bill" style={{ position: 'relative', width: '210mm', maxWidth: '100%', height: '105mm', display: 'flex', background: '#fff', color: '#000', fontFamily: 'Helvetica, Arial, "Liberation Sans", sans-serif', borderTop: '0.75pt dashed #000', breakInside: 'avoid' }}>
      <Scissors size={12} style={{ position: 'absolute', top: '-6.5px', left: '12mm', background: '#fff' }} aria-hidden />
      {/* Empfangsschein */}
      <div style={{ width: '62mm', flexShrink: 0, padding: '5mm', borderRight: '0.75pt dashed #000', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: '11pt', fontWeight: 700, marginBottom: '3mm' }}>Empfangsschein</div>
        <Block small title="Konto / Zahlbar an">
          {formatIban(data.iban)}
          <br />
          <Address a={data.creditor} />
        </Block>
        <Block small title={data.debtor ? 'Zahlbar durch' : 'Zahlbar durch (Name/Adresse)'}>
          {data.debtor ? <Address a={data.debtor} /> : <CornerBox w="52mm" h="20mm" />}
        </Block>
        <div style={{ marginTop: 'auto', display: 'flex', gap: '4mm', fontSize: '8pt' }}>
          <div>
            <div style={{ fontSize: '6pt', fontWeight: 700 }}>Währung</div>
            {data.currency}
          </div>
          <div>
            <div style={{ fontSize: '6pt', fontWeight: 700 }}>Betrag</div>
            {amount ?? <CornerBox w="30mm" h="10mm" />}
          </div>
        </div>
        <div style={{ fontSize: '6pt', fontWeight: 700, textAlign: 'right', marginTop: '4mm' }}>Annahmestelle</div>
      </div>
      {/* Zahlteil */}
      <div style={{ flex: 1, padding: '5mm', display: 'flex', gap: '5mm' }}>
        <div style={{ width: '46mm', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '11pt', fontWeight: 700, marginBottom: '5mm' }}>Zahlteil</div>
          <SwissQrCode payload={payload} />
          <div style={{ marginTop: '5mm', display: 'flex', gap: '4mm', fontSize: '10pt' }}>
            <div>
              <div style={{ fontSize: '8pt', fontWeight: 700 }}>Währung</div>
              {data.currency}
            </div>
            <div>
              <div style={{ fontSize: '8pt', fontWeight: 700 }}>Betrag</div>
              {amount ?? <CornerBox w="40mm" h="15mm" />}
            </div>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Block title="Konto / Zahlbar an">
            {formatIban(data.iban)}
            <br />
            <Address a={data.creditor} />
          </Block>
          {data.message && <Block title="Zusätzliche Informationen">{data.message}</Block>}
          <Block title={data.debtor ? 'Zahlbar durch' : 'Zahlbar durch (Name/Adresse)'}>{data.debtor ? <Address a={data.debtor} /> : <CornerBox w="65mm" h="25mm" />}</Block>
        </div>
      </div>
    </div>
  );
}
