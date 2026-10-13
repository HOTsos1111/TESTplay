import { describe, expect, it } from 'vitest';
import { transition } from '../shared/cueMachine.ts';
import { aggregateReadiness, aggregateState, cueReadiness, deriveCalls } from '../shared/calls.ts';
import type { CueState, ReadinessEntry, ShowContent } from '../shared/types.ts';

const ok = (s: CueState, a: Parameters<typeof transition>[2], prev: CueState | null = null) => {
  const t = transition(s, prev, a);
  if (!t.ok) throw new Error(t.reason);
  return t;
};

describe('cue state machine', () => {
  it('follows pending → prepared → standby → called → complete', () => {
    expect(ok('pending', 'prepare').state).toBe('prepared');
    expect(ok('prepared', 'standby').state).toBe('standby');
    expect(ok('standby', 'go').state).toBe('called');
    expect(ok('called', 'complete').state).toBe('complete');
  });

  it('allows Go directly from pending or prepared', () => {
    expect(ok('pending', 'go').state).toBe('called');
    expect(ok('prepared', 'go').state).toBe('called');
  });

  it('never issues Go twice', () => {
    expect(transition('called', null, 'go').ok).toBe(false);
    expect(transition('complete', null, 'go').ok).toBe(false);
  });

  it('only completes a called cue (Go is not proof of completion)', () => {
    expect(transition('standby', null, 'complete').ok).toBe(false);
    expect(transition('pending', null, 'complete').ok).toBe(false);
  });

  it('hold remembers the prior state and resume restores it without Go', () => {
    const held = ok('standby', 'hold');
    expect(held.state).toBe('held');
    expect(held.prevState).toBe('standby');
    const resumed = ok('held', 'resume', held.prevState);
    expect(resumed.state).toBe('standby');
    expect(resumed.state).not.toBe('called');
  });

  it('cannot hold or skip a cue that was already called', () => {
    expect(transition('called', null, 'hold').ok).toBe(false);
    expect(transition('called', null, 'skip').ok).toBe(false);
  });

  it('skipped cues stay skipped until explicitly restored', () => {
    expect(ok('held', 'skip', 'standby').state).toBe('skipped');
    expect(transition('skipped', null, 'go').ok).toBe(false);
    expect(ok('skipped', 'restore').state).toBe('pending');
  });
});

describe('calls and aggregates', () => {
  const content: ShowContent = {
    departments: [
      { id: 'd1', key: 'video', name: 'Video', icon: 'video', sort: 0, color: '' },
      { id: 'd2', key: 'audio', name: 'Audio', icon: 'audio', sort: 1, color: '' },
    ],
    segments: [
      { id: 's2', position: 1, title: 'B', performer: '', durationSec: 60, fixedTime: null, notes: '' },
      { id: 's1', position: 0, title: 'A', performer: '', durationSec: 60, fixedTime: null, notes: '' },
    ],
    cues: [
      { id: 'c3', segmentId: 's2', position: 2, number: '010', departmentId: 'd2', instruction: 'x', owner: '', offsetSec: 0, durationSec: 0, groupId: null, target: null, standbyScript: '', goScript: '' },
      { id: 'c1', segmentId: 's1', position: 0, number: '001', departmentId: 'd1', instruction: 'x', owner: '', offsetSec: 0, durationSec: 0, groupId: 'g1', target: null, standbyScript: '', goScript: '' },
      { id: 'c2', segmentId: 's1', position: 1, number: '001', departmentId: 'd2', instruction: 'x', owner: '', offsetSec: 0, durationSec: 0, groupId: 'g1', target: null, standbyScript: '', goScript: '' },
    ],
    groups: [{ id: 'g1', label: 'Open', segmentId: 's1', standbyScript: '', goScript: '' }],
  };

  it('derives one call per Q-Link and per independent cue, in running order', () => {
    const calls = deriveCalls(content);
    expect(calls.map((c) => c.id)).toEqual(['g:g1', 'c:c3']);
    expect(calls[0].cueIds.sort()).toEqual(['c1', 'c2']);
  });

  it('aggregates member states', () => {
    expect(aggregateState(['standby', 'standby'])).toBe('standby');
    expect(aggregateState(['called', 'complete'])).toBe('called');
    expect(aggregateState(['standby', 'held'])).toBe('mixed');
  });

  it('never reports a disconnected operator as ready', () => {
    const r = (status: ReadinessEntry['status'], fresh: boolean): ReadinessEntry => ({ cueId: 'c1', userId: 'u', userName: 'U', status, note: '', updatedAt: '2026-01-01T00:00:00Z', fresh });
    expect(cueReadiness('c1', [r('ready', false)])).toBe('unknown');
    expect(cueReadiness('c1', [r('ready', true)])).toBe('ready');
    expect(cueReadiness('c1', [])).toBe('pending');
    expect(aggregateReadiness(['ready', 'unknown'])).toBe('unknown');
    expect(aggregateReadiness(['ready', 'issue'])).toBe('issue');
    expect(aggregateReadiness(['ready', 'ready'])).toBe('ready');
  });
});
