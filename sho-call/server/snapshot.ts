// Builds the authoritative, permission-filtered show state sent to a client.
// A department filter on the client never widens what this returns: cues in
// departments a member may not see are removed here, on the server.

import { all, type Db } from './db.ts';
import { getMembership, getShowRow, listMembers, loadContent, showFromRow } from './store.ts';
import { activeSession, cueStateRows, readinessRows, segmentLiveRows } from './sessions.ts';
import { undoableRevisionIds } from './revisions.ts';
import { notFound } from './errors.ts';
import type { ActivityEvent, Member, Presence, Snapshot, User } from '../shared/types.ts';

export interface PresenceSource {
  presence(showId: string): Presence[];
  isFresh(showId: string, userId: string): boolean;
}

export function visibleDepartmentIds(member: Member, allIds: string[]): Set<string> {
  if (member.role === 'owner' || member.role === 'director' || member.visibleDepartments === null) return new Set(allIds);
  // Operators always see the departments they operate.
  return new Set(allIds.filter((id) => member.visibleDepartments!.includes(id) || member.operateDepartments.includes(id)));
}

export function buildSnapshot(db: Db, showId: string, user: User, presence: PresenceSource): Snapshot {
  const me = getMembership(db, showId, user.id);
  if (!me) throw notFound('Show not found or you are not a member.');
  const row = getShowRow(db, showId);
  const full = loadContent(db, showId);
  const visible = visibleDepartmentIds(me, full.departments.map((d) => d.id));
  const cues = full.cues.filter((c) => visible.has(c.departmentId));
  const cueIds = new Set(cues.map((c) => c.id));
  const groupIds = new Set(cues.map((c) => c.groupId).filter(Boolean));
  const content = {
    departments: full.departments.filter((d) => visible.has(d.id)),
    segments: full.segments,
    cues,
    groups: full.groups.filter((g) => groupIds.has(g.id)),
  };
  const session = activeSession(db, showId);
  const cueStates = session ? cueStateRows(db, session.id).filter((s) => cueIds.has(s.cueId)) : [];
  const readiness = session
    ? readinessRows(db, session.id)
        .filter((r) => cueIds.has(r.cue_id))
        .map((r) => ({
          cueId: r.cue_id,
          userId: r.user_id,
          userName: r.name,
          status: r.status,
          note: r.note,
          updatedAt: r.updated_at,
          fresh: presence.isFresh(showId, r.user_id),
        }))
    : [];
  const undoable = me.role === 'owner' || me.role === 'director' ? undoableRevisionIds(db, showId) : new Set<string>();
  const events = all<{ seq: number; session_id: string | null; type: string; actor_name: string; summary: string; revision: number; revision_id: string | null; created_at: string }>(
    db,
    `SELECT * FROM activity_events WHERE show_id = ? AND (session_id IS NULL OR session_id = ?)
     ORDER BY seq DESC LIMIT 150`,
    showId,
    session?.id ?? '',
  );
  const activity: ActivityEvent[] = events.map((e) => ({
    seq: e.seq,
    sessionId: e.session_id,
    type: e.type,
    actorName: e.actor_name,
    summary: e.summary,
    revision: e.revision,
    createdAt: e.created_at,
    undoableRevisionId: e.revision_id && undoable.has(e.revision_id) ? e.revision_id : null,
  }));
  const members = me.role === 'owner' || me.role === 'director' ? listMembers(db, showId) : [];
  return {
    seq: row.seq,
    serverNow: new Date().toISOString(),
    show: showFromRow(row),
    me,
    members,
    content,
    session,
    cueStates,
    segmentLive: session ? segmentLiveRows(db, session.id) : [],
    readiness,
    presence: presence.presence(showId),
    activity,
  };
}
