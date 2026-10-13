// Content revisions: publishing from Show Designer/import, Director live edits
// and compensating Undo. Every applied change is one atomic revision with
// before/after values; concurrent edits are rejected via baseRevision checks.

import { all, get, run, tx, type Db } from './db.ts';
import { conflict, forbidden, unprocessable } from './errors.ts';
import { newId, nowIso } from './ids.ts';
import {
  addEvent,
  applyEntityChanges,
  diffContent,
  getShow,
  loadContent,
  normalisePositions,
  writeContent,
} from './store.ts';
import { activeSession, segmentLiveRows, setSegmentDelay } from './sessions.ts';
import { contentSchema, validateContent, type LiveOp } from '../shared/schemas.ts';
import { computeSchedule, formatClock, formatDelta, sortSegments } from '../shared/timing.ts';
import type { ChangePreview, EntityChange, Segment, ShowContent, User } from '../shared/types.ts';

export interface RevisionResult {
  applied: boolean;
  revision: number;
  revisionId: string | null;
  preview: ChangePreview;
  seq?: number;
}

type Kind = 'publish' | 'live_edit' | 'undo' | 'import';

interface DelayChange {
  segmentId: string;
  before: number;
  after: number;
}

function summarise(before: ShowContent, after: ShowContent, changes: EntityChange[], delays: DelayChange[]): string {
  const parts: string[] = [];
  const common = new Set(before.segments.map((s) => s.id).filter((id) => after.segments.some((a) => a.id === id)));
  const beforeOrder = sortSegments(before.segments).map((s) => s.id).filter((id) => common.has(id));
  const orderedAfter = sortSegments(after.segments).filter((s) => common.has(s.id));
  const afterOrder = orderedAfter.map((s) => s.id);
  if (beforeOrder.join() !== afterOrder.join()) {
    // Name the segment that travelled furthest.
    let mover = orderedAfter[0];
    let dist = -1;
    orderedAfter.forEach((s, i) => {
      const d = Math.abs(beforeOrder.indexOf(s.id) - i);
      if (d > dist) { dist = d; mover = s; }
    });
    const prev = orderedAfter[afterOrder.indexOf(mover.id) - 1];
    parts.push(prev ? `${mover.title} moved after ${prev.title}` : `${mover.title} moved to the start`);
  }
  const added = changes.filter((c) => c.before === null);
  const removed = changes.filter((c) => c.after === null);
  const edited = changes.filter((c) => c.before && c.after && !(c.kind === 'segment' && onlyPositionChanged(c)));
  const cueEdits = edited.filter((c) => c.kind === 'cue');
  if (cueEdits.length === 1) parts.push(`${cueEdits[0].label} revised`);
  else if (cueEdits.length > 1) parts.push(`${cueEdits.length} cues revised`);
  const segEdits = edited.filter((c) => c.kind === 'segment');
  for (const s of segEdits.slice(0, 2)) {
    const b = s.before as Segment;
    const a = s.after as Segment;
    if (b.durationSec !== a.durationSec) parts.push(`${a.title} duration ${formatDelta(a.durationSec - b.durationSec)}`);
    else if (b.performer !== a.performer) parts.push(`${a.title}: speaker changed to ${a.performer || 'none'}`);
    else if (b.title !== a.title) parts.push(`${b.title} renamed to ${a.title}`);
    else parts.push(`${a.title} details revised`);
  }
  if (segEdits.length > 2) parts.push(`${segEdits.length - 2} more segments revised`);
  const otherEdits = edited.filter((c) => c.kind === 'group' || c.kind === 'department');
  if (otherEdits.length) parts.push(`${otherEdits.length} group/department setting${otherEdits.length > 1 ? 's' : ''} revised`);
  if (added.length) parts.push(`${added.length} item${added.length > 1 ? 's' : ''} added`);
  if (removed.length) parts.push(`${removed.length} item${removed.length > 1 ? 's' : ''} removed`);
  const shifted = delays.filter((d) => d.after !== d.before);
  if (shifted.length) parts.push(`upcoming estimates ${formatDelta(shifted[0].after - shifted[0].before)}`);
  if (!parts.length) return 'No changes';
  const text = parts.join('; ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function onlyPositionChanged(c: EntityChange): boolean {
  const b = { ...(c.before as Segment), position: 0 };
  const a = { ...(c.after as Segment), position: 0 };
  return JSON.stringify(a) === JSON.stringify(b);
}

function buildPreview(
  db: Db,
  showId: string,
  before: ShowContent,
  after: ShowContent,
  changes: EntityChange[],
  delays: DelayChange[],
  errors: string[],
): ChangePreview {
  const show = getShow(db, showId);
  const session = activeSession(db, showId);
  const liveRows = session ? segmentLiveRows(db, session.id) : [];
  const delayAfter = new Map(delays.map((d) => [d.segmentId, d.after]));
  const now = Date.now();
  const base = { eventDate: show.eventDate, plannedStart: show.plannedStart, timezone: show.timezone, session, cueStates: [], now };
  const sBefore = computeSchedule({ ...base, content: before, segmentLive: liveRows });
  const sAfter = computeSchedule({
    ...base,
    content: after,
    segmentLive: liveRows.map((r) => ({ ...r, delaySec: delayAfter.get(r.segmentId) ?? r.delaySec })),
  });
  const timingNotes: string[] = [];
  for (const seg of sortSegments(after.segments)) {
    const a = sAfter.segments.get(seg.id);
    const b = sBefore.segments.get(seg.id);
    if (!a) continue;
    if (b && Math.abs(a.estStart - b.estStart) >= 1000) {
      timingNotes.push(`${seg.title}: ${formatClock(b.estStart, show.timezone, false)} → ${formatClock(a.estStart, show.timezone, false)} (${formatDelta((a.estStart - b.estStart) / 1000)})`);
    }
    if (a.conflict) timingNotes.push(`${seg.title} is fixed at ${seg.fixedTime} and now conflicts with the preceding schedule.`);
  }
  for (const seg of after.segments) {
    if (seg.fixedTime && delays.length && !delays.some((d) => d.segmentId === seg.id)) {
      timingNotes.push(`${seg.title} has a fixed time (${seg.fixedTime}) and was not shifted.`);
    }
  }

  const affectedCueIds = new Set<string>();
  const affectedDepts = new Set<string>();
  const cueById = new Map([...before.cues, ...after.cues].map((c) => [c.id, c]));
  for (const ch of changes) {
    if (ch.kind === 'cue') {
      affectedCueIds.add(ch.id);
      const c = cueById.get(ch.id);
      if (c) affectedDepts.add(c.departmentId);
    }
    if (ch.kind === 'segment' || ch.kind === 'delay') {
      for (const c of after.cues.filter((x) => x.segmentId === ch.id)) {
        affectedCueIds.add(c.id);
        affectedDepts.add(c.departmentId);
      }
    }
  }
  return {
    summary: summarise(before, after, changes, delays),
    changes,
    affectedCueIds: [...affectedCueIds],
    affectedDepartmentIds: [...affectedDepts],
    timingNotes,
    errors,
  };
}

function checkRevision(db: Db, showId: string, baseRevision: number) {
  const current = getShow(db, showId).revision;
  if (current !== baseRevision) {
    throw conflict('revision_conflict', `The show changed while you were editing (now revision ${current}, you started from ${baseRevision}). Review the latest version and apply again.`, { currentRevision: current });
  }
}

/** Cues that have been issued in the active session cannot be deleted. */
function issuedCueIds(db: Db, sessionId: string): Set<string> {
  return new Set(
    all<{ cue_id: string }>(db, `SELECT cue_id FROM cue_states WHERE session_id = ? AND state IN ('called','complete','skipped')`, sessionId).map((r) => r.cue_id),
  );
}

function commitRevision(
  db: Db,
  showId: string,
  actor: User,
  kind: Kind,
  after: ShowContent,
  changes: EntityChange[],
  delays: DelayChange[],
  summary: string,
  reason: string,
  undoOf: string | null,
): { revision: number; revisionId: string; seq: number } {
  const session = activeSession(db, showId);
  if (changes.some((c) => c.kind !== 'delay')) writeContent(db, showId, after);
  for (const d of delays) {
    setSegmentDelay(db, session!.id, d.segmentId, d.after);
  }
  run(db, 'UPDATE shows SET revision = revision + 1, updated_at = ? WHERE id = ?', nowIso(), showId);
  const revision = getShow(db, showId).revision;
  const revisionId = newId('rev');
  const allChanges: EntityChange[] = [
    ...changes.filter((c) => c.kind !== 'delay'),
    ...delays.map<EntityChange>((d) => ({ kind: 'delay', id: d.segmentId, label: 'Timing shift', before: d.before, after: d.after })),
  ];
  run(
    db,
    `INSERT INTO show_revisions (id, show_id, revision, session_id, kind, actor_id, summary, reason, changes, undo_of, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    revisionId, showId, revision, session?.id ?? null, kind, actor.id, summary, reason, JSON.stringify(allChanges), undoOf, nowIso(),
  );
  if (undoOf) run(db, 'UPDATE show_revisions SET undone_by = ? WHERE id = ?', revisionId, undoOf);
  const seq = addEvent(db, showId, {
    sessionId: session?.id ?? null,
    type: kind === 'undo' ? 'undo' : 'revision',
    actorId: actor.id,
    actorName: actor.name,
    summary: `Revision ${revision}: ${summary}`,
    revisionId,
  });
  return { revision, revisionId, seq };
}

/** Publish a whole content version (Show Designer "Publish"/"Apply Changes"). */
export function publishContent(
  db: Db,
  showId: string,
  actor: User,
  input: { baseRevision: number; content: ShowContent; dryRun: boolean; reason: string },
  kind: Kind = 'publish',
): RevisionResult {
  return tx(db, () => {
    checkRevision(db, showId, input.baseRevision);
    const parsed = contentSchema.safeParse(input.content);
    if (!parsed.success) throw unprocessable('Some fields are invalid.', parsed.error.issues);
    const after = normalisePositions(parsed.data);
    const before = loadContent(db, showId);
    const errors = validateContent(after);
    const session = activeSession(db, showId);
    if (session) {
      const issued = issuedCueIds(db, session.id);
      const afterIds = new Set(after.cues.map((c) => c.id));
      for (const id of issued) {
        if (!afterIds.has(id)) {
          const cue = before.cues.find((c) => c.id === id);
          errors.push(`Cue ${cue?.number ?? id} was already issued in this session and cannot be deleted. Skip it or add a corrective cue instead.`);
        }
      }
    }
    const changes = diffContent(before, after);
    const preview = buildPreview(db, showId, before, after, changes, [], errors);
    if (input.dryRun || errors.length) {
      if (!input.dryRun) throw unprocessable(errors[0], { errors });
      return { applied: false, revision: input.baseRevision, revisionId: null, preview };
    }
    if (changes.length === 0) return { applied: false, revision: input.baseRevision, revisionId: null, preview };
    const r = commitRevision(db, showId, actor, kind, after, changes, [], preview.summary, input.reason, null);
    run(db, 'DELETE FROM show_drafts WHERE show_id = ?', showId);
    return { applied: true, revision: r.revision, revisionId: r.revisionId, preview, seq: r.seq };
  });
}

/** Director live edit: move/edit/shift as one atomic revision. */
export function applyLiveEdit(
  db: Db,
  showId: string,
  actor: User,
  input: { baseRevision: number; ops: LiveOp[]; dryRun: boolean; reason: string },
): RevisionResult {
  return tx(db, () => {
    checkRevision(db, showId, input.baseRevision);
    const session = activeSession(db, showId);
    if (!session) throw conflict('no_session', 'Live edits need an active rehearsal or live session.');
    const before = loadContent(db, showId);
    const liveRows = new Map(segmentLiveRows(db, session.id).map((r) => [r.segmentId, r]));
    const started = (segId: string) => !!liveRows.get(segId)?.actualStart;
    let content: ShowContent = structuredClone(before);
    const delays = new Map<string, DelayChange>();
    const errors: string[] = [];

    for (const op of input.ops) {
      if (op.op === 'moveSegment') {
        const ordered = sortSegments(content.segments);
        const from = ordered.findIndex((s) => s.id === op.segmentId);
        if (from < 0) { errors.push('Segment not found.'); continue; }
        if (started(op.segmentId)) { errors.push(`${ordered[from].title} has already started and cannot be moved.`); continue; }
        const lastStarted = ordered.reduce((acc, s, i) => (started(s.id) ? i : acc), -1);
        const to = Math.min(Math.max(op.toIndex, 0), ordered.length - 1);
        if (to <= lastStarted) { errors.push(`Segments can only move after the segment that is currently running.`); continue; }
        const [seg] = ordered.splice(from, 1);
        ordered.splice(to, 0, seg);
        content.segments = ordered.map((s, i) => ({ ...s, position: i }));
      } else if (op.op === 'editSegment') {
        const seg = content.segments.find((s) => s.id === op.segmentId);
        if (!seg) { errors.push('Segment not found.'); continue; }
        if (op.title !== undefined) seg.title = op.title;
        if (op.performer !== undefined) seg.performer = op.performer;
        if (op.notes !== undefined) seg.notes = op.notes;
        if (op.durationSec !== undefined) {
          if (liveRows.get(seg.id)?.actualEnd) errors.push(`${seg.title} has finished; its duration cannot change.`);
          else seg.durationSec = op.durationSec;
        }
      } else if (op.op === 'editCue') {
        const cue = content.cues.find((c) => c.id === op.cueId);
        if (!cue) { errors.push('Cue not found.'); continue; }
        if (op.instruction !== undefined) cue.instruction = op.instruction;
        if (op.number !== undefined) cue.number = op.number;
        if (op.owner !== undefined) cue.owner = op.owner;
        if (op.offsetSec !== undefined) cue.offsetSec = op.offsetSec;
      } else if (op.op === 'shift') {
        for (const seg of content.segments) {
          if (started(seg.id) || seg.fixedTime) continue;
          const row = liveRows.get(seg.id);
          const prev = delays.get(seg.id);
          const beforeVal = prev?.before ?? row?.delaySec ?? 0;
          const cur = prev?.after ?? row?.delaySec ?? 0;
          delays.set(seg.id, { segmentId: seg.id, before: beforeVal, after: cur + op.deltaSec });
        }
      }
    }
    content = normalisePositions(content);
    errors.push(...validateContent(content));
    const changes = diffContent(before, content);
    const delayList = [...delays.values()].filter((d) => d.before !== d.after);
    const preview = buildPreview(db, showId, before, content, changes, delayList, errors);
    if (input.dryRun) return { applied: false, revision: input.baseRevision, revisionId: null, preview };
    if (errors.length) throw unprocessable(errors[0], { errors });
    if (changes.length === 0 && delayList.length === 0) throw unprocessable('Nothing to apply.');
    const r = commitRevision(db, showId, actor, 'live_edit', content, changes, delayList, preview.summary, input.reason, null);
    return { applied: true, revision: r.revision, revisionId: r.revisionId, preview, seq: r.seq };
  });
}

interface RevisionRow {
  id: string;
  revision: number;
  kind: Kind;
  summary: string;
  changes: string;
  undo_of: string | null;
  undone_by: string | null;
  session_id: string | null;
}

/** Why a revision cannot be undone, or null if it can. */
export function undoBlocker(db: Db, showId: string, rev: RevisionRow, current?: ShowContent): string | null {
  if (rev.undone_by) return 'This revision was already undone.';
  if (rev.kind === 'undo') return 'An undo cannot itself be undone; make a new edit instead.';
  const changes = JSON.parse(rev.changes) as EntityChange[];
  const content = current ?? loadContent(db, showId);
  const session = activeSession(db, showId);
  const liveRows = session ? new Map(segmentLiveRows(db, session.id).map((r) => [r.segmentId, r])) : new Map();
  const listFor: Record<string, { id: string }[]> = { department: content.departments, segment: content.segments, cue: content.cues, group: content.groups };
  for (const ch of changes) {
    if (ch.kind === 'delay') {
      if (!session || rev.session_id !== session.id) return 'Timing shifts can only be undone in the session that applied them.';
      const row = liveRows.get(ch.id);
      if (!row || row.actualStart) return 'Some shifted segments have already started.';
      if (row.delaySec !== ch.after) return 'Timing has changed again since this revision.';
      continue;
    }
    const cur = listFor[ch.kind]?.find((x) => x.id === ch.id) ?? null;
    if (JSON.stringify(cur) !== JSON.stringify(ch.after)) return `${ch.label} has changed since this revision.`;
    if (ch.kind === 'segment' && liveRows.get(ch.id)?.actualStart) {
      const b = ch.before as Segment | null;
      const a = ch.after as Segment | null;
      if (!b || !a || b.position !== a.position) return 'A moved segment has already started.';
    }
  }
  if (session && changes.some((c) => c.kind === 'cue' && c.before === null)) {
    const issued = issuedCueIds(db, session.id);
    if (changes.some((c) => c.kind === 'cue' && c.before === null && issued.has(c.id))) return 'An added cue was already issued.';
  }
  return null;
}

export function undoableRevisionIds(db: Db, showId: string, limit = 15): Set<string> {
  const rows = all<RevisionRow>(db, 'SELECT * FROM show_revisions WHERE show_id = ? ORDER BY revision DESC LIMIT ?', showId, limit);
  const content = loadContent(db, showId);
  const out = new Set<string>();
  for (const r of rows) if (!undoBlocker(db, showId, r, content)) out.add(r.id);
  return out;
}

export function undoRevision(db: Db, showId: string, actor: User, revisionId: string, baseRevision: number): RevisionResult {
  return tx(db, () => {
    checkRevision(db, showId, baseRevision);
    const rev = get<RevisionRow>(db, 'SELECT * FROM show_revisions WHERE id = ? AND show_id = ?', revisionId, showId);
    if (!rev) throw unprocessable('Revision not found.');
    const blocker = undoBlocker(db, showId, rev);
    if (blocker) throw conflict('undo_ineligible', blocker);
    const changes = JSON.parse(rev.changes) as EntityChange[];
    const before = loadContent(db, showId);
    const content = normalisePositions(applyEntityChanges(before, changes.filter((c) => c.kind !== 'delay'), 'before'));
    const errors = validateContent(content);
    if (errors.length) throw unprocessable(errors[0], { errors });
    const contentChanges = diffContent(before, content);
    const delays: DelayChange[] = changes
      .filter((c) => c.kind === 'delay')
      .map((c) => ({ segmentId: c.id, before: c.after as number, after: c.before as number }));
    const preview = buildPreview(db, showId, before, content, contentChanges, delays, []);
    const summary = `Undo revision ${rev.revision} (${rev.summary})`;
    const r = commitRevision(db, showId, actor, 'undo', content, contentChanges, delays, summary, '', rev.id);
    return { applied: true, revision: r.revision, revisionId: r.revisionId, preview: { ...preview, summary }, seq: r.seq };
  });
}

export function assertCanEditContent(role: string) {
  if (role !== 'owner' && role !== 'director') throw forbidden('Only the owner or a Director can change the show.');
}
