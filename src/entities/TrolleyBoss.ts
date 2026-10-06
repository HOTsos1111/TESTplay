import Phaser from 'phaser';
import { DEPTH, WORLD } from '../data/config';
import { TROLLEY } from '../data/encounters';
import { ART_SCALE } from '../systems/AssetRegistry';
import { Audio } from '../systems/AudioManager';
import type { Rect } from '../systems/PlayerController';
import { Entity, Parcel, type GameContext } from './World';
import type { Boss } from './SquirrelSwarm';

type Phase = 'enter' | 'warn' | 'throw' | 'clear' | 'lungeWarn' | 'lunge' | 'window' | 'hitReact' | 'retreat' | 'defeat' | 'done';

/**
 * Chapter-one encounter: the dogcatcher pushes a capture trolley that kicks
 * out rolling parcels, then lunges and briefly exposes its latch. Three barks
 * on the latch during those windows wreck the trolley. Pure slapstick: his
 * own machine defeats him.
 */
export class TrolleyBoss extends Entity implements Boss {
  readonly maxHits = TROLLEY.hitsToWin;
  readonly title = 'THE DOGCATCHER';
  readonly icon = 'dogcatcher_walk';
  readonly speed = TROLLEY.speed;
  private c: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Image;
  private wheels: Phaser.GameObjects.Image[];
  private latch: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Graphics;
  private door: Phaser.GameObjects.Image;
  private catcher: Phaser.GameObjects.Image;
  private bubble: Phaser.GameObjects.Image;

  phase: Phase = 'enter';
  private t = 0;
  private screenX: number = 1500;
  private fromX = 1500;
  private round = 0;
  private launched = 0;
  private launchT = 0;
  hits = 0;
  private lungeTarget: number = TROLLEY.lungeScreenX;
  private worldX = 0;
  private shake = 0;
  private catcherFall = { x: 0, y: 0, vx: 0, vy: 0, rot: 0 };
  private parts: { obj: Phaser.GameObjects.Image; vx: number; vy: number; spin: number }[] = [];
  /** Notifies the scene of milestones (hint display, victory). */
  onEvent?: (e: 'start' | 'hit' | 'defeated' | 'done') => void;

  constructor(private scene: Phaser.Scene) {
    super();
    this.c = scene.add.container(0, WORLD.groundY).setDepth(DEPTH.boss);
    this.catcher = scene.add.image(360, 0, 'dogcatcher_walk').setOrigin(0.53, 0.985).setScale(ART_SCALE);
    this.body = scene.add.image(0, -204, 'trolley_body').setOrigin(0, 0).setScale(ART_SCALE);
    this.door = scene.add.image(10, -172, 'trolley_door').setOrigin(0, 0).setScale(ART_SCALE);
    this.wheels = [70, 230].map((x) => scene.add.image(x, -28, 'trolley_wheel').setScale(ART_SCALE));
    this.glow = scene.add.graphics();
    this.latch = scene.add.image(20, -112, 'trolley_latch_intact').setScale(ART_SCALE);
    this.bubble = scene.add.image(150, -230, 'fx_exclaim').setOrigin(0.5, 1).setScale(ART_SCALE).setVisible(false);
    this.c.add([this.catcher, this.body, this.door, ...this.wheels, this.glow, this.latch, this.bubble]);
    Audio.play('whistle');
  }

  get right(): number {
    return Number.POSITIVE_INFINITY;
  }

  private go(p: Phase): void {
    this.phase = p;
    this.t = 0;
    this.fromX = this.screenX;
  }

  private get exposed(): boolean {
    return this.phase === 'window';
  }

  barkTarget(): Rect | null {
    if (!this.exposed) return null;
    return { x: this.worldX + 20 - 30, y: WORLD.groundY - 112 - 32, w: 60, h: 64 };
  }

  onBark(ctx: GameContext): void {
    if (!this.exposed) return;
    this.hits++;
    Audio.play('boss_hit');
    ctx.fx.stars(this.worldX + 20, WORLD.groundY - 112, 7);
    this.shake = 0.4;
    this.latch.setTexture(this.hits >= TROLLEY.hitsToWin ? 'trolley_latch_broken' : 'trolley_latch_damaged');
    this.catcher.setTexture('dogcatcher_frustrated');
    this.onEvent?.('hit');
    if (this.hits >= TROLLEY.hitsToWin) this.startDefeat(ctx);
    else this.go('hitReact');
  }

  private startDefeat(ctx: GameContext): void {
    this.go('defeat');
    Audio.play('box_break');
    ctx.fx.puff(this.worldX + 150, WORLD.groundY - 100, 10, 1.6);
    // Scatter the trolley's loose parts.
    const fling = (obj: Phaser.GameObjects.Image, vx: number, vy: number, spin: number) => this.parts.push({ obj, vx, vy, spin });
    fling(this.latch, -160, -520, -9);
    fling(this.door, -220, -380, -5);
    fling(this.wheels[0], 260, -300, 12);
    fling(this.wheels[1], 420, -260, 14);
    this.catcher.setTexture('dogcatcher_tumble');
    this.catcherFall = { x: this.catcher.x, y: 0, vx: 260, vy: -560, rot: 0 };
    this.onEvent?.('defeated');
  }

  update(dt: number, ctx: GameContext): void {
    this.t += dt;
    const R = TROLLEY;
    const ease = (k: number) => 1 - Math.pow(1 - Math.min(1, k), 3);
    switch (this.phase) {
      case 'enter':
        this.screenX = Phaser.Math.Linear(1500, R.restScreenX, ease(this.t / R.enterTime));
        if (this.t >= R.enterTime) {
          this.onEvent?.('start');
          this.go('warn');
        }
        break;
      case 'warn':
        if (this.t < dt * 1.5) {
          Audio.play('whistle');
          this.catcher.setTexture('dogcatcher_windup');
          this.bubble.setVisible(true);
        }
        this.shake = 0.05;
        this.bubble.setScale(ART_SCALE * (1 + Math.sin(this.t * 14) * 0.08));
        if (this.t >= R.warnTime) {
          this.bubble.setVisible(false);
          this.catcher.setTexture('dogcatcher_walk');
          this.launched = 0;
          this.launchT = 0;
          this.go('throw');
        }
        break;
      case 'throw': {
        const round = R.rounds[Math.min(this.round, R.rounds.length - 1)];
        this.launchT -= dt;
        if (this.launchT <= 0 && this.launched < round.parcels.length) {
          ctx.spawn(new Parcel(this.scene, this.worldX - 34, round.parcels[this.launched] === 'big', R.parcelSpeed));
          Audio.play('parcel');
          this.shake = 0.15;
          this.launched++;
          this.launchT = round.interval;
        }
        if (this.launched >= round.parcels.length && this.launchT <= 0) this.go('clear');
        break;
      }
      case 'clear':
        // Give the last parcel time to roll past before the lunge.
        if (this.t >= 0.9) this.go('lungeWarn');
        break;
      case 'lungeWarn':
        this.screenX = this.fromX + Math.sin(Math.min(1, this.t / R.lungeWarnTime) * Math.PI) * 30;
        this.shake = 0.08;
        if (this.t >= R.lungeWarnTime) {
          Audio.play('whistle');
          // Lunge to just inside bark reach of wherever the hero is pacing.
          const heroScreen = ctx.heroX - ctx.cameraLeft;
          this.lungeTarget = Phaser.Math.Clamp(heroScreen + (R.lungeScreenX - 320), 420, R.restScreenX - 80);
          this.go('lunge');
        }
        break;
      case 'lunge':
        this.screenX = Phaser.Math.Linear(this.fromX, this.lungeTarget, ease(this.t / R.lungeTime));
        if (this.t >= R.lungeTime) this.go('window');
        break;
      case 'window':
        if (Math.random() < dt * 10) ctx.fx.sparkle(this.worldX + 20 + (Math.random() - 0.5) * 40, WORLD.groundY - 112 + (Math.random() - 0.5) * 40, 1);
        if (this.t >= R.windowTime) this.go('retreat');
        break;
      case 'hitReact':
        if (this.t >= R.hitReactTime) {
          this.round++;
          this.go('retreat');
        }
        break;
      case 'retreat':
        this.screenX = Phaser.Math.Linear(this.fromX, R.restScreenX, ease(this.t / R.retreatTime));
        if (this.t >= R.retreatTime) {
          this.catcher.setTexture('dogcatcher_walk');
          this.go('warn');
        }
        break;
      case 'defeat': {
        // Trolley rolls to a halt, catcher tumbles backwards out of frame.
        this.screenX += (60 - this.t * 80) * dt;
        const f = this.catcherFall;
        f.vy += 1500 * dt;
        f.x += f.vx * dt;
        f.y = Math.min(0, f.y + f.vy * dt);
        if (f.y === 0 && f.vy > 0) {
          f.vy = f.vy > 300 ? -f.vy * 0.35 : 0;
          f.vx *= 0.7;
        }
        f.rot = Math.min(Math.PI / 2, f.rot + dt * 4);
        this.catcher.setPosition(f.x, f.y).setRotation(f.rot);
        for (const p of this.parts) {
          p.vy += 1500 * dt;
          p.obj.x += p.vx * dt;
          p.obj.y = Math.min(-10, p.obj.y + p.vy * dt);
          p.obj.rotation += p.spin * dt;
        }
        this.body.rotation = Math.min(0.12, this.t * 0.3);
        if (this.t >= 2.6) {
          this.go('done');
          this.onEvent?.('done');
        }
        break;
      }
      case 'done':
        break;
    }

    // Wheels roll with motion; latch glow pulses while exposed.
    if (this.phase !== 'defeat' && this.phase !== 'done') {
      for (const w of this.wheels) w.rotation += dt * 7;
    }
    this.glow.clear();
    if (this.exposed) {
      const pulse = 0.5 + Math.sin(this.t * 16) * 0.5;
      this.glow.fillStyle(0xffd66e, 0.35 + pulse * 0.35);
      this.glow.fillCircle(20, -112, 30 + pulse * 6);
      this.glow.lineStyle(4, 0xfffdf6, 0.9);
      this.glow.strokeCircle(20, -112, 34 + pulse * 6);
      this.latch.setScale(ART_SCALE * (1.1 + pulse * 0.1));
    } else if (this.phase !== 'defeat') {
      this.latch.setScale(ART_SCALE);
    }

    this.shake = Math.max(0, this.shake - dt);
    const jitter = this.shake > 0 ? Math.sin(this.t * 90) * 3 : 0;
    this.worldX = ctx.cameraLeft + this.screenX;
    this.c.setPosition(this.worldX + jitter, WORLD.groundY);
    if (this.phase !== 'defeat' && this.phase !== 'done') {
      this.catcher.y = -Math.abs(Math.sin(this.t * 9)) * 4;
    }
  }

  destroy(): void {
    this.c.destroy();
  }
}
