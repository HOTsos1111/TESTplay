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

interface StoryData {
  next?: 'game' | 'settings';
}

const PANEL_TIME = 3.4;

/**
 * Opening sequence (~20 s, skippable). Built from the same live rig and
 * props as gameplay, with live-text captions.
 */
export class StoryScene extends Phaser.Scene {
  private panel = -1;
  private t = 0;
  private layer!: Phaser.GameObjects.Container;
  private caption!: Phaser.GameObjects.Text;
  private hero: HeroView | null = null;
  private heroSpeed = 0;
  private heroGroundY = 600;
  private squirrel: Phaser.GameObjects.Image | null = null;
  private toy: Phaser.GameObjects.Image | null = null;
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
    bar.fillRect(0, 630, 1280, 90);
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
    this.layer.removeAll(true);
    this.hero?.destroy();
    this.hero = null;
    this.squirrel = null;
    this.toy = null;
    this.backdrop = null;
  }

  private addHero(x: number, y: number, scale = 1.2): HeroView {
    this.hero = new HeroView(this, x, y).setDepth(DEPTH.hero);
    this.hero.root.setScale(scale);
    this.heroGroundY = y;
    return this.hero;
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
    const L = this.layer;
    switch (this.panel) {
      case 0: {
        L.add(this.add.image(0, 0, 'story_garden').setOrigin(0).setScale(ART_SCALE));
        const h = this.addHero(520, 600);
        h.setMode('idle');
        this.toy = this.add.image(640, 588, 'toy').setScale(ART_SCALE).setDepth(DEPTH.hero + 1);
        Audio.play('squeak');
        break;
      }
      case 1: {
        L.add(this.add.image(0, 0, 'story_garden').setOrigin(0).setScale(ART_SCALE));
        const h = this.addHero(420, 600);
        h.setMode('play');
        this.squirrel = this.add.image(640, 452, 'squirrel_taunt').setOrigin(0.5, 1).setScale(ART_SCALE * 1.4).setDepth(DEPTH.enemy);
        this.toy = this.add.image(610, 400, 'toy').setScale(ART_SCALE).setDepth(DEPTH.enemy + 1).setRotation(-0.4);
        Audio.play('squirrel');
        break;
      }
      case 2: {
        L.add(this.add.image(0, 0, 'story_garden').setOrigin(0).setScale(ART_SCALE));
        L.add(this.add.image(1240, 640, 'story_truck_open').setOrigin(1, 1).setScale(ART_SCALE * 1.2));
        const h = this.addHero(100, 600);
        h.setMode('play');
        this.heroSpeed = 330;
        this.squirrel = this.add.image(380, 600, 'squirrel_run').setOrigin(0.5, 1).setScale(ART_SCALE * 1.2).setDepth(DEPTH.enemy);
        this.toy = this.add.image(380, 540, 'toy').setScale(ART_SCALE).setDepth(DEPTH.enemy + 1);
        break;
      }
      case 3: {
        this.cameras.main.setBackgroundColor('#1e1520');
        L.add(this.add.image(640, 620, 'story_truck_closed').setOrigin(0.5, 1).setScale(ART_SCALE * 1.6));
        L.add(this.add.text(380, 330, 'yip.', textStyle(40, CSS.cream)).setOrigin(0.5).setAlpha(0).setName('yip'));
        break;
      }
      case 4: {
        this.cameras.main.setBackgroundColor(CSS.outline);
        this.backdrop = new Backdrop(this, 0, 0, this.layer);
        L.add(this.add.image(1150, 640, 'story_truck_open').setOrigin(1, 1).setScale(ART_SCALE * 0.9));
        const h = this.addHero(700, 600, 0.75);
        h.setMode('idle');
        break;
      }
      case 5: {
        this.backdrop = new Backdrop(this, 0, 0, this.layer);
        const h = this.addHero(560, 600, 1.4);
        h.setMode('sniff');
        for (let i = 0; i < 6; i++) {
          const s = this.add.image(760 + i * 70, 440 - Math.sin(i * 0.8) * 30, 'scent').setScale(ART_SCALE * 1.4).setAlpha(0);
          L.add(s);
          this.tweens.add({ targets: s, alpha: 0.85, delay: 400 + i * 160, duration: 300 });
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
      else this.scene.start('Game', { chapter: 1 });
    });
  }

  update(_t: number, dms: number): void {
    const dt = Math.min(dms / 1000, 0.1);
    this.t += dt;
    if (!this.ending && this.t >= PANEL_TIME) this.advance();
    this.backdrop?.update(dt);
    if (this.hero) {
      if (this.heroSpeed > 0) {
        this.hero.root.x += this.heroSpeed * dt;
        if (this.hero.root.x > 1000) this.hero.root.setAlpha(Math.max(0, 1 - (this.hero.root.x - 1000) / 80));
      }
      this.hero.root.y = this.heroGroundY;
      this.hero.update(dt, { grounded: true, vy: 0, hovering: false, speed: this.heroSpeed, invulnerable: 0 });
    }
    if (this.panel === 0 && this.toy) {
      const s = 1 + Math.max(0, Math.sin(this.t * 6)) * 0.15;
      this.toy.setScale(ART_SCALE * s, ART_SCALE / s);
      if (Math.sin(this.t * 6) > 0.98 && Math.random() < 0.3) Audio.play('squeak');
    }
    if (this.panel === 1 && this.squirrel) {
      this.squirrel.y = 452 - Math.abs(Math.sin(this.t * 8)) * 8;
      this.toy!.y = this.squirrel.y - 52;
    }
    if (this.panel === 2 && this.squirrel) {
      this.squirrel.x += 380 * dt;
      this.squirrel.y = 600 - Math.abs(Math.sin(this.t * 12)) * 16;
      this.toy!.setPosition(this.squirrel.x - 10, this.squirrel.y - 50);
      if (this.squirrel.x > 1000) this.squirrel.setAlpha(Math.max(0, 1 - (this.squirrel.x - 1000) / 80));
      this.toy!.setAlpha(this.squirrel.alpha);
    }
    if (this.panel === 3) {
      const yip = this.layer.getByName('yip') as Phaser.GameObjects.Text | null;
      if (yip && this.t > 1.4 && yip.alpha === 0) {
        yip.setAlpha(1);
        Audio.play('bark');
        this.cameras.main.shake(120, 0.004);
      }
    }
  }
}
