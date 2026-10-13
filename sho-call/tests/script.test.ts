import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { callScript, defaultScript, listNames } from '../shared/script.ts';
import { deriveCalls } from '../shared/calls.ts';
import { openDb } from '../server/db.ts';
import { Client, startTestServer, type TestEnv } from './helpers.ts';

describe('call script defaults', () => {
  it('builds standard Standby / GO lines', () => {
    expect(listNames(['Video'])).toBe('Video');
    expect(listNames(['Video', 'Audio', 'Lighting'])).toBe('Video, Audio and Lighting');
    expect(defaultScript(['Video', 'Audio'], '23')).toEqual({ standby: 'Standby Video and Audio for Cue 23', go: 'Video and Audio — GO Cue 23' });
  });
});

describe('call script storage', () => {
  let env: TestEnv;
  beforeAll(async () => (env = await startTestServer()));
  afterAll(async () => env.close());

  it('uses defaults, honours the seeded override, and saves edits through publish', async () => {
    const producer = await new Client(env.app.url).login('producer@summit-live.example');
    const s = await producer.snapshot(env.seed.showId);
    const calls = deriveCalls(s.content);
    const open = calls.find((c) => c.label === 'Show open')!;
    expect(callScript(open, s.content).go).toBe('House to black… film… GO Cue 010');
    const house = calls.find((c) => c.label === 'House open')!;
    const def = callScript(house, s.content);
    expect(def.standbyDefault).toBe(true);
    expect(def.standby).toBe('Standby Video, Audio, Lighting and Front of House for Cue 001');

    const sponsor = calls.find((c) => c.kind === 'cue' && s.content.cues.find((x) => x.id === c.cueIds[0])!.number === '021')!;
    const content = structuredClone(s.content);
    content.cues.find((c) => c.id === sponsor.cueIds[0])!.goScript = 'Sound — GO sponsor bed';
    content.groups.find((g) => g.id === house.groupId)!.standbyScript = 'Standby house open';
    const r = await producer.req<{ applied: boolean; preview: { summary: string } }>('PUT', `/api/shows/${env.seed.showId}/content`, { baseRevision: s.show.revision, content, dryRun: false });
    expect(r.status).toBe(200);
    expect(r.data.applied).toBe(true);
    const after = await producer.snapshot(env.seed.showId);
    expect(callScript(sponsor, after.content).go).toBe('Sound — GO sponsor bed');
    expect(callScript(house, after.content).standby).toBe('Standby house open');
  });

  it('accepts content from older clients without script fields', async () => {
    const producer = await new Client(env.app.url).login('producer@summit-live.example');
    const s = await producer.snapshot(env.seed.showId);
    const legacy = JSON.parse(JSON.stringify(s.content, (k, v) => (k === 'standbyScript' || k === 'goScript' ? undefined : v)));
    legacy.segments[0].title = 'Doors open';
    const r = await producer.req('PUT', `/api/shows/${env.seed.showId}/content`, { baseRevision: s.show.revision, content: legacy, dryRun: false });
    expect(r.status).toBe(200);
  });
});

describe('department colours', () => {
  let env: TestEnv;
  beforeAll(async () => (env = await startTestServer()));
  afterAll(async () => env.close());

  it('defaults to standard colours and saves an edited colour', async () => {
    const { deptColor } = await import('../shared/colors.ts');
    const producer = await new Client(env.app.url).login('producer@summit-live.example');
    const s = await producer.snapshot(env.seed.showId);
    const video = s.content.departments.find((d) => d.key === 'video')!;
    expect(video.color).toBe('');
    expect(deptColor(video)).toBe('#EF4444');
    const content = structuredClone(s.content);
    content.departments.find((d) => d.key === 'video')!.color = '#123456';
    expect((await producer.req('PUT', `/api/shows/${env.seed.showId}/content`, { baseRevision: s.show.revision, content, dryRun: false })).status).toBe(200);
    const after = await producer.snapshot(env.seed.showId);
    expect(deptColor(after.content.departments.find((d) => d.key === 'video'))).toBe('#123456');
    const bad = structuredClone(after.content);
    bad.departments[0].color = 'red';
    expect((await producer.req('PUT', `/api/shows/${env.seed.showId}/content`, { baseRevision: after.show.revision, content: bad, dryRun: false })).status).toBe(422);
  });
});

describe('migration', () => {
  it('adds script columns to a database created before them', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sho-mig-'));
    const path = join(dir, 'old.db');
    const old = new DatabaseSync(path);
    old.exec('CREATE TABLE schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
    old.exec(readFileSync(new URL('../server/migrations/001_init.sql', import.meta.url), 'utf8'));
    old.exec("INSERT INTO schema_migrations VALUES ('001_init.sql', 'x')");
    old.close();
    const db = openDb(path);
    const cols = (db.prepare('PRAGMA table_info(cue_groups)').all() as { name: string }[]).map((c) => c.name);
    expect(cols).toContain('standby_script');
    expect((db.prepare('PRAGMA table_info(departments)').all() as { name: string }[]).map((c) => c.name)).toContain('color');
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
