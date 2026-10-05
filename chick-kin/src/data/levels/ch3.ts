// Stage 3 — Rafter Rivals (awkward adolescents). Vertical climbing: short flaps, controlled glides,
// balance, stamina and resting perches. Common steps ≤ 1.4 m (Mighty's single jump ≈ 1.6 m).
import type { LevelDef } from '../../sim/types';
import { ground, plank, sideStarts, route } from './kit';

const beam = (x: number, y: number, w: number) => plank(x, y, w, 'beam');

// Zig-zag of stable beams up to the goal perch.
const L31: LevelDef = {
  id: '3-1', chapter: 3, index: 1, title: 'First Flap',
  brief: 'Reach the upper perch.', tip: 'Press Space in mid-air to flap. Hold it while falling to glide. Land to rest your wings.',
  format: 'single', timeLimit: 300, music: 'rafters', medals: { time: 26 },
  phases: [{
    name: 'First Flap',
    objective: { kind: 'reach' },
    arena: {
      mode: 'side', theme: 'rafters', w: 26, h: 18, camera: 'vertical', killY: -4, fallRecovery: 4,
      starts: sideStarts(2, 0),
      solids: [
        ground(0, 26, 0, 'hay'),
        beam(6, 1.3, 4), beam(11, 2.6, 4), beam(16, 3.9, 4), beam(11.5, 5.2, 4), beam(6, 6.5, 4), beam(1.5, 7.8, 4),
        beam(6, 9.1, 4), beam(11, 10.4, 4), beam(16, 11.7, 4), beam(20.5, 13.0, 4), beam(15.5, 14.3, 4.5),
        // teal shortcut: wider flap gaps straight up the middle
        beam(21, 6.4, 2.5), beam(21.5, 9.2, 2.5),
      ],
      entities: [
        { t: 'checkpoint', x: 17, y: 3.9 }, { t: 'checkpoint', x: 2.5, y: 7.8 }, { t: 'checkpoint', x: 17, y: 11.7 },
        { t: 'finish', x: 16.2, y: 14.3, w: 3.2, h: 1.6 },
        { t: 'crumb', x: 3.5, y: 8.3 }, { t: 'crumb', x: 22.5, y: 13.5 },
        { t: 'power', x: 12, y: 5.7, pu: 'PU-08' },
        { t: 'deco', kind: 'hay', x: 23, y: 0 }, { t: 'deco', kind: 'lantern', x: 9, y: 0 },
      ],
      routes: [
        { color: 'common', nodes: route([[3, 0], [6.4, 1.3], [11.4, 2.6], [16.4, 3.9], [15.1, 5.2], [9.6, 6.5], [5.1, 7.8], [6.4, 9.1], [11.4, 10.4], [16.4, 11.7], [20.9, 13.0], [19.6, 14.3], [18, 14.3]]) },
        { color: 'teal', nodes: route([[3, 0], [6.4, 1.3], [11.4, 2.6], [16.4, 3.9], [19.6, 3.9], [21.4, 6.4], [22.2, 9.2], [19.6, 11.7], [20.9, 13.0], [19.6, 14.3], [18, 14.3]]) },
      ],
    },
  }],
  variants: [
    { name: 'Draft', add: [{ t: 'wind', x: 6, y: 6.6, w: 9, h: 3, fx: -6, fy: 0, on: 1.5, off: 3.5 }] },
    { name: 'Upper draft', add: [{ t: 'wind', x: 11, y: 10.5, w: 9, h: 3, fx: 6, fy: 0, on: 1.5, off: 3.5, phase: 0.5 }] },
  ],
};

// Wobbly perches over safe recovery beams. Brace (Ctrl) to stop sliding.
const L32: LevelDef = {
  id: '3-2', chapter: 3, index: 2, title: 'Sway Away',
  brief: 'Cross the wobbly perches to the upper perch.', tip: 'Wobbly perches tip you off — hold Ctrl / C to brace. Sticky Toes help too.',
  format: 'single', timeLimit: 300, music: 'rafters', medals: { time: 30 },
  phases: [{
    name: 'Sway Away',
    objective: { kind: 'reach' },
    arena: {
      mode: 'side', theme: 'rafters', w: 28, h: 19, camera: 'vertical', killY: -4, fallRecovery: 4,
      starts: sideStarts(2, 0),
      solids: [
        ground(0, 28, 0, 'hay'),
        beam(5, 1.3, 3.5), beam(17, 3.9, 4), beam(22.5, 5.2, 4), beam(17, 7.8, 3.5), beam(1.5, 9.1, 4),
        beam(6.5, 10.4, 3), beam(18.5, 13.0, 3.5), beam(22.5, 14.3, 4),
        // safe recovery beams below the wobbly section
        { x: 8.5, y: 1.9, w: 8, h: 0.4, kind: 'catchbed', oneWay: true },
        { x: 6, y: 7.0, w: 10, h: 0.4, kind: 'catchbed', oneWay: true },
        { x: 10, y: 11.0, w: 8, h: 0.4, kind: 'catchbed', oneWay: true },
      ],
      entities: [
        { t: 'wobbly', x: 9.5, y: 2.3, w: 2.6, amp: 0.22, period: 3.2 },
        { t: 'wobbly', x: 13.4, y: 3.2, w: 2.6, amp: 0.22, period: 3.2, phase: 0.5 },
        { t: 'wobbly', x: 12.5, y: 8.2, w: 2.6, amp: 0.24, period: 3.0 },
        { t: 'wobbly', x: 7.8, y: 8.4, w: 2.4, amp: 0.24, period: 3.0, phase: 0.5 },
        { t: 'wobbly', x: 11.2, y: 11.4, w: 2.6, amp: 0.26, period: 2.8 },
        { t: 'wobbly', x: 15.0, y: 12.2, w: 2.6, amp: 0.26, period: 2.8, phase: 0.5 },
        { t: 'checkpoint', x: 19, y: 3.9 }, { t: 'checkpoint', x: 2.5, y: 9.1 }, { t: 'checkpoint', x: 20, y: 13.0 },
        { t: 'power', x: 6.5, y: 1.8, pu: 'PU-06' }, { t: 'power', x: 3.5, y: 9.6, pu: 'PU-06' },
        { t: 'finish', x: 23.2, y: 14.3, w: 3.0, h: 1.6 },
        { t: 'crumb', x: 24.5, y: 5.7 }, { t: 'crumb', x: 8, y: 10.9 },
      ],
      routes: [
        { color: 'common', nodes: route([[3, 0], [5.8, 1.3], [8.2, 1.3], [10.2, 2.3], [11.6, 2.3], [14.1, 3.2], [15.6, 3.2], [17.6, 3.9], [20.4, 3.9], [23.1, 5.2], [24.4, 5.2], [20.0, 7.8], [17.4, 7.8], [14.4, 8.2], [13.2, 8.2], [9.6, 8.4], [8.4, 8.4], [5.0, 9.1], [3.0, 9.1], [7.0, 10.4], [9.0, 10.4], [11.8, 11.4], [13.4, 11.4], [15.6, 12.2], [16.9, 12.2], [19.0, 13.0], [21.6, 13.0], [23.2, 14.3], [24.8, 14.3]]) },
      ],
    },
  }],
  variants: [
    { name: 'Extra sway', add: [{ t: 'wind', x: 8, y: 2.4, w: 9, h: 2.5, fx: -5, fy: 0, on: 1.2, off: 4 }] },
  ],
};

// Gusts push you mid-air; spring branches bounce you up. Collect three golden feathers first.
const L33: LevelDef = {
  id: '3-3', chapter: 3, index: 3, title: 'Wind Wings',
  brief: 'Collect 3 golden feathers, then reach the upper perch.', tip: 'Gusts swirl before they blow. Springy branches bounce you higher — press Space as you land for an extra boost.',
  format: 'single', timeLimit: 300, music: 'rafters', medals: { time: 40, feathers: 3 },
  phases: [{
    name: 'Wind Wings',
    objective: { kind: 'reach', feathers: 3 },
    arena: {
      mode: 'side', theme: 'rafters', w: 28, h: 20, camera: 'vertical', killY: -4, fallRecovery: 4.5,
      starts: sideStarts(2, 0),
      solids: [
        ground(0, 28, 0, 'hay'),
        beam(6, 1.3, 3.5), beam(10.5, 2.6, 3.5), beam(15, 3.9, 4), beam(21, 3.9, 4), beam(23, 6.5, 3.5),
        beam(17.5, 7.8, 3.5), beam(12, 9.1, 3.5), beam(6.5, 10.4, 3.5), beam(1.5, 11.7, 3.5),
        beam(5, 13.0, 4), beam(10.5, 14.3, 4), beam(16, 15.6, 4.5),
      ],
      entities: [
        { t: 'spring', x: 19.4, y: 3.6, w: 1.2, power: 16, period: 2 },
        { t: 'wind', x: 10, y: 4.4, w: 8, h: 3.2, fx: 7, fy: 1.5, on: 1.6, off: 3.2 },
        { t: 'wind', x: 8, y: 11.0, w: 8, h: 3.2, fx: -7, fy: 1.5, on: 1.6, off: 3.2, phase: 0.5 },
        { t: 'feather', x: 8.0, y: 2.0 }, { t: 'feather', x: 24.8, y: 7.2 }, { t: 'feather', x: 2.6, y: 12.3 },
        { t: 'checkpoint', x: 16.5, y: 3.9 }, { t: 'checkpoint', x: 19, y: 7.8 }, { t: 'checkpoint', x: 3, y: 11.7 },
        { t: 'power', x: 13.5, y: 9.6, pu: 'PU-02' }, { t: 'power', x: 12, y: 3.1, pu: 'PU-08' },
        { t: 'finish', x: 16.8, y: 15.6, w: 3.2, h: 1.6 },
      ],
      routes: [
        { color: 'common', nodes: route([[3, 0], [6.4, 1.3], [8.0, 1.3], [11.0, 2.6], [13.6, 2.6], [15.6, 3.9], [18.7, 3.9, 'jump'], [21.6, 3.9], [23.4, 6.5], [25.2, 6.5], [23.4, 6.5], [20.6, 7.8], [18.0, 7.8], [15.2, 9.1], [12.6, 9.1], [9.6, 10.4], [7.0, 10.4], [4.6, 11.7], [2.6, 11.7], [5.6, 13.0], [8.4, 13.0], [11.0, 14.3], [14.0, 14.3], [16.6, 15.6], [18.4, 15.6]]) },
      ],
    },
  }],
  variants: [
    { name: 'Stronger gust', add: [{ t: 'wind', x: 15, y: 9.4, w: 6, h: 3, fx: 6, fy: 0, on: 1.4, off: 3.6, phase: 0.25 }] },
  ],
};

// Buckets swing through the gaps between stable beams: wait for a bucket to swing away, then cross.
// One marked bucket can be ridden as a shortcut.
const W = (e: number, lo: number, hi: number) => ({ e, lo, hi });
const L34: LevelDef = {
  id: '3-4', chapter: 3, index: 4, title: 'Bucket Crossing',
  brief: 'Time your crossings past the swinging buckets to reach the upper perch.', tip: 'Fast-swinging buckets knock you back. Wait at the beam edge until the bucket swings away, then jump.',
  format: 'single', timeLimit: 300, music: 'rafters', medals: { time: 40 },
  phases: [{
    name: 'Bucket Crossing',
    objective: { kind: 'reach' },
    arena: {
      mode: 'side', theme: 'rafters', w: 30, h: 18, camera: 'vertical', killY: -4, fallRecovery: 3.5,
      starts: sideStarts(1.5, 0),
      solids: [
        ground(0, 30, 0, 'hay'),
        beam(4, 1.3, 4), beam(1, 2.6, 3), beam(4.5, 3.9, 3.5),
        beam(10.2, 4.4, 3), beam(15.4, 4.9, 3), beam(20.6, 5.4, 3.4),
        beam(25.5, 6.7, 3.5), beam(21.5, 8.0, 3.5),
        beam(17.0, 8.5, 2.3), beam(11.6, 9.0, 3.2),
        beam(7.5, 10.3, 3), beam(3, 11.6, 3.5), beam(6.8, 12.9, 3.5), beam(11, 14.2, 4.5),
        { x: 8, y: 2.6, w: 13, h: 0.4, kind: 'catchbed', oneWay: true },
        { x: 13, y: 6.6, w: 9, h: 0.4, kind: 'catchbed', oneWay: true },
      ],
      entities: [
        { t: 'bucket', px: 9.1, py: 9.6, len: 4.6, amp: 0.55, period: 3.4 },
        { t: 'bucket', px: 14.3, py: 10.1, len: 4.6, amp: 0.55, period: 3.4, phase: 0.33 },
        { t: 'bucket', px: 19.5, py: 10.6, len: 4.6, amp: 0.55, period: 3.4, phase: 0.66 },
        { t: 'bucket', px: 20.4, py: 13.7, len: 4.6, amp: 0.55, period: 3.6 },
        { t: 'bucket', px: 15.9, py: 14.2, len: 4.6, amp: 0.5, period: 3.6, phase: 0.5, ride: true },
        { t: 'checkpoint', x: 6, y: 3.9 }, { t: 'checkpoint', x: 22, y: 5.4 }, { t: 'checkpoint', x: 13, y: 9.0 },
        { t: 'power', x: 16.6, y: 5.4, pu: 'PU-04' }, { t: 'power', x: 27.5, y: 7.2, pu: 'PU-08' },
        { t: 'finish', x: 11.6, y: 14.2, w: 3.4, h: 1.6 },
        { t: 'crumb', x: 2.5, y: 3.1 },
      ],
      routes: [
        { color: 'common', nodes: route([[2.5, 0], [4.6, 1.3], [6.8, 1.3], [3.5, 2.6], [1.6, 2.6], [5.0, 3.9],
          { x: 7.6, y: 3.9, a: 'wait', wait: W(0, 0.48, 0.62) }, [10.8, 4.4],
          { x: 12.8, y: 4.4, a: 'wait', wait: W(1, 0.48, 0.62) }, [16.0, 4.9],
          { x: 18.0, y: 4.9, a: 'wait', wait: W(2, 0.48, 0.62) }, [21.2, 5.4], [23.6, 5.4], [26.0, 6.7], [28.4, 6.7], [24.6, 8.0],
          { x: 21.9, y: 8.0, a: 'wait', wait: W(3, 0.98, 0.12) }, [18.8, 8.5],
          { x: 17.4, y: 8.5, a: 'wait', wait: W(4, 0.98, 0.12) }, [14.2, 9.0], [12.0, 9.0], [10.0, 10.3], [7.9, 10.3], [6.0, 11.6], [3.4, 11.6], [7.2, 12.9], [9.8, 12.9], [11.6, 14.2], [13.2, 14.2]]) },
      ],
    },
  }],
  variants: [
    { name: 'Crosswind', add: [{ t: 'wind', x: 8, y: 9.4, w: 10, h: 2.5, fx: -4, fy: 0, on: 1.2, off: 4 }] },
  ],
};

// Crown perch at the top: claim it for 15 s. Branching approaches: ramp beams (sprint), a hay bale step (push), aerial gaps.
const L35: LevelDef = {
  id: '3-5', chapter: 3, index: 5, title: 'King of the Rafters',
  brief: 'Hold the crown perch for 15 seconds.', tip: 'Brace (Ctrl / C) to resist nudges on the perch. Peck-nudge (E) or use your ability to clear it.',
  format: 'single', timeLimit: 420, music: 'rafters',
  phases: [{
    name: 'King of the Rafters',
    objective: { kind: 'perch', seconds: 15 },
    arena: {
      mode: 'side', theme: 'rafters', w: 30, h: 18, camera: 'vertical', killY: -4, fallRecovery: 4,
      starts: [[3, 0], [27, 0], [4, 0], [26, 0]],
      solids: [
        ground(0, 30, 0, 'hay'),
        // left approach (stable beams)
        beam(1, 1.3, 4), beam(5.5, 2.6, 3.5), beam(1.5, 3.9, 4), beam(5.5, 5.2, 4), beam(9.5, 6.5, 3.5),
        // right approach (aerial: wider gaps)
        beam(25, 1.3, 4), beam(21, 2.6, 3.5), beam(25, 4.2, 4), beam(20.5, 5.6, 3.5),
        // centre crown perch
        beam(13, 7.8, 4),
        { x: 11, y: 3.4, w: 8, h: 0.4, kind: 'catchbed', oneWay: true },
      ],
      entities: [
        { t: 'perch', x: 13.8, y: 7.8, w: 2.4, h: 1.4 },
        { t: 'checkpoint', x: 3, y: 3.9 }, { t: 'checkpoint', x: 27, y: 4.2 },
        { t: 'power', x: 15, y: 4.0, pu: 'PU-06', respawn: 10 }, { t: 'power', x: 7.5, y: 3.1, pu: 'PU-04', respawn: 12 }, { t: 'power', x: 22.5, y: 3.1, pu: 'PU-08', respawn: 12 },
        { t: 'deco', kind: 'lantern', x: 15, y: 0 },
      ],
      routes: [
        { color: 'common', nodes: route([[3, 0], [3.0, 1.3], [5.9, 2.6], [8.6, 2.6], [5.0, 3.9], [3.0, 3.9], [6.0, 5.2], [9.0, 5.2], [10.0, 6.5], [12.6, 6.5], [13.6, 7.8], [15, 7.8]]) },
        { color: 'teal', nodes: route([[27, 0], [27, 1.3], [24.2, 2.6], [21.4, 2.6], [25.4, 4.2], [27.4, 4.2], [23.6, 5.6], [21.0, 5.6], [16.4, 7.8], [15, 7.8]]) },
      ],
    },
  }],
  variants: [
    { name: 'Crosswind', add: [{ t: 'wind', x: 11, y: 7.9, w: 8, h: 2, fx: 3, fy: 0, on: 1.2, off: 4 }] },
  ],
};

export const CH3: LevelDef[] = [L31, L32, L33, L34, L35];
