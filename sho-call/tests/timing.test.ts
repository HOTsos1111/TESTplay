import { describe, expect, it } from 'vitest';
import { computeSchedule, formatClock, formatDelta, parseDuration, zonedToUtcMs } from '../shared/timing.ts';
import type { Segment, SegmentLive } from '../shared/types.ts';

const seg = (id: string, position: number, minutes: number, fixedTime: string | null = null): Segment => ({ id, position, title: id, performer: '', durationSec: minutes * 60, fixedTime, notes: '' });

describe('timezone handling', () => {
  it('converts local show time through the IANA zone, including DST', () => {
    expect(new Date(zonedToUtcMs('2026-07-01', '10:00', 'Europe/London')).toISOString()).toBe('2026-07-01T09:00:00.000Z');
    expect(new Date(zonedToUtcMs('2026-12-01', '10:00', 'Europe/London')).toISOString()).toBe('2026-12-01T10:00:00.000Z');
    expect(new Date(zonedToUtcMs('2026-07-01', '10:00', 'America/New_York')).toISOString()).toBe('2026-07-01T14:00:00.000Z');
    expect(formatClock(Date.parse('2026-07-01T14:05:09Z'), 'America/New_York')).toBe('10:05:09');
  });

  it('parses durations and formats deltas', () => {
    expect(parseDuration('5')).toBe(300);
    expect(parseDuration('05:30')).toBe(330);
    expect(parseDuration('1:00:00')).toBe(3600);
    expect(parseDuration('90s')).toBe(90);
    expect(parseDuration('abc')).toBeNull();
    expect(formatDelta(300)).toBe('+05:00');
    expect(formatDelta(-90)).toBe('-01:30');
  });
});

describe('schedule projection', () => {
  const base = { eventDate: '2026-11-04', plannedStart: '10:00', timezone: 'UTC', cueStates: [] };
  const content = {
    segments: [seg('a', 0, 10), seg('b', 1, 20), seg('c', 2, 15), seg('d', 3, 10, '11:00')],
    cues: [{ id: 'q', segmentId: 'c', position: 0, number: '1', departmentId: 'x', instruction: 'i', owner: '', offsetSec: 120, durationSec: 0, groupId: null, target: null, standbyScript: '', goScript: '' }],
  };
  const T = (hhmm: string) => Date.parse(`2026-11-04T${hhmm}:00Z`);

  it('chains planned times from durations and keeps fixed times', () => {
    const s = computeSchedule({ ...base, content, session: null, segmentLive: [], now: T('09:00') });
    expect(s.segments.get('b')!.plannedStart).toBe(T('10:10'));
    expect(s.segments.get('c')!.plannedStart).toBe(T('10:30'));
    expect(s.segments.get('d')!.plannedStart).toBe(T('11:00'));
    expect(s.cues.get('q')!.planned).toBe(T('10:32'));
  });

  it('a +05:00 manual shift moves eligible future items but not fixed ones, keeping planned times', () => {
    const live: SegmentLive[] = ['b', 'c'].map((id) => ({ segmentId: id, delaySec: 300, actualStart: null, actualEnd: null }));
    const s = computeSchedule({ ...base, content, session: { timingPolicy: 'manual', startedAt: '2026-11-04T09:59:00Z' }, segmentLive: live, now: T('10:00') });
    expect(s.segments.get('b')!.estStart).toBe(T('10:15'));
    expect(s.segments.get('b')!.plannedStart).toBe(T('10:10'));
    expect(s.cues.get('q')!.estimated).toBe(T('10:37'));
    expect(s.segments.get('d')!.estStart).toBe(T('11:00'));
  });

  it('projected policy pushes later items when a running segment overruns, and flags fixed-time conflicts', () => {
    const live: SegmentLive[] = [
      { segmentId: 'a', delaySec: 0, actualStart: '2026-11-04T10:00:00Z', actualEnd: '2026-11-04T10:10:00Z' },
      { segmentId: 'b', delaySec: 0, actualStart: '2026-11-04T10:10:00Z', actualEnd: null },
    ];
    // b planned to end 10:30 but it is now 10:50 and still running
    const s = computeSchedule({ ...base, content, session: { timingPolicy: 'projected', startedAt: '2026-11-04T10:00:00Z' }, segmentLive: live, now: T('10:50') });
    expect(s.segments.get('b')!.overrunSec).toBe(20 * 60);
    expect(s.segments.get('c')!.estStart).toBe(T('10:50'));
    expect(s.segments.get('d')!.estStart).toBe(T('11:00'));
    expect(s.segments.get('d')!.conflict).toBe(true);
  });

  it('called times never change retroactively', () => {
    const s = computeSchedule({
      ...base,
      content,
      session: { timingPolicy: 'manual', startedAt: '2026-11-04T10:00:00Z' },
      segmentLive: [{ segmentId: 'c', delaySec: 600, actualStart: null, actualEnd: null }],
      cueStates: [{ cueId: 'q', state: 'called', prevState: null, reason: '', calledAt: '2026-11-04T10:33:00Z', completedAt: null, updatedAt: '', lastActionId: 'a' }],
      now: T('10:40'),
    });
    expect(s.cues.get('q')!.actual).toBe(T('10:33'));
  });
});
