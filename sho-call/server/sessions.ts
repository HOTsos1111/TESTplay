// Live/rehearsal sessions and Director cue commands.
//
// Rules enforced here (server-side, never trusted to the client):
// - one active session per show; rehearsal and live sessions keep separate logs
// - only the controlling Director tab (user + client id) may issue calls
// - a Q-Link call is one transaction: every eligible member gets the same
//   action id and timestamp
// - repeating a request with the same idempotency key returns the original
//   result and never issues again; Go on an already-called cue is rejected
// - countdowns never issue cues; only explicit commands do

import { all, get, run, tx, type Db } from './db.ts';
import { conflict, forbidden, notFound, unprocessable } from './errors.ts';
import { newId, nowIso } from './ids.ts';
import { addEvent, getMembership, loadContent } from './store.ts';
import { ACTION_LABEL, transition } from '../shared/cueMachine.ts';
import type { CueActionInput } from '../shared/schemas.ts';
import type { CueLiveState, CueState, LiveSession, Member, Readiness, SegmentLive, User } from '../shared/types.ts';
import { sortSegments } from '../shared/timing.ts';

interface SessionRow {
  id: string;
  show_id: string;
  mode: 'rehearsal' | 'live';
  timing_policy: 'manual' | 'projected';
  status: 'active' | 'ended';
  director_user_id: string;
  control_client_id: string | null;
  started_at: string;
  ended_at: string | null;
}

function sessionFromRow(db: Db, r: SessionRow): LiveSession {
  const director = get<{ name: string }>(db, 'SELECT name FROM users WHERE id = ?', r.director_user_id);
  return {
    id: r.id,
    mode: r.mode,
    timingPolicy: r.timing_policy,
    status: r.status,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    directorUserId: r.director_user_id,
    directorName: director?.name ?? 'Unknown',
    controlClientId: r.control_client_id,
  };
}

export function activeSession(db: Db, showId: string): LiveSession | null {
  const r = get<SessionRow>(db, `SELECT * FROM live_sessions WHERE show_id = ? AND status = 'active'`, showId);
  return r ? sessionFromRow(db, r) : null;
}

export function segmentLiveRows(db: Db, sessionId: string): SegmentLive[] {
  return all<{ segment_id: string; delay_sec: number; actual_start: string | null; actual_end: string | null }>(
    db, 'SELECT * FROM segment_live WHERE session_id = ?', sessionId,
  ).map((r) => ({ segmentId: r.segment_id, delaySec: r.delay_sec, actualStart: r.actual_start, actualEnd: r.actual_end }));
}

export function setSegmentDelay(db: Db, sessionId: string, segmentId: string, delaySec: number) {
  run(
    db,
    `INSERT INTO segment_live (session_id, segment_id, delay_sec) VALUES (?, ?, ?)
     ON CONFLICT (session_id, segment_id) DO UPDATE SET delay_sec = excluded.delay_sec`,
    sessionId, segmentId, delaySec,
  );
}

export function cueStateRows(db: Db, sessionId: string): CueLiveState[] {
  return all<{ cue_id: string; state: CueState; prev_state: CueState | null; reason: string; called_at: string | null; completed_at: string | null; updated_at: string; last_action_id: string | null }>(
    db, 'SELECT * FROM cue_states WHERE session_id = ?', sessionId,
  ).map((r) => ({
    cueId: r.cue_id,
    state: r.state,
    prevState: r.prev_state,
    reason: r.reason,
    calledAt: r.called_at,
    completedAt: r.completed_at,
    updatedAt: r.updated_at,
    lastActionId: r.last_action_id,
  }));
}

const canDirect = (m: Member) => m.role === 'owner' || m.role === 'director';

export function startSession(
  db: Db,
  showId: string,
  actor: User,
  member: Member,
  input: { mode: 'rehearsal' | 'live'; timingPolicy: 'manual' | 'projected'; directorUserId: string; clientId: string },
): { session: LiveSession; seq: number } {
  if (!canDirect(member)) throw forbidden('Only the owner or a Director can start a session.');
  return tx(db, () => {
    if (activeSession(db, showId)) throw conflict('session_active', 'A session is already running for this show.');
    const director = getMembership(db, showId, input.directorUserId);
    if (!director || !canDirect(director)) throw unprocessable('The selected Director must be a show owner or Director.');
    const id = newId('ses');
    const now = nowIso();
    run(
      db,
      `INSERT INTO live_sessions (id, show_id, mode, timing_policy, status, director_user_id, control_client_id, started_at, started_by)
       VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
      id, showId, input.mode, input.timingPolicy, input.directorUserId, input.directorUserId === actor.id ? input.clientId : null, now, actor.id,
    );
    for (const seg of loadContent(db, showId).segments) setSegmentDelay(db, id, seg.id, 0);
    const label = input.mode === 'live' ? 'Live session' : 'Rehearsal';
    const seq = addEvent(db, showId, {
      sessionId: id,
      type: 'session',
      actorId: actor.id,
      actorName: actor.name,
      summary: `${label} started (${input.timingPolicy === 'projected' ? 'estimated automatic projection' : 'manual timing shifts'}); ${director.name} has Director control`,
    });
    return { session: activeSession(db, showId)!, seq };
  });
}

export function endSession(db: Db, showId: string, actor: User, member: Member): number {
  return tx(db, () => {
    const session = activeSession(db, showId);
    if (!session) throw conflict('no_session', 'No session is running.');
    if (!(member.role === 'owner' || session.directorUserId === actor.id)) throw forbidden('Only the owner or the controlling Director can end the session.');
    run(db, `UPDATE live_sessions SET status = 'ended', ended_at = ?, control_client_id = NULL WHERE id = ?`, nowIso(), session.id);
    return addEvent(db, showId, {
      sessionId: session.id,
      type: 'session',
      actorId: actor.id,
      actorName: actor.name,
      summary: `${session.mode === 'live' ? 'Live session' : 'Rehearsal'} ended`,
    });
  });
}

export function takeControl(db: Db, showId: string, actor: User, member: Member, clientId: string): number {
  if (!canDirect(member)) throw forbidden('Only the owner or a Director can take calling control.');
  return tx(db, () => {
    const session = activeSession(db, showId);
    if (!session) throw conflict('no_session', 'No session is running.');
    const from = session.directorName;
    run(db, 'UPDATE live_sessions SET director_user_id = ?, control_client_id = ? WHERE id = ?', actor.id, clientId, session.id);
    return addEvent(db, showId, {
      sessionId: session.id,
      type: 'control',
      actorId: actor.id,
      actorName: actor.name,
      summary: session.directorUserId === actor.id ? `${actor.name} moved Director control to another console` : `Director control transferred from ${from} to ${actor.name}`,
    });
  });
}

export interface CueActionResult {
  actionId: string;
  at: string;
  action: string;
  applied: string[];
  unchanged: { cueId: string; reason: string }[];
  /** True when this response replays an earlier accepted request. */
  duplicate: boolean;
  seq: number | null;
}

export function cueAction(db: Db, showId: string, actor: User, member: Member, input: CueActionInput): CueActionResult {
  return tx(db, () => {
    const session = activeSession(db, showId);
    if (!session) throw conflict('no_session', 'No rehearsal or live session is running.');

    // Replay: the same request (same idempotency key) returns the original outcome.
    const prior = get<{ actor_id: string; target_kind: string; target_id: string; action: string; result: string }>(
      db, 'SELECT * FROM cue_actions WHERE session_id = ? AND idempotency_key = ?', session.id, input.idempotencyKey,
    );
    if (prior) {
      if (prior.actor_id !== actor.id || prior.target_id !== input.target.id || prior.action !== input.action) {
        throw conflict('idempotency_mismatch', 'This request id was already used for a different command.');
      }
      return { ...(JSON.parse(prior.result) as CueActionResult), duplicate: true, seq: null };
    }

    if (!canDirect(member)) throw forbidden('Only the Director can call cues.');
    if (session.directorUserId !== actor.id) throw forbidden(`${session.directorName} has Director control. Take control to call cues.`);
    if (session.controlClientId !== input.clientId) {
      throw forbidden('Another console holds Director control for this session. Take control here to call cues.');
    }
    if (input.action === 'skip' && !input.reason.trim()) throw unprocessable('Give a reason for skipping.');

    const content = loadContent(db, showId);
    let cueIds: string[];
    let targetLabel: string;
    if (input.target.kind === 'group') {
      const group = content.groups.find((g) => g.id === input.target.id);
      if (!group) throw notFound('Q-Link group not found.');
      cueIds = content.cues.filter((c) => c.groupId === group.id).map((c) => c.id);
      targetLabel = `Q-Link ${group.label}`;
    } else {
      const cue = content.cues.find((c) => c.id === input.target.id);
      if (!cue) throw notFound('Cue not found.');
      cueIds = [cue.id];
      const dept = content.departments.find((d) => d.id === cue.departmentId);
      targetLabel = `${dept?.name ?? ''} ${cue.number}`.trim();
    }
    if (cueIds.length === 0) throw unprocessable('This Q-Link group has no cues.');

    const current = new Map(cueStateRows(db, session.id).map((s) => [s.cueId, s]));
    const plans: { cueId: string; state: CueState; prevState: CueState | null; prior: CueState }[] = [];
    const unchanged: { cueId: string; reason: string }[] = [];
    for (const cueId of cueIds) {
      const cur = current.get(cueId);
      const t = transition(cur?.state ?? 'pending', cur?.prevState ?? null, input.action);
      if (t.ok) plans.push({ cueId, state: t.state, prevState: t.prevState, prior: cur?.state ?? 'pending' });
      else unchanged.push({ cueId, reason: t.reason });
    }
    if (plans.length === 0) throw conflict('invalid_transition', unchanged[0].reason, { unchanged });

    const actionId = newId('act');
    const at = nowIso();
    for (const p of plans) {
      const cur = current.get(p.cueId);
      run(
        db,
        `INSERT INTO cue_states (session_id, cue_id, state, prev_state, reason, called_at, completed_at, last_action_id, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (session_id, cue_id) DO UPDATE SET state = excluded.state, prev_state = excluded.prev_state, reason = excluded.reason,
           called_at = excluded.called_at, completed_at = excluded.completed_at, last_action_id = excluded.last_action_id, updated_at = excluded.updated_at`,
        session.id,
        p.cueId,
        p.state,
        p.prevState,
        input.action === 'hold' || input.action === 'skip' ? input.reason : '',
        // Called/completed timestamps are written once and never rewritten.
        input.action === 'go' ? at : cur?.calledAt ?? null,
        input.action === 'complete' ? at : cur?.completedAt ?? null,
        actionId,
        at,
      );
    }
    if (input.action === 'go') markSegmentStarted(db, session.id, content, cueIds, at);

    const result: CueActionResult = { actionId, at, action: input.action, applied: plans.map((p) => p.cueId), unchanged, duplicate: false, seq: null };
    run(
      db,
      `INSERT INTO cue_actions (id, session_id, idempotency_key, actor_id, action, target_kind, target_id, cue_ids, reason, result, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      actionId, session.id, input.idempotencyKey, actor.id, input.action, input.target.kind, input.target.id, JSON.stringify(cueIds), input.reason, JSON.stringify(result), at,
    );
    const partial = unchanged.length ? ` (${plans.length} of ${cueIds.length} cues; others unchanged)` : '';
    const reason = input.reason.trim() ? ` — ${input.reason.trim()}` : '';
    const seq = addEvent(db, showId, {
      sessionId: session.id,
      type: 'cue',
      actorId: actor.id,
      actorName: actor.name,
      summary: `${ACTION_LABEL[input.action]}: ${targetLabel}${partial}${reason}`,
    });
    return { ...result, seq };
  });
}

/** A Go on a segment's cue marks that segment as started and closes earlier ones. */
function markSegmentStarted(db: Db, sessionId: string, content: ReturnType<typeof loadContent>, cueIds: string[], at: string) {
  const ordered = sortSegments(content.segments);
  const segIds = new Set(content.cues.filter((c) => cueIds.includes(c.id)).map((c) => c.segmentId));
  const idx = Math.max(...ordered.map((s, i) => (segIds.has(s.id) ? i : -1)));
  if (idx < 0) return;
  const rows = new Map(segmentLiveRows(db, sessionId).map((r) => [r.segmentId, r]));
  const upsert = (segmentId: string, start: string | null, end: string | null) =>
    run(
      db,
      `INSERT INTO segment_live (session_id, segment_id, delay_sec, actual_start, actual_end) VALUES (?, ?, 0, ?, ?)
       ON CONFLICT (session_id, segment_id) DO UPDATE SET actual_start = excluded.actual_start, actual_end = excluded.actual_end`,
      sessionId, segmentId, start, end,
    );
  for (let i = 0; i < idx; i++) {
    const r = rows.get(ordered[i].id);
    if (!r?.actualStart) upsert(ordered[i].id, at, at);
    else if (!r.actualEnd) upsert(ordered[i].id, r.actualStart, at);
  }
  const cur = rows.get(ordered[idx].id);
  if (!cur?.actualStart) upsert(ordered[idx].id, at, null);
}

export function setReadiness(
  db: Db,
  showId: string,
  actor: User,
  member: Member,
  input: { cueId: string; status: Readiness; note: string },
): number {
  return tx(db, () => {
    const session = activeSession(db, showId);
    if (!session) throw conflict('no_session', 'Readiness can be reported once a session is running.');
    const content = loadContent(db, showId);
    const cue = content.cues.find((c) => c.id === input.cueId);
    if (!cue) throw notFound('Cue not found.');
    if (member.role !== 'operator' || !member.operateDepartments.includes(cue.departmentId)) {
      throw forbidden('You can only report readiness for cues in departments you operate.');
    }
    run(
      db,
      `INSERT INTO operator_readiness (session_id, cue_id, user_id, status, note, updated_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (session_id, cue_id, user_id) DO UPDATE SET status = excluded.status, note = excluded.note, updated_at = excluded.updated_at`,
      session.id, cue.id, actor.id, input.status, input.note, nowIso(),
    );
    const dept = content.departments.find((d) => d.id === cue.departmentId);
    const label = input.status === 'ready' ? 'Ready' : input.status === 'issue' ? 'Issue' : 'Not ready';
    return addEvent(db, showId, {
      sessionId: session.id,
      type: 'readiness',
      actorId: actor.id,
      actorName: actor.name,
      summary: `${label}: ${dept?.name ?? ''} ${cue.number}${input.note ? ` — ${input.note}` : ''}`,
    });
  });
}

export function readinessRows(db: Db, sessionId: string) {
  return all<{ cue_id: string; user_id: string; name: string; status: Readiness; note: string; updated_at: string }>(
    db,
    'SELECT r.*, u.name FROM operator_readiness r JOIN users u ON u.id = r.user_id WHERE r.session_id = ?',
    sessionId,
  );
}

/** Look up how an earlier command ended, for a client whose response was lost. */
export function findAction(db: Db, showId: string, idempotencyKey: string): CueActionResult | null {
  const session = activeSession(db, showId);
  if (!session) return null;
  const r = get<{ result: string }>(db, 'SELECT result FROM cue_actions WHERE session_id = ? AND idempotency_key = ?', session.id, idempotencyKey);
  return r ? { ...(JSON.parse(r.result) as CueActionResult), duplicate: true, seq: null } : null;
}
