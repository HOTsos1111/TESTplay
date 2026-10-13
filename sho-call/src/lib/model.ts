// Derived view model shared by the Director console and crew views.
import { useMemo } from 'react';
import {
  aggregateReadiness,
  callState,
  cueReadiness,
  deriveCalls,
  isCallOpen,
  lastCalled,
  nextOpenCall,
  type Call,
  type CallState,
} from '../../shared/calls.ts';
import { computeSchedule, sortSegments, type Schedule } from '../../shared/timing.ts';
import type { AggregateReadiness, Cue, CueLiveState, Department, Segment, Snapshot } from '../../shared/types.ts';

export interface ShowModel {
  calls: Call[];
  callById: Map<string, Call>;
  states: Map<string, CueLiveState>;
  cueById: Map<string, Cue>;
  deptById: Map<string, Department>;
  segById: Map<string, Segment>;
  segments: Segment[];
  schedule: Schedule;
  next: Call | null;
  last: Call | null;
  stateOfCall: (c: Call) => CallState;
  readinessOfCall: (c: Call) => AggregateReadiness;
  readinessOfCue: (cueId: string) => AggregateReadiness;
  isOpen: (c: Call) => boolean;
}

export function useShowModel(s: Snapshot | null, nowMs: number): ShowModel | null {
  const base = useMemo(() => {
    if (!s) return null;
    const calls = deriveCalls(s.content);
    const states = new Map(s.cueStates.map((c) => [c.cueId, c]));
    return {
      calls,
      callById: new Map(calls.map((c) => [c.id, c])),
      states,
      cueById: new Map(s.content.cues.map((c) => [c.id, c])),
      deptById: new Map(s.content.departments.map((d) => [d.id, d])),
      segById: new Map(s.content.segments.map((d) => [d.id, d])),
      segments: sortSegments(s.content.segments),
    };
  }, [s]);

  // The schedule depends on "now" in projected mode; recompute each tick (cheap).
  const nowBucket = Math.floor(nowMs / 1000);
  return useMemo(() => {
    if (!s || !base) return null;
    const schedule = computeSchedule({
      content: s.content,
      eventDate: s.show.eventDate,
      plannedStart: s.show.plannedStart,
      timezone: s.show.timezone,
      session: s.session,
      segmentLive: s.segmentLive,
      cueStates: s.cueStates,
      now: nowBucket * 1000,
    });
    const readinessOfCue = (cueId: string) => cueReadiness(cueId, s.readiness);
    return {
      ...base,
      schedule,
      next: nextOpenCall(base.calls, base.states),
      last: lastCalled(base.calls, base.states),
      stateOfCall: (c: Call) => callState(c, base.states),
      readinessOfCall: (c: Call) => aggregateReadiness(c.cueIds.map(readinessOfCue)),
      readinessOfCue,
      isOpen: (c: Call) => isCallOpen(c, base.states),
    };
  }, [s, base, nowBucket]);
}

export function callTime(model: ShowModel, call: Call): { planned: number; estimated: number; actual: number | null } {
  const t = model.schedule.cues.get(call.cueIds[0]);
  const actuals = call.cueIds.map((id) => model.schedule.cues.get(id)?.actual).filter((x): x is number => x != null);
  return { planned: t?.planned ?? 0, estimated: t?.estimated ?? 0, actual: actuals.length ? Math.min(...actuals) : null };
}
