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
  barkCooldown: number;
  bossHits: number | null;
  bossMax: number;
}

/** In-game HUD. All text is live; icons come from the asset registry. */
export class Hud {
  private hearts: Phaser.GameObjects.Image[] = [];
  private boneText: Phaser.GameObjects.Text;
  private distText: Phaser.GameObjects.Text;
  private wagIcon: Phaser.GameObjects.Image;
  private wagBar: Phaser.GameObjects.Graphics;
  private burstIcon: Phaser.GameObjects.Image;
  private burstBar: Phaser.GameObjects.Graphics;
  private burstReadyT = 0;
  private lastBurst = 1;
  private barkIcon: Phaser.GameObjects.Image;
  private barkDial: Phaser.GameObjects.Graphics;
  private bossLabel: Phaser.GameObjects.Text;
  private bossPips: Phaser.GameObjects.Graphics;
  private hint: Phaser.GameObjects.Container;
  private hintText: Phaser.GameObjects.Text;
  private hintBg: Phaser.GameObjects.Graphics;
  private hintT = 0;
  readonly pauseButton: Phaser.GameObjects.Image;
  private lastHearts = -1;
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
      this.hearts.push(fixed(scene.add.image(44 + i * 46, 42, 'heart_full').setScale(ART_SCALE * 1.1)));
    }
    fixed(scene.add.image(48, 94, 'bone').setScale(ART_SCALE * 1.05));
    this.boneText = fixed(scene.add.text(76, 94, '0', textStyle(26)).setOrigin(0, 0.5));
    this.distText = fixed(scene.add.text(26, 132, '0 m', textStyle(22, CSS.cream)).setOrigin(0, 0.5));

    this.wagIcon = fixed(scene.add.image(880, 42, 'icon_tail').setScale(ART_SCALE * 1.2));
    this.wagBar = fixed(scene.add.graphics());
    this.burstIcon = fixed(scene.add.image(880, 84, 'icon_burst').setScale(ART_SCALE * 1.2));
    this.burstBar = fixed(scene.add.graphics());
    this.barkIcon = fixed(scene.add.image(1140, 42, 'icon_bark').setScale(ART_SCALE * 1.2));
    this.barkDial = fixed(scene.add.graphics());
    this.pauseButton = fixed(scene.add.image(1228, 42, 'icon_pause').setScale(ART_SCALE * 1.4));
    this.pauseButton.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      onPause();
    });

    this.bossLabel = fixed(scene.add.text(640, 34, 'LATCH', textStyle(20, CSS.butter)).setOrigin(0.5).setVisible(false));
    this.bossPips = fixed(scene.add.graphics());

    this.hintBg = scene.add.graphics();
    this.hintText = scene.add.text(0, 0, '', textStyle(28)).setOrigin(0.5);
    this.hint = fixed(scene.add.container(640, 160, [this.hintBg, this.hintText]).setVisible(false));

    this.puRings = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.hud);
    for (let i = 0; i < 4; i++) this.puIcons.push(scene.add.image(48 + i * 58, 182, 'pu_magnet').setScrollFactor(0).setDepth(DEPTH.hud + 1).setScale(ART_SCALE * 0.85).setVisible(false));
    this.rightItems = [this.wagIcon, this.burstIcon, this.barkIcon, this.pauseButton].map((o) => ({ o, x: o.x }));
    this.centerItems = [this.bossLabel, this.hint].map((o) => ({ o, x: o.x }));
    this.layout(scene.scale.width);
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
    if (this.lastHearts !== s.hearts) {
      if (this.lastHearts > s.hearts) this.heartFlash = 0.5;
      this.lastHearts = s.hearts;
    }
    this.heartFlash = Math.max(0, this.heartFlash - dt);
    this.hearts.forEach((h, i) => {
      const key = i < s.hearts ? 'heart_full' : i === s.hearts && this.heartFlash > 0 ? 'heart_lost' : 'heart_empty';
      if (h.texture.key !== key) h.setTexture(key);
      h.setScale(ART_SCALE * (1.1 + (i === s.hearts && this.heartFlash > 0 ? this.heartFlash * 0.6 : 0)));
    });
    this.boneText.setText(String(s.bones));
    this.distText.setText(`${s.metres} m`);

    // Wag meter.
    const empty = s.wagFraction <= 0.001;
    this.wagIcon.setTexture(empty ? 'icon_tail_empty' : 'icon_tail');
    if (s.hovering) this.wagIcon.rotation -= dt * 20;
    else this.wagIcon.rotation *= 0.9;
    const bx = 906 + this.dx;
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

    // Burst meter: fills slowly; flashes when ready.
    if (s.burstFraction >= 1 && this.lastBurst < 1) this.burstReadyT = 0.6;
    this.lastBurst = s.burstFraction;
    this.burstReadyT = Math.max(0, this.burstReadyT - dt);
    const ready = s.burstFraction >= 1;
    this.burstIcon.setTexture(ready || s.bursting ? 'icon_burst' : 'icon_burst_empty');
    this.burstIcon.setScale(ART_SCALE * (1.2 + this.burstReadyT * 0.6 + (ready ? Math.sin(performance.now() / 120) * 0.06 : 0)));
    const ub = this.burstBar;
    const uy = 74;
    ub.clear();
    ub.fillStyle(COLOR.outline, 0.85);
    ub.fillRoundedRect(bx - 3, uy - 3, bw + 6, 20 + 6, 12);
    ub.fillStyle(0x5c4560, 1);
    ub.fillRoundedRect(bx, uy, bw, 20, 9);
    const bf = s.bursting ? 1 : s.burstFraction;
    if (bf > 0.02) {
      ub.fillStyle(ready || s.bursting ? COLOR.butter : 0xc9a34a, 1);
      ub.fillRoundedRect(bx, uy, Math.max(18, bw * bf), 20, 9);
    }
    if (ready) {
      ub.lineStyle(3, COLOR.white, 0.6 + Math.sin(performance.now() / 120) * 0.4);
      ub.strokeRoundedRect(bx - 3, uy - 3, bw + 6, 26, 12);
    }

    // Bark cooldown dial.
    const d = this.barkDial;
    d.clear();
    const barkReady = s.barkCooldown <= 0;
    const dialX = 1140 + this.dx;
    this.barkIcon.setAlpha(barkReady ? 1 : 0.45);
    d.lineStyle(5, COLOR.outline, 0.9);
    d.strokeCircle(dialX, 42, 26);
    if (!barkReady) {
      const k = 1 - s.barkCooldown / TUNING.barkCooldown;
      d.lineStyle(5, COLOR.coral, 1);
      d.beginPath();
      d.arc(dialX, 42, 26, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
      d.strokePath();
    } else {
      d.lineStyle(3, COLOR.butter, 1);
      d.strokeCircle(dialX, 42, 26);
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

    // Boss pips.
    this.bossPips.clear();
    this.bossLabel.setVisible(s.bossHits !== null);
    if (s.bossHits !== null) {
      for (let i = 0; i < s.bossMax; i++) {
        const x = 640 + this.dx / 2 + (i - (s.bossMax - 1) / 2) * 40;
        this.bossPips.fillStyle(COLOR.outline, 1);
        this.bossPips.fillCircle(x, 68, 14);
        this.bossPips.fillStyle(i < s.bossHits ? COLOR.butter : 0x5c4560, 1);
        this.bossPips.fillCircle(x, 68, 10);
      }
    }

    if (this.hintT > 0) {
      this.hintT -= dt;
      this.hint.setScale(Math.min(1, this.hint.scale + dt * 2));
      if (this.hintT < 0.4) this.hint.setAlpha(Math.max(0, this.hintT / 0.4));
      if (this.hintT <= 0) this.hint.setVisible(false);
    }
  }
}
