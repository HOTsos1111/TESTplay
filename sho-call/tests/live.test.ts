// Cross-client integration tests: real HTTP + WebSocket against an in-process
// server with a temporary SQLite database.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, key, startTestServer, type TestEnv } from './helpers.ts';
import { deriveCalls } from '../shared/calls.ts';
import { sortSegments } from '../shared/timing.ts';
import type { Snapshot } from '../shared/types.ts';

let env: TestEnv;
let director: Client;
let audio: Client;
let lighting: Client;
let viewer: Client;
let showId: string;
const CONSOLE = 'console-tab-aaaaaaaa';

beforeAll(async () => {
  env = await startTestServer();
  showId = env.seed.showId;
  director = await new Client(env.app.url).login('director@summit-live.example');
  audio = await new Client(env.app.url).login('audio@summit-live.example');
  lighting = await new Client(env.app.url).login('lighting@summit-live.example');
  viewer = await new Client(env.app.url).login('viewer@summit-live.example');
  // The seed leaves a rehearsal with no console in control.
  const r = await director.req('POST', `/api/shows/${showId}/session/take-control`, { clientId: CONSOLE, confirm: true });
  expect(r.status).toBe(200);
});

afterAll(async () => {
  await env.close();
});

const group = (s: Snapshot, label: string) => s.content.groups.find((g) => g.label === label)!;
const cueOf = (s: Snapshot, dept: string, number: string) => {
  const d = s.content.departments.find((x) => x.key === dept)!;
  return s.content.cues.find((c) => c.departmentId === d.id && c.number === number)!;
};
const stateOf = (s: Snapshot, cueId: string) => s.cueStates.find((c) => c.cueId === cueId)?.state ?? 'pending';

describe('authoritative shared state', () => {
  it('Director and crew in separate clients receive the same session state', async () => {
    const dSub = await director.subscribe(showId);
    const aSub = await audio.subscribe(showId);
    const d = dSub.latest!;
    const a = aSub.latest!;
    expect(d.seq).toBe(a.seq);
    expect(d.session?.id).toBe(a.session?.id);
    expect(d.session?.mode).toBe('rehearsal');
    expect(a.show.revision).toBe(d.show.revision);
    dSub.close();
    aSub.close();
  });
});

describe('Q-Link and independent calls', () => {
  it('a Q-Link Go updates every member once, with one action id; repeating the request does not issue again', async () => {
    const aSub = await audio.subscribe(showId);
    const s = await director.snapshot(showId);
    const g = group(s, 'Show open');
    const members = s.content.cues.filter((c) => c.groupId === g.id);
    expect(members.length).toBe(4);

    const body = { target: { kind: 'group', id: g.id }, action: 'go', reason: '', idempotencyKey: key(), clientId: CONSOLE };
    const first = await director.req<{ actionId: string; applied: string[]; duplicate: boolean; at: string }>('POST', `/api/shows/${showId}/cue-actions`, body);
    expect(first.status).toBe(200);
    expect(first.data.applied.sort()).toEqual(members.map((m) => m.id).sort());

    // Crew sees all members called with the same action id and timestamp.
    const seen = await aSub.until((x) => x.cueStates.filter((c) => members.some((m) => m.id === c.cueId) && c.state === 'called').length === 4);
    const states = seen.cueStates.filter((c) => members.some((m) => m.id === c.cueId));
    expect(new Set(states.map((c) => c.lastActionId)).size).toBe(1);
    expect(new Set(states.map((c) => c.calledAt)).size).toBe(1);

    // Retry with the same idempotency key (e.g. lost acknowledgement): original result, no new Go.
    const retry = await director.req<{ actionId: string; duplicate: boolean }>('POST', `/api/shows/${showId}/cue-actions`, body);
    expect(retry.status).toBe(200);
    expect(retry.data.duplicate).toBe(true);
    expect(retry.data.actionId).toBe(first.data.actionId);

    // A second click with a new key is rejected: the cues were already called.
    const again = await director.req<{ code: string }>('POST', `/api/shows/${showId}/cue-actions`, { ...body, idempotencyKey: key() });
    expect(again.status).toBe(409);
    expect(again.data.code).toBe('invalid_transition');

    const after = await director.snapshot(showId);
    const goEvents = after.activity.filter((e) => e.summary.startsWith('Go: Q-Link Show open'));
    expect(goEvents.length).toBe(1);
    aSub.close();
  });

  it('an independent audio cue can be called without changing unrelated cues', async () => {
    const before = await director.snapshot(showId);
    const sponsor = cueOf(before, 'audio', '021');
    expect(sponsor.groupId).toBeNull();
    const r = await director.req('POST', `/api/shows/${showId}/cue-actions`, { target: { kind: 'cue', id: sponsor.id }, action: 'go', reason: '', idempotencyKey: key(), clientId: CONSOLE });
    expect(r.status).toBe(200);
    const after = await director.snapshot(showId);
    expect(stateOf(after, sponsor.id)).toBe('called');
    for (const c of before.content.cues) {
      if (c.id === sponsor.id) continue;
      expect(stateOf(after, c.id)).toBe(stateOf(before, c.id));
    }
  });

  it('hold stores state and resume restores it without reissuing Go; skip needs a reason', async () => {
    const s = await director.snapshot(showId);
    const lx = cueOf(s, 'lighting', '030');
    const send = (action: string, reason = '') => director.req<{ code?: string }>('POST', `/api/shows/${showId}/cue-actions`, { target: { kind: 'cue', id: lx.id }, action, reason, idempotencyKey: key(), clientId: CONSOLE });
    expect((await send('standby')).status).toBe(200);
    expect((await send('hold', 'Speaker not ready')).status).toBe(200);
    let now = await director.snapshot(showId);
    expect(stateOf(now, lx.id)).toBe('held');
    expect((await send('resume')).status).toBe(200);
    now = await director.snapshot(showId);
    expect(stateOf(now, lx.id)).toBe('standby');
    expect(now.cueStates.find((c) => c.cueId === lx.id)!.calledAt).toBeNull();
    expect((await send('skip')).status).toBe(422);
  });

  it('the seeded held cue is visible to the crew as held', async () => {
    const s = await lighting.snapshot(showId);
    const award = cueOf(s, 'lighting', '060');
    expect(stateOf(s, award.id)).toBe('held');
    expect(s.cueStates.find((c) => c.cueId === award.id)!.reason).toMatch(/award/i);
  });
});

describe('permissions are enforced on the server', () => {
  it('crew cannot call cues, even with a forged client id', async () => {
    const s = await audio.snapshot(showId);
    const c = cueOf(s, 'audio', '030');
    const r = await audio.req<{ code: string }>('POST', `/api/shows/${showId}/cue-actions`, { target: { kind: 'cue', id: c.id }, action: 'go', reason: '', idempotencyKey: key(), clientId: CONSOLE });
    expect(r.status).toBe(403);
  });

  it('a second Director console is read-only until an explicit transfer', async () => {
    const s = await director.snapshot(showId);
    const c = cueOf(s, 'video', '031');
    const r = await director.req('POST', `/api/shows/${showId}/cue-actions`, { target: { kind: 'cue', id: c.id }, action: 'standby', reason: '', idempotencyKey: key(), clientId: 'other-console-bbbbbbbb' });
    expect(r.status).toBe(403);
  });

  it('operators acknowledge readiness only for departments they operate', async () => {
    const s = await audio.snapshot(showId);
    const mine = cueOf(s, 'audio', '030');
    const notMine = cueOf(s, 'lighting', '030');
    expect((await audio.req('POST', `/api/shows/${showId}/readiness`, { cueId: mine.id, status: 'ready', note: '' })).status).toBe(200);
    expect((await audio.req('POST', `/api/shows/${showId}/readiness`, { cueId: notMine.id, status: 'ready', note: '' })).status).toBe(403);
    expect((await viewer.req('POST', `/api/shows/${showId}/readiness`, { cueId: mine.id, status: 'ready', note: '' })).status).toBe(403);
    // Readiness is visible to the Director and separate from the call state.
    const d = await director.snapshot(showId);
    expect(d.readiness.some((r) => r.cueId === mine.id && r.status === 'ready')).toBe(true);
    expect(stateOf(d, mine.id)).toBe('pending');
  });

  it('crew cannot apply live edits or publish content', async () => {
    const s = await audio.snapshot(showId);
    expect((await audio.req('POST', `/api/shows/${showId}/live-edits`, { baseRevision: s.show.revision, ops: [{ op: 'shift', deltaSec: 300 }], dryRun: false, reason: '', clientId: CONSOLE })).status).toBe(403);
    expect((await viewer.req('PUT', `/api/shows/${showId}/content`, { baseRevision: s.show.revision, content: s.content, dryRun: false })).status).toBe(403);
  });

  it('rejects subscriptions to shows the user is not a member of, and unauthenticated sockets', async () => {
    const outsider = await new Client(env.app.url).login('viewer@summit-live.example');
    // Viewer is not a member of the template show.
    const sub = await outsider.subscribe(env.seed.templateId);
    expect(sub.messages[0].type).toBe('error');
    expect(sub.messages[0].code).toBe('forbidden');
    await new Promise((r) => setTimeout(r, 50));
    expect(sub.closeCode).toBe(4403);
    const anon = new Client(env.app.url);
    await expect(anon.subscribe(showId)).rejects.toThrow(/401/);
    expect((await anon.req('GET', `/api/shows/${showId}`)).status).toBe(401);
  });

  it('mutations without the CSRF header are refused', async () => {
    const r = await director.req('POST', `/api/shows/${showId}/session/take-control`, { clientId: CONSOLE, confirm: true }, { 'x-sho-call': '' });
    expect(r.status).toBe(403);
  });

  it('a department filter never widens visibility: hidden departments are removed server-side', async () => {
    const lightingId = env.seed.departments.lighting;
    const audioId = env.seed.departments.audio;
    const producer = await new Client(env.app.url).login('producer@summit-live.example');
    const users = await producer.req<{ members: { userId: string; email: string }[] }>('GET', `/api/shows/${showId}/members`);
    const viewerId = users.data.members.find((m) => m.email.startsWith('viewer'))!.userId;
    expect((await producer.req('PATCH', `/api/shows/${showId}/members/${viewerId}`, { role: 'viewer', operateDepartments: [], visibleDepartments: [audioId] })).status).toBe(200);
    const s = await viewer.snapshot(showId);
    expect(s.content.departments.map((d) => d.id)).toEqual([audioId]);
    expect(s.content.cues.every((c) => c.departmentId === audioId)).toBe(true);
    expect(s.content.cues.some((c) => c.departmentId === lightingId)).toBe(false);
    await producer.req('PATCH', `/api/shows/${showId}/members/${viewerId}`, { role: 'viewer', operateDepartments: [], visibleDepartments: null });
  });
});

describe('live edits, revisions and undo', () => {
  it('a speaker reorder plus a +05:00 shift reaches every connected client as one revision', async () => {
    const dSub = await director.subscribe(showId);
    const aSub = await audio.subscribe(showId);
    const s = dSub.latest!;
    const ordered = sortSegments(s.content.segments);
    const panel = ordered.find((x) => x.title.startsWith('Panel'))!;
    const breakSeg = ordered.find((x) => x.title.startsWith('Networking'))!;
    const toIndex = ordered.indexOf(breakSeg);
    const body = { baseRevision: s.show.revision, ops: [{ op: 'moveSegment', segmentId: panel.id, toIndex }, { op: 'shift', deltaSec: 300 }], dryRun: true, reason: 'Panel ready early', clientId: CONSOLE };

    const preview = await director.req<{ applied: boolean; preview: { summary: string; timingNotes: string[] } }>('POST', `/api/shows/${showId}/live-edits`, body);
    expect(preview.status).toBe(200);
    expect(preview.data.applied).toBe(false);
    expect(preview.data.preview.summary).toMatch(/Panel/);
    expect(preview.data.preview.summary).toMatch(/\+05:00/);
    expect((await director.snapshot(showId)).show.revision).toBe(s.show.revision);

    const applied = await director.req<{ revision: number }>('POST', `/api/shows/${showId}/live-edits`, { ...body, dryRun: false });
    expect(applied.status).toBe(200);
    expect(applied.data.revision).toBe(s.show.revision + 1);

    const crew = await aSub.until((x) => x.show.revision === applied.data.revision);
    const crewOrder = sortSegments(crew.content.segments).map((x) => x.id);
    expect(crewOrder.indexOf(panel.id)).toBeLessThan(crewOrder.indexOf(breakSeg.id));
    const delays = new Map(crew.segmentLive.map((x) => [x.segmentId, x.delaySec]));
    expect(delays.get(panel.id)).toBe(300);
    const fixed = crew.content.segments.find((x) => x.fixedTime)!;
    expect(delays.get(fixed.id) ?? 0).toBe(0);
    expect(crew.activity[0].summary).toMatch(new RegExp(`Revision ${applied.data.revision}`));
    const dir = await dSub.until((x) => x.show.revision === applied.data.revision);
    expect(dir.seq).toBe(crew.seq);
    dSub.close();
    aSub.close();
  });

  it('rejects an edit based on a stale revision', async () => {
    const s = await director.snapshot(showId);
    const r = await director.req<{ code: string }>('POST', `/api/shows/${showId}/live-edits`, { baseRevision: s.show.revision - 1, ops: [{ op: 'shift', deltaSec: 60 }], dryRun: false, reason: '', clientId: CONSOLE });
    expect(r.status).toBe(409);
    expect(r.data.code).toBe('revision_conflict');
  });

  it('undo creates a compensating revision and never removes earlier calls', async () => {
    const before = await director.snapshot(showId);
    const calledBefore = before.cueStates.filter((c) => c.state === 'called').map((c) => c.cueId).sort();
    const rev = before.activity.find((a) => a.undoableRevisionId && a.summary.includes('+05:00'))!;
    expect(rev).toBeTruthy();
    const r = await director.req<{ revision: number }>('POST', `/api/shows/${showId}/undo`, { revisionId: rev.undoableRevisionId, baseRevision: before.show.revision, clientId: CONSOLE });
    expect(r.status).toBe(200);
    const after = await director.snapshot(showId);
    expect(after.show.revision).toBe(before.show.revision + 1);
    const panel = after.content.segments.find((x) => x.title.startsWith('Panel'))!;
    expect(after.segmentLive.find((x) => x.segmentId === panel.id)!.delaySec).toBe(0);
    expect(after.cueStates.filter((c) => c.state === 'called').map((c) => c.cueId).sort()).toEqual(calledBefore);
    expect(after.activity.some((a) => a.summary.includes('Revision ' + (before.show.revision + 1)) && a.summary.includes('Undo'))).toBe(true);
    // The same revision cannot be undone twice.
    const again = await director.req('POST', `/api/shows/${showId}/undo`, { revisionId: rev.undoableRevisionId, baseRevision: after.show.revision, clientId: CONSOLE });
    expect(again.status).toBe(409);
  });

  it('cannot delete a cue that was already issued', async () => {
    const s = await director.snapshot(showId);
    const called = s.cueStates.find((c) => c.state === 'called')!;
    const content = { ...s.content, cues: s.content.cues.filter((c) => c.id !== called.cueId) };
    const r = await director.req<{ error: string }>('PUT', `/api/shows/${showId}/content`, { baseRevision: s.show.revision, content, dryRun: false });
    expect(r.status).toBe(422);
    expect(r.data.error).toMatch(/already issued/);
  });
});

describe('reconnect recovery', () => {
  it('a client that reconnects gets the authoritative snapshot and no command is replayed', async () => {
    const before = await director.snapshot(showId);
    const goCount = (s: Snapshot) => s.activity.filter((a) => a.type === 'cue').length;
    const sub = await audio.subscribe(showId);
    sub.ws.terminate(); // simulate a dropped connection

    // While the crew client is offline, the Director calls a cue.
    const calls = deriveCalls(before.content);
    const open = calls.find((c) => c.kind === 'cue' && !before.cueStates.some((x) => x.cueId === c.cueIds[0]))!;
    expect((await director.req('POST', `/api/shows/${showId}/cue-actions`, { target: { kind: 'cue', id: open.cueIds[0] }, action: 'standby', reason: '', idempotencyKey: key(), clientId: CONSOLE })).status).toBe(200);

    const again = await audio.subscribe(showId);
    const s = again.latest!;
    expect(s.seq).toBeGreaterThan(before.seq);
    expect(stateOf(s, open.cueIds[0])).toBe('standby');
    expect(goCount(s)).toBe(goCount(before) + 1);
    again.close();
  });

  it('lets a client find out whether a command with a lost response was accepted', async () => {
    const s = await director.snapshot(showId);
    const c = cueOf(s, 'video', '040');
    const k = key();
    await director.req('POST', `/api/shows/${showId}/cue-actions`, { target: { kind: 'cue', id: c.id }, action: 'prepare', reason: '', idempotencyKey: k, clientId: CONSOLE });
    expect((await director.req<{ status: string }>('GET', `/api/shows/${showId}/cue-actions/${k}`)).data.status).toBe('accepted');
    expect((await director.req<{ status: string }>('GET', `/api/shows/${showId}/cue-actions/never-sent-${k}`)).data.status).toBe('not_received');
  });

  it('marks readiness from a disconnected operator as stale (never ready)', async () => {
    const lx = await lighting.subscribe(showId);
    const s = lx.latest!;
    const cue = cueOf(s, 'lighting', '050');
    expect((await lighting.req('POST', `/api/shows/${showId}/readiness`, { cueId: cue.id, status: 'ready', note: '' })).status).toBe(200);
    let d = await director.snapshot(showId);
    expect(d.readiness.find((r) => r.cueId === cue.id)!.fresh).toBe(true);
    lx.close();
    await new Promise((r) => setTimeout(r, 100));
    // Within the grace period it is still fresh; simulate expiry by checking the hub directly.
    const hub = env.app.hub as unknown as { presenceByShow: Map<string, Map<string, { connections: number; lastSeen: number }>> };
    const entry = hub.presenceByShow.get(showId)!.get(env.seed.users.lighting.id)!;
    entry.lastSeen = Date.now() - 60_000;
    d = await director.snapshot(showId);
    expect(d.readiness.find((r) => r.cueId === cue.id)!.fresh).toBe(false);
  });
});

describe('sessions', () => {
  it('ends a session and starts a separate live session with a fresh log', async () => {
    const producer = await new Client(env.app.url).login('producer@summit-live.example');
    expect((await audio.req('POST', `/api/shows/${showId}/session/end`, { confirm: true })).status).toBe(403);
    expect((await director.req('POST', `/api/shows/${showId}/session/end`, { confirm: true })).status).toBe(200);
    const r = await producer.req('POST', `/api/shows/${showId}/session/start`, { mode: 'live', timingPolicy: 'manual', directorUserId: env.seed.users.director.id, clientId: 'producer-tab-xxxxxxxx' });
    expect(r.status).toBe(200);
    const s = await director.snapshot(showId);
    expect(s.session?.mode).toBe('live');
    expect(s.cueStates.length).toBe(0);
    expect(s.session?.controlClientId).toBeNull();
    expect(s.activity.some((a) => a.type === 'cue')).toBe(false);
    // Director must take control explicitly before calling.
    const g = group(s, 'Show open');
    expect((await director.req('POST', `/api/shows/${showId}/cue-actions`, { target: { kind: 'group', id: g.id }, action: 'standby', reason: '', idempotencyKey: key(), clientId: CONSOLE })).status).toBe(403);
  });
});
