import Phaser from 'phaser';
import { DEPTH, WORLD } from '../data/config';
import { BOSSES, type Attack, type BossDef } from '../data/bosses';
import { pieceKey, type Piece } from '../data/levelArt';
import { Audio } from '../systems/AudioManager';
import { pieceTexture } from '../systems/LevelSkins';
import type { Rect } from '../systems/PlayerController';
import type { Boss, BossEvent } from './SquirrelSwarm';
import { Entity, type GameContext } from './World';

const G = WORLD.groundY;
/** Lanes for things that cross the arena: low ones are jumped, high ones ducked. */
const LANE = {
  low: { top: G - 56, bottom: G - 2 },
  high: { top: G - 100, bottom: G - 30 },
} as const;
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
  constructor(scene: Phaser.Scene, private x: number, tex: string, private lane: 'low' | 'high', private speed: number) {
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

// ---------------------------------------------------------------- the boss

type Phase = 'enter' | 'idle' | 'warn' | 'act' | 'back' | 'rest' | 'move' | 'defeat' | 'done';

/** Screen x where the boss holds the middle of the arena. */
const MID_X = 660;
/** Spots it bounds (or glides) between after each breather, so the fight keeps moving. */
const SPOTS = [430, 660, 890];
/** How far a slam can land from the arena edges (screen x). */
const SLAM_MIN = 240;
const SLAM_MAX = 1060;
/**
 * The arena frame, in screen space: low ledges and higher ledges on both sides
 * and a bridge over the boss, so the dog can climb up and over to its back.
 * Each step is one normal jump above the last (the bridge is two from a low ledge).
 */
export const ARENA_DECKS = [
  { x: 250, w: 200, h: 100 },
  { x: 380, w: 170, h: 190 },
  { x: 500, w: 320, h: 285 },
  { x: 770, w: 170, h: 190 },
  { x: 870, w: 200, h: 100 },
] as const;

/**
 * A level's end boss, driven by its entry in data/bosses. It stands in the
 * middle of a climbable arena, always turns to face the dog, and warns before
 * each attack: lobbed volleys, rollers, lane sweeps and charges aimed at the
 * dog's side, drops and steam jets. Every bark that reaches it lands a hit;
 * walking into it hurts, so the way past is over the top.
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
  private label: Phaser.GameObjects.Text;
  private t = 0;
  private sx = 1500;
  private sy = 0;
  private fromX = 0;
  private fromY = 0;
  private baseScale = 1;
  private step = 0;
  private attack: Attack | null = null;
  private kids: Entity[] = [];
  private targetX = 0;
  /** Which way it faces: 1 = right, -1 = left (toward the dog). */
  private facing: 1 | -1 = -1;
  /** Direction the current attack travels. */
  private dir: 1 | -1 = -1;
  private flash = 0;
  private decksBuilt = false;
  private fall = { vy: 0, rot: 0 };
  /** Where it stands between attacks (it moves around the arena). */
  private homeX = MID_X;
  private toX = MID_X;
  /** Attack lists per tier: walkers also learn the slam once hurt. */
  private tiers: Attack[][];
  /** Final tier: quicker warnings and shorter breathers. */
  private enraged = false;
  private shout = 0;
  private slamMark: Phaser.GameObjects.Ellipse | null = null;

  constructor(private scene: Phaser.Scene, level: number, private makeDeck: (x: number, w: number, top: number) => Entity) {
    super();
    this.def = BOSSES[level];
    this.maxHits = this.def.hp;
    this.title = this.def.name;
    const key = pieceKey(level, 'b1');
    this.icon = scene.textures.exists(key) ? key : 'boss_flex';
    this.img = scene.add.image(0, G, this.icon).setOrigin(0.5, 1).setDepth(DEPTH.boss);
    this.baseScale = this.def.height / this.img.height;
    this.img.setScale(this.baseScale);
    this.bubble = scene.add.image(0, 0, 'fx_exclaim').setOrigin(0.5, 1).setScale(0.6).setDepth(DEPTH.boss + 3).setVisible(false);
    this.band = scene.add.graphics().setDepth(DEPTH.groundShadow + 1);
    this.label = scene.add.text(0, 0, '', { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '26px', fontStyle: 'bold', color: '#FFFFFF', stroke: '#302331', strokeThickness: 6 }).setOrigin(0.5).setDepth(DEPTH.fx + 2).setVisible(false);
    this.sy = this.hover;
    this.tiers = this.def.tiers.map((t, i) => (!this.def.flying && i > 0 ? [...t, { kind: 'slam' } as Attack] : t));
    Audio.play('whistle');
  }

  get right(): number {
    return Number.POSITIVE_INFINITY;
  }

  /** Flyers circle above the bridge; walkers stand on the street. */
  private get hover(): number {
    return this.def.flying ? 305 : 0;
  }

  /** Screen x of the boss (for tests and the touch arrows). */
  get screenX(): number {
    return this.sx;
  }

  /** What the current or upcoming attack is (for tests and the touch arrows). */
  get telegraph(): { kind: Attack['kind']; height?: 'low' | 'high'; targetX: number; dir: number } | null {
    if (!this.attack || (this.phase !== 'warn' && this.phase !== 'act')) return null;
    if (this.attack.kind === 'slam' && this.phase === 'act' && this.t > 0.7) return null;
    const a = this.attack;
    return { kind: a.kind, height: a.kind === 'sweep' || a.kind === 'swoop' ? a.height : undefined, targetX: this.targetX, dir: this.dir };
  }

  private get tierIndex(): number {
    const k = this.hits / this.maxHits;
    return Math.min(k >= 2 / 3 ? 2 : k >= 1 / 3 ? 1 : 0, this.tiers.length - 1);
  }

  private get tier(): Attack[] {
    return this.tiers[this.tierIndex];
  }

  private get warnTime(): number {
    return this.enraged ? 0.8 : WARN;
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

  /** The body: hurts on contact, and takes a hit from every bark that reaches it. */
  private body(): Rect {
    const w = this.img.displayWidth;
    const h = this.img.displayHeight;
    return { x: this.img.x - w * 0.36, y: this.img.y - h * 0.85, w: w * 0.72, h: h * 0.85 };
  }

  private get fighting(): boolean {
    return this.phase !== 'enter' && this.phase !== 'defeat' && this.phase !== 'done';
  }

  hazard(): Rect | null {
    if (!this.fighting) return null;
    if (this.phase === 'act' && this.attack?.kind === 'swoop') {
      const L = LANE[this.attack.height];
      return { x: this.img.x - 60, y: L.top, w: 120, h: L.bottom - L.top };
    }
    return this.body();
  }

  barkTarget(): Rect | null {
    return this.fighting ? this.body() : null;
  }

  onBark(ctx: GameContext): void {
    if (!this.fighting) return;
    this.hits++;
    this.flash = 0.25;
    Audio.play('boss_hit');
    ctx.fx.stars(this.img.x, this.img.y - this.img.displayHeight * 0.6, 5);
    ctx.fx.puff(this.img.x + (Math.random() - 0.5) * 80, this.img.y - Math.random() * this.img.displayHeight * 0.7, 2, 0.8);
    this.scene.cameras.main.shake(90, 0.004);
    this.onEvent?.('hit');
    if (!this.enraged && this.tierIndex === 2 && this.hits < this.maxHits) {
      this.enraged = true;
      this.shout = 1.4;
      this.label.setText('IT’S ANGRY!').setVisible(true);
      Audio.play('squirrel_angry');
    }
    if (this.hits >= this.maxHits) {
      for (const k of this.kids) k.alive = false;
      this.clearTelegraph();
      this.go('defeat');
      this.fall = { vy: -420, rot: 0 };
      Audio.play('boss_clear');
      this.onEvent?.('defeated');
    }
  }

  private clearTelegraph(): void {
    this.band.clear();
    if (this.phase === 'defeat' || this.hits >= this.maxHits) {
      this.slamMark?.destroy();
      this.slamMark = null;
    }
    this.label.setVisible(false);
    this.bubble.setVisible(false);
  }

  private beginWarn(ctx: GameContext): void {
    const list = this.tier;
    this.attack = list[this.step % list.length];
    this.targetX = ctx.heroX;
    if (this.attack.kind === 'slam') {
      this.targetX = Phaser.Math.Clamp(ctx.heroX, ctx.cameraLeft + SLAM_MIN, ctx.cameraLeft + SLAM_MAX);
      this.slamMark?.destroy();
      this.slamMark = marker(this.scene, this.targetX, 120);
    }
    this.dir = ctx.heroX >= this.worldX(ctx) ? 1 : -1;
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
        // Around where the dog was standing, with clear space beyond the spread.
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
        const pads = (d > 0 ? [800, 950, 1100] : [180, 330, 480]).map((x) => ctx.cameraLeft + x);
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
        this.toX = this.targetX - ctx.cameraLeft;
        Audio.play('jump');
        break;
    }
  }

  /** The slam lands: shockwaves race out both ways and it stays where it landed. */
  private land(ctx: GameContext): void {
    const x = this.worldX(ctx);
    const v = this.enraged ? 460 : 390;
    for (const d of [-1, 1]) {
      const e = new Shockwave(this.scene, x + d * 70, d * v);
      this.kids.push(e);
      ctx.spawn(e);
    }
    this.slamMark?.destroy();
    this.slamMark = null;
    ctx.fx.dust(x, G, 10);
    ctx.fx.puff(x, G - 20, 6, 1.2);
    this.scene.cameras.main.shake(220, 0.012);
    Audio.play('land');
    this.homeX = this.sx;
  }

  /** Builds the climbing frame once the camera has settled. */
  private buildDecks(ctx: GameContext): void {
    if (this.decksBuilt) return;
    this.decksBuilt = true;
    for (const d of ARENA_DECKS) ctx.spawn(this.makeDeck(ctx.cameraLeft + d.x, d.w, G - d.h));
  }

  update(dt: number, ctx: GameContext): void {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
    const ease = (k: number) => 1 - Math.pow(1 - Phaser.Math.Clamp(k, 0, 1), 3);
    const hover = this.hover;
    let rot = 0;
    let scale = this.baseScale;
    // Always turn to face the dog (charges face where they are going).
    const wx = this.worldX(ctx);
    if (this.phase === 'act' && this.attack?.kind === 'swoop') this.facing = this.dir;
    else if (this.fighting) this.facing = ctx.heroX >= wx ? 1 : -1;
    switch (this.phase) {
      case 'enter':
        this.sx = Phaser.Math.Linear(1500, MID_X, ease(this.t / 1.6));
        this.sy = hover + (this.def.flying ? Math.sin(this.t * 3) * 10 : 0);
        if (this.t >= 1.6) {
          this.buildDecks(ctx);
          this.onEvent?.('start');
          this.go('idle');
        }
        break;
      case 'idle':
        this.sy = hover + (this.def.flying ? Math.sin(this.t * 3) * 10 : Math.abs(Math.sin(this.t * 5)) * 4);
        if (this.t >= 0.5) this.beginWarn(ctx);
        break;
      case 'warn': {
        const a = this.attack!;
        this.sy = hover;
        rot = Math.sin(this.t * 22) * 0.05;
        this.band.clear();
        if (a.kind === 'sweep' || a.kind === 'swoop') {
          // A lane band on the dog's side of the arena.
          const lane = LANE[a.height];
          const pulse = 0.18 + 0.14 * Math.abs(Math.sin(this.t * 9));
          const x0 = this.dir > 0 ? wx : ctx.cameraLeft;
          const x1 = this.dir > 0 ? ctx.cameraRight : wx;
          this.band.fillStyle(0xe5533d, pulse).fillRect(x0, lane.top, x1 - x0, lane.bottom - lane.top);
          this.label.setText(a.height === 'low' ? '▲ JUMP!' : '▼ DUCK!').setPosition((x0 + x1) / 2, lane.top - 26).setVisible(true);
        }
        if (a.kind === 'swoop') {
          // Crouches into its lane, ready to charge.
          const L = LANE[a.height];
          this.sy = Phaser.Math.Linear(this.fromY, G - L.bottom, ease(this.t / this.warnTime));
          scale = this.baseScale * Phaser.Math.Linear(1, 0.55, ease(this.t / this.warnTime));
        }
        if (a.kind === 'slam') {
          // Crouches low, eyeing the marked spot.
          scale = this.baseScale * (1 + 0.04 * Math.sin(this.t * 30));
          this.img.setScale(this.baseScale * 1.08, this.baseScale * Phaser.Math.Linear(1, 0.8, ease(this.t / this.warnTime)));
          this.slamMark?.setAlpha(0.35 + 0.35 * Math.abs(Math.sin(this.t * 12)));
          this.label.setText('▲ SHOCKWAVE!').setPosition(this.targetX, G - 150).setVisible(true);
        }
        if (this.t >= this.warnTime) {
          this.clearTelegraph();
          this.launch(ctx);
          this.go('act');
        }
        break;
      }
      case 'act': {
        const a = this.attack!;
        if (a.kind === 'swoop') {
          const L = LANE[a.height];
          scale = this.baseScale * 0.55;
          this.sy = G - L.bottom;
          this.sx += this.dir * (a.speed ?? 500) * dt;
          rot = a.height === 'high' ? -0.08 * this.dir : Math.sin(this.t * 30) * 0.04;
          if (Math.random() < dt * 8) ctx.fx.dust(wx - this.dir * 50, G, 1);
          if (this.sx < -220 || this.sx > 1500) {
            // Comes back round from the other side to the middle.
            this.sx = this.dir > 0 ? -220 : 1500;
            this.sy = hover;
            this.go('back');
          }
          break;
        }
        if (a.kind === 'slam') {
          const FLY = 0.75;
          if (this.t < FLY) {
            const k = this.t / FLY;
            this.sx = Phaser.Math.Linear(this.fromX, this.toX, k);
            this.sy = Math.sin(k * Math.PI) * 260;
            rot = this.facing * 0.25 * Math.sin(k * Math.PI);
            break;
          }
          if (this.sy !== 0) {
            this.sx = this.toX;
            this.sy = 0;
            this.land(ctx);
          }
          // Squashes on landing, then shakes off the dizziness.
          scale = this.baseScale * (1 + 0.12 * Math.exp(-(this.t - FLY) * 8) * Math.sin((this.t - FLY) * 40));
          if (this.t > FLY + 0.6 && this.kids.every((k) => !k.alive)) this.next();
          break;
        }
        this.sy = hover + (this.def.flying ? Math.sin(this.t * 3) * 8 : 0);
        if (this.t > 0.5 && this.kids.every((k) => !k.alive)) this.next();
        break;
      }
      case 'back':
        this.sx = Phaser.Math.Linear(this.fromX, this.homeX, ease(this.t / 1.0));
        this.sy = hover;
        if (this.t >= 1.0) this.next();
        break;
      case 'rest':
        // Catches its breath between rounds.
        this.sy = hover + (this.def.flying ? Math.sin(this.t * 3) * 6 : 0);
        rot = Math.sin(this.t * 6) * 0.04;
        scale = this.baseScale * (1 + Math.sin(this.t * 8) * 0.02);
        if (this.t >= this.def.openTime * (this.enraged ? 0.65 : 1)) {
          // Off to another spot in the arena before the next round.
          const spots = SPOTS.filter((x) => Math.abs(x - this.homeX) > 60);
          this.toX = spots[Math.floor(Math.random() * spots.length)];
          this.homeX = this.toX;
          this.go('move');
        }
        break;
      case 'move': {
        const T = 0.9;
        const k = Math.min(1, this.t / T);
        this.sx = Phaser.Math.Linear(this.fromX, this.toX, this.def.flying ? ease(k) : k);
        this.sy = this.def.flying ? hover + Math.sin(k * Math.PI) * 40 : Math.sin(k * Math.PI) * 120;
        this.facing = this.toX >= this.fromX ? 1 : -1;
        if (this.t >= T) {
          if (!this.def.flying) {
            ctx.fx.dust(wx, G, 5);
            this.scene.cameras.main.shake(100, 0.005);
            Audio.play('land');
          }
          this.go('idle');
        }
        break;
      }
      case 'defeat':
        // Wobbles, spins and topples off the arena.
        this.fall.vy += 900 * dt;
        this.sy = Math.max(-40, this.sy - this.fall.vy * dt);
        this.sx += 120 * dt;
        this.fall.rot += dt * 5;
        rot = this.fall.rot;
        scale = this.baseScale * Math.max(0.3, 1 - this.t * 0.25);
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
    const x = this.worldX(ctx);
    // Drawings face either way; mirror them to face this.facing.
    const flip = this.def.facesRight ? this.facing < 0 : this.facing > 0;
    this.img.setPosition(x, G - this.sy).setRotation(rot).setFlipX(flip);
    if (!(this.phase === 'warn' && this.attack?.kind === 'slam')) this.img.setScale(scale);
    if (this.flash > 0) this.img.setTint(Math.floor(this.flash * 30) % 2 ? 0xffffff : 0xff9a8a);
    else if (this.enraged && this.fighting) {
      // Flushed with anger in the final round.
      const r = 0.5 + 0.5 * Math.sin(this.t * 8);
      this.img.setTint(Phaser.Display.Color.GetColor(255, 200 - r * 50, 200 - r * 60));
    } else this.img.clearTint();
    if (this.shout > 0) {
      this.shout -= dt;
      if (this.phase !== 'warn') this.label.setText('IT’S ANGRY!').setPosition(x, G - this.sy - this.img.displayHeight - 40).setVisible(this.shout > 0);
    }
    this.bubble.setPosition(x - 20, G - this.sy - this.img.displayHeight - 4);
  }

  /** On to the next attack, or a breather after the last one in the tier. */
  private next(): void {
    this.step++;
    if (this.step % this.tier.length === 0) this.go('rest');
    else this.go('idle');
  }

  destroy(): void {
    this.slamMark?.destroy();
    this.img.destroy();
    this.bubble.destroy();
    this.band.destroy();
    this.label.destroy();
  }
}
