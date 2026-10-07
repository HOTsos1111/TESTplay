import Phaser from 'phaser';
import { DEPTH } from '../data/config';
import { STORY_SLIDES } from '../data/story';
import { Audio } from '../systems/AudioManager';
import { progress } from '../systems/ProgressStore';
import { Button } from '../ui/Button';
import { COLOR, CSS, textStyle } from '../ui/theme';
import { centerMenu } from '../ui/layout';

interface StoryData {
  next?: 'game' | 'settings' | 'map';
}

const W = 1280;
const H = 720;
/** Seconds between sub-panel reveals on the multi-panel pages. */
const REVEAL_GAP = 1.5;

const slideKey = (i: number) => `story_${String(i + 1).padStart(2, '0')}`;

/**
 * Opening sequence: the 13 illustrated story pages, one at a time over the
 * title music. The player steps through with Back / Next (or tap, Space and the
 * arrow keys); multi-panel pages reveal their panels left to right.
 */
export class StoryScene extends Phaser.Scene {
  private index = -1;
  /** Pages whose images loaded, in reading order (indices into STORY_SLIDES). */
  private order: number[] = [];
  private page: Phaser.GameObjects.Container | null = null;
  private covers: Phaser.GameObjects.Rectangle[] = [];
  private revealT = 0;
  private revealed = 0;
  private dots: Phaser.GameObjects.Arc[] = [];
  private back!: Button;
  private nextBtn!: Button;
  private playBtn!: Button;
  private skipBtn!: Button;
  private pill!: Phaser.GameObjects.Graphics;
  private next: 'game' | 'settings' | 'map' = 'map';
  private ending = false;

  constructor() {
    super('Story');
  }

  preload(): void {
    const bar = this.add.graphics();
    const label = this.add.text(640, 330, 'Loading story…', textStyle(30, CSS.cream)).setOrigin(0.5);
    this.load.on('progress', (k: number) => {
      bar.clear();
      bar.fillStyle(COLOR.outline, 1).fillRoundedRect(440, 370, 400, 22, 11);
      bar.fillStyle(COLOR.butter, 1).fillRoundedRect(444, 374, 392 * k, 14, 7);
    });
    this.load.once('complete', () => {
      bar.destroy();
      label.destroy();
    });
    STORY_SLIDES.forEach((s, i) => {
      if (!this.textures.exists(slideKey(i))) this.load.image(slideKey(i), s.file);
    });
  }

  create(data: StoryData): void {
    this.next = data.next ?? 'map';
    this.index = -1;
    this.order = STORY_SLIDES.map((_, i) => i).filter((i) => this.textures.exists(slideKey(i)));
    this.page = null;
    this.ending = false;
    this.cameras.main.setBackgroundColor(CSS.outline);
    Audio.playMusic('title');
    centerMenu(this);

    const y = H - 52;
    this.back = new Button(this, 120, y, '◀ Back', () => this.go(this.index - 1), { width: 180, height: 64, fontSize: 26, color: 0x6f86a8 });
    this.nextBtn = new Button(this, W - 130, y, 'Next ▶', () => this.advance(), { width: 200, height: 64, fontSize: 28, color: COLOR.teal });
    this.skipBtn = new Button(this, W - 110, 48, 'Skip all ⏭', () => this.skipAll(), { width: 180, height: 56, fontSize: 22, color: COLOR.coral });
    // The last page is the title card: it holds there with a big PLAY button.
    this.playBtn = new Button(this, 640, y - 6, 'PLAY', () => this.finish(), { width: 300, height: 84, fontSize: 44, color: COLOR.coral, icon: 'ui_play', iconScale: 0.55 });
    for (const b of [this.back, this.nextBtn, this.skipBtn, this.playBtn]) b.setDepth(DEPTH.hud + 2);
    this.playBtn.setVisible(false);
    this.tweens.add({ targets: this.nextBtn, scale: 1.06, duration: 620, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.tweens.add({ targets: this.playBtn, scale: 1.08, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    if (!this.order.length) {
      this.finish();
      return;
    }

    // Page dots.
    const n = this.order.length;
    const gap = 26;
    const pill = (this.pill = this.add.graphics().setDepth(DEPTH.hud + 1));
    pill.fillStyle(COLOR.outline, 0.55).fillRoundedRect(640 - (n * gap) / 2 - 10, y - 16, n * gap + 20, 32, 16);
    this.dots = this.order.map((_, i) => this.add.circle(640 - ((n - 1) * gap) / 2 + i * gap, y, 7, COLOR.cream, 0.45).setDepth(DEPTH.hud + 2));

    this.input.on('pointerdown', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (!over.length) this.advance();
    });
    const kb = this.input.keyboard;
    kb?.on('keydown-SPACE', () => this.advance());
    kb?.on('keydown-ENTER', () => this.advance());
    kb?.on('keydown-RIGHT', () => this.advance());
    kb?.on('keydown-LEFT', () => this.go(this.index - 1));
    kb?.on('keydown-ESC', () => this.finish());
    this.go(0);
  }

  /** Next reveals the rest of a multi-panel page first, then turns the page. */
  private advance(): void {
    if (this.ending) return;
    if (this.revealed < this.covers.length) {
      this.revealAll();
      return;
    }
    this.go(this.index + 1);
  }

  private go(i: number): void {
    if (this.ending || i < 0 || i === this.index) return;
    if (i >= this.order.length) {
      this.finish();
      return;
    }
    Audio.play('ui_select');
    const forward = i > this.index;
    this.index = i;
    const slide = STORY_SLIDES[this.order[i]];

    // Cross-fade (and drift a little) from the old page to the new one.
    const old = this.page;
    const page = this.add.container(640, 360).setDepth(DEPTH.farBg + 1);
    const img = this.add.image(0, 0, slideKey(this.order[i]));
    const cover = Math.max(W / img.width, H / img.height);
    img.setScale(cover);
    page.add(img);
    this.covers = [];
    this.revealed = 0;
    this.revealT = 0;
    const splits = slide.panels ?? [];
    // Going back shows the whole page at once; going forward reveals panel by panel.
    if (forward) {
      splits.forEach((s, k) => {
        const x0 = (s - 0.5) * img.width * cover;
        const x1 = ((splits[k + 1] ?? 1) - 0.5) * img.width * cover;
        const r = this.add.rectangle(x0, 0, x1 - x0 + 4, img.height * cover + 4, COLOR.outline, 0.92).setOrigin(0, 0.5);
        page.add(r);
        this.covers.push(r);
      });
    }
    page.setAlpha(0).setScale(1.0);
    this.tweens.add({ targets: page, alpha: 1, duration: 380, ease: 'Sine.Out', onComplete: () => old?.destroy() });
    this.tweens.add({ targets: page, scale: 1.04, duration: 9000, ease: 'Sine.InOut' });
    this.page = page;
    const sfx = slide.sfx;
    if (sfx) this.time.delayedCall(250, () => Audio.play(sfx));

    this.dots.forEach((d, k) => d.setFillStyle(k === i ? COLOR.butter : COLOR.cream, k === i ? 1 : 0.45).setRadius(k === i ? 9 : 7));
    this.back.setAlpha(i === 0 ? 0.35 : 1);
    const last = i === this.order.length - 1;
    this.nextBtn.setVisible(!last);
    this.skipBtn.setVisible(!last);
    this.playBtn.setVisible(last);
    this.pill.setVisible(!last);
    for (const d of this.dots) d.setVisible(!last);
  }

  private revealOne(): void {
    const c = this.covers[this.revealed++];
    if (!c) return;
    this.tweens.add({ targets: c, alpha: 0, duration: 420, ease: 'Sine.Out' });
    Audio.play('ui_select');
  }

  private revealAll(): void {
    while (this.revealed < this.covers.length) this.revealOne();
  }

  /** Straight to the level select, past the instructions too. */
  private skipAll(): void {
    if (this.ending) return;
    this.ending = true;
    progress.update((p) => (p.storySeen = true));
    this.scene.start(this.next === 'game' ? 'Game' : 'ChapterMap', this.next === 'game' ? { chapter: 1 } : undefined);
  }

  private finish(): void {
    if (this.ending) return;
    this.ending = true;
    progress.update((p) => (p.storySeen = true));
    Audio.play('ui_confirm');
    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.time.delayedCall(380, () => {
      if (this.next === 'settings') this.scene.start('Settings', { from: 'Title' });
      else this.scene.start('HowTo', { next: this.next === 'game' ? 'game' : 'map' });
    });
  }

  update(_t: number, dms: number): void {
    if (this.revealed >= this.covers.length) return;
    this.revealT += Math.min(dms / 1000, 0.1);
    // The first panel is never covered; the rest follow one by one.
    if (this.revealT >= REVEAL_GAP * (this.revealed + 1)) this.revealOne();
  }
}
