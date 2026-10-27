import { useEffect, useState } from 'react';
import type { Contact, Salutation } from '@/types';
import { SALUTATIONS } from '@/types';
import { useData } from '@/store/data';
import { emptyContact, type ContactInput } from '@/store/factories';
import { toast } from '@/store/ui';
import { Button, Field, FormGrid, Input, Modal, Select } from '@/components/ui';

export function ContactDialog({ open, onClose, companyId, contact }: { open: boolean; onClose: () => void; companyId: string; contact?: Contact | null }) {
  const upsert = useData((s) => s.upsertContact);
  const [form, setForm] = useState<ContactInput>(emptyContact());
  useEffect(() => {
    if (open) setForm(contact ? { ...contact } : emptyContact());
  }, [open, contact]);
  const set = <K extends keyof ContactInput>(k: K, v: ContactInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = () => {
    if (!form.nachname.trim()) return toast.error('Bitte mindestens den Nachnamen erfassen.');
    upsert(companyId, { ...form, vorname: form.vorname.trim(), nachname: form.nachname.trim() });
    toast.success(contact ? 'Kontakt gespeichert' : 'Kontakt hinzugefügt');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={contact ? 'Kontakt bearbeiten' : 'Neuer Kontakt'}
      footer={
        <>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" onClick={save}>
            Speichern
          </Button>
        </>
      }
    >
      <FormGrid>
        <Field label="Anrede">
          <Select value={form.anrede} onChange={(e) => set('anrede', e.target.value as Salutation)}>
            <option value="">–</option>
            {SALUTATIONS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <Field label="Funktion">
          <Input value={form.funktion} onChange={(e) => set('funktion', e.target.value)} placeholder="z.B. Leiter HR" />
        </Field>
        <Field label="Vorname">
          <Input value={form.vorname} onChange={(e) => set('vorname', e.target.value)} />
        </Field>
        <Field label="Nachname" required>
          <Input value={form.nachname} onChange={(e) => set('nachname', e.target.value)} />
        </Field>
        <Field label="E-Mail">
          <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field label="Telefon">
          <Input value={form.telefon} onChange={(e) => set('telefon', e.target.value)} />
        </Field>
      </FormGrid>
    </Modal>
  );
}
