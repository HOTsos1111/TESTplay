// Stage 2 — Coop Dash (fluffy chicks). Side-scrolling platform races: run, jump, duck, peck, push.
// Common routes stay within the weakest jump (Mighty ≈ 1.49 m up, ≈ 2.5 m across).
import type { LevelDef } from '../../sim/types';
import { ground, plank, block, lowFence, sideStarts, route } from './kit';

const L21: LevelDef = {
  id: '2-1', chapter: 2, index: 1, title: 'Coop Sprint',
  brief: 'Reach the finish!', tip: 'Hold Space for a bigger jump, tap for a hop. Lanterns are checkpoints.',
  format: 'single', timeLimit: 240, music: 'coop', medals: { time: 16 },
  phases: [{
    name: 'Coop Sprint',
    objective: { kind: 'race', requireFirst: false },
    arena: {
      mode: 'side', theme: 'coop', w: 70, h: 10, camera: 'follow', killY: -4,
      starts: sideStarts(1.2, 0),
      solids: [
        ground(0, 14, 0),
        block(14, -4, 3, 0.5), block(15.5, -4, 1.5, 1.0),
        ground(17, 24, 1),
        ground(25.6, 33, 1),
        ground(33, 41, 0),
        block(37.8, 0, 1.2, 0.8, 'crate'),
        ground(41, 48, 0),
        ground(49.7, 70, 0),
        plank(18, 2.6, 2.6), plank(21.6, 3.2, 2.6), plank(25.2, 3.2, 2.8), plank(28.8, 2.6, 2.4),
      ],
      entities: [
        { t: 'checkpoint', x: 10, y: 0 }, { t: 'checkpoint', x: 27, y: 1 }, { t: 'checkpoint', x: 43, y: 0 }, { t: 'checkpoint', x: 53, y: 0 },
        { t: 'crumb', x: 19.3, y: 3.1 }, { t: 'crumb', x: 22.9, y: 3.7 }, { t: 'crumb', x: 26.6, y: 3.7 },
        { t: 'power', x: 44.5, y: 0.6, pu: 'PU-01' },
        { t: 'finish', x: 63, y: 0, w: 2.5, h: 3 },
        { t: 'deco', kind: 'ribbon-start', x: 0.5, y: 0 },
        { t: 'deco', kind: 'hay', x: 8, y: 0 }, { t: 'deco', kind: 'hay', x: 46, y: 0 },
      ],
      routes: [
        { color: 'common', nodes: route([[2, 0], [13.4, 0], [15, 0.5], [16.6, 1], [23.8, 1, 'jump'], [26.6, 1], [32.8, 1], [34.2, 0], [37.4, 0, 'jump'], [39.8, 0], [47.8, 0, 'jump'], [50.6, 0], [64.5, 0]]) },
        { color: 'teal', nodes: route([[2, 0], [13.4, 0], [15, 0.5], [17.4, 1], [19.0, 2.6], [22.6, 3.2], [26.8, 3.2], [29.8, 2.6], [31.6, 1], [32.8, 1], [34.2, 0], [37.4, 0, 'jump'], [39.8, 0], [47.8, 0, 'jump'], [50.6, 0], [64.5, 0]]) },
      ],
    },
  }],
  variants: [
    { name: 'Rolling egg', add: [{ t: 'egg', path: [[46, 0.35], [36, 0.35]], speed: 3, period: 6 }] },
    { name: 'Mud patch', add: [{ t: 'mud', x: 52, y: -0.2, w: 4, h: 0.4 }] },
  ],
};

// Alternating low fence gaps (duck) and safe jump gaps.
const L22: LevelDef = {
  id: '2-2', chapter: 2, index: 2, title: 'Under and Over',
  brief: 'Reach the finish!', tip: 'Hold Ctrl / C to duck under low fences. Jump the gaps.',
  format: 'single', timeLimit: 240, music: 'coop', medals: { time: 18 },
  phases: [{
    name: 'Under and Over',
    objective: { kind: 'race', requireFirst: false },
    arena: {
      mode: 'side', theme: 'coop', w: 74, h: 10, camera: 'follow', killY: -4,
      starts: sideStarts(1.2, 0),
      solids: [
        ground(0, 12, 0), lowFence(7.5, 0),
        ground(13.6, 26, 0), lowFence(18, 0), lowFence(22, 0),
        ground(27.7, 40, 0), block(31.5, -4, 3, 0.9, 'crate'), lowFence(37, 0),
        ground(41.6, 56, 0), lowFence(46, 0), lowFence(50.5, 0),
        ground(57.6, 74, 0),
        // teal high route over the double fence
        plank(14.6, 1.6, 2.0), plank(16.9, 2.8, 6.6),
      ],
      entities: [
        { t: 'checkpoint', x: 15, y: 0 }, { t: 'checkpoint', x: 29, y: 0 }, { t: 'checkpoint', x: 43, y: 0 }, { t: 'checkpoint', x: 59, y: 0 },
        { t: 'crumb', x: 18.5, y: 3.3 }, { t: 'crumb', x: 20.5, y: 3.3 }, { t: 'crumb', x: 22.5, y: 3.3 },
        { t: 'power', x: 33, y: 1.5, pu: 'PU-01' },
        { t: 'finish', x: 67, y: 0, w: 2.5, h: 3 },
        { t: 'deco', kind: 'ribbon-start', x: 0.5, y: 0 }, { t: 'deco', kind: 'hay', x: 60, y: 0 },
      ],
      routes: [
        { color: 'common', nodes: route([[2, 0], [11.7, 0, 'jump'], [14.2, 0], [25.7, 0, 'jump'], [28.2, 0], [31.0, 0], [32.6, 0.9], [34.2, 0.9], [35.4, 0], [39.6, 0, 'jump'], [42.2, 0], [55.6, 0, 'jump'], [58.2, 0], [68.5, 0]]) },
        { color: 'teal', nodes: route([[2, 0], [11.7, 0, 'jump'], [14.2, 0], [14.8, 0], [15.6, 1.6], [17.6, 2.8], [23.2, 2.8], [24.6, 0], [25.7, 0, 'jump'], [28.2, 0], [31.0, 0], [32.6, 0.9], [34.2, 0.9], [35.4, 0], [39.6, 0, 'jump'], [42.2, 0], [55.6, 0, 'jump'], [58.2, 0], [68.5, 0]]) },
      ],
    },
  }],
  variants: [
    { name: 'Egg under the fence', add: [{ t: 'egg', path: [[55, 0.35], [44, 0.35]], speed: 3, period: 7 }] },
    { name: 'Early egg', add: [{ t: 'egg', path: [[25, 0.35], [15, 0.35]], speed: 3, period: 7, phase: 0.4 }] },
  ],
};

// Branching lanes: lower lane has straw barriers to peck (Mighty bumps through), upper planks have gaps.
const L23: LevelDef = {
  id: '2-3', chapter: 2, index: 3, title: 'Straw Shortcut',
  brief: 'Choose a lane and finish first!', tip: 'Press E to peck straw barriers. Up top: no straw, but mind the gaps.',
  format: 'single', timeLimit: 240, music: 'coop', medals: { time: 20 },
  phases: [{
    name: 'Straw Shortcut',
    objective: { kind: 'race', requireFirst: true },
    arena: {
      mode: 'side', theme: 'coop', w: 72, h: 10, camera: 'follow', killY: -4,
      starts: sideStarts(1.2, 0),
      solids: [
        ground(0, 50, 0),
        plank(9.2, 1.1, 1.6),
        plank(11.0, 2.1, 9.0), plank(21.6, 2.1, 9.0), plank(32.2, 2.1, 7.8),
        ground(51.6, 72, 0),
      ],
      entities: [
        { t: 'straw', x: 16, y: 0, w: 1.0, h: 1.6, hp: 3 },
        { t: 'straw', x: 24, y: 0, w: 1.0, h: 1.6, hp: 3 },
        { t: 'straw', x: 32.8, y: 0, w: 1.0, h: 1.6, hp: 3 },
        { t: 'straw', x: 58, y: 0, w: 1.0, h: 2.6, hp: 3 },
        { t: 'checkpoint', x: 8, y: 0 }, { t: 'checkpoint', x: 42, y: 0 }, { t: 'checkpoint', x: 54, y: 0 },
        { t: 'crumb', x: 14, y: 2.6 }, { t: 'crumb', x: 26, y: 2.6 }, { t: 'crumb', x: 36, y: 2.6 },
        { t: 'power', x: 44, y: 0.6, pu: 'PU-01' },
        { t: 'power', x: 6, y: 0.6, pu: 'PU-05' },
        { t: 'finish', x: 65, y: 0, w: 2.5, h: 3 },
        { t: 'deco', kind: 'ribbon-start', x: 0.5, y: 0 }, { t: 'deco', kind: 'hay', x: 46, y: 0 },
      ],
      routes: [
        { color: 'common', nodes: route([[2, 0], [15.4, 0, 'peck'], [23.4, 0, 'peck'], [32.2, 0, 'peck'], [49.7, 0, 'jump'], [52.4, 0], [57.4, 0, 'peck'], [66.5, 0]]) },
        { color: 'gold', nodes: route([[2, 0], [9.0, 0], [10.2, 1.0], [12.0, 2.1], [19.8, 2.1, 'jump'], [22.8, 2.1], [30.4, 2.1, 'jump'], [33.4, 2.1], [39.8, 2.1], [41.4, 0], [49.7, 0, 'jump'], [52.4, 0], [57.4, 0, 'peck'], [66.5, 0]]) },
        { color: 'teal', nodes: route([[2, 0], [9.0, 0], [10.2, 1.0], [12.0, 2.1], [19.8, 2.1, 'jump'], [22.8, 2.1], [30.4, 2.1, 'jump'], [33.4, 2.1], [39.8, 2.1], [41.4, 0], [49.7, 0, 'jump'], [52.4, 0], [57.4, 0, 'peck'], [66.5, 0]]) },
      ],
    },
  }],
  variants: [
    { name: 'Lower-lane egg', add: [{ t: 'egg', path: [[48, 0.35], [36, 0.35]], speed: 3, period: 7 }] },
    { name: 'Mud before the line', add: [{ t: 'mud', x: 60, y: -0.2, w: 3, h: 0.4 }] },
  ],
};

// Moving crates over a mud pit (or wade through), a tunnel shortcut blocked by a heavy hay bale (shove it),
// and a long sprint to the line.
const L24: LevelDef = {
  id: '2-4', chapter: 2, index: 4, title: 'Mud Run',
  brief: 'Cross the mud and finish first!', tip: 'Ride the moving crates over the mud. Mighty (or Power Corn) can shove the bale through the tunnel.',
  format: 'single', timeLimit: 240, music: 'coop', medals: { time: 22 },
  phases: [{
    name: 'Mud Run',
    objective: { kind: 'race', requireFirst: true },
    arena: {
      mode: 'side', theme: 'coop', w: 76, h: 10, camera: 'follow', killY: -5,
      starts: sideStarts(1.2, 0),
      solids: [
        ground(0, 12, 0),
        ground(12, 31, -0.5),
        ground(31, 47, 0),
        block(31.2, -4, 1.4, 1.1, 'crate'),
        block(34, 1.3, 10, 2.2, 'wood'),              // tunnel roof; its top is the upper route
        ground(48.8, 76, 0),
      ],
      entities: [
        { t: 'mud', x: 12, y: -0.7, w: 19, h: 0.4 },
        { t: 'mover', x: 13.0, y: 0.15, w: 1.6, h: 0.35, x2: 17.6, y2: 0.15, period: 5 },
        { t: 'mover', x: 19.0, y: 0.15, w: 1.6, h: 0.35, x2: 23.6, y2: 0.15, period: 5, phase: 0.5 },
        { t: 'mover', x: 25.0, y: 0.15, w: 1.6, h: 0.35, x2: 29.0, y2: 0.15, period: 5 },
        { t: 'bale', x: 37, y: 0, w: 1.1, h: 1.1, mass: 1.0 },
        { t: 'power', x: 30, y: 1.2, pu: 'PU-05' },
        { t: 'power', x: 50, y: 0.6, pu: 'PU-01' },
        { t: 'checkpoint', x: 9, y: 0 }, { t: 'checkpoint', x: 32.4, y: 1.1 }, { t: 'checkpoint', x: 49, y: 0 },
        { t: 'crumb', x: 36, y: 2.7 }, { t: 'crumb', x: 39, y: 2.7 }, { t: 'crumb', x: 42, y: 2.7 },
        { t: 'finish', x: 69, y: 0, w: 2.5, h: 3 },
        { t: 'deco', kind: 'ribbon-start', x: 0.5, y: 0 }, { t: 'deco', kind: 'hay', x: 56, y: 0 },
      ],
      routes: [
        { color: 'common', nodes: route([[2, 0], [11.8, 0], [13, -0.5], [30.6, -0.5], [31.8, 1.1], [32.3, 1.1, 'jump'], [35.0, 2.2], [43.6, 2.2], [44.6, 0], [46.8, 0, 'jump'], [49.6, 0], [70.5, 0]]) },
        { color: 'red', nodes: route([[2, 0], [11.8, 0], [13, -0.5], [29.5, -0.5], [30.6, -0.5], [31.8, 1.1], [32.3, 1.1], [33.6, 0], [35.6, 0, 'push'], [44.4, 0, 'push'], [46.8, 0, 'jump'], [49.6, 0], [70.5, 0]]), },
      ],
    },
  }],
  variants: [
    { name: 'Sprint-lane egg', add: [{ t: 'egg', path: [[66, 0.35], [50, 0.35]], speed: 3.2, period: 7 }] },
    { name: 'Second mud', add: [{ t: 'mud', x: 55, y: -0.2, w: 4, h: 0.4 }] },
  ],
};

// Full course: duck, peck, jump, shove, ride. 
const L25: LevelDef = {
  id: '2-5', chapter: 2, index: 5, title: 'Coop Cup',
  brief: 'Use all your skills and finish first!', tip: 'Duck, peck, jump and shove — and use your ability (Shift) at the right moment!',
  format: 'single', timeLimit: 300, music: 'coop', medals: { time: 30 },
  phases: [{
    name: 'Coop Cup',
    objective: { kind: 'race', requireFirst: true },
    arena: {
      mode: 'side', theme: 'coop', w: 104, h: 10, camera: 'follow', killY: -5,
      starts: sideStarts(1.2, 0),
      solids: [
        ground(0, 15, 0), lowFence(8, 0),
        ground(16.7, 34, 0), lowFence(26, 0),
        block(20, -4, 2.5, 0.9, 'crate'),
        ground(34, 48, 1.0), block(33, -4, 1.0, 0.5),
        ground(49.7, 62, 1.0),
        ground(62, 80, -0.5),
        ground(80, 104, 0),
        plank(37, 2.6, 3), plank(41.2, 3.2, 3), plank(45.2, 2.8, 3),    // teal / gold over the straw
        plank(65, 1.2, 3.0), plank(70, 1.2, 3.0), plank(75, 1.2, 3.0),    // hops over the mud
      ],
      entities: [
        { t: 'straw', x: 40, y: 1.0, w: 1.0, h: 1.6, hp: 3 },
        { t: 'straw', x: 86, y: 0, w: 1.0, h: 2.6, hp: 3 },
        { t: 'mud', x: 62, y: -0.7, w: 18, h: 0.4 },
        { t: 'egg', path: [[60.5, 1.35], [51, 1.35]], speed: 3, period: 6.5 },
        { t: 'bale', x: 91, y: 0, w: 1.1, h: 1.1, mass: 1.0 },
        { t: 'checkpoint', x: 18, y: 0 }, { t: 'checkpoint', x: 36, y: 1 }, { t: 'checkpoint', x: 52, y: 1 }, { t: 'checkpoint', x: 82, y: 0 },
        { t: 'power', x: 13, y: 0.6, pu: 'PU-04' }, { t: 'power', x: 58, y: 1.6, pu: 'PU-01' }, { t: 'power', x: 83.5, y: 0.6, pu: 'PU-05' },
        { t: 'crumb', x: 38.5, y: 3.1 }, { t: 'crumb', x: 42.7, y: 3.7 }, { t: 'crumb', x: 46.7, y: 3.3 },
        { t: 'finish', x: 97, y: 0, w: 2.5, h: 3 },
        { t: 'deco', kind: 'ribbon-start', x: 0.5, y: 0 }, { t: 'deco', kind: 'trophy', x: 101.5, y: 0, s: 1.2 },
      ],
      routes: [
        { color: 'common', nodes: route([[2, 0], [14.8, 0, 'jump'], [17.4, 0], [19.6, 0], [21.2, 0.9], [22.6, 0.9], [23.4, 0], [32.6, 0], [33.4, 0.5], [34.6, 1.0], [39.4, 1.0, 'peck'], [47.8, 1.0, 'jump'], [50.4, 1.0], [61.6, 1.0], [62.6, -0.5], [79.4, -0.5], [80.6, 0], [85.4, 0, 'peck'], [90.2, 0], [90.4, 0, 'jump'], [92.8, 0], [98.5, 0]]) },
        { color: 'teal', nodes: route([[2, 0], [14.8, 0, 'jump'], [17.4, 0], [19.6, 0], [21.2, 0.9], [22.6, 0.9], [23.4, 0], [32.6, 0], [33.4, 0.5], [34.6, 1.0], [36.4, 1.0], [37.8, 2.6], [42.0, 3.2], [46.0, 2.8], [47.8, 1.0, 'jump'], [50.4, 1.0], [61.6, 1.0], [62.4, -0.5], [64.4, -0.5], [65.8, 1.2], [70.6, 1.2], [75.6, 1.2], [77.6, -0.5], [79.4, -0.5], [80.6, 0], [85.4, 0, 'peck'], [90.2, 0], [90.4, 0, 'jump'], [92.8, 0], [98.5, 0]]) },
        { color: 'red', nodes: route([[2, 0], [14.8, 0, 'jump'], [17.4, 0], [19.6, 0], [21.2, 0.9], [22.6, 0.9], [23.4, 0], [32.6, 0], [33.4, 0.5], [34.6, 1.0], [39.4, 1.0, 'peck'], [47.8, 1.0, 'jump'], [50.4, 1.0], [61.6, 1.0], [62.6, -0.5], [79.4, -0.5], [80.6, 0], [85.4, 0, 'peck'], [90.4, 0, 'push'], [98.5, 0]]) },
      ],
    },
  }],
  variants: [
    { name: 'Second egg', add: [{ t: 'egg', path: [[31, 0.35], [24, 0.35]], speed: 3, period: 7 }] },
    { name: 'Late egg', add: [{ t: 'egg', path: [[96, 0.35], [93, 0.35]], speed: 2.5, period: 8 }] },
  ],
};

export const CH2: LevelDef[] = [L21, L22, L23, L24, L25];
