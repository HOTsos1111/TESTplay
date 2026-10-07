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
/** Page-turn length in ms. */
const TURN_MS = 560;
/** Caption panel: widest line, font size, line height and bottom edge. */
const CAPTION = { maxWidth: 720, size: 25, minSize: 21, padX: 26, padY: 16, bottom: 704 };
const PAPER = 0xfff6e3;

const slideKey = (i: number) => `story_${String(i + 1).padStart(2, '0')}`;

/**
 * Opening sequence: the 13 illustrated story pages over the title song. Back /
 * Next (or tap, Space and the arrow keys) turn the pages like a book; each page's
 * narration types itself in word by word, and multi-panel pages reveal their
 * panels left to right.
 */
export class StoryScene extends Phaser.Scene {
  private index = -1;
  /** Pages whose images loaded, in reading order (indices into STORY_SLIDES). */
  private order: number[] = [];
  private page: Phaser.GameObjects.Container | null = null;
  private caption: Phaser.GameObjects.Container | null = null;
  private turnShadow!: Phaser.GameObjects.Graphics;
  private turning: Phaser.Tweens.Tween | null = null;
  private covers: Phaser.GameObjects.Rectangle[] = [];
  private revealT = 0;
  private revealed = 0;
  private dots: Phaser.GameObjects.Arc[] = [];
  private back!: Button;
  private nextBtn!: Button;
  private playBtn!: Button;
  private skipBtn!: Button;
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
    this.caption = null;
    this.turning = null;
    this.ending = false;
    this.cameras.main.setBackgroundColor(CSS.outline);
    Audio.playMusic('title');
    centerMenu(this);

    const y = H - 52;
    this.back = new Button(this, 120, y, '◀ Back', () => this.go(this.index - 1), { width: 180, height: 64, fontSize: 26, color: 0x6f86a8 });
    this.nextBtn = new Button(this, W - 120, y, 'Next ▶', () => this.advance(), { width: 180, height: 64, fontSize: 28, color: COLOR.teal });
    this.skipBtn = new Button(this, W - 110, 48, 'Skip all ⏭', () => this.skipAll(), { width: 180, height: 56, fontSize: 22, color: COLOR.coral });
    // The last page is the title card: it holds there with a big PLAY button.
    this.playBtn = new Button(this, W - 132, y - 6, 'PLAY', () => this.finish(), { width: 220, height: 80, fontSize: 40, color: COLOR.coral, icon: 'ui_play', iconScale: 0.5 });
    for (const b of [this.back, this.nextBtn, this.skipBtn, this.playBtn]) b.setDepth(DEPTH.hud + 2);
    this.playBtn.setVisible(false);
    this.tweens.add({ targets: this.nextBtn, scale: 1.06, duration: 620, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.tweens.add({ targets: this.playBtn, scale: 1.08, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.turnShadow = this.add.graphics().setDepth(DEPTH.farBg + 3);

    if (!this.order.length) {
      this.finish();
      return;
    }

    // Page dots along the top.
    const n = this.order.length;
    const gap = 24;
    const dy = 40;
    const pill = this.add.graphics().setDepth(DEPTH.hud + 1);
    pill.fillStyle(COLOR.outline, 0.55).fillRoundedRect(640 - (n * gap) / 2 - 10, dy - 15, n * gap + 20, 30, 15);
    this.dots = this.order.map((_, i) => this.add.circle(640 - ((n - 1) * gap) / 2 + i * gap, dy, 6, COLOR.cream, 0.45).setDepth(DEPTH.hud + 2));

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

  /** A page: the outer container pivots on the left edge (the book's spine). */
  private buildPage(i: number, revealPanels: boolean): Phaser.GameObjects.Container {
    const slide = STORY_SLIDES[this.order[i]];
    const page = this.add.container(0, H / 2);
    const art = this.add.container(W / 2, 0);
    const img = this.add.image(0, 0, slideKey(this.order[i]));
    const cover = Math.max(W / img.width, H / img.height);
    img.setScale(cover);
    art.add(img);
    this.covers = [];
    this.revealed = 0;
    this.revealT = 0;
    if (revealPanels) {
      const splits = slide.panels ?? [];
      splits.forEach((s, k) => {
        const x0 = (s - 0.5) * img.width * cover;
        const x1 = ((splits[k + 1] ?? 1) - 0.5) * img.width * cover;
        const r = this.add.rectangle(x0, 0, x1 - x0 + 4, img.height * cover + 4, COLOR.outline, 0.92).setOrigin(0, 0.5);
        art.add(r);
        this.covers.push(r);
      });
    }
    page.add(art);
    // Gentle drift while the page is up.
    this.tweens.add({ targets: art, scale: 1.04, duration: 9000, ease: 'Sine.InOut' });
    return page;
  }

  private go(i: number): void {
    if (this.ending || i < 0 || i === this.index) return;
    if (i >= this.order.length) {
      this.finish();
      return;
    }
    // A fast reader finishes the previous turn instantly.
    this.turning?.complete();
    const first = this.index < 0;
    const forward = i > this.index;
    this.index = i;
    const slide = STORY_SLIDES[this.order[i]];
    const old = this.page;
    const page = this.buildPage(i, forward);
    this.page = page;

    if (first || !old) {
      page.setDepth(DEPTH.farBg + 1).setAlpha(0);
      this.tweens.add({ targets: page, alpha: 1, duration: 450, ease: 'Sine.Out' });
    } else if (forward) {
      // The old page lifts from its right edge and folds over to the left.
      page.setDepth(DEPTH.farBg + 1);
      old.setDepth(DEPTH.farBg + 2);
      const shade = this.add.rectangle(0, 0, W, H, 0x000000, 0).setOrigin(0, 0.5);
      old.add(shade);
      this.turning = this.turnTween(old, 1, 0, 'Sine.In', (k) => shade.setFillStyle(0x000000, (1 - k) * 0.4), () => old.destroy());
      Audio.play('page');
    } else {
      // Turning back: the earlier page swings in from the spine over the current one.
      page.setDepth(DEPTH.farBg + 2).setScale(0, 1);
      old.setDepth(DEPTH.farBg + 1);
      this.turning = this.turnTween(page, 0, 1, 'Sine.Out', () => undefined, () => old.destroy());
      Audio.play('page');
    }

    this.showCaption(slide.text, first ? 300 : TURN_MS * 0.6);
    const sfx = slide.sfx;
    if (sfx) this.time.delayedCall(first ? 250 : TURN_MS, () => Audio.play(sfx));

    this.dots.forEach((d, k) => d.setFillStyle(k === i ? COLOR.butter : COLOR.cream, k === i ? 1 : 0.45).setRadius(k === i ? 8 : 6));
    this.back.setAlpha(i === 0 ? 0.35 : 1);
    const last = i === this.order.length - 1;
    this.nextBtn.setVisible(!last);
    this.skipBtn.setVisible(!last);
    this.playBtn.setVisible(last);
  }

  /** Scales a page about the spine, with a soft shadow travelling along the fold. */
  private turnTween(
    target: Phaser.GameObjects.Container,
    from: number,
    to: number,
    ease: string,
    onStep: (k: number) => void,
    onDone: () => void,
  ): Phaser.Tweens.Tween {
    const g = this.turnShadow;
    const state = { k: from };
    const draw = (k: number) => {
      target.setScale(k, 1);
      onStep(k);
      g.clear();
      const x = W * k;
      const w = 18 + 90 * Math.sin(Math.PI * k);
      // Stepped strips rather than a gradient so it also draws in canvas mode.
      const steps = 8;
      for (let i = 0; i < steps; i++) {
        g.fillStyle(0x000000, 0.5 * (1 - i / steps));
        g.fillRect(x + (w * i) / steps, 0, w / steps + 1, H);
      }
      // A bright crease right on the fold.
      g.fillStyle(0xffffff, 0.35 * Math.sin(Math.PI * k));
      g.fillRect(x - 3, 0, 3, H);
    };
    draw(from);
    return this.tweens.add({
      targets: state,
      k: to,
      duration: TURN_MS,
      ease,
      onUpdate: () => draw(state.k),
      onComplete: () => {
        target.setScale(1, 1);
        g.clear();
        this.turning = null;
        onDone();
      },
    });
  }

  /** Lays out the narration word by word and animates it in; the old one drops away. */
  private showCaption(text: string, delay: number): void {
    const old = this.caption;
    if (old) {
      this.caption = null;
      this.tweens.add({ targets: old, y: old.y + 24, alpha: 0, duration: 200, ease: 'Sine.In', onComplete: () => old.destroy() });
    }
    // Shrink the type a little when a sentence would otherwise wrap awkwardly.
    const paras = text.split('\n');
    let size = CAPTION.size;
    for (; size > CAPTION.minSize; size--) {
      const probe = this.add.text(0, 0, '', textStyle(size, CSS.outline, 0));
      const fits = paras.every((p) => probe.setText(p).width <= CAPTION.maxWidth);
      probe.destroy();
      if (fits) break;
    }
    const lineH = Math.round(size * 1.32);
    const style = { ...textStyle(size, CSS.outline, 0), align: 'left' };
    const space = this.add.text(0, 0, ' ', style);
    const spaceW = space.width;
    space.destroy();

    // Flow words into centred lines, honouring explicit line breaks.
    const lines: { word: Phaser.GameObjects.Text; x: number }[][] = [];
    for (const para of paras) {
      let line: { word: Phaser.GameObjects.Text; x: number }[] = [];
      let x = 0;
      for (const w of para.split(' ')) {
        const word = this.add.text(0, 0, w, style).setOrigin(0, 0.5);
        if (line.length && x + spaceW + word.width > CAPTION.maxWidth) {
          lines.push(line);
          line = [];
          x = 0;
        }
        if (line.length) x += spaceW;
        line.push({ word, x });
        x += word.width;
      }
      lines.push(line);
    }
    const lineW = (l: { word: Phaser.GameObjects.Text; x: number }[]) => {
      const e = l[l.length - 1];
      return e.x + e.word.width;
    };
    const width = Math.max(...lines.map(lineW)) + CAPTION.padX * 2;
    const height = lines.length * lineH + CAPTION.padY * 2;

    const box = this.add.container(640, CAPTION.bottom - height / 2).setDepth(DEPTH.hud + 1);
    const panel = this.add.graphics();
    panel.fillStyle(COLOR.outline, 0.35).fillRoundedRect(-width / 2 + 4, -height / 2 + 6, width, height, 18);
    panel.fillStyle(PAPER, 0.96).fillRoundedRect(-width / 2, -height / 2, width, height, 18);
    panel.lineStyle(3, COLOR.outline, 1).strokeRoundedRect(-width / 2, -height / 2, width, height, 18);
    panel.lineStyle(2, COLOR.teal, 0.7).strokeRoundedRect(-width / 2 + 6, -height / 2 + 6, width - 12, height - 12, 13);
    box.add(panel);

    let n = 0;
    lines.forEach((l, row) => {
      const left = -lineW(l) / 2;
      const y = -height / 2 + CAPTION.padY + lineH * (row + 0.5);
      for (const { word, x } of l) {
        word.setPosition(left + x, y + 10).setAlpha(0);
        box.add(word);
        this.tweens.add({ targets: word, y, alpha: 1, duration: 260, delay: delay + 180 + n * 38, ease: 'Back.Out' });
        n++;
      }
    });
    // The panel itself pops up from the bottom edge.
    box.setScale(0.92, 0.6).setAlpha(0);
    this.tweens.add({ targets: box, scaleX: 1, scaleY: 1, alpha: 1, duration: 300, delay, ease: 'Back.Out' });
    this.caption = box;
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
