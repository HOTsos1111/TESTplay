// Data access for shows, membership, content and the activity log.

import { all, get, run, type Db } from './db.ts';
import { newId, nowIso } from './ids.ts';
import { notFound } from './errors.ts';
import type {
  Cue,
  CueGroup,
  Department,
  EntityChange,
  Member,
  Role,
  Segment,
  ShowContent,
  ShowDetails,
  ShowSummary,
} from '../shared/types.ts';
import { sortSegments } from '../shared/timing.ts';

interface ShowRow {
  id: string;
  title: string;
  event_date: string;
  timezone: string;
  planned_start: string;
  venue: string;
  notes: string;
  is_template: number;
  revision: number;
  seq: number;
  updated_at: string;
}

export function showFromRow(r: ShowRow): ShowDetails {
  return {
    id: r.id,
    title: r.title,
    eventDate: r.event_date,
    timezone: r.timezone,
    plannedStart: r.planned_start,
    venue: r.venue,
    notes: r.notes,
    isTemplate: !!r.is_template,
    revision: r.revision,
    updatedAt: r.updated_at,
  };
}

export function getShowRow(db: Db, showId: string): ShowRow {
  const row = get<ShowRow>(db, 'SELECT * FROM shows WHERE id = ?', showId);
  if (!row) throw notFound('Show not found.');
  return row;
}

export function getShow(db: Db, showId: string): ShowDetails {
  return showFromRow(getShowRow(db, showId));
}

export function createShow(
  db: Db,
  userId: string,
  d: { title: string; eventDate: string; timezone: string; plannedStart: string; venue: string; notes: string; isTemplate?: boolean },
): string {
  const id = newId('shw');
  const now = nowIso();
  run(
    db,
    `INSERT INTO shows (id, title, event_date, timezone, planned_start, venue, notes, is_template, revision, seq, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)`,
    id, d.title, d.eventDate, d.timezone, d.plannedStart, d.venue, d.notes, d.isTemplate ? 1 : 0, userId, now, now,
  );
  run(db, `INSERT INTO show_members (show_id, user_id, role, operate_departments, visible_departments) VALUES (?, ?, 'owner', '[]', NULL)`, id, userId);
  return id;
}

export function updateShowDetails(db: Db, showId: string, d: { title: string; eventDate: string; timezone: string; plannedStart: string; venue: string; notes: string }) {
  run(
    db,
    'UPDATE shows SET title = ?, event_date = ?, timezone = ?, planned_start = ?, venue = ?, notes = ?, updated_at = ? WHERE id = ?',
    d.title, d.eventDate, d.timezone, d.plannedStart, d.venue, d.notes, nowIso(), showId,
  );
}

interface MemberRow {
  user_id: string;
  name: string;
  email: string;
  role: Role;
  operate_departments: string;
  visible_departments: string | null;
}

function memberFromRow(r: MemberRow): Member {
  return {
    userId: r.user_id,
    name: r.name,
    email: r.email,
    role: r.role,
    operateDepartments: JSON.parse(r.operate_departments) as string[],
    visibleDepartments: r.visible_departments ? (JSON.parse(r.visible_departments) as string[]) : null,
  };
}

const MEMBER_SQL = `SELECT m.user_id, u.name, u.email, m.role, m.operate_departments, m.visible_departments
  FROM show_members m JOIN users u ON u.id = m.user_id`;

export function getMembership(db: Db, showId: string, userId: string): Member | null {
  const r = get<MemberRow>(db, `${MEMBER_SQL} WHERE m.show_id = ? AND m.user_id = ?`, showId, userId);
  return r ? memberFromRow(r) : null;
}

export function listMembers(db: Db, showId: string): Member[] {
  return all<MemberRow>(db, `${MEMBER_SQL} WHERE m.show_id = ? ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'director' THEN 1 WHEN 'operator' THEN 2 ELSE 3 END, u.name`, showId).map(memberFromRow);
}

export function upsertMember(db: Db, showId: string, userId: string, role: Role, operate: string[], visible: string[] | null) {
  run(
    db,
    `INSERT INTO show_members (show_id, user_id, role, operate_departments, visible_departments) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (show_id, user_id) DO UPDATE SET role = excluded.role, operate_departments = excluded.operate_departments, visible_departments = excluded.visible_departments`,
    showId, userId, role, JSON.stringify(operate), visible ? JSON.stringify(visible) : null,
  );
}

export function removeMember(db: Db, showId: string, userId: string) {
  run(db, 'DELETE FROM show_members WHERE show_id = ? AND user_id = ?', showId, userId);
}

export function listShowsForUser(db: Db, userId: string): ShowSummary[] {
  const rows = all<ShowRow & { role: Role; session_mode: string | null; ended_count: number }>(
    db,
    `SELECT s.*, m.role,
       (SELECT mode FROM live_sessions l WHERE l.show_id = s.id AND l.status = 'active') AS session_mode,
       (SELECT COUNT(*) FROM live_sessions l WHERE l.show_id = s.id AND l.status = 'ended' AND l.mode = 'live') AS ended_count
     FROM shows s JOIN show_members m ON m.show_id = s.id AND m.user_id = ?
     ORDER BY s.is_template, s.event_date DESC, s.title`,
    userId,
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    eventDate: r.event_date,
    venue: r.venue,
    isTemplate: !!r.is_template,
    revision: r.revision,
    role: r.role,
    state: r.session_mode === 'live' ? 'live' : r.session_mode === 'rehearsal' ? 'rehearsal' : r.ended_count > 0 ? 'ended' : 'draft',
    updatedAt: r.updated_at,
  }));
}

// ---------------------------------------------------------------- content

export function loadContent(db: Db, showId: string): ShowContent {
  const departments = all<{ id: string; key: string; name: string; icon: Department['icon']; sort: number }>(
    db, 'SELECT id, key, name, icon, sort FROM departments WHERE show_id = ? ORDER BY sort, name', showId,
  );
  const segments = all<{ id: string; position: number; title: string; performer: string; duration_sec: number; fixed_time: string | null; notes: string }>(
    db, 'SELECT * FROM segments WHERE show_id = ? ORDER BY position', showId,
  ).map<Segment>((s) => ({ id: s.id, position: s.position, title: s.title, performer: s.performer, durationSec: s.duration_sec, fixedTime: s.fixed_time, notes: s.notes }));
  const cues = all<{ id: string; segment_id: string; position: number; number: string; department_id: string; instruction: string; owner: string; offset_sec: number; duration_sec: number; group_id: string | null; target: string | null; standby_script: string; go_script: string }>(
    db, 'SELECT * FROM cues WHERE show_id = ? ORDER BY position', showId,
  ).map<Cue>((c) => ({
    id: c.id,
    segmentId: c.segment_id,
    position: c.position,
    number: c.number,
    departmentId: c.department_id,
    instruction: c.instruction,
    owner: c.owner,
    offsetSec: c.offset_sec,
    durationSec: c.duration_sec,
    groupId: c.group_id,
    target: c.target ? (JSON.parse(c.target) as Cue['target']) : null,
    standbyScript: c.standby_script,
    goScript: c.go_script,
  }));
  const groups = all<{ id: string; label: string; segment_id: string | null; standby_script: string; go_script: string }>(db, 'SELECT * FROM cue_groups WHERE show_id = ?', showId)
    .map<CueGroup>((g) => ({ id: g.id, label: g.label, segmentId: g.segment_id, standbyScript: g.standby_script, goScript: g.go_script }));
  return { departments, segments, cues, groups };
}

/** Replace all content rows of a show. Call inside a transaction. */
export function writeContent(db: Db, showId: string, content: ShowContent) {
  for (const t of ['cues', 'cue_groups', 'segments', 'departments']) run(db, `DELETE FROM ${t} WHERE show_id = ?`, showId);
  for (const d of content.departments) {
    run(db, 'INSERT INTO departments (id, show_id, key, name, icon, sort) VALUES (?, ?, ?, ?, ?, ?)', d.id, showId, d.key, d.name, d.icon, d.sort);
  }
  for (const s of content.segments) {
    run(db, 'INSERT INTO segments (id, show_id, position, title, performer, duration_sec, fixed_time, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      s.id, showId, s.position, s.title, s.performer, s.durationSec, s.fixedTime, s.notes);
  }
  for (const g of content.groups) {
    run(db, 'INSERT INTO cue_groups (id, show_id, label, segment_id, standby_script, go_script) VALUES (?, ?, ?, ?, ?, ?)', g.id, showId, g.label, g.segmentId, g.standbyScript ?? '', g.goScript ?? '');
  }
  for (const c of content.cues) {
    run(db, `INSERT INTO cues (id, show_id, segment_id, position, number, department_id, instruction, owner, offset_sec, duration_sec, group_id, target, standby_script, go_script)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      c.id, showId, c.segmentId, c.position, c.number, c.departmentId, c.instruction, c.owner, c.offsetSec, c.durationSec, c.groupId, c.target ? JSON.stringify(c.target) : null, c.standbyScript ?? '', c.goScript ?? '');
  }
}

/** Normalise positions so they are 0..n-1 in current order. */
export function normalisePositions(content: ShowContent): ShowContent {
  const segments = sortSegments(content.segments).map((s, i) => ({ ...s, position: i }));
  const cues = [...content.cues].sort((a, b) => a.position - b.position).map((c, i) => ({ ...c, position: i }));
  // Drop empty groups; they would otherwise linger invisibly.
  const used = new Set(cues.map((c) => c.groupId).filter(Boolean));
  const groups = content.groups.filter((g) => used.has(g.id));
  return { ...content, segments, cues, groups };
}

const stable = (v: unknown) => JSON.stringify(v);

/** Entity-level diff of two content versions, by stable id. */
export function diffContent(before: ShowContent, after: ShowContent): EntityChange[] {
  const changes: EntityChange[] = [];
  const kinds: [EntityChange['kind'], keyof ShowContent, (x: never) => string][] = [
    ['department', 'departments', (d: Department) => d.name],
    ['segment', 'segments', (s: Segment) => s.title],
    ['group', 'groups', (g: CueGroup) => `Q-Link ${g.label}`],
    ['cue', 'cues', (c: Cue) => `Cue ${c.number}`],
  ];
  for (const [kind, key, label] of kinds) {
    const b = new Map((before[key] as { id: string }[]).map((x) => [x.id, x]));
    const a = new Map((after[key] as { id: string }[]).map((x) => [x.id, x]));
    for (const [id, item] of a) {
      const prev = b.get(id);
      if (!prev) changes.push({ kind, id, label: label(item as never), before: null, after: item });
      else if (stable(prev) !== stable(item)) changes.push({ kind, id, label: label(item as never), before: prev, after: item });
    }
    for (const [id, item] of b) {
      if (!a.has(id)) changes.push({ kind, id, label: label(item as never), before: item, after: null });
    }
  }
  return changes;
}

/** Apply entity values from a change list (direction picks before/after). */
export function applyEntityChanges(content: ShowContent, changes: EntityChange[], direction: 'before' | 'after'): ShowContent {
  const next: ShowContent = {
    departments: [...content.departments],
    segments: [...content.segments],
    cues: [...content.cues],
    groups: [...content.groups],
  };
  const keyFor: Record<string, keyof ShowContent> = { department: 'departments', segment: 'segments', cue: 'cues', group: 'groups' };
  for (const ch of changes) {
    const key = keyFor[ch.kind];
    if (!key) continue;
    const list = next[key] as { id: string }[];
    const value = ch[direction] as { id: string } | null;
    const idx = list.findIndex((x) => x.id === ch.id);
    if (value === null) {
      if (idx >= 0) list.splice(idx, 1);
    } else if (idx >= 0) list[idx] = value;
    else list.push(value);
  }
  return next;
}

// ---------------------------------------------------------------- events

export function bumpSeq(db: Db, showId: string): number {
  run(db, 'UPDATE shows SET seq = seq + 1, updated_at = ? WHERE id = ?', nowIso(), showId);
  return get<{ seq: number }>(db, 'SELECT seq FROM shows WHERE id = ?', showId)!.seq;
}

export function addEvent(
  db: Db,
  showId: string,
  e: { sessionId: string | null; type: string; actorId: string | null; actorName: string; summary: string; revisionId?: string | null },
): number {
  const seq = bumpSeq(db, showId);
  const revision = get<{ revision: number }>(db, 'SELECT revision FROM shows WHERE id = ?', showId)!.revision;
  run(
    db,
    `INSERT INTO activity_events (show_id, seq, session_id, type, actor_id, actor_name, summary, revision, revision_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    showId, seq, e.sessionId, e.type, e.actorId, e.actorName, e.summary, revision, e.revisionId ?? null, nowIso(),
  );
  return seq;
}

/** Copy content with fresh ids (for duplicates and templates). */
export function cloneContent(src: ShowContent): ShowContent {
  const map = new Map<string, string>();
  const fresh = (prefix: string, id: string) => {
    const n = newId(prefix);
    map.set(id, n);
    return n;
  };
  const departments = src.departments.map((d) => ({ ...d, id: fresh('dep', d.id) }));
  const segments = src.segments.map((s) => ({ ...s, id: fresh('seg', s.id) }));
  const groups = src.groups.map((g) => ({ ...g, id: fresh('grp', g.id), segmentId: g.segmentId ? map.get(g.segmentId) ?? null : null }));
  const cues = src.cues.map((c) => ({
    ...c,
    id: newId('cue'),
    segmentId: map.get(c.segmentId)!,
    departmentId: map.get(c.departmentId)!,
    groupId: c.groupId ? map.get(c.groupId) ?? null : null,
  }));
  return { departments, segments, cues, groups };
}
