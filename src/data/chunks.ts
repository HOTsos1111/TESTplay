/**
 * Authored obstacle chunks. Coordinates are local to the chunk: x runs from 0
 * to `length`, and `h` is height above the single ground plane (up = positive).
 *
 * Every chunk exposes the metadata the handoff asks for (entry/exit height,
 * length, recovery space, required abilities, optional reward branch) so the
 * validator and a future endless mode can filter compatible sequences.
 */
export type Ability = 'jump' | 'bark' | 'hover' | 'burst' | 'duck' | 'double';

export type BonePattern =
  | { kind: 'line'; x: number; h: number; n: number; spacing?: number }
  | { kind: 'arc'; x: number; h: number; n: number; width: number; rise: number };

export interface ChunkDef {
  id: string;
  length: number;
  entryHeight: number;
  exitHeight: number;
  requires: Ability[];
  /** Clear, hazard-free ground at the end of the chunk (px). */
  recovery: number;
  /** True if the chunk contains an optional higher-reward route. */
  rewardBranch?: boolean;
  /** Pits: [startX, width]. */
  gaps?: [number, number][];
  /** One-way platforms: x = left edge, w = width, h = height of top surface. */
  platforms?: { x: number; w: number; h: number }[];
  /** Heavy crates (solid, landable, never barkable). Stack = crates high. */
  crates?: { x: number; stack?: number; h?: number }[];
  /** Fragile cardboard (solid until barked open). */
  cardboard?: { x: number; stack: number; h?: number }[];
  /** Low hazards that hurt on contact. */
  tyres?: { x: number; h?: number }[];
  squirrels?: { x: number; h?: number }[];
  /**
   * Candidate power-up spots (x, height above the surface the hero runs on).
   * Each run picks a few of these at random across the chapter and deals random
   * kinds, so power-ups move around and can be missed.
   */
  powerupSlots?: { x: number; h: number }[];
  /** Lift platforms moving up and down between two heights (optional routes). */
  lifts?: { x: number; w: number; low: number; high: number; period: number }[];
  /** Low-clearance signs to duck under. */
  lowbars?: { x: number }[];
  /** Barrels that roll toward the hero when he approaches (x = resting spot). */
  barrels?: { x: number }[];
  bones?: BonePattern[];
  /** Scent wisps marking the main route: start x, height, count, spacing. */
  scent?: { x: number; h: number; n: number; spacing: number }[];
  hint?: { id: string; x: number };
  /** Painted speed chevrons on the floor: a cue that a burst is needed just ahead. */
  burstMarkers?: { x: number }[];
  /** A gate prop; reaching it starts the chapter encounter. */
  exitGate?: { x: number };
}

/** Logical sizes of authored objects (used by spawner, validator and art). */
export const OBJECT_SIZE = {
  crate: { w: 64, h: 64 },
  cardboard: { w: 60, h: 56 },
  tyre: { w: 48, h: 40 },
  platformThickness: 18,
} as const;

export const CHUNKS: Record<string, ChunkDef> = {
  depot_start: {
    id: 'depot_start', length: 1500, entryHeight: 0, exitHeight: 0, requires: [], recovery: 400,
    bones: [{ kind: 'line', x: 600, h: 30, n: 8, spacing: 60 }],
  },
  jump_tyre: {
    id: 'jump_tyre', length: 1900, entryHeight: 0, exitHeight: 0, requires: ['jump'], recovery: 350,
    powerupSlots: [{ x: 1250, h: 150 }],
    hint: { id: 'jump', x: 0 },
    tyres: [{ x: 650 }, { x: 1050 }, { x: 1450 }],
    bones: [
      { kind: 'arc', x: 674, h: 40, n: 4, width: 180, rise: 80 },
      { kind: 'arc', x: 1074, h: 40, n: 4, width: 180, rise: 80 },
      { kind: 'arc', x: 1474, h: 40, n: 4, width: 180, rise: 80 },
    ],
  },
  jump_gap: {
    id: 'jump_gap', length: 2000, entryHeight: 0, exitHeight: 0, requires: ['jump'], recovery: 350,
    gaps: [[500, 170], [1000, 210]],
    tyres: [{ x: 1550 }],
    powerupSlots: [{ x: 320, h: 70 }],
    bones: [
      { kind: 'arc', x: 585, h: 50, n: 5, width: 230, rise: 80 },
      { kind: 'arc', x: 1105, h: 50, n: 5, width: 260, rise: 85 },
    ],
  },
  hop_or_leap: {
    id: 'hop_or_leap', length: 2300, entryHeight: 0, exitHeight: 0, requires: ['jump'], recovery: 350,
    hint: { id: 'jump_hold', x: 0 },
    tyres: [{ x: 550 }],
    crates: [{ x: 950 }, { x: 1014 }],
    gaps: [[1450, 200]],
    bones: [
      { kind: 'line', x: 960, h: 100, n: 3, spacing: 50 },
      { kind: 'arc', x: 1550, h: 50, n: 5, width: 250, rise: 85 },
    ],
  },
  platforms_intro: {
    id: 'platforms_intro', length: 2300, entryHeight: 0, exitHeight: 0, requires: ['jump'], recovery: 350,
    rewardBranch: true,
    platforms: [{ x: 500, w: 420, h: 90 }],
    lifts: [{ x: 1150, w: 360, low: 75, high: 160, period: 2.8 }],
    tyres: [{ x: 650 }, { x: 1300 }],
    gaps: [[1750, 200]],
    bones: [
      { kind: 'line', x: 550, h: 125, n: 7, spacing: 55 },
      { kind: 'line', x: 1190, h: 200, n: 6, spacing: 55 },
    ],
  },
  bark_intro: {
    id: 'bark_intro', length: 2150, entryHeight: 0, exitHeight: 0, requires: ['jump', 'bark'], recovery: 300,
    powerupSlots: [{ x: 1100, h: 160 }],
    hint: { id: 'bark', x: 0 },
    cardboard: [{ x: 750, stack: 3 }, { x: 1300, stack: 3 }],
    tyres: [{ x: 1750 }],
    bones: [
      { kind: 'line', x: 870, h: 30, n: 5, spacing: 60 },
      { kind: 'line', x: 1420, h: 30, n: 4, spacing: 60 },
    ],
  },
  squirrel_intro: {
    id: 'squirrel_intro', length: 2300, entryHeight: 0, exitHeight: 0, requires: ['jump'], recovery: 300,
    powerupSlots: [{ x: 900, h: 140 }],
    hint: { id: 'squirrel', x: 0 },
    tyres: [{ x: 500 }],
    squirrels: [{ x: 1400 }],
    barrels: [{ x: 2200 }],
    bones: [{ kind: 'line', x: 700, h: 30, n: 6, spacing: 60 }],
  },
  depot_mix_a: {
    id: 'depot_mix_a', length: 2500, entryHeight: 0, exitHeight: 0, requires: ['jump', 'bark'], recovery: 400,
    cardboard: [{ x: 550, stack: 3 }],
    gaps: [[1000, 200]],
    powerupSlots: [{ x: 300, h: 70 }],
    platforms: [{ x: 1450, w: 520, h: 90 }],
    tyres: [{ x: 1600 }],
    squirrels: [{ x: 1880, h: 90 }],
    bones: [
      { kind: 'arc', x: 1100, h: 50, n: 5, width: 260, rise: 85 },
      { kind: 'line', x: 1500, h: 125, n: 5, spacing: 55 },
    ],
  },
  hover_intro: {
    id: 'hover_intro', length: 2300, entryHeight: 0, exitHeight: 0, requires: ['jump', 'hover'], recovery: 650,
    powerupSlots: [{ x: 1135, h: 190 }],
    hint: { id: 'hover', x: 0 },
    gaps: [[900, 470]],
    bones: [{ kind: 'arc', x: 1135, h: 80, n: 9, width: 470, rise: 70 }],
    scent: [{ x: 830, h: 120, n: 8, spacing: 80 }],
  },
  hover_recharge: {
    id: 'hover_recharge', length: 2400, entryHeight: 0, exitHeight: 0, requires: ['jump', 'hover'], recovery: 350,
    hint: { id: 'hover_recharge', x: 0 },
    gaps: [[700, 460]],
    tyres: [{ x: 1500 }],
    squirrels: [{ x: 2000 }],
    bones: [
      { kind: 'arc', x: 930, h: 80, n: 8, width: 460, rise: 60 },
      { kind: 'line', x: 1220, h: 30, n: 4, spacing: 55 },
    ],
  },
  burst_intro: {
    id: 'burst_intro', length: 2700, entryHeight: 0, exitHeight: 0, requires: ['jump', 'hover', 'burst'], recovery: 500,
    hint: { id: 'burst', x: 0 },
    burstMarkers: [{ x: 520 }],
    gaps: [[950, 740]],
    bones: [{ kind: 'arc', x: 1320, h: 90, n: 11, width: 740, rise: 90 }],
    scent: [{ x: 880, h: 130, n: 10, spacing: 85 }],
  },
  crate_steps: {
    id: 'crate_steps', length: 2400, entryHeight: 0, exitHeight: 0, requires: ['jump', 'bark'], recovery: 300,
    powerupSlots: [{ x: 1000, h: 200 }],
    crates: [{ x: 600 }, { x: 664 }, { x: 728, stack: 2 }, { x: 792, stack: 2 }],
    cardboard: [{ x: 1650, stack: 3 }],
    tyres: [{ x: 2050 }],
    bones: [
      { kind: 'line', x: 610, h: 95, n: 2, spacing: 50 },
      { kind: 'line', x: 740, h: 160, n: 2, spacing: 50 },
      { kind: 'arc', x: 1000, h: 140, n: 5, width: 300, rise: 30 },
    ],
  },
  squirrel_pair: {
    id: 'squirrel_pair', length: 2500, entryHeight: 0, exitHeight: 0, requires: ['jump'], recovery: 300,
    squirrels: [{ x: 700 }, { x: 1700 }],
    powerupSlots: [{ x: 350, h: 60 }],
    tyres: [{ x: 1150 }],
    gaps: [[1950, 220]],
    bones: [
      { kind: 'arc', x: 1174, h: 40, n: 5, width: 200, rise: 80 },
      { kind: 'arc', x: 2060, h: 50, n: 5, width: 270, rise: 85 },
    ],
  },
  mixed_hover: {
    id: 'mixed_hover', length: 2700, entryHeight: 0, exitHeight: 0, requires: ['jump', 'hover', 'bark'], recovery: 400,
    platforms: [{ x: 450, w: 320, h: 90 }],
    powerupSlots: [{ x: 620, h: 160 }],
    barrels: [{ x: 420 }],
    gaps: [[950, 480]],
    cardboard: [{ x: 1850, stack: 3 }],
    tyres: [{ x: 2250 }],
    bones: [
      { kind: 'line', x: 480, h: 125, n: 5, spacing: 55 },
      { kind: 'arc', x: 1190, h: 80, n: 9, width: 480, rise: 70 },
    ],
    scent: [{ x: 880, h: 120, n: 8, spacing: 80 }],
  },
  burst_gauntlet: {
    id: 'burst_gauntlet', length: 3000, entryHeight: 0, exitHeight: 0, requires: ['jump', 'hover', 'bark', 'burst'], recovery: 350,
    burstMarkers: [{ x: 520 }],
    gaps: [[1000, 790]],
    cardboard: [{ x: 2200, stack: 3 }],
    tyres: [{ x: 2600 }],
    bones: [{ kind: 'arc', x: 1395, h: 90, n: 12, width: 790, rise: 100 }],
    scent: [{ x: 930, h: 130, n: 10, spacing: 90 }],
  },
  speed_run: {
    id: 'speed_run', length: 2600, entryHeight: 0, exitHeight: 0, requires: ['jump'], recovery: 400,
    powerupSlots: [{ x: 1675, h: 170 }],
    tyres: [{ x: 450 }, { x: 800 }, { x: 1150 }, { x: 1500 }],
    gaps: [[1850, 220]],
    bones: [
      { kind: 'arc', x: 474, h: 40, n: 4, width: 180, rise: 75 },
      { kind: 'arc', x: 824, h: 40, n: 4, width: 180, rise: 75 },
      { kind: 'arc', x: 1174, h: 40, n: 4, width: 180, rise: 75 },
      { kind: 'arc', x: 1524, h: 40, n: 4, width: 180, rise: 75 },
      { kind: 'arc', x: 1960, h: 50, n: 5, width: 270, rise: 85 },
    ],
  },
  high_route: {
    id: 'high_route', length: 2900, entryHeight: 0, exitHeight: 0, requires: ['jump', 'bark'], recovery: 400,
    rewardBranch: true,
    platforms: [{ x: 500, w: 360, h: 90 }, { x: 1420, w: 420, h: 90 }],
    lifts: [{ x: 960, w: 360, low: 90, high: 200, period: 3.2 }],
    powerupSlots: [{ x: 1140, h: 260 }],
    tyres: [{ x: 700 }, { x: 1100 }, { x: 1600 }],
    squirrels: [{ x: 1750, h: 90 }],
    cardboard: [{ x: 2250, stack: 3 }],
    bones: [
      { kind: 'line', x: 540, h: 125, n: 5, spacing: 60 },
      { kind: 'line', x: 1000, h: 245, n: 6, spacing: 55 },
      { kind: 'line', x: 1460, h: 125, n: 5, spacing: 60 },
    ],
  },
  final_gauntlet: {
    id: 'final_gauntlet', length: 3100, entryHeight: 0, exitHeight: 0, requires: ['jump', 'bark', 'hover'], recovery: 350,
    platforms: [{ x: 400, w: 480, h: 90 }],
    powerupSlots: [{ x: 250, h: 70 }],
    squirrels: [{ x: 780, h: 90 }],
    gaps: [[1150, 490]],
    cardboard: [{ x: 1950, stack: 3 }],
    tyres: [{ x: 2350 }, { x: 2700 }],
    bones: [
      { kind: 'arc', x: 1395, h: 80, n: 9, width: 490, rise: 70 },
      { kind: 'arc', x: 2374, h: 40, n: 4, width: 180, rise: 75 },
    ],
    scent: [{ x: 1080, h: 120, n: 8, spacing: 80 }],
  },
  duck_intro: {
    id: 'duck_intro', length: 2300, entryHeight: 0, exitHeight: 0, requires: ['duck'], recovery: 600,
    powerupSlots: [{ x: 1150, h: 150 }],
    hint: { id: 'duck', x: 0 },
    lowbars: [{ x: 800 }, { x: 1500 }],
    bones: [
      { kind: 'line', x: 815, h: 14, n: 3, spacing: 35 },
      { kind: 'line', x: 1515, h: 14, n: 3, spacing: 35 },
    ],
  },
  double_intro: {
    id: 'double_intro', length: 2400, entryHeight: 0, exitHeight: 0, requires: ['jump', 'double'], recovery: 500,
    powerupSlots: [{ x: 935, h: 260 }],
    hint: { id: 'double', x: 0 },
    crates: [{ x: 900, stack: 3 }, { x: 964, stack: 3 }],
    bones: [
      { kind: 'arc', x: 935, h: 140, n: 5, width: 160, rise: 90 },
      { kind: 'line', x: 1500, h: 30, n: 5, spacing: 60 },
    ],
  },
  duck_double_mix: {
    id: 'duck_double_mix', length: 3000, entryHeight: 0, exitHeight: 0, requires: ['jump', 'double', 'duck', 'bark'], recovery: 350,
    lowbars: [{ x: 600 }],
    crates: [{ x: 1250 }, { x: 1314, stack: 3 }, { x: 1378, stack: 3 }],
    cardboard: [{ x: 2000, stack: 3 }],
    tyres: [{ x: 2600 }],
    bones: [
      { kind: 'line', x: 615, h: 14, n: 3, spacing: 35 },
      { kind: 'line', x: 1320, h: 230, n: 3, spacing: 50 },
    ],
  },
  exit_gate: {
    id: 'exit_gate', length: 1600, entryHeight: 0, exitHeight: 0, requires: ['jump'], recovery: 1000,
    bones: [{ kind: 'line', x: 300, h: 30, n: 8, spacing: 60 }],
    barrels: [{ x: 800 }],
    exitGate: { x: 1150 },
  },
};

export function chunkById(id: string): ChunkDef {
  const c = CHUNKS[id];
  if (!c) throw new Error(`Unknown chunk ${id}`);
  return c;
}
