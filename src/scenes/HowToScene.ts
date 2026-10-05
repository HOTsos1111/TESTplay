import Phaser from 'phaser';
import { DEPTH } from '../data/config';
import { HeroView } from '../entities/HeroView';
import { ART_SCALE } from '../systems/AssetRegistry';
import { Audio } from '../systems/AudioManager';
import { InputManager } from '../systems/InputManager';
import { Backdrop } from '../ui/Backdrop';
import { Button, MenuNav } from '../ui/Button';
import { COLOR, CSS, FONT, textStyle } from '../ui/theme';
import { centerMenu } from '../ui/layout';

interface HowToData {
  /** Where "Let's go" leads: straight into chapter 1, or back to the title. */
  next?: 'game' | 'title';
}

/** Action badge colours, shared by the controls and the obstacles pages. */
const VERB = {
  JUMP: 0x42b7b0,
  HOVER: 0x2e8b86,
  'DOUBLE JUMP': 0x8a63c9,
  DUCK: 0x6f86a8,
  BARK: 0xf07562,
  SPEED: 0xf2a93b,
  'JUMP or BARK': 0x42b7b0,
  'SPEED + JUMP': 0xf2a93b,
  'DUCK · TIME IT': 0x6f86a8,
} as const;
type Verb = keyof typeof VERB;

interface Tile {
  verb: Verb;
  title: string;
  input?: { touch: string; keys: string };
  text: string;
  art: (scene: HowToScene, x: number, y: number) => void;
}

/**
 * "How to Play": two cleanly laid-out pages in the game's style. Page one
 * teaches the controls; page two shows every obstacle and how to beat it.
 */
export class HowToScene extends Phaser.Scene {
  private page = 0;
  private next: 'game' | 'title' = 'game';
  private layer!: Phaser.GameObjects.Container;
  private backdrop!: Backdrop;
  private nav!: MenuNav;
  private buttons: Button[] = [];
  private live: { h: HeroView; duck: boolean }[] = [];
  private bobbers: { o: Phaser.GameObjects.Image; y: number; p: number }[] = [];
  private t = 0;

  constructor() {
    super('HowTo');
  }

  get touch(): boolean {
    return this.sys.game.device.input.touch || InputManager.touchMode;
  }

  create(data: HowToData): void {
    this.next = data.next ?? 'game';
    this.page = 0;
    this.t = 0;
    this.backdrop = new Backdrop(this, 0.5, 18);
    centerMenu(this);
    this.layer = this.add.container(0, 0).setDepth(DEPTH.hud);
    this.nav = new MenuNav(this, [], () => this.leave());
    this.input.keyboard?.on('keydown-RIGHT', () => this.go(this.page + 1));
    this.input.keyboard?.on('keydown-LEFT', () => this.go(this.page - 1));
    this.render();
  }

  private go(p: number): void {
    if (p < 0) return;
    if (p > 1) {
      this.leave();
      return;
    }
    if (p === this.page) return;
    this.page = p;
    Audio.play('ui_select');
    this.render();
  }

  private leave(): void {
    if (this.next === 'game') this.scene.start('Game', { chapter: 1 });
    else this.scene.start('Title');
  }

  // ------------------------------------------------------------ drawing kit

  private card(x: number, y: number, w: number, h: number, fill = 0xfff6e2): void {
    const g = this.add.graphics();
    g.fillStyle(COLOR.outline, 0.3);
    g.fillRoundedRect(x - w / 2 + 6, y - h / 2 + 9, w, h, 26);
    g.fillStyle(COLOR.outline, 1);
    g.fillRoundedRect(x - w / 2 - 4, y - h / 2 - 4, w + 8, h + 8, 28);
    g.fillStyle(fill, 1);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 24);
    this.layer.add(g);
  }

  private pill(x: number, y: number, label: string, color: number, size = 18): number {
    const t = this.add.text(x, y, label, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color: CSS.white, stroke: CSS.outline, strokeThickness: 4 }).setOrigin(0.5);
    const w = t.width + 30;
    const h = size + 16;
    const g = this.add.graphics();
    g.fillStyle(COLOR.outline, 1);
    g.fillRoundedRect(x - w / 2 - 3, y - h / 2 - 3 + 2, w + 6, h + 6, (h + 6) / 2);
    g.fillStyle(color, 1);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, h / 2);
    g.fillStyle(0xffffff, 0.25);
    g.fillRoundedRect(x - w / 2 + 8, y - h / 2 + 3, w - 16, h * 0.35, h * 0.2);
    this.layer.add([g, t]);
    return w;
  }

  /** Soft coloured spotlight behind each tile's art. */
  private spot(x: number, y: number, color: number, r = 62): void {
    const g = this.add.graphics();
    g.fillStyle(color, 0.18);
    g.fillEllipse(x, y, r * 2.6, r * 1.7);
    g.fillStyle(color, 0.12);
    g.fillEllipse(x, y + r * 0.55, r * 2.2, r * 0.5);
    this.layer.add(g);
  }

  img(x: number, y: number, key: string, scale: number, bob = false, originY = 0.5): Phaser.GameObjects.Image {
    const i = this.add.image(x, y, key).setScale(scale).setOrigin(0.5, originY);
    this.layer.add(i);
    if (bob) this.bobbers.push({ o: i, y, p: Math.random() * 6 });
    return i;
  }

  label(x: number, y: number, text: string, size: number, color: string = CSS.outline, wrap = 0, stroke = 0): Phaser.GameObjects.Text {
    const t = this.add
      .text(x, y, text, {
        fontFamily: FONT,
        fontSize: `${size}px`,
        fontStyle: 'bold',
        color,
        align: 'center',
        stroke: CSS.outline,
        strokeThickness: stroke,
        wordWrap: wrap ? { width: wrap } : undefined,
        lineSpacing: 2,
      })
      .setOrigin(0.5, 0);
    this.layer.add(t);
    return t;
  }

  liveHero(x: number, y: number, scale: number, ducking: boolean): void {
    const h = new HeroView(this, x, y);
    h.root.setScale(scale);
    h.setMode('play');
    this.layer.add(h.root);
    this.live.push({ h, duck: ducking });
  }

  private tile(t: Tile, x: number, y: number, w: number, h: number): void {
    this.card(x, y, w, h);
    const artY = y - h / 2 + 70;
    this.spot(x, artY + 6, VERB[t.verb]);
    t.art(this, x, artY);
    let ty = y - h / 2 + 136;
    this.pill(x, ty, t.verb, VERB[t.verb], 16);
    ty += 20;
    this.label(x, ty, t.title, 21, CSS.outline);
    ty += 26;
    if (t.input) {
      this.label(x, ty, this.touch ? t.input.touch : t.input.keys, 16, '#2E8B86', w - 30);
      ty += 21;
    }
    this.label(x, ty, t.text, 15, '#5C4560', w - 36);
  }

  private header(title: string, sub: string): void {
    const t = this.add.text(640, 22, title, textStyle(52, CSS.butter, 10)).setOrigin(0.5, 0);
    t.setShadow(0, 5, CSS.outline, 0, true, true);
    this.layer.add(t);
    this.layer.add(this.add.image(640 - t.width / 2 - 34, 52, 'ui_paw').setScale(0.7).setRotation(-0.3));
    this.layer.add(this.add.image(640 + t.width / 2 + 34, 52, 'ui_paw').setScale(0.7).setRotation(0.3));
    this.label(640, 88, sub, 20, CSS.cream, 0, 4);
    // Page dots.
    for (let i = 0; i < 2; i++) {
      const g = this.add.graphics();
      g.fillStyle(COLOR.outline, 1).fillCircle(616 + i * 48, 690, 11);
      g.fillStyle(i === this.page ? COLOR.butter : 0xfff6e2, 1).fillCircle(616 + i * 48, 690, 7.5);
      this.layer.add(g);
    }
  }

  // ------------------------------------------------------------ pages

  private render(): void {
    this.layer.removeAll(true);
    for (const l of this.live) l.h.destroy();
    this.live = [];
    this.bobbers = [];
    for (const b of this.buttons) b.destroy();
    this.buttons = [];
    if (this.page === 0) this.controlsPage();
    else this.obstaclesPage();

    const back = new Button(this, 150, 676, this.page === 0 ? 'Skip' : '◀ Back', () => (this.page === 0 ? this.leave() : this.go(0)), { width: 200, height: 56, fontSize: 24, color: 0x6f86a8 });
    const fwd = new Button(this, 1130, 676, this.page === 0 ? 'Obstacles ▶' : this.next === 'game' ? "Let's Go!" : 'Got it!', () => this.go(this.page + 1), {
      width: 240,
      height: 60,
      fontSize: 26,
      color: this.page === 0 ? COLOR.teal : COLOR.coral,
      icon: this.page === 1 ? 'ui_play' : undefined,
      iconScale: 0.42,
    });
    this.buttons = [back, fwd];
    for (const b of this.buttons) b.setDepth(DEPTH.hud + 2);
    this.nav.setButtons([fwd, back]);
  }

  private controlsPage(): void {
    this.header('How to Play', this.touch ? 'Left thumb: the stick.  Right thumb: BARK and SPEED.' : 'Arrow keys / WASD to move.  X to bark.  Shift for speed.');
    const tiles: Tile[] = [
      {
        verb: 'JUMP',
        title: 'Hop & Leap',
        input: { touch: 'Push the stick UP', keys: 'Space / ↑ / W' },
        text: 'Tap for a hop, hold for a big leap.',
        art: (s, x, y) => {
          s.img(x - 62, y + 6, 'ui_stick_up', 0.42);
          s.img(x + 34, y + 2, 'hero_s_leap', ART_SCALE * 0.62, true);
        },
      },
      {
        verb: 'HOVER',
        title: 'Propeller Tail',
        input: { touch: 'Keep holding UP in the air', keys: 'Keep holding jump in the air' },
        text: 'Spin your tail to float over gaps. It recharges on the ground.',
        art: (s, x, y) => s.img(x, y, 'hero_s_prop', ART_SCALE * 0.72, true),
      },
      {
        verb: 'DOUBLE JUMP',
        title: 'Double Jump',
        input: { touch: 'Let go, then UP again mid-air', keys: 'Press jump again mid-air' },
        text: 'A second leap at the top: up and over tall towers.',
        art: (s, x, y) => {
          s.img(x - 40, y + 24, 'hero_s_leap', ART_SCALE * 0.48);
          s.img(x + 38, y - 14, 'hero_s_leap', ART_SCALE * 0.48, true).setRotation(-0.25);
          s.label(x + 2, y - 46, '×2', 26, CSS.white, 0, 6);
        },
      },
      {
        verb: 'DUCK',
        title: 'Duck',
        input: { touch: 'Pull the stick DOWN', keys: '↓ / S' },
        text: 'Belly to the floor to slide under pipes.',
        art: (s, x, y) => {
          s.img(x - 70, y + 6, 'ui_stick_down', 0.4);
          s.liveHero(x + 30, y + 44, 0.72, true);
        },
      },
      {
        verb: 'BARK',
        title: 'Big Bark',
        input: { touch: 'Tap BARK', keys: 'X / K' },
        text: 'Scares squirrels off, blasts nuts and bursts cracked boxes.',
        art: (s, x, y) => {
          s.img(x - 46, y + 4, 'hero_s_bark', ART_SCALE * 0.64, true);
          s.img(x + 52, y + 4, 'btn_bark', ART_SCALE * 0.8);
        },
      },
      {
        verb: 'SPEED',
        title: 'Speed Burst',
        input: { touch: 'Tap SPEED when it’s full', keys: 'Shift / C' },
        text: 'Stretch… SNAP! Zoom across long gaps marked with arrows.',
        art: (s, x, y) => {
          s.img(x - 50, y + 4, 'btn_burst', ART_SCALE * 0.8);
          s.img(x + 42, y + 30, 'burst_marker', ART_SCALE * 0.8);
          s.img(x + 42, y - 12, 'hero_s_run', ART_SCALE * 0.5, true);
        },
      },
    ];
    const w = 372;
    const h = 238;
    tiles.forEach((t, i) => this.tile(t, 640 + ((i % 3) - 1) * (w + 26), 240 + Math.floor(i / 3) * (h + 16), w, h));
    this.label(640, 614, this.touch ? 'Push the stick left / right to pace yourself on screen.' : '← → (A / D) pace you back and forth on screen.', 18, CSS.cream, 0, 4);
  }

  private obstaclesPage(): void {
    this.header('Obstacles & Hazards', 'Each one has a trick. Every hit costs a sausage!');
    const tiles: Tile[] = [
      { verb: 'JUMP', title: 'Tyres & Cones', text: 'Hop right over them.', art: (s, x, y) => {
        s.img(x - 34, y + 34, 'tyre', ART_SCALE * 1.2, false, 1);
        s.img(x + 40, y + 34, 'hazard_cone', ART_SCALE * 1.1, false, 1);
      } },
      { verb: 'JUMP or BARK', title: 'Nut Piles', text: 'Squirrels lob them onto the path. Jump them or bark them away.', art: (s, x, y) => s.img(x, y + 30, 'nut_pile', ART_SCALE * 2.2, true, 1) },
      { verb: 'BARK', title: 'Squirrels', text: 'Nutso’s minions pelt you. Bark when they come close!', art: (s, x, y) => s.img(x, y + 44, 'squirrel_throw', 0.66, true, 1) },
      { verb: 'BARK', title: 'Cracked Parcels', text: 'Too tall to jump? A big bark bursts the stack.', art: (s, x, y) => {
        s.img(x, y + 42, 'cardboard', ART_SCALE * 0.95, false, 1);
        s.img(x, y + 42 - 44, 'cardboard', ART_SCALE * 0.95, false, 1);
      } },
      { verb: 'DUCK · TIME IT', title: 'Pumping Pipes', text: 'Duck under, or dash beneath when high. Watch the slam!', art: (s, x, y) => s.img(x, y + 20, 'lowbar', ART_SCALE * 1.15, true) },
      { verb: 'JUMP', title: 'Wheelie Bins', text: 'They roll at you. Time a hop over the top.', art: (s, x, y) => s.img(x, y + 46, 'barrel', ART_SCALE * 1.4, true, 1) },
      { verb: 'DOUBLE JUMP', title: 'Crate Towers', text: 'Leap, then leap again at the top to clear them.', art: (s, x, y) => {
        s.img(x - 16, y + 44, 'crate', ART_SCALE * 0.72, false, 1);
        s.img(x - 16, y + 44 - 46, 'crate_parcel', ART_SCALE * 0.72, false, 1);
        s.img(x + 32, y + 44, 'crate_parcel', ART_SCALE * 0.72, false, 1);
      } },
      { verb: 'SPEED + JUMP', title: 'Long Gaps', text: 'Arrows on the floor mean: BURST, then jump and hover!', art: (s, x, y) => {
        s.img(x, y + 30, 'burst_marker', ART_SCALE * 1.1);
        s.img(x, y - 6, 'hero_s_leap', ART_SCALE * 0.5, true);
      } },
    ];
    const w = 286;
    const h = 226;
    tiles.forEach((t, i) => this.tile(t, 640 + ((i % 4) - 1.5) * (w + 18), 232 + Math.floor(i / 4) * (h + 14), w, h));
    // Pickups strip: icon + label pairs laid out left to right.
    const y = 627;
    const items: [string[], string][] = [
      [['bone'], 'Bones buy gear'],
      [['hp_link_full'], 'Sausages = health'],
      [['pu_magnet', 'pu_shield', 'pu_bacon'], 'Grab power-up bubbles!'],
    ];
    const parts: { keys: string[]; text: Phaser.GameObjects.Text; w: number }[] = items.map(([keys, label]) => {
      const text = this.label(0, y - 11, label, 17, CSS.white, 0, 4).setOrigin(0, 0);
      return { keys, text, w: keys.length * 34 + 8 + text.width };
    });
    const gap = 36;
    const total = parts.reduce((a, p) => a + p.w, 0) + gap * (parts.length - 1);
    const g = this.add.graphics();
    g.fillStyle(COLOR.outline, 0.62).fillRoundedRect(640 - total / 2 - 22, y - 24, total + 44, 48, 24);
    this.layer.addAt(g, 0);
    let x = 640 - total / 2;
    for (const p of parts) {
      p.keys.forEach((k, i) => this.img(x + 15 + i * 34, y, k, ART_SCALE * (k === 'hp_link_full' ? 1 : k === 'bone' ? 0.85 : 0.6)));
      p.text.setX(x + p.keys.length * 34 + 8);
      x += p.w + gap;
    }
  }

  update(_t: number, dms: number): void {
    const dt = Math.min(dms / 1000, 0.1);
    this.t += dt;
    this.backdrop.update(dt);
    for (const b of this.bobbers) b.o.y = b.y - Math.abs(Math.sin(this.t * 3 + b.p)) * 5;
    for (const l of this.live) l.h.update(dt, { grounded: true, vy: 0, hovering: false, speed: 300, invulnerable: 0, ducking: l.duck });
  }
}
