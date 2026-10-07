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
/** Screen x where the boss waits, and where it settles when its guard is down. */
const HOME_X = 1070;
const OPEN_X = 900;
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
    if (Math.random() < dt * 5) ctx.fx.dust(this.x + this.r, G, 1);
    if (this.x < ctx.cameraLeft - 80) this.alive = false;
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
    this.img.setDisplaySize(130, L.bottom - L.top + 14);
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
    if (this.x < ctx.cameraLeft - 120) this.alive = false;
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

// ---------------------------------------------------------------- the boss

type Phase = 'enter' | 'idle' | 'warn' | 'act' | 'toOpen' | 'open' | 'hitReact' | 'back' | 'defeat' | 'done';

/**
 * A level's end boss, driven by its entry in data/bosses: warn, attack, repeat
 * through the current tier, then drop its guard so the dog can bark at its weak
 * point (one hit per opening). Lives in screen space over a stationary arena.
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
  private glow: Phaser.GameObjects.Arc;
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
  private openedHit = false;
  private fall = { vy: 0, rot: 0 };

  constructor(private scene: Phaser.Scene, level: number) {
    super();
    this.def = BOSSES[level];
    this.maxHits = this.def.hp;
    this.title = this.def.name;
    const key = pieceKey(level, 'b1');
    this.icon = scene.textures.exists(key) ? key : 'boss_flex';
    this.img = scene.add.image(0, G, this.icon).setOrigin(0.5, 1).setDepth(DEPTH.boss);
    this.baseScale = this.def.height / this.img.height;
    this.img.setScale(this.baseScale).setFlipX(this.def.facesRight);
    this.bubble = scene.add.image(0, 0, 'fx_exclaim').setOrigin(0.5, 1).setScale(0.6).setDepth(DEPTH.boss + 3).setVisible(false);
    this.band = scene.add.graphics().setDepth(DEPTH.groundShadow + 1);
    this.label = scene.add.text(0, 0, '', { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '26px', fontStyle: 'bold', color: '#FFFFFF', stroke: '#302331', strokeThickness: 6 }).setOrigin(0.5).setDepth(DEPTH.fx + 2).setVisible(false);
    this.glow = scene.add.circle(0, 0, 26, 0xffd95a, 0.5).setStrokeStyle(5, 0xffffff, 0.9).setDepth(DEPTH.boss + 2).setVisible(false);
    this.sy = this.def.flying ? 170 : 0;
    Audio.play('whistle');
  }

  get right(): number {
    return Number.POSITIVE_INFINITY;
  }

  /** What the current or upcoming attack is (for tests and the touch arrows). */
  get telegraph(): { kind: Attack['kind']; height?: 'low' | 'high'; targetX: number } | null {
    if (!this.attack || (this.phase !== 'warn' && this.phase !== 'act')) return null;
    const a = this.attack;
    return { kind: a.kind, height: a.kind === 'sweep' || a.kind === 'swoop' ? a.height : undefined, targetX: this.targetX };
  }

  private get tier(): Attack[] {
    const k = this.hits / this.maxHits;
    const i = k >= 2 / 3 ? 2 : k >= 1 / 3 ? 1 : 0;
    return this.def.tiers[Math.min(i, this.def.tiers.length - 1)];
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

  /** The body, for contact while it charges and for barks while its guard is down. */
  private body(): Rect {
    const w = this.img.displayWidth;
    const h = this.img.displayHeight;
    return { x: this.img.x - w * 0.42, y: this.img.y - h * 0.9, w: w * 0.84, h: h * 0.9 };
  }

  hazard(): Rect | null {
    if (this.phase !== 'act' || this.attack?.kind !== 'swoop') return null;
    const L = LANE[this.attack.height];
    return { x: this.img.x - 60, y: L.top, w: 120, h: L.bottom - L.top };
  }

  barkTarget(): Rect | null {
    return this.phase === 'open' && !this.openedHit ? this.body() : null;
  }

  onBark(ctx: GameContext): void {
    if (this.phase !== 'open' || this.openedHit) return;
    this.openedHit = true;
    this.hits++;
    Audio.play('boss_hit');
    ctx.fx.stars(this.img.x, this.img.y - this.img.displayHeight * 0.6, 8);
    for (let i = 0; i < 5; i++) ctx.fx.puff(this.img.x + (Math.random() - 0.5) * 100, this.img.y - Math.random() * this.img.displayHeight * 0.7, 1, 0.9);
    this.scene.cameras.main.shake(140, 0.006);
    this.onEvent?.('hit');
    this.glow.setVisible(false);
    if (this.hits >= this.maxHits) {
      for (const k of this.kids) k.alive = false;
      this.go('defeat');
      this.fall = { vy: -420, rot: 0 };
      Audio.play('boss_clear');
      this.onEvent?.('defeated');
    } else this.go('hitReact');
  }

  private clearTelegraph(): void {
    this.band.clear();
    this.label.setVisible(false);
    this.bubble.setVisible(false);
  }

  private beginWarn(ctx: GameContext): void {
    const list = this.tier;
    this.attack = list[this.step % list.length];
    this.targetX = ctx.heroX;
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
    this.kids = [];
    const add = (e: Entity) => {
      this.kids.push(e);
      ctx.spawn(e);
    };
    switch (a.kind) {
      case 'volley': {
        const n = a.n ?? 3;
        const tex = shotTexture(s, lv, a.shot, 34, 30);
        // Around where the dog was standing, with clear space beyond the spread.
        const offs = n === 1 ? [0] : n === 2 ? [-60, 60] : [-110, 0, 110];
        offs.forEach((o, i) => add(new LobShot(s, bx - 40, by, Phaser.Math.Clamp(this.targetX + o, ctx.cameraLeft + 120, ctx.cameraLeft + 820), tex, 1.0 + i * 0.12)));
        Audio.play('throw');
        break;
      }
      case 'roll':
        add(new Roller(s, bx - 60, shotTexture(s, lv, a.shot, 48, 48), a.speed ?? 250, !!a.heavy));
        Audio.play('parcel');
        break;
      case 'sweep':
        add(new Sweeper(s, ctx.cameraRight + 80, shotTexture(s, lv, a.shot, 130, 70), a.height, a.speed ?? 480));
        Audio.play('throw');
        break;
      case 'drop': {
        const n = a.n ?? 1;
        const tex = shotTexture(s, lv, a.shot, 60, 56);
        const xs = n === 1 ? [this.targetX] : [this.targetX - 70, this.targetX + 150];
        xs.forEach((x, i) => add(new Dropper(s, Phaser.Math.Clamp(x, ctx.cameraLeft + 120, ctx.cameraLeft + 800), tex, 0.7 + i * 0.35)));
        break;
      }
      case 'geyser': {
        // Vents across the floor, always leaving the spot furthest from them dry.
        const n = a.n ?? 2;
        const pads = [220, 400, 580, 760].map((x) => ctx.cameraLeft + x);
        const near = pads.reduce((b, p) => (Math.abs(p - this.targetX) < Math.abs(b - this.targetX) ? p : b), pads[0]);
        const others = pads.filter((p) => p !== near);
        const chosen = [near, ...others.slice(0, n - 1)];
        chosen.forEach((x) => add(new Geyser(s, x, a.color)));
        Audio.play('burst_stretch');
        break;
      }
      case 'swoop':
        Audio.play(this.def.flying ? 'squirrel_angry' : 'parcel');
        break;
    }
  }

  update(dt: number, ctx: GameContext): void {
    this.t += dt;
    const ease = (k: number) => 1 - Math.pow(1 - Phaser.Math.Clamp(k, 0, 1), 3);
    const hover = this.def.flying ? 170 : 0;
    let rot = 0;
    let scale = this.baseScale;
    switch (this.phase) {
      case 'enter':
        this.sx = Phaser.Math.Linear(1500, HOME_X, ease(this.t / 1.6));
        this.sy = hover + (this.def.flying ? Math.sin(this.t * 3) * 10 : 0);
        if (this.t >= 1.6) {
          this.onEvent?.('start');
          this.go('idle');
        }
        break;
      case 'idle':
        this.sy = hover + (this.def.flying ? Math.sin(this.t * 3) * 10 : Math.abs(Math.sin(this.t * 5)) * 4);
        if (this.t >= 0.6) this.beginWarn(ctx);
        break;
      case 'warn': {
        const a = this.attack!;
        this.sy = hover;
        // Wind-up wobble, plus a lane band for anything that crosses the arena.
        rot = Math.sin(this.t * 22) * 0.05;
        this.band.clear();
        const lane = a.kind === 'sweep' || a.kind === 'swoop' ? LANE[a.height] : null;
        if (lane && (a.kind === 'sweep' || a.kind === 'swoop')) {
          const pulse = 0.18 + 0.14 * Math.abs(Math.sin(this.t * 9));
          this.band.fillStyle(0xe5533d, pulse).fillRect(ctx.cameraLeft, lane.top, ctx.cameraRight - ctx.cameraLeft, lane.bottom - lane.top);
          this.label.setText(a.height === 'low' ? '▲ JUMP!' : '▼ DUCK!').setPosition(ctx.cameraLeft + 640, lane.top - 26).setVisible(true);
        }
        if (a.kind === 'swoop') {
          // Lines up at the right edge, in its lane.
          const L = LANE[a.height];
          this.sx = Phaser.Math.Linear(this.fromX, 1180, ease(this.t / WARN));
          this.sy = Phaser.Math.Linear(this.fromY, G - L.bottom, ease(this.t / WARN));
          scale = this.baseScale * Phaser.Math.Linear(1, 0.55, ease(this.t / WARN));
        }
        if (this.t >= WARN) {
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
          this.sx -= (a.speed ?? 500) * dt;
          rot = a.height === 'high' ? -0.08 : Math.sin(this.t * 30) * 0.04;
          if (Math.random() < dt * 8) ctx.fx.dust(ctx.cameraLeft + this.sx + 50, G, 1);
          if (this.sx < -220) {
            // Comes back round from the right to its spot.
            this.sx = 1450;
            this.sy = hover;
            this.go('back');
          }
          break;
        }
        this.sy = hover + (this.def.flying ? Math.sin(this.t * 3) * 8 : 0);
        if (this.t > 0.5 && this.kids.every((k) => !k.alive)) this.next();
        break;
      }
      case 'back':
        this.sx = Phaser.Math.Linear(this.fromX, HOME_X, ease(this.t / 0.9));
        this.sy = hover;
        if (this.t >= 0.9) this.next();
        break;
      case 'toOpen':
        // Lands and settles where the dog can reach it.
        this.sx = Phaser.Math.Linear(this.fromX, OPEN_X, ease(this.t / 0.6));
        this.sy = Phaser.Math.Linear(this.fromY, 0, ease(this.t / 0.6));
        if (this.t >= 0.6) {
          this.go('open');
          this.openedHit = false;
          this.glow.setVisible(true);
          Audio.play('burst_ready');
        }
        break;
      case 'open': {
        this.sy = 0;
        rot = Math.sin(this.t * 6) * 0.04;
        const w = this.img.displayWidth;
        const h = this.img.displayHeight;
        const fx = this.def.facesRight ? 1 - this.def.weak.x : this.def.weak.x;
        this.glow
          .setPosition(this.img.x - w / 2 + w * fx, this.img.y - h + h * this.def.weak.y)
          .setRadius(22 + Math.sin(this.t * 10) * 5)
          .setAlpha(0.6 + Math.sin(this.t * 10) * 0.3);
        if (Math.random() < dt * 4) ctx.fx.sparkle(this.glow.x, this.glow.y, 1);
        if (this.t >= this.def.openTime) {
          this.glow.setVisible(false);
          this.go('back');
        }
        break;
      }
      case 'hitReact':
        rot = Math.sin(this.t * 40) * 0.08;
        this.img.setTint(Math.floor(this.t * 12) % 2 ? 0xffffff : 0xff9a8a);
        if (this.t >= 0.7) {
          this.img.clearTint();
          this.step = 0;
          this.go('back');
        }
        break;
      case 'defeat':
        // Wobbles, spins and topples off the arena.
        this.fall.vy += 900 * dt;
        this.sy = Math.max(-40, this.sy - this.fall.vy * dt);
        this.sx += 120 * dt;
        this.fall.rot += dt * 5;
        rot = this.fall.rot;
        scale = this.baseScale * Math.max(0.3, 1 - this.t * 0.25);
        if (Math.random() < dt * 10) ctx.fx.stars(ctx.cameraLeft + this.sx, G - 120, 1);
        if (this.t > 1.8) {
          this.go('done');
          this.img.setVisible(false);
          this.onEvent?.('done');
        }
        break;
      case 'done':
        break;
    }
    const wx = this.worldX(ctx);
    this.img.setPosition(wx, G - this.sy).setRotation(rot).setScale(scale);
    this.bubble.setPosition(wx - 20, G - this.sy - this.img.displayHeight - 4);
  }

  /** On to the next attack, or drop its guard after the last one in the tier. */
  private next(): void {
    this.step++;
    if (this.step % this.tier.length === 0) this.go('toOpen');
    else this.go('idle');
  }

  destroy(): void {
    this.img.destroy();
    this.bubble.destroy();
    this.band.destroy();
    this.label.destroy();
    this.glow.destroy();
  }
}
