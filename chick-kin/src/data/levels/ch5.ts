// Stage 5 — Barnyard Championship (almost grown). Scored events using everything learned.
// Camera changes only at marked transitions (relay legs / showdown rounds), with consistent controls.
import type { LevelDef, ArenaDef, PhaseDef, EntityDef } from '../../sim/types';
import { ground, plank, block, lowFence, sideStarts, topStarts, route, wall, border } from './kit';

const beam = (x: number, y: number, w: number) => plank(x, y, w, 'beam');

// ------------------------------------------------------------------ 5-1 Sprint Final
const sprintArena: ArenaDef = {
  mode: 'side', theme: 'championship', w: 118, h: 10, camera: 'follow', killY: -5,
  starts: sideStarts(1.2, 0),
  solids: [
    ground(0, 16, 0, 'plank'), lowFence(10, 0, 0.5, 0.7),
    ground(17.8, 40, 0, 'plank'), block(24, -4, 3, 1.0, 'crate'),
    ground(40, 58, 0.0, 'plank'), lowFence(48, 0, 0.5, 0.7),
    ground(60, 82, 0, 'plank'),
    ground(82, 118, 0, 'plank'),
    // teal aerial route over the middle section
    plank(28.5, 2.0, 2.5), plank(32, 3.0, 3), plank(36.5, 3.4, 4), plank(42, 3.0, 4), plank(47.5, 3.0, 3.5), plank(52.5, 2.2, 3),
    // gold sprint: a raised express lane after the pit, reached by a single step
    block(62, -4, 1.4, 1.0, 'crate'), plank(63.4, 1.9, 16),
  ],
  entities: [
    { t: 'straw', x: 34, y: 0, w: 1.0, h: 2.0, hp: 3 },
    { t: 'straw', x: 70, y: 0, w: 1.0, h: 1.6, hp: 3 },
    { t: 'straw', x: 76, y: 0, w: 1.0, h: 1.6, hp: 3 },
    { t: 'mud', x: 86, y: -0.2, w: 7, h: 0.4 },
    { t: 'egg', path: [[100, 0.42], [88, 0.42]], speed: 3.4, period: 6, r: 0.42 },
    { t: 'checkpoint', x: 19, y: 0 }, { t: 'checkpoint', x: 41.5, y: 0 }, { t: 'checkpoint', x: 61, y: 0 }, { t: 'checkpoint', x: 84, y: 0 },
    { t: 'power', x: 14, y: 0.7, pu: 'PU-01' }, { t: 'power', x: 66, y: 2.6, pu: 'PU-01' }, { t: 'power', x: 58.5, y: 0.7, pu: 'PU-05' }, { t: 'power', x: 83, y: 0.7, pu: 'PU-04' },
    { t: 'finish', x: 108, y: 0, w: 2.5, h: 3 },
    { t: 'deco', kind: 'ribbon-start', x: 3.6, y: 0 }, { t: 'deco', kind: 'scoreboard', x: 112, y: 0 }, { t: 'deco', kind: 'trophy', x: 114, y: 0, s: 1.3 },
  ],
  routes: [
    { color: 'common', nodes: route([[2, 0], [15.6, 0, 'jump'], [18.6, 0], [23.4, 0], [25.0, 1.0], [26.6, 1.0], [27.6, 0], [33.4, 0, 'peck'], [39.6, 0], [57.6, 0, 'jump'], [60.8, 0], [69.4, 0, 'peck'], [75.4, 0, 'peck'], [109.5, 0]]) },
    { color: 'teal', nodes: route([[2, 0], [15.6, 0, 'jump'], [18.6, 0], [23.4, 0], [25.0, 1.0], [26.6, 1.0], [27.8, 0], [28.8, 2.0], [32.4, 3.0], [37.0, 3.4], [42.4, 3.0], [47.8, 3.0], [52.8, 2.2], [55.0, 0], [57.6, 0, 'jump'], [60.8, 0], [61.6, 0], [62.6, 1.0], [64.2, 1.9], [78.8, 1.9], [80.6, 0], [109.5, 0]]) },
    { color: 'gold', nodes: route([[2, 0], [15.6, 0, 'jump'], [18.6, 0], [23.4, 0], [25.0, 1.0], [26.6, 1.0], [27.6, 0], [33.4, 0, 'peck'], [39.6, 0], [57.6, 0, 'jump'], [60.8, 0], [61.6, 0], [62.6, 1.0], [64.2, 1.9], [78.8, 1.9], [80.6, 0], [109.5, 0]]) },
    { color: 'red', nodes: route([[2, 0], [15.6, 0, 'jump'], [18.6, 0], [23.4, 0], [25.0, 1.0], [26.6, 1.0], [27.6, 0], [33.4, 0, 'peck'], [39.6, 0], [57.6, 0, 'jump'], [60.8, 0], [69.4, 0, 'peck'], [75.4, 0, 'peck'], [109.5, 0]]) },
  ],
};
const L51: LevelDef = {
  id: '5-1', chapter: 5, index: 1, title: 'Sprint Final',
  brief: 'Race through the obstacles and finish first!', tip: 'Gold express lane, red straw smash, teal high road — or the common course. Your pick!',
  format: 'single', timeLimit: 300, music: 'championship', medals: { time: 24 },
  phases: [{ name: 'Sprint Final', objective: { kind: 'race', requireFirst: true }, arena: sprintArena }],
  variants: [
    { name: 'Second egg', add: [{ t: 'egg', path: [[56, 0.42], [43, 0.42]], speed: 3.4, period: 6.5, r: 0.42 }] },
    { name: 'Crosswind', add: [{ t: 'wind', x: 30, y: 2, w: 20, h: 3, fx: -5, fy: 0, on: 1.4, off: 3.6 }] },
  ],
};

// ------------------------------------------------------------------ 5-2 Perch Final
const perchArena = (): ArenaDef => ({
  mode: 'side', theme: 'championship', w: 32, h: 16, camera: 'vertical', killY: -4, fallRecovery: 4,
  starts: [[3, 0], [29, 0], [4.2, 0], [27.8, 0]],
  solids: [
    ground(0, 32, 0, 'plank'),
    // tiered approach left (stable) and right (wobbly + aerial)
    beam(1, 1.4, 4), beam(5.5, 2.8, 4), beam(10, 4.2, 3.5), beam(7.5, 5.6, 3),
    beam(27, 1.4, 4), beam(22.5, 2.8, 4), beam(25.5, 4.4, 3.5), beam(21.5, 5.8, 3),
    // central tiered perch
    beam(12.5, 7.0, 7),
    { x: 11, y: 3.0, w: 10, h: 0.4, kind: 'catchbed', oneWay: true },
  ],
  entities: [
    { t: 'perch', x: 14.6, y: 7.0, w: 2.8, h: 1.4 },
    { t: 'wobbly', x: 18.0, y: 4.6, w: 2.4, amp: 0.2, period: 3.2 },
    { t: 'checkpoint', x: 2.5, y: 1.4 }, { t: 'checkpoint', x: 29.5, y: 1.4 },
    { t: 'power', x: 16, y: 3.9, pu: 'PU-06', respawn: 10 }, { t: 'power', x: 6.8, y: 3.4, pu: 'PU-04', respawn: 12 }, { t: 'power', x: 24.5, y: 3.4, pu: 'PU-02', respawn: 12 },
    { t: 'deco', kind: 'bunting', x: 16, y: 9, s: 1.4 },
  ],
  routes: [
    { color: 'common', nodes: route([[3, 0], [3.0, 1.4], [6.0, 2.8], [8.6, 2.8], [10.5, 4.2], [12.4, 4.2], [9.8, 5.6], [8.2, 5.6], [13.0, 7.0], [16, 7.0]]) },
    { color: 'teal', nodes: route([[29, 0], [29, 1.4], [26.0, 2.8], [23.2, 2.8], [26.0, 4.4], [28.4, 4.4], [24.0, 5.8], [22.0, 5.8], [19.0, 7.0], [16, 7.0]]) },
  ],
});
const L52: LevelDef = {
  id: '5-2', chapter: 5, index: 2, title: 'Perch Final',
  brief: 'Reach the top perch and hold it for 20 seconds.', tip: 'Brace to resist nudges; peck-nudge or use your ability to clear the perch.',
  format: 'single', timeLimit: 420, music: 'championship',
  phases: [{ name: 'Perch Final', objective: { kind: 'perch', seconds: 20 }, arena: perchArena() }],
  variants: [{ name: 'Gusty top', add: [{ t: 'wind', x: 12, y: 7.1, w: 8, h: 2, fx: 3.5, fy: 0, on: 1.2, off: 4 }] }],
};

// ------------------------------------------------------------------ 5-3 Harvest Haul
const haulArena = (piles: number, extra: EntityDef[] = []): ArenaDef => ({
  mode: 'top', theme: 'championship', w: 32, h: 20, camera: 'three-quarter',
  starts: topStarts(5, 10, 1.0).map(([x, y], i) => [x - 1.5 + (i % 2), y - 1.5 + i] as [number, number]),
  solids: [
    ...border(32, 20),
    wall(11, 0.6, 0.4, 6.0, 1.3, 'fence'), wall(11, 8.6, 0.4, 2.8, 1.3, 'fence'), wall(11, 14.0, 0.4, 3.4, 1.3, 'fence'),
    wall(20, 3.0, 0.4, 5.0, 1.3, 'fence'), wall(20, 12.0, 0.4, 5.0, 1.3, 'fence'),
    wall(20.4, 9.6, 2.8, 0.8, 0.5, 'fence'),
  ],
  entities: [
    { t: 'basket', x: 3, y: 10, r: 1.3 },
    { t: 'cornpile', x: 27, y: 4, count: piles, respawn: 5 }, { t: 'cornpile', x: 27, y: 10, count: piles, respawn: 5 }, { t: 'cornpile', x: 27, y: 16, count: piles, respawn: 5 },
    { t: 'crate', x: 10.6, y: 6.6, w: 1.2, h: 2.0, mass: 0.5 },
    { t: 'bale', x: 10.6, y: 11.4, w: 1.2, h: 2.6, mass: 1.0 },
    { t: 'mud', x: 14, y: 8, w: 4, h: 4 },
    { t: 'power', x: 15.5, y: 3, pu: 'PU-01', respawn: 14 }, { t: 'power', x: 15.5, y: 17, pu: 'PU-05', respawn: 14 }, { t: 'power', x: 24, y: 10, pu: 'PU-04', respawn: 14 },
    { t: 'deco', kind: 'scoreboard', x: 6, y: 1.6 }, { t: 'deco', kind: 'barn', x: 1, y: -6, s: 0.8 },
    ...extra,
  ],
});
const L53: LevelDef = {
  id: '5-3', chapter: 5, index: 3, title: 'Harvest Haul',
  brief: 'Be first to deliver 5 corn bundles to the barn!', tip: 'Bundles are heavy. A bump makes a carrier drop theirs — dropped bundles can be picked up by anyone.',
  format: 'single', timeLimit: 420, music: 'championship',
  phases: [{ name: 'Harvest Haul', objective: { kind: 'deliver', cargo: 'bundle', count: 5, requireFirst: true }, arena: haulArena(4) }],
  variants: [
    { name: 'Egg alley', add: [{ t: 'egg', path: [[13, 1.6], [13, 18.4]], speed: 3, period: 8, r: 0.42 }] },
    { name: 'Seedy field', add: [{ t: 'seed', x: 22.5, y: 6, w: 3, h: 8 }] },
  ],
};

// ------------------------------------------------------------------ 5-4 Farmyard Relay (legs: race → climb → haul)
const relayRace: ArenaDef = {
  mode: 'side', theme: 'championship', w: 64, h: 10, camera: 'follow', killY: -5,
  starts: sideStarts(1.2, 0),
  solids: [ground(0, 22, 0, 'plank'), lowFence(12, 0, 0.5, 0.7), ground(23.8, 44, 0, 'plank'), block(30, -4, 2.4, 1.0, 'crate'), ground(45.8, 64, 0, 'plank')],
  entities: [
    { t: 'straw', x: 38, y: 0, w: 1.0, h: 1.6, hp: 3 },
    { t: 'checkpoint', x: 25, y: 0 }, { t: 'checkpoint', x: 47, y: 0 },
    { t: 'power', x: 20, y: 0.7, pu: 'PU-01' },
    { t: 'finish', x: 58, y: 0, w: 2.5, h: 3 },
  ],
  routes: [{ color: 'common', nodes: route([[2, 0], [21.6, 0, 'jump'], [24.6, 0], [29.4, 0], [31.0, 1.0], [32.2, 1.0], [33.4, 0], [37.4, 0, 'peck'], [43.6, 0, 'jump'], [46.6, 0], [59.5, 0]]) }],
};
const relayClimb: ArenaDef = {
  mode: 'side', theme: 'championship', w: 22, h: 14, camera: 'vertical', killY: -4, fallRecovery: 4,
  starts: sideStarts(1.5, 0),
  solids: [ground(0, 22, 0, 'plank'), beam(5, 1.4, 3.5), beam(9.5, 2.8, 3.5), beam(14, 4.2, 3.5), beam(9.5, 5.6, 3.5), beam(5, 7.0, 3.5), beam(9.5, 8.4, 3.5), beam(14, 9.8, 4)],
  entities: [
    { t: 'checkpoint', x: 15, y: 4.2 },
    { t: 'power', x: 6.5, y: 7.6, pu: 'PU-08' },
    { t: 'finish', x: 14.6, y: 9.8, w: 3, h: 1.6 },
  ],
  routes: [{ color: 'common', nodes: route([[2, 0], [5.4, 1.4], [9.9, 2.8], [14.4, 4.2], [12.6, 5.6], [8.1, 7.0], [9.9, 8.4], [14.4, 9.8], [16, 9.8]]) }],
};
const relayHaul: ArenaDef = {
  mode: 'top', theme: 'championship', w: 24, h: 16, camera: 'three-quarter',
  starts: topStarts(4, 8, 1.0).map(([x, y], i) => [x - 1 + (i % 2), y - 1.5 + i] as [number, number]),
  solids: [...border(24, 16), wall(11, 0.6, 0.4, 5, 1.3, 'fence'), wall(11, 10.4, 0.4, 5, 1.3, 'fence')],
  entities: [
    { t: 'basket', x: 2.8, y: 8, r: 1.2 },
    { t: 'cornpile', x: 20, y: 4, count: 3, respawn: 4 }, { t: 'cornpile', x: 20, y: 12, count: 3, respawn: 4 },
    { t: 'power', x: 15, y: 8, pu: 'PU-01', respawn: 12 },
  ],
};
const L54: LevelDef = {
  id: '5-4', chapter: 5, index: 4, title: 'Farmyard Relay',
  brief: 'Race, climb, then haul: first to finish all three legs wins!', tip: 'Each leg changes the view. Controls stay the same.',
  format: 'relay', timeLimit: 420, music: 'championship',
  phases: [
    { name: 'Race', objective: { kind: 'race', requireFirst: false }, arena: relayRace },
    { name: 'Climb', objective: { kind: 'reach' }, arena: relayClimb },
    { name: 'Haul', objective: { kind: 'deliver', cargo: 'bundle', count: 2 }, arena: relayHaul },
  ],
  variants: [{ name: 'Race egg', phase: 0, add: [{ t: 'egg', path: [[56, 0.42], [47, 0.42]], speed: 3.2, period: 6.5, r: 0.42 }] }],
};

// ------------------------------------------------------------------ 5-5 Sibling Showdown (race, perch, haul + tie-break)
const showRace: ArenaDef = {
  mode: 'side', theme: 'championship', w: 56, h: 10, camera: 'follow', killY: -5,
  starts: sideStarts(1.2, 0),
  solids: [ground(0, 18, 0, 'plank'), lowFence(9, 0, 0.5, 0.7), ground(19.8, 38, 0, 'plank'), block(26, -4, 2.4, 1.0, 'crate'), ground(39.8, 56, 0, 'plank')],
  entities: [
    { t: 'straw', x: 33, y: 0, w: 1.0, h: 1.6, hp: 3 },
    { t: 'checkpoint', x: 21, y: 0 }, { t: 'checkpoint', x: 41, y: 0 },
    { t: 'power', x: 16, y: 0.7, pu: 'PU-01' },
    { t: 'finish', x: 50, y: 0, w: 2.5, h: 3 },
  ],
  routes: [{ color: 'common', nodes: route([[2, 0], [17.6, 0, 'jump'], [20.6, 0], [25.4, 0], [27.0, 1.0], [28.2, 1.0], [29.4, 0], [32.4, 0, 'peck'], [37.6, 0, 'jump'], [40.6, 0], [51.5, 0]]) }],
};
const showPerch = perchArena();
const showHaul = haulArena(3);
const tiebreakArena: ArenaDef = {
  mode: 'top', theme: 'championship', w: 16, h: 12, camera: 'close', crumbRespawn: 4,
  starts: topStarts(8, 6, 1.2),
  solids: [...border(16, 12)],
  entities: [
    ...[[3, 3], [8, 2.5], [13, 3], [3, 9], [8, 9.5], [13, 9], [5, 6], [11, 6], [2.5, 6], [13.5, 6]].map(([x, y]) => ({ t: 'crumb' as const, x, y })),
  ],
};
const showdownPhases: PhaseDef[] = [
  { name: 'Race', objective: { kind: 'race', requireFirst: false }, arena: showRace },
  { name: 'Perch', objective: { kind: 'perch', seconds: 12 }, arena: showPerch },
  { name: 'Haul', objective: { kind: 'deliver', cargo: 'bundle', count: 3 }, arena: showHaul },
];
const L55: LevelDef = {
  id: '5-5', chapter: 5, index: 5, title: 'Sibling Showdown',
  brief: 'Three rounds — race, perch, haul. Most points wins!', tip: 'Placements score 5 / 3 / 2 / 1 each round. A tie at the top goes to a crumb scramble.',
  format: 'showdown', timeLimit: 600, music: 'championship',
  phases: showdownPhases,
  tiebreak: { name: 'Crumb Scramble', objective: { kind: 'collect', count: 5 }, arena: tiebreakArena },
  variants: [{ name: 'Race egg', phase: 0, add: [{ t: 'egg', path: [[48, 0.42], [41, 0.42]], speed: 3.2, period: 6.5, r: 0.42 }] }],
};

export const CH5: LevelDef[] = [L51, L52, L53, L54, L55];
