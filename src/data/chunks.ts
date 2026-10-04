/**
 * Authored obstacle chunks. Coordinates are local to the chunk: x runs from 0
 * to `length`, and `h` is height above the single ground plane (up = positive).
 *
 * Every chunk exposes the metadata the handoff asks for (entry/exit height,
 * length, recovery space, required abilities, optional reward branch) so the
 * validator and a future endless mode can filter compatible sequences.
 */
export type Ability = 'jump' | 'bark' | 'hover';

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
  bones?: BonePattern[];
  /** Scent wisps marking the main route: start x, height, count, spacing. */
  scent?: { x: number; h: number; n: number; spacing: number }[];
  hint?: { id: string; x: number };
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
    id: 'depot_start', length: 1700, entryHeight: 0, exitHeight: 0, requires: [], recovery: 400,
    bones: [{ kind: 'line', x: 700, h: 30, n: 8, spacing: 60 }],
  },
  jump_tyre: {
    id: 'jump_tyre', length: 1800, entryHeight: 0, exitHeight: 0, requires: ['jump'], recovery: 350,
    hint: { id: 'jump', x: 0 },
    tyres: [{ x: 800 }, { x: 1350 }],
    bones: [
      { kind: 'arc', x: 824, h: 40, n: 5, width: 200, rise: 80 },
      { kind: 'arc', x: 1374, h: 40, n: 5, width: 200, rise: 80 },
    ],
  },
  jump_gap: {
    id: 'jump_gap', length: 1800, entryHeight: 0, exitHeight: 0, requires: ['jump'], recovery: 350,
    gaps: [[650, 140], [1220, 170]],
    bones: [
      { kind: 'arc', x: 720, h: 50, n: 5, width: 220, rise: 80 },
      { kind: 'arc', x: 1305, h: 50, n: 5, width: 240, rise: 80 },
    ],
  },
  bones_intro: {
    id: 'bones_intro', length: 1500, entryHeight: 0, exitHeight: 0, requires: [], recovery: 300,
    hint: { id: 'bones', x: 0 },
    bones: [
      { kind: 'line', x: 300, h: 30, n: 6, spacing: 55 },
      { kind: 'arc', x: 900, h: 40, n: 7, width: 260, rise: 95 },
    ],
  },
  hop_or_leap: {
    id: 'hop_or_leap', length: 2100, entryHeight: 0, exitHeight: 0, requires: ['jump'], recovery: 350,
    hint: { id: 'jump_hold', x: 0 },
    tyres: [{ x: 650 }],
    crates: [{ x: 1150 }, { x: 1214 }],
    bones: [
      { kind: 'line', x: 1160, h: 100, n: 3, spacing: 50 },
      { kind: 'arc', x: 674, h: 40, n: 5, width: 200, rise: 70 },
    ],
  },
  platforms_intro: {
    id: 'platforms_intro', length: 2300, entryHeight: 0, exitHeight: 0, requires: ['jump'], recovery: 350,
    rewardBranch: true,
    platforms: [{ x: 600, w: 420, h: 90 }, { x: 1250, w: 360, h: 90 }],
    bones: [
      { kind: 'line', x: 650, h: 125, n: 7, spacing: 55 },
      { kind: 'line', x: 1290, h: 125, n: 6, spacing: 55 },
    ],
  },
  bark_intro: {
    id: 'bark_intro', length: 2100, entryHeight: 0, exitHeight: 0, requires: ['bark'], recovery: 350,
    hint: { id: 'bark', x: 0 },
    cardboard: [{ x: 850, stack: 3 }, { x: 1500, stack: 3 }],
    bones: [
      { kind: 'line', x: 1000, h: 30, n: 5, spacing: 60 },
      { kind: 'line', x: 1650, h: 30, n: 4, spacing: 60 },
    ],
  },
  squirrel_intro: {
    id: 'squirrel_intro', length: 2300, entryHeight: 0, exitHeight: 0, requires: ['jump'], recovery: 400,
    hint: { id: 'squirrel', x: 0 },
    squirrels: [{ x: 1500 }],
    bones: [{ kind: 'line', x: 500, h: 30, n: 6, spacing: 60 }],
  },
  depot_mix_a: {
    id: 'depot_mix_a', length: 2500, entryHeight: 0, exitHeight: 0, requires: ['jump', 'bark'], recovery: 400,
    cardboard: [{ x: 550, stack: 3 }],
    gaps: [[1050, 170]],
    platforms: [{ x: 1550, w: 520, h: 90 }],
    squirrels: [{ x: 1960, h: 90 }],
    bones: [
      { kind: 'arc', x: 1135, h: 50, n: 5, width: 240, rise: 85 },
      { kind: 'line', x: 1600, h: 125, n: 5, spacing: 55 },
    ],
  },
  hover_intro: {
    id: 'hover_intro', length: 2300, entryHeight: 0, exitHeight: 0, requires: ['jump', 'hover'], recovery: 650,
    hint: { id: 'hover', x: 0 },
    gaps: [[950, 420]],
    bones: [{ kind: 'arc', x: 1160, h: 80, n: 9, width: 420, rise: 70 }],
    scent: [{ x: 880, h: 120, n: 7, spacing: 80 }],
  },
  hover_recharge: {
    id: 'hover_recharge', length: 2400, entryHeight: 0, exitHeight: 0, requires: ['jump', 'hover'], recovery: 600,
    hint: { id: 'hover_recharge', x: 0 },
    gaps: [[700, 400]],
    tyres: [{ x: 1500 }],
    bones: [
      { kind: 'arc', x: 900, h: 80, n: 8, width: 400, rise: 60 },
      { kind: 'line', x: 1200, h: 30, n: 4, spacing: 55 },
    ],
  },
  crate_steps: {
    id: 'crate_steps', length: 2400, entryHeight: 0, exitHeight: 0, requires: ['jump', 'bark'], recovery: 400,
    crates: [{ x: 600 }, { x: 664 }, { x: 728, stack: 2 }, { x: 792, stack: 2 }],
    cardboard: [{ x: 1650, stack: 3 }],
    bones: [
      { kind: 'line', x: 610, h: 95, n: 2, spacing: 50 },
      { kind: 'line', x: 740, h: 160, n: 2, spacing: 50 },
      { kind: 'arc', x: 1000, h: 140, n: 5, width: 300, rise: 30 },
    ],
  },
  squirrel_pair: {
    id: 'squirrel_pair', length: 2500, entryHeight: 0, exitHeight: 0, requires: ['jump'], recovery: 400,
    squirrels: [{ x: 900 }, { x: 1950 }],
    tyres: [{ x: 1400 }],
    bones: [{ kind: 'arc', x: 1424, h: 40, n: 5, width: 200, rise: 80 }],
  },
  mixed_hover: {
    id: 'mixed_hover', length: 2700, entryHeight: 0, exitHeight: 0, requires: ['jump', 'hover', 'bark'], recovery: 400,
    platforms: [{ x: 450, w: 320, h: 90 }],
    gaps: [[950, 440]],
    cardboard: [{ x: 1950, stack: 3 }],
    bones: [
      { kind: 'line', x: 480, h: 125, n: 5, spacing: 55 },
      { kind: 'arc', x: 1170, h: 80, n: 9, width: 440, rise: 70 },
    ],
    scent: [{ x: 880, h: 120, n: 7, spacing: 80 }],
  },
  speed_run: {
    id: 'speed_run', length: 2500, entryHeight: 0, exitHeight: 0, requires: ['jump'], recovery: 400,
    tyres: [{ x: 500 }, { x: 900 }, { x: 1300 }],
    gaps: [[1700, 180]],
    bones: [
      { kind: 'arc', x: 524, h: 40, n: 4, width: 180, rise: 75 },
      { kind: 'arc', x: 924, h: 40, n: 4, width: 180, rise: 75 },
      { kind: 'arc', x: 1324, h: 40, n: 4, width: 180, rise: 75 },
      { kind: 'arc', x: 1790, h: 50, n: 5, width: 240, rise: 85 },
    ],
  },
  high_route: {
    id: 'high_route', length: 2900, entryHeight: 0, exitHeight: 0, requires: ['jump', 'bark'], recovery: 400,
    rewardBranch: true,
    platforms: [{ x: 500, w: 360, h: 90 }, { x: 960, w: 360, h: 180 }, { x: 1420, w: 420, h: 90 }],
    tyres: [{ x: 700 }, { x: 1600 }],
    cardboard: [{ x: 2250, stack: 3 }],
    bones: [
      { kind: 'line', x: 540, h: 125, n: 5, spacing: 60 },
      { kind: 'line', x: 1000, h: 215, n: 6, spacing: 55 },
      { kind: 'line', x: 1460, h: 125, n: 6, spacing: 60 },
    ],
  },
  final_gauntlet: {
    id: 'final_gauntlet', length: 3000, entryHeight: 0, exitHeight: 0, requires: ['jump', 'bark', 'hover'], recovery: 350,
    platforms: [{ x: 400, w: 480, h: 90 }],
    squirrels: [{ x: 780, h: 90 }],
    gaps: [[1150, 430]],
    cardboard: [{ x: 2200, stack: 3 }],
    tyres: [{ x: 2600 }],
    bones: [
      { kind: 'arc', x: 1365, h: 80, n: 9, width: 430, rise: 70 },
      { kind: 'arc', x: 2624, h: 40, n: 4, width: 180, rise: 75 },
    ],
    scent: [{ x: 1080, h: 120, n: 7, spacing: 80 }],
  },
  exit_gate: {
    id: 'exit_gate', length: 1600, entryHeight: 0, exitHeight: 0, requires: [], recovery: 1600,
    bones: [{ kind: 'line', x: 300, h: 30, n: 8, spacing: 60 }],
    exitGate: { x: 1150 },
  },
};

export function chunkById(id: string): ChunkDef {
  const c = CHUNKS[id];
  if (!c) throw new Error(`Unknown chunk ${id}`);
  return c;
}
