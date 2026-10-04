import Phaser from 'phaser';
import { chapterById } from '../data/chapters';
import { DEPTH } from '../data/config';
import { COPY } from '../data/copy';
import { HeroView } from '../entities/HeroView';
import { Audio } from '../systems/AudioManager';
import { progress } from '../systems/ProgressStore';
import { Backdrop, panel } from '../ui/Backdrop';
import { Button, MenuNav } from '../ui/Button';
import { COLOR, CSS, textStyle } from '../ui/theme';
import type { ResultsData } from './GameScene';

export class ResultsScene extends Phaser.Scene {
  private backdrop!: Backdrop;
  private hero!: HeroView;
  constructor() {
    super('Results');
  }

  create(d: ResultsData): void {
    this.backdrop = new Backdrop(this, 0.5, d.success ? 30 : 0);
    if (d.success) Audio.playMusic('home');
    else Audio.playMusic('title');
    const ch = chapterById(d.chapter);

    panel(this, 640, 315, 760, 450).setDepth(DEPTH.hud);
    const title = d.success ? COPY.cleared : COPY.failed;
    this.add.text(640, 135, title, textStyle(58, d.success ? CSS.butter : CSS.coral, 10)).setOrigin(0.5).setDepth(DEPTH.hud);
    this.add.text(640, 195, `Chapter ${ch.id}: ${ch.title}`, textStyle(26, CSS.white)).setOrigin(0.5).setDepth(DEPTH.hud);

    const best = progress.state.bestRunByChapter[d.chapter] ?? d.metres;
    const rows: [string, string][] = [
      [COPY.distance, `${d.metres} m`],
      [COPY.bonesFound, `${d.bones}`],
      [COPY.bestRun, `${best} m${d.newBest ? '  ★ new!' : ''}`],
    ];
    if (d.bonus > 0) rows.push(['First-time bonus', `+${d.bonus} bones`]);
    rows.forEach(([k, v], i) => {
      const y = 255 + i * 46;
      this.add.text(450, y, k, textStyle(28, CSS.cream)).setOrigin(0, 0.5).setDepth(DEPTH.hud);
      this.add.text(830, y, v, textStyle(28, CSS.white)).setOrigin(1, 0.5).setDepth(DEPTH.hud);
    });
    this.add.text(640, 255 + rows.length * 46 + 6, `Bone bank: ${progress.state.boneBalance}`, textStyle(20, CSS.butter, 4)).setOrigin(0.5).setDepth(DEPTH.hud);

    const buttons: Button[] = [];
    const y = 625;
    if (d.success) {
      this.add.text(640, 512, 'Next landmark: the shopping street — coming soon.', textStyle(20, CSS.cream, 4)).setOrigin(0.5).setDepth(DEPTH.hud);
      buttons.push(new Button(this, 640, y, COPY.nextStop, () => this.scene.start('ChapterMap'), { width: 280, color: COLOR.coral }));
      buttons.push(new Button(this, 330, y, COPY.tryAgain, () => this.scene.start('Game', { chapter: d.chapter, startAt: 'start' }), { width: 260, height: 64, fontSize: 26 }));
      buttons.push(new Button(this, 950, y, COPY.headHome, () => this.scene.start('Title'), { width: 260, height: 64, fontSize: 26, color: 0x6f86a8 }));
    } else {
      const label = d.checkpoint ? `${COPY.tryAgain} (checkpoint)` : COPY.tryAgain;
      buttons.push(new Button(this, 640, y, label, () => this.scene.start('Game', { chapter: d.chapter, startAt: d.checkpoint ? 'encounter' : 'start' }), { width: 340, color: COLOR.coral }));
      buttons.push(new Button(this, 290, y, COPY.shop, () => this.scene.start('Upgrade', { from: 'ChapterMap' }), { width: 300, height: 64, fontSize: 22 }));
      buttons.push(new Button(this, 990, y, COPY.headHome, () => this.scene.start('Title'), { width: 260, height: 64, fontSize: 26, color: 0x6f86a8 }));
    }
    for (const b of buttons) b.setDepth(DEPTH.hud);
    new MenuNav(this, buttons, () => this.scene.start('Title'));

    this.hero = new HeroView(this, 1190, 600).setDepth(DEPTH.hud);
    this.hero.setMode(d.success ? 'victory' : 'idle');
  }

  update(_t: number, dms: number): void {
    const dt = Math.min(dms / 1000, 0.1);
    this.backdrop.update(dt);
    this.hero.update(dt, { grounded: true, vy: 0, hovering: false, speed: 0, invulnerable: 0 });
  }
}
