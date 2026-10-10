import Phaser from 'phaser';
import { DEPTH, WORLD } from '../data/config';
import { BOSSES, type Attack, type BossDef, type Lane } from '../data/bosses';
import { pieceKey, type Piece } from '../data/levelArt';
import { Audio } from '../systems/AudioManager';
import { pieceTexture } from '../systems/LevelSkins';
import type { Rect } from '../systems/PlayerController';
import type { Boss, BossEvent } from './SquirrelSwarm';
import { Entity, type GameContext } from './World';

const G = WORLD.groundY;
/**
 * Lanes for things that cross the arena: low ones are jumped, high ones ducked,
 * and air ones fly over a dog on the ground but catch one on a low ledge or mid-jump.
 */
const LANE = {
  low: { top: G - 56, bottom: G - 2 },
  high: { top: G - 100, bottom: G - 30 },
  air: { top: G - 178, bottom: G - 112 },
} as const;
const LANE_CUE: Record<Lane, string> = { low: '▲ JUMP!', high: '▼ DUCK!', air: '● STAY DOWN!' };
const WARN = 1.0;

/** Fallback when a guide piece is missing: a plain ink-outlined disc. */
function shotTexture(scene: Phaser.Scene, level: number, p: Piece, w: number, h: number): string {
  const key = pieceTexture(scene, level, p, w, h);
  if (key) return key;
  if (!scene.textures.exists('boss_shot_fallback')) {
    const g = scene.make.graphics({}, false);
    g.fillStyle(0x302331, 1).fillCircle(16, 16, 16);
    g.fillStyle(0xe0a35a, 1).fillCircle(16, 16, 12);
    g.generateTexture('boss_shot_fallback', 32, 32);
    g.destroy();
  }
  return 'boss_shot_fallback';
}

/** A red ellipse on the floor marking where something is about to land. */
function marker(scene: Phaser.Scene, x: number, w = 76): Phaser.GameObjects.Ellipse {
  return scene.add.ellipse(x, G - 2, w, 18, 0xe5533d, 0.45).setStrokeStyle(3, 0x9b2a1d, 0.9).setDepth(DEPTH.groundShadow + 1);
}

// ---------------------------------------------------------------- projectiles

/** Lobbed shot that lands on a marked spot and bursts. */
class LobShot extends Entity {
  private img: Phaser.GameObjects.Image;
  private mark: Phaser.GameObjects.Ellipse;
  private vx: number;
  private vy: number;
  private t = 0;
  constructor(scene: Phaser.Scene, private x: number, private y: number, target: number, tex: string, flight: number) {
    super();
    this.img = scene.add.image(x, y, tex).setDepth(DEPTH.boss + 2);
    this.mark = marker(scene, target, 60);
    const g = 1500;
    this.vx = (target - x) / flight;
    this.vy = (G - 16 - y - 0.5 * g * flight * flight) / flight;
  }
  get right(): number {
    return Number.POSITIVE_INFINITY;
  }
  hazard(): Rect {
    return { x: this.x - 15, y: this.y - 14, w: 30, h: 28 };
  }
  barkTarget(): Rect {
    return { x: this.x - 22, y: this.y - 22, w: 44, h: 44 };
  }
  onBark(ctx: GameContext): void {
    this.alive = false;
    ctx.fx.puff(this.x, this.y, 3, 0.6);
  }
  onHeroHit(): void {
    this.alive = false;
  }
  update(dt: number, ctx: GameContext): void {
    this.t += dt;
    this.vy += 1500 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.img.setPosition(this.x, this.y).setRotation(this.t * 8);
    this.mark.setAlpha(0.4 + 0.3 * Math.sin(this.t * 16));
    if (this.y >= G - 16) {
      this.alive = false;
      ctx.fx.puff(this.x, G - 10, 3, 0.7);
      Audio.play('nut_land');
    }
  }
  destroy(): void {
    this.img.destroy();
    this.mark.destroy();
  }
}

/** Rolls along the floor toward the dog. Heavy ones shrug off barks. */
class Roller extends Entity {
  private img: Phaser.GameObjects.Image;
  constructor(scene: Phaser.Scene, private x: number, tex: string, private speed: number, private heavy: boolean, private r = 24) {
    super();
    this.img = scene.add.image(x, G - r, tex).setDepth(DEPTH.boss + 1);
  }
  get right(): number {
    return Number.POSITIVE_INFINITY;
  }
  hazard(): Rect {
    return { x: this.x - this.r + 4, y: G - this.r * 2 + 4, w: this.r * 2 - 8, h: this.r * 2 - 6 };
  }
  barkTarget(): Rect | null {
    return this.heavy ? null : { x: this.x - this.r - 6, y: G - this.r * 2 - 6, w: this.r * 2 + 12, h: this.r * 2 + 6 };
  }
  onBark(ctx: GameContext): void {
    this.alive = false;
    ctx.fx.puff(this.x, G - this.r, 4, 0.8);
  }
  update(dt: number, ctx: GameContext): void {
    this.x -= this.speed * dt;
    this.img.setPosition(this.x, G - this.r).setRotation(this.img.rotation - (this.speed * dt) / this.r);
    if (Math.random() < dt * 5) ctx.fx.dust(this.x + Math.sign(this.speed) * this.r, G, 1);
    if (this.x < ctx.cameraLeft - 80 || this.x > ctx.cameraRight + 80) this.alive = false;
  }
  destroy(): void {
    this.img.destroy();
  }
}

/** Crosses the arena in one lane after a warning band. */
class Sweeper extends Entity {
  private img: Phaser.GameObjects.Image;
  constructor(scene: Phaser.Scene, private x: number, tex: string, private lane: Lane, private speed: number) {
    super();
    const L = LANE[lane];
    this.img = scene.add.image(x, (L.top + L.bottom) / 2, tex).setDepth(DEPTH.boss + 1);
    this.img.setDisplaySize(130, L.bottom - L.top + 14).setFlipX(speed < 0);
  }
  get right(): number {
    return Number.POSITIVE_INFINITY;
  }
  hazard(): Rect {
    const L = LANE[this.lane];
    return { x: this.x - 55, y: L.top, w: 110, h: L.bottom - L.top };
  }
  update(dt: number, ctx: GameContext): void {
    this.x -= this.speed * dt;
    this.img.x = this.x;
    this.img.rotation = Math.sin(this.x * 0.05) * 0.05;
    if (this.x < ctx.cameraLeft - 140 || this.x > ctx.cameraRight + 140) this.alive = false;
  }
  destroy(): void {
    this.img.destroy();
  }
}

/** Falls onto a marked spot. */
class Dropper extends Entity {
  private img: Phaser.GameObjects.Image;
  private mark: Phaser.GameObjects.Ellipse;
  private y = -80;
  private vy = 0;
  private t = 0;
  constructor(scene: Phaser.Scene, private x: number, tex: string, private delay: number) {
    super();
    this.img = scene.add.image(x, this.y, tex).setDepth(DEPTH.boss + 2);
    this.mark = marker(scene, x, 84);
  }
  get right(): number {
    return Number.POSITIVE_INFINITY;
  }
  hazard(): Rect | null {
    return this.t >= this.delay ? { x: this.x - 30, y: this.y - 26, w: 60, h: 52 } : null;
  }
  update(dt: number, ctx: GameContext): void {
    this.t += dt;
    this.mark.setAlpha(0.35 + 0.35 * Math.abs(Math.sin(this.t * 10)));
    if (this.t < this.delay) return;
    this.vy += 2200 * dt;
    this.y += this.vy * dt;
    this.img.setPosition(this.x, this.y).setRotation(this.t * 3);
    if (this.y >= G - 26) {
      this.alive = false;
      ctx.fx.puff(this.x, G - 12, 6, 1);
      ctx.fx.dust(this.x, G, 4);
      Audio.play('land');
    }
  }
  destroy(): void {
    this.img.destroy();
    this.mark.destroy();
  }
}

/** A column of steam (or water) that bursts up from a marked vent. */
class Geyser extends Entity {
  private mark: Phaser.GameObjects.Ellipse;
  private col: Phaser.GameObjects.Graphics;
  private t = 0;
  static readonly ACTIVE = 0.8;
  constructor(scene: Phaser.Scene, private x: number, private color: number) {
    super();
    this.mark = marker(scene, x, 90);
    this.col = scene.add.graphics().setDepth(DEPTH.boss + 1);
  }
  get right(): number {
    return Number.POSITIVE_INFINITY;
  }
  private get on(): boolean {
    return this.t >= WARN && this.t < WARN + Geyser.ACTIVE;
  }
  hazard(): Rect | null {
    return this.on ? { x: this.x - 34, y: G - 170, w: 68, h: 170 } : null;
  }
  update(dt: number, ctx: GameContext): void {
    this.t += dt;
    const g = this.col;
    g.clear();
    if (this.t < WARN) {
      // Bubbling warning.
      this.mark.setAlpha(0.35 + 0.35 * Math.abs(Math.sin(this.t * 12)));
      if (Math.random() < dt * 10) ctx.fx.puff(this.x + (Math.random() - 0.5) * 50, G - 6, 1, 0.35);
      return;
    }
    if (this.on) {
      const k = Math.min(1, (this.t - WARN) / 0.12);
      g.fillStyle(this.color, 0.85).fillRoundedRect(this.x - 34, G - 170 * k, 68, 170 * k, 30);
      g.fillStyle(0xffffff, 0.55).fillRoundedRect(this.x - 14, G - 160 * k, 16, 150 * k, 8);
      if (Math.random() < dt * 14) ctx.fx.puff(this.x + (Math.random() - 0.5) * 40, G - 170 * k, 1, 0.8);
      return;
    }
    this.alive = false;
  }
  destroy(): void {
    this.mark.destroy();
    this.col.destroy();
  }
}

/** A ripple of dust and rubble racing along the floor from a slam: jump it. */
class Shockwave extends Entity {
  private g: Phaser.GameObjects.Graphics;
  private t = 0;
  constructor(scene: Phaser.Scene, private x: number, private speed: number) {
    super();
    this.g = scene.add.graphics().setDepth(DEPTH.boss + 1);
  }
  get right(): number {
    return Number.POSITIVE_INFINITY;
  }
  hazard(): Rect {
    return { x: this.x - 20, y: G - 32, w: 40, h: 32 };
  }
  update(dt: number, ctx: GameContext): void {
    this.t += dt;
    this.x += this.speed * dt;
    const g = this.g;
    const d = Math.sign(this.speed);
    const h = 34 + Math.sin(this.t * 30) * 3;
    g.clear();
    g.fillStyle(0x302331, 0.9).fillTriangle(this.x - d * 34, G, this.x + d * 12, G - h - 3, this.x + d * 26, G);
    g.fillStyle(0xd9b48a, 1).fillTriangle(this.x - d * 28, G - 1, this.x + d * 10, G - h + 3, this.x + d * 20, G - 1);
    g.fillStyle(0xfff1d8, 0.8).fillTriangle(this.x - d * 8, G - 2, this.x + d * 8, G - h + 8, this.x + d * 12, G - 2);
    if (Math.random() < dt * 20) ctx.fx.dust(this.x - d * 20, G, 1);
    if (this.x < ctx.cameraLeft - 60 || this.x > ctx.cameraRight + 60) this.alive = false;
  }
  destroy(): void {
    this.g.destroy();
  }
}

/** A rapid string of sweeps at mixed heights, each flashing its lane just before it flies. */
class Barrage extends Entity {
  private t = 0;
  private i = 0;
  private g: Phaser.GameObjects.Graphics;
  private cue: Phaser.GameObjects.Text;
  static readonly GAP = 0.62;
  static readonly LEAD = 0.42;
  constructor(
    private scene: Phaser.Scene,
    private x0: number,
    private dir: 1 | -1,
    private tex: string,
    private lanes: Lane[],
    private speed: number,
    private spawn: (e: Entity) => void,
  ) {
    super();
    this.g = scene.add.graphics().setDepth(DEPTH.groundShadow + 1);
    this.cue = scene.add.text(0, 0, '', { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '22px', fontStyle: 'bold', color: '#FFFFFF', stroke: '#302331', strokeThickness: 5 }).setOrigin(0.5).setDepth(DEPTH.fx + 2);
  }
  get right(): number {
    return Number.POSITIVE_INFINITY;
  }
  update(dt: number): void {
    this.t += dt;
    const g = this.g;
    g.clear();
    this.cue.setVisible(false);
    // Flash the next lane along the first stretch of its path.
    const k = this.i;
    if (k < this.lanes.length) {
      const start = k * Barrage.GAP;
      if (this.t >= start) {
        const L = LANE[this.lanes[k]];
        const x1 = this.x0 + this.dir * 520;
        const pulse = 0.25 + 0.2 * Math.abs(Math.sin(this.t * 22));
        g.fillStyle(0xe5533d, pulse).fillRect(Math.min(this.x0, x1), L.top, 520, L.bottom - L.top);
        this.cue.setText(LANE_CUE[this.lanes[k]]).setPosition(this.x0 + this.dir * 200, L.top - 18).setVisible(true);
      }
      if (this.t >= start + Barrage.LEAD) {
        this.spawn(new Sweeper(this.scene, this.x0, this.tex, this.lanes[k], -this.dir * this.speed));
        Audio.play('throw');
        this.i++;
      }
    } else this.alive = false;
  }
  destroy(): void {
    this.g.destroy();
    this.cue.destroy();
  }
}

/** A ball that bounces toward the dog, each at its own hop height: run under it or jump over. */
class Bouncer extends Entity {
  private img: Phaser.GameObjects.Image;
  private vy = -250;
  private r = 22;
  constructor(scene: Phaser.Scene, private x: number, private y: number, tex: string, private vx: number, private hop: number) {
    super();
    this.img = scene.add.image(x, y, tex).setDepth(DEPTH.boss + 2);
  }
  get right(): number {
    return Number.POSITIVE_INFINITY;
  }
  hazard(): Rect {
    return { x: this.x - this.r + 4, y: this.y - this.r + 4, w: this.r * 2 - 8, h: this.r * 2 - 8 };
  }
  barkTarget(): Rect {
    return { x: this.x - this.r - 8, y: this.y - this.r - 8, w: this.r * 2 + 16, h: this.r * 2 + 16 };
  }
  onBark(ctx: GameContext): void {
    this.alive = false;
    ctx.fx.puff(this.x, this.y, 3, 0.7);
  }
  onHeroHit(): void {
    this.alive = false;
  }
  update(dt: number, ctx: GameContext): void {
    this.vy += 1500 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.y >= G - this.r) {
      this.y = G - this.r;
      this.vy = -Math.sqrt(2 * 1500 * this.hop);
      ctx.fx.dust(this.x, G, 1);
      Audio.play('nut_land');
    }
    this.img.setPosition(this.x, this.y).setRotation(this.img.rotation + (this.vx * dt) / this.r);
    if (this.x < ctx.cameraLeft - 60 || this.x > ctx.cameraRight + 60) this.alive = false;
  }
  destroy(): void {
    this.img.destroy();
  }
}

// ---------------------------------------------------------------- the boss

type Phase = 'enter' | 'idle' | 'hop' | 'warn' | 'act' | 'dizzy' | 'recover' | 'roar' | 'defeat' | 'done';

/** Where the boss stands between attacks: one of the two ends of the arena (screen x). */
const HOME = { [-1]: 170, [1]: 1110 } as Record<-1 | 1, number>;
/** How far a slam can land from the arena edges (screen x). */
const SLAM_MIN = 260;
const SLAM_MAX = 1020;
/**
 * The arena: two low ledges and a high one between them (each one jump above
 * the last). They drop through with DOWN, so the dog can go up to dodge a
 * charge or a shockwave and drop straight back down to punish.
 */
export const ARENA_DECKS = [
  { x: 300, w: 220, h: 95 },
  { x: 760, w: 220, h: 95 },
  { x: 540, w: 200, h: 195 },
] as const;
/** Hits the boss can take in one opening before it shakes itself awake. */
const HITS_PER_OPENING = 4;
const DIZZY = 2.6;
/** Every bark lands: 1 damage normally, 3 (a crit) while it is dazed. */
const CRIT = 3;
/** This many normal hits in a row stagger it into a short daze, even mid-attack. */
const STAGGER = 5;
const STAGGER_DAZE = 1.7;
/** Health is this many times the data's hp (every bark now does damage). */
const HP_SCALE = 4;
/**
 * Places it moves between during a round: the two ends of the street, the two
 * low ledges and the high one (flyers circle at different heights instead).
 * Charges always start from an end on the ground.
 */
interface Spot {
  x: number;
  h: number;
  side?: -1 | 1;
}
const WALK_SPOTS: Spot[] = [
  { x: 170, h: 0, side: -1 },
  { x: 1110, h: 0, side: 1 },
  { x: 410, h: 95 },
  { x: 870, h: 95 },
  { x: 640, h: 195 },
];
const FLY_SPOTS: Spot[] = [
  { x: 170, h: 290, side: -1 },
  { x: 1110, h: 290, side: 1 },
  { x: 330, h: 320 },
  { x: 640, h: 345 },
  { x: 950, h: 320 },
];

/**
 * A level's end boss, driven by its entry in data/bosses, built on the classic
 * platformer boss loop: it is armoured while it attacks (barks just clang off),
 * every round of attacks ends with a big finisher (a charge into the far wall
 * or a leaping slam) that leaves it dazed, and while it is dazed every bark
 * lands. Each third of its health it roars and moves on to a nastier set of
 * attacks, and in the final third it is enraged: quicker warnings, faster
 * shockwaves, shorter openings.
 */
export class PatternBoss extends Entity implements Boss {
  phase: Phase = 'enter';
  hits = 0;
  readonly maxHits: number;
  readonly title: string;
  readonly icon: string;
  readonly speed = 0;
  readonly def: BossDef;
  onEvent?: (e: BossEvent) => void;
  private img: Phaser.GameObjects.Image;
  private bubble: Phaser.GameObjects.Image;
  private band: Phaser.GameObjects.Graphics;
  private ring: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private pop: Phaser.GameObjects.Text;
  private t = 0;
  private sx = 1500;
  private sy = 0;
  private fromX = 0;
  private fromY = 0;
  private toX = 0;
  private baseScale = 1;
  private attack: Attack | null = null;
  private queue: Attack[] = [];
  private round = 0;
  private kids: Entity[] = [];
  private targetX = 0;
  /** Which way it faces: 1 = right, -1 = left (toward the dog). */
  private facing: 1 | -1 = -1;
  /** Direction the current attack travels. */
  private dir: 1 | -1 = -1;
  /** Which end of the arena it calls home (0 = stuck mid-arena after a slam). */
  private side: -1 | 0 | 1 = 1;
  private flash = 0;
  private decksBuilt = false;
  private fall = { vy: 0, rot: 0 };
  private tierSeen = 0;
  private openingHits = 0;
  private stagger = 0;
  /** How long the current daze lasts (a full one after a finisher, a short one from a stagger). */
  private dazeFor = DIZZY;
  /** A shot it can lob mid-hop (from round two on). */
  private hopShot: Piece | null = null;
  private hopThrown = false;
  private clangT = 0;
  private popT = 0;
  private slamMark: Phaser.GameObjects.Ellipse | null = null;
  /** Height it stands (or hovers) at on its current spot. */
  private perch = 0;
  private toY = 0;
  private aim: Phaser.GameObjects.Graphics;
  /** Set by the game each frame: the dog's bark would reach it right now. */
  inRange = false;
  /** Attack lists per tier: every round ends in a finisher that leaves it dazed. */
  private tiers: Attack[][];

  constructor(private scene: Phaser.Scene, level: number, private makeDeck: (x: number, w: number, top: number) => Entity) {
    super();
    this.def = BOSSES[level];
    this.maxHits = this.def.hp * HP_SCALE;
    this.title = this.def.name;
    const key = pieceKey(level, 'b1');
    this.icon = scene.textures.exists(key) ? key : 'boss_flex';
    this.img = scene.add.image(0, G, this.icon).setOrigin(0.5, 1).setDepth(DEPTH.boss);
    this.baseScale = this.def.height / this.img.height;
    this.img.setScale(this.baseScale);
    this.bubble = scene.add.image(0, 0, 'fx_exclaim').setOrigin(0.5, 1).setScale(0.6).setDepth(DEPTH.boss + 3).setVisible(false);
    this.band = scene.add.graphics().setDepth(DEPTH.groundShadow + 1);
    this.ring = scene.add.graphics().setDepth(DEPTH.boss + 2);
    const font = { fontFamily: 'Trebuchet MS, sans-serif', fontStyle: 'bold', color: '#FFFFFF', stroke: '#302331', strokeThickness: 6 };
    this.label = scene.add.text(0, 0, '', { ...font, fontSize: '26px' }).setOrigin(0.5).setDepth(DEPTH.fx + 2).setVisible(false);
    this.pop = scene.add.text(0, 0, '', { ...font, fontSize: '22px' }).setOrigin(0.5).setDepth(DEPTH.fx + 2).setVisible(false);
    this.sy = this.hover;
    this.perch = this.hover;
    this.aim = scene.add.graphics().setDepth(DEPTH.fx + 1);
    const withShot = this.def.tiers.flat().find((a) => 'shot' in a) as { shot: Piece } | undefined;
    const shot = withShot?.shot;
    this.hopShot = shot ?? null;
    const finisher: Attack = this.def.flying ? { kind: 'swoop', height: 'high' } : { kind: 'slam' };
    this.tiers = this.def.tiers.map((t, i) => {
      const list = [...t];
      // Walkers learn the slam once hurt; every list needs at least one finisher.
      if (!this.def.flying && i > 0 && !list.some((a) => a.kind === 'slam')) list.push({ kind: 'slam' });
      if (!list.some(PatternBoss.finishes)) list.push(finisher);
      // Every boss also throws things at all three heights, more as it gets hurt.
      if (shot) {
        if (i === 0) list.push({ kind: 'bounce', shot, n: 1 });
        if (i === 1) list.push({ kind: 'barrage', shot, lanes: ['low', 'high', 'low'] }, { kind: 'bounce', shot, n: 2 });
        if (i === 2) list.push({ kind: 'barrage', shot, lanes: ['high', 'air', 'low', 'high'] }, { kind: 'barrage', shot, lanes: ['low', 'air', 'low'] });
      }
      return list;
    });
    Audio.play('whistle');
  }

  /** Charges and slams end a round: the boss is left dazed and open to barks. */
  private static finishes(a: Attack): boolean {
    return a.kind === 'swoop' || a.kind === 'slam';
  }

  get right(): number {
    return Number.POSITIVE_INFINITY;
  }

  /** Flyers circle high between attacks; walkers stand on the street. */
  private get hover(): number {
    return this.def.flying ? 300 : 0;
  }

  /** Screen x of the boss (for tests and the touch arrows). */
  get screenX(): number {
    return this.sx;
  }

  /** Dazed and open: every bark that reaches it lands a hit. */
  get vulnerable(): boolean {
    return this.phase === 'dizzy';
  }

  /** What the current or upcoming attack is (for tests and the touch arrows). */
  get telegraph(): { kind: Attack['kind']; height?: Lane; targetX: number; dir: number; reach?: number } | null {
    if (!this.attack || (this.phase !== 'warn' && this.phase !== 'act')) return null;
    if (this.attack.kind === 'slam' && this.phase === 'act' && this.t > 0.7) return null;
    const a = this.attack;
    return { kind: a.kind, height: a.kind === 'sweep' || a.kind === 'swoop' ? a.height : undefined, targetX: this.targetX, dir: this.dir, reach: a.kind === 'slam' ? this.footprint / 2 : undefined };
  }

  private get tierIndex(): number {
    const k = this.hits / this.maxHits;
    return Math.min(k >= 2 / 3 ? 2 : k >= 1 / 3 ? 1 : 0, this.tiers.length - 1);
  }

  private get enraged(): boolean {
    return this.tierIndex >= 2;
  }

  private get warnTime(): number {
    return this.enraged ? 0.55 : 0.75;
  }

  private go(p: Phase): void {
    this.phase = p;
    this.t = 0;
    this.fromX = this.sx;
    this.fromY = this.sy;
  }

  private worldX(ctx: GameContext): number {
    return ctx.cameraLeft + this.sx;
  }

  private body(): Rect {
    const w = this.img.displayWidth;
    const h = this.img.displayHeight;
    return { x: this.img.x - w * 0.36, y: this.img.y - h * 0.85, w: w * 0.72, h: h * 0.85 };
  }

  /** Width of ground a slam lands on (its body width at full size). */
  private get footprint(): number {
    return Math.round((this.img.width * this.baseScale) * 0.72 + 20);
  }

  /** Its bulk, for nudging the dog out of it (touching it only hurts while it attacks). */
  get bulk(): Rect | null {
    return this.fighting && this.phase !== 'dizzy' ? this.body() : null;
  }

  private get fighting(): boolean {
    return this.phase !== 'enter' && this.phase !== 'defeat' && this.phase !== 'done';
  }

  hazard(): Rect | null {
    if (this.phase !== 'act' || !this.attack) return null;
    if (this.attack.kind === 'swoop') {
      const L = LANE[this.attack.height];
      return { x: this.img.x - 60, y: L.top, w: 120, h: L.bottom - L.top };
    }
    // A slam only hurts where it lands (the red marker), not on the way down,
    // so a dog up on a ledge above the marker is safe.
    if (this.attack.kind === 'slam' && this.t > 0.45 && this.sy < 70) {
      const b = this.body();
      const top = Math.max(b.y, G - 90);
      const w = this.footprint - 20;
      return { x: this.img.x - w / 2, y: top, w, h: G - top };
    }
    return null;
  }

  barkTarget(): Rect | null {
    return this.fighting ? this.body() : null;
  }

  onBark(ctx: GameContext): void {
    if (!this.fighting || this.phase === 'roar') return;
    // Every bark lands. Dazed: a crit. Otherwise a chip that builds up a stagger.
    const open = this.phase === 'dizzy';
    const dmg = open ? CRIT : 1;
    this.hits = Math.min(this.maxHits, this.hits + dmg);
    this.flash = open ? 0.25 : 0.12;
    Audio.play('boss_hit');
    ctx.fx.stars(this.img.x, this.img.y - this.img.displayHeight * 0.6, open ? 6 : 2);
    ctx.fx.puff(this.img.x + (Math.random() - 0.5) * 80, this.img.y - Math.random() * this.img.displayHeight * 0.7, open ? 2 : 1, 0.8);
    this.scene.cameras.main.shake(open ? 110 : 60, open ? 0.005 : 0.0025);
    // Knocked back a little by the bark.
    const away = ctx.heroX < this.worldX(ctx) ? 1 : -1;
    if (this.phase !== 'act') this.sx = Phaser.Math.Clamp(this.sx + away * (open ? 18 : 8), 120, 1160);
    this.onEvent?.('hit');
    if (this.hits >= this.maxHits) {
      for (const k of this.kids) k.alive = false;
      this.clearTelegraph();
      this.ring.clear();
      this.go('defeat');
      this.fall = { vy: -420, rot: 0 };
      Audio.play('boss_clear');
      this.onEvent?.('defeated');
      return;
    }
    if (open) {
      this.openingHits++;
      this.popText(this.openingHits >= HITS_PER_OPENING ? 'COMBO! +3' : 'CRIT! +3', '#FFE27A');
      if (this.openingHits >= HITS_PER_OPENING) this.go('recover');
      return;
    }
    this.stagger++;
    this.popText(this.stagger >= STAGGER ? 'STAGGERED!' : '+1', this.stagger >= STAGGER ? '#FFE27A' : '#FFFFFF');
    // Not in the air mid-slam: it can't be knocked out of that.
    const airborne = this.phase === 'act' && this.attack?.kind === 'slam';
    if (this.stagger >= STAGGER && !airborne) {
      this.stagger = 0;
      this.clearTelegraph();
      if (this.def.flying || this.perch > 0) this.side = 0;
      this.perch = 0;
      this.sy = 0;
      this.openingHits = 0;
      this.dazeFor = STAGGER_DAZE;
      this.queue = [];
      this.go('dizzy');
    }
  }

  private popText(text: string, color: string): void {
    this.popT = 0.7;
    this.pop.setText(text).setColor(color).setVisible(true).setAlpha(1);
  }

  private clearTelegraph(): void {
    this.band.clear();
    this.label.setVisible(false);
    this.bubble.setVisible(false);
    this.slamMark?.destroy();
    this.slamMark = null;
  }

  /** The next round: two of the tier's attacks (rotating), then one of its finishers. */
  private planRound(): void {
    const list = this.tiers[this.tierIndex];
    const moves = list.filter((a) => !PatternBoss.finishes(a));
    const ends = list.filter(PatternBoss.finishes);
    const out: Attack[] = [];
    const n = Math.min(3, moves.length);
    for (let i = 0; i < n; i++) out.push(moves[(this.round * n + i) % moves.length]);
    out.push(ends[this.round % ends.length]);
    this.round++;
    this.queue = out;
  }

  private beginWarn(ctx: GameContext): void {
    if (!this.queue.length) this.planRound();
    const a = this.queue.shift()!;
    if (a.kind === 'swoop' && (this.side === 0 || (!this.def.flying && this.perch > 0))) {
      // Charges start from an end of the street: get there first.
      this.queue.unshift(a);
      this.goHome(ctx);
      return;
    }
    this.attack = a;
    this.targetX = ctx.heroX;
    const wx = this.worldX(ctx);
    if (a.kind === 'swoop') {
      // Charges always run the length of the arena, into the far wall.
      this.dir = this.side === 0 ? (ctx.heroX >= wx ? 1 : -1) : (-this.side as 1 | -1);
      this.toX = HOME[this.dir];
    } else this.dir = ctx.heroX >= wx ? 1 : -1;
    if (a.kind === 'slam') {
      this.targetX = Phaser.Math.Clamp(ctx.heroX, ctx.cameraLeft + SLAM_MIN, ctx.cameraLeft + SLAM_MAX);
      this.toX = this.targetX - ctx.cameraLeft;
      // The marker is as wide as the boss's landing footprint: what it covers is what hurts.
      this.slamMark = marker(this.scene, this.targetX, this.footprint);
    }
    this.go('warn');
    this.bubble.setVisible(true);
    Audio.play('squirrel_angry');
  }

  private launch(ctx: GameContext): void {
    const a = this.attack!;
    const s = this.scene;
    const lv = this.def.level;
    const bx = this.worldX(ctx);
    const by = this.img.y - this.img.displayHeight * 0.55;
    const d = this.dir;
    this.kids = [];
    const add = (e: Entity) => {
      this.kids.push(e);
      ctx.spawn(e);
    };
    const L = ctx.cameraLeft + 90;
    const R = ctx.cameraRight - 90;
    switch (a.kind) {
      case 'volley': {
        const n = a.n ?? 3;
        const tex = shotTexture(s, lv, a.shot, 34, 30);
        const offs = n === 1 ? [0] : n === 2 ? [-60, 60] : [-110, 0, 110];
        offs.forEach((o, i) => add(new LobShot(s, bx + d * 40, by, Phaser.Math.Clamp(this.targetX + o, L, R), tex, 1.0 + i * 0.12)));
        Audio.play('throw');
        break;
      }
      case 'roll':
        add(new Roller(s, bx + d * 70, shotTexture(s, lv, a.shot, 48, 48), -d * (a.speed ?? 250), !!a.heavy));
        Audio.play('parcel');
        break;
      case 'sweep':
        add(new Sweeper(s, bx + d * 80, shotTexture(s, lv, a.shot, 130, 70), a.height, -d * (a.speed ?? 480)));
        Audio.play('throw');
        break;
      case 'drop': {
        const n = a.n ?? 1;
        const tex = shotTexture(s, lv, a.shot, 60, 56);
        const xs = n === 1 ? [this.targetX] : [this.targetX - 70, this.targetX + 150 * d];
        xs.forEach((x, i) => add(new Dropper(s, Phaser.Math.Clamp(x, L, R), tex, 0.7 + i * 0.35)));
        break;
      }
      case 'geyser': {
        // Vents along the dog's side of the arena, always leaving one spot dry.
        const n = a.n ?? 2;
        const pads = (d > 0 ? [780, 930, 1080] : [200, 350, 500]).map((x) => ctx.cameraLeft + x);
        const near = pads.reduce((b, p) => (Math.abs(p - this.targetX) < Math.abs(b - this.targetX) ? p : b), pads[0]);
        const chosen = [near, ...pads.filter((p) => p !== near)].slice(0, Math.min(n, pads.length - 1));
        chosen.forEach((x) => add(new Geyser(s, x, a.color)));
        Audio.play('burst_stretch');
        break;
      }
      case 'swoop':
        Audio.play(this.def.flying ? 'squirrel_angry' : 'parcel');
        break;
      case 'slam':
        Audio.play('jump');
        break;
      case 'barrage':
        add(new Barrage(s, bx + d * 60, d, shotTexture(s, lv, a.shot, 110, 60), a.lanes, this.enraged ? 560 : 500, add));
        break;
      case 'bounce': {
        const n = a.n ?? 1;
        const tex = shotTexture(s, lv, a.shot, 46, 46);
        const hops = [90, 175, 120];
        for (let i = 0; i < n; i++) add(new Bouncer(s, bx + d * (60 + i * 150), by, tex, d * (230 + i * 30), hops[(this.round + i) % hops.length]));
        Audio.play('throw');
        break;
      }
    }
  }

  /** A finisher lands: shockwaves for a slam, a crash for a charge, and it is dazed. */
  private crash(ctx: GameContext, slam: boolean): void {
    const x = this.worldX(ctx);
    if (slam) {
      const v = this.enraged ? 430 : 360;
      for (const d of [-1, 1]) {
        const e = new Shockwave(this.scene, x + d * 70, d * v);
        ctx.spawn(e);
      }
    }
    this.clearTelegraph();
    this.perch = 0;
    ctx.fx.dust(x, G, 10);
    ctx.fx.puff(x + (slam ? 0 : this.dir * 60), G - 40, 6, 1.2);
    ctx.fx.stars(x, G - this.def.height, 6);
    this.scene.cameras.main.shake(220, slam ? 0.012 : 0.009);
    Audio.play('land');
    this.openingHits = 0;
    this.stagger = 0;
    this.dazeFor = DIZZY;
    this.go('dizzy');
  }

  /** Builds the climbing frame once the camera has settled. */
  private buildDecks(ctx: GameContext): void {
    if (this.decksBuilt) return;
    this.decksBuilt = true;
    for (const d of ARENA_DECKS) ctx.spawn(this.makeDeck(ctx.cameraLeft + d.x, d.w, G - d.h));
  }

  /** After an opening it springs back to an end of the arena, the one farther from the dog, so it never attacks point-blank. */
  private goHome(ctx: GameContext): void {
    const hero = ctx.heroX - ctx.cameraLeft;
    this.side = Math.abs(hero - HOME[-1]) > Math.abs(hero - HOME[1]) ? -1 : 1;
    this.toX = HOME[this.side];
    this.toY = this.hover;
    this.go('hop');
  }

  /** Between attacks it often bounds to another spot (never onto the dog). */
  private wander(ctx: GameContext): void {
    if (Math.random() > 0.85) {
      this.go('idle');
      return;
    }
    // Presses the dog: one of the two spots nearest it (but never on top of it).
    const hero = ctx.heroX - ctx.cameraLeft;
    const spots = (this.def.flying ? FLY_SPOTS : WALK_SPOTS)
      .filter((p) => Math.abs(p.x - this.sx) > 120 && Math.abs(p.x - hero) > 230)
      .sort((a, b) => Math.abs(a.x - hero) - Math.abs(b.x - hero))
      .slice(0, 2);
    if (!spots.length) {
      this.go('idle');
      return;
    }
    const p = spots[Math.floor(Math.random() * spots.length)];
    this.side = p.side ?? 0;
    this.toX = p.x;
    this.toY = p.h;
    this.go('hop');
  }

  update(dt: number, ctx: GameContext): void {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.clangT = Math.max(0, this.clangT - dt);
    const ease = (k: number) => 1 - Math.pow(1 - Phaser.Math.Clamp(k, 0, 1), 3);
    const hover = this.hover;
    let rot = 0;
    let sxScale = 1;
    let syScale = 1;
    const wx = this.worldX(ctx);
    if (this.phase === 'act' && this.attack?.kind === 'swoop') this.facing = this.dir;
    else if (this.phase === 'hop') this.facing = this.toX >= this.fromX ? 1 : -1;
    else if (this.fighting && this.phase !== 'dizzy') this.facing = ctx.heroX >= wx ? 1 : -1;
    this.ring.clear();
    switch (this.phase) {
      case 'enter':
        this.sx = Phaser.Math.Linear(1500, HOME[1], ease(this.t / 1.6));
        this.sy = hover + (this.def.flying ? Math.sin(this.t * 3) * 10 : 0);
        if (this.t >= 1.6) {
          this.side = 1;
          this.buildDecks(ctx);
          this.onEvent?.('start');
          this.go('idle');
        }
        break;
      case 'idle':
        this.sy = this.perch + (this.def.flying ? Math.sin(this.t * 3) * 10 : Math.abs(Math.sin(this.t * 5)) * 4);
        if (this.t >= (this.enraged ? 0.12 : 0.22)) this.beginWarn(ctx);
        break;
      case 'hop': {
        const T = this.def.flying ? 0.6 : 0.55;
        const k = Math.min(1, this.t / T);
        if (this.t < dt * 1.5) this.hopThrown = false;
        // From round two it lobs a shot at the dog from the top of its hop.
        if (!this.hopThrown && k >= 0.5 && this.tierIndex >= 1 && this.hopShot) {
          this.hopThrown = true;
          const tex = shotTexture(this.scene, this.def.level, this.hopShot, 34, 30);
          ctx.spawn(new LobShot(this.scene, wx, G - this.sy - this.img.displayHeight * 0.5, Phaser.Math.Clamp(ctx.heroX, ctx.cameraLeft + 90, ctx.cameraRight - 90), tex, 0.8));
          Audio.play('throw');
        }
        this.sx = Phaser.Math.Linear(this.fromX, this.toX, this.def.flying ? ease(k) : k);
        this.sy = Phaser.Math.Linear(this.fromY, this.toY, this.def.flying ? ease(k) : k) + Math.sin(k * Math.PI) * (this.def.flying ? 30 : 130);
        if (this.t >= T) {
          this.perch = this.toY;
          this.sy = this.toY;
          if (!this.def.flying) {
            ctx.fx.dust(wx, G - this.toY, 5);
            Audio.play('land');
          }
          this.go('idle');
        }
        break;
      }
      case 'warn': {
        const a = this.attack!;
        const k = ease(this.t / this.warnTime);
        this.sy = this.perch;
        rot = Math.sin(this.t * 22) * 0.05;
        this.band.clear();
        if (a.kind === 'sweep' || a.kind === 'swoop') {
          // A lane band along the attack's path.
          const lane = LANE[a.height];
          const pulse = 0.18 + 0.14 * Math.abs(Math.sin(this.t * 9));
          const x0 = this.dir > 0 ? wx : ctx.cameraLeft;
          const x1 = this.dir > 0 ? ctx.cameraRight : wx;
          this.band.fillStyle(0xe5533d, pulse).fillRect(x0, lane.top, x1 - x0, lane.bottom - lane.top);
          this.label.setText(a.height === 'low' ? '▲ JUMP!' : '▼ DUCK!').setPosition((x0 + x1) / 2, lane.top - 26).setVisible(true);
        }
        if (a.kind === 'swoop') {
          // Paws the ground (or drops into its lane), ready to charge.
          const L = LANE[a.height];
          this.sy = Phaser.Math.Linear(this.fromY, G - L.bottom, k);
          sxScale = syScale = Phaser.Math.Linear(1, 0.6, k);
          if (!this.def.flying && Math.random() < dt * 10) ctx.fx.dust(wx - this.dir * 40, G, 1);
        }
        if (a.kind === 'barrage' || a.kind === 'bounce') {
          this.label.setText(a.kind === 'barrage' ? 'INCOMING!' : 'BOUNCERS!').setPosition(wx, G - this.sy - this.img.displayHeight - 40).setVisible(true);
        }
        if (a.kind === 'slam') {
          sxScale = 1.08;
          syScale = Phaser.Math.Linear(1, 0.8, k);
          this.slamMark?.setAlpha(0.35 + 0.35 * Math.abs(Math.sin(this.t * 12)));
          this.label.setText('▲ SHOCKWAVE!').setPosition(this.targetX, G - 150).setVisible(true);
        }
        if (this.t >= this.warnTime) {
          this.band.clear();
          this.label.setVisible(false);
          this.bubble.setVisible(false);
          this.launch(ctx);
          this.go('act');
        }
        break;
      }
      case 'act': {
        const a = this.attack!;
        if (a.kind === 'swoop') {
          const L = LANE[a.height];
          sxScale = syScale = 0.6;
          this.sy = G - L.bottom;
          const v = (a.speed ?? 520) * (this.enraged ? 1.15 : 1);
          this.sx += this.dir * v * dt;
          rot = a.height === 'high' ? -0.08 * this.dir : Math.sin(this.t * 30) * 0.04;
          if (Math.random() < dt * 8) ctx.fx.dust(wx - this.dir * 50, G, 1);
          if ((this.dir > 0 && this.sx >= this.toX) || (this.dir < 0 && this.sx <= this.toX)) {
            // Thuds into the far wall and sits there seeing stars.
            this.sx = this.toX;
            this.sy = 0;
            this.side = this.dir;
            this.crash(ctx, false);
          }
          break;
        }
        if (a.kind === 'slam') {
          const FLY = 0.75;
          const k = Math.min(1, this.t / FLY);
          this.sx = Phaser.Math.Linear(this.fromX, this.toX, k);
          this.sy = Math.max(0, Phaser.Math.Linear(this.fromY, 0, k) + Math.sin(k * Math.PI) * 260);
          rot = this.facing * 0.25 * Math.sin(k * Math.PI);
          this.slamMark?.setAlpha(0.5 + 0.3 * Math.sin(this.t * 20));
          if (this.t >= FLY) {
            this.sy = 0;
            this.side = 0;
            this.crash(ctx, true);
          }
          break;
        }
        this.sy = this.perch + (this.def.flying ? Math.sin(this.t * 3) * 8 : 0);
        // Moves on before its shots have cleared the arena (only a barrage must finish
        // throwing), so attacks overlap and the pressure stays on.
        if (this.kids.every((k) => !k.alive) || (this.t > 0.8 && !this.kids.some((k) => k.alive && k instanceof Barrage))) this.wander(ctx);
        break;
      }
      case 'dizzy': {
        // Dazed on the floor: stars circle its head and the weak spot glows.
        const dur = this.enraged ? this.dazeFor * 0.8 : this.dazeFor;
        this.sy = 0;
        rot = Math.sin(this.t * 4) * 0.06;
        sxScale = 1 + Math.sin(this.t * 6) * 0.02;
        syScale = 0.94;
        const top = G - this.img.displayHeight - 6;
        for (let i = 0; i < 3; i++) {
          const a = this.t * 4 + (i * Math.PI * 2) / 3;
          this.ring.fillStyle(0xffe27a, 1).fillCircle(wx + Math.cos(a) * 46, top + Math.sin(a) * 10, 7);
          this.ring.lineStyle(2, 0x302331, 1).strokeCircle(wx + Math.cos(a) * 46, top + Math.sin(a) * 10, 7);
        }
        const pulse = 0.5 + 0.5 * Math.sin(this.t * 10);
        const b = this.body();
        this.ring.lineStyle(5, 0xffe27a, 0.5 + 0.4 * pulse).strokeEllipse(b.x + b.w / 2, b.y + b.h / 2, b.w + 20 + pulse * 10, b.h + 10 + pulse * 10);
        // A timer bar under the label: the opening is closing.
        const left = 1 - this.t / dur;
        this.ring.fillStyle(0x302331, 0.8).fillRoundedRect(wx - 62, top - 60, 124, 12, 6);
        this.ring.fillStyle(0xffe27a, 1).fillRoundedRect(wx - 60, top - 58, 120 * Math.max(0, left), 8, 4);
        this.label.setText('BARK NOW!').setPosition(wx, top - 82).setVisible(true);
        if (this.t >= dur) this.go('recover');
        break;
      }
      case 'recover':
        // Shakes it off and springs up, back on guard.
        this.label.setVisible(false);
        this.sy = Math.sin(Math.min(1, this.t / 0.5) * Math.PI) * 50;
        rot = Math.sin(this.t * 30) * 0.08;
        if (this.t >= 0.5) {
          if (this.tierIndex > this.tierSeen) {
            this.tierSeen = this.tierIndex;
            this.queue = [];
            this.go('roar');
            this.label.setText(this.enraged ? 'IT’S ANGRY!' : 'ROUND 2!').setPosition(wx, G - this.img.displayHeight - 50).setVisible(true);
            Audio.play('squirrel_angry');
            this.scene.cameras.main.shake(500, 0.008);
          } else this.goHome(ctx);
        }
        break;
      case 'roar':
        this.sy = this.def.flying ? Phaser.Math.Linear(this.fromY, hover, ease(this.t / 0.6)) : 0;
        rot = Math.sin(this.t * 40) * 0.05;
        sxScale = syScale = 1 + 0.06 * Math.sin(this.t * 20);
        if (Math.random() < dt * 12) ctx.fx.puff(wx + (Math.random() - 0.5) * 120, G - Math.random() * this.def.height, 1, 0.8);
        if (this.t >= 1.4) {
          this.label.setVisible(false);
          this.goHome(ctx);
        }
        break;
      case 'defeat':
        this.fall.vy += 900 * dt;
        this.sy = Math.max(-40, this.sy - this.fall.vy * dt);
        this.sx += 120 * dt;
        this.fall.rot += dt * 5;
        rot = this.fall.rot;
        sxScale = syScale = Math.max(0.3, 1 - this.t * 0.25);
        if (Math.random() < dt * 10) ctx.fx.stars(wx, G - 120, 1);
        if (this.t > 1.8) {
          this.go('done');
          this.img.setVisible(false);
          this.onEvent?.('done');
        }
        break;
      case 'done':
        break;
    }
    // Flyers come back up to their perch after a daze.
    if (this.def.flying && this.phase === 'idle' && this.sy < this.perch - 1) this.sy = Phaser.Math.Linear(this.sy, this.perch, Math.min(1, dt * 4));
    const x = this.worldX(ctx);
    const flip = this.def.facesRight ? this.facing < 0 : this.facing > 0;
    this.img.setPosition(x, G - this.sy).setRotation(rot).setScale(this.baseScale * sxScale, this.baseScale * syScale).setFlipX(flip);
    if (this.flash > 0) this.img.setTint(Math.floor(this.flash * 30) % 2 ? 0xffffff : 0xff9a8a);
    else if (this.enraged && this.fighting && this.phase !== 'dizzy') {
      const r = 0.5 + 0.5 * Math.sin(this.t * 8);
      this.img.setTint(Phaser.Display.Color.GetColor(255, 200 - r * 50, 200 - r * 60));
    } else this.img.clearTint();
    this.bubble.setPosition(x - 20, G - this.sy - this.img.displayHeight - 4);
    this.drawAim(flip);
    if (this.popT > 0) {
      this.popT -= dt;
      this.pop.setPosition(x, G - this.sy - this.img.displayHeight - 30 - (0.7 - this.popT) * 40).setAlpha(Math.min(1, this.popT * 3)).setVisible(this.popT > 0);
    }
  }

  /** A target on its weak spot while the dog's bark would reach it: white (a hit lands), gold while dazed (a crit). */
  private drawAim(flip: boolean): void {
    const g = this.aim;
    g.clear();
    if (!this.inRange || !this.fighting) return;
    const w = this.img.displayWidth;
    const h = this.img.displayHeight;
    const wx = this.img.x + (this.def.weak.x - 0.5) * w * (flip ? -1 : 1);
    const wy = this.img.y - h * (1 - this.def.weak.y);
    const open = this.phase === 'dizzy';
    const col = open ? 0xffe27a : 0xffffff;
    const pulse = 0.5 + 0.5 * Math.sin(this.t * (open ? 14 : 6));
    const r = (open ? 30 : 24) + pulse * 4;
    const a = open ? 1 : 0.85;
    g.lineStyle(7, 0x302331, a * 0.8).strokeCircle(wx, wy, r);
    g.lineStyle(4, col, a).strokeCircle(wx, wy, r);
    // Four ticks that spin slowly round the ring.
    const spin = this.t * (open ? 3 : 1);
    for (let i = 0; i < 4; i++) {
      const ang = spin + (i * Math.PI) / 2;
      const c = Math.cos(ang);
      const sn = Math.sin(ang);
      g.lineStyle(7, 0x302331, a * 0.8).lineBetween(wx + c * (r - 8), wy + sn * (r - 8), wx + c * (r + 10), wy + sn * (r + 10));
      g.lineStyle(4, col, a).lineBetween(wx + c * (r - 8), wy + sn * (r - 8), wx + c * (r + 10), wy + sn * (r + 10));
    }
    g.fillStyle(col, a).fillCircle(wx, wy, open ? 5 : 3);
  }

  destroy(): void {
    this.aim.destroy();
    this.slamMark?.destroy();
    this.img.destroy();
    this.bubble.destroy();
    this.band.destroy();
    this.ring.destroy();
    this.label.destroy();
    this.pop.destroy();
  }
}
