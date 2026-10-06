import Phaser from 'phaser';
import { DEPTH, WORLD } from '../data/config';
import { SWARM } from '../data/encounters';
import { ART_SCALE } from '../systems/AssetRegistry';
import { Audio } from '../systems/AudioManager';
import type { Rect } from '../systems/PlayerController';
import { Acorn, Entity, type GameContext } from './World';

export type BossEvent = 'start' | 'hit' | 'defeated' | 'done';

/** What GameScene needs from any chapter finale. */
export interface Boss extends Entity {
  phase: string;
  hits: number;
  readonly maxHits: number;
  /** Shown on the boss bar. */
  readonly title: string;
  readonly icon: string;
  /** Constant run speed during the fight. */
  readonly speed: number;
  onEvent?: (e: BossEvent) => void;
}

type MinionState = 'enter' | 'idle' | 'aim' | 'chargeWarn' | 'charge' | 'perch' | 'glide' | 'dart' | 'taunt' | 'out';

/**
 * One of Nutso's minions in the swarm. Moves in screen space (relative to the
 * camera) so it stays in the fight while the street scrolls. Every attack has
 * a counter: jump the charge, duck the glide, jump or bark the nuts, and a bark
 * in range knocks it out of the fight at any time.
 */
class SwarmSquirrel extends Entity {
  private img: Phaser.GameObjects.Image;
  private bubble: Phaser.GameObjects.Image;
  state: MinionState = 'enter';
  private t = 0;
  private sx: number;
  private fromSx = 0;
  private toSx = 0;
  private moveTime = 0.5;
  private h = 0;
  private worldX = 0;
  private stateTime = 1;
  private vx = 0;
  private vy = 0;
  private spin = 0;

  constructor(scene: Phaser.Scene, private swarm: SquirrelSwarm, startSx: number) {
    super();
    this.sx = startSx;
    this.img = scene.add.image(0, WORLD.groundY, 'squirrel_run').setOrigin(0.5, 1).setScale(ART_SCALE).setDepth(DEPTH.enemy).setFlipX(true);
    this.bubble = scene.add.image(0, 0, 'fx_exclaim').setOrigin(0.5, 1).setScale(ART_SCALE).setDepth(DEPTH.enemy + 1).setVisible(false);
    this.moveIn(Phaser.Math.Between(SWARM.restMin, SWARM.restMax), 0.7);
  }

  get right(): number {
    return Number.POSITIVE_INFINITY;
  }

  private go(s: MinionState, time = 1): void {
    this.state = s;
    this.t = 0;
    this.stateTime = time;
    this.bubble.setVisible(s === 'aim' || s === 'chargeWarn' || s === 'perch');
    const tex: Partial<Record<MinionState, string>> = {
      enter: 'squirrel_run',
      idle: 'squirrel_idle',
      aim: 'squirrel_taunt',
      chargeWarn: 'squirrel_startled',
      charge: 'squirrel_run',
      perch: 'squirrel_taunt',
      glide: 'squirrel_run',
      dart: 'squirrel_run',
      taunt: 'squirrel_taunt',
      out: 'squirrel_startled',
    };
    this.img.setTexture(tex[s] ?? 'squirrel_idle');
    // The run pose is drawn facing right; everything heading left mirrors it.
    this.img.setFlipX(s === 'enter' || s === 'charge' || s === 'glide' || s === 'dart');
    this.img.setRotation(0);
  }

  private moveIn(target: number, time: number): void {
    this.go('enter', time);
    this.fromSx = this.sx;
    this.toSx = target;
    this.moveTime = time;
  }

  private get onScreenRect(): Rect {
    const top = WORLD.groundY - this.h;
    return { x: this.worldX - 18, y: top - 42, w: 36, h: 40 };
  }

  hazard(): Rect | null {
    if (this.state === 'out') return null;
    if (this.state === 'glide') return { x: this.worldX - 26, y: WORLD.groundY - 66, w: 52, h: 38 };
    if (this.h > 60) return null;
    return this.onScreenRect;
  }

  barkTarget(): Rect | null {
    if (this.state === 'out') return null;
    const r = this.onScreenRect;
    return { x: r.x - 8, y: r.y - 14, w: r.w + 16, h: r.h + 20 };
  }

  onBark(ctx: GameContext): void {
    this.knockOut(ctx);
  }

  onHeroHit(): void {
    // Bumped the hero: scamper back to a safe distance.
    if (this.state !== 'out') this.moveIn(Phaser.Math.Between(SWARM.restMin + 120, SWARM.restMax), 0.5);
    this.h = 0;
  }

  private knockOut(ctx: GameContext): void {
    if (this.state === 'out') return;
    this.go('out', 2);
    ctx.fx.puff(this.worldX, WORLD.groundY - this.h - 30, 6, 1);
    ctx.fx.stars(this.worldX, WORLD.groundY - this.h - 40, 5);
    Audio.play('retreat');
    this.vx = 540;
    this.vy = -680;
    this.spin = 11;
    this.swarm.knocked();
  }

  update(dt: number, ctx: GameContext): void {
    this.t += dt;
    const heroSx = ctx.heroX - ctx.cameraLeft;
    let jitter = 0;
    let hop = 0;
    switch (this.state) {
      case 'enter': {
        const k = Math.min(1, this.t / this.moveTime);
        this.sx = Phaser.Math.Linear(this.fromSx, this.toSx, 1 - Math.pow(1 - k, 3));
        hop = Math.abs(Math.sin(this.t * 16)) * 14;
        if (k >= 1) this.go('idle', Phaser.Math.FloatBetween(0.35, 0.8));
        break;
      }
      case 'idle':
        jitter = Math.sin(this.t * 47) * 2;
        hop = Math.abs(Math.sin(this.t * 9)) * 5;
        this.img.setFlipX(Math.sin(this.t * 13) > 0.5);
        if (this.t >= this.stateTime) this.chooseAttack(ctx);
        break;
      case 'aim':
        hop = Math.abs(Math.sin(this.t * 25)) * 4;
        if (this.t >= this.stateTime) {
          this.throwNut(ctx);
          this.img.setTexture('squirrel_throw');
          this.go('idle', Phaser.Math.FloatBetween(0.5, 0.9));
        }
        break;
      case 'chargeWarn':
        jitter = Math.sin(this.t * 60) * 3;
        if (this.t >= this.stateTime) {
          this.go('charge', 3);
          Audio.play('squirrel_angry');
        }
        break;
      case 'charge':
        // Sprints along the floor at the hero: jump it (or bark it first).
        this.sx -= SWARM.chargeSpeed * dt;
        hop = Math.abs(Math.sin(this.t * 22)) * 6;
        if (this.sx < -80) {
          this.sx = this.scene().scale.width + 80;
          this.moveIn(Phaser.Math.Between(SWARM.restMin, SWARM.restMax), 0.8);
        }
        break;
      case 'perch': {
        // Springs up high, chatters, then glides in at head height: duck!
        const k = Math.min(1, this.t / 0.35);
        this.h = 130 * Math.sin(k * Math.PI * 0.5);
        jitter = Math.sin(this.t * 40) * 2;
        if (this.t >= this.stateTime) {
          this.go('glide', 3);
          Audio.play('squirrel_angry');
        }
        break;
      }
      case 'glide':
        this.sx -= SWARM.glideSpeed * dt;
        this.h = Math.max(36, this.h - 260 * dt);
        this.img.setRotation(-0.15);
        if (this.sx < -80) {
          this.h = 0;
          this.sx = this.scene().scale.width + 80;
          this.moveIn(Phaser.Math.Between(SWARM.restMin, SWARM.restMax), 0.8);
        }
        break;
      case 'dart': {
        const k = Math.min(1, this.t / this.moveTime);
        this.sx = Phaser.Math.Linear(this.fromSx, this.toSx, 1 - Math.pow(1 - k, 3));
        hop = Math.sin(k * Math.PI) * 30;
        if (k >= 1) {
          this.go('taunt', Phaser.Math.FloatBetween(SWARM.tauntMin, SWARM.tauntMax));
          Audio.play('squirrel');
        }
        break;
      }
      case 'taunt':
        hop = Math.abs(Math.sin(this.t * 14)) * 7;
        this.img.setFlipX(Math.floor(this.t * 6) % 2 === 0);
        if (this.t >= this.stateTime) this.moveIn(Phaser.Math.Between(SWARM.restMin, SWARM.restMax), 0.45);
        break;
      case 'out':
        this.vy += 1600 * dt;
        this.sx += this.vx * dt;
        this.h -= this.vy * dt;
        this.img.rotation += this.spin * dt;
        if (this.h < -300 || this.sx > this.scene().scale.width + 200) {
          this.alive = false;
        }
        break;
    }
    // Never let a resting squirrel sit right on top of the hero.
    if (this.state === 'idle' || this.state === 'taunt') this.sx = Math.max(this.sx, heroSx + 150);
    this.worldX = ctx.cameraLeft + this.sx;
    const y = WORLD.groundY - this.h - hop;
    this.img.setPosition(this.worldX + jitter, y);
    this.bubble.setPosition(this.worldX - 6, y - 60).setScale(ART_SCALE * (1 + Math.sin(this.t * 20) * 0.1));
  }

  private scene(): Phaser.Scene {
    return this.img.scene;
  }

  private chooseAttack(ctx: GameContext): void {
    const r = Math.random();
    const w = SWARM.weights;
    if (r < w.lob) {
      this.go('aim', 0.55);
    } else if (r < w.lob + w.charge) {
      this.go('chargeWarn', SWARM.chargeWarn);
      Audio.play('squirrel');
    } else if (r < w.lob + w.charge + w.glide) {
      this.go('perch', SWARM.glideWarn);
      Audio.play('squirrel');
    } else {
      this.go('dart', 0.35);
      this.fromSx = this.sx;
      this.toSx = ctx.heroX - ctx.cameraLeft + Phaser.Math.Between(160, 220);
      this.moveTime = 0.35;
    }
  }

  private throwNut(ctx: GameContext): void {
    let target = -1;
    for (let i = 0; i < 6 && target < 0; i++) {
      const tx = Math.min(ctx.cameraRight - 60, ctx.heroX + Phaser.Math.Between(460, 760));
      if (ctx.isClearSpot(tx)) target = tx;
    }
    if (target < 0) return;
    ctx.spawn(new Acorn(ctx.scene, this.worldX - 20, WORLD.groundY - 40, 'lob', target));
    Audio.play('throw');
  }

  destroy(): void {
    this.img.destroy();
    this.bubble.destroy();
  }
}

/**
 * Chapter-one finale: Boss Nutso sends a swarm of ten minions. Two or three
 * pester the hero at a time; bark each one out of the fight.
 */
export class SquirrelSwarm extends Entity implements Boss {
  phase: 'enter' | 'fight' | 'defeat' | 'done' = 'enter';
  hits = 0;
  readonly maxHits = SWARM.size;
  readonly title = 'SQUIRREL SWARM';
  readonly icon = 'squirrel_taunt';
  readonly speed = SWARM.speed;
  onEvent?: (e: BossEvent) => void;
  private t = 0;
  private spawned = 0;
  private spawnT = 0;
  private minions: SwarmSquirrel[] = [];

  constructor(private scene: Phaser.Scene) {
    super();
    Audio.play('squirrel_angry');
  }

  get right(): number {
    return Number.POSITIVE_INFINITY;
  }

  knocked(): void {
    if (this.phase !== 'fight') return;
    this.hits++;
    Audio.play('boss_hit');
    this.onEvent?.('hit');
    if (this.hits >= this.maxHits) {
      this.phase = 'defeat';
      this.t = 0;
      Audio.play('boss_clear');
      this.onEvent?.('defeated');
    }
  }

  update(dt: number, ctx: GameContext): void {
    this.t += dt;
    this.minions = this.minions.filter((m) => m.alive);
    if (this.phase === 'enter') {
      if (this.t >= SWARM.enterTime) {
        this.phase = 'fight';
        this.t = 0;
        this.onEvent?.('start');
      }
      return;
    }
    if (this.phase === 'fight') {
      const active = this.minions.filter((m) => m.state !== 'out').length;
      const want = Math.min(this.hits < SWARM.rampAfter ? SWARM.activeEarly : SWARM.activeLate, this.maxHits - this.hits);
      this.spawnT -= dt;
      if (active < want && this.spawned < this.maxHits && this.spawnT <= 0) {
        const m = new SwarmSquirrel(this.scene, this, this.scene.scale.width + 60);
        this.minions.push(m);
        ctx.spawn(m);
        this.spawned++;
        this.spawnT = SWARM.spawnGap;
        Audio.play('squirrel');
      }
      // Replacements if a minion left the screen without being knocked out.
      if (this.spawned >= this.maxHits && active === 0 && this.hits < this.maxHits) this.spawned = this.hits;
      return;
    }
    if (this.phase === 'defeat' && this.t > 1.6) {
      this.phase = 'done';
      this.onEvent?.('done');
    }
  }

  destroy(): void {
    for (const m of this.minions) m.alive = false;
  }
}
