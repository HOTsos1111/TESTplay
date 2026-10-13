import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { guessMapping, normalizeImport, parseDelimited, parseSheetTime, parseUpload } from '../server/importer.ts';
import { Client, startTestServer, type TestEnv } from './helpers.ts';
import type { ImportMapping } from '../shared/schemas.ts';
import type { Snapshot } from '../shared/types.ts';

const sample = readFileSync(new URL('../public/sample-run-of-show.csv', import.meta.url), 'utf8');

describe('parsing', () => {
  it('parses quoted CSV and tab-separated paste', () => {
    expect(parseDelimited('a,"b, c","d ""q"""\n1,2,3')).toEqual([
      ['a', 'b, c', 'd "q"'],
      ['1', '2', '3'],
    ]);
    expect(parseDelimited('x\ty\n1\t2\n')).toEqual([
      ['x', 'y'],
      ['1', '2'],
    ]);
  });

  it('reads common time formats', () => {
    expect(parseSheetTime('10:05')).toBe(36300);
    expect(parseSheetTime('9.30')).toBe(34200);
    expect(parseSheetTime('2:15 pm')).toBe(51300);
    expect(parseSheetTime('1005')).toBe(36300);
    expect(parseSheetTime('0.5')).toBe(43200);
    expect(parseSheetTime('25:00')).toBeNull();
    expect(parseSheetTime('soon')).toBeNull();
  });

  it('is honest about unsupported formats', async () => {
    const pdf = await parseUpload('show.pdf', Buffer.from('%PDF-1.4'));
    expect(pdf.status).toBe('unsupported');
    expect(pdf.message).toMatch(/not supported/);
    const xls = await parseUpload('old.xls', Buffer.from('x'));
    expect(xls.status).toBe('unsupported');
    const bad = await parseUpload('broken.xlsx', Buffer.from('not a zip'));
    expect(bad.status).toBe('unsupported');
  });
});

describe('normalisation', () => {
  it('imports the one-row-per-segment sample with department columns and Q-Links', () => {
    const table = parseDelimited(sample);
    const mapping = guessMapping(table);
    expect(mapping.headerRow).toBe(0);
    expect(mapping.columns.map((c) => c.field)).toEqual(['time', 'segment', 'performer', 'segmentDuration', 'deptColumn', 'deptColumn', 'deptColumn', 'deptColumn']);
    const r = normalizeImport(table, mapping, null);
    expect(r.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(r.counts.segments).toBe(8);
    expect(r.counts.cues).toBe(30);
    expect(r.counts.groups).toBe(8);
    expect(r.firstTime).toBe('09:00');
    const keynote = r.content.segments.find((s) => s.title === 'Keynote')!;
    expect(keynote.durationSec).toBe(25 * 60);
    expect(keynote.performer).toBe('Alex Chen');
  });

  it('flags blank rows, headings, duplicates, missing departments, bad times and cue-number collisions', () => {
    const csv = [
      'Cue,Time,Segment,Department,Instruction',
      '1,10:00,Opening,Audio,Music up',
      ',,,,',
      'ACT ONE,,,,',
      '1,10:00,Opening,Audio,Music up',
      '2,10:61,Opening,Lighting,Look 1',
      '3,10:05,Keynote,,Mic live',
      '4,10:06,Keynote,Pyro,Gerb on cue',
    ].join('\n');
    const table = parseDelimited(csv);
    const r = normalizeImport(table, guessMapping(table), null);
    const msgs = r.issues.map((i) => `${i.row}:${i.severity}:${i.message}`);
    expect(msgs.some((m) => m.startsWith('3:warning') && /heading/.test(m))).toBe(true);
    expect(msgs.some((m) => m.startsWith('4:warning') && /Duplicate of row 2/.test(m))).toBe(true);
    expect(msgs.some((m) => m.startsWith('4:error') && /already used/.test(m))).toBe(true);
    expect(msgs.some((m) => m.startsWith('5:error') && /not a time/.test(m))).toBe(true);
    expect(msgs.some((m) => m.startsWith('6:error') && /Missing department/.test(m))).toBe(true);
    expect(r.counts.newDepartments).toEqual(['Pyro']);
    expect(r.counts.rowsSkipped).toBe(2);

    // Omitting and correcting rows clears the errors.
    const fixed: ImportMapping = { ...guessMapping(table), omitRows: [4], overrides: { '5:1': '10:01', '6:3': 'Audio' } };
    const r2 = normalizeImport(table, fixed, null);
    expect(r2.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(r2.counts.cues).toBe(4);
  });
});

describe('import API', () => {
  let env: TestEnv;
  let producer: Client;
  beforeAll(async () => {
    env = await startTestServer();
    producer = await new Client(env.app.url).login('producer@summit-live.example');
  });
  afterAll(async () => env.close());

  it('creates a new show from CSV after review and preserves the source', async () => {
    const up = await producer.req<{ id: string; mapping: ImportMapping; status: string }>('POST', '/api/imports', { filename: 'sample.csv', dataBase64: Buffer.from(sample).toString('base64') });
    expect(up.status).toBe(200);
    expect(up.data.status).toBe('parsed');
    const commit = await producer.req<{ showId: string; counts: { cues: number } }>('POST', `/api/imports/${up.data.id}/commit`, {
      mapping: up.data.mapping,
      target: { mode: 'new', details: { title: 'Imported show', eventDate: '2026-11-04', timezone: 'UTC', plannedStart: '09:00', venue: '', notes: '' } },
    });
    expect(commit.status).toBe(200);
    const s = (await producer.req<{ snapshot: Snapshot }>('GET', `/api/shows/${commit.data.showId}`)).data.snapshot;
    expect(s.content.cues.length).toBe(30);
    expect(s.show.revision).toBe(1);
    const row = env.app.db.prepare('SELECT source FROM import_jobs WHERE id = ?').get(up.data.id) as { source: Uint8Array };
    expect(Buffer.from(row.source).toString('utf8')).toBe(sample);
  });

  it('writes nothing when validation fails', async () => {
    const before = (await producer.req<{ shows: unknown[] }>('GET', '/api/shows')).data.shows.length;
    const bad = 'Cue,Department,Instruction\n1,Audio,Music\n2,,Missing department';
    const up = await producer.req<{ id: string; mapping: ImportMapping }>('POST', '/api/imports', { filename: 'bad.csv', pastedText: bad });
    const commit = await producer.req<{ details: { issues: unknown[] } }>('POST', `/api/imports/${up.data.id}/commit`, {
      mapping: up.data.mapping,
      target: { mode: 'new', details: { title: 'Should not exist', eventDate: '2026-11-04', timezone: 'UTC', plannedStart: '09:00', venue: '', notes: '' } },
    });
    expect(commit.status).toBe(422);
    expect(commit.data.details.issues.length).toBeGreaterThan(0);
    expect((await producer.req<{ shows: unknown[] }>('GET', '/api/shows')).data.shows.length).toBe(before);
  });

  it('merges into an existing show and detects cue-number collisions', async () => {
    const s = (await producer.req<{ snapshot: Snapshot }>('GET', `/api/shows/${env.seed.showId}`)).data.snapshot;
    const clash = 'Cue,Department,Instruction,Segment\n010,Video,Duplicate number,Encore';
    const up = await producer.req<{ id: string; mapping: ImportMapping }>('POST', '/api/imports', { filename: 'clash.csv', pastedText: clash });
    const norm = await producer.req<{ issues: { severity: string; message: string }[]; consequences: string }>('POST', `/api/imports/${up.data.id}/normalize`, { mapping: up.data.mapping, targetShowId: env.seed.showId, mode: 'merge' });
    expect(norm.data.issues.some((i) => i.severity === 'error' && /already used in Video/.test(i.message))).toBe(true);
    expect(norm.data.consequences).toMatch(/Merge appends/);

    const ok = 'Cue,Department,Instruction,Segment\n900,Video,Encore graphic,Encore';
    const up2 = await producer.req<{ id: string; mapping: ImportMapping }>('POST', '/api/imports', { filename: 'encore.csv', pastedText: ok });
    const commit = await producer.req<{ revision: number }>('POST', `/api/imports/${up2.data.id}/commit`, { mapping: up2.data.mapping, target: { mode: 'merge', showId: env.seed.showId, baseRevision: s.show.revision } });
    expect(commit.status).toBe(200);
    expect(commit.data.revision).toBe(s.show.revision + 1);
    const after = (await producer.req<{ snapshot: Snapshot }>('GET', `/api/shows/${env.seed.showId}`)).data.snapshot;
    expect(after.content.cues.length).toBe(s.content.cues.length + 1);
    expect(after.content.segments.length).toBe(s.content.segments.length + 1);
  });

  it('viewers cannot import into a show', async () => {
    const viewer = await new Client(env.app.url).login('viewer@summit-live.example');
    const up = await viewer.req<{ id: string; mapping: ImportMapping }>('POST', '/api/imports', { filename: 'x.csv', pastedText: 'Cue,Department,Instruction\n901,Audio,x' });
    const s = (await viewer.req<{ snapshot: Snapshot }>('GET', `/api/shows/${env.seed.showId}`)).data.snapshot;
    const r = await viewer.req('POST', `/api/imports/${up.data.id}/commit`, { mapping: up.data.mapping, target: { mode: 'merge', showId: env.seed.showId, baseRevision: s.show.revision } });
    expect(r.status).toBe(403);
  });
});

describe('office formats', () => {
  it('reads the first XLSX sheet including time-formatted cells and a merged heading row', async () => {
    const parsed = await parseUpload('run-of-show.xlsx', readFileSync(new URL('./fixtures/run-of-show.xlsx', import.meta.url)));
    expect(parsed.status).toBe('parsed');
    expect(parsed.table[0]).toEqual(['Time', 'Item', 'Speaker', 'Video', 'Audio', 'Lighting']);
    expect(parsed.table[2][0]).toBe('09:00');
    const r = normalizeImport(parsed.table, guessMapping(parsed.table), null);
    expect(r.issues.some((i) => i.row === 1 && /heading/.test(i.message))).toBe(true);
    expect(r.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(r.counts.segments).toBe(3);
    expect(r.counts.cues).toBe(9);
    expect(r.content.segments[0].durationSec).toBe(15 * 60);
  });

  it('reads a DOCX table with a review message', async () => {
    const parsed = await parseUpload('running-order.docx', readFileSync(new URL('./fixtures/running-order.docx', import.meta.url)));
    expect(parsed.status).toBe('parsed');
    expect(parsed.message).toMatch(/Check the preview/);
    expect(parsed.table[1]).toEqual(['1', '10:00', 'Audio', 'Music up & under']);
    const r = normalizeImport(parsed.table, guessMapping(parsed.table), null);
    expect(r.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(r.counts.cues).toBe(3);
  });
});
