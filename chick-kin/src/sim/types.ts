// Data contract for levels and arenas. Levels are pure data (src/data/levels) validated by tests.
import type { PowerId } from '../data/items';
import type { Stage } from '../data/growth';

export type ArenaMode = 'side' | 'top';
export type Theme = 'nest' | 'coop' | 'rafters' | 'farmyard' | 'championship';

/**
 * Coordinates: side arenas use x → right, y → up (metres).
 * Top-down arenas use x → right, y → toward the camera (rendered as world z); hop height is separate.
 */
export type SolidKind = 'ground' | 'plank' | 'beam' | 'hay' | 'straw' | 'wood' | 'fence' | 'wall' | 'stone' | 'crate' | 'nestrim' | 'post' | 'coop' | 'water' | 'catchbed';

export interface SolidDef {
  x: number; y: number; w: number; h: number;
  kind?: SolidKind;
  /** Side: platform you can jump up through and stand on. */
  oneWay?: boolean;
  /** Top-down: wall height (hop clears it if high enough). Default 1.2 (not hoppable). */
  height?: number;
  /** Low fence (OBS-06) — a side solid you duck beneath; recorded for AI and art. */
  lowFence?: boolean;
}

export type EntityDef =
  | { t: 'crumb'; x: number; y: number }
  | { t: 'feather'; x: number; y: number }
  | { t: 'power'; x: number; y: number; pu: PowerId; respawn?: number }
  | { t: 'egg'; path: [number, number][]; speed: number; period: number; phase?: number; r?: number }
  | { t: 'mud'; x: number; y: number; w: number; h: number }
  | { t: 'seed'; x: number; y: number; w: number; h: number }
  | { t: 'wind'; x: number; y: number; w: number; h: number; fx: number; fy: number; on: number; off: number; phase?: number }
  | { t: 'spring'; x: number; y: number; w: number; power: number; period: number; phase?: number }
  | { t: 'bucket'; px: number; py: number; len: number; amp: number; period: number; phase?: number; ride?: boolean }
  | { t: 'wobbly'; x: number; y: number; w: number; amp: number; period: number; phase?: number }
  | { t: 'straw'; x: number; y: number; w: number; h: number; hp?: number }
  | { t: 'bale'; x: number; y: number; w: number; h: number; mass?: number }
  | { t: 'crate'; x: number; y: number; w: number; h: number; mass?: number }
  | { t: 'mover'; x: number; y: number; w: number; h: number; x2: number; y2: number; period: number; phase?: number }
  | { t: 'tugworm'; x: number; y: number }
  | { t: 'perch'; x: number; y: number; w: number; h: number }
  | { t: 'finish'; x: number; y: number; w: number; h: number }
  | { t: 'checkpoint'; x: number; y: number }
  | { t: 'scratch'; x: number; y: number }
  | { t: 'basket'; x: number; y: number; r: number; owner?: number }
  | { t: 'cornpile'; x: number; y: number; count: number; respawn?: number }
  | { t: 'gate'; x: number; y: number; w: number; h: number }
  | { t: 'mound'; x: number; y: number; r: number; elev: number }
  | { t: 'deco'; kind: string; x: number; y: number; s?: number; r?: number };

export type RouteAct = 'jump' | 'duck' | 'peck' | 'push' | 'wait' | 'glide' | 'ability';
export interface RouteNode {
  x: number; y: number;
  /** Action performed when leaving this node toward the next. */
  a?: RouteAct;
  /** For 'wait': index of a mover/bucket/egg entity whose phase must be in [lo, hi] (0..1). */
  wait?: { e: number; lo: number; hi: number };
  /** Stages/classes that may use this branch; omitted = everyone. */
  cls?: ('speedy' | 'mighty' | 'nimble')[];
}
export interface RouteDef { color: 'common' | 'gold' | 'red' | 'teal'; nodes: RouteNode[] }

export interface ArenaDef {
  mode: ArenaMode;
  theme: Theme;
  w: number; h: number;
  starts: [number, number][];
  solids: SolidDef[];
  entities: EntityDef[];
  /** Side arenas: AI routes. The common route must be completable by every class. */
  routes?: RouteDef[];
  /** Side: falling below this y respawns at the last checkpoint. */
  killY?: number;
  /** Side: falling this far below the last checkpoint returns you to it (vertical climbs). */
  fallRecovery?: number;
  /** Seconds before a collected crumb spot respawns (limited symmetric replenishment). */
  crumbRespawn?: number;
  /** Camera framing hint. */
  camera?: 'close' | 'overhead' | 'three-quarter' | 'follow' | 'vertical';
}

export type ObjectiveDef =
  | { kind: 'collect'; count: number }
  | { kind: 'tug'; count: number }
  | { kind: 'perch'; seconds: number }
  | { kind: 'race'; requireFirst: boolean }
  | { kind: 'reach'; feathers?: number; requireFirst?: boolean }
  | { kind: 'deliver'; cargo: 'treat' | 'bundle'; count: number; requireFirst?: boolean }
  | { kind: 'mostDeliveries'; seconds: number };

export interface PhaseDef {
  name: string;
  arena: ArenaDef;
  objective: ObjectiveDef;
}

export interface MedalDef { /** seconds for the time medal, if the objective has one */ time?: number; feathers?: number }

export interface LevelDef {
  id: string;           // "1-1"
  chapter: Stage;
  index: number;        // 1..5
  title: string;
  brief: string;        // one-line objective text for UI
  tip?: string;         // short playable-opening hint
  /** single = one phase; relay = each competitor advances independently; showdown = scored rounds. */
  format: 'single' | 'relay' | 'showdown';
  phases: PhaseDef[];
  /** Showdown tie-break phase. */
  tiebreak?: PhaseDef;
  /** Hard cap; the level resolves (not a failure by itself unless the objective demands first place). */
  timeLimit: number;
  medals?: MedalDef;
  music: string;
  /** Hazard ids that generation variants may add (applied deterministically by seed). */
  variants?: VariantDef[];
}

export interface VariantDef { name: string; phase?: number; add: EntityDef[] }

export type Placement = 1 | 2 | 3 | 4;
