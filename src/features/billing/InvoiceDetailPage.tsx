import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, CircleCheck, Mail, Printer, Receipt, RotateCcw } from 'lucide-react';
import { buildQrBill, formatIban } from '@/domain/qrbill';
import { isInvoiceOverdue } from '@/domain/billing';
import { daysBetween, fmtCHF, fmtDate, fmtNumber, fullName, monthLabel, nowISO, todayISO } from '@/domain/format';
import { useData } from '@/store/data';
import { useLookups } from '@/store/selectors';
import { useCurrentUser } from '@/store/session';
import { confirmDialog, toast } from '@/store/ui';
import { Badge, Button, ButtonLink, Callout, EmptyState, StatusBadge } from '@/components/ui';
import { QrBillSlip } from '@/components/shared/QrBill';

export default function InvoiceDetailPage() {
  const { id = '' } = useParams();
  const inv = useData((s) => s.invoices.find((i) => i.id === id));
  const settings = useData((s) => s.settings);
  const setInvoiceStatus = useData((s) => s.setInvoiceStatus);
  const addActivity = useData((s) => s.addActivity);
  const me = useCurrentUser();
  const l = useLookups();
  const today = todayISO();

  if (!inv) return <EmptyState icon={<Receipt size={22} />} title="Rechnung nicht gefunden" action={<ButtonLink to="/rechnungen">Zur Liste</ButtonLink>} />;
  const company = l.company.get(inv.companyId);
  const overdue = isInvoiceOverdue(inv, today);
  const qr = buildQrBill(inv, company, settings);
  const contact = company?.kontakte.find((k) => k.email) ?? null;
  const reminderTo = contact?.email || company?.email || '';

  const sendReminder = () => {
    const tage = daysBetween(inv.faelligAm, today);
    const anrede = contact ? `Guten Tag ${contact.anrede === 'Frau' ? 'Frau' : contact.anrede === 'Herr' ? 'Herr' : ''} ${contact.nachname}`.replace(/\s+/g, ' ') : 'Guten Tag';
    const body = [
      `${anrede}`,
      '',
      `Gemäss unserer Buchhaltung ist die Rechnung ${inv.nr} vom ${fmtDate(inv.datum)} über ${fmtCHF(inv.total, { decimals: true })} seit ${tage} Tagen fällig (Fälligkeit ${fmtDate(inv.faelligAm)}).`,
      '',
      `Sicher handelt es sich um ein Versehen. Wir bitten Sie, den Betrag innert 10 Tagen auf unser Konto ${formatIban(settings.iban)} zu überweisen. Sollte sich Ihre Zahlung mit dieser Erinnerung gekreuzt haben, betrachten Sie dieses Schreiben bitte als gegenstandslos.`,
      '',
      'Freundliche Grüsse',
      me?.name ?? '',
      settings.firmenname,
    ].join('\n');
    window.location.href = `mailto:${encodeURIComponent(reminderTo)}?subject=${encodeURIComponent(`Zahlungserinnerung Rechnung ${inv.nr}`)}&body=${encodeURIComponent(body)}`;
    addActivity({
      typ: 'E-Mail', betreff: `Zahlungserinnerung ${inv.nr} gesendet`, beschreibung: `An ${reminderTo} · offen ${fmtCHF(inv.total, { decimals: true })}`,
      faelligAm: nowISO(), erledigt: true, bezug: { typ: 'company', id: inv.companyId }, userId: me?.id ?? '', auto: true,
    });
    toast.success('Zahlungserinnerung vorbereitet und als Aktivität protokolliert');
  };

  return (
    <>
      <div className="no-print">
        <Link to="/rechnungen" className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-brand">
          <ArrowLeft size={15} /> Rechnungen
        </Link>
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <h1 className="flex items-center gap-2.5 text-xl font-bold">
            Rechnung {inv.nr} {overdue ? <Badge tone="red">Überfällig</Badge> : <StatusBadge value={inv.status} />}
          </h1>
          <div className="ml-auto flex flex-wrap gap-2">
            {inv.status === 'Offen' && (
              <>
                {overdue && (
                  <Button icon={<Mail size={15} />} onClick={sendReminder} disabled={!reminderTo} title={reminderTo ? undefined : 'Keine E-Mail-Adresse beim Kunden hinterlegt'}>
                    Zahlungserinnerung
                  </Button>
                )}
                <Button
                  variant="primary"
                  icon={<CircleCheck size={15} />}
                  onClick={() => {
                    setInvoiceStatus(inv.id, 'Bezahlt');
                    toast.success('Als bezahlt markiert');
                  }}
                >
                  Als bezahlt markieren
                </Button>
                <Button
                  icon={<Ban size={15} />}
                  onClick={async () => {
                    const msg = inv.typ === 'Verleih' ? 'Die zugehörigen Rapporte werden wieder zur Verrechnung freigegeben.' : 'Die Vermittlung kann danach erneut verrechnet werden.';
                    if (!(await confirmDialog({ title: `Rechnung ${inv.nr} stornieren`, message: `${msg} Eine Stornierung kann nicht rückgängig gemacht werden.`, confirmLabel: 'Stornieren', tone: 'danger' }))) return;
                    setInvoiceStatus(inv.id, 'Storniert');
                    toast.success('Rechnung storniert');
                  }}
                >
                  Stornieren
                </Button>
              </>
            )}
            {inv.status === 'Bezahlt' && (
              <Button icon={<RotateCcw size={15} />} onClick={() => setInvoiceStatus(inv.id, 'Offen')}>
                Zahlung zurücksetzen
              </Button>
            )}
            <Button icon={<Printer size={15} />} onClick={() => window.print()}>
              Drucken / PDF
            </Button>
          </div>
        </div>
        {inv.status === 'Bezahlt' && <Callout tone="success" className="mb-4">Bezahlt am {fmtDate(inv.bezahltAm)}.</Callout>}
        {inv.status === 'Storniert' && <Callout tone="error" className="mb-4">Diese Rechnung wurde storniert.</Callout>}
        {!qr.ok && (
          <Callout tone="warn" className="mb-4">
            QR-Zahlteil nicht verfügbar: {qr.error}{' '}
            <Link to="/einstellungen" className="font-semibold underline">
              Einstellungen öffnen
            </Link>
          </Callout>
        )}
      </div>

      {/* Rechnungsdokument (A4) */}
      <article className="print-area mx-auto max-w-[210mm] overflow-hidden rounded-xl border border-line bg-white text-slate-900 shadow-card">
        <div className="px-[14mm] pb-[10mm] pt-[12mm] text-[13px] leading-relaxed">
          <header className="flex justify-between gap-6">
            <div>
              <div className="text-lg font-bold text-[#1e3a8a]">{settings.firmenname}</div>
              <div className="text-slate-500">
                {settings.strasse} · {settings.plz} {settings.ort}
                <br />
                {settings.telefon} · {settings.email}
                {settings.website && <> · {settings.website}</>}
              </div>
            </div>
            <div className="text-right text-xs text-slate-500">{settings.uid}</div>
          </header>

          <div className="mt-10 flex justify-between gap-6">
            <address className="not-italic">
              {company?.name}
              <br />
              {contact && (
                <>
                  z. Hd. {fullName(contact)}
                  <br />
                </>
              )}
              {company?.strasse}
              <br />
              {company?.plz} {company?.ort}
            </address>
            <dl className="grid grid-cols-[auto_auto] gap-x-4 text-[12.5px]">
              <dt className="text-slate-500">Rechnungsdatum</dt>
              <dd>{fmtDate(inv.datum)}</dd>
              <dt className="text-slate-500">Zahlbar bis</dt>
              <dd>{fmtDate(inv.faelligAm)}</dd>
              <dt className="text-slate-500">Kunden-Nr.</dt>
              <dd>{company?.nr}</dd>
              {inv.periode && (
                <>
                  <dt className="text-slate-500">Periode</dt>
                  <dd>{monthLabel(inv.periode)}</dd>
                </>
              )}
            </dl>
          </div>

          <h2 className="mt-10 text-xl font-bold">
            {inv.typ === 'Verleih' ? 'Rechnung Personalverleih' : 'Rechnung Vermittlungshonorar'} {inv.nr}
          </h2>

          <table className="mt-5 w-full text-[12.5px]">
            <thead>
              <tr className="border-b-2 border-slate-800 text-left">
                <th className="py-1.5 pr-2">Beschreibung</th>
                <th className="py-1.5 px-2 text-right">Menge</th>
                <th className="py-1.5 px-2 text-right">Ansatz</th>
                <th className="py-1.5 pl-2 text-right">Betrag CHF</th>
              </tr>
            </thead>
            <tbody>
              {inv.positionen.map((p, i) => (
                <tr key={i} className="border-b border-slate-200 align-top">
                  <td className="py-1.5 pr-2">{p.beschreibung}</td>
                  <td className="whitespace-nowrap py-1.5 px-2 text-right tabular-nums">
                    {fmtNumber(p.menge)} {p.einheit}
                  </td>
                  <td className="whitespace-nowrap py-1.5 px-2 text-right tabular-nums">{fmtNumber(p.preis)}</td>
                  <td className="whitespace-nowrap py-1.5 pl-2 text-right tabular-nums">{p.betrag.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="ml-auto mt-4 w-full max-w-[280px] text-[13px]">
            <div className="flex justify-between py-0.5">
              <span>Total netto</span>
              <span className="tabular-nums">{inv.netto.toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span>MWST {inv.mwstSatz} %</span>
              <span className="tabular-nums">{inv.mwst.toFixed(2)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t-2 border-slate-800 py-1 text-[15px] font-bold">
              <span>Total CHF</span>
              <span className="tabular-nums">{inv.total.toFixed(2)}</span>
            </div>
          </div>

          <p className="mt-8 text-[12.5px] text-slate-600">
            Zahlbar innert {company?.zahlungsfrist ?? 30} Tagen netto auf IBAN {formatIban(settings.iban)}. Bitte verwenden Sie den QR-Zahlteil oder geben Sie die Rechnungsnummer {inv.nr} an.
            <br />
            Vielen Dank für die angenehme Zusammenarbeit.
          </p>
        </div>
        {qr.ok && (
          <div className="overflow-x-auto">
            <QrBillSlip data={qr.data} payload={qr.payload} />
          </div>
        )}
      </article>
    </>
  );
}
