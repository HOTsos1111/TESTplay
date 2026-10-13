import { useCallback, useEffect, useState } from 'react';
import { api } from './lib/api.ts';
import { match, navigate, usePath } from './lib/router.ts';
import { AuthCtx } from './auth.tsx';
import { ToastProvider } from './components/ui.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { ShowPage } from './pages/ShowPage.tsx';
import { DesignerPage } from './pages/DesignerPage.tsx';
import { ImportPage } from './pages/ImportPage.tsx';
import { DirectorConsole } from './pages/DirectorConsole.tsx';
import { CrewView } from './pages/CrewView.tsx';
import type { User } from '../shared/types.ts';

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);
  const path = usePath();

  useEffect(() => {
    api<{ user: User | null }>('GET', '/api/auth/me')
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setChecked(true));
  }, []);

  const logout = useCallback(async () => {
    await api('POST', '/api/auth/logout').catch(() => {});
    setUser(null);
    navigate('/login');
  }, []);

  useEffect(() => {
    if (checked && !user && path !== '/login') navigate(`/login?next=${encodeURIComponent(path)}`, true);
  }, [checked, user, path]);

  let page: React.ReactNode = null;
  if (!checked) page = <div className="app-root" aria-busy="true" />;
  else if (!user || path === '/login') page = <LoginPage />;
  else {
    let m: Record<string, string> | null;
    if ((m = match('/shows/:id/console', path))) page = <DirectorConsole showId={m.id} />;
    else if ((m = match('/shows/:id/crew', path))) page = <CrewView showId={m.id} />;
    else if ((m = match('/shows/:id/designer', path))) page = <DesignerPage showId={m.id} />;
    else if ((m = match('/shows/:id/import', path))) page = <ImportPage showId={m.id} />;
    else if ((m = match('/shows/:id', path))) page = <ShowPage showId={m.id} />;
    else if (match('/import', path)) page = <ImportPage showId={null} />;
    else page = <DashboardPage />;
  }

  return (
    <AuthCtx.Provider value={{ user, setUser, logout }}>
      <ToastProvider>
        <a className="skip-link" href="#main">Skip to content</a>
        {page}
      </ToastProvider>
    </AuthCtx.Provider>
  );
}
