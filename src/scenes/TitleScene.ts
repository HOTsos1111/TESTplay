import Phaser from 'phaser';
import { DEPTH } from '../data/config';
import { COPY } from '../data/copy';
import { HeroView } from '../entities/HeroView';
import { ART_SCALE } from '../systems/AssetRegistry';
import { Audio } from '../systems/AudioManager';
import { progress } from '../systems/ProgressStore';
import { Backdrop } from '../ui/Backdrop';
import { Button, MenuNav } from '../ui/Button';
import { COLOR, CSS, textStyle } from '../ui/theme';
import { centerMenu } from '../ui/layout';
import { fullscreenAllowed, isFullscreen, isInstalledApp, NOT_ALLOWED_MSG, toggleFullscreen } from '../ui/fullscreen';

/**
 * Title screen in the style of the character sheets: the hand-drawn logo, a
 * cream menu card with chunky buttons, and the cast on stage over the depot.
 */
export class TitleScene extends Phaser.Scene {
  private backdrop!: Backdrop;
  private hero!: HeroView;
  private bobbers: { o: Phaser.GameObjects.Image; y: number; p: number; a: number; s: number }[] = [];
  private t = 0;
  constructor() {
    super('Title');
  }

  create(): void {
    this.t = 0;
    this.bobbers = [];
    this.backdrop = new Backdrop(this, 0, 26);
    Audio.playMusic('title');
    const D = DEPTH.hud;

    // Soft vignette: darker top for the logo, warm glow behind the menu card.
    const shade = this.add.graphics().setDepth(D - 2);
    shade.fillGradientStyle(COLOR.outline, COLOR.outline, COLOR.outline, COLOR.outline, 0.55, 0.55, 0, 0);
    shade.fillRect(-400, 0, 2080, 260);
    shade.fillGradientStyle(COLOR.outline, COLOR.outline, COLOR.outline, COLOR.outline, 0, 0, 0.45, 0.45);
    shade.fillRect(-400, 560, 2080, 160);
    centerMenu(this);

    // Logo with a pop-in and gentle breathing.
    const logo = this.add.image(640, 112, 'logo').setDepth(D + 2).setScale(0);
    const logoScale = Math.min(1, 900 / logo.width);
    this.tweens.add({
      targets: logo,
      scale: logoScale,
      duration: 650,
      ease: 'Back.Out',
      onComplete: () => this.tweens.add({ targets: logo, scale: logoScale * 1.025, yoyo: true, repeat: -1, duration: 1400, ease: 'Sine.easeInOut' }),
    });
    // Tagline ribbon.
    const rib = this.add.graphics().setDepth(D + 1);
    const rw = 470;
    rib.fillStyle(COLOR.outline, 1);
    rib.fillRoundedRect(640 - rw / 2 - 3, 182, rw + 6, 46, 23);
    rib.fillStyle(0x2e8b86, 1);
    rib.fillRoundedRect(640 - rw / 2, 185, rw, 40, 20);
    rib.fillStyle(0xffffff, 0.2);
    rib.fillRoundedRect(640 - rw / 2 + 12, 188, rw - 24, 12, 6);
    this.add.text(640, 205, COPY.subtitle, textStyle(26, CSS.cream, 5)).setOrigin(0.5).setDepth(D + 2);

    // Sparkles drifting around the logo.
    for (let i = 0; i < 7; i++) {
      const sp = this.add.image(Phaser.Math.Between(260, 1020), Phaser.Math.Between(50, 180), 'fx_sparkle').setDepth(D + 3).setScale(0);
      this.tweens.add({ targets: sp, scale: ART_SCALE * 1.4, alpha: { from: 1, to: 0 }, duration: 900, delay: 400 + i * 450, repeat: -1, repeatDelay: 2200, onRepeat: () => sp.setPosition(Phaser.Math.Between(260, 1020), Phaser.Math.Between(50, 180)) });
    }

    // The cast: our hero with his toy on the left, Nutso's minions heckling on the right.
    this.add.image(300, 612, 'shadow').setScale(ART_SCALE * 1.7, ART_SCALE * 1.3).setDepth(D - 1).setAlpha(0.8);
    this.hero = new HeroView(this, 290, 606).setDepth(D);
    this.hero.setMode('idle');
    this.hero.root.setScale(1.45);
    this.bob(this.add.image(420, 606, 'toy').setOrigin(0.5, 1).setScale(0.62).setDepth(D).setRotation(0.06), 1.5, 2);
    for (const [x, key, s] of [
      [1000, 'squirrel_taunt', 0.66],
      [1130, 'squirrel_idle', 0.6],
    ] as const) {
      this.add.image(x, 610, 'shadow').setScale(ART_SCALE * 0.8, ART_SCALE).setDepth(D - 1).setAlpha(0.7);
      this.bob(this.add.image(x, 608, key).setOrigin(0.5, 1).setScale(s).setDepth(D), 6, 7);
    }
    this.add.image(1060, 604, 'nut_pile').setOrigin(0.5, 1).setScale(ART_SCALE * 1.3).setDepth(D);

    // Menu card.
    const card = this.add.graphics().setDepth(D);
    const cw = 420;
    const ch = 300;
    const cx = 640;
    const cy = 422;
    card.fillStyle(COLOR.outline, 0.35);
    card.fillRoundedRect(cx - cw / 2 + 8, cy - ch / 2 + 12, cw, ch, 30);
    card.fillStyle(COLOR.outline, 1);
    card.fillRoundedRect(cx - cw / 2 - 5, cy - ch / 2 - 5, cw + 10, ch + 10, 34);
    card.fillStyle(0xfff6e2, 0.97);
    card.fillRoundedRect(cx - cw / 2, cy - ch / 2, cw, ch, 30);
    card.lineStyle(3, 0xe6cfa4, 1);
    card.strokeRoundedRect(cx - cw / 2 + 10, cy - ch / 2 + 10, cw - 20, ch - 20, 22);
    // Paw-print watermark in the card corners.
    this.add.image(cx - cw / 2 + 34, cy + ch / 2 - 30, 'ui_paw_teal').setScale(0.5).setAlpha(0.35).setDepth(D).setRotation(-0.3);
    this.add.image(cx + cw / 2 - 34, cy - ch / 2 + 30, 'ui_paw_teal').setScale(0.42).setAlpha(0.35).setDepth(D).setRotation(0.3);

    const p = progress.state;
    const hasProgress = p.storySeen || p.completedChapters.length > 0 || p.checkpoint !== null || p.boneBalance > 0;
    const buttons: Button[] = [];
    const primary = new Button(this, cx, cy - 78, hasProgress ? COPY.continue : COPY.start, () => {
      this.scene.start('ChapterMap');
    }, { width: 340, height: 84, fontSize: 38, color: COLOR.coral, icon: 'ui_play', iconScale: 0.5 });
    buttons.push(primary);
    this.tweens.add({ targets: primary, scale: 1.04, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.easeInOut' });
    buttons.push(new Button(this, cx, cy + 22, COPY.shop, () => this.scene.start('Upgrade', { from: 'Title' }), { width: 340, height: 64, fontSize: 26, icon: 'bone', iconScale: 0.36 }));
    buttons.push(new Button(this, cx, cy + 106, COPY.settings, () => this.scene.start('Settings', { from: 'Title' }), { width: 340, height: 64, fontSize: 26, color: 0x6f86a8, icon: 'ui_gear', iconScale: 0.42 }));
    const fsLabel = () => (isFullscreen() ? 'Exit full screen' : 'Full screen');
    const fs = new Button(this, 1140, 44, fsLabel(), () => {
      toggleFullscreen(this);
      this.time.delayedCall(400, () => fs.setText(fsLabel()));
    }, { width: 220, height: 52, fontSize: 20, color: 0x6f86a8, icon: 'ui_expand', iconScale: 0.36 });
    if (isInstalledApp()) fs.setVisible(false);
    else buttons.push(fs);
    const help = new Button(this, 70, 44, '?', () => this.scene.start('HowTo', { next: 'title' }), { width: 74, height: 56, fontSize: 32, color: COLOR.teal });
    buttons.push(help);
    this.add.text(116, 44, 'How to Play', textStyle(20, CSS.cream, 4)).setOrigin(0, 0.5).setDepth(D + 1);
    for (const b of buttons) b.setDepth(D + 1);
    new MenuNav(this, buttons);

    if (!isInstalledApp() && !fullscreenAllowed() && this.sys.game.device.input.touch) {
      this.add.text(640, 664, NOT_ALLOWED_MSG, { ...textStyle(17, CSS.cream, 4), wordWrap: { width: 900 } }).setOrigin(0.5).setDepth(D);
    }
    // Footer: credit with a paw, and the key controls on a soft pill.
    this.add.image(1080, 690, 'ui_paw').setScale(0.42).setDepth(D);
    this.add.text(1262, 690, COPY.credit, textStyle(22, CSS.cream)).setOrigin(1, 0.5).setDepth(D);
    const pill = this.add.graphics().setDepth(D);
    pill.fillStyle(COLOR.outline, 0.55);
    pill.fillRoundedRect(14, 674, 640, 32, 16);
    this.add.text(30, 690, 'Space / ↑ jump · hold to hover · ↓ duck · X bark · Shift burst · Esc pause', textStyle(16, CSS.cream, 3)).setOrigin(0, 0.5).setDepth(D);
    if (!progress.available) {
      this.add.text(640, 650, 'Saving is unavailable in this browser — progress lasts until you close the tab.', textStyle(17, CSS.coral, 4)).setOrigin(0.5, 1).setDepth(D);
    }
  }

  private bob(o: Phaser.GameObjects.Image, amp: number, speed: number): void {
    this.bobbers.push({ o, y: o.y, p: Math.random() * 6, a: amp, s: speed });
  }

  update(_t: number, dms: number): void {
    const dt = Math.min(dms / 1000, 0.1);
    this.t += dt;
    this.backdrop.update(dt);
    for (const b of this.bobbers) b.o.y = b.y - Math.abs(Math.sin(this.t * b.s + b.p)) * b.a;
    this.hero.update(dt, { grounded: true, vy: 0, hovering: false, speed: 0, invulnerable: 0 });
  }
}
