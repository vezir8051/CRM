import { Suspense, useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useCurrentUser } from '@/store/session';
import { Spinner } from '@/components/ui';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { CommandPalette } from './CommandPalette';
import { titleForPath } from './nav';

export function PageLoader() {
  return (
    <div className="flex h-64 items-center justify-center text-brand">
      <Spinner size={24} />
    </div>
  );
}

/** Rahmen für alle angemeldeten Seiten */
export function AppLayout() {
  const user = useCurrentUser();
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = `${titleForPath(pathname)} – PersoCRM`;
    window.scrollTo(0, 0);
  }, [pathname]);

  if (!user) return <Navigate to="/login" replace state={{ from: pathname }} />;

  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="flex min-h-screen flex-col lg:pl-60">
        <Topbar />
        <main className="mx-auto w-full max-w-[1500px] flex-1 p-4 md:p-6">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
