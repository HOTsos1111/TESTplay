import Phaser from 'phaser';
import { CHAPTERS, type ChapterDef } from '../data/chapters';
import { DEPTH } from '../data/config';
import { COPY } from '../data/copy';
import { ART_SCALE } from '../systems/AssetRegistry';
import { Audio } from '../systems/AudioManager';
import { progress } from '../systems/ProgressStore';
import { Backdrop } from '../ui/Backdrop';
import { Button, MenuNav } from '../ui/Button';
import { COLOR, CSS, FONT, textStyle } from '../ui/theme';
import { centerMenu } from '../ui/layout';

type NodeState = 'completed' | 'current' | 'locked' | 'soon';

const CARD_W = 360;
const CARD_H = 196;
const THUMB_H = 128;
/** Card centres in reading order: the route home runs left to right, then on along the second row. */
const CARDS = [
  { x: 250, y: 222 },
  { x: 640, y: 222 },
  { x: 1030, y: 222 },
  { x: 250, y: 440 },
  { x: 640, y: 440 },
  { x: 1030, y: 440 },
];

/**
 * Level select: six postcard chapters cut from the environment reference,
 * joined by a paw-print trail, with the chosen chapter's details and the play
 * button along the bottom.
 */
export class ChapterMapScene extends Phaser.Scene {
  private backdrop!: Backdrop;
  private selected = 1;
  private detail!: Phaser.GameObjects.Container;
  private nav!: MenuNav;
  private fixedButtons: Button[] = [];
  private actionButtons: Button[] = [];
  private glow!: Phaser.GameObjects.Graphics;
  private cards: Phaser.GameObjects.Container[] = [];
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
    this.t = 0;
    this.cards = [];
    this.backdrop = new Backdrop(this, 0.45, 18);
    centerMenu(this);
    Audio.playMusic('title');
    const D = DEPTH.hud;

    // Header ribbon.
    const title = this.add.text(640, 54, 'Choose Your Chapter', textStyle(46, CSS.butter, 9)).setOrigin(0.5).setDepth(D + 2);
    title.setShadow(0, 5, CSS.outline, 0, true, true);
    this.add.image(640 - title.width / 2 - 32, 54, 'ui_paw').setScale(0.6).setRotation(-0.3).setDepth(D + 2);
    this.add.image(640 + title.width / 2 + 32, 54, 'ui_paw').setScale(0.6).setRotation(0.3).setDepth(D + 2);
    this.add.text(640, 92, COPY.map, textStyle(20, CSS.cream, 4)).setOrigin(0.5).setDepth(D + 2);

    // Bone balance pill.
    const pill = this.add.graphics().setDepth(D + 1);
    pill.fillStyle(COLOR.outline, 1).fillRoundedRect(1086, 22, 172, 50, 25);
    pill.fillStyle(0xfff6e2, 1).fillRoundedRect(1090, 26, 164, 42, 21);
    this.add.image(1122, 47, 'bone').setScale(ART_SCALE * 1.05).setDepth(D + 2);
    this.add.text(1238, 47, String(progress.state.boneBalance), { fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: CSS.outline }).setOrigin(1, 0.5).setDepth(D + 2);

    // Paw-print trail between the chapters (behind the cards).
    const trail = this.add.graphics().setDepth(D);
    const pts = [CARDS[0], CARDS[1], CARDS[2], { x: 1220, y: 331 }, { x: 640, y: 331 }, { x: 60, y: 331 }, CARDS[3], CARDS[4], CARDS[5]];
    const curve = new Phaser.Curves.Spline(pts.map((n) => new Phaser.Math.Vector2(n.x, n.y)));
    const sp = curve.getSpacedPoints(70);
    for (let i = 0; i < sp.length; i++) {
      trail.fillStyle(COLOR.outline, 0.55).fillCircle(sp[i].x, sp[i].y + 2, 6.5);
      trail.fillStyle(0xfff6e2, 0.95).fillCircle(sp[i].x, sp[i].y, 5);
    }

    this.glow = this.add.graphics().setDepth(D + 1);
    const p = progress.state;
    this.selected = CHAPTERS.find((c) => c.implemented && !p.completedChapters.includes(c.id) && c.id <= p.unlockedChapter)?.id ?? 1;
    CHAPTERS.forEach((ch, i) => this.cards.push(this.makeCard(ch, CARDS[i].x, CARDS[i].y)));

    // Detail bar along the bottom.
    const bar = this.add.graphics().setDepth(D);
    bar.fillStyle(COLOR.outline, 0.35).fillRoundedRect(46, 562, 1188, 140, 28);
    bar.fillStyle(COLOR.outline, 1).fillRoundedRect(36, 550, 1208, 146, 30);
    bar.fillStyle(0xfff6e2, 1).fillRoundedRect(41, 555, 1198, 136, 26);
    bar.lineStyle(3, 0xe6cfa4, 1).strokeRoundedRect(51, 565, 1178, 116, 20);
    this.detail = this.add.container(0, 0).setDepth(D + 1);

    this.fixedButtons = [
      new Button(this, 92, 46, '◀ Menu', () => this.scene.start('Title'), { width: 150, height: 50, fontSize: 20, color: 0x6f86a8 }),
      new Button(this, 1000, 46, 'Gear', () => this.scene.start('Upgrade', { from: 'ChapterMap' }), { width: 140, height: 50, fontSize: 20, icon: 'bone', iconScale: 0.3 }),
    ];
    for (const b of this.fixedButtons) b.setDepth(D + 3);
    this.nav = new MenuNav(this, [], () => this.scene.start('Title'));
    this.input.keyboard?.on('keydown-PAGE_DOWN', () => this.select(Math.min(6, this.selected + 1)));
    this.input.keyboard?.on('keydown-PAGE_UP', () => this.select(Math.max(1, this.selected - 1)));
    this.select(this.selected, true);
  }

  private makeCard(ch: ChapterDef, x: number, y: number): Phaser.GameObjects.Container {
    const st = this.stateOf(ch);
    const c = this.add.container(x, y).setDepth(DEPTH.hud + 2);
    const g = this.add.graphics();
    g.fillStyle(COLOR.outline, 0.35).fillRoundedRect(-CARD_W / 2 + 6, -CARD_H / 2 + 9, CARD_W, CARD_H, 24);
    g.fillStyle(COLOR.outline, 1).fillRoundedRect(-CARD_W / 2 - 4, -CARD_H / 2 - 4, CARD_W + 8, CARD_H + 8, 26);
    g.fillStyle(0xfff6e2, 1).fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 22);
    c.add(g);
    // Postcard picture with rounded top corners.
    const thumb = this.add.image(0, -CARD_H / 2 + 10 + THUMB_H / 2, `card_ch${ch.id}`).setDisplaySize(CARD_W - 20, THUMB_H);
    const maskG = this.make.graphics({}, false);
    maskG.fillStyle(0xffffff).fillRoundedRect(x - CARD_W / 2 + 10, y - CARD_H / 2 + 10, CARD_W - 20, THUMB_H, 16);
    thumb.setMask(maskG.createGeometryMask());
    c.add(thumb);
    const frame = this.add.graphics();
    frame.lineStyle(3, COLOR.outline, 1).strokeRoundedRect(-CARD_W / 2 + 10, -CARD_H / 2 + 10, CARD_W - 20, THUMB_H, 16);
    c.add(frame);
    const dim = st === 'soon' || st === 'locked';
    if (dim) {
      thumb.setTint(0x9a8f9c);
      const veil = this.add.graphics();
      veil.fillStyle(COLOR.outline, 0.35).fillRoundedRect(-CARD_W / 2 + 10, -CARD_H / 2 + 10, CARD_W - 20, THUMB_H, 16);
      c.add(veil);
      // Padlock.
      const lock = this.add.graphics();
      const ly = -CARD_H / 2 + 10 + THUMB_H / 2 - 4;
      lock.lineStyle(7, COLOR.outline, 1).strokeCircle(0, ly - 12, 13);
      lock.lineStyle(4, 0xfff6e2, 1).strokeCircle(0, ly - 12, 13);
      lock.fillStyle(COLOR.outline, 1).fillRoundedRect(-22, ly - 6, 44, 34, 7);
      lock.fillStyle(0xffd95a, 1).fillRoundedRect(-18, ly - 2, 36, 26, 5);
      lock.fillStyle(COLOR.outline, 1).fillCircle(0, ly + 9, 4);
      c.add(lock);
    }
    // Number badge and title.
    const by = CARD_H / 2 - 32;
    const badge = this.add.graphics();
    badge.fillStyle(COLOR.outline, 1).fillCircle(-CARD_W / 2 + 34, by, 20);
    badge.fillStyle(dim ? 0x8a7f8c : 0x2e8b86, 1).fillCircle(-CARD_W / 2 + 34, by, 16.5);
    c.add(badge);
    c.add(this.add.text(-CARD_W / 2 + 34, by, String(ch.id), { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: CSS.white }).setOrigin(0.5));
    c.add(this.add.text(-CARD_W / 2 + 64, by, ch.title, { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: dim ? '#8A7F8C' : CSS.outline }).setOrigin(0, 0.5));
    if (st === 'completed') {
      const tick = this.add.graphics();
      tick.fillStyle(COLOR.outline, 1).fillCircle(CARD_W / 2 - 30, by, 18);
      tick.fillStyle(0x5aa95a, 1).fillCircle(CARD_W / 2 - 30, by, 15);
      tick.lineStyle(4.5, 0xffffff, 1).beginPath();
      tick.moveTo(CARD_W / 2 - 38, by).lineTo(CARD_W / 2 - 32, by + 6).lineTo(CARD_W / 2 - 21, by - 7).strokePath();
      c.add(tick);
    } else if (st === 'soon') {
      c.add(this.add.text(CARD_W / 2 - 14, by, 'Soon', { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: '#C0573E' }).setOrigin(1, 0.5));
    }
    c.setSize(CARD_W, CARD_H).setInteractive({ useHandCursor: true });
    c.on('pointerup', () => this.select(ch.id));
    return c;
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
    const ink = (x: number, y: number, s: string, size: number, color: string = CSS.outline) =>
      add(this.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color }).setOrigin(0, 0));
    add(this.add.image(120, 623, `card_ch${ch.id}`).setCrop(146, 4, 264, 192).setScale(0.5)).setTint(st === 'soon' || st === 'locked' ? 0x9a8f9c : 0xffffff);
    const fr = add(this.add.graphics());
    fr.lineStyle(3.5, COLOR.outline, 1).strokeRoundedRect(54, 575, 132, 96, 10);
    ink(208, 574, `Chapter ${ch.id}: ${ch.title}`, 28);
    ink(208, 612, ch.objective, 19, '#5C4560');
    ink(208, 640, `Finale: ${ch.encounter}`, 17, '#2E8B86');
    const best = progress.state.bestRunByChapter[ch.id];
    if (best) ink(208, 664, `${COPY.bestRun}: ${best} m`, 15, '#8A7F8C');

    const cp = progress.state.checkpoint;
    if (st === 'current' || st === 'completed') {
      if (cp && cp.chapter === ch.id) {
        this.actionButtons.push(new Button(this, 1080, 594, `${COPY.continue}`, () => this.scene.start('Game', { chapter: ch.id, startAt: 'encounter' }), { width: 260, height: 54, fontSize: 24, color: COLOR.coral, icon: 'ui_play', iconScale: 0.36 }));
        this.actionButtons.push(new Button(this, 1080, 656, 'Restart chapter', () => this.scene.start('Game', { chapter: ch.id, startAt: 'start' }), { width: 260, height: 46, fontSize: 19 }));
      } else {
        const go = new Button(this, 1080, 622, COPY.start, () => this.scene.start('Game', { chapter: ch.id, startAt: 'start' }), { width: 270, height: 76, fontSize: 34, color: COLOR.coral, icon: 'ui_play', iconScale: 0.46 });
        this.tweens.add({ targets: go, scale: 1.04, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.easeInOut' });
        this.actionButtons.push(go);
      }
    } else {
      ink(900, 606, st === 'soon' ? `${COPY.comingSoon}!` : 'Locked', 26, '#C0573E');
      ink(900, 640, st === 'soon' ? 'This part of the journey is on its way.' : 'Finish the previous chapter to unlock.', 16, '#8A7F8C');
    }
    for (const b of this.actionButtons) b.setDepth(DEPTH.hud + 3);
    this.nav.setButtons([...this.actionButtons, ...this.fixedButtons]);
  }

  update(_t: number, dms: number): void {
    const dt = Math.min(dms / 1000, 0.1);
    this.t += dt;
    this.backdrop.update(dt);
    const n = CARDS[this.selected - 1];
    const pulse = 0.6 + Math.sin(this.t * 5) * 0.4;
    this.glow.clear();
    this.glow.lineStyle(8, COLOR.butter, pulse);
    this.glow.strokeRoundedRect(n.x - CARD_W / 2 - 14, n.y - CARD_H / 2 - 14, CARD_W + 28, CARD_H + 28, 32);
  }
}
