import { useEffect, useState, type FormEvent } from 'react';
import { LogIn } from 'lucide-react';
import { api, errorText } from '../lib/api.ts';
import { navigate } from '../lib/router.ts';
import { useAuth } from '../auth.tsx';
import { Attribution, Field } from '../components/ui.tsx';
import type { User } from '../../shared/types.ts';

interface DemoAccount {
  email: string;
  name: string;
  label: string;
  password: string;
}

function Ribbon() {
  return (
    <svg className="ribbon" viewBox="0 0 1200 260" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="rb" x1="0" x2="1">
          <stop offset="0" stopColor="#22d3ee" stopOpacity="0" />
          <stop offset="0.35" stopColor="#38bdf8" stopOpacity="0.55" />
          <stop offset="0.7" stopColor="#8b5cf6" stopOpacity="0.5" />
          <stop offset="1" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0 170 C 250 40, 450 260, 700 150 S 1050 30, 1200 120" stroke="url(#rb)" strokeWidth="3" fill="none" />
      <path d="M0 200 C 300 90, 500 250, 760 170 S 1080 80, 1200 150" stroke="url(#rb)" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

export function LoginPage() {
  const { setUser, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState<DemoAccount[]>([]);
  const next = new URLSearchParams(location.search).get('next') || '/';

  useEffect(() => {
    if (user) navigate(next.startsWith('/') && next !== '/login' ? next : '/', true);
  }, [user, next]);

  useEffect(() => {
    api<{ enabled: boolean; accounts: DemoAccount[] }>('GET', '/api/demo-accounts')
      .then((r) => setDemo(r.accounts))
      .catch(() => {});
  }, []);

  const signIn = async (e: string, p: string) => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ user: User }>('POST', '/api/auth/login', { email: e, password: p });
      setUser(r.user);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    void signIn(email, password);
  };

  return (
    <main id="main" className="login-bg">
      <Ribbon />
      <div className="login-card panel glass">
        <img className="logo" src="/brand/sho-call-color.png" alt="Sho Call" width={162} height={54} />
        <p className="muted" style={{ textAlign: 'center' }}>Live show coordination reimagined.</p>
        <form className="stack" onSubmit={submit} noValidate>
          <Field label="Email">
            <input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!error} />
          </Field>
          <Field label="Password">
            <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!error} />
          </Field>
          {error ? (
            <p className="field-error" role="alert">
              {error}
            </p>
          ) : null}
          <button className="btn btn-primary" type="submit" disabled={busy} aria-busy={busy}>
            <LogIn /> {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        {demo.length ? (
          <section className="stack" aria-labelledby="demo-h">
            <div className="spread">
              <h2 id="demo-h" style={{ fontSize: 15 }}>
                Demo accounts
              </h2>
              <span className="chip chip-accent">Demo · fictional data</span>
            </div>
            <p className="small muted">One-click sign-in to the fictional Summit Live show. Use two browsers (or a private window) to see Director and crew side by side.</p>
            <div className="demo-list">
              {demo.map((a) => (
                <button key={a.email} className="btn btn-sm" disabled={busy} onClick={() => void signIn(a.email, a.password)}>
                  {a.label}
                </button>
              ))}
            </div>
          </section>
        ) : null}
        <Attribution />
      </div>
    </main>
  );
}
