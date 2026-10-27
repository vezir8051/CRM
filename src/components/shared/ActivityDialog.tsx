import { useEffect, useMemo, useState } from 'react';
import type { Activity, ActivityType, EntityRef } from '@/types';
import { ACTIVITY_TYPES } from '@/types';
import { fullName } from '@/domain/format';
import { useData } from '@/store/data';
import { emptyActivity, type ActivityInput } from '@/store/factories';
import { useCurrentUser } from '@/store/session';
import { toast } from '@/store/ui';
import { Button, Checkbox, Field, FormGrid, Input, Modal, Select, Textarea } from '@/components/ui';

/** Neue Aktivität erfassen oder bestehende bearbeiten */
export function ActivityDialog({ open, onClose, activity, bezug, defaultTyp }: { open: boolean; onClose: () => void; activity?: Activity | null; bezug?: EntityRef | null; defaultTyp?: ActivityType }) {
  const user = useCurrentUser();
  const [form, setForm] = useState<ActivityInput>(() => emptyActivity(user?.id ?? ''));
  const addActivity = useData((s) => s.addActivity);
  const updateActivity = useData((s) => s.updateActivity);
  const candidates = useData((s) => s.candidates);
  const companies = useData((s) => s.companies);
  const jobs = useData((s) => s.jobs);
  const assignments = useData((s) => s.assignments);
  const users = useData((s) => s.users);

  useEffect(() => {
    if (!open) return;
    if (activity) {
      const { id: _id, createdAt: _c, ...rest } = activity;
      setForm(rest);
    } else {
      setForm({ ...emptyActivity(user?.id ?? ''), bezug: bezug ?? null, typ: defaultTyp ?? 'Aufgabe' });
    }
  }, [open, activity, bezug, defaultTyp, user?.id]);

  const bezugOptions = useMemo(
    () => [
      { group: 'Kandidaten', items: candidates.map((c) => ({ v: `candidate:${c.id}`, l: `${fullName(c)} (${c.nr})` })) },
      { group: 'Unternehmen', items: companies.map((c) => ({ v: `company:${c.id}`, l: c.name })) },
      { group: 'Vakanzen', items: jobs.map((j) => ({ v: `job:${j.id}`, l: `${j.titel} (${j.nr})` })) },
      { group: 'Einsätze', items: assignments.map((a) => ({ v: `assignment:${a.id}`, l: `${a.nr} · ${a.funktion}` })) },
    ],
    [candidates, companies, jobs, assignments],
  );

  const set = <K extends keyof ActivityInput>(k: K, v: ActivityInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = () => {
    if (!form.betreff.trim()) {
      toast.error('Bitte einen Betreff erfassen.');
      return;
    }
    const data = { ...form, betreff: form.betreff.trim(), beschreibung: form.beschreibung.trim() };
    if (activity) {
      updateActivity(activity.id, data);
      toast.success('Aktivität aktualisiert');
    } else {
      addActivity(data);
      toast.success('Aktivität erstellt');
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={activity ? 'Aktivität bearbeiten' : 'Neue Aktivität'}
      footer={
        <>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" onClick={save}>
            {activity ? 'Speichern' : 'Erstellen'}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <FormGrid>
          <Field label="Typ">
            <Select value={form.typ} onChange={(e) => set('typ', e.target.value as ActivityType)}>
              {ACTIVITY_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="Fällig am">
            <Input type="datetime-local" value={form.faelligAm} onChange={(e) => set('faelligAm', e.target.value)} />
          </Field>
          <Field label="Betreff" required wide>
            <Input value={form.betreff} onChange={(e) => set('betreff', e.target.value)} placeholder="z.B. Rückruf Kandidat" />
          </Field>
          <Field label="Beschreibung" wide>
            <Textarea value={form.beschreibung} onChange={(e) => set('beschreibung', e.target.value)} />
          </Field>
          <Field label="Bezug" wide>
            <Select
              value={form.bezug ? `${form.bezug.typ}:${form.bezug.id}` : ''}
              onChange={(e) => {
                const [typ, id] = e.target.value.split(':');
                set('bezug', e.target.value ? ({ typ, id } as EntityRef) : null);
              }}
            >
              <option value="">– Kein Bezug –</option>
              {bezugOptions.map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.items.map((i) => (
                    <option key={i.v} value={i.v}>
                      {i.l}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>
          <Field label="Zuständig">
            <Select value={form.userId} onChange={(e) => set('userId', e.target.value)}>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <div className="flex h-9 items-center">
              <Checkbox label="Erledigt" checked={form.erledigt} onChange={(v) => set('erledigt', v)} />
            </div>
          </Field>
        </FormGrid>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
