import Phaser from 'phaser';
import { DEPTH, WORLD } from '../data/config';
import { PIGEON } from '../data/encounters';
import { ART_SCALE } from '../systems/AssetRegistry';
import { Audio } from '../systems/AudioManager';
import type { Rect } from '../systems/PlayerController';
import type { Boss, BossEvent } from './SquirrelSwarm';
import { Entity, type GameContext } from './World';

/** A crusty roll dropped by the Pigeon Captain: it bounces once, then rolls at the hero. */
class BreadRoll extends Entity {
  private img: Phaser.GameObjects.Image;
  private vy = 0;
  private grounded = false;
  private spin = 0;
  constructor(scene: Phaser.Scene, private x: number, private y: number, private vx: number) {
    super();
    this.img = scene.add.image(x, y, 'bread_roll').setScale(ART_SCALE * 1.15).setDepth(DEPTH.boss + 1);
  }
  get right(): number {
    return this.x + 30;
  }
  hazard(): Rect {
    return { x: this.x - 20, y: this.y - 14, w: 40, h: 28 };
  }
  barkTarget(): Rect {
    return { x: this.x - 24, y: this.y - 20, w: 48, h: 40 };
  }
  onBark(ctx: GameContext): void {
    this.alive = false;
    ctx.fx.puff(this.x, this.y, 4, 0.7);
  }
  onHeroHit(): void {
    this.alive = false;
  }
  update(dt: number, ctx: GameContext): void {
    if (!this.grounded) {
      this.vy += 1500 * dt;
      this.y += this.vy * dt;
      const floor = WORLD.groundY - 15;
      if (this.y >= floor) {
        this.y = floor;
        if (this.vy > 260) {
          this.vy = -this.vy * 0.35;
          Audio.play('nut_land');
        } else {
          this.vy = 0;
          this.grounded = true;
        }
      }
    }
    this.x += this.vx * dt;
    this.spin += (this.vx * dt) / 15;
    this.img.setPosition(this.x, this.y).setRotation(this.spin);
    if (this.x < ctx.cameraLeft - 120) this.alive = false;
  }
  destroy(): void {
    this.img.destroy();
  }
}

type Phase = 'enter' | 'drop' | 'swoopWarn' | 'swoop' | 'circle' | 'landing' | 'peck' | 'hitReact' | 'takeoff' | 'defeat' | 'done';

/**
 * Chapter-two finale: the Pigeon Captain. Each round he bombs the street with
 * bread rolls (jump them or bark them), swoops in at head height (duck), then
 * lands to peck the crumbs, which is the moment to bark him. Four barks win.
 */
export class PigeonBoss extends Entity implements Boss {
  phase: Phase = 'enter';
  hits = 0;
  readonly maxHits = PIGEON.hitsToWin;
  readonly title = 'THE PIGEON CAPTAIN';
  readonly icon = 'pigeon_peck';
  readonly speed = PIGEON.speed;
  onEvent?: (e: BossEvent) => void;
  private img: Phaser.GameObjects.Image;
  private bubble: Phaser.GameObjects.Image;
  private t = 0;
  private sx = 1500;
  private sy = 260;
  private fromX = 0;
  private fromY = 0;
  private round = 0;
  private dropped = 0;
  private dropT = 0;
  private swoops = 0;
  private worldX = 0;
  private flap = 0;
  private fall = { vx: 0, vy: 0, rot: 0 };

  constructor(private scene: Phaser.Scene) {
    super();
    this.img = scene.add.image(0, 0, 'pigeon_fly_up').setOrigin(0.5, 0.94).setScale(ART_SCALE * 1.05).setDepth(DEPTH.boss);
    this.bubble = scene.add.image(0, 0, 'fx_exclaim').setOrigin(0.5, 1).setScale(ART_SCALE * 1.2).setDepth(DEPTH.boss + 2).setVisible(false);
    Audio.play('whistle');
  }

  get right(): number {
    return Number.POSITIVE_INFINITY;
  }

  private go(p: Phase): void {
    this.phase = p;
    this.t = 0;
    this.fromX = this.sx;
    this.fromY = this.sy;
    this.bubble.setVisible(p === 'swoopWarn');
  }

  private get roundDef() {
    return PIGEON.rounds[Math.min(this.round, PIGEON.rounds.length - 1)];
  }

  hazard(): Rect | null {
    // Swooping at head height (duck!) or squatting on the floor pecking.
    if (this.phase === 'swoop') return { x: this.worldX - 50, y: WORLD.groundY - 70, w: 100, h: 40 };
    if (this.phase === 'peck' || this.phase === 'hitReact') return { x: this.worldX - 30, y: WORLD.groundY - 60, w: 60, h: 58 };
    return null;
  }

  barkTarget(): Rect | null {
    if (this.phase !== 'peck') return null;
    return { x: this.worldX - 50, y: WORLD.groundY - 90, w: 100, h: 90 };
  }

  onBark(ctx: GameContext): void {
    if (this.phase !== 'peck') return;
    this.hits++;
    Audio.play('boss_hit');
    for (let i = 0; i < 6; i++) ctx.fx.puff(this.worldX + (Math.random() - 0.5) * 60, WORLD.groundY - 50 - Math.random() * 40, 1, 0.8);
    ctx.fx.stars(this.worldX, WORLD.groundY - 80, 6);
    this.onEvent?.('hit');
    if (this.hits >= this.maxHits) {
      this.go('defeat');
      this.img.setTexture('pigeon_stunned');
      this.fall = { vx: 220, vy: -520, rot: 0 };
      Audio.play('boss_clear');
      this.onEvent?.('defeated');
    } else {
      this.go('hitReact');
      this.img.setTexture('pigeon_stunned');
    }
  }

  onHeroHit(): void {
    // A bump during the peck sends him flapping up early.
    if (this.phase === 'peck') this.go('takeoff');
  }

  update(dt: number, ctx: GameContext): void {
    this.t += dt;
    this.flap += dt;
    const P = PIGEON;
    const R = this.roundDef;
    const heroSx = ctx.heroX - ctx.cameraLeft;
    const ease = (k: number) => 1 - Math.pow(1 - Math.min(1, k), 3);
    const flying = this.phase !== 'peck' && this.phase !== 'hitReact' && this.phase !== 'defeat' && this.phase !== 'done';
    let rot = 0;
    switch (this.phase) {
      case 'enter':
        this.sx = Phaser.Math.Linear(1500, P.hoverX, ease(this.t / P.enterTime));
        this.sy = P.hoverHeight + Math.sin(this.t * 3) * 10;
        if (this.t >= P.enterTime) {
          this.onEvent?.('start');
          this.go('drop');
        }
        break;
      case 'drop': {
        // Flaps back and forth high above the street, lobbing rolls.
        this.sx = P.hoverX + Math.sin(this.t * 1.6) * 160;
        this.sy = P.hoverHeight + Math.sin(this.t * 4) * 12;
        this.dropT -= dt;
        if (this.dropped < R.rolls && this.dropT <= 0) {
          this.dropped++;
          this.dropT = R.rollGap;
          ctx.spawn(new BreadRoll(this.scene, ctx.cameraLeft + this.sx - 20, WORLD.groundY - this.sy + 20, P.rollSpeed));
          Audio.play('throw');
        }
        // Let the last roll go by before the swoop, so they never overlap.
        if (this.dropped >= R.rolls && this.dropT <= -P.swoopDelay) {
          this.dropped = 0;
          this.swoops = 0;
          this.go('swoopWarn');
          Audio.play('squirrel_angry');
        }
        break;
      }
      case 'swoopWarn': {
        // Rises to the right edge and drops to head height, screeching.
        const k = ease(this.t / P.swoopWarn);
        this.sx = Phaser.Math.Linear(this.fromX, P.swoopStartX, k);
        this.sy = Phaser.Math.Linear(this.fromY, P.swoopHeight, k);
        if (this.t >= P.swoopWarn) this.go('swoop');
        break;
      }
      case 'swoop':
        this.sx -= R.swoopSpeed * dt;
        this.sy = P.swoopHeight;
        rot = -0.1;
        if (this.sx < -160) {
          this.swoops++;
          this.sx = 1400;
          this.sy = P.hoverHeight + 60;
          if (this.swoops < R.swoops) {
            this.go('swoopWarn');
            Audio.play('squirrel_angry');
          } else this.go('circle');
        }
        break;
      case 'circle': {
        // Glides back in high, then spirals down to the crumbs.
        const k = ease(this.t / 1.0);
        this.sx = Phaser.Math.Linear(this.fromX, P.landX + 80, k);
        this.sy = Phaser.Math.Linear(this.fromY, P.hoverHeight, k);
        if (this.t >= 1.0) this.go('landing');
        break;
      }
      case 'landing': {
        const k = ease(this.t / 0.6);
        this.sx = Phaser.Math.Linear(this.fromX, Math.max(P.landX, heroSx + 230), k);
        this.sy = Phaser.Math.Linear(this.fromY, 0, k);
        if (this.t >= 0.6) {
          this.go('peck');
          Audio.play('squirrel');
        }
        break;
      }
      case 'peck':
        // The bark window: head bobbing for crumbs.
        this.sy = 0;
        rot = Math.sin(this.t * 14) * 0.08;
        if (this.t >= R.peckTime) this.go('takeoff');
        break;
      case 'hitReact':
        rot = Math.sin(this.t * 40) * 0.1;
        if (this.t >= 0.6) {
          this.round++;
          this.go('takeoff');
        }
        break;
      case 'takeoff': {
        const k = ease(this.t / 0.7);
        this.sx = Phaser.Math.Linear(this.fromX, P.hoverX, k);
        this.sy = Phaser.Math.Linear(this.fromY, P.hoverHeight, k);
        if (this.t >= 0.7) this.go('drop');
        break;
      }
      case 'defeat':
        // Tumbles, then flaps away dizzy.
        this.fall.vy += 900 * dt;
        this.sx += this.fall.vx * dt;
        this.sy = Math.max(0, this.sy - this.fall.vy * dt);
        this.fall.rot += dt * 8;
        rot = this.fall.rot;
        if (this.t > 1.8) {
          this.go('done');
          this.onEvent?.('done');
        }
        break;
      case 'done':
        this.sy += 120 * dt;
        this.sx += 260 * dt;
        break;
    }
    if (flying) {
      const tex = this.phase === 'swoop' ? 'pigeon_dive' : Math.floor(this.flap / 0.12) % 2 ? 'pigeon_fly_up' : 'pigeon_fly_down';
      if (this.img.texture.key !== tex) this.img.setTexture(tex);
      if (Math.random() < dt * 3) ctx.fx.puff(ctx.cameraLeft + this.sx + 30, WORLD.groundY - this.sy - 30, 1, 0.4);
    } else if (this.phase === 'peck' && this.img.texture.key !== 'pigeon_peck') this.img.setTexture('pigeon_peck');
    this.worldX = ctx.cameraLeft + this.sx;
    this.img.setPosition(this.worldX, WORLD.groundY - this.sy).setRotation(rot);
    this.bubble.setPosition(this.worldX - 30, WORLD.groundY - this.sy - 110);
  }

  destroy(): void {
    this.img.destroy();
    this.bubble.destroy();
  }
}
