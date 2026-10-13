// Shared presentational components.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Ban,
  Check,
  CheckCheck,
  CircleAlert,
  CircleDashed,
  CircleDot,
  CircleHelp,
  DoorOpen,
  Hand,
  Headphones,
  Lightbulb,
  Link2,
  Pause,
  PersonStanding,
  Play,
  Square,
  SkipForward,
  TriangleAlert,
  Users,
  Video,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { AggregateReadiness, Department, IconKey } from '../../shared/types.ts';
import type { CallState } from '../../shared/calls.ts';
import type { ConnState } from '../lib/useLiveShow.ts';
import { formatClock } from '../../shared/timing.ts';

export const DEPT_ICONS: Record<IconKey, LucideIcon> = {
  director: Users,
  video: Video,
  audio: Headphones,
  lighting: Lightbulb,
  stage: PersonStanding,
  foh: DoorOpen,
  generic: CircleDot,
};

export function DeptIcon({ icon, size = 18, title }: { icon: IconKey; size?: number; title?: string }) {
  const I = DEPT_ICONS[icon] ?? CircleDot;
  return <I width={size} height={size} aria-hidden={title ? undefined : true} aria-label={title} focusable={false} />;
}

/** Department identity: always icon AND label. */
export function DeptLabel({ dept, size = 18 }: { dept: Department | undefined; size?: number }) {
  if (!dept) return <span className="dept-tag">Unknown department</span>;
  return (
    <span className="dept-tag">
      <DeptIcon icon={dept.icon} size={size} />
      {dept.name}
    </span>
  );
}

export function Logo({ variant = 'color', small = false }: { variant?: 'white' | 'color' | 'black'; small?: boolean }) {
  return <img className={`logo ${small ? 'logo-sm' : ''}`} src={`/brand/sho-call-${variant}.png`} alt="Sho Call" width={small ? 96 : 120} height={small ? 32 : 40} />;
}

const STATE_META: Record<CallState, { label: string; Icon: LucideIcon }> = {
  pending: { label: 'Pending', Icon: CircleDashed },
  prepared: { label: 'Prepared', Icon: CircleDot },
  standby: { label: 'Standby', Icon: Pause },
  called: { label: 'Go — called', Icon: Play },
  complete: { label: 'Complete', Icon: CheckCheck },
  held: { label: 'Held', Icon: Hand },
  skipped: { label: 'Skipped', Icon: SkipForward },
  mixed: { label: 'Mixed', Icon: CircleHelp },
};

export function StatusChip({ state, at }: { state: CallState; at?: string }) {
  const m = STATE_META[state];
  return (
    <span key={state} className={`chip chip-${state} chip-anim`}>
      <m.Icon aria-hidden />
      {m.label}
      {at ? <span className="tabular" style={{ fontWeight: 600 }}>{at}</span> : null}
    </span>
  );
}

const READY_META: Record<AggregateReadiness, { label: string; Icon: LucideIcon }> = {
  ready: { label: 'Ready', Icon: Check },
  pending: { label: 'Awaiting', Icon: CircleDashed },
  issue: { label: 'Issue', Icon: TriangleAlert },
  unknown: { label: 'Unknown (offline)', Icon: CircleHelp },
};

export function ReadinessChip({ value, prefix = 'Crew' }: { value: AggregateReadiness; prefix?: string }) {
  const m = READY_META[value];
  return (
    <span key={value} className={`chip chip-${value} chip-anim`} title={`${prefix} readiness: ${m.label}`}>
      <m.Icon aria-hidden />
      <span className="sr-only">{prefix} readiness: </span>
      {m.label}
    </span>
  );
}

export function QLinkTag({ label }: { label: string }) {
  return (
    <span className="qlink">
      <Link2 aria-hidden />
      <span>
        <span className="sr-only">Q-Link group </span>
        {label}
      </span>
    </span>
  );
}

export function ModeBadge({ mode }: { mode: 'rehearsal' | 'live' | null }) {
  if (!mode) return <span className="badge-mode badge-none">No session</span>;
  return (
    <span className={`badge-mode badge-${mode}`}>
      {mode === 'live' ? <Square width={10} height={10} fill="currentColor" aria-hidden /> : null}
      {mode === 'live' ? 'Live' : 'Rehearsal'}
    </span>
  );
}

export function ConnectionIndicator({ conn, lastSync, revision, tz, now }: { conn: ConnState; lastSync: number | null; revision: number | null; tz: string; now: number }) {
  const label = conn === 'connected' ? 'Connected' : conn === 'reconnecting' ? 'Reconnecting' : conn === 'connecting' ? 'Connecting' : 'Offline';
  const ago = lastSync ? Math.round((now - lastSync) / 1000) : null;
  return (
    <span className={`conn conn-${conn}`} role="status" aria-live="polite">
      {conn === 'offline' || conn === 'reconnecting' ? <span className="stale-stamp">Stale</span> : null}
      <span className="conn-dot" aria-hidden />
      <span>
        {label}
        {conn !== 'connected' && lastSync ? <span className="hide-phone"> · last sync {formatClock(lastSync, tz)}</span> : null}
        {revision !== null ? <span className="muted hide-phone"> · rev {revision}</span> : null}
        {conn === 'connected' && ago !== null && ago > 6 ? <span className="muted hide-phone"> · {ago}s</span> : null}
      </span>
    </span>
  );
}

export function StaleBanner({ conn, revision, lastSync, tz }: { conn: ConnState; revision: number | null; lastSync: number | null; tz: string }) {
  if (conn === 'connected') return null;
  if (conn === 'connecting' && revision === null) return null;
  const when = lastSync ? formatClock(lastSync, tz) : 'never';
  if (conn === 'offline') {
    return (
      <div className="banner banner-offline" role="alert">
        <CircleAlert aria-hidden />
        <div className="grow">
          <p>
            <span className="stale-stamp">Stale</span> Offline — showing revision {revision ?? '?'}, last synced {when}.
          </p>
          <p>Actions are disabled until the connection returns. Nothing is queued or sent later.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="banner banner-reconnecting" role="status">
      <TriangleAlert aria-hidden />
      <div className="grow">
        <p>
          <span className="stale-stamp">Stale</span> Reconnecting — showing revision {revision ?? '?'}, last synced {when}.
        </p>
        <p>Actions are paused until the latest show state has been received.</p>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ overlays

function useFocusTrap(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>('[data-autofocus], input, select, textarea, button');
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'Tab' && el) {
        const items = [...el.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
        if (!items.length) return;
        const a = items[0];
        const b = items[items.length - 1];
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          b.focus();
        } else if (!e.shiftKey && document.activeElement === b) {
          e.preventDefault();
          a.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
    };
  }, [onClose]);
  return ref;
}

export function Dialog({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useFocusTrap(onClose);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`dialog ${wide ? 'dialog-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="dlg-title">
        <div className="spread" style={{ marginBottom: 16 }}>
          <h2 id="dlg-title">{title}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useFocusTrap(onClose);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <div className="spread">
          <h2 id="drawer-title">{title}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useFocusTrap(onClose);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <div className="spread" style={{ marginBottom: 12 }}>
          <h2 id="sheet-title">{title}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ------------------------------------------------------------ toasts & announcements

interface Toast {
  id: number;
  kind: 'ok' | 'error' | 'info';
  text: string;
}

const ToastCtx = createContext<{ toast: (kind: Toast['kind'], text: string) => void; announce: (text: string, urgent?: boolean) => void }>({
  toast: () => {},
  announce: () => {},
});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [polite, setPolite] = useState('');
  const [assertive, setAssertive] = useState('');
  const toast = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, kind, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 9000 : 5000);
  }, []);
  const announce = useCallback((text: string, urgent = false) => {
    const set = urgent ? setAssertive : setPolite;
    set('');
    window.setTimeout(() => set(text), 30);
  }, []);
  return (
    <ToastCtx.Provider value={{ toast, announce }}>
      {children}
      <div className="sr-only" aria-live="polite">{polite}</div>
      <div className="sr-only" aria-live="assertive">{assertive}</div>
      <div className="toast-region" role="status">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            {t.kind === 'error' ? <Ban aria-hidden width={18} /> : t.kind === 'ok' ? <Check aria-hidden width={18} /> : <CircleHelp aria-hidden width={18} />}
            <span className="grow">{t.text}</span>
            <button className="btn btn-ghost btn-sm" aria-label="Dismiss" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>
              <X />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

export function Field({ label, error, children, hint }: { label: string; error?: string | null; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint ? <span className="small muted" style={{ fontWeight: 400 }}>{hint}</span> : null}
      {error ? <span className="field-error">{error}</span> : null}
    </label>
  );
}

export function Attribution() {
  return (
    <p className="attribution">
      <img src="/brand/verdigen-emblem.png" alt="" width={20} height={20} />
      Sho Call is a Verdigen product
    </p>
  );
}
