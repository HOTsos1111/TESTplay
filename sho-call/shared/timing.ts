// Timezone-safe time helpers and the planned/live schedule projection.
//
// All instants are UTC epoch milliseconds. Local show times ("10:05") are only
// ever converted through the show's IANA timezone. Elapsed durations are kept in
// seconds and never mixed with wall-clock times. Nothing here issues a cue: the
// schedule only produces estimates.

import type { Cue, CueLiveState, Segment, SegmentLive, ShowContent, TimingPolicy } from './types.ts';

const formatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(tz, f);
  }
  return f;
}

export function isValidTimezone(tz: string): boolean {
  try {
    partsFormatter(tz);
    return true;
  } catch {
    return false;
  }
}

function zonedParts(utcMs: number, tz: string) {
  const out: Record<string, number> = {};
  for (const p of partsFormatter(tz).formatToParts(new Date(utcMs))) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return out as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

function offsetMs(utcMs: number, tz: string): number {
  const p = zonedParts(utcMs, tz);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(utcMs / 1000) * 1000;
}

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseClock(text: string): { h: number; m: number; s: number } | null {
  const m = TIME_RE.exec(text.trim());
  if (!m) return null;
  return { h: Number(m[1]), m: Number(m[2]), s: Number(m[3] ?? 0) };
}

/** Convert a local date + "HH:MM[:SS]" in an IANA zone to a UTC instant. */
export function zonedToUtcMs(date: string, time: string, tz: string): number {
  const d = DATE_RE.exec(date);
  const t = parseClock(time);
  if (!d || !t) throw new Error(`Invalid local date/time: ${date} ${time}`);
  const guess = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), t.h, t.m, t.s);
  const off1 = offsetMs(guess, tz);
  let utc = guess - off1;
  const off2 = offsetMs(utc, tz);
  if (off2 !== off1) utc = guess - off2;
  return utc;
}

export function formatClock(utcMs: number, tz: string, withSeconds = true): string {
  const p = zonedParts(utcMs, tz);
  const hh = String(p.hour).padStart(2, '0');
  const mm = String(p.minute).padStart(2, '0');
  return withSeconds ? `${hh}:${mm}:${String(p.second).padStart(2, '0')}` : `${hh}:${mm}`;
}

/** "05:00", "1:02:03"; negative values are prefixed with "-". */
export function formatDuration(totalSec: number): string {
  const sign = totalSec < 0 ? '-' : '';
  let s = Math.abs(Math.round(totalSec));
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${sign}${h}:${mm}:${ss}` : `${sign}${mm}:${ss}`;
}

/** Human duration for planning views: "15 min", "4 min 30 s", "1 h 5 min". */
export function formatMinutes(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h) return `${h} h${m ? ` ${m} min` : ''}`;
  if (r) return m ? `${m} min ${r} s` : `${r} s`;
  return `${m} min`;
}

/** "+05:00" / "-02:30" / "on time" */
export function formatDelta(sec: number): string {
  if (Math.abs(sec) < 1) return 'on time';
  return `${sec > 0 ? '+' : '-'}${formatDuration(Math.abs(sec))}`;
}

/** Parse "5", "05:00", "1:02:03", "90s", "+5m" into seconds. */
export function parseDuration(text: string): number | null {
  const t = text.trim().replace(/^\+/, '');
  if (!t) return null;
  let m = /^(\d+(?:\.\d+)?)\s*(s|sec|secs|m|min|mins|h|hr|hrs)?$/i.exec(t);
  if (m) {
    const n = Number(m[1]);
    const unit = (m[2] ?? 'm').toLowerCase();
    const mult = unit.startsWith('h') ? 3600 : unit.startsWith('s') ? 1 : 60;
    return Math.round(n * mult);
  }
  m = /^(\d+):(\d{1,2})(?::(\d{1,2}))?$/.exec(t);
  if (m) {
    if (m[3] !== undefined) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
    return Number(m[1]) * 60 + Number(m[2]);
  }
  return null;
}

export interface SegmentTiming {
  segmentId: string;
  plannedStart: number;
  plannedEnd: number;
  estStart: number;
  estEnd: number;
  delaySec: number;
  /** estStart - plannedStart, seconds. */
  driftSec: number;
  overrunSec: number;
  fixed: boolean;
  /** A fixed-time item that the preceding schedule now overlaps. */
  conflict: boolean;
  status: 'upcoming' | 'running' | 'done';
}

export interface CueTiming {
  cueId: string;
  planned: number;
  estimated: number;
  /** Actual call time; never changes retroactively. */
  actual: number | null;
}

export interface Schedule {
  segments: Map<string, SegmentTiming>;
  cues: Map<string, CueTiming>;
  showStart: number;
}

export interface ScheduleInput {
  content: Pick<ShowContent, 'segments' | 'cues'>;
  eventDate: string;
  plannedStart: string;
  timezone: string;
  session: { timingPolicy: TimingPolicy; startedAt: string } | null;
  segmentLive: SegmentLive[];
  cueStates: CueLiveState[];
  now: number;
}

export function sortSegments(segments: Segment[]): Segment[] {
  return [...segments].sort((a, b) => a.position - b.position);
}

export function sortCues(cues: Cue[]): Cue[] {
  return [...cues].sort((a, b) => a.offsetSec - b.offsetSec || a.position - b.position);
}

export function computeSchedule(input: ScheduleInput): Schedule {
  const { timezone: tz, now } = input;
  const showStart = zonedToUtcMs(input.eventDate, input.plannedStart, tz);
  const live = new Map(input.segmentLive.map((s) => [s.segmentId, s]));
  const projected = input.session?.timingPolicy === 'projected';
  const segments = new Map<string, SegmentTiming>();

  let plannedCursor = showStart;
  let prevEstEnd: number | null = null;
  for (const seg of sortSegments(input.content.segments)) {
    const fixed = seg.fixedTime ? parseClock(seg.fixedTime) !== null : false;
    const plannedStart = fixed ? zonedToUtcMs(input.eventDate, seg.fixedTime!, tz) : plannedCursor;
    const plannedEnd = plannedStart + seg.durationSec * 1000;
    plannedCursor = plannedEnd;

    const l = live.get(seg.id);
    const delaySec = l?.delaySec ?? 0;
    let estStart: number;
    let estEnd: number;
    let overrunSec = 0;
    let conflict = false;
    let status: SegmentTiming['status'] = 'upcoming';

    if (input.session && l?.actualStart) {
      estStart = Date.parse(l.actualStart);
      if (l.actualEnd) {
        estEnd = Date.parse(l.actualEnd);
        status = 'done';
      } else {
        status = 'running';
        estEnd = estStart + seg.durationSec * 1000;
        overrunSec = Math.max(0, (now - estEnd) / 1000);
        if (projected) estEnd = Math.max(estEnd, now);
      }
    } else {
      if (fixed) {
        estStart = plannedStart;
        if (prevEstEnd !== null && prevEstEnd > estStart + 999) conflict = true;
      } else {
        estStart = plannedStart + delaySec * 1000;
        if (input.session && projected) {
          estStart = Math.max(estStart, prevEstEnd ?? estStart, now);
        }
      }
      estEnd = estStart + seg.durationSec * 1000;
    }

    segments.set(seg.id, {
      segmentId: seg.id,
      plannedStart,
      plannedEnd,
      estStart,
      estEnd,
      delaySec,
      driftSec: Math.round((estStart - plannedStart) / 1000),
      overrunSec,
      fixed,
      conflict,
      status,
    });
    prevEstEnd = estEnd;
  }

  const states = new Map(input.cueStates.map((c) => [c.cueId, c]));
  const cues = new Map<string, CueTiming>();
  for (const cue of input.content.cues) {
    const seg = segments.get(cue.segmentId);
    if (!seg) continue;
    const calledAt = states.get(cue.id)?.calledAt;
    cues.set(cue.id, {
      cueId: cue.id,
      planned: seg.plannedStart + cue.offsetSec * 1000,
      estimated: seg.estStart + cue.offsetSec * 1000,
      actual: calledAt ? Date.parse(calledAt) : null,
    });
  }
  return { segments, cues, showStart };
}

/** Local "HH:MM" for a planned time relative to the show start (for editors). */
export function plannedClock(schedule: Schedule, cueId: string, tz: string): string {
  const t = schedule.cues.get(cueId);
  return t ? formatClock(t.planned, tz, false) : '--:--';
}
