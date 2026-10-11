import Phaser from 'phaser';
import { DEPTH } from '../data/config';
import { ART_SCALE } from '../systems/AssetRegistry';
import { Audio } from '../systems/AudioManager';
import type { Rect } from '../systems/PlayerController';
import { Entity, type GameContext } from './World';

/**
 * The Boomerang Bone: the squeaky toy the pup rescued, thrown from his side.
 * It spins out the way he faces, slows to a stop, then homes back to him.
 * Whatever it meets is hit like a bark (squirrels, nuts, bosses), and bones it
 * passes are fetched. At the top level it hits on the way back too.
 */
export class Boomerang extends Entity {
  private img: Phaser.GameObjects.Image;
  private trail: Phaser.GameObjects.Graphics;
  private t = 0;
  private back = false;
  private x: number;
  private y: number;
  private readonly x0: number;
  private readonly y0: number;
  private readonly outT: number;
  private hitOut = new Set<Entity>();
  private hitBack = new Set<Entity>();
  private past: { x: number; y: number }[] = [];
  private squeakT = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private dir: 1 | -1,
    private range: number,
    private speed: number,
    private doubleBack: boolean,
    private hero: () => { x: number; y: number },
    /** Hits every bark target / fetches every pickup overlapping the rect (once per set). */
    private sweep: (r: Rect, hit: Set<Entity>, self: Entity) => void,
    private onCatch: () => void,
  ) {
    super();
    this.tag = 'boomerang';
    this.x = this.x0 = x;
    this.y = this.y0 = y;
    // Time to reach full range when easing out like a thrown boomerang.
    this.outT = (range / speed) * 1.6;
    this.trail = scene.add.graphics().setDepth(DEPTH.fx);
    this.img = scene.add.image(x, y, 'bone').setScale(ART_SCALE * 1.5).setDepth(DEPTH.fx + 1);
    Audio.play('throw');
  }

  get right(): number {
    return Number.POSITIVE_INFINITY;
  }

  private get rect(): Rect {
    return { x: this.x - 30, y: this.y - 24, w: 60, h: 48 };
  }

  update(dt: number, ctx: GameContext): void {
    this.t += dt;
    if (!this.back) {
      const k = Math.min(1, this.t / this.outT);
      this.x = this.x0 + this.dir * this.range * Math.sin((k * Math.PI) / 2);
      // A slight rising arc on the way out.
      this.y = this.y0 - Math.sin(k * Math.PI) * 22;
      if (k >= 1) {
        this.back = true;
        this.t = 0;
      }
    } else {
      // Home in on the pup, picking up speed.
      const h = this.hero();
      const tx = h.x;
      const ty = h.y - 40;
      const v = this.speed * Math.min(1.5, 0.5 + this.t * 1.6);
      const dx = tx - this.x;
      const dy = ty - this.y;
      const d = Math.hypot(dx, dy);
      if (d < 36 || this.t > 3) {
        this.alive = false;
        Audio.play('squeak');
        this.onCatch();
        return;
      }
      this.x += (dx / d) * Math.min(d, v * dt);
      this.y += (dy / d) * Math.min(d, v * dt);
    }
    this.img.setPosition(this.x, this.y).setRotation(this.img.rotation + this.dir * 22 * dt);
    this.sweep(this.rect, this.back && this.doubleBack ? this.hitBack : this.hitOut, this);
    // A whooshing blur trail and the odd squeak.
    this.past.unshift({ x: this.x, y: this.y });
    this.past.length = Math.min(this.past.length, 8);
    const g = this.trail;
    g.clear();
    this.past.forEach((p, i) => g.fillStyle(0xfff3d6, 0.35 * (1 - i / 8)).fillCircle(p.x, p.y, 16 - i * 1.5));
    this.squeakT -= dt;
    if (this.squeakT <= 0) {
      this.squeakT = 0.45;
      if (Math.random() < 0.5) ctx.fx.sparkle(this.x, this.y, 1);
    }
  }

  destroy(): void {
    this.img.destroy();
    this.trail.destroy();
  }
}
