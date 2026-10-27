/* ============================================================
   Kandidat erfassen / bearbeiten.
   Mit `importResult` wird das Formular aus einem Lebenslauf
   vorbefüllt; fehlende Felder rot, unsichere gelb markiert –
   die Markierung verschwindet, sobald das Feld bearbeitet wird.
   ============================================================ */
import { useEffect, useMemo, useState } from 'react';
import { Plus, Sparkles, Trash2, TriangleAlert } from 'lucide-react';
import type { Candidate, CandidateSource, CandidateStatus, EmploymentType, Language, Permit, Salutation } from '@/types';
import { CANDIDATE_SOURCES, CANDIDATE_STATUS, EMPLOYMENT_TYPES, PERMITS, SALUTATIONS } from '@/types';
import { COMMON_LANGUAGES, LANGUAGE_LEVELS, PERMIT_LABELS } from '@/domain/constants';
import { fullName, todayISO } from '@/domain/format';
import { SKILL_VOCABULARY } from '@/domain/cv-heuristics';
import type { CvImportResult } from '@/lib/ai';
import { useData } from '@/store/data';
import { emptyCandidate, type CandidateInput } from '@/store/factories';
import { useCurrentUser } from '@/store/session';
import { toast } from '@/store/ui';
import { Button, Callout, ChipSelect, Field, FormGrid, FormSection, IconButton, Input, Modal, NumberInput, Select, TagInput, Textarea, type FieldState } from '@/components/ui';
import { SourceBadge } from '@/components/shared/AiStatus';

export interface CandidateImport {
  result: CvImportResult;
  fileName?: string;
  fileSize?: number;
}

export function CandidateForm({ open, onClose, candidate, importData, onSaved }: { open: boolean; onClose: () => void; candidate?: Candidate | null; importData?: CandidateImport | null; onSaved?: (c: Candidate) => void }) {
  const user = useCurrentUser();
  const users = useData((s) => s.users);
  const candidates = useData((s) => s.candidates);
  const addCandidate = useData((s) => s.addCandidate);
  const updateCandidate = useData((s) => s.updateCandidate);
  const addDocument = useData((s) => s.addDocument);

  const [form, setForm] = useState<CandidateInput>(() => emptyCandidate(user?.id ?? ''));
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [dupConfirmed, setDupConfirmed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTouched(new Set());
    setDupConfirmed(false);
    if (candidate) {
      const { id: _i, nr: _n, createdAt: _c, updatedAt: _u, ...rest } = candidate;
      setForm(rest);
    } else {
      const base = emptyCandidate(user?.id ?? '');
      const d = importData?.result.data;
      setForm(
        d
          ? {
              ...base,
              ...d,
              anstellungsarten: d.anstellungsarten.length ? d.anstellungsarten : base.anstellungsarten,
              pensum: d.pensum || base.pensum,
              status: 'In Prüfung',
              quelle: 'Sonstige',
            }
          : base,
      );
    }
  }, [open, candidate, importData, user?.id]);

  const set = <K extends keyof CandidateInput>(k: K, v: CandidateInput[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setTouched((t) => (t.has(k) ? t : new Set(t).add(k)));
  };

  /** Markierung aus dem Import (nur bis das Feld bearbeitet wurde) */
  const state = (k: string): FieldState => {
    if (!importData || touched.has(k)) return undefined;
    if (importData.result.missing.includes(k)) return 'missing';
    if (importData.result.uncertain.includes(k)) return 'uncertain';
    return undefined;
  };
  const missingText = 'Nicht im Lebenslauf gefunden – bitte ergänzen';

  const duplicate = useMemo(() => {
    if (candidate) return null;
    const mail = form.email.trim().toLowerCase();
    const name = `${form.vorname} ${form.nachname}`.trim().toLowerCase();
    return candidates.find((c) => (mail && c.email.toLowerCase() === mail) || (name.length > 3 && fullName(c).toLowerCase() === name)) ?? null;
  }, [candidates, form.email, form.vorname, form.nachname, candidate]);

  const offeneFelder = importData ? importData.result.missing.filter((k) => !touched.has(k)).length : 0;

  const save = () => {
    if (!form.vorname.trim() || !form.nachname.trim()) {
      toast.error('Vor- und Nachname sind Pflichtfelder.');
      return;
    }
    if (duplicate && !dupConfirmed) {
      setDupConfirmed(true);
      toast.info('Mögliches Duplikat – erneut speichern, um trotzdem anzulegen.');
      return;
    }
    const data: CandidateInput = {
      ...form,
      vorname: form.vorname.trim(),
      nachname: form.nachname.trim(),
      email: form.email.trim(),
      sprachen: form.sprachen.filter((s) => s.sprache.trim()),
    };
    if (candidate) {
      updateCandidate(candidate.id, data);
      toast.success('Kandidat gespeichert');
      onSaved?.({ ...candidate, ...data });
    } else {
      const c = addCandidate(data);
      if (importData?.fileName) {
        addDocument(c.id, { name: importData.fileName, typ: 'Lebenslauf', datum: todayISO(), groesse: importData.fileSize, text: importData.result.text });
      } else if (importData?.result.text) {
        addDocument(c.id, { name: 'Lebenslauf (eingefügter Text).txt', typ: 'Lebenslauf', datum: todayISO(), text: importData.result.text });
      }
      toast.success(`${fullName(c)} erfasst`);
      onSaved?.(c);
    }
    onClose();
  };

  const setLang = (i: number, patch: Partial<Language>) => set('sprachen', form.sprachen.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      persistent={!!importData}
      title={candidate ? 'Kandidat bearbeiten' : importData ? 'Kandidat aus Lebenslauf' : 'Neuer Kandidat'}
      subtitle={candidate ? `${candidate.nr} · ${fullName(candidate)}` : undefined}
      footer={
        <>
          {offeneFelder > 0 && <span className="mr-auto text-xs font-medium text-red-600 dark:text-red-400">{offeneFelder} Feld{offeneFelder > 1 ? 'er' : ''} nicht erkannt</span>}
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" onClick={save}>
            {candidate ? 'Speichern' : duplicate && dupConfirmed ? 'Trotzdem erstellen' : 'Erstellen'}
          </Button>
        </>
      }
    >
      {importData && (
        <Callout tone="info" icon={<Sparkles size={16} />} className="mb-4">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <strong>Lebenslauf ausgewertet</strong> <SourceBadge source={importData.result.source} />
          </div>
          <span className="font-semibold text-red-700 dark:text-red-300">Rot</span> markierte Felder wurden nicht im Lebenslauf gefunden,{' '}
          <span className="font-semibold text-amber-700 dark:text-amber-300">gelb</span> markierte sind unsicher – bitte prüfen. Der Lebenslauf wird als Dokument abgelegt.
          {importData.result.warning && <div className="mt-1 text-xs opacity-80">{importData.result.warning}</div>}
        </Callout>
      )}
      {duplicate && (
        <Callout tone="warn" icon={<TriangleAlert size={16} />} className="mb-4">
          <strong>Mögliches Duplikat:</strong> {fullName(duplicate)} ({duplicate.nr}, {duplicate.email || 'ohne E-Mail'}) ist bereits erfasst.
        </Callout>
      )}

      <FormGrid>
        <FormSection title="Person" />
        <Field label="Anrede" state={state('anrede')} missingText={missingText}>
          <Select value={form.anrede} onChange={(e) => set('anrede', e.target.value as Salutation)}>
            <option value="">–</option>
            {SALUTATIONS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <Field label="Geburtsdatum" state={state('geburtsdatum')} missingText={missingText}>
          <Input type="date" value={form.geburtsdatum} onChange={(e) => set('geburtsdatum', e.target.value)} />
        </Field>
        <Field label="Vorname" required state={state('vorname')} missingText={missingText}>
          <Input name="vorname" value={form.vorname} onChange={(e) => set('vorname', e.target.value)} />
        </Field>
        <Field label="Nachname" required state={state('nachname')} missingText={missingText}>
          <Input name="nachname" value={form.nachname} onChange={(e) => set('nachname', e.target.value)} />
        </Field>
        <Field label="E-Mail" state={state('email')} missingText={missingText}>
          <Input name="email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field label="Telefon" state={state('telefon')} missingText={missingText}>
          <Input name="telefon" value={form.telefon} onChange={(e) => set('telefon', e.target.value)} placeholder="+41 79 …" />
        </Field>
        <Field label="Nationalität" state={state('nationalitaet')}>
          <Input value={form.nationalitaet} onChange={(e) => set('nationalitaet', e.target.value)} />
        </Field>
        <Field label="Bewilligung" state={state('bewilligung')}>
          <Select value={form.bewilligung} onChange={(e) => set('bewilligung', e.target.value as Permit)}>
            <option value="">– unbekannt –</option>
            {PERMITS.map((p) => (
              <option key={p} value={p}>
                {PERMIT_LABELS[p]}
              </option>
            ))}
          </Select>
        </Field>

        <FormSection title="Adresse" />
        <Field label="Strasse" wide state={state('strasse')} missingText={missingText}>
          <Input name="strasse" value={form.strasse} onChange={(e) => set('strasse', e.target.value)} />
        </Field>
        <Field label="PLZ" state={state('plz')} missingText={missingText}>
          <Input name="plz" value={form.plz} onChange={(e) => set('plz', e.target.value)} />
        </Field>
        <Field label="Ort" state={state('ort')} missingText={missingText}>
          <Input name="ort" value={form.ort} onChange={(e) => set('ort', e.target.value)} />
        </Field>

        <FormSection title="Beruf & Qualifikation" />
        <Field label="Beruf" state={state('beruf')} missingText={missingText}>
          <Input name="beruf" value={form.beruf} onChange={(e) => set('beruf', e.target.value)} />
        </Field>
        <Field label="Ausbildung" state={state('ausbildung')} missingText={missingText}>
          <Input name="ausbildung" value={form.ausbildung} onChange={(e) => set('ausbildung', e.target.value)} />
        </Field>
        <Field label="Berufserfahrung (Jahre)" state={state('erfahrungJahre')} missingText={missingText}>
          <NumberInput name="erfahrungJahre" min={0} max={60} value={form.erfahrungJahre} onChange={(v) => set('erfahrungJahre', v)} />
        </Field>
        <Field label="Pensum" state={state('pensum')} missingText={missingText}>
          <Input name="pensum" value={form.pensum} onChange={(e) => set('pensum', e.target.value)} placeholder="z.B. 80-100%" />
        </Field>
        <Field label="Skills / Qualifikationen" wide state={state('skills')} missingText={missingText} hint="Enter oder Komma fügt hinzu">
          <TagInput value={form.skills} onChange={(v) => set('skills', v)} placeholder="z.B. SAP, Staplerausweis" suggestions={[...SKILL_VOCABULARY]} />
        </Field>
        <Field label="Sprachen" wide state={state('sprachen')} missingText={missingText}>
          <div className="space-y-2">
            {form.sprachen.map((s, i) => (
              <div key={i} className="flex gap-2">
                <Input list="sprachen-liste" value={s.sprache} onChange={(e) => setLang(i, { sprache: e.target.value })} placeholder="Sprache" />
                <Select className="max-w-[170px]" value={s.niveau} onChange={(e) => setLang(i, { niveau: e.target.value })}>
                  <option value="">Niveau –</option>
                  {LANGUAGE_LEVELS.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </Select>
                <IconButton label="Sprache entfernen" tone="danger" onClick={() => set('sprachen', form.sprachen.filter((_, idx) => idx !== i))}>
                  <Trash2 size={15} />
                </IconButton>
              </div>
            ))}
            <Button size="sm" variant="ghost" icon={<Plus size={14} />} onClick={() => set('sprachen', [...form.sprachen, { sprache: '', niveau: '' }])}>
              Sprache hinzufügen
            </Button>
            <datalist id="sprachen-liste">
              {COMMON_LANGUAGES.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </div>
        </Field>

        <FormSection title="Verfügbarkeit & Konditionen" />
        <Field label="Verfügbar ab" state={state('verfuegbarAb')} missingText={missingText}>
          <Input name="verfuegbarAb" type="date" value={form.verfuegbarAb} onChange={(e) => set('verfuegbarAb', e.target.value)} />
        </Field>
        <Field label="Anstellungsart">
          <ChipSelect<EmploymentType> options={EMPLOYMENT_TYPES} value={form.anstellungsarten} onChange={(v) => set('anstellungsarten', v)} />
        </Field>
        <Field label="Lohnvorstellung (CHF/Jahr)" state={state('lohnvorstellung')}>
          <NumberInput min={0} step={1000} value={form.lohnvorstellung} onChange={(v) => set('lohnvorstellung', v)} />
        </Field>
        <Field label="Stundenlohn temporär (CHF/h)" state={state('stundenlohn')}>
          <NumberInput min={0} step={0.5} value={form.stundenlohn} onChange={(v) => set('stundenlohn', v)} />
        </Field>

        <FormSection title="Verwaltung" />
        <Field label="Status">
          <Select value={form.status} onChange={(e) => set('status', e.target.value as CandidateStatus)}>
            {CANDIDATE_STATUS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <Field label="Quelle">
          <Select value={form.quelle} onChange={(e) => set('quelle', e.target.value as CandidateSource)}>
            {CANDIDATE_SOURCES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
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
        <Field label="Tags" hint="z.B. Top-Profil, Diskret">
          <TagInput value={form.tags} onChange={(v) => set('tags', v)} />
        </Field>
        <Field label="Notizen" wide>
          <Textarea value={form.notizen} onChange={(e) => set('notizen', e.target.value)} placeholder="Interne Bemerkungen…" />
        </Field>
      </FormGrid>
    </Modal>
  );
}
