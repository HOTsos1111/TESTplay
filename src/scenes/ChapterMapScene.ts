import Phaser from 'phaser';
import { UPGRADES } from '../data/upgrades';
import { CHAPTERS } from '../data/chapters';
import { missingSkills } from '../systems/Skills';
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

/** Tile button size on the map, and how far above its blank sign it sits. */
const PLAQUE = { w: 176, h: 157, dy: -30 };
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
  private shopBig!: Button;
  private shopGlow!: Phaser.GameObjects.Graphics;
  private shopBadge!: Phaser.GameObjects.Graphics;
  private shopNote!: Phaser.GameObjects.Text;
  private canAfford = false;
  private marker: Phaser.GameObjects.Image | null = null;
  private t = 0;

  constructor() {
    super('ChapterMap');
  }

  preload(): void {
    if (!this.textures.exists('level_map')) this.load.image('level_map', 'ui/level_map.webp');
    if (!this.textures.exists('level_map_ghost')) this.load.image('level_map_ghost', 'ui/level_map_ghost.webp');
    for (const l of LEVELS) if (!this.textures.exists(`level_tile_${l.id}`)) this.load.image(`level_tile_${l.id}`, `ui/tile_0${l.id}.webp`);
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

    const shop = () => this.scene.start('Upgrade', { from: 'ChapterMap' });
    // The bone shop: a big button in the open corner of the map, plus a top-bar
    // shortcut. Both wave a red "!" while there is something you can afford.
    this.shopBig = new Button(this, 845, 628, 'UPGRADES', shop, { width: 188, height: 68, fontSize: 24, color: COLOR.coral, icon: 'bone', iconScale: 0.3 });
    this.fixedButtons = [
      new Button(this, 84, 38, '◀ Menu', () => this.scene.start('Title'), { width: 140, height: 48, fontSize: 20, color: 0x6f86a8 }),
      new Button(this, 1012, 38, 'Upgrades', shop, { width: 150, height: 48, fontSize: 19, icon: 'bone', iconScale: 0.26 }),
      this.shopBig,
    ];
    for (const b of this.fixedButtons) b.setDepth(D + 3);
    this.canAfford = UPGRADES.some((u) => {
      const lvl = progress.state.upgrades[u.key];
      return lvl < u.prices.length && progress.state.boneBalance >= u.prices[lvl];
    });
    this.shopGlow = this.add.graphics().setDepth(D + 2);
    this.shopBadge = this.add.graphics().setDepth(D + 4);
    this.shopNote = this.add.text(845, 580, this.canAfford ? 'You can afford an upgrade!' : 'Spend bones on new skills', { fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: '#FFFFFF', stroke: '#302331', strokeThickness: 5 }).setOrigin(0.5).setDepth(D + 4);

    // The hero waits on the furthest reachable level.
    const p = progress.state;
    const here = LEVELS.find((l) => this.stateOf(l) === 'open' && !p.completedChapters.includes(l.standIn ?? -1)) ?? LEVELS.filter((l) => this.stateOf(l) !== 'locked').pop() ?? LEVELS[0];
    // Nothing starts selected: the player picks the next level (the pup marks the furthest one).
    this.selected = 0;
    this.here = here.id;
    if (this.textures.exists('hero_s_idle')) {
      this.marker = this.add.image(here.map.x - PLAQUE.w / 2 - 4, here.map.y + PLAQUE.dy + PLAQUE.h / 2 + 6, 'hero_s_idle').setOrigin(0.5, 1).setScale(0.32).setDepth(D + 2);
    }

    const kb = this.input.keyboard;
    const step = (d: number) => {
      if (this.popup) return;
      if (!this.selected) this.select(this.here);
      else this.select(Phaser.Math.Clamp(this.selected + d, 1, LEVELS.length));
    };
    kb?.on('keydown-RIGHT', () => step(1));
    kb?.on('keydown-DOWN', () => step(1));
    kb?.on('keydown-TAB', () => step(1));
    kb?.on('keydown-LEFT', () => step(-1));
    kb?.on('keydown-UP', () => step(-1));
    kb?.on('keydown-ENTER', () => (this.tutorial ? this.goShop() : !this.popup && this.selected > 0 && this.choose(this.selected)));
    kb?.on('keydown-SPACE', () => (this.tutorial ? this.goShop() : !this.popup && this.selected > 0 && this.choose(this.selected)));
    kb?.on('keydown-ESC', () => {
      if (this.tutorial) this.endTutorial();
      else if (this.popup) this.closePopup();
      else this.scene.start('Title');
    });

    // First time back after a round: freeze the map and point at the shop.
    const played = p.boneBalance > 0 || p.completedChapters.length > 0 || Object.keys(p.bestRunByChapter).length > 0;
    if (played && !p.hintsSeen.includes('shop_tutorial')) {
      // Let the map finish appearing, then freeze it for the tip (see update).
      this.popup = this.add.container(0, 0);
      this.tutDelay = 0.9;
    }
  }

  private tutorial: Phaser.GameObjects.Container | null = null;
  private tutArrow: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics | null = null;
  /** The furthest playable level (where the pup waits). */
  private here = 1;
  private tutT = 0;
  private tutDelay = 0;

  /** Spotlight on the UPGRADES button: everything else dims and freezes until dismissed. */
  private startTutorial(): void {
    const D = DEPTH.hud + 20;
    const hole = { x: 845 - 118, y: 628 - 56, w: 236, h: 112 };
    const c = this.add.container(0, 0).setDepth(D);
    const dim = this.add.graphics();
    dim.fillStyle(0x1b1420, 0.78);
    dim.fillRect(0, 0, 1280, hole.y);
    dim.fillRect(0, hole.y + hole.h, 1280, 720 - hole.y - hole.h);
    dim.fillRect(0, hole.y, hole.x, hole.h);
    dim.fillRect(hole.x + hole.w, hole.y, 1280 - hole.x - hole.w, hole.h);
    c.add(dim);
    // Glowing frame round the spotlit button.
    const ring = this.add.graphics();
    ring.lineStyle(6, COLOR.butter, 1).strokeRoundedRect(hole.x, hole.y, hole.w, hole.h, 30);
    c.add(ring);
    // Instructions card.
    const card = this.add.graphics();
    card.fillStyle(COLOR.outline, 1).fillRoundedRect(150 - 6, 120 - 6, 700 + 12, 330 + 12, 34);
    card.fillStyle(PAPER, 1).fillRoundedRect(150, 120, 700, 330, 30);
    card.lineStyle(3, COLOR.teal, 0.8).strokeRoundedRect(162, 132, 676, 306, 22);
    c.add(card);
    if (this.textures.exists('hero_s_toy')) c.add(this.add.image(232, 210, 'hero_s_toy').setScale(0.42));
    const ink = (x: number, y: number, t: string, size: number, color: string, wrap = 0) =>
      c.add(this.add.text(x, y, t, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color, wordWrap: wrap ? { width: wrap } : undefined, lineSpacing: 4 }));
    ink(310, 150, 'Level up your pup!', 36, CSS.outline);
    ink(310, 200, `You have ${progress.state.boneBalance} bones to spend.`, 22, '#2E8B86');
    ink(185, 255, 'Cash in bones at the UPGRADES shop: jump higher, add sausage links of health, unlock Double Jump, the Speed Burst, Double Bark and your Boomerang Bone. Tougher levels and bosses need a tougher pup!', 20, '#5C4560', 630);
    ink(185, 392, 'Tap UPGRADES to go shopping  ·  tap anywhere else to explore', 18, '#C0573E');
    // A bouncing arrow from the card down to the button.
    const arrow = this.add.graphics();
    arrow.fillStyle(COLOR.butter, 1).lineStyle(5, COLOR.outline, 1);
    arrow.beginPath();
    arrow.moveTo(0, 0);
    arrow.lineTo(-30, -40);
    arrow.lineTo(-12, -40);
    arrow.lineTo(-12, -90);
    arrow.lineTo(12, -90);
    arrow.lineTo(12, -40);
    arrow.lineTo(30, -40);
    arrow.closePath();
    arrow.fillPath();
    arrow.strokePath();
    arrow.setPosition(845, 560).setRotation(-0.35);
    c.add(arrow);
    this.tutArrow = arrow;
    // One full-screen catcher: the spotlit button goes shopping, anywhere else closes.
    const hit = this.add.zone(640, 360, 1280, 720).setInteractive();
    hit.on('pointerup', (ptr: Phaser.Input.Pointer) => {
      const inHole = ptr.x >= hole.x && ptr.x <= hole.x + hole.w && ptr.y >= hole.y && ptr.y <= hole.y + hole.h;
      if (inHole) this.goShop();
      else this.endTutorial();
    });
    c.add(hit);
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 260 });
    // Freeze frame: the rest of the map stops moving while the tip is up.
    this.tweens.getTweens().forEach((tw) => tw.targets.includes(c) || tw.pause());
    this.tutorial = c;
    this.popup = c;
    Audio.play('ui_confirm');
  }

  private endTutorial(): void {
    if (!this.tutorial) return;
    progress.markHint('shop_tutorial');
    this.tutorial.destroy();
    this.tutorial = null;
    this.tutArrow = null;
    this.popup = null;
    this.tweens.resumeAll();
    Audio.play('ui_back');
  }

  private goShop(): void {
    if (!this.tutorial) return;
    progress.markHint('shop_tutorial');
    this.scene.start('Upgrade', { from: 'ChapterMap' });
  }

  /** The district's painted tile button, sitting over its blank sign on the map. */
  private makePlaque(l: LevelDef, i: number): Phaser.GameObjects.Container {
    const st = this.stateOf(l);
    const { w, h } = PLAQUE;
    const c = this.add.container(l.map.x, l.map.y + PLAQUE.dy).setDepth(DEPTH.hud + 1);
    // Soft drop shadow under the tile.
    const shade = this.add.graphics();
    shade.fillStyle(COLOR.outline, 0.35).fillRoundedRect(-w / 2 + 5, -h / 2 + 9, w, h, 22);
    c.add(shade);
    this.faces.push(this.add.graphics());
    c.add(this.faces[i]);
    const tile = this.add.image(0, 0, `level_tile_${l.id}`);
    tile.setScale(Math.min(w / tile.width, h / tile.height));
    c.add(tile);

    if (st === 'locked') {
      // Out of reach: greyed out, with a padlock over the picture.
      tile.setTint(0x8c8592);
      const lock = this.add.graphics();
      const ly = -8;
      lock.fillStyle(COLOR.outline, 0.45).fillCircle(0, ly + 4, 34);
      lock.lineStyle(9, COLOR.outline, 1).strokeCircle(0, ly - 12, 13);
      lock.lineStyle(5, PAPER, 1).strokeCircle(0, ly - 12, 13);
      lock.fillStyle(COLOR.outline, 1).fillRoundedRect(-22, ly - 6, 44, 34, 7);
      lock.fillStyle(COLOR.butter, 1).fillRoundedRect(-18, ly - 2, 36, 26, 5);
      lock.fillStyle(COLOR.outline, 1).fillCircle(0, ly + 9, 4);
      c.add(lock);
      c.setAlpha(0.92);
    }
    if (st === 'completed') {
      const tick = this.add.graphics();
      const sx = w / 2 - 12;
      const sy = -h / 2 + 12;
      tick.fillStyle(COLOR.outline, 1).fillCircle(sx, sy, 18);
      tick.fillStyle(0x5aa95a, 1).fillCircle(sx, sy, 15);
      tick.lineStyle(4.5, 0xffffff, 1).beginPath();
      tick.moveTo(sx - 8, sy).lineTo(sx - 2, sy + 6).lineTo(sx + 8, sy - 7).strokePath();
      c.add(tick);
    }

    c.setSize(w, h).setInteractive({ useHandCursor: true });
    c.on('pointerover', () => !this.popup && this.select(l.id, true));
    c.on('pointerdown', () => !this.popup && c.setScale(0.95));
    c.on('pointerout', () => c.setScale(1));
    c.on('pointerup', () => {
      c.setScale(1);
      if (!this.popup) this.choose(l.id);
    });
    // Tiles pop in along the route.
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
    const t = this.add.text(l.map.x, l.map.y + PLAQUE.dy - PLAQUE.h / 2 - 16, text, textStyle(18, CSS.white, 5)).setOrigin(0.5).setDepth(DEPTH.hud + 6);
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
    } else if (missingSkills(CHAPTERS.find((c) => c.id === l.standIn)!).length) {
      // The route needs a skill from the bone shop first.
      const need = missingSkills(CHAPTERS.find((c) => c.id === l.standIn)!).join(' and ');
      const t = this.add.text(0, by - 50, `Needs ${need}! Unlock it in the bone shop.`, { fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: '#C0573E', align: 'center', wordWrap: { width: W - 80 } }).setOrigin(0.5);
      box.add(t);
      const shop = new Button(this, 640, 380 + by + 4, 'Bone Shop', () => this.scene.start('Upgrade', { from: 'ChapterMap' }), { width: 260, height: 62, fontSize: 26, color: COLOR.coral, icon: 'bone', iconScale: 0.32 });
      this.popupButtons.push(shop);
    } else {
      const ch = l.standIn;
      // Every attempt plays the whole level (no skipping to the boss).
      const go = new Button(this, 640, 380 + by, COPY.start, () => this.scene.start('Game', { chapter: ch, startAt: 'start' }), { width: 280, height: 72, fontSize: 32, color: COLOR.coral, icon: 'ui_play', iconScale: 0.44 });
      this.tweens.add({ targets: go, scale: 1.05, yoyo: true, repeat: -1, duration: 650, ease: 'Sine.InOut' });
      this.popupButtons.push(go);
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
    if (this.tutDelay > 0) {
      this.tutDelay -= dt;
      if (this.tutDelay <= 0) {
        this.popup?.destroy();
        this.startTutorial();
      }
    }
    if (this.tutorial) {
      // Frozen map; only the arrow bobs.
      this.tutT += dt;
      this.tutArrow?.setY(560 + Math.sin(this.tutT * 6) * 8);
      return;
    }
    this.t += dt;
    // Upgrades call-out: a soft glow, a gentle bob and a red "!" when affordable.
    {
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 5);
      const g = this.shopGlow;
      g.clear();
      if (this.canAfford) {
        g.fillStyle(COLOR.butter, 0.25 + 0.25 * pulse).fillRoundedRect(845 - 108 - pulse * 4, 628 - 44 - pulse * 4, 216 + pulse * 8, 88 + pulse * 8, 36);
        this.shopBig.setScale(1 + 0.04 * pulse);
      }
      const b = this.shopBadge;
      b.clear();
      if (this.canAfford) {
        for (const [x, y, r] of [[845 + 88, 628 - 30, 16], [1012 + 70, 38 - 20, 13]] as const) {
          b.fillStyle(0x302331, 1).fillCircle(x, y, r + 3);
          b.fillStyle(0xe5533d, 1).fillCircle(x, y, r);
          b.fillStyle(0xffffff, 1).fillRect(x - 2.5, y - r * 0.55, 5, r * 0.65).fillCircle(x, y + r * 0.45, 2.8);
        }
      }
      this.shopNote.setY(580 - (this.canAfford ? pulse * 3 : 0));
    }
    // Pulsing ring on the selected plaque.
    const pulse = 0.55 + Math.sin(this.t * 5) * 0.45;
    this.faces.forEach((g, i) => {
      g.clear();
      if (i !== this.selected - 1) return;
      g.lineStyle(6, COLOR.butter, pulse);
      g.strokeRoundedRect(-PLAQUE.w / 2 - 8, -PLAQUE.h / 2 - 8, PLAQUE.w + 16, PLAQUE.h + 16, 28);
    });
    if (this.marker) this.marker.y += Math.sin(this.t * 6) * 0.25;
  }
}
