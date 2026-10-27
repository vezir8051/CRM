import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { extractCandidate } from '@/lib/ai';
import { CV_ACCEPT } from '@/lib/files';
import { Button, Callout, Field, Modal, Spinner, Textarea } from '@/components/ui';
import { FileDropzone } from '@/components/shared/FileDropzone';
import { AiModeHint } from '@/components/shared/AiStatus';
import type { CandidateImport } from './CandidateForm';

/** Schritt 1 des Imports: Datei/Text wählen und auswerten → onResult öffnet das Formular */
export function CvImportDialog({ open, onClose, onResult }: { open: boolean; onClose: () => void; onResult: (r: CandidateImport) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setFile(null);
      setText('');
      setError('');
      setBusy(false);
    }
  }, [open]);

  const analyze = async () => {
    if (!file && text.trim().length < 30) {
      setError('Bitte eine Datei wählen oder mindestens ein paar Zeilen Lebenslauf-Text einfügen.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await extractCandidate(file ? { file } : { text });
      onResult({ result, fileName: file?.name, fileSize: file?.size });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="Lebenslauf importieren"
      subtitle="Das CRM liest die Angaben aus und füllt das Kandidatenformular automatisch aus."
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Abbrechen
          </Button>
          <Button variant="primary" icon={<Sparkles size={15} />} loading={busy} onClick={analyze}>
            {busy ? 'Wird ausgewertet…' : 'Auswerten'}
          </Button>
        </>
      }
    >
      <Callout tone="info" icon={<Sparkles size={16} />} className="mb-4">
        <AiModeHint />
      </Callout>
      <FileDropzone
        accept={CV_ACCEPT}
        file={file}
        onFile={(f) => {
          setFile(f);
          setError('');
        }}
        title="Lebenslauf hierhin ziehen oder klicken"
        hint="PDF, Word (.docx), Text oder Foto/Scan (Bilder nur mit KI) · max. 3 MB für die KI"
      />
      <div className="my-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-subtle">
        <span className="h-px flex-1 bg-line" /> oder <span className="h-px flex-1 bg-line" />
      </div>
      <Field label="Lebenslauf-Text einfügen">
        <Textarea rows={6} value={text} disabled={!!file} onChange={(e) => setText(e.target.value)} placeholder="Text aus E-Mail, LinkedIn-Profil oder Dokument hier einfügen…" />
      </Field>
      {busy && (
        <div className="mt-3 flex items-center gap-2 text-sm text-muted">
          <Spinner size={16} className="text-brand" /> Lebenslauf wird gelesen und ausgewertet…
        </div>
      )}
      {error && (
        <Callout tone="error" className="mt-3">
          {error}
        </Callout>
      )}
    </Modal>
  );
}
