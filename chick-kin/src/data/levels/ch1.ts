// Stage 1 — Nest Scramble (hatchlings). Close overhead nest arenas: wobble, hop, nudge, collect and tug.
// One new mechanic per level. No glide or stamina yet.
import type { LevelDef } from '../../sim/types';
import { ovalRim, wall, crumbs, crumbRing, crumbLine, topStarts } from './kit';

const L11: LevelDef = {
  id: '1-1', chapter: 1, index: 1, title: 'First Crumbs',
  brief: 'Collect 10 crumbs.', tip: 'Move with WASD / left stick. Tap Space to hop the low straw.',
  format: 'single', timeLimit: 600, music: 'nest',
  phases: [{
    name: 'First Crumbs',
    objective: { kind: 'collect', count: 10 },
    arena: {
      mode: 'top', theme: 'nest', w: 18, h: 12, camera: 'close', crumbRespawn: 7,
      starts: topStarts(9, 9.3),
      solids: [
        ...ovalRim(9, 6, 7.9, 5.1, 30, 0.8, 1.2),
        wall(5.6, 4.6, 0.5, 2.2, 0.32, 'straw'),   // safe hop
        wall(12.0, 4.6, 0.5, 2.2, 0.32, 'straw'),  // safe hop
      ],
      entities: [
        ...crumbs([[3.2, 6], [4.2, 4.2], [4.3, 7.8], [7.4, 2.4], [10.6, 2.4], [14.8, 6], [13.8, 4.2], [13.8, 7.8], [9, 4.3], [9, 7.2], [7, 6], [11, 6]]),
        ...crumbRing(9, 6, 5.0, 3.0, 6, 0.5),
        { t: 'power', x: 9, y: 2.2, pu: 'PU-01' },
        { t: 'deco', kind: 'egg', x: 3.6, y: 3.3, s: 1 },
        { t: 'deco', kind: 'egg', x: 15.3, y: 8.6, s: 0.9 },
        { t: 'deco', kind: 'flower', x: 1.2, y: 1.0 },
        { t: 'deco', kind: 'flower', x: 16.8, y: 11.0 },
        { t: 'deco', kind: 'mound', x: 15.2, y: 3.0, s: 0.8 },
      ],
    },
  }],
  variants: [
    { name: 'Wandering egg', add: [{ t: 'egg', path: [[3, 2.6], [15, 2.6]], speed: 2.4, period: 6 }] },
    { name: 'Second wandering egg', add: [{ t: 'egg', path: [[15, 9.4], [3, 9.4]], speed: 2.4, period: 7, phase: 0.5 }] },
  ],
};

// Winding lanes: rolling eggs are telegraphed by a wobble at the top of their lane. Hop them or step aside.
const L12: LevelDef = {
  id: '1-2', chapter: 1, index: 2, title: 'Egg Dodge',
  brief: 'Collect 15 crumbs.', tip: 'Eggs wobble before they roll. Hop with Space or step aside.',
  format: 'single', timeLimit: 600, music: 'nest',
  phases: [{
    name: 'Egg Dodge',
    objective: { kind: 'collect', count: 15 },
    arena: {
      mode: 'top', theme: 'nest', w: 22, h: 14, camera: 'close', crumbRespawn: 8,
      starts: topStarts(10.5, 12.1),
      solids: [
        ...ovalRim(11, 7, 10.8, 6.9, 36, 0.8, 1.2),
        wall(2.5, 4.6, 14.5, 0.7, 1.2, 'straw'),   // lane divider (open on the right)
        wall(5.0, 8.7, 14.5, 0.7, 1.2, 'straw'),   // lane divider (open on the left)
      ],
      entities: [
        { t: 'egg', path: [[18.5, 2.6], [4.0, 2.6]], speed: 2.6, period: 7.5 },
        { t: 'egg', path: [[3.5, 6.6], [18.5, 6.6]], speed: 2.6, period: 7.5, phase: 0.33 },
        { t: 'egg', path: [[18.5, 10.8], [5.0, 10.8]], speed: 2.6, period: 7.5, phase: 0.66 },
        ...crumbLine(5, 2.6, 17, 2.6, 6), ...crumbLine(5, 6.6, 17, 6.6, 6), ...crumbLine(7, 10.8, 17, 10.8, 5),
        ...crumbs([[19.5, 4.6], [2.6, 8.8], [19.8, 8.6], [20.0, 7.0]]),
        { t: 'power', x: 17.4, y: 3.6, pu: 'PU-04' },
        { t: 'deco', kind: 'ramp', x: 19.2, y: 1.8, s: 0.9 },
        { t: 'deco', kind: 'ramp', x: 2.8, y: 5.8, s: 0.9 },
        { t: 'deco', kind: 'egg', x: 20.5, y: 12.4, s: 1.2 },
      ],
    },
  }],
  variants: [
    { name: 'Faster lane', add: [{ t: 'egg', path: [[3.5, 6.0], [18.5, 6.0]], speed: 3.0, period: 9, phase: 0.8 }] },
    { name: 'Double top lane', add: [{ t: 'egg', path: [[18.5, 3.2], [4.0, 3.2]], speed: 2.4, period: 9, phase: 0.5 }] },
  ],
};

// Three linked mini-nests, each with a tug worm. Get in position and HOLD interact, leaning away.
const L13: LevelDef = {
  id: '1-3', chapter: 1, index: 3, title: 'Worm Tug',
  brief: 'Win 3 worms by tugging.', tip: 'Stand by a worm and hold E. Lean away from the worm to pull harder. No mashing needed!',
  format: 'single', timeLimit: 600, music: 'nest',
  phases: [{
    name: 'Worm Tug',
    objective: { kind: 'tug', count: 3 },
    arena: {
      mode: 'top', theme: 'nest', w: 22, h: 14, camera: 'close', crumbRespawn: 10,
      starts: [[3.6, 9.4], [4.6, 10.3], [17.4, 10.3], [18.4, 9.4]],
      solids: [
        ...ovalRim(11, 7, 10.8, 6.9, 36, 0.8, 1.2),
        ...ovalRim(5.6, 5.0, 3.0, 2.4, 16, 0.6, 1.2, [0, Math.PI / 2]),
        ...ovalRim(16.4, 5.0, 3.0, 2.4, 16, 0.6, 1.2, [Math.PI, Math.PI / 2]),
        ...ovalRim(11, 9.6, 2.8, 1.9, 16, 0.6, 1.2, [-Math.PI / 2, Math.PI / 2 + 0.4, Math.PI / 2 - 0.4]),
      ],
      entities: [
        { t: 'tugworm', x: 5.6, y: 5.0 }, { t: 'tugworm', x: 16.4, y: 5.0 }, { t: 'tugworm', x: 11, y: 9.6 },
        ...crumbs([[11, 3.0], [11, 5.4], [8.6, 7.4], [13.4, 7.4], [3.2, 9.6], [18.8, 9.6]]),
        { t: 'power', x: 11, y: 2.0, pu: 'PU-01' },
        { t: 'deco', kind: 'flower', x: 2.0, y: 2.0 }, { t: 'deco', kind: 'egg', x: 19.6, y: 11.8, s: 1 },
      ],
    },
  }],
  variants: [
    { name: 'Rolling interloper', add: [{ t: 'egg', path: [[3, 1.8], [19, 1.8]], speed: 2.2, period: 8 }] },
  ],
};

// Straw partitions with small gaps; peck loose straw plugs, or shove the heavy plug (red route).
const L14: LevelDef = {
  id: '1-4', chapter: 1, index: 4, title: 'Nest Neighbours',
  brief: 'Collect 20 crumbs.', tip: 'Peck loose straw plugs with E to open gaps. Mighty can shove the heavy plug.',
  format: 'single', timeLimit: 600, music: 'nest',
  phases: [{
    name: 'Nest Neighbours',
    objective: { kind: 'collect', count: 20 },
    arena: {
      mode: 'top', theme: 'nest', w: 24, h: 15, camera: 'close', crumbRespawn: 9,
      starts: topStarts(3.8, 7.5, 0.0).map(([x, y], i) => [x, y - 1.2 + i * 0.8] as [number, number]),
      solids: [
        ...ovalRim(12, 7.5, 11.8, 7.4, 40, 0.8, 1.2),
        // vertical partitions with gaps
        wall(7.6, 1.6, 0.6, 4.0, 1.2, 'straw'), wall(7.6, 7.2, 0.6, 2.6, 1.2, 'straw'), wall(7.6, 11.4, 0.6, 2.2, 1.2, 'straw'),
        wall(16.0, 1.4, 0.6, 2.6, 1.2, 'straw'), wall(16.0, 5.6, 0.6, 4.0, 1.2, 'straw'), wall(16.0, 11.2, 0.6, 2.4, 1.2, 'straw'),
        // horizontal partitions
        wall(9.8, 4.4, 4.4, 0.6, 1.2, 'straw'), wall(9.8, 10.4, 4.4, 0.6, 1.2, 'straw'),
        wall(18.6, 7.2, 3.0, 0.6, 0.32, 'straw'),  // hop-over
      ],
      entities: [
        { t: 'straw', x: 7.55, y: 5.6, w: 0.7, h: 1.6, hp: 3 },     // plug: left upper gap
        { t: 'straw', x: 15.95, y: 9.6, w: 0.7, h: 1.6, hp: 3 },    // plug: right lower gap
        { t: 'bale', x: 15.9, y: 4.0, w: 0.8, h: 1.6, mass: 1.0 },  // heavy plug (red route)
        ...crumbs([[4.8, 3.8], [4.8, 11.2], [5.0, 5.6], [5.5, 9.4]]),
        ...crumbs([[10.5, 2.4], [13.5, 2.4], [12, 6.0], [10.4, 7.6], [13.6, 7.6], [12, 9.2], [10.5, 12.4], [13.5, 12.4]]),
        ...crumbs([[18.5, 2.6], [21.0, 4.4], [19.0, 9.6], [20.2, 10.6], [18.4, 11.8], [20.6, 6.0]]),
        { t: 'power', x: 12, y: 7.6, pu: 'PU-04' },
        { t: 'power', x: 20.4, y: 8.4, pu: 'PU-01' },
      ],
    },
  }],
  variants: [
    { name: 'Corridor egg', add: [{ t: 'egg', path: [[9.0, 13.2], [15.0, 13.2]], speed: 2.4, period: 7 }] },
    { name: 'Upper egg', add: [{ t: 'egg', path: [[15.0, 2.0], [9.0, 2.0]], speed: 2.4, period: 7, phase: 0.5 }] },
  ],
};

// Central mound perch with ramps (gaps in the rim) and hop-able rim. 15 s of ownership; contest pauses it.
const moundRim = () => {
  const out = [] as ReturnType<typeof wall>[];
  // low ring around the mound with four ramp openings (N, E, S, W)
  const n = 16;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.PI / n;
    if (i % 4 === 0 || i % 4 === 3) { /* keep */ } else continue;
    out.push(wall(10 + Math.cos(a) * 2.2 - 0.35, 7.5 + Math.sin(a) * 2.2 - 0.35, 0.7, 0.7, 0.3, 'straw'));
  }
  return out;
};
const L15: LevelDef = {
  id: '1-5', chapter: 1, index: 5, title: 'Nest Champion',
  brief: 'Hold the perch for 15 seconds.', tip: 'Only a lone chick on the perch earns time. Nudge siblings off with your ability (Shift)!',
  format: 'single', timeLimit: 600, music: 'nest',
  phases: [{
    name: 'Nest Champion',
    objective: { kind: 'perch', seconds: 15 },
    arena: {
      mode: 'top', theme: 'nest', w: 20, h: 15, camera: 'close',
      starts: [[4, 7.5], [16, 7.5], [10, 13.0], [10, 2.0]],
      solids: [
        ...ovalRim(10, 7.5, 9.6, 7.0, 36, 0.8, 1.2),
        ...moundRim(),
        wall(3.0, 3.0, 2.2, 0.6, 1.2, 'straw'), wall(14.8, 11.4, 2.2, 0.6, 1.2, 'straw'),
      ],
      entities: [
        { t: 'mound', x: 10, y: 7.5, r: 2.4, elev: 0.35 },
        { t: 'perch', x: 9.2, y: 6.7, w: 1.6, h: 1.6 },
        { t: 'power', x: 4.0, y: 3.8, pu: 'PU-04', respawn: 12 },
        { t: 'power', x: 16.0, y: 11.0, pu: 'PU-01', respawn: 12 },
        ...crumbs([[4, 11], [16, 4], [6.5, 12.5], [13.5, 2.5]]),
        { t: 'deco', kind: 'ramp', x: 10, y: 4.6, s: 0.8, r: Math.PI / 2 }, { t: 'deco', kind: 'ramp', x: 10, y: 10.4, s: 0.8, r: -Math.PI / 2 },
        { t: 'deco', kind: 'ramp', x: 7.1, y: 7.5, s: 0.8 }, { t: 'deco', kind: 'ramp', x: 12.9, y: 7.5, s: 0.8, r: Math.PI },
      ],
    },
  }],
  variants: [
    { name: 'Circling egg', add: [{ t: 'egg', path: [[3.0, 12.0], [17.0, 12.0]], speed: 2.4, period: 8 }] },
    { name: 'Return egg', add: [{ t: 'egg', path: [[17.0, 3.0], [3.0, 3.0]], speed: 2.4, period: 8, phase: 0.5 }] },
  ],
};

export const CH1: LevelDef[] = [L11, L12, L13, L14, L15];
