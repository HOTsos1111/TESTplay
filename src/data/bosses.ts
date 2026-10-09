import type { Piece } from './levelArt';

/**
 * The nine end-of-level bosses. Each loops through the attacks of its current
 * tier (tiers escalate as it loses HP) and pauses for breath between rounds.
 * Every bark that reaches it lands a hit. Heights: 'low' threats are jumped,
 * 'high' ones ducked under — or dodged from the platforms above.
 */
export type Attack =
  /** Lobbed shots that land around where the dog was standing; move away or bark them. */
  | { kind: 'volley'; shot: Piece; n?: number }
  /** Something rolled along the ground at the dog; jump it (bark it unless heavy). */
  | { kind: 'roll'; shot: Piece; heavy?: boolean; speed?: number }
  /** An object flies across the arena at one height. */
  | { kind: 'sweep'; shot: Piece; height: 'low' | 'high'; speed?: number }
  /** The boss itself crosses the arena at one height. */
  | { kind: 'swoop'; height: 'low' | 'high'; speed?: number }
  /** Things fall onto marked spots near the dog. */
  | { kind: 'drop'; shot: Piece; n?: number }
  /** Jets of steam or water burst up from marked spots (always one safe pad). */
  | { kind: 'geyser'; n?: number; color: number }
  /** Leaps onto the marked spot; the landing sends a shockwave along the floor both ways (jump it). */
  | { kind: 'slam' };

export interface BossDef {
  level: number;
  name: string;
  hp: number;
  /** Drawn sprite height in the arena. */
  height: number;
  /** Hovers in the air between attacks instead of standing. */
  flying?: boolean;
  /** The guide drawing faces right (it is mirrored to face the dog). */
  facesRight: boolean;
  /** Seconds it pauses for breath after each round of attacks. */
  openTime: number;
  /** Where the weak point sits on the sprite, as fractions of its width/height. */
  weak: { x: number; y: number };
  tiers: Attack[][];
  hint: string;
}

const P = (code: string, crop?: Piece['crop']): Piece => ({ code, crop });

export const BOSSES: Record<number, BossDef> = {
  1: {
    level: 1,
    name: 'DON CRUMB',
    hp: 12,
    height: 210,
    facesRight: true,
    openTime: 1.6,
    weak: { x: 0.55, y: 0.78 },
    hint: 'Dodge the crumbs, JUMP his swoop, then BARK at the bread basket!',
    tiers: [
      [{ kind: 'volley', shot: P('h3', [0, 0, 0.36, 1]), n: 3 }, { kind: 'swoop', height: 'low' }],
      [{ kind: 'volley', shot: P('h3', [0, 0, 0.36, 1]), n: 3 }, { kind: 'volley', shot: P('h3', [0.36, 0, 0.66, 1]), n: 2 }, { kind: 'swoop', height: 'low' }],
      [{ kind: 'volley', shot: P('h3', [0, 0, 0.36, 1]), n: 3 }, { kind: 'swoop', height: 'low' }, { kind: 'swoop', height: 'low', speed: 620 }],
    ],
  },
  2: {
    level: 2,
    name: 'FORKLIFT FRANKIE',
    hp: 14,
    height: 220,
    facesRight: true,
    openTime: 1.6,
    weak: { x: 0.8, y: 0.55 },
    hint: 'JUMP the barrels, dodge the forks, BARK at the latch!',
    tiers: [
      [{ kind: 'roll', shot: P('h1'), heavy: true }, { kind: 'sweep', shot: P('h2', [0, 0, 1, 0.42]), height: 'high' }],
      [{ kind: 'roll', shot: P('h1'), heavy: true }, { kind: 'sweep', shot: P('h2', [0, 0, 1, 0.42]), height: 'low' }, { kind: 'roll', shot: P('h3') }],
      [{ kind: 'sweep', shot: P('h2', [0, 0, 1, 0.42]), height: 'high' }, { kind: 'roll', shot: P('h1'), heavy: true, speed: 300 }, { kind: 'sweep', shot: P('h2', [0, 0, 1, 0.42]), height: 'low' }],
    ],
  },
  3: {
    level: 3,
    name: 'CAPTAIN GULL',
    hp: 14,
    height: 165,
    flying: true,
    facesRight: false,
    openTime: 1.7,
    weak: { x: 0.5, y: 0.5 },
    hint: 'DUCK his dive, dodge the shells, BARK when he lands on the buoy!',
    tiers: [
      [{ kind: 'swoop', height: 'high' }, { kind: 'drop', shot: P('h3', [0, 0, 0.36, 1]), n: 2 }],
      [{ kind: 'volley', shot: P('h3', [0.36, 0, 0.66, 1]), n: 3 }, { kind: 'swoop', height: 'high' }, { kind: 'drop', shot: P('h3', [0.66, 0, 1, 1]), n: 2 }],
      [{ kind: 'volley', shot: P('h3', [0, 0, 0.36, 1]), n: 3 }, { kind: 'swoop', height: 'high' }, { kind: 'swoop', height: 'high', speed: 640 }],
    ],
  },
  4: {
    level: 4,
    name: 'SWITCHBACK BADGER',
    hp: 16,
    height: 210,
    facesRight: true,
    openTime: 1.5,
    weak: { x: 0.78, y: 0.42 },
    hint: 'JUMP the handcar, dodge the pebbles, BARK at the brake lever!',
    tiers: [
      [{ kind: 'swoop', height: 'low' }, { kind: 'drop', shot: P('h3', [0, 0, 0.36, 1]), n: 1 }],
      [{ kind: 'swoop', height: 'low' }, { kind: 'drop', shot: P('h3', [0.36, 0, 0.66, 1]), n: 2 }, { kind: 'roll', shot: P('h3', [0.66, 0, 1, 1]) }],
      [{ kind: 'swoop', height: 'low' }, { kind: 'sweep', shot: P('h2', [0.06, 0, 1, 0.5]), height: 'high' }, { kind: 'drop', shot: P('h3', [0, 0, 0.36, 1]), n: 2 }],
    ],
  },
  5: {
    level: 5,
    name: 'BOILER BRUTUS',
    hp: 16,
    height: 230,
    facesRight: false,
    openTime: 1.6,
    weak: { x: 0.5, y: 0.45 },
    hint: 'Find the dry spot when the steam blows, BARK the bolts back, BARK the dial!',
    tiers: [
      [{ kind: 'geyser', n: 2, color: 0xfff6e8 }, { kind: 'roll', shot: P('h2', [0, 0, 0.33, 1]) }],
      [{ kind: 'geyser', n: 2, color: 0xfff6e8 }, { kind: 'roll', shot: P('h2', [0, 0, 0.33, 1]) }, { kind: 'roll', shot: P('h2', [0.36, 0, 0.66, 1]), speed: 300 }],
      [{ kind: 'geyser', n: 3, color: 0xfff6e8 }, { kind: 'volley', shot: P('h2', [0.66, 0, 1, 1]), n: 2 }, { kind: 'roll', shot: P('h2', [0, 0, 0.33, 1]) }],
    ],
  },
  6: {
    level: 6,
    name: 'HARDHAT HANK',
    hp: 18,
    height: 230,
    facesRight: true,
    openTime: 1.5,
    weak: { x: 0.35, y: 0.55 },
    hint: 'JUMP the low bucket, DUCK the high one, BARK at the glowing latch!',
    tiers: [
      [{ kind: 'sweep', shot: P('h3'), height: 'low' }, { kind: 'drop', shot: P('h1'), n: 1 }],
      [{ kind: 'sweep', shot: P('h3'), height: 'low' }, { kind: 'sweep', shot: P('h3'), height: 'high' }, { kind: 'drop', shot: P('h1'), n: 2 }],
      [{ kind: 'sweep', shot: P('h3'), height: 'high' }, { kind: 'sweep', shot: P('h3'), height: 'low', speed: 600 }, { kind: 'drop', shot: P('h1'), n: 2 }],
    ],
  },
  7: {
    level: 7,
    name: 'DOGCATCHER NET-O-MATIC',
    hp: 20,
    height: 230,
    facesRight: true,
    openTime: 1.7,
    weak: { x: 0.82, y: 0.25 },
    hint: 'Read the net’s height: JUMP it or DUCK it! BARK the latch when it jams!',
    tiers: [
      [{ kind: 'sweep', shot: P('h1'), height: 'high' }, { kind: 'roll', shot: P('h3') }],
      [{ kind: 'sweep', shot: P('h1'), height: 'low' }, { kind: 'roll', shot: P('h3') }, { kind: 'sweep', shot: P('h1'), height: 'high' }],
      [{ kind: 'sweep', shot: P('h1'), height: 'high' }, { kind: 'sweep', shot: P('h1'), height: 'low', speed: 560 }, { kind: 'roll', shot: P('h3'), speed: 300 }],
    ],
  },
  8: {
    level: 8,
    name: 'HONKZILLA',
    hp: 20,
    height: 240,
    facesRight: true,
    openTime: 1.5,
    weak: { x: 0.55, y: 0.55 },
    hint: 'JUMP the charge, hop the gust, BARK when the goose is dizzy!',
    tiers: [
      [{ kind: 'swoop', height: 'low' }, { kind: 'sweep', shot: P('h3'), height: 'low' }],
      [{ kind: 'swoop', height: 'low' }, { kind: 'sweep', shot: P('h3'), height: 'low' }, { kind: 'volley', shot: P('h1', [0, 0, 0.33, 1]), n: 2 }],
      [{ kind: 'swoop', height: 'low' }, { kind: 'sweep', shot: P('h3'), height: 'low' }, { kind: 'swoop', height: 'low', speed: 540 }],
    ],
  },
  9: {
    level: 9,
    name: 'SQUIRREL BOSS',
    hp: 24,
    height: 240,
    facesRight: true,
    openTime: 1.6,
    weak: { x: 0.72, y: 0.62 },
    hint: 'One last prank! Dodge it all and BARK at the launcher latch!',
    tiers: [
      [{ kind: 'roll', shot: P('h3') }, { kind: 'volley', shot: P('h1', [0, 0, 0.34, 1]), n: 1 }],
      [{ kind: 'sweep', shot: P('e1'), height: 'high' }, { kind: 'volley', shot: P('h1', [0.33, 0, 0.66, 1]), n: 3 }],
      [{ kind: 'roll', shot: P('h3') }, { kind: 'volley', shot: P('h1', [0.66, 0, 1, 1]), n: 2 }, { kind: 'roll', shot: P('h3'), speed: 300 }, { kind: 'drop', shot: P('h1', [0, 0, 0.34, 1]), n: 2 }],
    ],
  },
};
