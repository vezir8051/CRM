import { useLocation, useNavigate } from 'react-router-dom';
import { Briefcase, Building2, CalendarCheck, CalendarClock, Menu, Monitor, Moon, Plus, Search, Sparkles, Sun, UserPlus, Globe } from 'lucide-react';
import { useUi, type Theme } from '@/store/ui';
import { Button, DropdownMenu, IconButton, Kbd } from '@/components/ui';
import { AiStatusPill } from '@/components/shared/AiStatus';
import { titleForPath } from './nav';

const THEME_NEXT: Record<Theme, Theme> = { light: 'dark', dark: 'system', system: 'light' };
const THEME_ICON: Record<Theme, JSX.Element> = { light: <Sun size={17} />, dark: <Moon size={17} />, system: <Monitor size={17} /> };
const THEME_LABEL: Record<Theme, string> = { light: 'Hell', dark: 'Dunkel', system: 'System' };

export function Topbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const theme = useUi((s) => s.theme);
  const setTheme = useUi((s) => s.setTheme);
  const setPaletteOpen = useUi((s) => s.setPaletteOpen);
  const setSidebarOpen = useUi((s) => s.setSidebarOpen);

  return (
    <header className="no-print sticky top-0 z-20 flex h-[60px] items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur md:px-6">
      <IconButton label="Menü" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
        <Menu size={20} />
      </IconButton>
      <div className="hidden truncate text-[16.5px] font-bold md:block">{titleForPath(pathname)}</div>

      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className="ml-auto flex h-9 w-full max-w-[420px] items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 text-left text-[13.5px] text-subtle transition-colors hover:border-brand/50"
      >
        <Search size={15} />
        <span className="flex-1 truncate">Suchen oder fragen: «Elektriker in Winterthur ab sofort»</span>
        <span className="hidden gap-1 sm:flex">
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>

      <AiStatusPill />

      <IconButton label={`Darstellung: ${THEME_LABEL[theme]}`} onClick={() => setTheme(THEME_NEXT[theme])}>
        {THEME_ICON[theme]}
      </IconButton>

      <DropdownMenu
        trigger={(_, toggle) => (
          <Button variant="primary" icon={<Plus size={16} />} onClick={toggle}>
            <span className="hidden sm:inline">Neu</span>
          </Button>
        )}
        items={[
          { label: 'Kandidat', icon: <UserPlus size={16} />, onSelect: () => navigate('/kandidaten?neu=1') },
          { label: 'Lebenslauf importieren', icon: <Sparkles size={16} />, onSelect: () => navigate('/kandidaten?import=1') },
          'divider',
          { label: 'Unternehmen', icon: <Building2 size={16} />, onSelect: () => navigate('/unternehmen?neu=1') },
          { label: 'Firma von Webseite', icon: <Globe size={16} />, onSelect: () => navigate('/unternehmen?import=1') },
          { label: 'Vakanz', icon: <Briefcase size={16} />, onSelect: () => navigate('/vakanzen?neu=1') },
          'divider',
          { label: 'Einsatz', icon: <CalendarClock size={16} />, onSelect: () => navigate('/einsaetze?neu=1') },
          { label: 'Aktivität', icon: <CalendarCheck size={16} />, onSelect: () => navigate('/aktivitaeten?neu=1') },
        ]}
      />
    </header>
  );
}
