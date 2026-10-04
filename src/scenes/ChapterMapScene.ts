import Phaser from 'phaser';
import { CHAPTERS, type ChapterDef } from '../data/chapters';
import { DEPTH } from '../data/config';
import { COPY } from '../data/copy';
import { ART_SCALE } from '../systems/AssetRegistry';
import { Audio } from '../systems/AudioManager';
import { progress } from '../systems/ProgressStore';
import { Backdrop, panel } from '../ui/Backdrop';
import { Button, MenuNav } from '../ui/Button';
import { COLOR, CSS, textStyle } from '../ui/theme';

const NODES = [
  { x: 150, y: 300 },
  { x: 340, y: 210 },
  { x: 530, y: 300 },
  { x: 720, y: 210 },
  { x: 910, y: 300 },
  { x: 1100, y: 210 },
];

type NodeState = 'completed' | 'current' | 'locked' | 'soon';

export class ChapterMapScene extends Phaser.Scene {
  private backdrop!: Backdrop;
  private selected = 1;
  private detail!: Phaser.GameObjects.Container;
  private nav!: MenuNav;
  private fixedButtons: Button[] = [];
  private actionButtons: Button[] = [];
  private ring!: Phaser.GameObjects.Graphics;
  private t = 0;

  constructor() {
    super('ChapterMap');
  }

  private stateOf(ch: ChapterDef): NodeState {
    const p = progress.state;
    if (p.completedChapters.includes(ch.id)) return 'completed';
    if (!ch.implemented) return 'soon';
    if (ch.id <= p.unlockedChapter) return 'current';
    return 'locked';
  }

  create(): void {
    this.backdrop = new Backdrop(this, 0.55, 20);
    Audio.playMusic('title');
    this.add.text(640, 60, COPY.map, textStyle(54, CSS.butter, 10)).setOrigin(0.5).setDepth(DEPTH.hud);
    this.add.image(1180, 60, 'bone').setScale(ART_SCALE * 1.3).setDepth(DEPTH.hud);
    this.add.text(1150, 60, String(progress.state.boneBalance), textStyle(28)).setOrigin(1, 0.5).setDepth(DEPTH.hud);

    // Route path.
    const path = this.add.graphics().setDepth(DEPTH.hud);
    const curve = new Phaser.Curves.Spline(NODES.map((n) => new Phaser.Math.Vector2(n.x, n.y)));
    const pts = curve.getPoints(120);
    for (let i = 0; i < pts.length - 1; i += 2) {
      path.lineStyle(10, COLOR.outline, 0.8);
      path.lineBetween(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
      path.lineStyle(5, COLOR.cream, 1);
      path.lineBetween(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
    }
    this.ring = this.add.graphics().setDepth(DEPTH.hud);

    // Pick the first chapter that is playable and not yet completed (else chapter 1).
    const p = progress.state;
    this.selected = CHAPTERS.find((c) => c.implemented && !p.completedChapters.includes(c.id) && c.id <= p.unlockedChapter)?.id ?? 1;

    CHAPTERS.forEach((ch, i) => {
      const n = NODES[i];
      const st = this.stateOf(ch);
      const badge = this.add.image(n.x, n.y, `badge_ch${ch.id}`).setScale(ART_SCALE * 1.15).setDepth(DEPTH.hud + 1);
      if (st === 'locked' || st === 'soon') badge.setAlpha(0.5);
      badge.setInteractive({ useHandCursor: true }).on('pointerup', () => this.select(ch.id));
      this.add.text(n.x, n.y + 56, `${ch.id}. ${ch.title}`, textStyle(18, st === 'soon' || st === 'locked' ? '#BCAFC0' : CSS.white, 4)).setOrigin(0.5, 0).setDepth(DEPTH.hud + 1);
      if (st === 'completed') {
        this.add.text(n.x + 38, n.y - 40, '✔', textStyle(30, CSS.teal)).setOrigin(0.5).setDepth(DEPTH.hud + 2);
      } else if (st === 'soon') {
        this.add.text(n.x, n.y + 82, COPY.comingSoon, textStyle(16, CSS.coral, 4)).setOrigin(0.5, 0).setDepth(DEPTH.hud + 1);
      } else if (st === 'locked') {
        this.add.text(n.x, n.y + 82, 'Locked', textStyle(16, '#BCAFC0', 4)).setOrigin(0.5, 0).setDepth(DEPTH.hud + 1);
      }
    });

    panel(this, 640, 545, 1180, 250).setDepth(DEPTH.hud);
    this.detail = this.add.container(0, 0).setDepth(DEPTH.hud + 1);

    this.fixedButtons = [
      new Button(this, 1080, 470, COPY.shop, () => this.scene.start('Upgrade', { from: 'ChapterMap' }), { width: 300, height: 56, fontSize: 22 }),
      new Button(this, 1080, 540, `${COPY.endless} — ${COPY.comingSoon.toLowerCase()}`, () => undefined, { width: 300, height: 56, fontSize: 18, disabled: true }),
      new Button(this, 1080, 610, COPY.back, () => this.scene.start('Title'), { width: 300, height: 56, fontSize: 22, color: 0x6f86a8 }),
    ];
    for (const b of this.fixedButtons) b.setDepth(DEPTH.hud + 2);
    this.nav = new MenuNav(this, [], () => this.scene.start('Title'));
    this.select(this.selected, true);
  }

  private select(id: number, silent = false): void {
    this.selected = id;
    if (!silent) Audio.play('ui_select');
    const ch = CHAPTERS.find((c) => c.id === id)!;
    const st = this.stateOf(ch);
    this.detail.removeAll(true);
    for (const b of this.actionButtons) b.destroy();
    this.actionButtons = [];

    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => {
      this.detail.add(o);
      return o;
    };
    add(this.add.image(130, 545, `badge_ch${ch.id}`).setScale(ART_SCALE * 1.4));
    add(this.add.text(220, 450, `Chapter ${ch.id}: ${ch.title}`, textStyle(34, CSS.butter, 6)).setOrigin(0, 0));
    add(this.add.text(220, 500, ch.objective, textStyle(22, CSS.white, 4)).setOrigin(0, 0));
    add(this.add.text(220, 534, `Ending encounter: ${ch.encounter}`, textStyle(20, CSS.cream, 4)).setOrigin(0, 0));
    const best = progress.state.bestRunByChapter[ch.id];
    if (best) add(this.add.text(220, 566, `${COPY.bestRun}: ${best} m`, textStyle(20, CSS.cream, 4)).setOrigin(0, 0));

    const cp = progress.state.checkpoint;
    if (st === 'current' || st === 'completed') {
      if (cp && cp.chapter === ch.id) {
        this.actionButtons.push(new Button(this, 340, 630, `${COPY.continue} (checkpoint)`, () => this.scene.start('Game', { chapter: ch.id, startAt: 'encounter' }), { width: 300, height: 58, fontSize: 22, color: COLOR.coral }));
        this.actionButtons.push(new Button(this, 670, 630, 'Start chapter', () => this.scene.start('Game', { chapter: ch.id, startAt: 'start' }), { width: 300, height: 58, fontSize: 22 }));
      } else {
        this.actionButtons.push(new Button(this, 340, 630, COPY.start, () => this.scene.start('Game', { chapter: ch.id, startAt: 'start' }), { width: 300, height: 58, fontSize: 26, color: COLOR.coral }));
      }
    } else if (st === 'soon') {
      add(this.add.text(220, 610, `${COPY.comingSoon} — this chapter is not built yet.`, textStyle(22, CSS.coral, 4)).setOrigin(0, 0));
    } else {
      add(this.add.text(220, 610, 'Finish the previous chapter to unlock.', textStyle(22, CSS.coral, 4)).setOrigin(0, 0));
    }
    for (const b of this.actionButtons) b.setDepth(DEPTH.hud + 2);
    this.nav.setButtons([...this.actionButtons, ...this.fixedButtons]);
  }

  update(_t: number, dms: number): void {
    const dt = Math.min(dms / 1000, 0.1);
    this.t += dt;
    this.backdrop.update(dt);
    const n = NODES[this.selected - 1];
    this.ring.clear();
    this.ring.lineStyle(6, COLOR.butter, 0.6 + Math.sin(this.t * 5) * 0.4);
    this.ring.strokeCircle(n.x, n.y, 40 + Math.sin(this.t * 5) * 3);
  }
}
