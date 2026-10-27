import { useEffect, useState } from 'react';
import { Copy, Mail, Sparkles } from 'lucide-react';
import type { Candidate, Company, Contact, Job } from '@/types';
import { EMAIL_KINDS, emailTemplate, type EmailKind } from '@/domain/templates';
import { fullName } from '@/domain/format';
import { generateText } from '@/lib/ai';
import { copyToClipboard } from '@/lib/download';
import { useData } from '@/store/data';
import { useCurrentUser } from '@/store/session';
import { toast } from '@/store/ui';
import { Button, Field, Input, Modal, Select, Textarea } from '@/components/ui';
import { SourceBadge } from './AiStatus';

/** E-Mail-Entwurf per KI (Fallback: Vorlage) erstellen, kopieren oder im Mailprogramm öffnen */
export function EmailComposer({ open, onClose, candidate, job, company, contact, defaultKind = 'vorstellung' }: { open: boolean; onClose: () => void; candidate?: Candidate; job?: Job; company?: Company; contact?: Contact; defaultKind?: EmailKind }) {
  const settings = useData((s) => s.settings);
  const addActivity = useData((s) => s.addActivity);
  const user = useCurrentUser();
  const [kind, setKind] = useState<EmailKind>(defaultKind);
  const [betreff, setBetreff] = useState('');
  const [text, setText] = useState('');
  const [source, setSource] = useState<'ki' | 'vorlage' | null>(null);
  const [busy, setBusy] = useState(false);

  const toCandidate = ['einladung', 'angebot', 'absage'].includes(kind);
  const empfaenger = toCandidate ? candidate?.email ?? '' : contact?.email ?? company?.email ?? '';

  useEffect(() => {
    if (open) {
      setKind(defaultKind);
      setBetreff('');
      setText('');
      setSource(null);
    }
  }, [open, defaultKind]);

  const generate = async () => {
    setBusy(true);
    const fallback = () => emailTemplate(kind, { candidate, job, company, contact, settings, absender: user?.name ?? '' });
    const res = await generateText(
      {
        kind: 'email',
        emailKind: EMAIL_KINDS.find((k) => k.value === kind)?.label ?? kind,
        context: {
          kandidat: candidate ? { name: fullName(candidate), anrede: candidate.anrede, beruf: candidate.beruf, erfahrungJahre: candidate.erfahrungJahre, skills: candidate.skills.slice(0, 6), verfuegbarAb: candidate.verfuegbarAb } : null,
          vakanz: job ? { titel: job.titel, ort: job.ort, pensum: job.pensum } : null,
          kunde: company?.name ?? null,
          kontaktperson: contact ? { anrede: contact.anrede, vorname: contact.vorname, nachname: contact.nachname, funktion: contact.funktion } : null,
          absender: { name: user?.name, firma: settings.firmenname, telefon: settings.telefon },
        },
      },
      fallback,
    );
    setBetreff(res.betreff);
    setText(res.text);
    setSource(res.source);
    if (res.warning) toast.info(res.warning);
    setBusy(false);
  };

  const logActivity = () => {
    addActivity({
      typ: 'E-Mail', betreff: betreff || EMAIL_KINDS.find((k) => k.value === kind)!.label, beschreibung: text.slice(0, 500), faelligAm: '', erledigt: true,
      bezug: candidate ? { typ: 'candidate', id: candidate.id } : job ? { typ: 'job', id: job.id } : company ? { typ: 'company', id: company.id } : null,
      userId: user?.id ?? '', auto: false,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="E-Mail-Assistent"
      subtitle="Entwurf erstellen, anpassen und versenden"
      footer={
        <>
          {source && <span className="mr-auto"><SourceBadge source={source} /></span>}
          <Button
            icon={<Copy size={15} />}
            disabled={!text}
            onClick={async () => {
              const ok = await copyToClipboard(`${betreff}\n\n${text}`);
              toast[ok ? 'success' : 'error'](ok ? 'In die Zwischenablage kopiert' : 'Kopieren nicht möglich');
            }}
          >
            Kopieren
          </Button>
          <Button
            variant="primary"
            icon={<Mail size={15} />}
            disabled={!text}
            onClick={() => {
              logActivity();
              window.location.href = `mailto:${encodeURIComponent(empfaenger)}?subject=${encodeURIComponent(betreff)}&body=${encodeURIComponent(text)}`;
              toast.success('Im Mailprogramm geöffnet und als Aktivität protokolliert');
              onClose();
            }}
          >
            Im Mailprogramm öffnen
          </Button>
        </>
      }
    >
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Art der E-Mail" className="min-w-[240px] flex-1">
          <Select value={kind} onChange={(e) => setKind(e.target.value as EmailKind)}>
            {EMAIL_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </Select>
        </Field>
        <Button variant="soft" icon={<Sparkles size={15} />} loading={busy} onClick={generate}>
          Entwurf erstellen
        </Button>
      </div>
      <div className="space-y-3">
        <Field label="An">
          <Input value={empfaenger} readOnly className="bg-surface-2" placeholder="Keine E-Mail-Adresse hinterlegt" />
        </Field>
        <Field label="Betreff">
          <Input value={betreff} onChange={(e) => setBetreff(e.target.value)} />
        </Field>
        <Field label="Text">
          <Textarea rows={12} value={text} onChange={(e) => setText(e.target.value)} placeholder="Klicken Sie auf «Entwurf erstellen»…" />
        </Field>
      </div>
    </Modal>
  );
}
