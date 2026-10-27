import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Building, Calculator, CircleCheck, Database, Download, KeyRound, Pencil, RotateCcw, Save, Trash2, TriangleAlert, Upload, UserPlus, Users, Zap } from 'lucide-react';
import type { Role, Settings, TariffRates, User } from '@/types';
import { ROLES } from '@/types';
import { calcTariff, DEFAULT_TARIFF_RATES, marginTone } from '@/domain/tarif';
import { ROLE_LABELS } from '@/domain/constants';
import { formatIban, isQrIban, isValidIban } from '@/domain/qrbill';
import { fmtCHF, fmtDateTime, fmtPercent, todayISO } from '@/domain/format';
import { sha256 } from '@/domain/ids';
import { useData, STORAGE_KEY } from '@/store/data';
import { useCurrentUser, useIsAdmin } from '@/store/session';
import { confirmDialog, toast } from '@/store/ui';
import { AI_MODELS, fetchAiStatus, getAiConfig, setAiConfig, testAiConnection, useAiAvailability } from '@/lib/ai';
import { downloadFile } from '@/lib/download';
import { useTabParam } from '@/lib/hooks';
import { Badge, Button, Callout, Card, CardBody, CardHeader, Checkbox, DataTable, Field, FormGrid, IconButton, Input, Modal, NumberInput, PageHeader, Select, Tabs } from '@/components/ui';

const TABS = ['firma', 'tarif', 'automatisierung', 'ki', 'benutzer', 'daten'] as const;
type Tab = (typeof TABS)[number];

export default function SettingsPage() {
  const isAdmin = useIsAdmin();
  const [tab, setTab] = useTabParam<Tab>('firma', TABS);

  return (
    <>
      <PageHeader title="Einstellungen" subtitle={isAdmin ? undefined : 'Einige Bereiche können nur von Administratoren geändert werden.'} />
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        items={[
          { value: 'firma', label: 'Agentur', icon: <Building size={14} /> },
          { value: 'tarif', label: 'Tarife & Rechner', icon: <Calculator size={14} /> },
          { value: 'automatisierung', label: 'Automatisierung', icon: <Zap size={14} /> },
          { value: 'ki', label: 'KI', icon: <Bot size={14} /> },
          { value: 'benutzer', label: 'Benutzer', icon: <Users size={14} /> },
          { value: 'daten', label: 'Daten', icon: <Database size={14} /> },
        ]}
      />
      {tab === 'firma' && <CompanyTab readOnly={!isAdmin} />}
      {tab === 'tarif' && <TariffTab readOnly={!isAdmin} />}
      {tab === 'automatisierung' && <AutomationTab readOnly={!isAdmin} />}
      {tab === 'ki' && <AiTab />}
      {tab === 'benutzer' && <UsersTab readOnly={!isAdmin} />}
      {tab === 'daten' && <DataTab readOnly={!isAdmin} />}
    </>
  );
}

/** Lokaler Entwurf der Einstellungen mit Speichern-Knopf */
function useSettingsDraft() {
  const settings = useData((s) => s.settings);
  const updateSettings = useData((s) => s.updateSettings);
  const [draft, setDraft] = useState<Settings>(settings);
  useEffect(() => setDraft(settings), [settings]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);
  const save = () => {
    updateSettings(draft);
    toast.success('Einstellungen gespeichert');
  };
  return { draft, setDraft, dirty, save };
}

function SaveBar({ dirty, onSave, readOnly }: { dirty: boolean; onSave: () => void; readOnly: boolean }) {
  if (readOnly) return null;
  return (
    <div className="flex justify-end border-t border-line px-5 py-3">
      <Button variant="primary" icon={<Save size={15} />} disabled={!dirty} onClick={onSave}>
        Speichern
      </Button>
    </div>
  );
}

/* ---------- Agentur ---------- */
function CompanyTab({ readOnly }: { readOnly: boolean }) {
  const { draft, setDraft, dirty, save } = useSettingsDraft();
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const ibanError = draft.iban && !isValidIban(draft.iban) ? 'Prüfsumme ungültig' : draft.iban && isQrIban(draft.iban) ? 'QR-IBAN: für QR-Rechnungen ohne Referenz eine normale IBAN verwenden' : undefined;

  return (
    <Card>
      <CardHeader title="Agentur" subtitle="Erscheint auf Rechnungen, Einsatzverträgen, Inseraten und E-Mails" />
      <CardBody>
        <fieldset disabled={readOnly}>
          <FormGrid>
            <Field label="Firmenname" required>
              <Input value={draft.firmenname} onChange={(e) => set('firmenname', e.target.value)} />
            </Field>
            <Field label="Strasse & Nr.">
              <Input value={draft.strasse} onChange={(e) => set('strasse', e.target.value)} />
            </Field>
            <Field label="PLZ">
              <Input value={draft.plz} onChange={(e) => set('plz', e.target.value)} />
            </Field>
            <Field label="Ort">
              <Input value={draft.ort} onChange={(e) => set('ort', e.target.value)} />
            </Field>
            <Field label="Telefon">
              <Input value={draft.telefon} onChange={(e) => set('telefon', e.target.value)} />
            </Field>
            <Field label="E-Mail">
              <Input type="email" value={draft.email} onChange={(e) => set('email', e.target.value)} />
            </Field>
            <Field label="Website">
              <Input value={draft.website} onChange={(e) => set('website', e.target.value)} />
            </Field>
            <Field label="UID / MWST-Nummer">
              <Input value={draft.uid} onChange={(e) => set('uid', e.target.value)} placeholder="CHE-123.456.789 MWST" />
            </Field>
            <Field label="IBAN (für QR-Rechnungen)" error={ibanError} hint={!ibanError && draft.iban ? `✓ ${formatIban(draft.iban)}` : undefined}>
              <Input value={draft.iban} onChange={(e) => set('iban', e.target.value)} placeholder="CH93 0076 2011 6238 5295 7" />
            </Field>
            <Field label="MWST-Satz (%)">
              <NumberInput min={0} max={30} step={0.1} value={draft.mwstSatz} onChange={(v) => set('mwstSatz', v ?? 0)} />
            </Field>
          </FormGrid>
        </fieldset>
      </CardBody>
      <SaveBar dirty={dirty} onSave={save} readOnly={readOnly} />
    </Card>
  );
}

/* ---------- Tarife & Rechner ---------- */
const RATE_FIELDS: { key: keyof TariffRates; label: string; hint?: string }[] = [
  { key: 'ferien', label: 'Ferienentschädigung', hint: '8.33 % = 4 Wochen, 10.64 % = 5 Wochen' },
  { key: 'feiertage', label: 'Feiertagsentschädigung' },
  { key: 'dreizehnter', label: '13. Monatslohn' },
  { key: 'ahv', label: 'AHV/IV/EO (Arbeitgeber)' },
  { key: 'alv', label: 'ALV (Arbeitgeber)' },
  { key: 'fak', label: 'Familienausgleichskasse' },
  { key: 'uvg', label: 'UVG Berufsunfall', hint: 'Branchenabhängig' },
  { key: 'ktg', label: 'Krankentaggeld (Arbeitgeber)' },
  { key: 'bvg', label: 'BVG Pensionskasse (Arbeitgeber)' },
  { key: 'gav', label: 'GAV Personalverleih' },
  { key: 'verwaltung', label: 'Verwaltungskosten' },
  { key: 'zielmarge', label: 'Zielmarge (vom Verrechnungssatz)' },
];

function TariffTab({ readOnly }: { readOnly: boolean }) {
  const { draft, setDraft, dirty, save } = useSettingsDraft();
  const [lohn, setLohn] = useState<number | null>(32);
  const [marge, setMarge] = useState<number | null>(null);
  const result = useMemo(() => calcTariff(lohn ?? 0, draft.tarif, marge ?? draft.tarif.zielmarge), [lohn, marge, draft.tarif]);
  const setRate = (k: keyof TariffRates, v: number | null) => setDraft((d) => ({ ...d, tarif: { ...d.tarif, [k]: v ?? 0 } }));

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card>
        <CardHeader
          title="Zuschläge & Sozialabgaben"
          subtitle="Richtwerte in Prozent – bitte mit Ihren Versicherern abgleichen"
          actions={
            !readOnly && (
              <Button size="sm" variant="ghost" icon={<RotateCcw size={14} />} onClick={() => setDraft((d) => ({ ...d, tarif: DEFAULT_TARIFF_RATES }))}>
                Standardwerte
              </Button>
            )
          }
        />
        <CardBody>
          <fieldset disabled={readOnly}>
            <FormGrid>
              {RATE_FIELDS.map((f) => (
                <Field key={f.key} label={`${f.label} (%)`} hint={f.hint}>
                  <NumberInput min={0} max={95} step={0.01} value={draft.tarif[f.key]} onChange={(v) => setRate(f.key, v)} />
                </Field>
              ))}
            </FormGrid>
          </fieldset>
        </CardBody>
        <SaveBar dirty={dirty} onSave={save} readOnly={readOnly} />
      </Card>

      <Card>
        <CardHeader title="Tarifrechner" subtitle="Vom Grundlohn zum Verrechnungssatz" icon={<Calculator size={17} className="text-brand" />} />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Grundlohn (CHF/h)">
              <NumberInput min={0} step={0.5} value={lohn} onChange={setLohn} />
            </Field>
            <Field label="Zielmarge (%)">
              <NumberInput min={0} max={60} step={0.5} value={marge ?? draft.tarif.zielmarge} onChange={setMarge} />
            </Field>
          </div>
          <table className="w-full text-[13px]">
            <tbody>
              {result.zeilen.map((z) => (
                <tr key={z.key} className="border-b border-line">
                  <td className="py-1.5">{z.label}</td>
                  <td className="py-1.5 text-right text-muted">{z.satz !== null ? fmtPercent(z.satz, 2) : ''}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmtCHF(z.betrag, { decimals: true })}</td>
                </tr>
              ))}
              <tr className="border-b border-line font-semibold">
                <td className="py-2">Lohnkosten pro Stunde</td>
                <td />
                <td className="py-2 text-right tabular-nums">{fmtCHF(result.lohnkosten, { decimals: true })}</td>
              </tr>
              <tr className="text-base font-bold">
                <td className="py-2.5">Verrechnungssatz</td>
                <td className="py-2.5 text-right">
                  <Badge tone={marginTone(result.margeProzent)}>{fmtPercent(result.margeProzent)}</Badge>
                </td>
                <td className="py-2.5 text-right tabular-nums text-brand">{fmtCHF(result.verrechnungssatz, { decimals: true })}</td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-muted">
            Deckungsbeitrag {fmtCHF(result.deckungsbeitrag, { decimals: true })}/h · bei 42 h/Woche {fmtCHF(result.deckungsbeitrag * 42)} pro Woche. Gerundet auf 5 Rappen.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

/* ---------- Automatisierung ---------- */
function AutomationTab({ readOnly }: { readOnly: boolean }) {
  const { draft, setDraft, dirty, save } = useSettingsDraft();
  return (
    <Card>
      <CardHeader title="Automatisierung" subtitle="Was das System selbständig für Sie erledigt" />
      <CardBody className="space-y-5">
        <fieldset disabled={readOnly} className="space-y-4">
          <Checkbox label={<span><b>Automatische Nachfass-Aufgaben</b> bei Phasenwechseln in der Pipeline (Vorgeschlagen, Interview, Angebot)</span>} checked={draft.autoFollowup} onChange={(v) => setDraft((d) => ({ ...d, autoFollowup: v }))} />
          <Field label="Nachfassen nach (Tagen)" className="max-w-xs">
            <NumberInput min={1} max={30} value={draft.followupTage} disabled={!draft.autoFollowup} onChange={(v) => setDraft((d) => ({ ...d, followupTage: Math.max(1, v ?? 3) }))} />
          </Field>
        </fieldset>
        <Callout tone="info">
          Immer aktiv: Kandidatenstatus «Im Einsatz» folgt den Einsätzen, Vakanzen werden bei Besetzung automatisch auf «Besetzt» gesetzt, Rapporte werden nach Kunde und Monat zur Verrechnung gruppiert, und das Dashboard zeigt Empfehlungen (fehlende Rapporte, überfällige Rechnungen, endende Einsätze, passende Kandidaten).
        </Callout>
      </CardBody>
      <SaveBar dirty={dirty} onSave={save} readOnly={readOnly} />
    </Card>
  );
}

/* ---------- KI ---------- */
function AiTab() {
  const { status, via, available, loading } = useAiAvailability();
  const [cfg, setCfg] = useState(getAiConfig);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = JSON.stringify(cfg) !== JSON.stringify(getAiConfig());

  const save = () => {
    setAiConfig({ ...cfg, apiKey: cfg.apiKey.trim(), appToken: cfg.appToken.trim() });
    void fetchAiStatus(true);
    setResult(null);
    toast.success('KI-Einstellungen gespeichert (nur in diesem Browser)');
  };

  const test = async () => {
    if (dirty) save();
    setTesting(true);
    const r = await testAiConnection();
    setResult(r.ok ? { ok: true, text: `Verbindung erfolgreich – Modell ${r.model}` } : { ok: false, text: r.error });
    setTesting(false);
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[3fr_2fr]">
      <Card>
        <CardHeader title="KI-Verbindung (Claude)" subtitle="Für Lebenslauf-Import, Webseiten-Import, Texte, Matching-Begründungen und die Kandidatensuche in Alltagssprache" />
        <CardBody className="space-y-4">
          {!loading && (
            <Callout tone={available ? 'success' : 'warn'}>
              {available
                ? via === 'server'
                  ? 'KI ist aktiv über den Server-Schlüssel.'
                  : 'KI ist aktiv über Ihren eigenen Schlüssel.'
                : !status.reachable
                  ? 'Die KI-Funktion des Servers ist nicht erreichbar (lokale Entwicklung ohne API?). Es wird die lokale Erkennung verwendet.'
                  : status.tokenRequired && status.serverKey
                    ? 'Der Server verlangt ein Zugangstoken – bitte unten eintragen.'
                    : 'Kein Schlüssel konfiguriert – es wird die lokale Erkennung verwendet.'}
            </Callout>
          )}
          <FormGrid>
            <Field label="Modell" wide>
              <Select value={cfg.model} onChange={(e) => setCfg((c) => ({ ...c, model: e.target.value }))}>
                {AI_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Eigener Anthropic-API-Schlüssel" hint={status.serverKey ? 'Optional – der Server hat bereits einen Schlüssel' : 'Wird nur in diesem Browser gespeichert und direkt an die Serverfunktion übergeben'} wide>
              <Input type="password" autoComplete="off" value={cfg.apiKey} onChange={(e) => setCfg((c) => ({ ...c, apiKey: e.target.value }))} placeholder="sk-ant-…" />
            </Field>
            {status.tokenRequired && (
              <Field label="Zugangstoken (APP_ACCESS_TOKEN)" wide>
                <Input type="password" autoComplete="off" value={cfg.appToken} onChange={(e) => setCfg((c) => ({ ...c, appToken: e.target.value }))} />
              </Field>
            )}
          </FormGrid>
          {result && <Callout tone={result.ok ? 'success' : 'error'}>{result.text}</Callout>}
        </CardBody>
        <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <Button icon={<KeyRound size={15} />} loading={testing} onClick={test} disabled={!status.reachable}>
            Verbindung testen
          </Button>
          <Button variant="primary" icon={<Save size={15} />} disabled={!dirty} onClick={save}>
            Speichern
          </Button>
        </div>
      </Card>
      <Card>
        <CardHeader title="Datenschutz" />
        <CardBody className="space-y-3 text-[13px] text-muted">
          <p>Ohne KI arbeitet PersoCRM vollständig lokal mit eingebauter Erkennung. Mit KI werden nur die Inhalte der jeweiligen Aktion (z.B. ein Lebenslauf) an Anthropic übermittelt.</p>
          <p>Für den Betrieb im Team empfiehlt sich der Server-Schlüssel als Umgebungsvariable <code className="rounded bg-surface-2 px-1">ANTHROPIC_API_KEY</code> auf Vercel, optional geschützt mit <code className="rounded bg-surface-2 px-1">APP_ACCESS_TOKEN</code>.</p>
          <p>Kandidatinnen und Kandidaten sind über die Bearbeitung ihrer Daten zu informieren (revDSG).</p>
        </CardBody>
      </Card>
    </div>
  );
}

/* ---------- Benutzer ---------- */
function UsersTab({ readOnly }: { readOnly: boolean }) {
  const users = useData((s) => s.users);
  const deleteUser = useData((s) => s.deleteUser);
  const me = useCurrentUser();
  const [edit, setEdit] = useState<{ open: boolean; user?: User }>({ open: false });

  return (
    <Card>
      <CardHeader
        title="Benutzer"
        subtitle="Demo-Anmeldung im Browser – für den Produktivbetrieb ist eine Server-Authentifizierung nötig"
        actions={
          !readOnly && (
            <Button size="sm" variant="primary" icon={<UserPlus size={14} />} onClick={() => setEdit({ open: true })}>
              Benutzer hinzufügen
            </Button>
          )
        }
      />
      <DataTable
        rows={users}
        rowKey={(u) => u.id}
        columns={[
          { key: 'name', header: 'Name', cell: (u) => <b>{u.name}{u.id === me?.id && <span className="ml-1.5 font-normal text-muted">(ich)</span>}</b>, sortValue: (u) => u.name },
          { key: 'user', header: 'Benutzername', cell: (u) => u.username },
          { key: 'mail', header: 'E-Mail', cell: (u) => u.email, hideOnMobile: true },
          { key: 'rolle', header: 'Rolle', cell: (u) => <Badge tone={u.rolle === 'admin' ? 'purple' : 'gray'}>{ROLE_LABELS[u.rolle]}</Badge> },
          {
            key: 'a',
            header: '',
            align: 'right',
            cell: (u) =>
              !readOnly && (
                <span className="inline-flex">
                  <IconButton size="sm" label="Bearbeiten" onClick={() => setEdit({ open: true, user: u })}>
                    <Pencil size={14} />
                  </IconButton>
                  <IconButton
                    size="sm"
                    tone="danger"
                    label="Löschen"
                    disabled={u.id === me?.id}
                    onClick={async () => {
                      if (!(await confirmDialog({ title: 'Benutzer löschen', message: `${u.name} (${u.username}) löschen?`, confirmLabel: 'Löschen', tone: 'danger' }))) return;
                      const r = deleteUser(u.id);
                      r.ok ? toast.success('Benutzer gelöscht') : toast.error(r.error);
                    }}
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </span>
              ),
          },
        ]}
      />
      <UserDialog open={edit.open} user={edit.user} onClose={() => setEdit({ open: false })} />
    </Card>
  );
}

function UserDialog({ open, onClose, user }: { open: boolean; onClose: () => void; user?: User }) {
  const addUser = useData((s) => s.addUser);
  const updateUser = useData((s) => s.updateUser);
  const [form, setForm] = useState({ name: '', username: '', email: '', rolle: 'berater' as Role, password: '' });

  useEffect(() => {
    if (open) setForm({ name: user?.name ?? '', username: user?.username ?? '', email: user?.email ?? '', rolle: user?.rolle ?? 'berater', password: '' });
  }, [open, user]);

  const save = async () => {
    if (!form.name.trim() || !form.username.trim()) return toast.error('Name und Benutzername sind Pflichtfelder.');
    if (!user && form.password.length < 6) return toast.error('Das Passwort muss mindestens 6 Zeichen lang sein.');
    if (user && form.password && form.password.length < 6) return toast.error('Das neue Passwort muss mindestens 6 Zeichen lang sein.');
    const base = { name: form.name.trim(), username: form.username.trim(), email: form.email.trim(), rolle: form.rolle };
    const passwordHash = form.password ? await sha256(form.password) : undefined;
    const r = user ? updateUser(user.id, { ...base, ...(passwordHash ? { passwordHash } : {}) }) : addUser({ ...base, passwordHash: passwordHash! });
    if (!r.ok) return toast.error(r.error);
    toast.success(user ? 'Benutzer gespeichert' : 'Benutzer erstellt');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={user ? 'Benutzer bearbeiten' : 'Neuer Benutzer'}
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
        <Field label="Name" required>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </Field>
        <Field label="Benutzername" required>
          <Input value={form.username} autoComplete="off" onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} />
        </Field>
        <Field label="E-Mail">
          <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </Field>
        <Field label="Rolle">
          <Select value={form.rolle} onChange={(e) => setForm((f) => ({ ...f, rolle: e.target.value as Role }))}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={user ? 'Neues Passwort (optional)' : 'Passwort'} required={!user} hint="Mindestens 6 Zeichen" wide>
          <Input type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
        </Field>
      </FormGrid>
    </Modal>
  );
}

/* ---------- Daten ---------- */
function DataTab({ readOnly }: { readOnly: boolean }) {
  const exportData = useData((s) => s.exportData);
  const importData = useData((s) => s.importData);
  const resetDemo = useData((s) => s.resetDemo);
  const snapshot = useData((s) => s.snapshot);
  const audit = useData((s) => s.audit);
  const users = useData((s) => s.users);
  const fileRef = useRef<HTMLInputElement>(null);
  const [size, setSize] = useState(0);
  const k = useData((s) => s.candidates.length);
  const f = useData((s) => s.companies.length);
  const v = useData((s) => s.jobs.length);
  const e = useData((s) => s.assignments.length);
  const r = useData((s) => s.invoices.length);

  useEffect(() => setSize(new Blob([localStorage.getItem(STORAGE_KEY) ?? '']).size), [audit]);

  const doExport = () => {
    downloadFile(`persocrm-backup-${todayISO()}.json`, JSON.stringify(exportData(), null, 2), 'application/json');
    toast.success('Sicherung heruntergeladen');
  };

  const doImport = async (file: File) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      return toast.error('Die Datei ist kein gültiges JSON.');
    }
    if (!(await confirmDialog({ title: 'Daten importieren', message: 'Alle aktuellen Daten werden durch den Inhalt der Datei ersetzt.', confirmLabel: 'Importieren', tone: 'danger' }))) return;
    const restore = snapshot();
    const res = importData(parsed);
    if (!res.ok) return toast.error(res.error);
    toast.undo('Daten importiert', restore);
  };

  const doReset = async () => {
    if (!(await confirmDialog({ title: 'Demodaten wiederherstellen', message: 'Alle Daten werden durch die Demodaten ersetzt. Vorher eine Sicherung herunterladen?', confirmLabel: 'Zurücksetzen', tone: 'danger' }))) return;
    const restore = snapshot();
    resetDemo();
    toast.undo('Demodaten wiederhergestellt', restore);
  };

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card>
        <CardHeader title="Datensicherung" subtitle={`${k} Kandidaten · ${f} Unternehmen · ${v} Vakanzen · ${e} Einsätze · ${r} Rechnungen`} />
        <CardBody className="space-y-4">
          <Callout tone="warn" icon={<TriangleAlert size={16} />}>
            Die Daten liegen im Speicher dieses Browsers ({(size / 1024).toFixed(0)} KB von ca. 5 MB). Laden Sie regelmässig eine Sicherung herunter.
          </Callout>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" icon={<Download size={15} />} onClick={doExport}>
              Sicherung herunterladen
            </Button>
            {!readOnly && (
              <>
                <Button icon={<Upload size={15} />} onClick={() => fileRef.current?.click()}>
                  Sicherung importieren
                </Button>
                <Button variant="ghost" icon={<RotateCcw size={15} />} onClick={doReset}>
                  Demodaten
                </Button>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(ev) => {
                const file = ev.target.files?.[0];
                ev.target.value = '';
                if (file) void doImport(file);
              }}
            />
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Protokoll" subtitle="Letzte Änderungen aller Benutzer" icon={<CircleCheck size={17} className="text-green-600" />} />
        <ul className="max-h-[360px] divide-y divide-line overflow-y-auto">
          {audit.slice(0, 80).map((entry) => (
            <li key={entry.id} className="flex gap-3 px-5 py-2 text-[13px]">
              <span className="w-[120px] shrink-0 text-xs text-muted">{fmtDateTime(entry.ts)}</span>
              <span className="min-w-0 flex-1">{entry.text}</span>
              <span className="shrink-0 text-xs text-subtle">{users.find((u) => u.id === entry.userId)?.name ?? ''}</span>
            </li>
          ))}
          {!audit.length && <li className="px-5 py-6 text-center text-sm text-muted">Noch keine Einträge.</li>}
        </ul>
      </Card>
    </div>
  );
}

