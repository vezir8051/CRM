import { useEffect, useMemo, useState } from 'react';
import { Calculator } from 'lucide-react';
import type { EmploymentType, Job, JobStatus, Priority } from '@/types';
import { EMPLOYMENT_TYPES, JOB_STATUS, PRIORITIES } from '@/types';
import { SKILL_VOCABULARY } from '@/domain/cv-heuristics';
import { calcTariff } from '@/domain/tarif';
import { fmtCHF } from '@/domain/format';
import { useData } from '@/store/data';
import { emptyJob, type JobInput } from '@/store/factories';
import { useCurrentUser } from '@/store/session';
import { toast } from '@/store/ui';
import { Button, Field, FormGrid, FormSection, Input, Modal, NumberInput, Select, TagInput, Textarea } from '@/components/ui';

export function JobForm({ open, onClose, job, companyId, onSaved }: { open: boolean; onClose: () => void; job?: Job | null; companyId?: string; onSaved?: (j: Job) => void }) {
  const user = useCurrentUser();
  const users = useData((s) => s.users);
  const companies = useData((s) => s.companies);
  const settings = useData((s) => s.settings);
  const addJob = useData((s) => s.addJob);
  const updateJob = useData((s) => s.updateJob);
  const [form, setForm] = useState<JobInput>(() => emptyJob(user?.id ?? ''));
  const [lohnBasis, setLohnBasis] = useState<number | null>(32);

  useEffect(() => {
    if (!open) return;
    if (job) {
      const { id: _i, nr: _n, createdAt: _c, updatedAt: _u, ...rest } = job;
      setForm(rest);
    } else {
      const f = companies.find((c) => c.id === companyId);
      setForm({ ...emptyJob(user?.id ?? '', companyId ?? ''), ort: f?.ort ?? '' });
    }
  }, [open, job, companyId, companies, user?.id]);

  const set = <K extends keyof JobInput>(k: K, v: JobInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const company = companies.find((c) => c.id === form.companyId);
  const vorschlag = useMemo(() => (lohnBasis ? calcTariff(lohnBasis, settings.tarif) : null), [lohnBasis, settings.tarif]);

  const save = () => {
    if (!form.titel.trim()) return toast.error('Bitte einen Stellentitel erfassen.');
    if (!form.companyId) return toast.error('Bitte ein Unternehmen wählen.');
    const data = { ...form, titel: form.titel.trim(), kontaktId: company?.kontakte.some((k) => k.id === form.kontaktId) ? form.kontaktId : '' };
    if (job) {
      updateJob(job.id, data);
      toast.success('Vakanz gespeichert');
      onSaved?.({ ...job, ...data });
    } else {
      const j = addJob(data);
      toast.success(`Vakanz ${j.nr} erfasst`);
      onSaved?.(j);
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={job ? 'Vakanz bearbeiten' : 'Neue Vakanz'}
      footer={
        <>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" onClick={save}>
            {job ? 'Speichern' : 'Erstellen'}
          </Button>
        </>
      }
    >
      <FormGrid>
        <Field label="Stellentitel" required wide>
          <Input name="titel" value={form.titel} onChange={(e) => set('titel', e.target.value)} placeholder="z.B. Elektroinstallateur EFZ" />
        </Field>
        <Field label="Unternehmen" required>
          <Select value={form.companyId} onChange={(e) => setForm((f) => ({ ...f, companyId: e.target.value, kontaktId: '', ort: f.ort || companies.find((c) => c.id === e.target.value)?.ort || '' }))}>
            <option value="">– wählen –</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Kontaktperson">
          <Select value={form.kontaktId} onChange={(e) => set('kontaktId', e.target.value)} disabled={!company?.kontakte.length}>
            <option value="">– keine –</option>
            {company?.kontakte.map((k) => (
              <option key={k.id} value={k.id}>
                {k.vorname} {k.nachname} {k.funktion && `(${k.funktion})`}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Arbeitsort">
          <Input value={form.ort} onChange={(e) => set('ort', e.target.value)} />
        </Field>
        <Field label="Pensum">
          <Input value={form.pensum} onChange={(e) => set('pensum', e.target.value)} placeholder="100%" />
        </Field>
        <Field label="Anstellungsart">
          <Select value={form.art} onChange={(e) => set('art', e.target.value as EmploymentType)}>
            {EMPLOYMENT_TYPES.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </Select>
        </Field>
        <Field label="Anzahl Stellen">
          <NumberInput min={1} max={50} value={form.anzahl} onChange={(v) => set('anzahl', Math.max(1, v ?? 1))} />
        </Field>

        <FormSection title="Konditionen" />
        {form.art === 'Temporär' ? (
          <>
            <Field label="Verrechnungssatz an Kunde (CHF/h)" hint={vorschlag ? `Vorschlag bei Grundlohn CHF ${lohnBasis}/h und ${settings.tarif.zielmarge} % Marge: ${fmtCHF(vorschlag.verrechnungssatz, { decimals: true })}` : undefined}>
              <NumberInput min={0} step={0.5} value={form.tarif} onChange={(v) => set('tarif', v)} />
            </Field>
            <Field label="Grundlohn für Tarifvorschlag (CHF/h)">
              <div className="flex gap-2">
                <NumberInput min={0} step={0.5} value={lohnBasis} onChange={setLohnBasis} />
                <Button icon={<Calculator size={15} />} disabled={!vorschlag} onClick={() => vorschlag && set('tarif', vorschlag.verrechnungssatz)}>
                  Übernehmen
                </Button>
              </div>
            </Field>
          </>
        ) : (
          <>
            <Field label="Lohn von (CHF/Jahr)">
              <NumberInput min={0} step={1000} value={form.lohnMin} onChange={(v) => set('lohnMin', v)} />
            </Field>
            <Field label="Lohn bis (CHF/Jahr)">
              <NumberInput min={0} step={1000} value={form.lohnMax} onChange={(v) => set('lohnMax', v)} />
            </Field>
          </>
        )}
        <Field label="Anforderungen / Skills" wide hint="Werden für das automatische Matching verwendet">
          <TagInput value={form.skills} onChange={(v) => set('skills', v)} suggestions={[...SKILL_VOCABULARY]} placeholder="z.B. Photovoltaik" />
        </Field>
        <Field label="Beschreibung" wide>
          <Textarea rows={4} value={form.beschreibung} onChange={(e) => set('beschreibung', e.target.value)} placeholder="Aufgaben, Umfeld, Besonderheiten…" />
        </Field>

        <FormSection title="Steuerung" />
        <Field label="Status">
          <Select value={form.status} onChange={(e) => set('status', e.target.value as JobStatus)}>
            {JOB_STATUS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <Field label="Priorität">
          <Select value={form.prioritaet} onChange={(e) => set('prioritaet', e.target.value as Priority)}>
            {PRIORITIES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
        </Field>
        <Field label="Stellenantritt / Deadline">
          <Input type="date" value={form.deadline} onChange={(e) => set('deadline', e.target.value)} />
        </Field>
        <Field label="Betreuer/in">
          <Select value={form.betreuerId} onChange={(e) => set('betreuerId', e.target.value)}>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </Field>
      </FormGrid>
    </Modal>
  );
}
