import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Calculator } from 'lucide-react';
import type { Assignment, AssignmentStatus } from '@/types';
import { ASSIGNMENT_STATUS } from '@/types';
import { calcMargin, calcTariff, marginTone } from '@/domain/tarif';
import { fmtCHF, fmtPercent, fullName } from '@/domain/format';
import { useData } from '@/store/data';
import { emptyAssignment, type AssignmentInput } from '@/store/factories';
import { toast } from '@/store/ui';
import { Badge, Button, Field, FormGrid, FormSection, Input, Modal, NumberInput, Select, Textarea } from '@/components/ui';

export interface AssignmentPreset {
  candidateId?: string;
  companyId?: string;
  placementId?: string;
}

/** Einsatz erfassen/bearbeiten – mit Live-Berechnung von Lohnkosten und Marge */
export function AssignmentForm({ open, onClose, assignment, preset, onSaved }: { open: boolean; onClose: () => void; assignment?: Assignment | null; preset?: AssignmentPreset; onSaved?: (a: Assignment) => void }) {
  const candidates = useData((s) => s.candidates);
  const companies = useData((s) => s.companies);
  const jobs = useData((s) => s.jobs);
  const placements = useData((s) => s.placements);
  const settings = useData((s) => s.settings);
  const addAssignment = useData((s) => s.addAssignment);
  const updateAssignment = useData((s) => s.updateAssignment);
  const [form, setForm] = useState<AssignmentInput>(emptyAssignment);

  useEffect(() => {
    if (!open) return;
    if (assignment) {
      const { id: _i, nr: _n, createdAt: _c, updatedAt: _u, ...rest } = assignment;
      setForm(rest);
      return;
    }
    const base = emptyAssignment();
    const p = placements.find((x) => x.id === preset?.placementId);
    const job = jobs.find((j) => j.id === p?.jobId);
    const candidateId = p?.candidateId ?? preset?.candidateId ?? '';
    const cand = candidates.find((c) => c.id === candidateId);
    const companyId = job?.companyId ?? preset?.companyId ?? '';
    const stundenlohn = cand?.stundenlohn ?? base.stundenlohn;
    setForm({
      ...base,
      candidateId,
      companyId,
      jobId: job?.id ?? '',
      funktion: job?.titel ?? cand?.beruf ?? '',
      einsatzort: job?.ort ?? companies.find((c) => c.id === companyId)?.ort ?? '',
      start: p?.startdatum || base.start,
      stundenlohn,
      tarif: job?.tarif ?? calcTariff(stundenlohn, settings.tarif).verrechnungssatz,
    });
  }, [open, assignment, preset, placements, jobs, candidates, companies, settings.tarif]);

  const set = <K extends keyof AssignmentInput>(k: K, v: AssignmentInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const m = useMemo(() => calcMargin(form.stundenlohn, form.tarif, settings.tarif), [form.stundenlohn, form.tarif, settings.tarif]);
  const companyJobs = jobs.filter((j) => j.companyId === form.companyId && (j.art !== 'Festanstellung' || j.id === form.jobId));

  const save = () => {
    if (!form.candidateId) return toast.error('Bitte einen Kandidaten wählen.');
    if (!form.companyId) return toast.error('Bitte einen Kunden wählen.');
    if (!form.start) return toast.error('Bitte ein Startdatum erfassen.');
    if (form.ende && form.ende < form.start) return toast.error('Das Einsatzende liegt vor dem Start.');
    if (!(form.stundenlohn > 0) || !(form.tarif > 0)) return toast.error('Stundenlohn und Verrechnungssatz müssen grösser als 0 sein.');
    const data = { ...form, funktion: form.funktion.trim() || 'Temporärmitarbeiter/in' };
    if (assignment) {
      updateAssignment(assignment.id, data);
      toast.success('Einsatz gespeichert');
      onSaved?.({ ...assignment, ...data });
    } else {
      const a = addAssignment(data);
      toast.success(`Einsatz ${a.nr} erstellt`);
      onSaved?.(a);
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={assignment ? `Einsatz ${assignment.nr} bearbeiten` : 'Neuer Einsatz'}
      subtitle="Personalverleih: Mitarbeitende/r arbeitet beim Kunden, die Agentur ist Arbeitgeberin"
      footer={
        <>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" onClick={save}>
            {assignment ? 'Speichern' : 'Einsatz erstellen'}
          </Button>
        </>
      }
    >
      <FormGrid>
        <Field label="Mitarbeiter/in" required>
          <Select
            value={form.candidateId}
            onChange={(e) => {
              const c = candidates.find((x) => x.id === e.target.value);
              setForm((f) => ({ ...f, candidateId: e.target.value, stundenlohn: c?.stundenlohn ?? f.stundenlohn, funktion: f.funktion || c?.beruf || '' }));
            }}
          >
            <option value="">– wählen –</option>
            {candidates
              .filter((c) => c.status !== 'Inaktiv' || c.id === form.candidateId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {fullName(c)} · {c.beruf}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Kunde (Einsatzbetrieb)" required>
          <Select value={form.companyId} onChange={(e) => setForm((f) => ({ ...f, companyId: e.target.value, jobId: '', einsatzort: f.einsatzort || companies.find((c) => c.id === e.target.value)?.ort || '' }))}>
            <option value="">– wählen –</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Vakanz (optional)">
          <Select
            value={form.jobId}
            disabled={!companyJobs.length}
            onChange={(e) => {
              const j = jobs.find((x) => x.id === e.target.value);
              setForm((f) => ({ ...f, jobId: e.target.value, funktion: j?.titel ?? f.funktion, tarif: j?.tarif ?? f.tarif, einsatzort: j?.ort || f.einsatzort }));
            }}
          >
            <option value="">– keine –</option>
            {companyJobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.titel} ({j.nr})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Funktion">
          <Input value={form.funktion} onChange={(e) => set('funktion', e.target.value)} placeholder="z.B. Elektroinstallateur" />
        </Field>
        <Field label="Einsatzort">
          <Input value={form.einsatzort} onChange={(e) => set('einsatzort', e.target.value)} />
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={(e) => set('status', e.target.value as AssignmentStatus)}>
            {ASSIGNMENT_STATUS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <Field label="Start" required>
          <Input type="date" value={form.start} onChange={(e) => set('start', e.target.value)} />
        </Field>
        <Field label="Ende" hint="Leer = unbefristet">
          <Input type="date" value={form.ende} min={form.start} onChange={(e) => set('ende', e.target.value)} />
        </Field>

        <FormSection title="Lohn & Tarif" />
        <Field label="Grundlohn (CHF/h)" required hint="Ohne Ferien-, Feiertags- und 13.-ML-Zuschläge">
          <NumberInput min={0} step={0.5} value={form.stundenlohn} onChange={(v) => set('stundenlohn', v ?? 0)} />
        </Field>
        <Field label="Verrechnungssatz an Kunde (CHF/h)" required>
          <div className="flex gap-2">
            <NumberInput min={0} step={0.5} value={form.tarif} onChange={(v) => set('tarif', v ?? 0)} />
            <Button
              icon={<Calculator size={15} />}
              title={`Tarif für ${settings.tarif.zielmarge} % Zielmarge berechnen`}
              onClick={() => set('tarif', calcTariff(form.stundenlohn, settings.tarif).verrechnungssatz)}
            >
              {settings.tarif.zielmarge} %
            </Button>
          </div>
        </Field>
        <div className="sm:col-span-2 grid grid-cols-2 gap-3 rounded-lg border border-line bg-surface-2 p-3 text-[13px] sm:grid-cols-4">
          <Stat label="Lohnkosten/h" value={fmtCHF(m.lohnkosten, { decimals: true })} />
          <Stat label="Deckungsbeitrag/h" value={fmtCHF(m.deckungsbeitrag, { decimals: true })} />
          <Stat label="Marge" value={<Badge tone={marginTone(m.margeProzent)}>{fmtPercent(m.margeProzent)}</Badge>} />
          <Stat label={`DB/Woche bei ${form.sollStunden} h`} value={fmtCHF(m.deckungsbeitrag * form.sollStunden)} />
        </div>
        <Field label="Soll-Stunden pro Woche">
          <NumberInput min={1} max={60} value={form.sollStunden} onChange={(v) => set('sollStunden', v ?? 42)} />
        </Field>
        <Field label="Notiz" wide>
          <Textarea rows={2} value={form.notiz} onChange={(e) => set('notiz', e.target.value)} placeholder="z.B. Arbeitszeiten, PSA, Ansprechperson vor Ort" />
        </Field>
      </FormGrid>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-[11.5px] text-muted">{label}</div>
      <div className="font-semibold tabular-nums">{value}</div>
    </div>
  );
}
