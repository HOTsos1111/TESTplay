// Stage 4 — Farmyard Mischief (young chickens). Three-quarter top-down exploration and delivery:
// scratch for treats, carry, vault low fences, open gates, move props, deliver. No combat.
import type { LevelDef, EntityDef } from '../../sim/types';
import { wall, border, topStarts } from './kit';

const patch = (x: number, y: number): EntityDef => ({ t: 'scratch', x, y });
const fenceH = (x: number, y: number, w: number) => wall(x, y, w, 0.35, 1.3, 'fence');
const fenceV = (x: number, y: number, h: number) => wall(x, y, 0.35, h, 1.3, 'fence');
const vault = (x: number, y: number, w: number, h: number) => wall(x, y, w, h, 0.5, 'fence');   // low: hop over

const L41: LevelDef = {
  id: '4-1', chapter: 4, index: 1, title: 'Scratch and Seek',
  brief: 'Deliver 10 treats to the central basket.', tip: 'Hold E on a scratch patch to dig up a treat, walk over it to carry (up to 3), then press E at the basket.',
  format: 'single', timeLimit: 600, music: 'farmyard',
  phases: [{
    name: 'Scratch and Seek',
    objective: { kind: 'deliver', cargo: 'treat', count: 10 },
    arena: {
      mode: 'top', theme: 'farmyard', w: 26, h: 18, camera: 'three-quarter',
      starts: topStarts(13, 16.2, 1.0),
      solids: [
        ...border(26, 18),
        wall(6, 7.6, 2.4, 1.6, 1.1, 'hay'), wall(17.6, 8.8, 2.4, 1.6, 1.1, 'hay'),
        wall(11.4, 3.0, 3.2, 0.5, 1.3, 'fence'), wall(11.4, 14.5, 3.2, 0.5, 1.3, 'fence'),
      ],
      entities: [
        patch(4.5, 4.0), patch(21.5, 4.0), patch(4.5, 14.0), patch(21.5, 14.0),
        { t: 'basket', x: 13, y: 9, r: 1.0 },
        { t: 'power', x: 13, y: 5.2, pu: 'PU-03' }, { t: 'power', x: 13, y: 12.8, pu: 'PU-01' },
        { t: 'deco', kind: 'flower', x: 2, y: 9 }, { t: 'deco', kind: 'flower', x: 24, y: 9 },
        { t: 'deco', kind: 'crate', x: 1.6, y: 16.2, s: 0.9 },
      ],
    },
  }],
  variants: [
    { name: 'Mud corner', add: [{ t: 'mud', x: 2.5, y: 11.5, w: 4, h: 2.5 }] },
    { name: 'Seed spill', add: [{ t: 'seed', x: 19.5, y: 2.2, w: 4, h: 2.5 }] },
  ],
};

// Pens behind gates and fences; low vault fences are shortcuts (hop them).
const L42: LevelDef = {
  id: '4-2', chapter: 4, index: 2, title: 'Fence Favour',
  brief: 'Deliver 15 treats to the barn basket.', tip: 'Press E at a gate to open it. Low fences can be vaulted with Space.',
  format: 'single', timeLimit: 600, music: 'farmyard',
  phases: [{
    name: 'Fence Favour',
    objective: { kind: 'deliver', cargo: 'treat', count: 15 },
    arena: {
      mode: 'top', theme: 'farmyard', w: 30, h: 20, camera: 'three-quarter',
      starts: topStarts(4, 17.5, 1.0),
      solids: [
        ...border(30, 20),
        // barn wall around the basket (open to the south)
        wall(22, 1.0, 7, 0.6, 2.4, 'coop'), wall(22, 1.0, 0.6, 5.0, 2.4, 'coop'), wall(28.4, 1.0, 0.6, 5.0, 2.4, 'coop'),
        // west pen: fence with a gate gap at y 6.2–8.2, vault shortcut at the south
        fenceV(9, 0.6, 5.6), fenceV(9, 8.2, 4.0), vault(9, 12.2, 0.35, 2.4), fenceV(9, 14.6, 5.0),
        // middle fence line with a gate and a vault section
        fenceH(9.35, 10.0, 6.0), vault(15.35, 10.0, 2.6, 0.35), fenceH(17.95, 10.0, 2.0), fenceH(22.0, 10.0, 7.4),
        // east pen
        fenceV(20, 10.35, 4.0), fenceV(20, 16.4, 3.0),
      ],
      entities: [
        { t: 'gate', x: 8.9, y: 6.2, w: 0.55, h: 2.0 },
        { t: 'gate', x: 19.95, y: 9.9, w: 2.05, h: 0.55 },
        { t: 'gate', x: 19.9, y: 14.35, w: 0.55, h: 2.05 },
        patch(4.5, 3.0), patch(4.5, 8.0), patch(14, 5.0), patch(25.5, 14.0), patch(25.5, 17.5), patch(14, 15.0),
        { t: 'basket', x: 25.6, y: 3.4, r: 1.1 },
        { t: 'power', x: 16, y: 7.5, pu: 'PU-03' }, { t: 'power', x: 12, y: 18, pu: 'PU-07' },
        { t: 'deco', kind: 'tree', x: 2.2, y: 12.5, s: 0.8 },
      ],
    },
  }],
  variants: [
    { name: 'Puddle at the gate', add: [{ t: 'mud', x: 10, y: 6, w: 3, h: 2.5 }] },
    { name: 'Seed by the barn', add: [{ t: 'seed', x: 21, y: 6.5, w: 4, h: 2.4 }] },
  ],
};

// Corn bundles from the field to the cart. Crates (anyone) and hay bales (strong) can be shoved to open shortcuts.
const L43: LevelDef = {
  id: '4-3', chapter: 4, index: 3, title: 'Heavy Harvest',
  brief: 'Deliver 3 corn bundles to the cart.', tip: 'Press E at a corn pile to pick up a bundle (it slows you). Shove crates to open shortcuts — hay bales need Mighty or Power Corn.',
  format: 'single', timeLimit: 600, music: 'farmyard',
  phases: [{
    name: 'Heavy Harvest',
    objective: { kind: 'deliver', cargo: 'bundle', count: 3 },
    arena: {
      mode: 'top', theme: 'farmyard', w: 30, h: 20, camera: 'three-quarter',
      starts: topStarts(4, 10, 1.0).map(([x, y], i) => [x - 1 + (i % 2), y - 1.5 + i] as [number, number]),
      solids: [
        ...border(30, 20),
        // fence line splitting yard (west) from the field (east) with three openings
        fenceV(14, 0.6, 3.4), fenceV(14, 6.0, 3.0), fenceV(14, 11.0, 3.0), fenceV(14, 16.0, 3.4),
      ],
      entities: [
        { t: 'crate', x: 13.6, y: 4.0, w: 1.2, h: 2.0, mass: 0.5 },     // light: anyone can shove it aside
        { t: 'bale', x: 13.6, y: 14.0, w: 1.2, h: 2.0, mass: 1.0 },     // heavy shortcut (red)
        { t: 'cornpile', x: 24, y: 4.5, count: 4, respawn: 6 },
        { t: 'cornpile', x: 24, y: 10, count: 4, respawn: 6 },
        { t: 'cornpile', x: 24, y: 15.5, count: 4, respawn: 6 },
        { t: 'basket', x: 3.2, y: 10, r: 1.2 },
        { t: 'power', x: 10, y: 15, pu: 'PU-05' }, { t: 'power', x: 19, y: 10, pu: 'PU-01' },
        { t: 'deco', kind: 'tree', x: 28.4, y: 1.6, s: 0.8 }, { t: 'deco', kind: 'hay', x: 27.5, y: 18.4, s: 1 },
      ],
    },
  }],
  variants: [
    { name: 'Muddy middle', add: [{ t: 'mud', x: 16, y: 8.2, w: 4, h: 3.6 }] },
    { name: 'Spilled seed', add: [{ t: 'seed', x: 6, y: 13, w: 4, h: 3 }] },
  ],
};

// Mud and seed spills everywhere; siblings cross your path. 20 treats to the coop basket.
const L44: LevelDef = {
  id: '4-4', chapter: 4, index: 4, title: 'Slippery Business',
  brief: 'Deliver 20 treats to the coop basket.', tip: 'Mud slows you, seed spills make you slide. Sticky Toes give grip. Bumped chicks drop their treats!',
  format: 'single', timeLimit: 600, music: 'farmyard',
  phases: [{
    name: 'Slippery Business',
    objective: { kind: 'deliver', cargo: 'treat', count: 20 },
    arena: {
      mode: 'top', theme: 'farmyard', w: 32, h: 22, camera: 'three-quarter',
      starts: topStarts(16, 19.5, 1.0),
      solids: [
        ...border(32, 22),
        wall(13, 1.0, 6, 0.6, 2.4, 'coop'), wall(13, 1.0, 0.6, 3.6, 2.4, 'coop'), wall(18.4, 1.0, 0.6, 3.6, 2.4, 'coop'),
        wall(7, 9, 2.4, 1.6, 1.1, 'hay'), wall(22.6, 9, 2.4, 1.6, 1.1, 'hay'),
        { x: 14, y: 10.5, w: 4, h: 3, kind: 'water', height: 1.2 },
      ],
      entities: [
        patch(4, 4), patch(28, 4), patch(4, 17), patch(28, 17), patch(10, 14), patch(22, 14),
        { t: 'basket', x: 15.7, y: 3.0, r: 1.1 },
        { t: 'mud', x: 9.5, y: 4.5, w: 4, h: 3.5 }, { t: 'mud', x: 19, y: 15, w: 4.5, h: 3 },
        { t: 'seed', x: 19, y: 4.5, w: 4, h: 3.5 }, { t: 'seed', x: 8, y: 15, w: 4.5, h: 3 },
        { t: 'seed', x: 13.8, y: 6.5, w: 4.5, h: 2.5 },
        { t: 'power', x: 16, y: 16, pu: 'PU-06' }, { t: 'power', x: 2.5, y: 10.5, pu: 'PU-03' }, { t: 'power', x: 29.5, y: 10.5, pu: 'PU-07' },
      ],
    },
  }],
  variants: [
    { name: 'Rolling egg', add: [{ t: 'egg', path: [[3, 12.5], [29, 12.5]], speed: 3, period: 9, r: 0.42 }] },
    { name: 'More mud', add: [{ t: 'mud', x: 24, y: 6, w: 3.5, h: 3 }] },
  ],
};

// Four marked baskets (one each) around a replenishing central garden. Most deliveries in 120 s.
const L45: LevelDef = {
  id: '4-5', chapter: 4, index: 5, title: 'Yard Boss',
  brief: 'Make the most deliveries to YOUR basket in 120 seconds!', tip: 'Your basket has your colour ribbon. Bump siblings to make them drop treats — banked treats are safe.',
  format: 'single', timeLimit: 130, music: 'farmyard',
  phases: [{
    name: 'Yard Boss',
    objective: { kind: 'mostDeliveries', seconds: 120 },
    arena: {
      mode: 'top', theme: 'farmyard', w: 30, h: 22, camera: 'three-quarter',
      starts: [[5, 5.5], [25, 5.5], [5, 16.5], [25, 16.5]],
      solids: [
        ...border(30, 22),
        // garden beds (low, vaultable) around the patches
        vault(11, 8.2, 2.2, 0.35), vault(16.8, 8.2, 2.2, 0.35), vault(11, 13.45, 2.2, 0.35), vault(16.8, 13.45, 2.2, 0.35),
        wall(1, 10.6, 3, 0.8, 1.3, 'fence'), wall(26, 10.6, 3, 0.8, 1.3, 'fence'),
      ],
      entities: [
        { t: 'basket', x: 3.0, y: 3.0, r: 1.0, owner: 0 }, { t: 'basket', x: 27.0, y: 3.0, r: 1.0, owner: 1 },
        { t: 'basket', x: 3.0, y: 19.0, r: 1.0, owner: 2 }, { t: 'basket', x: 27.0, y: 19.0, r: 1.0, owner: 3 },
        patch(12, 10), patch(18, 10), patch(12, 12), patch(18, 12), patch(15, 9.2), patch(15, 12.8),
        { t: 'power', x: 15, y: 4, pu: 'PU-03', respawn: 15 }, { t: 'power', x: 15, y: 18, pu: 'PU-07', respawn: 15 },
        { t: 'power', x: 8, y: 11, pu: 'PU-01', respawn: 15 }, { t: 'power', x: 22, y: 11, pu: 'PU-05', respawn: 15 },
        { t: 'deco', kind: 'flower', x: 15, y: 11 },
      ],
    },
  }],
  variants: [
    { name: 'Garden puddle', add: [{ t: 'mud', x: 13.5, y: 14.2, w: 3, h: 2 }] },
    { name: 'Seed path', add: [{ t: 'seed', x: 13.5, y: 5.8, w: 3, h: 2 }] },
  ],
};

export const CH4: LevelDef[] = [L41, L42, L43, L44, L45];
