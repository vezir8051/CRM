import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Briefcase, CalendarCheck, CalendarClock, Clock, FileClock, Handshake, Lightbulb, Receipt, TriangleAlert, UserRound, Users, Wallet } from 'lucide-react';
import type { Insight } from '@/domain/insights';
import { computeInsights } from '@/domain/insights';
import { activeAssignmentsAt, activePlacementsAt, funnel, percentChange, revenueByMonth, revenueMonthToDate } from '@/domain/reports';
import { PHASE_COLORS } from '@/domain/constants';
import { addDays, fmtCHF, fmtCompact, fmtDate, fmtLongDate, fullName, lastMonths, MONTHS_SHORT, todayISO } from '@/domain/format';
import { isInvoiceOverdue } from '@/domain/billing';
import { useCrmData } from '@/store/selectors';
import { useCurrentUser } from '@/store/session';
import { cn } from '@/lib/cn';
import { Avatar, ButtonLink, Card, CardBody, CardHeader, EmptyState, StatsCard, StatusBadge } from '@/components/ui';
import { BarChart, HBarList } from '@/components/charts/Charts';
import { ActivityRow } from '@/components/shared/ActivityTimeline';

const INSIGHT_ICON: Record<Insight['icon'], ReactNode> = {
  alert: <TriangleAlert size={16} />,
  user: <UserRound size={16} />,
  briefcase: <Briefcase size={16} />,
  clock: <Clock size={16} />,
  file: <FileClock size={16} />,
  receipt: <Receipt size={16} />,
  handshake: <Handshake size={16} />,
};

const SEVERITY_STYLE: Record<Insight['severity'], string> = {
  hoch: 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-300',
  mittel: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300',
  info: 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300',
};

function greeting(): string {
  const h = new Date().getHours();
  return h < 11 ? 'Guten Morgen' : h < 17 ? 'Guten Tag' : 'Guten Abend';
}

export default function DashboardPage() {
  const data = useCrmData();
  const me = useCurrentUser();
  const today = todayISO();

  const insights = useMemo(() => computeInsights(data, today), [data, today]);
  const months = useMemo(() => lastMonths(6, today), [today]);
  const revenue = useMemo(() => revenueByMonth(data.invoices, months), [data.invoices, months]);
  const pipeline = useMemo(() => funnel(data.placements.filter((p) => p.phase !== 'Absage')), [data.placements]);

  const { candidates, jobs, placements, assignments, invoices, activities } = data;
  const aktiveKandidaten = candidates.filter((c) => c.status === 'Aktiv' || c.status === 'Neu' || c.status === 'In Prüfung').length;
  const offeneVakanzen = jobs.filter((j) => j.status === 'Offen' || j.status === 'In Bearbeitung');
  const laufend = placements.filter((p) => p.phase === 'Vorgeschlagen' || p.phase === 'Interview' || p.phase === 'Angebot');
  const aktiveEinsaetze = assignments.filter((a) => a.status === 'Aktiv').length;
  const offen = invoices.filter((i) => i.status === 'Offen');
  const overdue = offen.filter((i) => isInvoiceOverdue(i, today));
  // Trends: Umsatz in % ggü. gleichem Zeitraum im Vormonat, Bestände als Differenz zu vor 30 Tagen
  const trends = useMemo(() => {
    const vor30 = addDays(today, -30);
    const mtd = revenueMonthToDate(invoices, today);
    return {
      umsatz: mtd.current,
      umsatzChange: percentChange(mtd.current, mtd.previous),
      prozesse: activePlacementsAt(placements, today) - activePlacementsAt(placements, vor30),
      einsaetze: activeAssignmentsAt(assignments, today) - activeAssignmentsAt(assignments, vor30),
    };
  }, [invoices, placements, assignments, today]);
  const neueKandidaten = candidates.filter((c) => c.createdAt.slice(0, 10) >= addDays(today, -30)).length;

  // Eigene fällige Aufgaben; sind keine offen, die des Teams
  const tasks = useMemo(() => {
    const due = activities.filter((a) => !a.erledigt && a.faelligAm && a.faelligAm.slice(0, 10) <= today).sort((x, y) => x.faelligAm.localeCompare(y.faelligAm));
    const own = due.filter((a) => a.userId === me?.id);
    return { list: (own.length ? own : due).slice(0, 6), team: !own.length && due.length > 0 };
  }, [activities, today, me]);
  const newest = useMemo(() => [...candidates].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5), [candidates]);
  const urgentJobs = useMemo(
    () =>
      offeneVakanzen
        .filter((j) => j.prioritaet === 'Hoch' || (j.deadline && j.deadline <= today))
        .sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'))
        .slice(0, 5),
    [offeneVakanzen, today],
  );

  return (
    <>
      <div className="mb-5">
        <h1 className="text-xl font-bold">
          {greeting()}
          {me ? `, ${me.name.split(' ')[0]}` : ''}
        </h1>
        <p className="text-[13.5px] text-muted">{fmtLongDate(today)}</p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
        <StatsCard title="Aktive Kandidaten" value={aktiveKandidaten} icon={Users} gradient="blue" hint={`${neueKandidaten} neu in 30 Tagen`} to="/kandidaten" />
        <StatsCard title="Offene Vakanzen" value={offeneVakanzen.length} icon={Briefcase} gradient="amber" hint={`${offeneVakanzen.filter((j) => j.prioritaet === 'Hoch').length} mit hoher Priorität`} to="/vakanzen" />
        <StatsCard title="Laufende Prozesse" value={laufend.length} icon={Handshake} gradient="purple" change={trends.prozesse} changeFormat="count" changeLabel="ggü. vor 30 Tagen" hint={`${laufend.filter((p) => p.phase === 'Angebot').length} im Angebot`} to="/pipeline" />
        <StatsCard title="Aktive Einsätze" value={aktiveEinsaetze} icon={CalendarClock} gradient="cyan" change={trends.einsaetze} changeFormat="count" changeLabel="ggü. vor 30 Tagen" to="/einsaetze" />
        <StatsCard title="Umsatz diesen Monat" value={fmtCHF(trends.umsatz)} icon={Wallet} gradient="green" change={trends.umsatzChange} changeLabel="ggü. Vormonat" hint="netto, verrechnet" to="/berichte" />
        <StatsCard
          title="Offene Forderungen"
          value={fmtCHF(offen.reduce((s, i) => s + i.total, 0))}
          icon={Receipt}
          gradient={overdue.length ? 'red' : 'gray'}
          hint={overdue.length ? `${overdue.length} überfällig` : 'nichts überfällig'}
          to="/rechnungen"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[3fr_2fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Empfehlungen" subtitle="Automatisch aus Ihren Daten abgeleitet" icon={<Lightbulb size={17} className="text-amber-500" />} />
            {insights.length ? (
              <ul className="divide-y divide-line">
                {insights.slice(0, 7).map((i) => (
                  <li key={i.id} className="flex items-start gap-3 px-5 py-3">
                    <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', SEVERITY_STYLE[i.severity])}>{INSIGHT_ICON[i.icon]}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-semibold">{i.title}</div>
                      <div className="text-[12.5px] text-muted">{i.text}</div>
                    </div>
                    {i.action && (
                      <ButtonLink size="sm" variant="ghost" to={i.action.to} className="shrink-0">
                        {i.action.label} <ArrowRight size={13} />
                      </ButtonLink>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<Lightbulb size={22} />} title="Alles im grünen Bereich" text="Keine offenen Empfehlungen – gute Arbeit!" />
            )}
          </Card>

          <Card>
            <CardHeader title="Umsatz der letzten 6 Monate" subtitle="Netto, Personalverleih und Vermittlungshonorare" actions={<ButtonLink size="sm" variant="ghost" to="/berichte">Berichte <ArrowRight size={13} /></ButtonLink>} />
            <CardBody>
              <BarChart
                data={revenue.map((r) => ({
                  label: MONTHS_SHORT[Number(r.month.slice(5, 7)) - 1]!,
                  value: r.total,
                  title: `${r.month}: ${fmtCHF(r.total)} (Verleih ${fmtCHF(r.verleih)}, Honorar ${fmtCHF(r.honorar)})`,
                }))}
                format={fmtCompact}
              />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title={tasks.team ? 'Fällige Aufgaben im Team' : 'Meine Aufgaben heute'}
              icon={<CalendarCheck size={17} className="text-brand" />}
              actions={<ButtonLink size="sm" variant="ghost" to="/aktivitaeten">Alle <ArrowRight size={13} /></ButtonLink>}
            />
            <CardBody className="py-0">
              {tasks.list.length ? (
                <ul className="divide-y divide-line">
                  {tasks.list.map((a) => (
                    <ActivityRow key={a.id} a={a} showBezug compact />
                  ))}
                </ul>
              ) : (
                <EmptyState icon={<CalendarCheck size={22} />} title="Keine fälligen Aufgaben" className="py-6" />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Pipeline" subtitle="Prozesse, die die Phase erreicht haben" actions={<ButtonLink size="sm" variant="ghost" to="/pipeline">Öffnen <ArrowRight size={13} /></ButtonLink>} />
            <CardBody>
              <HBarList data={pipeline.map((f) => ({ label: f.phase, value: f.count, color: PHASE_COLORS[f.phase], to: '/pipeline' }))} labelWidth={110} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Dringende Vakanzen" actions={<ButtonLink size="sm" variant="ghost" to="/vakanzen">Alle <ArrowRight size={13} /></ButtonLink>} />
            {urgentJobs.length ? (
              <ul className="divide-y divide-line">
                {urgentJobs.map((j) => (
                  <li key={j.id}>
                    <Link to={`/vakanzen/${j.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-2/60">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-semibold">{j.titel}</div>
                        <div className="truncate text-xs text-muted">
                          {data.companies.find((c) => c.id === j.companyId)?.name} · Antritt {fmtDate(j.deadline)}
                        </div>
                      </div>
                      <StatusBadge value={j.prioritaet} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<Briefcase size={22} />} title="Keine dringenden Vakanzen" className="py-6" />
            )}
          </Card>

          <Card>
            <CardHeader title="Neueste Kandidaten" actions={<ButtonLink size="sm" variant="ghost" to="/kandidaten">Alle <ArrowRight size={13} /></ButtonLink>} />
            <ul className="divide-y divide-line">
              {newest.map((c) => (
                <li key={c.id}>
                  <Link to={`/kandidaten/${c.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-2/60">
                    <Avatar name={fullName(c)} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-semibold">{fullName(c)}</div>
                      <div className="truncate text-xs text-muted">
                        {c.beruf} · {c.ort}
                      </div>
                    </div>
                    <StatusBadge value={c.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
