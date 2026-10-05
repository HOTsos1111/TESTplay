// Stage 2 — Coop Dash (fluffy chicks). Side-scrolling platform races: run, jump, duck, peck, push.
import type { LevelDef } from '../../sim/types';
import { ground, plank, block, sideStarts, route } from './kit';

const L21: LevelDef = {
  id: '2-1', chapter: 2, index: 1, title: 'Coop Sprint',
  brief: 'Reach the finish!', tip: 'Hold Space for a bigger jump. Tap for a hop.',
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
        { t: 'deco', kind: 'ribbon-start', x: 3.6, y: 0 },
        { t: 'deco', kind: 'ribbon-finish', x: 64.2, y: 0 },
        { t: 'deco', kind: 'hay', x: 8, y: 0 }, { t: 'deco', kind: 'hay', x: 46, y: 0 },
      ],
      routes: [
        { color: 'common', nodes: route([[2, 0], [13.4, 0], [15, 0.5], [16.6, 1], [23.8, 1, 'jump'], [26.6, 1], [32.8, 1], [34.2, 0], [37.4, 0, 'jump'], [39.8, 0], [47.8, 0, 'jump'], [50.6, 0], [64.5, 0]]) },
        { color: 'teal', nodes: route([[2, 0], [13.4, 0], [15, 0.5], [17.4, 1], [19.0, 2.6], [22.6, 3.2], [26.8, 3.2], [29.8, 2.6], [31.6, 1], [32.8, 1], [34.2, 0], [37.4, 0, 'jump'], [39.8, 0], [47.8, 0, 'jump'], [50.6, 0], [64.5, 0]]) },
      ],
    },
  }],
};

export const CH2: LevelDef[] = [L21];
