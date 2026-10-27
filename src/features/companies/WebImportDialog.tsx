import { useEffect, useState } from 'react';
import { Globe, Sparkles } from 'lucide-react';
import type { CompanyDraft, ExtractionResult } from '@/types';
import { extractCompany, scrapeWebsite, siteFromPastedText } from '@/lib/ai';
import { Button, Callout, Field, Input, Modal, Spinner, Textarea } from '@/components/ui';
import { AiModeHint } from '@/components/shared/AiStatus';

/** Schritt 1: Webseiten-Link eingeben → Seite lesen und auswerten */
export function WebImportDialog({ open, onClose, onResult }: { open: boolean; onClose: () => void; onResult: (r: ExtractionResult<CompanyDraft>) => void }) {
  const [url, setUrl] = useState('');
  const [pasted, setPasted] = useState('');
  const [needsPaste, setNeedsPaste] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setUrl('');
      setPasted('');
      setNeedsPaste(false);
      setError('');
      setBusy(false);
    }
  }, [open]);

  const analyze = async () => {
    if (!url.trim()) {
      setError('Bitte eine Webseiten-Adresse eingeben.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      let site;
      if (needsPaste && pasted.trim().length > 40) {
        site = siteFromPastedText(url.trim(), pasted);
      } else {
        setStatus('Webseite und Kontaktseiten werden gelesen…');
        site = await scrapeWebsite(url.trim());
      }
      setStatus('Angaben werden ausgewertet…');
      onResult(await extractCompany(site));
    } catch (e) {
      const status = (e as { status?: number }).status ?? 0;
      setError((e as Error).message);
      // Abruf nicht möglich (z.B. Seite blockiert Bots) → Einfügen anbieten
      if (status === 0 || status === 404 || status >= 500) setNeedsPaste(true);
    } finally {
      setBusy(false);
      setStatus('');
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="Unternehmen von Webseite importieren"
      subtitle="Firmenname, Adresse, Telefon, E-Mail und Kontaktpersonen werden automatisch übernommen."
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Abbrechen
          </Button>
          <Button variant="primary" icon={<Sparkles size={15} />} loading={busy} onClick={analyze}>
            Webseite auswerten
          </Button>
        </>
      }
    >
      <Callout tone="info" icon={<Sparkles size={16} />} className="mb-4">
        <AiModeHint />
      </Callout>
      <Field label="Webseite" required>
        <div className="relative">
          <Globe size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle" />
          <Input
            name="url"
            className="pl-8"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !busy && void analyze()}
            placeholder="www.beispielfirma.ch"
            autoComplete="off"
          />
        </div>
      </Field>
      {needsPaste && (
        <Field label="Seiteninhalt einfügen" className="mt-3" hint="Den Text der Kontakt- oder Impressumsseite kopieren und hier einfügen.">
          <Textarea name="pasted" rows={7} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Impressum, Adresse, Telefon, E-Mail…" />
        </Field>
      )}
      {busy && (
        <div className="mt-3 flex items-center gap-2 text-sm text-muted">
          <Spinner size={16} className="text-brand" /> {status || 'Bitte warten…'}
        </div>
      )}
      {error && (
        <Callout tone="error" className="mt-3">
          {error}
          {needsPaste && ' – Sie können den Seiteninhalt alternativ unten einfügen.'}
        </Callout>
      )}
    </Modal>
  );
}
