/* ============================================================
   Command Palette (Ctrl/Cmd + K)
   - Schnellsuche über Kandidaten, Unternehmen, Vakanzen, Einsätze
   - Navigation und Aktionen
   - «Intelligente Suche»: natürlichsprachige Anfrage → Kandidatenfilter
     (KI, sonst lokale Auswertung)
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Briefcase, Building2, CalendarClock, Search, Sparkles, User, UserPlus, Globe } from 'lucide-react';
import { cn } from '@/lib/cn';
import { fullName, normalize } from '@/domain/format';
import { candidateMatchesText, filterToParams, vocabularyFrom } from '@/domain/search';
import { smartSearch } from '@/lib/ai';
import { useData } from '@/store/data';
import { toast, useUi } from '@/store/ui';
import { Kbd, Spinner } from '@/components/ui';
import { ALL_NAV_ITEMS } from './nav';

interface Entry {
  id: string;
  group: string;
  label: string;
  sub?: string;
  icon: JSX.Element;
  run: () => void | Promise<void>;
}

export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen);
  const setOpen = useUi((s) => s.setPaletteOpen);
  const navigate = useNavigate();
  const candidates = useData((s) => s.candidates);
  const companies = useData((s) => s.companies);
  const jobs = useData((s) => s.jobs);
  const assignments = useData((s) => s.assignments);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Globales Tastenkürzel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!useUi.getState().paletteOpen);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const close = () => setOpen(false);
  const go = (to: string) => {
    close();
    navigate(to);
  };

  const entries = useMemo<Entry[]>(() => {
    const query = q.trim();
    const n = normalize(query);
    const out: Entry[] = [];

    if (query.split(/\s+/).length >= 2) {
      out.push({
        id: 'smart',
        group: 'Intelligente Suche',
        label: `Kandidaten finden: «${query}»`,
        sub: 'Versteht Beruf, Ort, Skills, Verfügbarkeit, Erfahrung',
        icon: <Sparkles size={16} />,
        run: async () => {
          setBusy(true);
          try {
            const res = await smartSearch(query, vocabularyFrom(candidates));
            const params = filterToParams(res.filter);
            params.set('smart', query);
            if (res.erklaerung) params.set('info', res.erklaerung);
            go(`/kandidaten?${params.toString()}`);
          } catch (e) {
            toast.error((e as Error).message);
          } finally {
            setBusy(false);
          }
        },
      });
    }

    if (n) {
      candidates
        .filter((c) => candidateMatchesText(c, query))
        .slice(0, 6)
        .forEach((c) => out.push({ id: `c${c.id}`, group: 'Kandidaten', label: fullName(c), sub: `${c.beruf} · ${c.ort} · ${c.nr}`, icon: <User size={16} />, run: () => go(`/kandidaten/${c.id}`) }));
      companies
        .filter((f) => normalize(`${f.name} ${f.branche} ${f.ort} ${f.nr}`).includes(n))
        .slice(0, 5)
        .forEach((f) => out.push({ id: `f${f.id}`, group: 'Unternehmen', label: f.name, sub: `${f.branche} · ${f.ort}`, icon: <Building2 size={16} />, run: () => go(`/unternehmen/${f.id}`) }));
      jobs
        .filter((j) => normalize(`${j.titel} ${j.ort} ${j.nr} ${j.skills.join(' ')}`).includes(n))
        .slice(0, 5)
        .forEach((j) => out.push({ id: `j${j.id}`, group: 'Vakanzen', label: j.titel, sub: `${companies.find((c) => c.id === j.companyId)?.name ?? ''} · ${j.status}`, icon: <Briefcase size={16} />, run: () => go(`/vakanzen/${j.id}`) }));
      assignments
        .filter((a) => normalize(`${a.nr} ${a.funktion} ${fullName(candidates.find((c) => c.id === a.candidateId))}`).includes(n))
        .slice(0, 4)
        .forEach((a) => out.push({ id: `e${a.id}`, group: 'Einsätze', label: `${a.nr} · ${a.funktion}`, sub: fullName(candidates.find((c) => c.id === a.candidateId)), icon: <CalendarClock size={16} />, run: () => go(`/einsaetze/${a.id}`) }));
    }

    const actions: Entry[] = [
      { id: 'a-cv', group: 'Aktionen', label: 'Lebenslauf importieren', icon: <Sparkles size={16} />, run: () => go('/kandidaten?import=1') },
      { id: 'a-web', group: 'Aktionen', label: 'Unternehmen von Webseite importieren', icon: <Globe size={16} />, run: () => go('/unternehmen?import=1') },
      { id: 'a-kand', group: 'Aktionen', label: 'Neuer Kandidat', icon: <UserPlus size={16} />, run: () => go('/kandidaten?neu=1') },
      { id: 'a-vak', group: 'Aktionen', label: 'Neue Vakanz', icon: <Briefcase size={16} />, run: () => go('/vakanzen?neu=1') },
      { id: 'a-einsatz', group: 'Aktionen', label: 'Neuer Einsatz', icon: <CalendarClock size={16} />, run: () => go('/einsaetze?neu=1') },
    ];
    const nav: Entry[] = ALL_NAV_ITEMS.map((i) => ({ id: `n${i.to}`, group: 'Navigation', label: i.label, icon: <i.icon size={16} />, run: () => go(i.to) }));
    const match = (e: Entry) => !n || normalize(e.label).includes(n);
    out.push(...actions.filter(match), ...nav.filter(match));
    return out;
    // go/close sind stabil genug; Neuberechnung nur bei Daten-/Suchänderung
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, candidates, companies, jobs, assignments]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  let lastGroup = '';
  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-start justify-center bg-slate-950/50 p-4 pt-[12vh] animate-fade-in" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-pop animate-slide-up">
        <div className="flex items-center gap-3 border-b border-line px-4">
          {busy ? <Spinner size={16} className="text-brand" /> : <Search size={17} className="text-subtle" />}
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Suchen, springen oder fragen…"
            className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-subtle"
            onKeyDown={(e) => {
              if (e.key === 'Escape') close();
              else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(entries.length - 1, a + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === 'Enter' && entries[active] && !busy) {
                e.preventDefault();
                void entries[active].run();
              }
            }}
          />
          <Kbd>Esc</Kbd>
        </div>
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-1.5">
          {entries.length === 0 && <div className="px-3 py-8 text-center text-sm text-muted">Keine Treffer für «{q}»</div>}
          {entries.map((e, i) => {
            const header = e.group !== lastGroup ? e.group : null;
            lastGroup = e.group;
            return (
              <div key={e.id}>
                {header && <div className="px-3 pb-1 pt-2.5 text-[10.5px] font-bold uppercase tracking-wider text-subtle">{header}</div>}
                <button
                  type="button"
                  data-idx={i}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => !busy && void e.run()}
                  className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left', i === active ? 'bg-brand-soft' : '')}
                >
                  <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', e.id === 'smart' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300' : 'bg-surface-2 text-muted')}>{e.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold">{e.label}</span>
                    {e.sub && <span className="block truncate text-xs text-muted">{e.sub}</span>}
                  </span>
                  {i === active && <ArrowRight size={15} className="text-brand" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
