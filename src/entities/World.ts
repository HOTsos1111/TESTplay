import Phaser from 'phaser';
import { DEPTH, WORLD } from '../data/config';
import { OBJECT_SIZE } from '../data/chunks';
import { ART_SCALE } from '../systems/AssetRegistry';
import { Audio } from '../systems/AudioManager';
import type { Fx } from '../systems/Fx';
import type { Rect, Solid } from '../systems/PlayerController';

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
  private c: Phaser.GameObjects.Container;
  constructor(scene: Phaser.Scene, private x: number, private w: number, top: number) {
    super();
    this.c = scene.add.container(x, top).setDepth(DEPTH.platform);
    const legH = WORLD.groundY - top - 10;
    for (let lx = 30; lx < w - 20; lx += 170) {
      this.c.add(scene.add.image(lx, 10, 'platform_leg').setOrigin(0.5, 0).setDisplaySize(16, legH));
    }
    this.c.add(scene.add.image(w - 30, 10, 'platform_leg').setOrigin(0.5, 0).setDisplaySize(16, legH));
    this.c.add(scene.add.tileSprite(14, 0, w - 28, 18, 'platform_mid').setOrigin(0, 0).setTileScale(ART_SCALE));
    this.c.add(scene.add.image(0, 0, 'platform_left').setOrigin(0, 0).setScale(ART_SCALE));
    this.c.add(scene.add.image(w, 0, 'platform_right').setOrigin(1, 0).setScale(ART_SCALE));
    this.solid = { x, y: top, w, h: OBJECT_SIZE.platformThickness, oneWay: true, kind: 'platform' };
  }
  get right(): number {
    return this.x + this.w;
  }
  destroy(): void {
    this.c.destroy();
  }
}

export class Crate extends Entity {
  private img: Phaser.GameObjects.Image;
  constructor(scene: Phaser.Scene, private x: number, top: number) {
    super();
    const { w, h } = OBJECT_SIZE.crate;
    this.img = scene.add.image(x, top, 'crate').setOrigin(0, 0).setScale(ART_SCALE).setDepth(DEPTH.prop);
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
  private breakT = -1;
  private wobble = Math.random() * 6;
  private flat: Phaser.GameObjects.Image | null = null;
  constructor(scene: Phaser.Scene, private x: number, private top: number, readonly stack: string, private onStackBreak: (stack: string) => void) {
    super();
    const { w, h } = OBJECT_SIZE.cardboard;
    this.img = scene.add.image(x + w / 2, top + h, 'cardboard').setOrigin(0.5, 1).setScale(ART_SCALE).setDepth(DEPTH.prop);
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
      if (this.breakT < 0.08 && this.img.texture.key === 'cardboard') this.img.setTexture('cardboard_breaking');
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
    this.img = scene.add.image(x + OBJECT_SIZE.tyre.w / 2, bottom, 'tyre').setOrigin(0.5, 1).setScale(ART_SCALE).setDepth(DEPTH.prop);
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

// ---------------------------------------------------------------- enemies

type SquirrelState = 'idle' | 'taunt' | 'throw' | 'run' | 'startled';

export class Squirrel extends Entity {
  private img: Phaser.GameObjects.Image;
  private bubble: Phaser.GameObjects.Image;
  private state: SquirrelState = 'idle';
  private t = 0;
  private t2 = Math.random() * 5;
  private vx = 0;
  private vy = 0;
  private x: number;
  private y: number;
  /** Distance ahead of the hero at which the squirrel starts its warning. */
  static readonly WARN_DISTANCE = 950;
  static readonly WARN_TIME = 1.0;

  constructor(scene: Phaser.Scene, x: number, bottom: number) {
    super();
    this.x = x;
    this.y = bottom;
    this.img = scene.add.image(x, bottom, 'squirrel_idle').setOrigin(0.5, 1).setScale(ART_SCALE).setDepth(DEPTH.enemy);
    this.bubble = scene.add.image(x - 6, bottom - 58, 'fx_exclaim').setOrigin(0.5, 1).setScale(ART_SCALE).setDepth(DEPTH.enemy + 1).setVisible(false);
  }
  get right(): number {
    return this.x + 40;
  }
  private setState(s: SquirrelState): void {
    this.state = s;
    this.t = 0;
    this.img.setTexture(`squirrel_${s === 'throw' ? 'throw' : s}`);
  }
  private threatening(): boolean {
    return this.state === 'idle' || this.state === 'taunt' || this.state === 'throw';
  }
  hazard(): Rect | null {
    return this.threatening() ? { x: this.x - 16, y: this.y - 44, w: 32, h: 40 } : null;
  }
  barkTarget(): Rect | null {
    return this.threatening() ? { x: this.x - 22, y: this.y - 56, w: 44, h: 56 } : null;
  }
  onBark(ctx: GameContext): void {
    this.flee(ctx);
  }
  onHeroHit(ctx: GameContext): void {
    this.flee(ctx);
  }
  private flee(ctx: GameContext): void {
    if (!this.threatening()) return;
    this.setState('startled');
    this.bubble.setVisible(false);
    ctx.fx.puff(this.x, this.y - 30, 5, 0.9);
    Audio.play('retreat');
    this.vx = 420;
    this.vy = -520;
  }
  update(dt: number, ctx: GameContext): void {
    this.t += dt;
    this.t2 += dt;
    switch (this.state) {
      case 'idle':
        this.img.y = this.y - Math.abs(Math.sin(this.t2 * 3)) * 4;
        if (this.x - ctx.heroX < Squirrel.WARN_DISTANCE) {
          this.setState('taunt');
          this.bubble.setVisible(true);
          Audio.play('squirrel');
        }
        break;
      case 'taunt':
        this.img.y = this.y - Math.abs(Math.sin(this.t * 9)) * 6;
        this.bubble.setScale(ART_SCALE * (1 + Math.sin(this.t * 14) * 0.08));
        if (this.t >= Squirrel.WARN_TIME) {
          this.setState('throw');
          this.bubble.setVisible(false);
          ctx.spawn(new Acorn(ctx.scene, this.x - 24, this.y - 26));
          Audio.play('throw');
        }
        break;
      case 'throw':
        if (this.t > 0.3) {
          this.setState('run');
          this.vx = 700;
          this.vy = -260;
        }
        break;
      case 'run':
      case 'startled':
        this.vy += 1500 * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.img.setPosition(this.x, this.y);
        if (this.state === 'startled') this.img.rotation += dt * 9;
        if (this.y > WORLD.pitDeathY + 200 || this.x > ctx.cameraRight + 200) this.alive = false;
        break;
    }
    if (this.state === 'run' || this.state === 'startled') return;
    this.img.x = this.x;
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
  constructor(scene: Phaser.Scene, private x: number, private y: number) {
    super();
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
      this.vy = this.vy > 300 ? -this.vy * 0.3 : 0;
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
