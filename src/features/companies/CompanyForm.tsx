/* ============================================================
   Unternehmen erfassen / bearbeiten.
   Mit `importData` aus einem Webseiten-Import vorbefüllt:
   fehlende Felder rot, unsichere gelb; gefundene Kontakte
   werden zur Übernahme angeboten.
   ============================================================ */
import { useEffect, useState } from 'react';
import { Sparkles, UserRound } from 'lucide-react';
import type { Company, CompanyDraft, CompanyStatus, ExtractionResult } from '@/types';
import { COMPANY_STATUS } from '@/types';
import { useData } from '@/store/data';
import { emptyCompany, type CompanyInput } from '@/store/factories';
import { useCurrentUser } from '@/store/session';
import { toast } from '@/store/ui';
import { uid } from '@/domain/ids';
import { Button, Callout, Checkbox, Field, FormGrid, FormSection, Input, Modal, NumberInput, Select, Textarea, type FieldState } from '@/components/ui';
import { SourceBadge } from '@/components/shared/AiStatus';

export function CompanyForm({ open, onClose, company, importData, onSaved }: { open: boolean; onClose: () => void; company?: Company | null; importData?: ExtractionResult<CompanyDraft> | null; onSaved?: (c: Company) => void }) {
  const user = useCurrentUser();
  const users = useData((s) => s.users);
  const companies = useData((s) => s.companies);
  const addCompany = useData((s) => s.addCompany);
  const updateCompany = useData((s) => s.updateCompany);
  const [form, setForm] = useState<CompanyInput>(() => emptyCompany(user?.id ?? ''));
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [takeContacts, setTakeContacts] = useState<boolean[]>([]);

  useEffect(() => {
    if (!open) return;
    setTouched(new Set());
    if (company) {
      const { id: _i, nr: _n, createdAt: _c, updatedAt: _u, ...rest } = company;
      setForm(rest);
      setTakeContacts([]);
    } else if (importData) {
      const { kontakte, ...d } = importData.data;
      setForm({ ...emptyCompany(user?.id ?? ''), ...d, status: 'Interessent' });
      setTakeContacts(kontakte.map(() => true));
    } else {
      setForm(emptyCompany(user?.id ?? ''));
      setTakeContacts([]);
    }
  }, [open, company, importData, user?.id]);

  const set = <K extends keyof CompanyInput>(k: K, v: CompanyInput[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setTouched((t) => new Set(t).add(k));
  };
  const state = (k: string): FieldState => {
    if (!importData || touched.has(k)) return undefined;
    if (importData.missing.includes(k)) return 'missing';
    if (importData.uncertain.includes(k)) return 'uncertain';
    return undefined;
  };
  const missingText = 'Nicht auf der Webseite gefunden – bitte ergänzen';
  const duplicate = !company && form.name.trim().length > 2 ? companies.find((c) => c.name.toLowerCase() === form.name.trim().toLowerCase()) : undefined;

  const save = () => {
    if (!form.name.trim()) {
      toast.error('Bitte den Firmennamen erfassen.');
      return;
    }
    const data = { ...form, name: form.name.trim() };
    if (company) {
      updateCompany(company.id, data);
      toast.success('Unternehmen gespeichert');
      onSaved?.({ ...company, ...data });
    } else {
      const kontakte = (importData?.data.kontakte ?? []).filter((_, i) => takeContacts[i]).map((k) => ({ ...k, id: uid() }));
      const c = addCompany({ ...data, kontakte });
      toast.success(`${c.name} erfasst${kontakte.length ? ` (inkl. ${kontakte.length} Kontakt${kontakte.length > 1 ? 'e' : ''})` : ''}`);
      onSaved?.(c);
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      persistent={!!importData}
      title={company ? 'Unternehmen bearbeiten' : importData ? 'Unternehmen aus Webseite' : 'Neues Unternehmen'}
      footer={
        <>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" onClick={save}>
            {company ? 'Speichern' : 'Erstellen'}
          </Button>
        </>
      }
    >
      {importData && (
        <Callout tone="info" icon={<Sparkles size={16} />} className="mb-4">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <strong>Webseite ausgewertet</strong> <SourceBadge source={importData.source} />
          </div>
          <span className="font-semibold text-red-700 dark:text-red-300">Rot</span> markierte Felder wurden auf der Webseite nicht gefunden,{' '}
          <span className="font-semibold text-amber-700 dark:text-amber-300">gelb</span> markierte sind unsicher.
          {importData.warning && <div className="mt-1 text-xs opacity-80">{importData.warning}</div>}
        </Callout>
      )}
      {duplicate && (
        <Callout tone="warn" className="mb-4">
          Ein Unternehmen «{duplicate.name}» ({duplicate.nr}) existiert bereits.
        </Callout>
      )}
      <FormGrid>
        <Field label="Firmenname" required wide state={state('name')} missingText={missingText}>
          <Input name="name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="z.B. Muster AG" />
        </Field>
        <Field label="Branche" state={state('branche')} missingText={missingText}>
          <Input name="branche" value={form.branche} onChange={(e) => set('branche', e.target.value)} placeholder="z.B. Informatik / Software" />
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={(e) => set('status', e.target.value as CompanyStatus)}>
            {COMPANY_STATUS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <FormSection title="Adresse & Kontakt" />
        <Field label="Strasse" wide state={state('strasse')} missingText={missingText}>
          <Input name="strasse" value={form.strasse} onChange={(e) => set('strasse', e.target.value)} />
        </Field>
        <Field label="PLZ" state={state('plz')} missingText={missingText}>
          <Input name="plz" value={form.plz} onChange={(e) => set('plz', e.target.value)} />
        </Field>
        <Field label="Ort" state={state('ort')} missingText={missingText}>
          <Input name="ort" value={form.ort} onChange={(e) => set('ort', e.target.value)} />
        </Field>
        <Field label="Telefon" state={state('telefon')} missingText={missingText}>
          <Input name="telefon" value={form.telefon} onChange={(e) => set('telefon', e.target.value)} placeholder="+41 44 …" />
        </Field>
        <Field label="E-Mail" state={state('email')} missingText={missingText}>
          <Input name="email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field label="Website" wide state={state('website')} missingText={missingText}>
          <Input name="website" value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="www.beispiel.ch" />
        </Field>
        <FormSection title="Konditionen" />
        <Field label="Honorarsatz (%)" hint="Prozent des Jahreslohns bei Festanstellung">
          <NumberInput min={0} max={50} step={0.5} value={form.honorarSatz} onChange={(v) => set('honorarSatz', v)} />
        </Field>
        <Field label="Zahlungsfrist (Tage)">
          <NumberInput min={0} max={120} value={form.zahlungsfrist} onChange={(v) => set('zahlungsfrist', v ?? 30)} />
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
        <Field label="Notizen" wide>
          <Textarea value={form.notizen} onChange={(e) => set('notizen', e.target.value)} />
        </Field>
        {!company && importData && importData.data.kontakte.length > 0 && (
          <>
            <FormSection title="Gefundene Kontaktpersonen" />
            <div className="space-y-2 sm:col-span-2">
              {importData.data.kontakte.map((k, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2">
                  <Checkbox
                    label=""
                    checked={!!takeContacts[i]}
                    onChange={(v) => setTakeContacts((t) => t.map((x, idx) => (idx === i ? v : x)))}
                  />
                  <UserRound size={16} className="text-muted" />
                  <div className="min-w-0 text-[13px]">
                    <div className="font-semibold">
                      {[k.anrede, k.vorname, k.nachname].filter(Boolean).join(' ')}
                      {k.funktion && <span className="font-normal text-muted"> · {k.funktion}</span>}
                    </div>
                    <div className="text-xs text-muted">{[k.email, k.telefon].filter(Boolean).join(' · ') || 'Keine Kontaktdaten'}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </FormGrid>
    </Modal>
  );
}
