// Demo seed: the fictional "Summit Live" show, demo accounts and a template.
// Run with `npm run db:seed` (resets the database file) or import seedDemo().

import { pathToFileURL } from 'node:url';
import { existsSync, rmSync } from 'node:fs';
import { run, tx, type Db } from './db.ts';
import { createUser } from './auth.ts';
import { addEvent, cloneContent, createShow, loadContent, upsertMember, writeContent } from './store.ts';
import { publishContent } from './revisions.ts';
import { cueAction, startSession } from './sessions.ts';
import { newId, nowIso } from './ids.ts';
import { formatClock } from '../shared/timing.ts';
import type { Cue, CueGroup, Department, Segment, ShowContent, User } from '../shared/types.ts';

export const DEMO_PASSWORD = 'showcall-demo';

export const DEMO_ACCOUNTS = [
  { key: 'producer', email: 'producer@summit-live.example', name: 'Morgan Ellis', label: 'Producer (owner)', password: DEMO_PASSWORD },
  { key: 'director', email: 'director@summit-live.example', name: 'Dana Reyes', label: 'Director', password: DEMO_PASSWORD },
  { key: 'audio', email: 'audio@summit-live.example', name: 'Sam Okafor', label: 'Audio operator', password: DEMO_PASSWORD },
  { key: 'lighting', email: 'lighting@summit-live.example', name: 'Lee Park', label: 'Lighting operator', password: DEMO_PASSWORD },
  { key: 'video', email: 'video@summit-live.example', name: 'Ana Silva', label: 'Video operator', password: DEMO_PASSWORD },
  { key: 'stage', email: 'stage@summit-live.example', name: 'Riley Chen', label: 'Stage Manager', password: DEMO_PASSWORD },
  { key: 'viewer', email: 'viewer@summit-live.example', name: 'Jordan Blake', label: 'Viewer (read-only)', password: DEMO_PASSWORD },
] as const;

type Key = (typeof DEMO_ACCOUNTS)[number]['key'];

export interface SeedResult {
  users: Record<Key, User>;
  showId: string;
  templateId: string;
  departments: Record<string, string>;
}

const DEFAULT_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

function localDate(ms: number, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}

export function seedDemo(db: Db, opts: { timezone?: string; startInMinutes?: number; withSession?: boolean } = {}): SeedResult {
  const tz = opts.timezone ?? DEFAULT_TZ;
  // Planned start: the next 5-minute mark at least `startInMinutes` from now, so countdowns are meaningful.
  const step = 5 * 60_000;
  const startMs = Math.ceil((Date.now() + (opts.startInMinutes ?? 10) * 60_000) / step) * step;

  return tx(db, () => {
    const users = {} as Record<Key, User>;
    for (const a of DEMO_ACCOUNTS) users[a.key] = createUser(db, a.email, a.name, a.password);

    const showId = createShow(db, users.producer.id, {
      title: 'Summit Live',
      eventDate: localDate(startMs, tz),
      timezone: tz,
      plannedStart: formatClock(startMs, tz, false),
      venue: 'Harbour Convention Centre — Main Stage (fictional demo)',
      notes: 'Fictional demonstration show. Names, venue and content are invented.',
    });

    const dep = (key: string, name: string, icon: Department['icon'], sort: number): Department => ({ id: newId('dep'), key, name, icon, sort, color: '' });
    const departments = [
      dep('video', 'Video', 'video', 0),
      dep('audio', 'Audio', 'audio', 1),
      dep('lighting', 'Lighting', 'lighting', 2),
      dep('stage', 'Stage Manager', 'stage', 3),
      dep('foh', 'Front of House', 'foh', 4),
    ];
    const D = Object.fromEntries(departments.map((d) => [d.key, d.id])) as Record<string, string>;

    const segments: Segment[] = [];
    const cues: Cue[] = [];
    const groups: CueGroup[] = [];
    let pos = 0;
    const seg = (title: string, performer: string, minutes: number, notes = ''): Segment => {
      const s: Segment = { id: newId('seg'), position: segments.length, title, performer, durationSec: minutes * 60, fixedTime: null, notes };
      segments.push(s);
      return s;
    };
    const cue = (s: Segment, dept: string, number: string, instruction: string, offsetMin = 0, group: CueGroup | null = null, owner = '') => {
      cues.push({ id: newId('cue'), segmentId: s.id, position: pos++, number, departmentId: D[dept], instruction, owner, offsetSec: Math.round(offsetMin * 60), durationSec: 0, groupId: group?.id ?? null, target: null, standbyScript: '', goScript: '' });
    };
    const qlink = (s: Segment, label: string): CueGroup => {
      const g: CueGroup = { id: newId('grp'), label, segmentId: s.id, standbyScript: '', goScript: '' };
      groups.push(g);
      return g;
    };

    const doors = seg('Doors and walk-in', '', 15, 'Audience entry. Hold the house at full until the 2-minute call.');
    const gDoors = qlink(doors, 'House open');
    cue(doors, 'foh', '001', 'Open main doors. Ushers to aisles; hold latecomers at the rear after the opening film starts.', 0, gDoors);
    cue(doors, 'audio', '001', 'Walk-in playlist at background level.', 0, gDoors);
    cue(doors, 'lighting', '001', 'House preset: house at full, stage blue wash at 30%.', 0, gDoors);
    cue(doors, 'video', '001', 'Holding slide loop with Summit Live logo on all screens.', 0, gDoors);
    cue(doors, 'stage', '001', 'Two-minute call to all presenters backstage.', 13);

    const opening = seg('Opening film', '', 4);
    const gOpen = qlink(opening, 'Show open');
    // An edited call script (the rest use the generated defaults).
    gOpen.standbyScript = 'Standby house to half, video and sound for the opening film — Cue 010';
    gOpen.goScript = 'House to black… film… GO Cue 010';
    cue(opening, 'video', '010', 'Play opening film “Summit 2026” full screen on all outputs.', 0, gOpen);
    cue(opening, 'audio', '010', 'Fade walk-in music out over 3 s; film audio up to nominal.', 0, gOpen);
    cue(opening, 'lighting', '010', 'House to black over 5 s; stage to film look.', 0, gOpen);
    cue(opening, 'stage', '010', 'Host on standby stage left, mic checked.', 0, gOpen);
    cue(opening, 'foh', '010', 'Close main doors; latecomers held at the rear until the film ends.', 0.5);

    const welcome = seg('Welcome', 'Jordan Lee (host)', 8);
    const gHost = qlink(welcome, 'Host walk-on');
    cue(welcome, 'audio', '020', 'Walk-on stinger, then host handheld mic live.', 0, gHost);
    cue(welcome, 'lighting', '020', 'Look 2: host special centre stage, front wash up.', 0, gHost);
    cue(welcome, 'video', '020', 'IMAG camera 2 on host; lower third “Jordan Lee — Host”.', 0, gHost);
    cue(welcome, 'stage', '020', 'Go host from stage left.', 0, gHost);
    cue(welcome, 'audio', '021', 'Sponsor message bed under host (independent cue).', 5);

    const keynote = seg('Keynote', 'Alex Chen', 25, 'Lectern presentation with one embedded video at about 15 minutes.');
    const gKey = qlink(keynote, 'Keynote walk-on');
    cue(keynote, 'video', '030', 'Slides from presenter laptop; IMAG camera 1 lectern.', 0, gKey);
    cue(keynote, 'audio', '030', 'Keynote stinger; lectern mic live.', 0, gKey);
    cue(keynote, 'lighting', '030', 'Look 3: lectern special, cool stage wash.', 0, gKey);
    cue(keynote, 'stage', '030', 'Speaker to lectern; clear the host stool.', 0, gKey);
    cue(keynote, 'video', '031', 'Play “Product demo” video when the speaker says “let me show you”.', 15);
    cue(keynote, 'audio', '031', 'Video playback audio up for the demo video.', 15);
    cue(keynote, 'audio', '032', 'Ride lectern mic for audience Q&A; roaming handheld 3 live.', 20);

    const brk = seg('Networking break', '', 15, 'Catering service in the foyer.');
    cue(brk, 'foh', '040', 'Open foyer doors; catering stations open.');
    cue(brk, 'audio', '040', 'Break playlist, foyer speakers on.');
    cue(brk, 'lighting', '040', 'Break state: house at 70%, stage blue wash.');
    cue(brk, 'video', '040', '15-minute break countdown slide.');
    cue(brk, 'stage', '040', 'Reset stage for the panel: four chairs, side tables, water.', 2);

    const panel = seg('Panel: The future of live events', 'Moderator: Sam Patel', 30);
    const gPanel = qlink(panel, 'Panel walk-on');
    cue(panel, 'audio', '050', 'Panel stinger; four handheld mics live.', 0, gPanel);
    cue(panel, 'lighting', '050', 'Look 5: panel wash, warm front light.', 0, gPanel);
    cue(panel, 'video', '050', 'Wide shot camera 3; lower thirds for each panellist.', 0, gPanel);
    cue(panel, 'stage', '050', 'Go panellists from stage right in seating order.', 0, gPanel);

    const awards = seg('Innovation award', 'Presented by Morgan Ellis', 12);
    const gAward = qlink(awards, 'Award reveal');
    cue(awards, 'lighting', '060', 'Award reveal: sweep to winner, then gold stage look.', 4, gAward);
    cue(awards, 'audio', '060', 'Fanfare on the reveal, then winner walk-up music.', 4, gAward);
    cue(awards, 'video', '060', 'Winner graphic full screen.', 4, gAward);
    cue(awards, 'stage', '061', 'Trophy handover from stage left; photographer to the pit.', 5);

    const close = seg('Closing remarks', 'Morgan Ellis', 5);
    const gClose = qlink(close, 'Closing walk-on');
    cue(close, 'audio', '070', 'Lectern mic live; walk-on stinger.', 0, gClose);
    cue(close, 'lighting', '070', 'Look 3: lectern special.', 0, gClose);
    cue(close, 'video', '070', 'IMAG camera 1 lectern.', 0, gClose);

    const out = seg('Walk-out', '', 10, 'Hard out: the venue curfew requires the room clear on time.');
    cue(out, 'audio', '080', 'Walk-out music up full.');
    cue(out, 'lighting', '080', 'House to full over 5 s.');
    cue(out, 'video', '080', 'Thank-you slide on all screens.');
    cue(out, 'foh', '080', 'Open all doors; direct guests to the foyer.');

    // The walk-out is a fixed-time item: shifts never move it, conflicts are flagged.
    const plannedOutMs = startMs + segments.slice(0, -1).reduce((a, s) => a + s.durationSec * 1000, 0);
    out.fixedTime = formatClock(plannedOutMs, tz, false);

    const content: ShowContent = { departments, segments, cues, groups };
    writeContent(db, showId, content);
    run(db, 'UPDATE shows SET revision = 1 WHERE id = ?', showId);
    run(db, `INSERT INTO show_revisions (id, show_id, revision, session_id, kind, actor_id, summary, reason, changes, created_at) VALUES (?, ?, 1, NULL, 'publish', ?, 'Initial running order', '', '[]', ?)`,
      newId('rev'), showId, users.producer.id, nowIso());
    addEvent(db, showId, { sessionId: null, type: 'revision', actorId: users.producer.id, actorName: users.producer.name, summary: 'Revision 1: initial running order' });

    // A speaker change, published as a real revision.
    const v2 = loadContent(db, showId);
    const p = v2.segments.find((s) => s.id === panel.id)!;
    p.performer = 'Moderator: Priya Nair (replaces Sam Patel)';
    publishContent(db, showId, users.producer, { baseRevision: 1, content: v2, dryRun: false, reason: 'Moderator change confirmed by client' });

    upsertMember(db, showId, users.director.id, 'director', [], null);
    upsertMember(db, showId, users.audio.id, 'operator', [D.audio], null);
    upsertMember(db, showId, users.lighting.id, 'operator', [D.lighting], null);
    upsertMember(db, showId, users.video.id, 'operator', [D.video], null);
    upsertMember(db, showId, users.stage.id, 'operator', [D.stage, D.foh], null);
    upsertMember(db, showId, users.viewer.id, 'viewer', [], null);

    if (opts.withSession !== false) {
      // A rehearsal already running, with one held cue. No console holds control
      // yet: the Director takes control explicitly when opening the console.
      startSession(db, showId, users.director, { userId: users.director.id, name: '', email: '', role: 'director', operateDepartments: [], visibleDepartments: null }, {
        mode: 'rehearsal',
        timingPolicy: 'projected',
        directorUserId: users.director.id,
        clientId: 'seed-console-0000',
      });
      const directorMember = { userId: users.director.id, name: users.director.name, email: users.director.email, role: 'director' as const, operateDepartments: [], visibleDepartments: null };
      const awardLx = cues.find((c) => c.number === '060' && c.departmentId === D.lighting)!;
      cueAction(db, showId, users.director, directorMember, {
        target: { kind: 'cue', id: awardLx.id },
        action: 'hold',
        reason: 'Waiting for the award result to be confirmed',
        idempotencyKey: 'seed-hold-award-lx',
        clientId: 'seed-console-0000',
      });
      run(db, 'UPDATE live_sessions SET control_client_id = NULL WHERE show_id = ?', showId);
    }

    // A reusable template derived from the show.
    const templateId = createShow(db, users.producer.id, {
      title: 'Conference general session (template)',
      eventDate: localDate(startMs, tz),
      timezone: tz,
      plannedStart: '09:00',
      venue: '',
      notes: 'Starter running order: doors, opening, host, keynote, break, close.',
      isTemplate: true,
    });
    const tpl = cloneContent(content);
    const keep = new Set(tpl.segments.slice(0, 5).map((s) => s.id));
    tpl.segments = tpl.segments.filter((s) => keep.has(s.id));
    tpl.cues = tpl.cues.filter((c) => keep.has(c.segmentId));
    tpl.groups = tpl.groups.filter((g) => tpl.cues.some((c) => c.groupId === g.id));
    writeContent(db, templateId, tpl);
    upsertMember(db, templateId, users.director.id, 'director', [], null);
    addEvent(db, templateId, { sessionId: null, type: 'show', actorId: users.producer.id, actorName: users.producer.name, summary: 'Template created' });

    return { users, showId, templateId, departments: D };
  });
}

async function main() {
  const { loadConfig } = await import('./config.ts');
  const { openDb } = await import('./db.ts');
  const config = loadConfig();
  if (process.argv.includes('--reset') && existsSync(config.databasePath)) {
    for (const suffix of ['', '-wal', '-shm']) rmSync(config.databasePath + suffix, { force: true });
  }
  const db = openDb(config.databasePath);
  const r = seedDemo(db);
  db.close();
  console.log(`Seeded Summit Live (${r.showId}) into ${config.databasePath}`);
  console.log(`Demo accounts (password "${DEMO_PASSWORD}"):`);
  for (const a of DEMO_ACCOUNTS) console.log(`  ${a.label.padEnd(20)} ${a.email}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main();
