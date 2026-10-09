/**
 * Which piece of each level's asset guide plays which gameplay role. Codes are
 * the guide's printed IDs (L01-E1 -> 'e1'); `crop` trims the piece to a part of
 * it, as fractions of its width and height [x0, y0, x1, y1].
 */
export interface Piece {
  code: string;
  crop?: [number, number, number, number];
}

export interface GroundPalette {
  top: number;
  topDark: number;
  seam: number;
  front: number;
  frontDark: number;
  side: number;
  /** Thin highlight along the front lip. */
  lip: number;
}

export interface LevelArtDef {
  /** Sky gradient, top to horizon. */
  sky: [number, number];
  /** Haze colour behind the distant layers (fills gaps down to the ground). */
  haze: number;
  ground: GroundPalette;
  /** Solid, landable block (64x64). */
  block: Piece;
  /** Bark-breakable blocker; omitted = shared cardboard boxes. */
  breakable?: Piece;
  /** Small static ground hazard to hop. */
  low: Piece;
  /** Rolling ground hazard. */
  roller: Piece;
  /** Overhead obstacle to duck under. */
  duck: Piece;
  /** One-way platform deck (a horizontal band of this piece is tiled). */
  deck: Piece;
  /** The roadside pest that pelts the hero, and what it throws. */
  thrower: Piece;
  shot: Piece;
  /** Exit landmark at the end of the route. */
  exit: Piece;
  /** Parallax pieces. */
  far: Piece;
  distant: Piece;
  mid: Piece[];
  near: Piece[];
  /** Shared building textures (public/levels/shared) that replace MG1 as the street of buildings. */
  buildings?: string[];
}

const P = (code: string, crop?: Piece['crop']): Piece => ({ code, crop });

export const LEVEL_ART: Record<number, LevelArtDef> = {
  1: {
    sky: [0x86cdf0, 0xfbe9c6],
    haze: 0xf3d9b6,
    ground: { top: 0xd9cfc2, topDark: 0xc6baab, seam: 0xa79987, front: 0x94705a, frontDark: 0x6f523f, side: 0x5a4234, lip: 0xfff3e0 },
    block: P('p2', [0.02, 0.05, 0.36, 0.95]),
    breakable: P('h2'),
    low: P('h1'),
    roller: P('h1'),
    duck: P('p3'),
    deck: P('p3', [0.08, 0.06, 1, 0.42]),
    thrower: P('e1'),
    shot: P('h3', [0, 0, 0.36, 1]),
    exit: P('mg2'),
    far: P('bg2'),
    distant: P('bg1'),
    mid: [P('mg1'), P('mg2')],
    near: [P('fg1'), P('fg2')],
    buildings: ['building_1', 'building_2', 'building_3'],
  },
  2: {
    sky: [0x9bc6e6, 0xf2e2c4],
    haze: 0xd9cfbd,
    ground: { top: 0xcfc8bd, topDark: 0xbcb3a6, seam: 0x9d9386, front: 0x8a8279, frontDark: 0x6c655d, side: 0x554f48, lip: 0xf4efe6 },
    block: P('p2', [0.03, 0, 0.36, 1]),
    low: P('fg2'),
    roller: P('h1'),
    duck: P('h2', [0, 0, 1, 0.42]),
    deck: P('p3', [0, 0.02, 1, 0.42]),
    thrower: P('e2'),
    shot: P('h3'),
    exit: P('mg1'),
    far: P('bg2'),
    distant: P('bg1'),
    mid: [P('mg1'), P('mg2')],
    near: [P('fg1'), P('fg2')],
  },
  3: {
    sky: [0x7fc6ec, 0xe6f4f2],
    haze: 0xcfe6ea,
    ground: { top: 0xbd8a57, topDark: 0xa97646, seam: 0x7d5531, front: 0x6c4b2f, frontDark: 0x553a24, side: 0x3e2b1c, lip: 0xf3d6ad },
    block: P('fg1'),
    low: P('e2'),
    roller: P('h3', [0, 0, 0.36, 1]),
    duck: P('p3', [0, 0, 1, 0.36]),
    deck: P('p2', [0, 0.05, 1, 0.5]),
    thrower: P('e1'),
    shot: P('h3', [0.36, 0, 0.66, 1]),
    exit: P('mg1'),
    far: P('bg2'),
    distant: P('bg1'),
    mid: [P('mg1'), P('mg2')],
    near: [P('fg1'), P('fg2')],
  },
  4: {
    sky: [0x95c3e3, 0xf0dcc0],
    haze: 0xd8d5d0,
    ground: { top: 0x9d9084, topDark: 0x8a7d71, seam: 0x6c5f54, front: 0x7a5a3c, frontDark: 0x5d442e, side: 0x473425, lip: 0xe2d6c8 },
    block: P('h3', [0, 0, 0.36, 1]),
    low: P('fg2'),
    roller: P('h3', [0.36, 0, 0.66, 1]),
    duck: P('h2', [0.06, 0, 1, 0.5]),
    deck: P('p3', [0.04, 0.05, 0.96, 0.5]),
    thrower: P('e1'),
    shot: P('h3', [0.66, 0, 1, 1]),
    exit: P('mg1'),
    far: P('bg2'),
    distant: P('bg1'),
    mid: [P('mg1'), P('mg2')],
    near: [P('fg1'), P('fg2')],
  },
  5: {
    sky: [0xa9b9d6, 0xf1d8c2],
    haze: 0xd6c9cf,
    ground: { top: 0x75727a, topDark: 0x646168, seam: 0x4c4a52, front: 0x4f4c53, frontDark: 0x3d3b41, side: 0x2e2c32, lip: 0xc9c4cc },
    block: P('fg1'),
    low: P('fg2'),
    roller: P('h2', [0, 0, 0.33, 1]),
    duck: P('p2', [0, 0, 1, 0.42]),
    deck: P('p3', [0, 0.22, 1, 0.48]),
    thrower: P('e1'),
    shot: P('h2', [0.36, 0, 0.66, 1]),
    exit: P('mg1'),
    far: P('bg2'),
    distant: P('bg1'),
    mid: [P('mg1'), P('mg2')],
    near: [P('fg1'), P('fg2')],
  },
  6: {
    sky: [0x8acdf2, 0xfde7c2],
    haze: 0xe6d9c6,
    ground: { top: 0xb27d4c, topDark: 0x9c6b3f, seam: 0x7f5533, front: 0x7a5434, frontDark: 0x5f4128, side: 0x4a3220, lip: 0xf0cf9c },
    block: P('fg2', [0.05, 0.25, 0.42, 1]),
    breakable: P('h3'),
    low: P('fg1'),
    roller: P('h3'),
    duck: P('h1'),
    deck: P('p2', [0.04, 0.12, 0.96, 0.34]),
    thrower: P('e1'),
    shot: P('h3'),
    exit: P('mg2'),
    far: P('bg2'),
    distant: P('bg1'),
    mid: [P('mg1'), P('mg2')],
    near: [P('fg1'), P('fg2')],
  },
  7: {
    sky: [0x86c6ee, 0xf6e6cf],
    haze: 0xdfe3e6,
    ground: { top: 0xd9cdb8, topDark: 0xc7baa3, seam: 0xa99b84, front: 0x9c8c78, frontDark: 0x7d6f5e, side: 0x625648, lip: 0xfff4e2 },
    block: P('fg2'),
    breakable: P('h3'),
    low: P('fg1'),
    roller: P('h3'),
    duck: P('h2'),
    deck: P('p2', [0, 0, 1, 0.62]),
    thrower: P('e2'),
    shot: P('h1'),
    exit: P('mg2'),
    far: P('bg2'),
    distant: P('bg1'),
    mid: [P('mg1'), P('mg2')],
    near: [P('fg1'), P('fg2')],
  },
  8: {
    sky: [0x8fd0ea, 0xf4ecc8],
    haze: 0xcfe2c8,
    ground: { top: 0x8fc457, topDark: 0x79ad47, seam: 0x5f9437, front: 0x8a6440, frontDark: 0x6b4c30, side: 0x523823, lip: 0xdff0b8 },
    block: P('p2', [0, 0.05, 0.3, 0.95]),
    low: P('h1', [0, 0, 0.33, 1]),
    roller: P('h1', [0.66, 0, 1, 1]),
    duck: P('h2'),
    deck: P('p2', [0.15, 0.08, 0.95, 0.75]),
    thrower: P('e1'),
    shot: P('h1', [0.33, 0, 0.66, 1]),
    exit: P('mg2'),
    far: P('bg2'),
    distant: P('bg1'),
    mid: [P('mg1'), P('mg2')],
    near: [P('fg1'), P('fg2')],
  },
  9: {
    sky: [0x8fc0e8, 0xfbd8a8],
    haze: 0xf2d9b8,
    ground: { top: 0x9ccf5f, topDark: 0x86ba4f, seam: 0x6da23f, front: 0xd8cbb4, frontDark: 0xbfae93, side: 0x8f7f69, lip: 0xf3ffd6 },
    block: P('p2', [0, 0, 0.3, 1]),
    breakable: P('e1'),
    low: P('h3'),
    roller: P('h3'),
    duck: P('p3', [0, 0.1, 1, 0.62]),
    deck: P('p3', [0.08, 0.12, 0.92, 0.6]),
    thrower: P('e1'),
    shot: P('h1', [0, 0, 0.34, 1]),
    exit: P('mg2'),
    far: P('bg2'),
    distant: P('bg1'),
    mid: [P('mg1'), P('mg2')],
    near: [P('fg1'), P('fg2')],
  },
};

/** Texture key of a raw guide piece. */
export const pieceKey = (level: number, code: string) => `l0${level}_${code}`;
