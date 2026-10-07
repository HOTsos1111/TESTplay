/**
 * Per-chapter look: which background layers, obstacle skins, duck-under bar and
 * exit gate a level uses. Mechanics are shared; only the dressing changes.
 * GameScene sets `LevelTheme.id` from the chapter before building the level.
 */
/** 'depot' and 'street' are the original chapters; 'lv1'..'lv9' are built from the level guides. */
export type ThemeId = string;

export interface ThemeDef {
  far: string;
  roof: string;
  /** Low ground hazards that are jumped (tyre-like). */
  low: string[];
  /** Solid landable crates. */
  crate: string[];
  /** Bark-breakable boxes. */
  cardboard: string[];
  /** Platform deck skins. */
  platform: string[];
  /** Duck-under bar texture and the colour of its supports. */
  lowbar: string;
  lowbarPole: { dark: number; mid: number };
  gate: string;
  gateDoor: string;
  /** Zone used when a chapter defines none. */
  defaultZone: { near: string; mid: string; indoor: boolean };
  /** Campaign level whose guide art this theme is built from. */
  level?: number;
  /** Rolling hazard texture (default: the wheelie bin). */
  roller?: string;
  /** Roadside pest texture used for every pose, and what it throws. */
  enemy?: string;
  shot?: string;
  pile?: string;
  /** Platform deck height when the deck is a guide piece. */
  deckThickness?: number;
}

export const THEMES: Record<ThemeId, ThemeDef> = {
  depot: {
    far: 'depot_far',
    roof: 'depot_roofline',
    low: ['tyre', 'tyre', 'hazard_cone'],
    crate: ['crate', 'crate_parcel'],
    cardboard: ['cardboard'],
    platform: ['steel', 'conveyor', 'plank'],
    lowbar: 'lowbar',
    lowbarPole: { dark: 0x302331, mid: 0x6f7e96 },
    gate: 'exit_gate',
    gateDoor: 'gate_door',
    defaultZone: { near: 'depot_near', mid: 'depot_mid', indoor: true },
  },
  street: {
    far: 'street_far',
    roof: 'street_roofline',
    low: ['hydrant', 'flowerpot', 'flowerpot'],
    crate: ['crate', 'crate_parcel'],
    cardboard: ['cardboard'],
    platform: ['awning'],
    lowbar: 'lowbar_awning',
    lowbarPole: { dark: 0x302331, mid: 0x2f6b54 },
    gate: 'park_gate',
    gateDoor: 'park_gate_door',
    defaultZone: { near: 'street_near_bakery', mid: 'street_mid', indoor: false },
  },
};

export const LevelTheme = { id: 'depot' as ThemeId };

export function theme(): ThemeDef {
  return THEMES[LevelTheme.id];
}
