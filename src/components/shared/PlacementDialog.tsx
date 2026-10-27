import { useEffect, useMemo, useState } from 'react';
import type { Phase, Placement } from '@/types';
import { PHASES } from '@/types';
import { fullName } from '@/domain/format';
import { suggestHonorar } from '@/domain/billing';
import { useData } from '@/store/data';
import { toast } from '@/store/ui';
import { Button, Field, FormGrid, Input, Modal, NumberInput, Select, Textarea } from '@/components/ui';

/**
 * Kandidat für Vakanz vorschlagen (neu) oder Vermittlung bearbeiten.
 * candidateId/jobId setzen Vorauswahl bei neuen Vermittlungen.
 */
export function PlacementDialog({ open, onClose, placement, candidateId, jobId, onSaved }: { open: boolean; onClose: () => void; placement?: Placement | null; candidateId?: string; jobId?: string; onSaved?: (p: Placement) => void }) {
  const candidates = useData((s) => s.candidates);
  const jobs = useData((s) => s.jobs);
  const companies = useData((s) => s.companies);
  const addPlacement = useData((s) => s.addPlacement);
  const updatePlacement = useData((s) => s.updatePlacement);
  const movePlacement = useData((s) => s.movePlacement);

  const [cId, setCId] = useState('');
  const [jId, setJId] = useState('');
  const [phase, setPhase] = useState<Phase>('Vorgeschlagen');
  const [honorar, setHonorar] = useState<number | null>(null);
  const [startdatum, setStartdatum] = useState('');
  const [notiz, setNotiz] = useState('');

  useEffect(() => {
    if (!open) return;
    setCId(placement?.candidateId ?? candidateId ?? '');
    setJId(placement?.jobId ?? jobId ?? '');
    setPhase(placement?.phase ?? 'Vorgeschlagen');
    setHonorar(placement?.honorar ?? null);
    setStartdatum(placement?.startdatum ?? '');
    setNotiz(placement?.notiz ?? '');
  }, [open, placement, candidateId, jobId]);

  const openJobs = useMemo(() => jobs.filter((j) => j.status === 'Offen' || j.status === 'In Bearbeitung' || j.id === jId), [jobs, jId]);
  const activeCandidates = useMemo(() => candidates.filter((c) => c.status !== 'Inaktiv' || c.id === cId), [candidates, cId]);
  const job = jobs.find((j) => j.id === jId);
  const company = companies.find((c) => c.id === job?.companyId);
  const vorschlag = job ? suggestHonorar(job, company, candidates.find((c) => c.id === cId)) : null;

  const save = () => {
    if (placement) {
      updatePlacement(placement.id, { honorar, startdatum, notiz });
      if (phase !== placement.phase) movePlacement(placement.id, phase, 'Phase manuell geändert.');
      toast.success('Vermittlung aktualisiert');
      onSaved?.(placement);
      onClose();
      return;
    }
    if (!cId || !jId) {
      toast.error('Bitte Kandidat und Vakanz wählen.');
      return;
    }
    const res = addPlacement({ candidateId: cId, jobId: jId, phase, honorar, startdatum, notiz });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success('Kandidat vorgeschlagen');
    onSaved?.(res.value);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={placement ? 'Vermittlung bearbeiten' : 'Kandidat vorschlagen'}
      footer={
        <>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" onClick={save}>
            {placement ? 'Speichern' : 'Vorschlagen'}
          </Button>
        </>
      }
    >
      <FormGrid>
        <Field label="Kandidat" required wide>
          <Select value={cId} disabled={!!placement} onChange={(e) => setCId(e.target.value)}>
            <option value="">– wählen –</option>
            {activeCandidates.map((c) => (
              <option key={c.id} value={c.id}>
                {fullName(c)} – {c.beruf} ({c.nr})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Vakanz" required wide>
          <Select value={jId} disabled={!!placement} onChange={(e) => setJId(e.target.value)}>
            <option value="">– wählen –</option>
            {openJobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.titel} – {companies.find((c) => c.id === j.companyId)?.name ?? '?'} ({j.nr})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Phase">
          <Select value={phase} onChange={(e) => setPhase(e.target.value as Phase)}>
            {PHASES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
        </Field>
        <Field
          label="Honorar (CHF)"
          hint={
            vorschlag && honorar === null ? (
              <button type="button" className="text-brand hover:underline" onClick={() => setHonorar(vorschlag)}>
                Vorschlag übernehmen: CHF {vorschlag.toLocaleString('de-CH')} ({company?.honorarSatz} %)
              </button>
            ) : job?.art === 'Temporär' ? 'Bei Temporär-Einsätzen wird über Rapporte abgerechnet.' : undefined
          }
        >
          <NumberInput value={honorar} min={0} step={100} onChange={setHonorar} placeholder="z.B. 25000" />
        </Field>
        <Field label="Stellenantritt">
          <Input type="date" value={startdatum} onChange={(e) => setStartdatum(e.target.value)} />
        </Field>
        <Field label="Notiz" wide>
          <Textarea value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="Bemerkungen…" />
        </Field>
      </FormGrid>
    </Modal>
  );
}
