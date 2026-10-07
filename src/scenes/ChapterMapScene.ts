import Phaser from 'phaser';
import { LEVELS, type LevelDef } from '../data/campaign';
import { DEPTH } from '../data/config';
import { COPY } from '../data/copy';
import { ART_SCALE } from '../systems/AssetRegistry';
import { Audio } from '../systems/AudioManager';
import { progress } from '../systems/ProgressStore';
import { debugFlags } from '../systems/debug';
import { Button, MenuNav } from '../ui/Button';
import { COLOR, CSS, FONT, textStyle } from '../ui/theme';
import { centerMenu } from '../ui/layout';

/** completed: beaten; open: reachable and playable; soon: reachable, not built yet; locked: not reached. */
type LevelState = 'completed' | 'open' | 'soon' | 'locked';

const PLAQUE = { w: 222, h: 76 };
const PAPER = 0xfff6e3;

/**
 * Level select: the painted route-home map with a glossy plaque on each of the
 * nine districts. Districts not reached yet are ghosted; picking a reachable one
 * opens a details card with the play button.
 */
export class ChapterMapScene extends Phaser.Scene {
  private plaques: Phaser.GameObjects.Container[] = [];
  private faces: Phaser.GameObjects.Graphics[] = [];
  private selected = 1;
  private popup: Phaser.GameObjects.Container | null = null;
  private popupButtons: Button[] = [];
  private popupNav: MenuNav | null = null;
  private fixedButtons: Button[] = [];
  private marker: Phaser.GameObjects.Image | null = null;
  private t = 0;

  constructor() {
    super('ChapterMap');
  }

  preload(): void {
    if (!this.textures.exists('level_map')) this.load.image('level_map', 'ui/level_map.webp');
    if (!this.textures.exists('level_map_ghost')) this.load.image('level_map_ghost', 'ui/level_map_ghost.webp');
  }

  private stateOf(l: LevelDef): LevelState {
    const p = progress.state;
    const reached = debugFlags.unlockAll || l.id <= p.unlockedChapter;
    if (l.standIn !== null && p.completedChapters.includes(l.standIn)) return 'completed';
    if (!reached) return 'locked';
    return l.standIn === null ? 'soon' : 'open';
  }

  create(): void {
    this.t = 0;
    this.plaques = [];
    this.faces = [];
    this.popup = null;
    this.popupButtons = [];
    this.popupNav = null;
    centerMenu(this);
    Audio.playMusic('title');
    this.cameras.main.setBackgroundColor(CSS.outline);

    this.add.image(0, 0, 'level_map').setOrigin(0).setDisplaySize(1280, 720);
    // Ghost the districts that are still out of reach, with a soft edge.
    // Only edges that meet a reachable district are feathered, so neighbouring
    // ghosted districts join without seams.
    const locked = LEVELS.filter((l) => this.stateOf(l) === 'locked').map((l) => l.area);
    const isLocked = (x: number, y: number) => locked.some((a) => x >= a.x && x < a.x + a.w && y >= a.y && y < a.y + a.h);
    const inMap = (x: number, y: number) => x >= 0 && x < 1280 && y >= 0 && y < 720;
    const soft = (x: number, y: number) => inMap(x, y) && !isLocked(x, y);
    for (const a of locked) {
      const cx = a.x + a.w / 2;
      const cy = a.y + a.h / 2;
      const edge = { l: soft(a.x - 1, cy), r: soft(a.x + a.w, cy), t: soft(cx, a.y - 1), b: soft(cx, a.y + a.h) };
      for (const [inset, alpha] of [
        [0, 0.72],
        [10, 0.72],
        [22, 0.85],
      ] as const) {
        const x0 = a.x + (edge.l ? inset : 0);
        const y0 = a.y + (edge.t ? inset : 0);
        const x1 = a.x + a.w - (edge.r ? inset : 0);
        const y1 = a.y + a.h - (edge.b ? inset : 0);
        this.add.image(0, 0, 'level_map_ghost').setOrigin(0).setDisplaySize(1280, 720).setCrop(x0, y0, x1 - x0, y1 - y0).setAlpha(alpha);
      }
    }

    const D = DEPTH.hud;
    LEVELS.forEach((l, i) => this.plaques.push(this.makePlaque(l, i)));

    // Header banner.
    const title = this.add.text(640, 40, 'Choose Your Neighbourhood', textStyle(32, CSS.butter, 7)).setOrigin(0.5).setDepth(D + 3);
    const bw = title.width + 110;
    const banner = this.add.graphics().setDepth(D + 2);
    banner.fillStyle(COLOR.outline, 0.35).fillRoundedRect(640 - bw / 2 + 4, 12, bw, 60, 30);
    banner.fillStyle(COLOR.outline, 1).fillRoundedRect(640 - bw / 2 - 4, 4, bw + 8, 64, 32);
    banner.fillStyle(COLOR.coral, 1).fillRoundedRect(640 - bw / 2, 8, bw, 56, 28);
    banner.fillStyle(0xffffff, 0.22).fillRoundedRect(640 - bw / 2 + 14, 13, bw - 28, 18, 9);
    this.add.image(640 - bw / 2 + 30, 40, 'ui_paw').setScale(0.55).setRotation(-0.3).setDepth(D + 3);
    this.add.image(640 + bw / 2 - 30, 40, 'ui_paw').setScale(0.55).setRotation(0.3).setDepth(D + 3);

    // Bone balance.
    const pill = this.add.graphics().setDepth(D + 2);
    pill.fillStyle(COLOR.outline, 1).fillRoundedRect(1098, 14, 166, 48, 24);
    pill.fillStyle(PAPER, 1).fillRoundedRect(1102, 18, 158, 40, 20);
    this.add.image(1132, 38, 'bone').setScale(ART_SCALE * 0.95).setDepth(D + 3);
    this.add.text(1246, 38, String(progress.state.boneBalance), { fontFamily: FONT, fontSize: '26px', fontStyle: 'bold', color: CSS.outline }).setOrigin(1, 0.5).setDepth(D + 3);

    this.fixedButtons = [
      new Button(this, 84, 38, '◀ Menu', () => this.scene.start('Title'), { width: 140, height: 48, fontSize: 20, color: 0x6f86a8 }),
      new Button(this, 1030, 38, 'Gear', () => this.scene.start('Upgrade', { from: 'ChapterMap' }), { width: 116, height: 48, fontSize: 20, icon: 'bone', iconScale: 0.28 }),
    ];
    for (const b of this.fixedButtons) b.setDepth(D + 3);

    // The hero waits on the furthest reachable level.
    const p = progress.state;
    const here = LEVELS.find((l) => this.stateOf(l) === 'open' && !p.completedChapters.includes(l.standIn ?? -1)) ?? LEVELS.filter((l) => this.stateOf(l) !== 'locked').pop() ?? LEVELS[0];
    this.selected = here.id;
    if (this.textures.exists('hero_s_idle')) {
      this.marker = this.add.image(here.map.x - PLAQUE.w / 2 + 6, here.map.y - PLAQUE.h / 2 - 2, 'hero_s_idle').setOrigin(0.5, 1).setScale(0.32).setDepth(D + 2);
    }

    const kb = this.input.keyboard;
    const step = (d: number) => {
      if (this.popup) return;
      this.select(Phaser.Math.Clamp(this.selected + d, 1, LEVELS.length));
    };
    kb?.on('keydown-RIGHT', () => step(1));
    kb?.on('keydown-DOWN', () => step(1));
    kb?.on('keydown-TAB', () => step(1));
    kb?.on('keydown-LEFT', () => step(-1));
    kb?.on('keydown-UP', () => step(-1));
    kb?.on('keydown-ENTER', () => !this.popup && this.choose(this.selected));
    kb?.on('keydown-SPACE', () => !this.popup && this.choose(this.selected));
    kb?.on('keydown-ESC', () => {
      if (this.popup) this.closePopup();
      else this.scene.start('Title');
    });
    this.select(this.selected, true);
  }

  /** A glossy two-line plaque sitting on the district's blank sign. */
  private makePlaque(l: LevelDef, i: number): Phaser.GameObjects.Container {
    const st = this.stateOf(l);
    const { w, h } = PLAQUE;
    const c = this.add.container(l.map.x, l.map.y).setDepth(DEPTH.hud + 1);
    const face = this.add.graphics();
    const fill = st === 'locked' ? 0x9a8f9c : st === 'completed' ? 0x2e8b86 : st === 'soon' ? 0x5f9fc4 : COLOR.coral;
    const col = Phaser.Display.Color.IntegerToColor(fill);
    const dark = Phaser.Display.Color.GetColor(col.red * 0.6, col.green * 0.6, col.blue * 0.6);
    const r = 22;
    face.fillStyle(COLOR.outline, 0.35).fillRoundedRect(-w / 2 + 4, -h / 2 + 12, w, h, r);
    face.fillStyle(COLOR.outline, 1).fillRoundedRect(-w / 2 - 2, -h / 2 + 4, w + 4, h + 4, r + 2);
    face.fillStyle(dark, 1).fillRoundedRect(-w / 2, -h / 2 + 6, w, h, r);
    face.fillStyle(fill, 1).fillRoundedRect(-w / 2, -h / 2, w, h, r);
    face.fillStyle(0x000000, 0.1).fillRoundedRect(-w / 2 + 6, h * 0.08, w - 12, h * 0.38, { tl: 0, tr: 0, bl: r - 6, br: r - 6 });
    face.fillStyle(0xffffff, 0.3).fillRoundedRect(-w / 2 + 12, -h / 2 + 5, w - 24, h * 0.32, r - 9);
    face.fillStyle(0xffffff, 0.55).fillCircle(-w / 2 + 22, -h / 2 + 13, 4);
    face.lineStyle(4, COLOR.outline, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, r);
    c.add(face);
    this.faces.push(this.add.graphics());
    c.add(this.faces[i]);

    // Number (or padlock) badge.
    const bx = -w / 2 + 30;
    const badge = this.add.graphics();
    badge.fillStyle(COLOR.outline, 1).fillCircle(bx, -2, 21);
    badge.fillStyle(st === 'locked' ? 0x6e6470 : PAPER, 1).fillCircle(bx, -2, 17.5);
    c.add(badge);
    if (st === 'locked') {
      const lock = this.add.graphics();
      lock.lineStyle(5, COLOR.outline, 1).strokeCircle(bx, -9, 7);
      lock.lineStyle(2.5, PAPER, 1).strokeCircle(bx, -9, 7);
      lock.fillStyle(COLOR.outline, 1).fillRoundedRect(bx - 11, -6, 22, 17, 4);
      lock.fillStyle(COLOR.butter, 1).fillRoundedRect(bx - 8, -3, 16, 11, 3);
      c.add(lock);
    } else {
      c.add(this.add.text(bx, -2, String(l.id), { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: CSS.outline }).setOrigin(0.5));
    }

    const tx = bx + 30;
    const avail = w / 2 - 12 - tx;
    const name = this.add.text(tx, -13, l.district, textStyle(20, st === 'locked' ? '#E9E2EA' : CSS.white, 4)).setOrigin(0, 0.5);
    if (name.width > avail) name.setScale(avail / name.width);
    const sub = this.add.text(tx, 14, st === 'soon' ? `${l.title} · Soon` : l.title, { fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: st === 'locked' ? '#D4CBD6' : '#FFF6E3' }).setOrigin(0, 0.5);
    sub.setShadow(0, 2, CSS.outline, 0, false, true);
    if (sub.width > avail) sub.setScale(avail / sub.width);
    c.add([name, sub]);

    if (st === 'completed') {
      const tick = this.add.graphics();
      const sx = w / 2 - 6;
      const sy = -h / 2 + 4;
      tick.fillStyle(COLOR.outline, 1).fillCircle(sx, sy, 16);
      tick.fillStyle(0x5aa95a, 1).fillCircle(sx, sy, 13);
      tick.lineStyle(4, 0xffffff, 1).beginPath();
      tick.moveTo(sx - 7, sy).lineTo(sx - 2, sy + 5).lineTo(sx + 7, sy - 6).strokePath();
      c.add(tick);
    }
    if (st === 'locked') c.setAlpha(0.88);

    c.setSize(w, h + 8).setInteractive({ useHandCursor: true });
    c.on('pointerover', () => !this.popup && this.select(l.id, true));
    c.on('pointerdown', () => !this.popup && c.setScale(0.96));
    c.on('pointerout', () => c.setScale(1));
    c.on('pointerup', () => {
      c.setScale(1);
      if (!this.popup) this.choose(l.id);
    });
    // Plaques pop in along the route.
    c.setScale(0);
    this.tweens.add({ targets: c, scale: 1, duration: 320, delay: 120 + i * 70, ease: 'Back.Out' });
    return c;
  }

  private select(id: number, silent = false): void {
    if (id !== this.selected && !silent) Audio.play('ui_select');
    this.selected = id;
  }

  private choose(id: number): void {
    const l = LEVELS[id - 1];
    this.select(id, true);
    const st = this.stateOf(l);
    if (st === 'locked') {
      Audio.play('ui_back');
      const c = this.plaques[id - 1];
      this.tweens.add({ targets: c, x: l.map.x + 8, duration: 50, yoyo: true, repeat: 3, onComplete: () => c.setX(l.map.x) });
      this.toast(l, `Beat Level ${id - 1} to reach ${l.district}`);
      return;
    }
    Audio.play('ui_confirm');
    this.openPopup(l, st);
  }

  private toast(l: LevelDef, text: string): void {
    const t = this.add.text(l.map.x, l.map.y - PLAQUE.h / 2 - 22, text, textStyle(18, CSS.white, 5)).setOrigin(0.5).setDepth(DEPTH.hud + 6);
    t.setX(Phaser.Math.Clamp(l.map.x, t.width / 2 + 12, 1280 - t.width / 2 - 12));
    this.tweens.add({ targets: t, y: t.y - 26, alpha: 0, delay: 900, duration: 500, onComplete: () => t.destroy() });
  }

  private openPopup(l: LevelDef, st: LevelState): void {
    const D = DEPTH.hud + 8;
    const box = this.add.container(640, 380).setDepth(D);
    const veil = this.add.rectangle(0, -20, 2400, 1400, COLOR.outline, 0.55).setInteractive();
    veil.on('pointerup', () => this.closePopup());
    box.add(veil);
    const W = 600;
    const H = 330;
    const g = this.add.graphics();
    g.fillStyle(COLOR.outline, 0.4).fillRoundedRect(-W / 2 + 8, -H / 2 + 12, W, H, 30);
    g.fillStyle(COLOR.outline, 1).fillRoundedRect(-W / 2 - 5, -H / 2 - 5, W + 10, H + 10, 34);
    g.fillStyle(PAPER, 1).fillRoundedRect(-W / 2, -H / 2, W, H, 30);
    g.lineStyle(3, COLOR.teal, 0.8).strokeRoundedRect(-W / 2 + 10, -H / 2 + 10, W - 20, H - 20, 22);
    // Painted thumbnail of the district.
    const a = l.area;
    const thumb = this.add.image(-W / 2 + 26, -H / 2 + 28, 'level_map').setOrigin(0).setCrop(a.x, a.y, a.w, a.h);
    const k = Math.min(196 / a.w, 150 / a.h);
    thumb.setScale((1280 / thumb.width) * k).setPosition(-W / 2 + 26 - a.x * thumb.scaleX, -H / 2 + 28 - a.y * thumb.scaleY);
    box.add(g);
    box.add(thumb);
    const fr = this.add.graphics();
    fr.lineStyle(4, COLOR.outline, 1).strokeRoundedRect(-W / 2 + 26, -H / 2 + 28, a.w * k, a.h * k, 8);
    box.add(fr);

    const x0 = -W / 2 + 26 + a.w * k + 22;
    const ink = (y: number, s: string, size: number, color: string = CSS.outline, wrap = 0) => {
      const t = this.add.text(x0, y, s, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color, wordWrap: wrap ? { width: wrap } : undefined });
      box.add(t);
      return t;
    };
    const wrapW = W / 2 - x0 - 26;
    ink(-H / 2 + 28, `LEVEL ${l.id} · ${l.district.toUpperCase()}`, 16, '#2E8B86');
    ink(-H / 2 + 50, l.title, 34);
    ink(-H / 2 + 96, l.objective, 18, '#5C4560', wrapW);
    ink(-H / 2 + 160, `Boss: ${l.boss}`, 18, '#C0573E');
    const best = l.standIn !== null ? progress.state.bestRunByChapter[l.standIn] : undefined;
    if (best) ink(-H / 2 + 186, `${COPY.bestRun}: ${best} m`, 15, '#8A7F8C');

    this.popupButtons = [];
    const by = H / 2 - 52;
    if (st === 'soon' || l.standIn === null) {
      const t = this.add.text(0, by - 8, `${COPY.comingSoon}! This part of the route home is being built.`, { fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: '#C0573E', align: 'center', wordWrap: { width: W - 80 } }).setOrigin(0.5);
      box.add(t);
    } else {
      const ch = l.standIn;
      const cp = progress.state.checkpoint;
      const start = (at: 'start' | 'encounter') => this.scene.start('Game', { chapter: ch, startAt: at });
      if (cp && cp.chapter === ch) {
        this.popupButtons.push(new Button(this, 640 + 110, 380 + by, COPY.continue, () => start('encounter'), { width: 230, height: 62, fontSize: 24, color: COLOR.coral, icon: 'ui_play', iconScale: 0.36 }));
        this.popupButtons.push(new Button(this, 640 - 130, 380 + by, 'Restart', () => start('start'), { width: 190, height: 56, fontSize: 22 }));
      } else {
        const go = new Button(this, 640, 380 + by, COPY.start, () => start('start'), { width: 280, height: 72, fontSize: 32, color: COLOR.coral, icon: 'ui_play', iconScale: 0.44 });
        this.tweens.add({ targets: go, scale: 1.05, yoyo: true, repeat: -1, duration: 650, ease: 'Sine.InOut' });
        this.popupButtons.push(go);
      }
    }
    const close = new Button(this, 640 + W / 2 - 18, 380 - H / 2 + 14, '✕', () => this.closePopup(), { width: 54, height: 50, fontSize: 24, color: 0x6f86a8 });
    this.popupButtons.push(close);
    for (const b of this.popupButtons) b.setDepth(D + 1);
    this.popupNav = new MenuNav(this, this.popupButtons);
    if (this.popupButtons.length > 1) this.popupNav.focus(0);

    box.setScale(0.85).setAlpha(0);
    this.tweens.add({ targets: box, scale: 1, alpha: 1, duration: 220, ease: 'Back.Out' });
    for (const b of this.popupButtons) {
      b.setAlpha(0);
      this.tweens.add({ targets: b, alpha: 1, duration: 220 });
    }
    this.popup = box;
  }

  private closePopup(): void {
    if (!this.popup) return;
    Audio.play('ui_back');
    this.popup.destroy();
    this.popup = null;
    for (const b of this.popupButtons) b.destroy();
    this.popupButtons = [];
    this.popupNav?.destroy();
    this.popupNav = null;
  }

  update(_t: number, dms: number): void {
    const dt = Math.min(dms / 1000, 0.1);
    this.t += dt;
    // Pulsing ring on the selected plaque.
    const pulse = 0.55 + Math.sin(this.t * 5) * 0.45;
    this.faces.forEach((g, i) => {
      g.clear();
      if (i !== this.selected - 1) return;
      g.lineStyle(6, COLOR.butter, pulse);
      g.strokeRoundedRect(-PLAQUE.w / 2 - 10, -PLAQUE.h / 2 - 10, PLAQUE.w + 20, PLAQUE.h + 26, 30);
    });
    if (this.marker) this.marker.y += Math.sin(this.t * 6) * 0.25;
  }
}
