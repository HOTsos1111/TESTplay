import Phaser from 'phaser';
import { DEPTH, WORLD } from '../data/config';
import { OBJECT_SIZE } from '../data/chunks';
import { ART_SCALE } from '../systems/AssetRegistry';
import { Audio } from '../systems/AudioManager';
import type { Fx } from '../systems/Fx';
import type { Rect, Solid } from '../systems/PlayerController';
import { drawGround3D } from '../systems/Ground3D';
import { CARDBOARD_SKINS, CRATE_SKINS, LOW_HAZARD_SKINS, PLATFORM_SKINS } from '../systems/art/decorArt';

/** Deterministic pick so a given spot in the level always looks the same. */
export function pickSkin<T>(list: readonly T[], seed: number | string): T {
  const str = String(seed);
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return list[(h >>> 0) % list.length];
}

/** Services the game scene provides to entities. */
export interface GameContext {
  scene: Phaser.Scene;
  fx: Fx;
  heroX: number;
  heroY: number;
  cameraLeft: number;
  cameraRight: number;
  /** Highest surface top at or below y under world x, or null over a pit. */
  surfaceBelow(x: number, y: number): number | null;
  spawn(e: Entity): void;
  addBone(): void;
  collectPowerUp(kind: 'magnet' | 'shield' | 'whistle' | 'bacon'): void;
  /**
   * True if a nut may come to rest at world x: floor underneath and no other
   * obstacle, gap or low sign nearby (so a nut never creates an unavoidable combo).
   */
  isClearSpot(x: number): boolean;
}

export abstract class Entity {
  alive = true;
  /** Last bark pulse that affected this entity (one hit per pulse). */
  lastPulse = -1;
  solid: Solid | null = null;
  abstract get right(): number;
  update(_dt: number, _ctx: GameContext): void {}
  /** Rect that hurts the hero on contact. */
  hazard(): Rect | null {
    return null;
  }
  onHeroHit(_ctx: GameContext): void {}
  /** Rect that a bark pulse can affect. */
  barkTarget(): Rect | null {
    return null;
  }
  onBark(_ctx: GameContext): void {}
  pickup(): Rect | null {
    return null;
  }
  onPickup(_ctx: GameContext): void {}
  abstract destroy(): void;
}

// ---------------------------------------------------------------- static

export class GroundPiece extends Entity {
  private g: Phaser.GameObjects.Graphics;
  private lastCentre = Number.NaN;
  constructor(scene: Phaser.Scene, private x: number, private w: number, private edgeLeft: boolean, private edgeRight: boolean) {
    super();
    this.g = scene.add.graphics().setDepth(DEPTH.ground);
    this.solid = { x, y: WORLD.groundY, w, h: 400, oneWay: false, kind: 'ground' };
  }
  get right(): number {
    return this.x + this.w;
  }
  update(_dt: number, ctx: GameContext): void {
    // Faux-3D: the paving seams fan out from the view centre, so redraw as it moves.
    const centre = Math.round((ctx.cameraLeft + ctx.cameraRight) / 2);
    if (centre === this.lastCentre) return;
    this.lastCentre = centre;
    this.g.clear();
    // Only draw the stretch that is on screen (arena floors can be thousands of px long).
    const pad = 200;
    const x0 = Math.max(this.x, ctx.cameraLeft - pad);
    const x1 = Math.min(this.x + this.w, ctx.cameraRight + pad);
    if (x1 <= x0) return;
    drawGround3D(this.g, x0, x1, centre, this.edgeLeft && x0 === this.x, this.edgeRight && x1 === this.x + this.w);
  }
  destroy(): void {
    this.g.destroy();
  }
}

export class Platform extends Entity {
  protected c: Phaser.GameObjects.Container;
  private belt!: Phaser.GameObjects.TileSprite;
  private conveyor = false;
  constructor(scene: Phaser.Scene, protected x: number, protected w: number, top: number, legs = true) {
    super();
    this.c = scene.add.container(x, top).setDepth(DEPTH.platform);
    const legH = WORLD.groundY - top - 10;
    if (legs) {
      for (let lx = 30; lx < w - 20; lx += 170) {
        this.c.add(scene.add.image(lx, 10, 'platform_leg').setOrigin(0.5, 0).setDisplaySize(16, legH));
      }
      this.c.add(scene.add.image(w - 30, 10, 'platform_leg').setOrigin(0.5, 0).setDisplaySize(16, legH));
    }
    const skin = pickSkin(PLATFORM_SKINS, x);
    const mid = skin === 'conveyor' ? 'platform_mid_conveyor' : skin === 'plank' ? 'platform_mid_plank' : 'platform_mid';
    this.belt = scene.add.tileSprite(14, 0, w - 28, 18, mid).setOrigin(0, 0).setTileScale(ART_SCALE);
    this.conveyor = skin === 'conveyor';
    this.c.add(this.belt);
    this.c.add(scene.add.image(0, 0, 'platform_left').setOrigin(0, 0).setScale(ART_SCALE));
    this.c.add(scene.add.image(w, 0, 'platform_right').setOrigin(1, 0).setScale(ART_SCALE));
    this.solid = { x, y: top, w, h: OBJECT_SIZE.platformThickness, oneWay: true, kind: 'platform' };
  }
  get right(): number {
    return this.x + this.w;
  }
  update(dt: number, _ctx?: GameContext): void {
    // Conveyor platforms visibly run (cosmetic only; they do not move the hero).
    if (this.conveyor) this.belt.tilePositionX += dt * 60;
  }
  destroy(): void {
    this.c.destroy();
  }
}

/** Platform that rides up and down on a scissor lift. The game carries a hero standing on it. */
export class LiftPlatform extends Platform {
  private t = 0;
  private base: Phaser.GameObjects.Graphics;
  /** Top before this frame's move (used to carry a hero standing on it). */
  prevTop: number;
  constructor(scene: Phaser.Scene, x: number, w: number, private lowTop: number, private highTop: number, private period: number) {
    super(scene, x, w, lowTop, false);
    this.prevTop = lowTop;
    this.base = scene.add.graphics().setDepth(DEPTH.platform - 1);
  }
  update(dt: number, ctx?: GameContext): void {
    super.update(dt, ctx);
    this.t += dt;
    const k = (1 - Math.cos((this.t / this.period) * Math.PI * 2)) / 2;
    const top = this.lowTop + (this.highTop - this.lowTop) * k;
    this.prevTop = this.solid!.y;
    this.solid!.prevY = this.prevTop;
    this.solid!.y = top;
    this.c.y = top;
    // Scissor arms down to the floor.
    const g = this.base;
    g.clear();
    const bottom = WORLD.groundY;
    const h = bottom - (top + 18);
    const n = Math.max(1, Math.round(h / 40));
    const seg = h / n;
    g.lineStyle(5, 0x4a5f7e, 1);
    for (const cx of [this.x + 40, this.x + this.w - 40]) {
      for (let i = 0; i < n; i++) {
        const y0 = top + 18 + i * seg;
        g.lineBetween(cx - 22, y0, cx + 22, y0 + seg);
        g.lineBetween(cx + 22, y0, cx - 22, y0 + seg);
      }
    }
    g.fillStyle(0x302331, 1);
    g.fillRect(this.x + 6, bottom - 8, this.w - 12, 8);
  }
  destroy(): void {
    super.destroy();
    this.base.destroy();
  }
}

/** Floating power-up bubble. */
export class PowerUp extends Entity {
  private bubble: Phaser.GameObjects.Image;
  private icon: Phaser.GameObjects.Image;
  private t = Math.random() * 6;
  constructor(scene: Phaser.Scene, private x: number, private y: number, readonly kind: 'magnet' | 'shield' | 'whistle' | 'bacon') {
    super();
    this.icon = scene.add.image(x, y, `pu_${kind}`).setScale(ART_SCALE * 1.05).setDepth(DEPTH.bone);
    this.bubble = scene.add.image(x, y, 'pu_bubble').setScale(ART_SCALE * 1.1).setDepth(DEPTH.bone + 1);
  }
  get right(): number {
    return this.x + 32;
  }
  update(dt: number, ctx: GameContext): void {
    this.t += dt;
    const yy = this.y + Math.sin(this.t * 3) * 6;
    this.icon.setPosition(this.x, yy).setRotation(Math.sin(this.t * 2) * 0.15);
    this.bubble.setPosition(this.x, yy).setScale(ART_SCALE * (1.1 + Math.sin(this.t * 5) * 0.04));
    if (Math.random() < dt * 4) ctx.fx.sparkle(this.x + (Math.random() - 0.5) * 50, yy + (Math.random() - 0.5) * 50, 1);
  }
  get where(): { x: number; y: number; kind: string } {
    return { x: this.x, y: this.y, kind: this.kind };
  }
  pickup(): Rect {
    // Tight pickup area: you have to actually reach the bubble.
    return { x: this.x - 20, y: this.y - 22, w: 40, h: 44 };
  }
  onPickup(ctx: GameContext): void {
    this.alive = false;
    ctx.fx.puff(this.x, this.y, 6, 0.8);
    ctx.fx.sparkle(this.x, this.y, 8);
    ctx.collectPowerUp(this.kind);
  }
  destroy(): void {
    this.icon.destroy();
    this.bubble.destroy();
  }
}

export class Crate extends Entity {
  private img: Phaser.GameObjects.Image;
  constructor(scene: Phaser.Scene, private x: number, top: number) {
    super();
    const { w, h } = OBJECT_SIZE.crate;
    this.img = scene.add.image(x, top, pickSkin(CRATE_SKINS, `${x}:${top}`)).setOrigin(0, 0).setScale(ART_SCALE).setDepth(DEPTH.prop);
    this.solid = { x, y: top, w, h, oneWay: false, kind: 'crate', ref: this };
  }
  get right(): number {
    return this.x + OBJECT_SIZE.crate.w;
  }
  destroy(): void {
    this.img.destroy();
  }
}

export class Cardboard extends Entity {
  private img: Phaser.GameObjects.Image;
  private skin: string;
  private breakT = -1;
  private wobble = Math.random() * 6;
  private flat: Phaser.GameObjects.Image | null = null;
  constructor(scene: Phaser.Scene, private x: number, private top: number, readonly stack: string, private onStackBreak: (stack: string) => void) {
    super();
    const { w, h } = OBJECT_SIZE.cardboard;
    this.skin = pickSkin(CARDBOARD_SKINS, `${stack}:${top}`);
    this.img = scene.add.image(x + w / 2, top + h, this.skin).setOrigin(0.5, 1).setScale(ART_SCALE).setDepth(DEPTH.prop);
    this.solid = { x, y: top, w, h, oneWay: false, kind: 'cardboard', ref: this };
  }
  get right(): number {
    return this.x + OBJECT_SIZE.cardboard.w;
  }
  get broken(): boolean {
    return this.solid === null;
  }
  barkTarget(): Rect | null {
    return this.solid ? { x: this.x, y: this.top, w: OBJECT_SIZE.cardboard.w, h: OBJECT_SIZE.cardboard.h } : null;
  }
  onBark(): void {
    this.onStackBreak(this.stack);
  }
  /** Start breaking after a short stagger (stacks burst bottom-up). */
  burst(delay: number): void {
    if (this.breakT >= 0 || !this.solid) return;
    this.breakT = delay;
  }
  update(dt: number, ctx: GameContext): void {
    if (this.solid && this.breakT < 0) {
      // Idle jiggle: fragile objects are identifiable by motion, not colour alone.
      this.wobble += dt * 5;
      this.img.rotation = Math.sin(this.wobble) * 0.025;
      return;
    }
    if (this.breakT >= 0) {
      this.breakT -= dt;
      if (this.breakT < 0.08 && this.img.texture.key === this.skin) this.img.setTexture('cardboard_breaking');
      if (this.breakT <= 0 && this.solid) {
        this.solid = null;
        this.img.setVisible(false);
        const cx = this.x + OBJECT_SIZE.cardboard.w / 2;
        const cy = this.top + OBJECT_SIZE.cardboard.h / 2;
        ctx.fx.bits(cx, cy, 9);
        ctx.fx.puff(cx, cy, 4, 0.8);
        Audio.play('box_break');
        if (this.top + OBJECT_SIZE.cardboard.h >= WORLD.groundY - 1) {
          this.flat = ctx.scene.add.image(cx, WORLD.groundY, 'cardboard_flat').setOrigin(0.5, 1).setScale(ART_SCALE).setDepth(DEPTH.prop);
        }
      }
    }
  }
  destroy(): void {
    this.img.destroy();
    this.flat?.destroy();
  }
}

export class Tyre extends Entity {
  private img: Phaser.GameObjects.Image;
  constructor(scene: Phaser.Scene, private x: number, private bottom: number) {
    super();
    this.img = scene.add.image(x + OBJECT_SIZE.tyre.w / 2, bottom, pickSkin(LOW_HAZARD_SKINS, x)).setOrigin(0.5, 1).setScale(ART_SCALE).setDepth(DEPTH.prop);
  }
  get right(): number {
    return this.x + OBJECT_SIZE.tyre.w;
  }
  hazard(): Rect {
    return { x: this.x + 6, y: this.bottom - 34, w: OBJECT_SIZE.tyre.w - 12, h: 32 };
  }
  destroy(): void {
    this.img.destroy();
  }
}

export class Bone extends Entity {
  private img: Phaser.GameObjects.Image;
  private t = Math.random() * 6;
  constructor(scene: Phaser.Scene, private x: number, private y: number, readonly id: string) {
    super();
    this.img = scene.add.image(x, y, 'bone').setScale(ART_SCALE).setDepth(DEPTH.bone);
  }
  get right(): number {
    return this.x + 20;
  }
  update(dt: number): void {
    this.t += dt;
    this.img.y = this.y + Math.sin(this.t * 4) * 3;
    this.img.rotation = Math.sin(this.t * 2.5) * 0.15;
  }
  pickup(): Rect {
    return { x: this.x - 18, y: this.y - 12, w: 36, h: 24 };
  }
  /** Bone Magnet: drift toward a point. */
  pull(tx: number, ty: number, speed: number, dt: number): void {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const step = Math.min(d, speed * dt);
    this.x += (dx / d) * step;
    this.y += (dy / d) * step;
    this.img.x = this.x;
  }
  get pos(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }
  onPickup(ctx: GameContext): void {
    this.alive = false;
    ctx.fx.sparkle(this.x, this.y, 4);
    ctx.fx.floatText(this.x, this.y - 18, '+1');
    ctx.addBone();
  }
  destroy(): void {
    this.img.destroy();
  }
}

export class Scent extends Entity {
  private img: Phaser.GameObjects.Image;
  private t = Math.random() * 6;
  constructor(scene: Phaser.Scene, private x: number, private y: number) {
    super();
    this.img = scene.add.image(x, y, 'scent').setScale(ART_SCALE).setAlpha(0.75).setDepth(DEPTH.scent);
  }
  get right(): number {
    return this.x + 20;
  }
  update(dt: number): void {
    this.t += dt;
    this.img.y = this.y + Math.sin(this.t * 2) * 6;
    this.img.rotation += dt * 1.5;
    this.img.alpha = 0.55 + Math.sin(this.t * 3) * 0.2;
  }
  destroy(): void {
    this.img.destroy();
  }
}

export class Gate extends Entity {
  private frame: Phaser.GameObjects.Image;
  private doors: Phaser.GameObjects.Image[];
  private open = 0;
  constructor(scene: Phaser.Scene, private x: number) {
    super();
    const y = WORLD.groundY;
    this.frame = scene.add.image(x, y, 'exit_gate').setOrigin(0.5, 1).setScale(ART_SCALE).setDepth(DEPTH.platform - 1);
    this.doors = [
      scene.add.image(x - 86, y, 'gate_door').setOrigin(0, 1).setScale(ART_SCALE).setDepth(DEPTH.platform),
      scene.add.image(x + 86, y, 'gate_door').setOrigin(1, 1).setScale(ART_SCALE).setDepth(DEPTH.platform),
    ];
  }
  get right(): number {
    return this.x + 110;
  }
  update(dt: number, ctx: GameContext): void {
    if (this.x - ctx.heroX < 520) this.open = Math.min(1, this.open + dt * 2.5);
    const s = ART_SCALE * (1 - this.open * 0.85);
    for (const d of this.doors) d.scaleX = s;
  }
  destroy(): void {
    this.frame.destroy();
    for (const d of this.doors) d.destroy();
  }
}

export class BurstMarker extends Entity {
  private img: Phaser.GameObjects.Image;
  private t = 0;
  constructor(scene: Phaser.Scene, private x: number) {
    super();
    // Painted on the floor's top lip, drawn over the ground.
    this.img = scene.add.image(x, WORLD.groundY + 9, 'burst_marker').setOrigin(0, 0.5).setScale(ART_SCALE).setDepth(DEPTH.ground + 1);
  }
  get right(): number {
    return this.x + 144;
  }
  update(dt: number): void {
    this.t += dt;
    this.img.setAlpha(0.75 + Math.sin(this.t * 8) * 0.25);
  }
  destroy(): void {
    this.img.destroy();
  }
}

// ---------------------------------------------------------------- enemies

type SquirrelState = 'waiting' | 'skitter' | 'aim' | 'throw' | 'dart' | 'taunt' | 'flee' | 'bored';

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * Pest squirrel. Once the hero gets near, it skitters frantically ahead of him,
 * darting to random spots, chittering, and hurling acorns: lobbed clusters
 * that land and stay on the path as obstacles, and rollers that skid to a stop.
 * Every so often it darts in close to taunt, which is the moment to bark it
 * away. It stays a threat until barked at (or eventually gets bored).
 */
export class Squirrel extends Entity {
  private img: Phaser.GameObjects.Image;
  private bubble: Phaser.GameObjects.Image;
  private state: SquirrelState = 'waiting';
  private t = 0;
  private life = 0;
  private x: number;
  private y: number;
  /** Offset from the hero's screen position. */
  private rel = 500;
  private fromRel = 500;
  private toRel = 500;
  private moveTime = 0.5;
  private hopH = 20;
  private stateTime = 1;
  private throwCooldown = 0.6;
  private sinceTaunt = 0;
  private nuts: Acorn[] = [];
  private vx = 0;
  private vy = 0;
  static readonly WARN_DISTANCE = 1000;
  static readonly MAX_LIFE = 20;
  static readonly MAX_NUTS = 6;

  constructor(scene: Phaser.Scene, x: number, bottom: number) {
    super();
    this.x = x;
    this.y = bottom;
    this.img = scene.add.image(x, bottom, 'squirrel_idle').setOrigin(0.5, 1).setScale(ART_SCALE).setDepth(DEPTH.enemy);
    this.bubble = scene.add.image(x, bottom - 58, 'fx_exclaim').setOrigin(0.5, 1).setScale(ART_SCALE).setDepth(DEPTH.enemy + 1).setVisible(false);
  }
  get right(): number {
    return this.state === 'waiting' ? this.x + 40 : Number.POSITIVE_INFINITY;
  }
  /** True while it is on screen harassing the hero (drives the stress music). */
  get pestering(): boolean {
    return this.state !== 'waiting' && this.state !== 'flee' && this.state !== 'bored';
  }
  private go(s: SquirrelState, time = 1): void {
    this.state = s;
    this.t = 0;
    this.stateTime = time;
    this.fromRel = this.rel;
    const tex = s === 'throw' ? 'squirrel_throw' : s === 'aim' || s === 'taunt' ? 'squirrel_taunt' : s === 'flee' ? 'squirrel_startled' : s === 'bored' ? 'squirrel_run' : 'squirrel_idle';
    this.img.setTexture(tex);
    this.img.setFlipX(false);
  }
  private moveTo(rel: number, time: number, hop: number): void {
    this.fromRel = this.rel;
    this.toRel = rel;
    this.moveTime = Math.max(0.01, time);
    this.hopH = hop;
  }
  hazard(): Rect | null {
    return this.pestering ? { x: this.x - 16, y: this.y - 44, w: 32, h: 40 } : null;
  }
  barkTarget(): Rect | null {
    return this.pestering || this.state === 'waiting' ? { x: this.x - 24, y: this.y - 60, w: 48, h: 60 } : null;
  }
  onBark(ctx: GameContext): void {
    this.flee(ctx);
  }
  onHeroHit(ctx: GameContext): void {
    this.flee(ctx);
  }
  flee(ctx: GameContext): void {
    if (this.state === 'flee' || this.state === 'bored') return;
    this.go('flee');
    this.bubble.setVisible(false);
    ctx.fx.puff(this.x, this.y - 30, 6, 1);
    ctx.fx.stars(this.x, this.y - 40, 4);
    Audio.play('retreat');
    this.vx = 520;
    this.vy = -620;
  }
  private nextSkitter(): void {
    this.go('skitter', rand(0.35, 0.9));
    // Hang around close enough to be barked at (bark reaches ~250 px ahead).
    this.moveTo(rand(190, 460), this.stateTime * rand(0.5, 0.9), rand(8, 55));
  }
  private throwNut(ctx: GameContext): void {
    this.nuts = this.nuts.filter((n) => n.alive);
    if (this.nuts.length >= Squirrel.MAX_NUTS) return;
    // Lob a cluster to land on the path in front of the hero; it stays there as
    // an obstacle to jump (or bark away). Only at spots that leave a fair landing.
    // The pile takes ~0.75 s to land while the hero keeps running, so lead the
    // target well ahead of him (and keep it on screen).
    let target = -1;
    for (let i = 0; i < 8 && target < 0; i++) {
      const tx = Math.min(ctx.cameraRight - 60, ctx.heroX + rand(480, 820));
      if (ctx.isClearSpot(tx)) target = tx;
    }
    if (target < 0) return;
    const nut = new Acorn(ctx.scene, this.x - 20, this.y - 40, 'lob', target);
    this.nuts.push(nut);
    ctx.spawn(nut);
    Audio.play('throw');
  }
  update(dt: number, ctx: GameContext): void {
    this.t += dt;
    const heroScreen = ctx.heroX - ctx.cameraLeft;
    if (this.state === 'waiting') {
      this.img.y = this.y - Math.abs(Math.sin(this.t * 6)) * 6;
      this.img.setFlipX(Math.sin(this.t * 3) > 0);
      if (this.x - ctx.heroX < Squirrel.WARN_DISTANCE) {
        this.rel = this.x - ctx.heroX;
        Audio.play('squirrel_angry');
        this.nextSkitter();
      }
      return;
    }
    if (this.state === 'flee' || this.state === 'bored') {
      this.vy += 1500 * dt;
      this.x += (this.state === 'bored' ? 900 : this.vx) * dt;
      this.y += (this.state === 'bored' ? 0 : this.vy) * dt;
      if (this.state === 'flee') this.img.rotation += dt * 10;
      this.img.setPosition(this.x, this.state === 'bored' ? this.y - Math.abs(Math.sin(this.t * 16)) * 10 : this.y);
      this.bubble.setVisible(false);
      if (this.y > WORLD.pitDeathY + 200 || this.x > ctx.cameraRight + 200) this.alive = false;
      return;
    }

    this.life += dt;
    this.sinceTaunt += dt;
    this.throwCooldown -= dt;
    const mk = Math.min(1, this.t / this.moveTime);
    this.rel = Phaser.Math.Linear(this.fromRel, this.toRel, 1 - Math.pow(1 - mk, 3));
    let hop = Math.sin(mk * Math.PI) * this.hopH;
    // Constant nervous jitter.
    const jitter = Math.sin(this.t * 47) * 2;

    switch (this.state) {
      case 'skitter':
        this.img.setFlipX(Math.sin(this.t * 20) > 0.6);
        if (this.t >= this.stateTime) {
          if (this.life > Squirrel.MAX_LIFE) {
            this.go('bored');
            break;
          }
          const r = Math.random();
          if (this.sinceTaunt > 1.6 && r < 0.5) {
            // Dart in close to taunt: the bark window.
            this.go('dart', 0.3);
            this.moveTo(rand(175, 220), 0.3, 35);
          } else if (this.throwCooldown <= 0 && r < 0.85) {
            this.go('aim', rand(0.35, 0.7));
            this.moveTo(this.rel, 0.01, 0);
            Audio.play('squirrel_angry');
          } else this.nextSkitter();
        }
        break;
      case 'aim':
        this.bubble.setVisible(true).setScale(ART_SCALE * (1 + Math.sin(this.t * 20) * 0.1));
        hop = Math.abs(Math.sin(this.t * 25)) * 4;
        if (this.t >= this.stateTime) {
          this.bubble.setVisible(false);
          this.throwNut(ctx);
          if (Math.random() < 0.5) this.pendingSecondThrow = 0.22;
          this.throwCooldown = rand(0.7, 1.3);
          this.go('throw', 0.3);
        }
        break;
      case 'throw':
        if (this.pendingSecondThrow > 0) {
          this.pendingSecondThrow -= dt;
          if (this.pendingSecondThrow <= 0) this.throwNut(ctx);
        }
        if (this.t >= this.stateTime) this.nextSkitter();
        break;
      case 'dart':
        if (this.t >= this.stateTime) {
          this.go('taunt', rand(1.1, 1.7));
          this.moveTo(this.rel, 0.01, 0);
          Audio.play('squirrel');
        }
        break;
      case 'taunt':
        hop = Math.abs(Math.sin(this.t * 14)) * 7;
        this.img.setFlipX(Math.floor(this.t * 6) % 2 === 0);
        if (this.t >= this.stateTime) {
          this.sinceTaunt = 0;
          this.nextSkitter();
        }
        break;
    }
    this.x = ctx.cameraLeft + Phaser.Math.Clamp(heroScreen + this.rel, 120, ctx.cameraRight - ctx.cameraLeft - 40);
    this.y = WORLD.groundY;
    if (ctx.surfaceBelow(this.x, WORLD.groundY - 1) === null) hop += 60;
    this.img.setPosition(this.x + jitter, this.y - hop);
    this.bubble.setPosition(this.x - 6, this.y - hop - 58);
  }
  private pendingSecondThrow = 0;
  destroy(): void {
    this.img.destroy();
    this.bubble.destroy();
  }
}

/**
 * Thrown acorns. Squirrels lob clusters that arc onto the path and stay there
 * as an obstacle ('roll' acorns skid along the floor and come to rest). Jump
 * them or bark them away.
 */
export class Acorn extends Entity {
  private img: Phaser.GameObjects.Image;
  private vx: number;
  private vy: number;
  private resting = false;
  private t = 0;
  constructor(scene: Phaser.Scene, private x: number, private y: number, private mode: 'lob' | 'roll' = 'roll', target?: number) {
    super();
    const lob = mode === 'lob';
    this.img = scene.add.image(x, y, lob ? 'nut_pile' : 'acorn').setOrigin(0.5, 0.5).setScale(ART_SCALE).setDepth(DEPTH.enemy);
    if (lob) {
      this.vy = -520;
      const g = 1600;
      const drop = WORLD.groundY - 14 - y;
      const T = (-this.vy + Math.sqrt(this.vy * this.vy + 2 * g * drop)) / g;
      this.vx = ((target ?? x - 250) - x) / T;
    } else {
      this.vx = -280;
      this.vy = -120;
    }
  }
  private get r(): number {
    return this.mode === 'lob' ? 14 : 11;
  }
  get right(): number {
    return this.x + 20;
  }
  hazard(): Rect {
    return this.mode === 'lob' ? { x: this.x - 19, y: this.y - 14, w: 38, h: 28 } : { x: this.x - 9, y: this.y - 9, w: 18, h: 18 };
  }
  barkTarget(): Rect {
    return { x: this.x - 20, y: this.y - 18, w: 40, h: 36 };
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
    const r = this.r;
    if (this.resting) {
      // Settled on the path: a little wobble so it reads as a hazard.
      this.img.rotation = Math.sin(this.t * 5) * 0.08;
      if (this.x < ctx.cameraLeft - 100) this.alive = false;
      if (ctx.surfaceBelow(this.x, this.y + r - 2) === null) this.resting = false;
      return;
    }
    this.vy += 1600 * dt;
    const nx = this.x + this.vx * dt;
    let ny = this.y + this.vy * dt;
    const surf = ctx.surfaceBelow(nx, this.y + r - 2);
    if (surf !== null && ny + r >= surf && this.vy >= 0) {
      ny = surf - r;
      if (this.mode === 'lob') {
        this.vx = 0;
        this.vy = 0;
        this.resting = true;
        Audio.play('nut_land');
        ctx.fx.dust(nx, surf, 2);
      } else {
        this.vy = this.vy > 300 ? -this.vy * 0.3 : 0;
        // Friction: rollers skid to a stop and become a small obstacle.
        this.vx = Math.min(0, this.vx + 260 * dt);
        if (this.vx > -8 && this.vy === 0) {
          // A roller that stops somewhere unfair just fizzles out instead.
          if (!ctx.isClearSpot(nx)) {
            this.alive = false;
            ctx.fx.puff(nx, surf - 8, 2, 0.5);
            return;
          }
          this.resting = true;
        }
      }
    }
    this.x = nx;
    this.y = ny;
    this.img.setPosition(this.x, this.y);
    if (this.mode === 'roll' && !this.resting) this.img.rotation += (this.vx * dt) / r;
    if (this.x < ctx.cameraLeft - 100 || this.y > WORLD.pitDeathY + 100) this.alive = false;
  }
  destroy(): void {
    this.img.destroy();
  }
}

/**
 * Low-clearance sign hanging on chains: its bottom is just above a standing
 * dog's back. Duck under it (or double-jump over it).
 */
export class LowBar extends Entity {
  private img: Phaser.GameObjects.Image;
  private chains: Phaser.GameObjects.Graphics;
  private t: number;
  /** Current gap between the pipe's underside and the floor. */
  private clearance: number = LowBar.CLEARANCE;
  private speed: number;
  static readonly W = 104;
  /**
   * Lowest point of the pipe's underside: it briefly dips below a ducking dog's
   * back (22 px), so ducking needs timing too. Most of the cycle a duck fits.
   */
  static readonly CLEARANCE = 16;
  /** Highest point: a standing dog fits under it, if the timing is right. */
  static readonly MAX_CLEARANCE = 128;
  static readonly H = 58;
  constructor(scene: Phaser.Scene, private x: number) {
    super();
    // Each pipe pumps up and down on its own hydraulic rhythm.
    this.t = (x * 0.0137) % (Math.PI * 2);
    this.speed = 2.2 + ((x * 0.0071) % 1.4);
    this.chains = scene.add.graphics().setDepth(DEPTH.enemy);
    this.img = scene.add.image(x - 3, WORLD.groundY, 'lowbar').setOrigin(0, 1).setScale(ART_SCALE).setDepth(DEPTH.enemy);
    this.place();
  }
  get right(): number {
    return this.x + LowBar.W;
  }
  private place(): void {
    const k = (1 - Math.cos(this.t * this.speed)) / 2;
    this.clearance = LowBar.CLEARANCE + (LowBar.MAX_CLEARANCE - LowBar.CLEARANCE) * k;
    const bottom = WORLD.groundY - this.clearance;
    this.img.y = bottom + 2;
    // Telescoping supply pipes from the ceiling down to the moving pipe.
    const g = this.chains;
    g.clear();
    const len = bottom - LowBar.H + 30;
    for (const cx of [this.x + 11, this.x + 82]) {
      g.fillStyle(0x302331, 1).fillRect(cx - 2, -20, 18, len);
      g.fillStyle(0x6f7e96, 1).fillRect(cx + 1, -20, 12, len);
      g.fillStyle(0xffffff, 0.25).fillRect(cx + 3, -20, 3, len);
      // Piston collar where the inner tube slides.
      g.fillStyle(0x302331, 1).fillRect(cx - 4, len - 46, 22, 12);
      g.fillStyle(0x8693a8, 1).fillRect(cx - 2, len - 44, 18, 8);
    }
  }
  update(dt: number): void {
    this.t += dt;
    this.place();
    this.img.rotation = Math.sin(this.t * 2) * 0.012;
  }
  hazard(): Rect {
    const bottom = WORLD.groundY - this.clearance;
    return { x: this.x, y: bottom - LowBar.H, w: LowBar.W, h: LowBar.H };
  }
  destroy(): void {
    this.img.destroy();
    this.chains.destroy();
  }
}

/** Wheelie bin that starts rolling toward the hero once he gets close. Jump it. */
export class Barrel extends Entity {
  private img: Phaser.GameObjects.Image;
  private rolling = false;
  private vx = 0;
  private t = 0;
  static readonly TRIGGER = 900;
  constructor(scene: Phaser.Scene, private x: number) {
    super();
    this.img = scene.add.image(x, WORLD.groundY + 1, 'barrel').setOrigin(0.5, 1).setScale(ART_SCALE).setDepth(DEPTH.enemy);
  }
  get right(): number {
    return this.x + 24;
  }
  hazard(): Rect {
    return { x: this.x - 17, y: WORLD.groundY - 40, w: 34, h: 38 };
  }
  update(dt: number, ctx: GameContext): void {
    this.t += dt;
    if (!this.rolling && this.x - ctx.heroX < Barrel.TRIGGER) {
      this.rolling = true;
      Audio.play('parcel');
    }
    if (this.rolling) {
      this.vx = Math.max(-230, this.vx - 700 * dt);
      this.x += this.vx * dt;
      // Wheelie bin: rattles and tips forward as it trundles along.
      this.img.rotation = -0.12 + Math.sin(this.t * 22) * 0.06;
      if (Math.random() < dt * 6) ctx.fx.dust(this.x + 20, WORLD.groundY, 1);
    } else {
      this.img.rotation = Math.sin(this.t * 6) * 0.05;
    }
    this.img.x = this.x;
    // Fell into a pit or rolled off screen.
    if (ctx.surfaceBelow(this.x, WORLD.groundY - 1) === null) {
      this.img.y += 600 * dt;
      if (this.img.y > WORLD.pitDeathY) this.alive = false;
    }
    if (this.x < ctx.cameraLeft - 100) this.alive = false;
  }
  destroy(): void {
    this.img.destroy();
  }
}

export class Parcel extends Entity {
  private img: Phaser.GameObjects.Image;
  private w: number;
  private h: number;
  private dist = 0;
  constructor(scene: Phaser.Scene, private x: number, big: boolean, private vx: number) {
    super();
    this.w = big ? 58 : 46;
    this.h = big ? 56 : 42;
    this.img = scene.add.image(x, WORLD.groundY - this.h / 2, big ? 'parcel_big' : 'parcel_small').setScale(ART_SCALE).setDepth(DEPTH.boss + 1);
  }
  get right(): number {
    return this.x + this.w / 2;
  }
  hazard(): Rect {
    const inset = 7;
    return { x: this.x - this.w / 2 + inset, y: WORLD.groundY - this.h + inset, w: this.w - inset * 2, h: this.h - inset };
  }
  update(dt: number, ctx: GameContext): void {
    this.x += this.vx * dt;
    this.dist += Math.abs(this.vx) * dt;
    // Tumble: quarter turns with a corner-lift hop.
    const quarter = (this.w + this.h) / 2;
    const k = (this.dist % quarter) / quarter;
    const step = Math.floor(this.dist / quarter);
    this.img.rotation = -(step + k) * (Math.PI / 2);
    this.img.setPosition(this.x, WORLD.groundY - this.h / 2 - Math.sin(k * Math.PI) * 8);
    if (k < 0.05 && this.dist > 10) {
      if (Math.random() < 0.08) ctx.fx.dust(this.x + this.w / 2, WORLD.groundY, 1);
    }
    if (this.x < ctx.cameraLeft - 120) this.alive = false;
  }
  destroy(): void {
    this.img.destroy();
  }
}
