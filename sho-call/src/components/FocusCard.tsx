// The armed-call focus card with the calling controls. Buttons keep fixed
// positions; availability follows the shared cue state machine, and every
// disabled control explains why.

import { useState } from 'react';
import { ChevronRight, Hand, Play, RotateCcw, SkipForward } from 'lucide-react';
import { transition, ACTION_LABEL } from '../../shared/cueMachine.ts';
import type { Call } from '../../shared/calls.ts';
import { formatClock, formatDuration } from '../../shared/timing.ts';
import type { CueAction, Snapshot } from '../../shared/types.ts';
import { callTime, type ShowModel } from '../lib/model.ts';
import { Dialog, DeptIcon, deptVars, QLinkTag, ReadinessChip, StatusChip } from './ui.tsx';
import { CallScriptCell } from './RunningOrder.tsx';
import { callScript } from '../../shared/script.ts';

export function availability(model: ShowModel, call: Call, action: CueAction): { ok: boolean; reason: string } {
  let reason = '';
  for (const id of call.cueIds) {
    const st = model.states.get(id);
    const t = transition(st?.state ?? 'pending', st?.prevState ?? null, action);
    if (t.ok) return { ok: true, reason: '' };
    reason = t.reason;
  }
  return { ok: false, reason };
}

export function FocusCard({
  s,
  model,
  call,
  now,
  blockedReason,
  pending,
  onAction,
  onArmNext,
  stale = false,
}: {
  stale?: boolean;
  s: Snapshot;
  model: ShowModel;
  call: Call | null;
  now: number;
  /** Why no action can be sent at all (offline, not in control, no session). */
  blockedReason: string | null;
  pending: CueAction | null;
  onAction: (action: CueAction, reason: string) => void;
  onArmNext: () => void;
}) {
  const [reasonFor, setReasonFor] = useState<'hold' | 'skip' | null>(null);
  const [reason, setReason] = useState('');
  const tz = s.show.timezone;

  if (!call) {
    return (
      <section className="focus-card stack" aria-label="Armed call">
        <p className="focus-label">Armed call</p>
        <p className="focus-title">Every call has been issued.</p>
        <p className="muted">Select any row to review it, or end the session from the show page.</p>
      </section>
    );
  }

  const state = model.stateOfCall(call);
  const time = callTime(model, call);
  const members = call.cueIds.map((id) => model.cueById.get(id)!).filter(Boolean);
  const untilSec = (time.estimated - now) / 1000;
  const disabledAll = !!blockedReason || pending !== null;
  const btn = (action: CueAction, cls: string, key?: string) => {
    const a = availability(model, call, action);
    const label = pending === action ? 'Sending…' : ACTION_LABEL[action];
    return (
      <button
        className={`btn call-btn ${cls}`}
        disabled={disabledAll || !a.ok}
        aria-busy={pending === action}
        aria-keyshortcuts={key}
        title={blockedReason ?? (a.ok ? `${ACTION_LABEL[action]} ${call.number}` : a.reason)}
        onClick={() => {
          if (action === 'hold' || action === 'skip') {
            setReason('');
            setReasonFor(action);
          } else onAction(action, '');
        }}
      >
        {action === 'go' ? <Play fill="currentColor" aria-hidden /> : null}
        <span>{label}</span>
        {key ? <span className="key" aria-hidden>{key}</span> : null}
      </button>
    );
  };
  // Explain the most important unavailable action in words.
  const goAvail = availability(model, call, 'go');
  const explain = blockedReason ?? (!goAvail.ok ? goAvail.reason.replace('Cannot Go', 'Go unavailable') : null);

  return (
    <section key={call.id} className="focus-card stack card-in" aria-labelledby="focus-h">
      <div className="spread">
        <p className="focus-label" id="focus-h">
          Armed call
        </p>
        <StatusChip state={state} />
      </div>
      <div className="row" style={{ alignItems: 'flex-end', gap: 16 }}>
        <span className="focus-num" aria-label={`Cue ${call.number}`}>
          {call.number}
        </span>
        <div className="grow">
          {call.kind === 'group' ? <QLinkTag label={call.label} /> : null}
          <p className="focus-title">{call.kind === 'group' ? `${members.length} departments` : model.deptById.get(members[0]?.departmentId)?.name}</p>
          <p className="muted small">{model.segById.get(call.segmentId)?.title}</p>
        </div>
      </div>
      <div aria-label="Call script">
        <p className="focus-label" style={{ marginBottom: 6 }}>Script</p>
        <CallScriptCell {...callScript(call, s.content)} state={state} size="lg" />
      </div>
      <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 8 }}>
        {members.map((m) => {
          const d = model.deptById.get(m.departmentId);
          const st = model.states.get(m.id);
          return (
            <li key={m.id} className="dept-cell" style={deptVars(d)}>
              <DeptIcon icon={d?.icon ?? 'generic'} />
              <div className="grow">
                <div className="spread">
                  <span className="dept-name">{d?.name}</span>
                  <span className="row" style={{ gap: 6 }}>
                    {call.kind === 'group' ? <StatusChip state={st?.state ?? 'pending'} /> : null}
                    {s.session ? <ReadinessChip value={model.readinessOfCue(m.id)} prefix={d?.name ?? 'Crew'} /> : null}
                  </span>
                </div>
                <p className="focus-instr">{m.instruction}</p>
                {st?.reason ? <p className="small" style={{ color: 'var(--warning)' }}>Reason: {st.reason}</p> : null}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="spread" style={{ alignItems: 'flex-end' }}>
        {time.actual ? (
          <div className="countdown">
            <span className="countdown-label">Called at</span>
            <span className="countdown-value">{formatClock(time.actual, tz)}</span>
          </div>
        ) : (
          <div className={`countdown ${stale ? 'is-stale' : ''}`}>
            <span className="countdown-label">
              {stale ? 'Stale · ' : ''}Approx. {untilSec >= 0 ? 'until' : 'past'} est. {formatClock(time.estimated, tz, false)}
            </span>
            <span className="countdown-value">{formatDuration(Math.abs(untilSec))}</span>
          </div>
        )}
        <div className="countdown" style={{ textAlign: 'right' }}>
          <span className="countdown-label">Planned</span>
          <span className="tabular" style={{ fontSize: 20, fontWeight: 700 }}>
            {formatClock(time.planned, tz, false)}
          </span>
        </div>
      </div>
      <div>
        <p className="small muted" style={{ marginBottom: 6 }}>
          Target: <b style={{ color: 'var(--text)' }}>{call.number} — {call.kind === 'group' ? `Q-Link ${call.label}` : members[0]?.instruction}</b>
        </p>
        <div className="call-controls">
          {btn('prepare', '', 'P')}
          {btn('standby', 'call-btn-standby', 'S')}
          {btn('go', 'call-btn-go', 'G')}
          {btn('complete', 'call-btn-complete')}
        </div>
        <div className="secondary-actions">
          {availability(model, call, 'resume').ok ? (
            <button className="btn btn-sm" disabled={disabledAll} onClick={() => onAction('resume', '')}>
              <RotateCcw /> Resume
            </button>
          ) : (
            <button className="btn btn-sm" disabled={disabledAll || !availability(model, call, 'hold').ok} onClick={() => (setReason(''), setReasonFor('hold'))} title={availability(model, call, 'hold').reason}>
              <Hand /> Hold…
            </button>
          )}
          {availability(model, call, 'restore').ok ? (
            <button className="btn btn-sm" disabled={disabledAll} onClick={() => onAction('restore', '')}>
              <RotateCcw /> Restore skipped
            </button>
          ) : (
            <button className="btn btn-sm" disabled={disabledAll || !availability(model, call, 'skip').ok} onClick={() => (setReason(''), setReasonFor('skip'))} title={availability(model, call, 'skip').reason}>
              <SkipForward /> Skip…
            </button>
          )}
          <span className="grow" />
          <button className="btn btn-sm btn-ghost" onClick={onArmNext} aria-keyshortcuts="N">
            Arm next <ChevronRight /> <span className="small muted">N</span>
          </button>
        </div>
        {explain ? (
          <p className="small" style={{ marginTop: 8, color: 'var(--warning)' }} role="note">
            {explain}
          </p>
        ) : null}
      </div>
      {reasonFor ? (
        <Dialog title={`${reasonFor === 'hold' ? 'Hold' : 'Skip'} ${call.number}`} onClose={() => setReasonFor(null)}>
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (reasonFor === 'skip' && !reason.trim()) return;
              onAction(reasonFor, reason.trim());
              setReasonFor(null);
            }}
          >
            <p className="muted">
              {reasonFor === 'hold'
                ? 'Holding keeps the cue in place and remembers its state. Resume returns it without issuing Go.'
                : 'Skipped cues stay in the history and can be restored. Give a reason for the crew log.'}
            </p>
            <label className="field">
              Reason {reasonFor === 'skip' ? '(required)' : '(optional)'}
              <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} data-autofocus aria-invalid={reasonFor === 'skip' && !reason.trim()} />
            </label>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setReasonFor(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" disabled={reasonFor === 'skip' && !reason.trim()}>
                {reasonFor === 'hold' ? 'Hold cue' : 'Skip cue'}
              </button>
            </div>
          </form>
        </Dialog>
      ) : null}
    </section>
  );
}
