import Phaser from 'phaser';
import { DEPTH } from '../data/config';
import { COPY, STORY_PANELS } from '../data/copy';
import { HeroView } from '../entities/HeroView';
import { ART_SCALE } from '../systems/AssetRegistry';
import { Audio } from '../systems/AudioManager';
import { progress } from '../systems/ProgressStore';
import { Backdrop } from '../ui/Backdrop';
import { Button } from '../ui/Button';
import { COLOR, CSS, textStyle } from '../ui/theme';
import { centerMenu } from '../ui/layout';

interface StoryData {
  next?: 'game' | 'settings';
}

const PANEL_TIME = 3.6;
const GROUND = 604;
const BOSS_SCALE = ART_SCALE * 1.05;

interface Bobber {
  img: Phaser.GameObjects.Image;
  baseY: number;
  phase: number;
  amp: number;
}

/**
 * Opening sequence (~29 s, skippable): Boss Nutso steals the hero's toy from
 * his nap, rides off on a delivery van and the hero follows him into the city.
 * Built from the same live rig and props as gameplay, with live-text captions.
 */
export class StoryScene extends Phaser.Scene {
  private panel = -1;
  private t = 0;
  private layer!: Phaser.GameObjects.Container;
  private caption!: Phaser.GameObjects.Text;
  private hero: HeroView | null = null;
  private heroSpeed = 0;
  private heroGroundY = 600;
  private boss: Phaser.GameObjects.Image | null = null;
  private toy: Phaser.GameObjects.Image | null = null;
  private van: Phaser.GameObjects.Image | null = null;
  private bobbers: Bobber[] = [];
  private zT = 0;
  private flags = new Set<string>();
  private backdrop: Backdrop | null = null;
  private next: 'game' | 'settings' = 'game';
  private ending = false;

  constructor() {
    super('Story');
  }

  create(data: StoryData): void {
    this.next = data.next ?? 'game';
    this.panel = -1;
    this.t = 0;
    this.ending = false;
    Audio.playMusic('title');
    this.layer = this.add.container(0, 0);
    const bar = this.add.graphics().setDepth(DEPTH.hud);
    bar.fillStyle(COLOR.outline, 0.82);
    bar.fillRect(-400, 630, 2080, 90);
    centerMenu(this);
    this.caption = this.add.text(640, 675, '', textStyle(32, CSS.white)).setOrigin(0.5).setDepth(DEPTH.hud + 1);
    new Button(this, 1170, 50, 'Skip ▶', () => this.finish(), { width: 160, height: 56, fontSize: 24, color: 0x6f86a8 }).setDepth(DEPTH.hud + 2);
    this.add.text(20, 20, 'Tap or press Space to continue', textStyle(18, CSS.cream, 4)).setDepth(DEPTH.hud + 2);

    this.input.on('pointerdown', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (!over.length) this.advance();
    });
    this.input.keyboard?.on('keydown-SPACE', () => this.advance());
    this.input.keyboard?.on('keydown-ENTER', () => this.advance());
    this.input.keyboard?.on('keydown-ESC', () => this.finish());
    this.advance();
  }

  private clearPanel(): void {
    this.tweens.killAll();
    this.layer.removeAll(true);
    this.hero?.destroy();
    this.hero = null;
    this.boss = null;
    this.toy = null;
    this.van = null;
    this.bobbers = [];
    this.flags.clear();
    this.backdrop = null;
    this.cameras.main.setBackgroundColor(CSS.outline);
  }

  private addHero(x: number, y: number, scale = 1.2): HeroView {
    this.hero = new HeroView(this, x, y).setDepth(DEPTH.hero);
    this.hero.root.setScale(scale);
    this.heroGroundY = y;
    return this.hero;
  }

  private img(x: number, y: number, key: string, scale = ART_SCALE, depth: number = DEPTH.enemy): Phaser.GameObjects.Image {
    const i = this.add.image(x, y, key).setOrigin(0.5, 1).setScale(scale).setDepth(depth);
    this.layer.add(i);
    return i;
  }

  private addBoss(x: number, pose: string, faceRight: boolean, y = GROUND + 8): Phaser.GameObjects.Image {
    this.boss = this.img(x, y, `boss_${pose}`, BOSS_SCALE, DEPTH.enemy).setFlipX(faceRight);
    return this.boss;
  }

  private addMinion(x: number, y: number, pose: string, faceRight: boolean, delay = 0): Phaser.GameObjects.Image {
    const m = this.img(x, y, `squirrel_${pose}`, ART_SCALE * 1.15).setFlipX(faceRight);
    this.bobbers.push({ img: m, baseY: y, phase: Math.random() * 6, amp: 6 });
    if (delay >= 0) {
      m.setScale(0);
      this.tweens.add({ targets: m, scale: ART_SCALE * 1.15, delay, duration: 260, ease: 'Back.Out', onStart: () => Audio.play('squirrel') });
    }
    return m;
  }

  private garden(): void {
    this.layer.add(this.add.image(0, 0, 'story_garden').setOrigin(0).setScale(ART_SCALE).setDepth(DEPTH.farBg));
  }

  private sleepingHero(withToy: boolean): void {
    this.img(745, 616, 'story_dogbed', ART_SCALE * 1.35, DEPTH.hero - 1);
    const h = this.addHero(720, 606, 1.15);
    h.setMode('sleep');
    if (withToy) this.toy = this.img(870, 606, 'toy', ART_SCALE * 1.2, DEPTH.hero + 1).setRotation(0.15);
  }

  private advance(): void {
    if (this.ending) return;
    this.panel++;
    this.t = 0;
    if (this.panel >= STORY_PANELS.length) {
      this.finish();
      return;
    }
    this.clearPanel();
    this.caption.setText(STORY_PANELS[this.panel]);
    this.caption.setAlpha(0);
    this.tweens.add({ targets: this.caption, alpha: 1, duration: 300 });
    this.heroSpeed = 0;
    this.zT = 0;
    switch (this.panel) {
      case 0: {
        // Nap time.
        this.garden();
        this.sleepingHero(true);
        Audio.play('squeak');
        break;
      }
      case 1: {
        // Something creeps in over the fence.
        this.garden();
        this.sleepingHero(true);
        this.addBoss(-140, 'sneak', true);
        break;
      }
      case 2: {
        // Boss Nutso grabs the toy; his minions cheer from the fence.
        this.garden();
        this.sleepingHero(true);
        this.addBoss(600, 'sneak', true);
        this.addMinion(300, 486, 'taunt', true, 700);
        this.addMinion(440, 486, 'idle', true, 950);
        break;
      }
      case 3: {
        // SNATCH: he bolts, the hero wakes up.
        this.garden();
        this.img(745, 616, 'story_dogbed', ART_SCALE * 1.35, DEPTH.hero - 1);
        const h = this.addHero(720, 606, 1.15);
        h.setMode('sleep');
        this.addBoss(860, 'run', true);
        this.addMinion(300, 486, 'taunt', true, -1);
        this.addMinion(440, 486, 'idle', true, -1);
        Audio.play('squeak');
        break;
      }
      case 4: {
        // The van: Nutso bounds onto the roof, the hero dives in the back.
        this.garden();
        this.van = this.img(1250, 650, 'story_truck_open', ART_SCALE * 1.1, DEPTH.enemy - 1).setOrigin(1, 1);
        this.addBoss(200, 'run', true);
        const h = this.addHero(-60, 604, 1.0);
        h.setMode('play');
        this.heroSpeed = 330;
        break;
      }
      case 5: {
        // Doors shut, the van drives off with Nutso riding on top.
        this.backdrop = new Backdrop(this, 0.1, 520, this.layer);
        this.van = this.img(640, 650, 'story_truck_closed', ART_SCALE * 1.2, DEPTH.enemy - 1);
        this.addBoss(560, 'flex', false, 322);
        this.boss!.setScale(BOSS_SCALE * 0.75);
        this.layer.add(this.add.text(440, 420, 'yip.', textStyle(40, CSS.cream)).setOrigin(0.5).setAlpha(0).setName('yip').setDepth(DEPTH.hud - 1));
        Audio.play('boss_hit');
        break;
      }
      case 6: {
        // The depot: lost, and surrounded by minions.
        this.backdrop = new Backdrop(this, 0.25, 0, this.layer);
        const h = this.addHero(640, 600, 0.95);
        h.setMode('startled');
        this.addMinion(220, 604, 'taunt', true, 300);
        this.addMinion(400, 604, 'idle', true, 650);
        this.addMinion(880, 604, 'taunt', false, 1000);
        this.addMinion(1060, 604, 'throw', false, 1300);
        this.addMinion(1200, 604, 'idle', false, 1600);
        break;
      }
      case 7: {
        // Nose to the ground: follow the scent.
        this.backdrop = new Backdrop(this, 0, 0, this.layer);
        const h = this.addHero(560, 600, 1.4);
        h.setMode('sniff');
        for (let i = 0; i < 6; i++) {
          const sc = this.add.image(760 + i * 70, 440 - Math.sin(i * 0.8) * 30, 'scent').setScale(ART_SCALE * 1.4).setAlpha(0);
          this.layer.add(sc);
          this.tweens.add({ targets: sc, alpha: 0.85, delay: 400 + i * 160, duration: 300 });
        }
        break;
      }
    }
  }

  private finish(): void {
    if (this.ending) return;
    this.ending = true;
    progress.update((p) => (p.storySeen = true));
    this.clearPanel();
    this.cameras.main.setBackgroundColor(CSS.outline);
    this.caption.setText('');
    const tag = this.add.text(640, 340, COPY.tagline, textStyle(44, CSS.butter, 8)).setOrigin(0.5).setAlpha(0).setDepth(DEPTH.hud + 3);
    this.tweens.add({ targets: tag, alpha: 1, duration: 400 });
    this.time.delayedCall(1700, () => {
      if (this.next === 'settings') this.scene.start('Settings', { from: 'Title' });
      else this.scene.start('HowTo', { next: 'game' });
    });
  }

  /** Fires a one-off beat inside a panel once its time is reached. */
  private at(time: number, key: string, fn: () => void): void {
    if (this.t >= time && !this.flags.has(key)) {
      this.flags.add(key);
      fn();
    }
  }

  private zzz(dt: number, x: number, y: number): void {
    this.zT -= dt;
    if (this.zT > 0) return;
    this.zT = 0.75;
    const z = this.add.text(x, y, 'z', textStyle(26, CSS.white, 5)).setOrigin(0.5).setDepth(DEPTH.hud - 1);
    this.layer.add(z);
    this.tweens.add({ targets: z, x: x + 40, y: y - 90, alpha: 0, scale: 1.6, duration: 1800, onComplete: () => z.destroy() });
  }

  update(_t: number, dms: number): void {
    const dt = Math.min(dms / 1000, 0.1);
    this.t += dt;
    if (!this.ending && this.t >= PANEL_TIME) this.advance();
    this.backdrop?.update(dt);
    for (const b of this.bobbers) b.img.y = b.baseY - Math.abs(Math.sin(this.t * 7 + b.phase)) * b.amp;
    const boss = this.boss;
    switch (this.panel) {
      case 0:
        this.zzz(dt, 850, 520);
        if (this.toy && Math.sin(this.t * 2.2) > 0.995) Audio.play('squeak');
        break;
      case 1:
        this.zzz(dt, 850, 520);
        if (boss) {
          // Tiptoe: slow steps with a sneaky bob.
          boss.x = Math.min(560, boss.x + 190 * dt);
          boss.y = GROUND + 8 - Math.abs(Math.sin(this.t * 5)) * 10;
        }
        break;
      case 2:
        if (this.t < 0.7) this.zzz(dt, 850, 520);
        this.at(0.6, 'grab', () => {
          boss?.setTexture('boss_grab');
          this.toy?.destroy();
          this.toy = null;
          Audio.play('squeak');
          Audio.play('squirrel_angry');
          this.cameras.main.shake(120, 0.004);
        });
        if (boss && this.t > 0.6) boss.y = GROUND + 8 - Math.abs(Math.sin(this.t * 4)) * 6;
        if (this.t > 0.7) this.zzz(dt, 850, 520);
        break;
      case 3:
        if (boss) {
          boss.x += 560 * dt;
          boss.y = GROUND + 8 - Math.abs(Math.sin(this.t * 12)) * 16;
        }
        this.at(0.45, 'wake', () => {
          this.hero?.setMode('startled');
          Audio.play('bark');
        });
        this.at(1.2, 'chase', () => {
          this.hero?.setMode('play');
          this.heroSpeed = 380;
        });
        break;
      case 4: {
        if (boss && this.van) {
          // Run up, then a big arcing leap onto the van roof, then flex.
          const roofY = this.van.y - this.van.displayHeight + 26;
          if (this.t < 0.75) {
            boss.x += 560 * dt;
            boss.y = GROUND + 8 - Math.abs(Math.sin(this.t * 12)) * 14;
          } else if (this.t < 1.35) {
            const k = (this.t - 0.75) / 0.6;
            boss.x = 620 + 330 * k;
            boss.y = Phaser.Math.Linear(GROUND + 8, roofY, k) - Math.sin(k * Math.PI) * 140;
          } else {
            this.at(1.35, 'roof', () => {
              boss.setTexture('boss_flex').setFlipX(false);
              Audio.play('squirrel_angry');
              this.cameras.main.shake(140, 0.005);
            });
            boss.x = 950;
            boss.y = roofY - Math.abs(Math.sin(this.t * 5)) * 6;
          }
        }
        // The hero dives into the open doors.
        const h = this.hero;
        if (h && h.root.x > 680) {
          this.at(0, 'dive', () => {
            this.heroSpeed = 140;
            Audio.play('jump');
            this.tweens.add({ targets: h.root, alpha: 0, scale: 0.6, duration: 380 });
          });
          this.heroGroundY = Math.max(570, this.heroGroundY - 120 * dt);
        }
        break;
      }
      case 5: {
        if (this.van) this.van.y = 650 - Math.abs(Math.sin(this.t * 9)) * 3;
        if (boss) boss.y = 322 - Math.abs(Math.sin(this.t * 9)) * 3 - Math.abs(Math.sin(this.t * 4)) * 5;
        const yip = this.layer.getByName('yip') as Phaser.GameObjects.Text | null;
        this.at(1.4, 'yip', () => {
          yip?.setAlpha(1);
          Audio.play('bark');
          this.cameras.main.shake(120, 0.004);
        });
        break;
      }
      case 6:
        this.at(1.0, 'look', () => this.hero?.setMode('idle'));
        break;
    }
    if (this.hero) {
      if (this.heroSpeed > 0) this.hero.root.x += this.heroSpeed * dt;
      this.hero.root.y = this.heroGroundY;
      this.hero.update(dt, { grounded: true, vy: 0, hovering: false, speed: this.heroSpeed || 320, invulnerable: 0 });
    }
  }
}
