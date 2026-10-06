import Phaser from 'phaser';
import { DEPTH, TUNING } from '../data/config';
import { ART_SCALE } from '../systems/AssetRegistry';
import { COLOR, CSS, textStyle } from './theme';

export interface HudState {
  hearts: number;
  bones: number;
  metres: number;
  wagFraction: number;
  hovering: boolean;
  burstFraction: number;
  bursting: boolean;
  powerups: { icon: string; frac: number }[];
  /** 0..1 along the route to the checkpoint gate. */
  progress: number;
  barkCooldown: number;
  bossHits: number | null;
  bossMax: number;
  bossTitle: string;
  bossIcon: string;
}

/** In-game HUD. All text is live; icons come from the asset registry. */
export class Hud {
  private hearts: Phaser.GameObjects.Image[] = [];
  private boneText: Phaser.GameObjects.Text;
  private distText: Phaser.GameObjects.Text;
  private wagIcon: Phaser.GameObjects.Image;
  private wagBar: Phaser.GameObjects.Graphics;
  private burstIcon: Phaser.GameObjects.Image;
  private barkIcon: Phaser.GameObjects.Image;
  private bossLabel: Phaser.GameObjects.Text;
  private bossPips: Phaser.GameObjects.Graphics;
  private bossIcon: Phaser.GameObjects.Image;
  private bossCount: Phaser.GameObjects.Text;
  /** Displayed remaining fraction (eases down) and the white "damage" ghost behind it. */
  private bossShown = 1;
  private bossGhost = 1;
  private bossShake = 0;
  private lastBossHits = -1;
  private hint: Phaser.GameObjects.Container;
  private hintText: Phaser.GameObjects.Text;
  private hintBg: Phaser.GameObjects.Graphics;
  private hintT = 0;
  readonly pauseButton: Phaser.GameObjects.Image;
  private lastHearts = -1;
  private mini!: Phaser.GameObjects.Graphics;
  private miniDog!: Phaser.GameObjects.Image;
  private miniInfo: { zones: { from: number; color: number }[]; marks: number[] } = { zones: [], marks: [] };
  private puIcons: Phaser.GameObjects.Image[] = [];
  private puRings!: Phaser.GameObjects.Graphics;
  /** Extra width beyond the 1280 design width (right-side items shift by this). */
  private dx = 0;
  private rightItems: { o: Phaser.GameObjects.Components.Transform; x: number }[] = [];
  private centerItems: { o: Phaser.GameObjects.Components.Transform; x: number }[] = [];
  private heartFlash = 0;

  constructor(private scene: Phaser.Scene, onPause: () => void) {
    const fixed = <T extends Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth>(o: T): T => {
      o.setScrollFactor(0);
      o.setDepth(DEPTH.hud);
      return o;
    };
    for (let i = 0; i < TUNING.maxHearts; i++) {
      this.hearts.push(fixed(scene.add.image(40 + i * 42, 42, 'hp_link_full').setScale(ART_SCALE * 1.15)));
    }
    fixed(scene.add.image(48, 94, 'bone').setScale(ART_SCALE * 1.05));
    this.boneText = fixed(scene.add.text(76, 94, '0', textStyle(26)).setOrigin(0, 0.5));
    this.distText = fixed(scene.add.text(26, 132, '0 m', textStyle(22, CSS.cream)).setOrigin(0, 0.5));

    this.wagIcon = fixed(scene.add.image(960, 42, 'icon_tail').setScale(ART_SCALE * 1.2));
    this.wagBar = fixed(scene.add.graphics());
    // Bark and burst recharge now show on their own action buttons (TouchControls).
    this.burstIcon = fixed(scene.add.image(880, 84, 'icon_burst').setVisible(false));
    this.barkIcon = fixed(scene.add.image(1140, 42, 'icon_bark').setVisible(false));
    this.pauseButton = fixed(scene.add.image(1228, 42, 'icon_pause').setScale(ART_SCALE * 1.4));
    this.pauseButton.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      onPause();
    });

    // Boss bar: name, portrait, a big segmented health bar and a count.
    this.bossPips = fixed(scene.add.graphics());
    this.bossLabel = fixed(scene.add.text(640, 76, '', textStyle(26, CSS.butter, 6)).setOrigin(0.5).setVisible(false));
    this.bossIcon = fixed(scene.add.image(352, 112, 'squirrel_taunt').setScale(0.42).setVisible(false));
    this.bossCount = fixed(scene.add.text(930, 112, '', textStyle(24, CSS.white, 5)).setOrigin(0, 0.5).setVisible(false));

    this.hintBg = scene.add.graphics();
    this.hintText = scene.add.text(0, 0, '', textStyle(28)).setOrigin(0.5);
    this.hint = fixed(scene.add.container(640, 160, [this.hintBg, this.hintText]).setVisible(false));

    this.mini = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.hud);
    this.miniDog = scene.add.image(0, 26, 'hero_head').setScale(ART_SCALE * 0.42).setScrollFactor(0).setDepth(DEPTH.hud + 1);
    this.puRings = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.hud);
    for (let i = 0; i < 4; i++) this.puIcons.push(scene.add.image(48 + i * 58, 182, 'pu_magnet').setScrollFactor(0).setDepth(DEPTH.hud + 1).setScale(ART_SCALE * 0.85).setVisible(false));
    this.rightItems = [this.wagIcon, this.burstIcon, this.barkIcon, this.pauseButton].map((o) => ({ o, x: o.x }));
    this.centerItems = [this.bossLabel, this.bossIcon, this.bossCount, this.hint].map((o) => ({ o, x: o.x }));
    this.layout(scene.scale.width);
  }

  /**
   * Mini-map: zones as fractions (0..1) of the route to the checkpoint gate,
   * plus marker fractions (burst gaps).
   */
  setMinimap(zones: { from: number; color: number }[], marks: number[]): void {
    this.miniInfo = { zones, marks };
  }

  private drawMinimap(progress: number): void {
    const g = this.mini;
    const w = 380;
    const x0 = 640 + this.dx / 2 - w / 2;
    const y = 26;
    g.clear();
    g.fillStyle(COLOR.outline, 0.75);
    g.fillRoundedRect(x0 - 14, y - 13, w + 50, 26, 13);
    const zs = this.miniInfo.zones.length ? this.miniInfo.zones : [{ from: 0, color: COLOR.cream }];
    zs.forEach((z, i) => {
      const to = zs[i + 1]?.from ?? 1;
      g.fillStyle(z.color, 0.45);
      g.fillRect(x0 + z.from * w, y - 4, (to - z.from) * w, 8);
    });
    g.fillStyle(COLOR.butter, 1);
    g.fillRect(x0, y - 4, Math.max(0, Math.min(1, progress)) * w, 8);
    for (const m of this.miniInfo.marks) {
      g.fillStyle(COLOR.coral, 1);
      g.fillTriangle(x0 + m * w - 5, y - 10, x0 + m * w + 5, y - 10, x0 + m * w, y - 3);
    }
    // Gate + dogcatcher at the end.
    g.fillStyle(COLOR.white, 1);
    g.fillRect(x0 + w - 2, y - 11, 4, 22);
    g.fillStyle(0x4f6aa3, 1);
    g.fillCircle(x0 + w + 20, y, 8);
    g.lineStyle(2, COLOR.outline, 1);
    g.strokeCircle(x0 + w + 20, y, 8);
    this.miniDog.setPosition(x0 + Math.max(0, Math.min(1, progress)) * w, y - 2);
  }

  /** Reposition for the current game width (right items hug the right edge). */
  layout(width: number): void {
    this.dx = Math.max(0, width - 1280);
    for (const r of this.rightItems) r.o.x = r.x + this.dx;
    for (const c of this.centerItems) c.o.x = c.x + this.dx / 2;
  }

  showHint(text: string, seconds = 3.2): void {
    this.hintText.setText(text);
    const w = this.hintText.width + 48;
    const h = this.hintText.height + 22;
    this.hintBg.clear();
    this.hintBg.fillStyle(COLOR.outline, 0.78);
    this.hintBg.fillRoundedRect(-w / 2, -h / 2, w, h, 18);
    this.hintBg.lineStyle(3, COLOR.cream, 0.9);
    this.hintBg.strokeRoundedRect(-w / 2, -h / 2, w, h, 18);
    this.hint.setVisible(true).setAlpha(1).setScale(0.9);
    this.hintT = seconds;
  }

  /** Big centred chapter card / banner that fades on its own. */
  banner(title: string, sub: string, seconds = 2.4): void {
    const cx = 640 + this.dx / 2;
    const t1 = this.scene.add.text(cx, 300, title, textStyle(56, CSS.butter, 10)).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.hud + 1);
    const t2 = this.scene.add.text(cx, 366, sub, textStyle(28, CSS.white)).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.hud + 1);
    for (const t of [t1, t2]) {
      t.setAlpha(0);
      this.scene.tweens.add({ targets: t, alpha: 1, duration: 250 });
      this.scene.tweens.add({ targets: t, alpha: 0, delay: seconds * 1000, duration: 400, onComplete: () => t.destroy() });
    }
  }

  update(dt: number, s: HudState): void {
    this.drawMinimap(s.progress);
    if (this.lastHearts !== s.hearts) {
      if (this.lastHearts > s.hearts) this.heartFlash = 0.5;
      this.lastHearts = s.hearts;
    }
    this.heartFlash = Math.max(0, this.heartFlash - dt);
    this.hearts.forEach((h, i) => {
      const key = i < s.hearts ? 'hp_link_full' : i === s.hearts && this.heartFlash > 0 ? 'hp_link_lost' : 'hp_link_empty';
      if (h.texture.key !== key) h.setTexture(key);
      h.setScale(ART_SCALE * (1.15 + (i === s.hearts && this.heartFlash > 0 ? this.heartFlash * 0.6 : 0)));
    });
    this.boneText.setText(String(s.bones));
    this.distText.setText(`${s.metres} m`);

    // Wag meter.
    const empty = s.wagFraction <= 0.001;
    this.wagIcon.setTexture(empty ? 'icon_tail_empty' : 'icon_tail');
    if (s.hovering) this.wagIcon.rotation -= dt * 20;
    else this.wagIcon.rotation *= 0.9;
    const bx = 986 + this.dx;
    const by = 32;
    const bw = 170;
    const bh = 20;
    const g = this.wagBar;
    g.clear();
    g.fillStyle(COLOR.outline, 0.85);
    g.fillRoundedRect(bx - 3, by - 3, bw + 6, bh + 6, 12);
    g.fillStyle(0x5c4560, 1);
    g.fillRoundedRect(bx, by, bw, bh, 9);
    if (!empty) {
      g.fillStyle(s.wagFraction > 0.3 ? COLOR.teal : COLOR.coral, 1);
      g.fillRoundedRect(bx, by, Math.max(18, bw * s.wagFraction), bh, 9);
      g.fillStyle(0xffffff, 0.3);
      g.fillRoundedRect(bx + 4, by + 3, Math.max(10, bw * s.wagFraction - 8), 5, 3);
    } else {
      // Empty state uses a hatch pattern so it reads without colour.
      g.lineStyle(2, 0x9a8e9c, 1);
      for (let x = bx + 6; x < bx + bw; x += 12) g.lineBetween(x, by + bh - 3, x + 8, by + 3);
    }

    // Active power-ups with a countdown ring.
    this.puRings.clear();
    this.puIcons.forEach((img, i) => {
      const p = s.powerups[i];
      img.setVisible(!!p);
      if (!p) return;
      img.setTexture(p.icon);
      const blink = p.frac < 0.2 && Math.floor(performance.now() / 120) % 2 === 0;
      img.setAlpha(blink ? 0.4 : 1);
      const x = 48 + i * 58;
      this.puRings.fillStyle(COLOR.outline, 0.7);
      this.puRings.fillCircle(x, 182, 25);
      this.puRings.lineStyle(5, COLOR.butter, 1);
      this.puRings.beginPath();
      this.puRings.arc(x, 182, 25, -Math.PI / 2, -Math.PI / 2 + Math.max(0.01, p.frac) * Math.PI * 2);
      this.puRings.strokePath();
    });

    // Boss bar.
    this.drawBossBar(dt, s);

    if (this.hintT > 0) {
      this.hintT -= dt;
      this.hint.setScale(Math.min(1, this.hint.scale + dt * 2));
      if (this.hintT < 0.4) this.hint.setAlpha(Math.max(0, this.hintT / 0.4));
      if (this.hintT <= 0) this.hint.setVisible(false);
    }
  }

  private drawBossBar(dt: number, s: HudState): void {
    const g = this.bossPips;
    g.clear();
    const on = s.bossHits !== null;
    this.bossLabel.setVisible(on);
    this.bossIcon.setVisible(on);
    this.bossCount.setVisible(on);
    if (!on) {
      this.lastBossHits = -1;
      return;
    }
    const hits = s.bossHits ?? 0;
    const left = Math.max(0, s.bossMax - hits);
    const frac = left / Math.max(1, s.bossMax);
    if (this.lastBossHits >= 0 && hits > this.lastBossHits) this.bossShake = 0.35;
    if (this.lastBossHits < 0) this.bossShown = this.bossGhost = frac;
    this.lastBossHits = hits;
    this.bossShown += (frac - this.bossShown) * Math.min(1, dt * 14);
    // The white ghost lingers, then drains after the real bar.
    if (this.bossGhost > this.bossShown) this.bossGhost = Math.max(this.bossShown, this.bossGhost - dt * (this.bossShake > 0 ? 0 : 0.6));
    this.bossShake = Math.max(0, this.bossShake - dt);
    const shake = this.bossShake > 0 ? Math.sin(this.bossShake * 90) * 5 * (this.bossShake / 0.35) : 0;

    const cx = 640 + this.dx / 2 + shake;
    const w = 520;
    const h = 30;
    const x = cx - w / 2;
    const y = 98;
    this.bossLabel.setText(s.bossTitle).setX(cx);
    if (this.bossIcon.texture.key !== s.bossIcon && s.bossIcon) this.bossIcon.setTexture(s.bossIcon);
    this.bossIcon.setPosition(x - 34, y + h / 2 - 2).setScale(s.bossIcon.startsWith('squirrel') ? 0.42 : ART_SCALE * 0.5);
    this.bossCount.setText(`${left} / ${s.bossMax}`).setPosition(x + w + 16, y + h / 2);
    // Frame.
    g.fillStyle(COLOR.outline, 0.45).fillRoundedRect(x - 70, y - 44, w + 160, h + 60, 22);
    g.fillStyle(COLOR.outline, 1).fillRoundedRect(x - 5, y - 5, w + 10, h + 10, 12);
    g.fillStyle(0x4a3550, 1).fillRoundedRect(x, y, w, h, 9);
    // Ghost (recent damage) then the live bar with a gloss strip.
    if (this.bossGhost > 0.001) g.fillStyle(0xfff6e2, 0.9).fillRoundedRect(x, y, w * this.bossGhost, h, 9);
    if (this.bossShown > 0.001) {
      const low = frac <= 0.3;
      g.fillStyle(low ? 0xe0503f : 0xf07562, 1).fillRoundedRect(x, y, w * this.bossShown, h, 9);
      g.fillStyle(0xffffff, 0.3).fillRoundedRect(x + 6, y + 4, Math.max(0, w * this.bossShown - 12), h * 0.32, 5);
    }
    // One notch per enemy.
    g.lineStyle(3, COLOR.outline, 0.8);
    for (let i = 1; i < s.bossMax; i++) {
      const nx = x + (w * i) / s.bossMax;
      g.lineBetween(nx, y + 2, nx, y + h - 2);
    }
    g.lineStyle(3, COLOR.outline, 1).strokeRoundedRect(x, y, w, h, 9);
  }
}
