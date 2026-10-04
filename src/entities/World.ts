import Phaser from 'phaser';
import { DEPTH, WORLD } from '../data/config';
import { OBJECT_SIZE } from '../data/chunks';
import { ART_SCALE } from '../systems/AssetRegistry';
import { Audio } from '../systems/AudioManager';
import type { Fx } from '../systems/Fx';
import type { Rect, Solid } from '../systems/PlayerController';
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
  private objs: Phaser.GameObjects.GameObject[] = [];
  constructor(scene: Phaser.Scene, private x: number, private w: number, edgeLeft: boolean, edgeRight: boolean) {
    super();
    const y = WORLD.groundY;
    const capW = 24;
    const tx = x + (edgeLeft ? capW : 0);
    const tw = w - (edgeLeft ? capW : 0) - (edgeRight ? capW : 0);
    if (tw > 0) {
      const ts = scene.add.tileSprite(tx, y, tw, 120, 'ground_mid').setOrigin(0, 0).setTileScale(ART_SCALE).setDepth(DEPTH.ground);
      ts.tilePositionX = (tx % 64) / ART_SCALE;
      this.objs.push(ts);
    }
    if (edgeLeft) this.objs.push(scene.add.image(x, y, 'ground_edge_left').setOrigin(0, 0).setScale(ART_SCALE).setDepth(DEPTH.ground));
    if (edgeRight) this.objs.push(scene.add.image(x + w - capW, y, 'ground_edge_right').setOrigin(0, 0).setScale(ART_SCALE).setDepth(DEPTH.ground));
    this.solid = { x, y, w, h: 400, oneWay: false, kind: 'ground' };
  }
  get right(): number {
    return this.x + this.w;
  }
  destroy(): void {
    for (const o of this.objs) o.destroy();
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
  pickup(): Rect {
    return { x: this.x - 30, y: this.y - 36, w: 60, h: 72 };
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
  /** Golden Bone magnet: drift toward a point. */
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

type SquirrelState = 'waiting' | 'enter' | 'aim' | 'throw' | 'approach' | 'taunt' | 'back' | 'flee' | 'bored';

/**
 * Pest squirrel. Once the hero gets near it scampers along just ahead of him,
 * pelting him with acorns (rolling and bouncing). Between volleys it hops in
 * close to blow a raspberry, which is the moment to bark it off the screen.
 * It stays a threat until barked at (or eventually gets bored and leaves).
 */
export class Squirrel extends Entity {
  private img: Phaser.GameObjects.Image;
  private bubble: Phaser.GameObjects.Image;
  private state: SquirrelState = 'waiting';
  private t = 0;
  private life = 0;
  private x: number;
  private y: number;
  private screenX = 0;
  private fromX = 0;
  private throwsLeft = 2;
  private volley = 0;
  private vx = 0;
  private vy = 0;
  /** Distance ahead of the hero at which the squirrel starts pestering. */
  static readonly WARN_DISTANCE = 1000;
  static readonly REST_X = 790;
  static readonly TAUNT_X = 530;
  static readonly AIM_TIME = 0.75;
  static readonly TAUNT_TIME = 1.25;
  static readonly MAX_LIFE = 18;

  constructor(scene: Phaser.Scene, x: number, bottom: number) {
    super();
    this.x = x;
    this.y = bottom;
    this.img = scene.add.image(x, bottom, 'squirrel_idle').setOrigin(0.5, 1).setScale(ART_SCALE).setDepth(DEPTH.enemy);
    this.bubble = scene.add.image(x, bottom - 58, 'fx_exclaim').setOrigin(0.5, 1).setScale(ART_SCALE).setDepth(DEPTH.enemy + 1).setVisible(false);
  }
  get right(): number {
    // Never despawned by the camera while it is tracking the hero.
    return this.state === 'waiting' ? this.x + 40 : Number.POSITIVE_INFINITY;
  }
  private go(s: SquirrelState): void {
    this.state = s;
    this.t = 0;
    this.fromX = this.screenX;
    const tex = s === 'throw' ? 'squirrel_throw' : s === 'aim' || s === 'taunt' ? 'squirrel_taunt' : s === 'flee' ? 'squirrel_startled' : s === 'bored' ? 'squirrel_run' : 'squirrel_idle';
    this.img.setTexture(tex);
  }
  private get active(): boolean {
    return this.state !== 'flee' && this.state !== 'bored';
  }
  hazard(): Rect | null {
    return this.active ? { x: this.x - 16, y: this.y - 44, w: 32, h: 40 } : null;
  }
  barkTarget(): Rect | null {
    return this.active ? { x: this.x - 24, y: this.y - 60, w: 48, h: 60 } : null;
  }
  onBark(ctx: GameContext): void {
    this.flee(ctx);
  }
  onHeroHit(ctx: GameContext): void {
    this.flee(ctx);
  }
  /** Scared off: tumbles away and off the screen. */
  flee(ctx: GameContext): void {
    if (!this.active) return;
    this.go('flee');
    this.bubble.setVisible(false);
    ctx.fx.puff(this.x, this.y - 30, 6, 1);
    ctx.fx.stars(this.x, this.y - 40, 4);
    Audio.play('retreat');
    this.vx = 520;
    this.vy = -620;
  }
  update(dt: number, ctx: GameContext): void {
    this.t += dt;
    const ease = (k: number) => 1 - Math.pow(1 - Math.min(1, k), 3);
    if (this.state === 'waiting') {
      this.img.y = this.y - Math.abs(Math.sin(this.t * 3)) * 4;
      if (this.x - ctx.heroX < Squirrel.WARN_DISTANCE) {
        this.screenX = this.x - ctx.cameraLeft;
        this.go('enter');
        Audio.play('squirrel');
      }
      return;
    }
    if (this.state === 'flee' || this.state === 'bored') {
      this.vy += 1500 * dt;
      this.x += (this.state === 'bored' ? 900 : this.vx) * dt;
      this.y += (this.state === 'bored' ? 0 : this.vy) * dt;
      if (this.state === 'flee') this.img.rotation += dt * 10;
      else this.img.y = this.y - Math.abs(Math.sin(this.t * 16)) * 10;
      this.img.setPosition(this.x, this.state === 'bored' ? this.img.y : this.y);
      this.bubble.setVisible(false);
      if (this.y > WORLD.pitDeathY + 200 || this.x > ctx.cameraRight + 200) this.alive = false;
      return;
    }

    this.life += dt;
    let hop = 0;
    switch (this.state) {
      case 'enter':
        this.screenX = Phaser.Math.Linear(this.fromX, Squirrel.REST_X, ease(this.t / 0.7));
        hop = Math.abs(Math.sin(this.t * 14)) * 10;
        if (this.t >= 0.7) this.go('aim');
        break;
      case 'aim':
        this.bubble.setVisible(true);
        this.bubble.setScale(ART_SCALE * (1 + Math.sin(this.t * 14) * 0.08));
        hop = Math.abs(Math.sin(this.t * 9)) * 5;
        if (this.t >= Squirrel.AIM_TIME) {
          this.bubble.setVisible(false);
          // Alternate low rollers and bouncers.
          const bounce = (this.volley + this.throwsLeft) % 2 === 1;
          ctx.spawn(new Acorn(ctx.scene, this.x - 24, this.y - 30, bounce));
          Audio.play('throw');
          this.throwsLeft--;
          this.go('throw');
        }
        break;
      case 'throw':
        if (this.t > 0.35) {
          if (this.throwsLeft > 0) this.go('aim');
          else this.go('approach');
        }
        break;
      case 'approach':
        this.screenX = Phaser.Math.Linear(this.fromX, Squirrel.TAUNT_X, ease(this.t / 0.4));
        hop = Math.sin(Math.min(1, this.t / 0.4) * Math.PI) * 40;
        if (this.t >= 0.4) {
          this.go('taunt');
          Audio.play('squirrel');
        }
        break;
      case 'taunt':
        // Blowing a raspberry within bark range: the window to bark it away.
        hop = Math.abs(Math.sin(this.t * 12)) * 6;
        this.img.setFlipX(Math.floor(this.t * 4) % 2 === 0);
        if (this.t >= Squirrel.TAUNT_TIME) {
          this.img.setFlipX(false);
          this.go('back');
        }
        break;
      case 'back':
        this.screenX = Phaser.Math.Linear(this.fromX, Squirrel.REST_X, ease(this.t / 0.45));
        hop = Math.sin(Math.min(1, this.t / 0.45) * Math.PI) * 30;
        if (this.t >= 0.45) {
          this.volley++;
          this.throwsLeft = 2;
          if (this.life > Squirrel.MAX_LIFE) this.go('bored');
          else this.go('aim');
        }
        break;
    }
    // Keep pace with the hero, scampering along the floor (leaping over pits).
    this.x = ctx.cameraLeft + this.screenX;
    this.y = WORLD.groundY;
    if (ctx.surfaceBelow(this.x, WORLD.groundY - 1) === null) hop += 60;
    this.img.setPosition(this.x, this.y - hop);
    this.bubble.setPosition(this.x - 6, this.y - hop - 58);
  }
  destroy(): void {
    this.img.destroy();
    this.bubble.destroy();
  }
}

export class Acorn extends Entity {
  private img: Phaser.GameObjects.Image;
  private vx = -260;
  private vy = -120;
  constructor(scene: Phaser.Scene, private x: number, private y: number, private bouncy = false) {
    super();
    if (bouncy) {
      this.vx = -230;
      this.vy = -420;
    }
    this.img = scene.add.image(x, y, 'acorn').setOrigin(0.5, 0.5).setScale(ART_SCALE).setDepth(DEPTH.enemy);
  }
  get right(): number {
    return this.x + 12;
  }
  hazard(): Rect {
    return { x: this.x - 9, y: this.y - 9, w: 18, h: 18 };
  }
  barkTarget(): Rect {
    return { x: this.x - 14, y: this.y - 14, w: 28, h: 28 };
  }
  onBark(ctx: GameContext): void {
    this.alive = false;
    ctx.fx.puff(this.x, this.y, 3, 0.6);
  }
  onHeroHit(): void {
    this.alive = false;
  }
  update(dt: number, ctx: GameContext): void {
    const r = 11;
    this.vy += 1600 * dt;
    const nx = this.x + this.vx * dt;
    let ny = this.y + this.vy * dt;
    const surf = ctx.surfaceBelow(nx, this.y + r - 2);
    if (surf !== null && ny + r >= surf && this.vy >= 0) {
      ny = surf - r;
      this.vy = this.bouncy ? -Math.max(320, this.vy * 0.75) : this.vy > 300 ? -this.vy * 0.3 : 0;
    }
    this.x = nx;
    this.y = ny;
    this.img.setPosition(this.x, this.y);
    this.img.rotation += (this.vx * dt) / r;
    if (this.x < ctx.cameraLeft - 100 || this.y > WORLD.pitDeathY + 100) this.alive = false;
  }
  destroy(): void {
    this.img.destroy();
  }
}

/** Barrel that starts rolling toward the hero once he gets close. Jump it. */
export class Barrel extends Entity {
  private img: Phaser.GameObjects.Image;
  private rolling = false;
  private vx = 0;
  private t = 0;
  static readonly TRIGGER = 900;
  constructor(scene: Phaser.Scene, private x: number) {
    super();
    this.img = scene.add.image(x, WORLD.groundY - 24, 'barrel').setScale(ART_SCALE).setDepth(DEPTH.enemy);
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
      this.vx = Math.max(-170, this.vx - 600 * dt);
      this.x += this.vx * dt;
      this.img.rotation += (this.vx * dt) / 22;
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
