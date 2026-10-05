// Stage 1 — Nest Scramble (hatchlings). Close overhead nest arenas: wobble, hop, nudge, collect and tug.
import type { LevelDef } from '../../sim/types';
import { ovalRim, wall, crumbs, crumbRing, topStarts } from './kit';

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
};

export const CH1: LevelDef[] = [L11];
