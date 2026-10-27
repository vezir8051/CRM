import {
  Briefcase, Building2, CalendarCheck, CalendarClock, ChartColumn, ClipboardList, LayoutDashboard, Receipt, Settings, SquareKanban, Users,
  type LucideIcon,
} from 'lucide-react';

export type NavBadgeKey = 'vakanzen' | 'aktivitaeten' | 'rapporte' | 'rechnungen';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: NavBadgeKey;
  /** Kopfzeilen-Titel für Detailseiten */
  title?: string;
}

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  { label: 'Übersicht', items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    label: 'Vermittlung',
    items: [
      { to: '/kandidaten', label: 'Kandidaten', icon: Users },
      { to: '/unternehmen', label: 'Unternehmen', icon: Building2 },
      { to: '/vakanzen', label: 'Vakanzen', icon: Briefcase, badge: 'vakanzen' },
      { to: '/pipeline', label: 'Pipeline', icon: SquareKanban },
    ],
  },
  {
    label: 'Personalverleih',
    items: [
      { to: '/einsaetze', label: 'Einsätze', icon: CalendarClock },
      { to: '/rapporte', label: 'Rapporte', icon: ClipboardList, badge: 'rapporte' },
      { to: '/rechnungen', label: 'Rechnungen', icon: Receipt, badge: 'rechnungen' },
    ],
  },
  {
    label: 'Organisation',
    items: [
      { to: '/aktivitaeten', label: 'Aktivitäten', icon: CalendarCheck, badge: 'aktivitaeten' },
      { to: '/berichte', label: 'Berichte', icon: ChartColumn },
      { to: '/einstellungen', label: 'Einstellungen', icon: Settings },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

export function titleForPath(pathname: string): string {
  if (pathname === '/') return 'Dashboard';
  const item = ALL_NAV_ITEMS.find((i) => i.to !== '/' && pathname.startsWith(i.to));
  return item?.label ?? 'PersoCRM';
}
