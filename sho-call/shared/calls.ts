// "Calls" are what the Director actually issues: either a Q-Link group (several
// department cues bound to one call) or a single independent cue. This module
// derives the ordered call list and aggregate states from show content, so the
// server and all clients agree on what "the next call" is.

import type {
  AggregateReadiness,
  Cue,
  CueGroup,
  CueLiveState,
  CueState,
  Department,
  IconKey,
  ReadinessEntry,
  ShowContent,
} from './types.ts';
import { sortSegments } from './timing.ts';

export interface Call {
  /** "g:<groupId>" or "c:<cueId>" */
  id: string;
  kind: 'group' | 'cue';
  groupId: string | null;
  label: string;
  /** Display cue number for the call (first member's number for groups). */
  number: string;
  segmentId: string;
  cueIds: string[];
  /** Ordering key: offset of the earliest member. */
  offsetSec: number;
}

export function callIdForCue(cue: Cue): string {
  return cue.groupId ? `g:${cue.groupId}` : `c:${cue.id}`;
}

function compareNumbers(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export function deriveCalls(content: Pick<ShowContent, 'segments' | 'cues' | 'groups'>): Call[] {
  const segOrder = new Map(sortSegments(content.segments).map((s, i) => [s.id, i]));
  const groups = new Map<string, CueGroup>(content.groups.map((g) => [g.id, g]));
  const byCall = new Map<string, Cue[]>();
  for (const cue of content.cues) {
    const key = cue.groupId && groups.has(cue.groupId) ? `g:${cue.groupId}` : `c:${cue.id}`;
    const list = byCall.get(key) ?? [];
    list.push(cue);
    byCall.set(key, list);
  }
  const calls: Call[] = [];
  for (const [id, cues] of byCall) {
    cues.sort((a, b) => a.offsetSec - b.offsetSec || a.position - b.position);
    const first = cues[0];
    const group = id.startsWith('g:') ? groups.get(id.slice(2)) : undefined;
    const numbers = cues.map((c) => c.number).filter(Boolean).sort(compareNumbers);
    calls.push({
      id,
      kind: group ? 'group' : 'cue',
      groupId: group?.id ?? null,
      label: group ? group.label : first.instruction,
      number: numbers[0] ?? '',
      // A group belongs to the segment of its earliest member.
      segmentId: first.segmentId,
      cueIds: cues.map((c) => c.id),
      offsetSec: first.offsetSec,
    });
  }
  calls.sort(
    (a, b) =>
      (segOrder.get(a.segmentId) ?? 0) - (segOrder.get(b.segmentId) ?? 0) ||
      a.offsetSec - b.offsetSec ||
      compareNumbers(a.number, b.number),
  );
  return calls;
}

export type CallState = CueState | 'mixed';

/** Aggregate call state of a set of member cue states. */
export function aggregateState(states: CueState[]): CallState {
  if (states.length === 0) return 'pending';
  const unique = new Set(states);
  if (unique.size === 1) return states[0];
  const nonSkipped = states.filter((s) => s !== 'skipped');
  if (nonSkipped.length > 0 && new Set(nonSkipped).size === 1) return nonSkipped[0];
  // All members issued (some complete) reads as called.
  if (states.every((s) => s === 'called' || s === 'complete' || s === 'skipped')) return 'called';
  return 'mixed';
}

export function stateOf(states: Map<string, CueLiveState>, cueId: string): CueState {
  return states.get(cueId)?.state ?? 'pending';
}

export function callState(call: Call, states: Map<string, CueLiveState>): CallState {
  return aggregateState(call.cueIds.map((id) => stateOf(states, id)));
}

export function isCallOpen(call: Call, states: Map<string, CueLiveState>): boolean {
  return call.cueIds.some((id) => {
    const s = stateOf(states, id);
    return s === 'pending' || s === 'prepared' || s === 'standby' || s === 'held';
  });
}

/** The next call still waiting to be issued (in running order). */
export function nextOpenCall(calls: Call[], states: Map<string, CueLiveState>): Call | null {
  return calls.find((c) => isCallOpen(c, states)) ?? null;
}

/** Most recently issued call (by called time). */
export function lastCalled(calls: Call[], states: Map<string, CueLiveState>): Call | null {
  let best: Call | null = null;
  let bestAt = '';
  for (const call of calls) {
    for (const id of call.cueIds) {
      const at = states.get(id)?.calledAt;
      if (at && at > bestAt) {
        bestAt = at;
        best = call;
      }
    }
  }
  return best;
}

/**
 * Readiness of a single cue, from the freshest operator entry. A stale entry
 * (operator disconnected) is never reported as ready.
 */
export function cueReadiness(cueId: string, readiness: ReadinessEntry[]): AggregateReadiness {
  const entries = readiness.filter((r) => r.cueId === cueId);
  if (entries.length === 0) return 'pending';
  if (entries.some((r) => r.fresh && r.status === 'issue')) return 'issue';
  const fresh = entries.filter((r) => r.fresh);
  if (fresh.length === 0) return 'unknown';
  const latest = fresh.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  return latest.status === 'ready' ? 'ready' : latest.status === 'issue' ? 'issue' : 'pending';
}

/** Aggregate readiness across group members: issue > unknown > pending > ready. */
export function aggregateReadiness(values: AggregateReadiness[]): AggregateReadiness {
  if (values.length === 0) return 'pending';
  if (values.includes('issue')) return 'issue';
  if (values.every((v) => v === 'ready')) return 'ready';
  if (values.includes('unknown')) return 'unknown';
  return 'pending';
}

export const STANDARD_DEPARTMENTS: { key: string; name: string; icon: IconKey }[] = [
  { key: 'video', name: 'Video', icon: 'video' },
  { key: 'audio', name: 'Audio', icon: 'audio' },
  { key: 'lighting', name: 'Lighting', icon: 'lighting' },
  { key: 'stage', name: 'Stage Manager', icon: 'stage' },
];

export const ICON_KEYS: IconKey[] = ['director', 'video', 'audio', 'lighting', 'stage', 'foh', 'generic'];

/** Best-effort department matching for imports ("LX", "Sound", "SM"...). */
export function matchDepartment(name: string, departments: Department[]): Department | null {
  const n = name.trim().toLowerCase();
  if (!n) return null;
  const aliases: Record<string, string[]> = {
    video: ['video', 'vid', 'vt', 'vision', 'av', 'graphics', 'gfx', 'imag', 'playback'],
    audio: ['audio', 'sound', 'snd', 'a1', 'mics', 'music'],
    lighting: ['lighting', 'lights', 'light', 'lx', 'lx1', 'ld'],
    stage: ['stage', 'stage manager', 'stage management', 'sm', 'dsm', 'asm', 'stage mgr'],
  };
  const direct = departments.find((d) => d.name.toLowerCase() === n || d.key === n);
  if (direct) return direct;
  for (const [key, words] of Object.entries(aliases)) {
    if (words.includes(n)) {
      const d = departments.find((x) => x.key === key);
      if (d) return d;
    }
  }
  return null;
}

export function slugKey(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 32) || 'dept'
  );
}
