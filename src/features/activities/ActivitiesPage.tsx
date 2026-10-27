import { useMemo, useState } from 'react';
import { CalendarCheck, CalendarArrowDown, Plus } from 'lucide-react';
import type { Activity, ActivityType } from '@/types';
import { ACTIVITY_TYPES } from '@/types';
import { addDays, normalize, parseDate, startOfWeek, todayISO } from '@/domain/format';
import { useData } from '@/store/data';
import { useCurrentUser } from '@/store/session';
import { toast } from '@/store/ui';
import { downloadFile } from '@/lib/download';
import { Button, Card, CardBody, EmptyState, PageHeader, SearchInput, SegmentedControl, Select, Toolbar } from '@/components/ui';
import { ActivityRow } from '@/components/shared/ActivityTimeline';
import { ActivityDialog } from '@/components/shared/ActivityDialog';
import { useUrlAction } from '@/lib/hooks';

type View = 'offen' | 'erledigt' | 'alle';

const GROUPS = [
  { key: 'ueberfaellig', title: 'Überfällig', tone: 'text-red-600 dark:text-red-400' },
  { key: 'heute', title: 'Heute', tone: 'text-brand' },
  { key: 'woche', title: 'Diese Woche', tone: '' },
  { key: 'spaeter', title: 'Später', tone: '' },
  { key: 'ohne', title: 'Ohne Fälligkeit', tone: 'text-muted' },
] as const;
type GroupKey = (typeof GROUPS)[number]['key'];

function groupOf(a: Activity, today: string): GroupKey {
  if (!a.faelligAm) return 'ohne';
  const d = a.faelligAm.slice(0, 10);
  if (d < today) return 'ueberfaellig';
  if (d === today) return 'heute';
  if (d <= addDays(startOfWeek(today), 6)) return 'woche';
  return 'spaeter';
}

/** iCalendar-Export offener Termine und Aufgaben */
function toIcs(list: Activity[]): string {
  const stamp = (v: string) => {
    const d = parseDate(v)!;
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`;
  };
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/[,;]/g, (m) => `\\${m}`).replace(/\r?\n/g, '\\n');
  const events = list.map((a) => {
    const start = stamp(a.faelligAm.length > 10 ? a.faelligAm : `${a.faelligAm}T09:00`);
    return ['BEGIN:VEVENT', `UID:${a.id}@persocrm`, `DTSTAMP:${start}`, `DTSTART:${start}`, 'DURATION:PT30M', `SUMMARY:${esc(`${a.typ}: ${a.betreff}`)}`, `DESCRIPTION:${esc(a.beschreibung)}`, 'END:VEVENT'].join('\r\n');
  });
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PersoCRM//DE', ...events, 'END:VCALENDAR'].join('\r\n');
}

export default function ActivitiesPage() {
  const activities = useData((s) => s.activities);
  const users = useData((s) => s.users);
  const me = useCurrentUser();
  const [view, setView] = useState<View>('offen');
  const [typ, setTyp] = useState<ActivityType | ''>('');
  const [userId, setUserId] = useState<string>(me?.id ?? '');
  const [q, setQ] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const today = todayISO();

  useUrlAction('neu', () => setDialogOpen(true));

  const filtered = useMemo(() => {
    const n = normalize(q);
    return activities.filter((a) => {
      if (view === 'offen' && a.erledigt) return false;
      if (view === 'erledigt' && !a.erledigt) return false;
      if (typ && a.typ !== typ) return false;
      if (userId && a.userId !== userId) return false;
      return !n || normalize(`${a.betreff} ${a.beschreibung}`).includes(n);
    });
  }, [activities, view, typ, userId, q]);

  const grouped = useMemo(() => {
    const m = new Map<GroupKey, Activity[]>(GROUPS.map((g) => [g.key, []]));
    for (const a of filtered) m.get(groupOf(a, today))!.push(a);
    for (const list of m.values()) list.sort((x, y) => (x.faelligAm || '9999').localeCompare(y.faelligAm || '9999'));
    return m;
  }, [filtered, today]);

  const sortedFlat = useMemo(() => [...filtered].sort((x, y) => (y.faelligAm || y.createdAt).localeCompare(x.faelligAm || x.createdAt)), [filtered]);
  const openCount = activities.filter((a) => !a.erledigt && (!userId || a.userId === userId)).length;

  const exportIcs = () => {
    const list = activities.filter((a) => !a.erledigt && a.faelligAm && a.faelligAm.slice(0, 10) >= today && (!userId || a.userId === userId));
    if (!list.length) return toast.info('Keine anstehenden Aktivitäten mit Fälligkeit.');
    downloadFile(`persocrm-termine-${today}.ics`, toIcs(list), 'text/calendar;charset=utf-8');
    toast.success(`${list.length} Einträge exportiert – in Outlook/Google Kalender importieren`);
  };

  return (
    <>
      <PageHeader
        title="Aktivitäten"
        subtitle={`${openCount} offene Aufgaben, Anrufe und Termine`}
        actions={
          <>
            <Button icon={<CalendarArrowDown size={16} />} onClick={exportIcs}>
              Kalender-Export
            </Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setDialogOpen(true)}>
              Neue Aktivität
            </Button>
          </>
        }
      />
      <Toolbar>
        <SegmentedControl<View>
          value={view}
          onChange={setView}
          options={[
            { value: 'offen', label: 'Offen' },
            { value: 'erledigt', label: 'Erledigt' },
            { value: 'alle', label: 'Alle' },
          ]}
        />
        <SearchInput className="w-full sm:w-64" value={q} onChange={setQ} placeholder="Betreff, Beschreibung…" />
        <Select className="w-auto" value={typ} onChange={(e) => setTyp(e.target.value as ActivityType | '')}>
          <option value="">Alle Typen</option>
          {ACTIVITY_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </Select>
        <Select className="w-auto" value={userId} onChange={(e) => setUserId(e.target.value)}>
          <option value="">Alle Mitarbeitenden</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.id === me?.id ? `${u.name} (ich)` : u.name}
            </option>
          ))}
        </Select>
      </Toolbar>

      {!filtered.length ? (
        <Card>
          <EmptyState icon={<CalendarCheck size={22} />} title={view === 'offen' ? 'Alles erledigt' : 'Keine Aktivitäten'} text="Passen Sie die Filter an oder erfassen Sie eine neue Aktivität." />
        </Card>
      ) : view === 'offen' ? (
        <div className="space-y-4">
          {GROUPS.map((g) => {
            const list = grouped.get(g.key) ?? [];
            if (!list.length) return null;
            return (
              <Card key={g.key}>
                <div className="flex items-center gap-2 border-b border-line px-5 py-2.5">
                  <h2 className={`text-[13.5px] font-bold ${g.tone}`}>{g.title}</h2>
                  <span className="rounded-full bg-surface-2 px-2 text-xs font-semibold text-muted">{list.length}</span>
                </div>
                <CardBody className="py-0">
                  <ul className="divide-y divide-line">
                    {list.map((a) => (
                      <ActivityRow key={a.id} a={a} showBezug />
                    ))}
                  </ul>
                </CardBody>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardBody className="py-0">
            <ul className="divide-y divide-line">
              {sortedFlat.map((a) => (
                <ActivityRow key={a.id} a={a} showBezug />
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
      <ActivityDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </>
  );
}
