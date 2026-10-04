import Phaser from 'phaser';
import { DEPTH } from '../data/config';
import { COPY } from '../data/copy';
import { HeroView } from '../entities/HeroView';
import { Audio } from '../systems/AudioManager';
import { progress } from '../systems/ProgressStore';
import { Backdrop } from '../ui/Backdrop';
import { Button, MenuNav } from '../ui/Button';
import { COLOR, CSS, textStyle } from '../ui/theme';
import { autoFullscreen, fullscreenAllowed, isFullscreen, NOT_ALLOWED_MSG, toggleFullscreen } from '../ui/fullscreen';

export class TitleScene extends Phaser.Scene {
  private backdrop!: Backdrop;
  private hero!: HeroView;
  constructor() {
    super('Title');
  }

  create(): void {
    this.backdrop = new Backdrop(this, 0.15, 30);
    Audio.playMusic('title');

    const title = this.add.text(640, 150, COPY.title, textStyle(96, CSS.butter, 14)).setOrigin(0.5).setDepth(DEPTH.hud);
    title.setShadow(0, 8, CSS.outline, 0, true, true);
    this.tweens.add({ targets: title, scale: 1.03, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.easeInOut' });
    this.add.text(640, 232, COPY.subtitle, textStyle(34, CSS.white)).setOrigin(0.5).setDepth(DEPTH.hud);

    this.hero = new HeroView(this, 300, 600).setDepth(DEPTH.hud);
    this.hero.setMode('idle');
    this.hero.root.setScale(1.35);
    this.add.image(410, 590, 'toy').setScale(0.5).setDepth(DEPTH.hud).setRotation(0.1);

    const p = progress.state;
    const hasProgress = p.storySeen || p.completedChapters.length > 0 || p.checkpoint !== null || p.boneBalance > 0;
    const buttons: Button[] = [];
    const primary = new Button(this, 640, 350, hasProgress ? COPY.continue : COPY.start, () => {
      autoFullscreen(this);
      if (!progress.state.storySeen) this.scene.start('Story', { next: 'game' });
      else this.scene.start('ChapterMap');
    }, { width: 340, height: 80, fontSize: 36, color: COLOR.coral });
    buttons.push(primary);
    buttons.push(new Button(this, 640, 448, COPY.shop, () => this.scene.start('Upgrade', { from: 'Title' }), { width: 340, height: 62, fontSize: 26 }));
    buttons.push(new Button(this, 640, 530, COPY.settings, () => this.scene.start('Settings', { from: 'Title' }), { width: 340, height: 62, fontSize: 26, color: 0x6f86a8 }));
    const fsLabel = () => (isFullscreen() ? 'Exit full screen' : 'Full screen');
    const fs = new Button(this, 1130, 44, fsLabel(), () => {
      toggleFullscreen(this);
      this.time.delayedCall(400, () => fs.setText(fsLabel()));
    }, { width: 230, height: 54, fontSize: 22, color: 0x6f86a8 });
    buttons.push(fs);
    if (!fullscreenAllowed() && this.sys.game.device.input.touch) {
      this.add.text(640, 660, NOT_ALLOWED_MSG, { ...textStyle(18, CSS.cream, 4), wordWrap: { width: 900 } }).setOrigin(0.5).setDepth(DEPTH.hud);
    }
    for (const b of buttons) b.setDepth(DEPTH.hud);
    new MenuNav(this, buttons);

    this.add.text(1260, 700, COPY.credit, textStyle(22, CSS.cream)).setOrigin(1, 1).setDepth(DEPTH.hud);
    this.add.text(20, 700, 'Space / ↑ jump · hold to hover · X / K bark · Shift burst · Esc pause', textStyle(18, CSS.cream, 4)).setOrigin(0, 1).setDepth(DEPTH.hud);
    if (!progress.available) {
      this.add.text(640, 690, 'Saving is unavailable in this browser — progress lasts until you close the tab.', textStyle(18, CSS.coral, 4)).setOrigin(0.5, 1).setDepth(DEPTH.hud);
    }
  }

  update(_t: number, dms: number): void {
    const dt = Math.min(dms / 1000, 0.1);
    this.backdrop.update(dt);
    this.hero.update(dt, { grounded: true, vy: 0, hovering: false, speed: 0, invulnerable: 0 });
  }
}
