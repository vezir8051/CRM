import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Filter, Plus, Sparkles, Users, X } from 'lucide-react';
import type { Candidate, CandidateFilter, CandidateStatus, EmploymentType, Permit } from '@/types';
import { CANDIDATE_STATUS, EMPLOYMENT_TYPES, PERMITS } from '@/types';
import { fmtDate, fmtRelative, fullName } from '@/domain/format';
import { applyCandidateFilter, describeFilter, filterFromParams, filterToParams, isFilterEmpty } from '@/domain/search';
import { useData } from '@/store/data';
import { useLookups } from '@/store/selectors';
import { useUrlAction } from '@/lib/hooks';
import { downloadCsv } from '@/lib/download';
import {
  Avatar, Badge, Button, Callout, Card, CellStack, ChipSelect, DataTable, EmptyState, Field, Input, NumberInput, PageHeader, SearchInput, Select, StatusBadge, Tag, TagInput, Toolbar, type Column,
} from '@/components/ui';
import { CandidateForm, type CandidateImport } from './CandidateForm';
import { CvImportDialog } from './CvImportDialog';

export default function CandidatesPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const candidates = useData((s) => s.candidates);
  const users = useData((s) => s.users);
  const l = useLookups();

  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importData, setImportData] = useState<CandidateImport | null>(null);
  const [showMore, setShowMore] = useState(false);

  useUrlAction('neu', () => {
    setImportData(null);
    setFormOpen(true);
  });
  useUrlAction('import', () => setImportOpen(true));

  const filter = useMemo(() => filterFromParams(params), [params]);
  const betreuer = params.get('betreuer') ?? '';
  const smart = params.get('smart');
  const info = params.get('info');

  const update = (patch: Partial<CandidateFilter>, extra: Record<string, string | null> = {}) => {
    const next = filterToParams({ ...filter, ...patch });
    const keep = { betreuer, ...extra };
    for (const [k, v] of Object.entries(keep)) if (v) next.set(k, v);
    if (smart && !('smart' in extra)) next.set('smart', smart);
    if (info && !('info' in extra)) next.set('info', info);
    setParams(next, { replace: true });
  };
  const reset = () => setParams(new URLSearchParams(), { replace: true });

  const rows = useMemo(() => {
    const list = applyCandidateFilter(candidates, filter);
    return betreuer ? list.filter((c) => c.betreuerId === betreuer) : list;
  }, [candidates, filter, betreuer]);

  // Ohne Verfügbarkeitsfilter gäbe es Treffer? → Hinweis anbieten
  const relaxedCount = useMemo(
    () => (rows.length === 0 && filter.verfuegbarBis ? applyCandidateFilter(candidates, { ...filter, verfuegbarBis: '' }).length : 0),
    [rows.length, filter, candidates],
  );

  const activeFilters = describeFilter({ ...filter, q: '' });
  const extendedActive = filter.skills.length + filter.orte.length + filter.berufe.length + filter.bewilligungen.length + (filter.anstellungsart ? 1 : 0) + (filter.verfuegbarBis ? 1 : 0) + (filter.minErfahrung !== null ? 1 : 0);

  const columns: Column<Candidate>[] = [
    { key: 'nr', header: 'Nr', cell: (c) => <span className="text-muted">{c.nr}</span>, sortValue: (c) => c.nr, hideOnMobile: true },
    {
      key: 'name',
      header: 'Name',
      sortValue: (c) => `${c.nachname} ${c.vorname}`,
      cell: (c) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={fullName(c)} size={34} />
          <CellStack main={fullName(c)} sub={c.beruf || '–'} />
        </div>
      ),
    },
    { key: 'ort', header: 'Ort', cell: (c) => c.ort || '–', sortValue: (c) => c.ort, hideOnMobile: true },
    {
      key: 'skills',
      header: 'Skills',
      hideOnMobile: true,
      cell: (c) => (
        <div className="flex max-w-[280px] flex-wrap gap-1">
          {c.skills.slice(0, 3).map((s) => (
            <Tag key={s} active={filter.skills.some((f) => s.toLowerCase().includes(f.toLowerCase()))}>
              {s}
            </Tag>
          ))}
          {c.skills.length > 3 && <Tag>+{c.skills.length - 3}</Tag>}
        </div>
      ),
    },
    {
      key: 'verf',
      header: 'Verfügbar',
      sortValue: (c) => c.verfuegbarAb,
      cell: (c) => (c.verfuegbarAb ? <CellStack main={fmtDate(c.verfuegbarAb)} sub={fmtRelative(c.verfuegbarAb)} /> : <span className="text-subtle">–</span>),
    },
    { key: 'bew', header: 'Bew.', cell: (c) => (c.bewilligung ? <StatusBadge value={c.bewilligung} /> : null), hideOnMobile: true },
    { key: 'status', header: 'Status', cell: (c) => <StatusBadge value={c.status} />, sortValue: (c) => c.status },
    {
      key: 'betreuer',
      header: 'Betreuer',
      hideOnMobile: true,
      cell: (c) => {
        const u = l.user.get(c.betreuerId);
        return u ? <Avatar name={u.name} size={26} /> : null;
      },
    },
  ];

  const exportCsv = () =>
    downloadCsv(
      `kandidaten-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Nr', 'Anrede', 'Vorname', 'Nachname', 'E-Mail', 'Telefon', 'PLZ', 'Ort', 'Beruf', 'Skills', 'Verfügbar ab', 'Pensum', 'Status', 'Betreuer'],
      rows.map((c) => [c.nr, c.anrede, c.vorname, c.nachname, c.email, c.telefon, c.plz, c.ort, c.beruf, c.skills.join(', '), c.verfuegbarAb, c.pensum, c.status, l.user.get(c.betreuerId)?.name]),
    );

  return (
    <>
      <PageHeader
        title="Kandidaten"
        subtitle={`${candidates.length} Kandidaten · ${candidates.filter((c) => ['Neu', 'In Prüfung', 'Aktiv'].includes(c.status)).length} aktiv auf Stellensuche`}
        actions={
          <>
            <Button icon={<Download size={16} />} onClick={exportCsv} className="hidden sm:inline-flex">
              CSV
            </Button>
            <Button variant="soft" icon={<Sparkles size={16} />} onClick={() => setImportOpen(true)}>
              Lebenslauf-Import
            </Button>
            <Button
              variant="primary"
              icon={<Plus size={16} />}
              onClick={() => {
                setImportData(null);
                setFormOpen(true);
              }}
            >
              Neuer Kandidat
            </Button>
          </>
        }
      />

      {smart && (
        <Callout tone="info" icon={<Sparkles size={16} />} className="mb-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <span>
              Intelligente Suche: <strong>«{smart}»</strong>
            </span>
            {info && <span className="text-xs opacity-80">– {info}</span>}
            <button type="button" className="ml-auto text-xs font-semibold underline" onClick={reset}>
              Suche zurücksetzen
            </button>
          </div>
        </Callout>
      )}

      <Toolbar>
        <SearchInput className="w-full sm:w-72" value={filter.q} onChange={(q) => update({ q })} placeholder="Name, Beruf, Skill, Ort, Lebenslauf-Text…" />
        <Select className="w-auto" value={filter.status[0] ?? ''} onChange={(e) => update({ status: e.target.value ? [e.target.value as CandidateStatus] : [] })}>
          <option value="">Alle Status</option>
          {CANDIDATE_STATUS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
        <Select className="w-auto" value={betreuer} onChange={(e) => update({}, { betreuer: e.target.value || null })}>
          <option value="">Alle Betreuer</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
        <Button icon={<Filter size={15} />} variant={showMore || extendedActive ? 'soft' : 'secondary'} onClick={() => setShowMore((v) => !v)}>
          Filter{extendedActive ? ` (${extendedActive})` : ''}
        </Button>
        {(!isFilterEmpty(filter) || betreuer) && (
          <Button variant="ghost" icon={<X size={15} />} onClick={reset}>
            Zurücksetzen
          </Button>
        )}
        <span className="ml-auto text-[12.5px] text-muted">
          {rows.length} von {candidates.length}
        </span>
      </Toolbar>

      {showMore && (
        <Card className="mb-3.5 p-4">
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Skills (alle erforderlich)">
              <TagInput value={filter.skills} onChange={(skills) => update({ skills })} placeholder="z.B. SQL" />
            </Field>
            <Field label="Orte">
              <TagInput value={filter.orte} onChange={(orte) => update({ orte })} placeholder="z.B. Zürich" />
            </Field>
            <Field label="Beruf enthält">
              <TagInput value={filter.berufe} onChange={(berufe) => update({ berufe })} placeholder="z.B. Elektro" />
            </Field>
            <Field label="Verfügbar spätestens">
              <Input type="date" value={filter.verfuegbarBis} onChange={(e) => update({ verfuegbarBis: e.target.value })} />
            </Field>
            <Field label="Min. Erfahrung (Jahre)">
              <NumberInput min={0} value={filter.minErfahrung} onChange={(minErfahrung) => update({ minErfahrung })} />
            </Field>
            <Field label="Anstellungsart">
              <Select value={filter.anstellungsart} onChange={(e) => update({ anstellungsart: e.target.value as EmploymentType | '' })}>
                <option value="">Alle</option>
                {EMPLOYMENT_TYPES.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </Select>
            </Field>
            <Field label="Bewilligung" className="lg:col-span-2">
              <ChipSelect<Exclude<Permit, ''>> options={PERMITS} value={filter.bewilligungen as Exclude<Permit, ''>[]} onChange={(bewilligungen) => update({ bewilligungen })} />
            </Field>
          </div>
        </Card>
      )}

      {!showMore && activeFilters.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {activeFilters.map((f) => (
            <Badge key={f} tone="blue">
              {f}
            </Badge>
          ))}
        </div>
      )}

      <Card>
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(c) => c.id}
          onRowClick={(c) => navigate(`/kandidaten/${c.id}`)}
          defaultSort={{ key: 'nr', dir: 'desc' }}
          empty={
            <EmptyState
              icon={<Users size={22} />}
              title="Keine Kandidaten gefunden"
              text={candidates.length ? 'Passen Sie Suche oder Filter an.' : 'Erfassen Sie den ersten Kandidaten oder importieren Sie einen Lebenslauf.'}
              action={
                relaxedCount > 0 ? (
                  <Button variant="soft" onClick={() => update({ verfuegbarBis: '' })}>
                    {relaxedCount} Treffer mit späterer Verfügbarkeit anzeigen
                  </Button>
                ) : candidates.length ? (
                  <Button onClick={reset}>Filter zurücksetzen</Button>
                ) : (
                  <Button variant="primary" icon={<Sparkles size={15} />} onClick={() => setImportOpen(true)}>
                    Lebenslauf importieren
                  </Button>
                )
              }
            />
          }
        />
      </Card>

      <CvImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onResult={(r) => {
          setImportOpen(false);
          setImportData(r);
          setFormOpen(true);
        }}
      />
      <CandidateForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setImportData(null);
        }}
        importData={importData}
        onSaved={(c) => navigate(`/kandidaten/${c.id}`)}
      />
    </>
  );
}
