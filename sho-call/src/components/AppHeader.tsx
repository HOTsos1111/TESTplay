import { CircleHelp, LogOut } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useAuth } from '../auth.tsx';
import { linkTo } from '../lib/router.ts';
import { Logo } from './ui.tsx';
import { HelpDialog } from './HelpDialog.tsx';

/** Header for planning pages (dashboard, setup, designer, import). */
export function AppHeader({ children }: { children?: ReactNode }) {
  const { user, logout } = useAuth();
  const [help, setHelp] = useState(false);
  return (
    <header className="app-header">
      <a href="/" onClick={linkTo('/')} aria-label="Sho Call — all shows">
        <Logo />
      </a>
      {children}
      <span className="header-spacer" />
      <button className="btn btn-ghost btn-sm" onClick={() => setHelp(true)}>
        <CircleHelp /> <span className="hide-phone">Help</span>
      </button>
      {user ? (
        <>
          <span className="muted small hide-phone">{user.name}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => void logout()}>
            <LogOut /> <span className="hide-phone">Sign out</span>
          </button>
        </>
      ) : null}
      {help ? <HelpDialog onClose={() => setHelp(false)} /> : null}
    </header>
  );
}
