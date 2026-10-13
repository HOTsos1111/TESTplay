import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CircleHelp, Crosshair, Home, Layers, LayoutList, ListOrdered, Maximize2, PencilLine, Play, Rows3, ShieldAlert } from 'lucide-react';
import { api, errorText, NetworkError } from '../lib/api.ts';
import { clientId, requestKey } from '../lib/ids.ts';
import { linkTo } from '../lib/router.ts';
import { useLiveShow, useTick } from '../lib/useLiveShow.ts';
import { useShowModel } from '../lib/model.ts';
import { useChanges } from '../lib/useChanges.ts';
import { usePrefs } from '../lib/prefs.ts';
import { useAuth } from '../auth.tsx';
import { ConnectionIndicator, DeptIcon, Dialog, Logo, ModeBadge, StaleBanner, useToast } from '../components/ui.tsx';
import { RunningOrder, visibleCalls, type Preset } from '../components/RunningOrder.tsx';
import { availability, FocusCard } from '../components/FocusCard.tsx';
import { ActivityPanel, CrewPanel, RevisionBanner } from '../components/LivePanels.tsx';
import { LiveEditDrawer } from '../components/LiveEditDrawer.tsx';
import { HelpDialog } from '../components/HelpDialog.tsx';
import { StartSessionDialog } from './ShowPage.tsx';
import { ACTION_LABEL } from '../../shared/cueMachine.ts';
import { formatClock, formatDuration } from '../../shared/timing.ts';
import type { CueAction } from '../../shared/types.ts';

const PRESETS: { key: Preset; label: string; Icon: typeof LayoutList; kbd: string }[] = [
  { key: 'full', label: 'Full show', Icon: ListOrdered, kbd: '1' },
  { key: 'current', label: 'Current / Upcoming', Icon: Crosshair, kbd: '2' },
  { key: 'compact', label: 'Compact', Icon: Rows3, kbd: '3' },
  { key: 'expanded', label: 'Expanded', Icon: Maximize2, kbd: '4' },
];

interface Uncertain {
  key: string;
  label: string;
}

export function DirectorConsole({ showId }: { showId: string }) {
  const { user } = useAuth();
  const { toast, announce } = useToast();
  const live = useLiveShow(showId);
  const tick = useTick(500);
  const now = live.now();
  void tick;
  const s = live.snapshot;
  const model = useShowModel(s, now);
  const [prefs, setPrefs] = usePrefs(`director:${user?.id}:${showId}`, { preset: 'full' as Preset, depts: [] as string[], follow: true });
  const [armedId, setArmedId] = useState<string | null>(null);
  const [pending, setPending] = useState<CueAction | null>(null);
  const [uncertain, setUncertain] = useState<Uncertain | null>(null);
  const [editing, setEditing] = useState(false);
  const [help, setHelp] = useState(false);
  const [taking, setTaking] = useState(false);
  const [starting, setStarting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const programmaticScroll = useRef(false);

  const { changed, banner, dismissBanner } = useChanges(s, (events) => {
    const last = events[events.length - 1];
    if (last.type === 'revision' || last.type === 'undo' || last.type === 'control' || last.type === 'session') announce(last.summary);
  });

  const session = s?.session ?? null;
  const inControl = !!session && session.directorUserId === user?.id && session.controlClientId === clientId();
  const canDirect = s ? s.me.role === 'owner' || s.me.role === 'director' : false;
  const blockedReason = !s
    ? 'Loading…'
    : !canDirect
      ? 'Read-only: your role cannot call cues.'
      : live.conn !== 'connected'
        ? 'Actions disabled: not connected to the server.'
        : !session
          ? 'No rehearsal or live session is running.'
          : !inControl
            ? !session.controlClientId
              ? 'Read-only until you take Director control on this console.'
              : `Read-only: ${session.directorUserId === user?.id ? 'another of your consoles' : session.directorName} has Director control.`
            : null;

  // The armed target is pinned: it changes only when the Director arms another
  // call (row, N key, Arm next). It starts at the next open call and never moves
  // by itself after a Go, so a repeated key press cannot fire a different cue.
  const armed = (armedId && model?.callById.get(armedId)) || null;
  useEffect(() => {
    if (!model) return;
    if (!armedId || !model.callById.get(armedId)) setArmedId(model.next?.id ?? model.calls[0]?.id ?? null);
  }, [armedId, model]);

  const calls = useMemo(() => (model ? visibleCalls(model, prefs.preset, prefs.depts) : []), [model, prefs.preset, prefs.depts]);

  // Follow live: keep the current/next call in view unless the user scrolled away.
  const followTarget = model?.next?.id ?? model?.last?.id ?? null;
  useEffect(() => {
    if (!prefs.follow || !followTarget) return;
    const row = scrollRef.current?.querySelector<HTMLElement>(`[data-call-id="${followTarget}"]`);
    if (!row) return;
    programmaticScroll.current = true;
    row.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    window.setTimeout(() => (programmaticScroll.current = false), 700);
  }, [followTarget, prefs.follow, prefs.preset]);

  const onUserScroll = () => {
    if (!programmaticScroll.current && prefs.follow) setPrefs({ follow: false });
  };

  const sendAction = useCallback(
    async (action: CueAction, reason: string) => {
      if (!armed || !s || blockedReason || pending) return;
      const key = requestKey();
      const label = `${ACTION_LABEL[action]} ${armed.number}`;
      setPending(action);
      try {
        const r = await api<{ applied: string[]; unchanged: { cueId: string; reason: string }[]; duplicate: boolean }>('POST', `/api/shows/${showId}/cue-actions`, {
          target: armed.kind === 'group' ? { kind: 'group', id: armed.groupId } : { kind: 'cue', id: armed.cueIds[0] },
          action,
          reason,
          idempotencyKey: key,
          clientId: clientId(),
        });
        if (r.unchanged.length) toast('info', `${label}: ${r.applied.length} of ${r.applied.length + r.unchanged.length} cues changed. ${r.unchanged[0].reason}`);
        announce(`${label} accepted`, action === 'go');
      } catch (e) {
        if (e instanceof NetworkError) {
          // The command may or may not have arrived. Never resend automatically.
          setUncertain({ key, label });
        } else {
          toast('error', `${label} rejected: ${errorText(e)}`);
          announce(`${label} rejected`, true);
        }
      } finally {
        setPending(null);
      }
    },
    [armed, s, blockedReason, pending, showId, toast, announce],
  );

  // After reconnecting, find out what happened to a command whose response was lost.
  useEffect(() => {
    if (!uncertain || live.conn !== 'connected') return;
    api<{ status: 'accepted' | 'not_received'; result?: { at: string } }>('GET', `/api/shows/${showId}/cue-actions/${uncertain.key}`)
      .then((r) => {
        if (r.status === 'accepted') toast('ok', `${uncertain.label} was accepted by the server (${formatClock(Date.parse(r.result!.at), s?.show.timezone ?? 'UTC')}).`);
        else toast('error', `${uncertain.label} was NOT received. Nothing was issued — call it again if it is still needed.`);
        setUncertain(null);
      })
      .catch(() => {});
  }, [uncertain, live.conn, showId, toast, s?.show.timezone]);

  const armNext = useCallback(() => {
    if (!model) return;
    const list = calls.length ? calls : model.calls;
    const idx = armed ? list.findIndex((c) => c.id === armed.id) : -1;
    const next = list.slice(idx + 1).find((c) => model.isOpen(c)) ?? model.next;
    if (next) {
      setArmedId(next.id);
      announce(`Armed ${next.number} ${next.label}`);
    }
  }, [model, calls, armed, announce]);

  // Keyboard shortcuts: only in the console, never while typing or in a dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.closest('input, textarea, select, [contenteditable="true"]') || t.isContentEditable)) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      const k = e.key.toLowerCase();
      const preset = PRESETS.find((p) => p.kbd === k);
      if (preset) {
        setPrefs({ preset: preset.key });
        announce(`${preset.label} view`);
      } else if (k === 'f') setPrefs({ follow: true });
      else if (k === 'n') armNext();
      else if (k === '?') setHelp(true);
      else if (k === 'g' || k === 's' || k === 'p') {
        const action: CueAction = k === 'g' ? 'go' : k === 's' ? 'standby' : 'prepare';
        if (!armed || !model) return;
        e.preventDefault();
        const a = availability(model, armed, action);
        if (blockedReason) toast('error', blockedReason);
        else if (!a.ok) toast('error', a.reason);
        else void sendAction(action, '');
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [armed, model, blockedReason, sendAction, armNext, setPrefs, toast, announce]);

  const undo = async (revisionId: string) => {
    if (!s) return;
    try {
      const r = await api<{ revision: number }>('POST', `/api/shows/${showId}/undo`, { revisionId, baseRevision: s.show.revision, clientId: clientId() });
      toast('ok', `Undo applied as revision ${r.revision}. Earlier calls and history are unchanged.`);
    } catch (e) {
      toast('error', errorText(e));
    }
  };

  const takeControl = async () => {
    try {
      await api('POST', `/api/shows/${showId}/session/take-control`, { clientId: clientId(), confirm: true });
      toast('ok', 'This console now has Director control.');
      setTaking(false);
    } catch (e) {
      toast('error', errorText(e));
    }
  };

  if (!s || !model) {
    return (
      <div className="app-root theme-director">
        <main id="main" className="page" aria-busy="true">
          {live.error ? <div className="banner banner-error" role="alert">{live.error}</div> : <p className="muted">Connecting to the show…</p>}
        </main>
      </div>
    );
  }

  const tz = s.show.timezone;
  const elapsed = session ? (now - Date.parse(session.startedAt)) / 1000 : null;
  const stale = live.conn !== 'connected';

  return (
    <div className="app-root theme-director">
      <header className={`app-header ${live.conn !== 'connected' ? 'is-stale' : ''}`}>
        <a href={`/shows/${showId}`} onClick={linkTo(`/shows/${showId}`)} aria-label="Show page">
          <Logo small />
        </a>
        <span className="header-divider hide-phone" />
        <div className="identity">
          <DeptIcon icon="director" size={32} />
          <div style={{ minWidth: 0 }}>
            <div className="identity-label">Director</div>
            <div className="identity-sub">{s.show.title}</div>
          </div>
        </div>
        <ModeBadge mode={session?.mode ?? null} />
        <span className="header-spacer" />
        <div className="clock-block">
          <span className="clock-label">Show clock</span>
          <span className="clock-value accent">{formatClock(now, tz)}</span>
        </div>
        {elapsed !== null ? (
          <div className="clock-block hide-phone">
            <span className="clock-label">Elapsed</span>
            <span className="clock-value">{formatDuration(Math.max(0, elapsed))}</span>
          </div>
        ) : null}
        <ConnectionIndicator conn={live.conn} lastSync={live.lastSync} revision={live.revision} tz={tz} now={Date.now()} />
        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setHelp(true)} aria-label="Help and shortcuts">
          <CircleHelp />
        </button>
      </header>

      <main id="main" className={`stack ${stale ? 'stale' : ''}`} style={{ gap: 12, paddingTop: 12 }}>
        <div className="stack" style={{ padding: '0 24px', gap: 8 }}>
          <StaleBanner conn={live.conn} revision={live.revision} lastSync={live.lastSync} tz={tz} />
          <RevisionBanner event={banner} onDismiss={dismissBanner} />
          {uncertain ? (
            <div className="banner banner-reconnecting" role="alert">
              <ShieldAlert aria-hidden />
              <p className="grow">
                {uncertain.label}: the connection dropped before the server answered. Waiting to reconnect to check whether it was received — it will not be resent automatically.
              </p>
            </div>
          ) : null}
          {!session ? (
            <div className="banner banner-info">
              <Play aria-hidden />
              <p className="grow">No session is running. Crew can read the running order; calling begins when you start a rehearsal or live session.</p>
              {canDirect ? (
                <button className="btn btn-primary btn-sm" disabled={live.conn !== 'connected'} onClick={() => setStarting(true)}>
                  Start session…
                </button>
              ) : null}
            </div>
          ) : !inControl && canDirect ? (
            <div className="banner banner-reconnecting">
              <ShieldAlert aria-hidden />
              <p className="grow">
                Read-only console. {session.controlClientId ? `${session.directorUserId === user?.id ? 'Another of your consoles' : session.directorName} has Director control.` : `${session.directorName} is the assigned Director; no console has taken control yet.`}
              </p>
              <button className="btn btn-sm" disabled={live.conn !== 'connected'} onClick={() => setTaking(true)}>
                Take control here…
              </button>
            </div>
          ) : null}
        </div>

        <div className="toolbar" role="toolbar" aria-label="View presets and filters">
          <div className="segmented" role="group" aria-label="View preset">
            {PRESETS.map((p) => (
              <button key={p.key} aria-pressed={prefs.preset === p.key} onClick={() => setPrefs({ preset: p.key })} aria-keyshortcuts={p.kbd}>
                <p.Icon aria-hidden /> {p.label} <span className="kbd hide-tablet" aria-hidden>{p.kbd}</span>
              </button>
            ))}
          </div>
          <div className="segmented" role="group" aria-label="Department view (filters the display only)">
            <button aria-pressed={prefs.depts.length === 0} onClick={() => setPrefs({ depts: [] })}>
              <Layers aria-hidden /> All
            </button>
            {s.content.departments.map((d) => (
              <button
                key={d.id}
                aria-pressed={prefs.depts.includes(d.id)}
                onClick={() => setPrefs({ depts: prefs.depts.includes(d.id) ? prefs.depts.filter((x) => x !== d.id) : [...prefs.depts, d.id] })}
              >
                <DeptIcon icon={d.icon} size={16} /> {d.name}
              </button>
            ))}
          </div>
          <span className="grow" />
          <button className="btn btn-sm" onClick={() => setEditing(true)} disabled={!session || !canDirect}>
            <PencilLine /> Live edit
          </button>
          <a className="btn btn-sm btn-ghost" href={`/shows/${showId}`} onClick={linkTo(`/shows/${showId}`)}>
            <Home /> <span className="hide-phone">Show</span>
          </a>
        </div>

        <div className="console">
          <section className="console-main panel" aria-label="Running order">
            <div className="ro-scroll" ref={scrollRef} onWheel={onUserScroll} onTouchMove={onUserScroll} onKeyDown={(e) => (e.key === 'PageDown' || e.key === 'PageUp' ? onUserScroll() : undefined)}>
              <div className={prefs.preset === 'compact' ? 'density-compact' : ''}>
                {prefs.depts.length ? (
                  <p className="small muted" style={{ padding: '10px 4px 0' }}>
                    Showing {prefs.depts.map((id) => model.deptById.get(id)?.name).join(', ')} only. Filtering never changes the armed call.
                  </p>
                ) : null}
                <RunningOrder s={s} model={model} calls={calls} preset={prefs.preset} deptFilter={prefs.depts} armedId={armed?.id ?? null} onArm={setArmedId} changed={changed} />
              </div>
              {!prefs.follow ? (
                <div className="return-live">
                  <button className="btn btn-primary" onClick={() => setPrefs({ follow: true })} aria-keyshortcuts="F">
                    <Crosshair /> Return to Live (F)
                  </button>
                </div>
              ) : null}
            </div>
          </section>
          <aside className="console-side" aria-label="Calling controls, crew and activity">
            {armed && prefs.depts.length && !armed.cueIds.some((id) => prefs.depts.includes(model.cueById.get(id)?.departmentId ?? '')) ? (
              <p className="banner banner-info small">The armed call is outside the current department filter; it is still the calling target.</p>
            ) : null}
            <FocusCard s={s} model={model} call={armed} now={now} stale={stale} blockedReason={blockedReason} pending={pending} onAction={(a, r) => void sendAction(a, r)} onArmNext={armNext} />
            <div className="side-extra stack" style={{ gap: 16 }}>
              <CrewPanel s={s} model={model} />
              <ActivityPanel s={s} onUndo={(id) => void undo(id)} undoDisabled={!inControl && session ? 'Only the console with Director control can undo during a session.' : live.conn !== 'connected' ? 'Not connected.' : null} filter={(a) => a.type !== 'readiness'} />
            </div>
          </aside>
        </div>
      </main>
      {editing ? <LiveEditDrawer s={s} onClose={() => setEditing(false)} canApply={inControl && live.conn === 'connected'} blockedReason={inControl ? null : blockedReason} /> : null}
      {help ? <HelpDialog onClose={() => setHelp(false)} /> : null}
      {starting ? <StartSessionDialog s={s} onClose={() => setStarting(false)} onStarted={() => toast('ok', 'Session started. This console has Director control.')} /> : null}
      {taking && session ? (
        <Dialog title="Take Director control?" onClose={() => setTaking(false)}>
          <div className="stack">
            <p>
              {session.controlClientId
                ? `${session.directorUserId === user?.id ? 'Another of your consoles' : session.directorName} currently has control. Their console becomes read-only immediately and they will see the transfer.`
                : 'No console currently has control.'}{' '}
              The transfer is recorded in the activity log.
            </p>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setTaking(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={() => void takeControl()}>
                Take control
              </button>
            </div>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
