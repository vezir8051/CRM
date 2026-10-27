import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ROLE_LABELS } from '@/domain/constants';
import { useNavCounts } from '@/store/selectors';
import { logout, useCurrentUser } from '@/store/session';
import { useUi } from '@/store/ui';
import { Avatar } from '@/components/ui';
import { NAV_GROUPS } from './nav';

export function Sidebar() {
  const counts = useNavCounts();
  const user = useCurrentUser();
  const open = useUi((s) => s.sidebarOpen);
  const setOpen = useUi((s) => s.setSidebarOpen);
  const navigate = useNavigate();

  return (
    <>
      <div className={cn('fixed inset-0 z-30 bg-slate-950/40 lg:hidden', open ? 'block' : 'hidden')} onClick={() => setOpen(false)} />
      <aside
        className={cn(
          'no-print fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-nav text-nav-fg transition-transform lg:translate-x-0',
          open ? 'translate-x-0 shadow-pop' : '-translate-x-full',
        )}
      >
        <div className="flex items-center gap-2.5 border-b border-white/5 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 text-[17px] font-bold text-white shadow-[0_2px_8px_rgba(37,99,235,.5)]">P</div>
          <div className="leading-tight">
            <div className="text-[15.5px] font-bold text-white">PersoCRM</div>
            <div className="text-[10.5px] font-medium uppercase tracking-wider">Vermittlung & Verleih</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {NAV_GROUPS.map((g) => (
            <div key={g.label} className="mb-3">
              <div className="px-3 pb-1 pt-2 text-[10.5px] font-bold uppercase tracking-wider text-nav-fg/60">{g.label}</div>
              {g.items.map((item) => {
                const count = item.badge ? counts[item.badge] : 0;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors',
                        isActive ? 'bg-blue-600/25 text-white shadow-[inset_3px_0_0_rgb(59,130,246)]' : 'hover:bg-nav-hover hover:text-slate-100',
                      )
                    }
                  >
                    <item.icon size={17} className="shrink-0 opacity-90" />
                    <span className="truncate">{item.label}</span>
                    {count > 0 && (
                      <span className={cn('ml-auto min-w-[19px] rounded-full px-1.5 text-center text-[10.5px] font-bold leading-[19px] text-white', item.badge === 'rechnungen' ? 'bg-red-600' : 'bg-blue-600')}>
                        {count}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {user && (
          <div className="flex items-center gap-2.5 border-t border-white/5 px-4 py-3.5">
            <Avatar name={user.name} size={34} />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[13px] font-semibold text-slate-100">{user.name}</div>
              <div className="truncate text-[11.5px]">{ROLE_LABELS[user.rolle]}</div>
            </div>
            <button
              type="button"
              title="Abmelden"
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="ml-auto rounded-md p-1.5 hover:bg-nav-hover hover:text-white"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
