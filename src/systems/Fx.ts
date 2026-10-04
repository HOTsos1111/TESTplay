import Phaser from 'phaser';
import { DEPTH } from '../data/config';
import { ART_SCALE } from './AssetRegistry';
import { PAL } from './art/canvas';

interface Particle {
  obj: Phaser.GameObjects.Image | Phaser.GameObjects.Text;
  vx: number;
  vy: number;
  g: number;
  life: number;
  max: number;
  spin: number;
  scale0: number;
  scale1: number;
  fade: boolean;
  release: () => void;
}

/**
 * Lightweight dt-driven particle system with pooled images and texts.
 * Driven by GameScene.update so it freezes with the rest of the simulation.
 */
export class Fx {
  private imgPool = new Map<string, Phaser.GameObjects.Image[]>();
  private textPool: Phaser.GameObjects.Text[] = [];
  private live: Particle[] = [];
  private rings: { g: Phaser.GameObjects.Graphics; t: number; max: number; range: number; follow: () => { x: number; y: number } }[] = [];

  constructor(private scene: Phaser.Scene) {}

  private image(key: string): Phaser.GameObjects.Image {
    const pool = this.imgPool.get(key);
    const img = pool?.pop() ?? this.scene.add.image(0, 0, key);
    img.setActive(true).setVisible(true).setAlpha(1).setRotation(0).setDepth(DEPTH.fx).setOrigin(0.5);
    return img;
  }

  private releaseImage(key: string, img: Phaser.GameObjects.Image): void {
    img.setActive(false).setVisible(false);
    let pool = this.imgPool.get(key);
    if (!pool) this.imgPool.set(key, (pool = []));
    if (pool.length < 40) pool.push(img);
    else img.destroy();
  }

  private spawn(key: string, x: number, y: number, o: Partial<Omit<Particle, 'obj' | 'release'>>): void {
    const img = this.image(key);
    img.setPosition(x, y).setScale(ART_SCALE * (o.scale0 ?? 1));
    this.live.push({
      obj: img,
      vx: o.vx ?? 0,
      vy: o.vy ?? 0,
      g: o.g ?? 0,
      life: o.max ?? 0.4,
      max: o.max ?? 0.4,
      spin: o.spin ?? 0,
      scale0: o.scale0 ?? 1,
      scale1: o.scale1 ?? o.scale0 ?? 1,
      fade: o.fade ?? true,
      release: () => this.releaseImage(key, img),
    });
  }

  puff(x: number, y: number, n = 5, size = 1): void {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      this.spawn('fx_puff', x, y, { vx: Math.cos(a) * 90, vy: Math.sin(a) * 60 - 30, max: 0.45, scale0: 0.6 * size, scale1: 1.2 * size });
    }
  }

  dust(x: number, y: number, n = 3): void {
    for (let i = 0; i < n; i++) {
      this.spawn('fx_puff', x - Math.random() * 20, y - 4, { vx: -60 - Math.random() * 80, vy: -20 - Math.random() * 30, max: 0.35, scale0: 0.3, scale1: 0.6 });
    }
  }

  stars(x: number, y: number, n = 6): void {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.spawn('fx_star', x, y, { vx: Math.cos(a) * 160, vy: Math.sin(a) * 160 - 60, g: 400, max: 0.6, spin: 8, scale0: 1.1, scale1: 0.6 });
    }
  }

  sparkle(x: number, y: number, n = 4): void {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.4;
      this.spawn('fx_sparkle', x, y, { vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, max: 0.35, spin: 4, scale0: 1, scale1: 0.2 });
    }
  }

  bits(x: number, y: number, n = 10): void {
    for (let i = 0; i < n; i++) {
      this.spawn('cardboard_bit', x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 40, {
        vx: 120 + Math.random() * 260,
        vy: -220 - Math.random() * 260,
        g: 1300,
        max: 0.9,
        spin: (Math.random() - 0.5) * 16,
        scale0: 0.8 + Math.random() * 0.6,
        fade: false,
      });
    }
  }

  propeller(x: number, y: number): void {
    this.spawn('fx_sparkle', x, y, { vx: -120, vy: 30, max: 0.25, scale0: 0.6, scale1: 0.1 });
  }

  floatText(x: number, y: number, text: string, color: string = PAL.butter): void {
    const t = this.textPool.pop() ?? this.scene.add.text(0, 0, '', {
      fontFamily: '"Trebuchet MS", "Arial Rounded MT Bold", sans-serif',
      fontSize: '24px',
      fontStyle: 'bold',
      stroke: PAL.outline,
      strokeThickness: 5,
    });
    t.setText(text).setColor(color).setOrigin(0.5).setPosition(x, y).setDepth(DEPTH.fx + 1).setActive(true).setVisible(true).setAlpha(1).setScale(1);
    this.live.push({
      obj: t, vx: 0, vy: -70, g: 0, life: 0.7, max: 0.7, spin: 0, scale0: 1, scale1: 1.15, fade: true,
      release: () => {
        t.setVisible(false).setActive(false);
        if (this.textPool.length < 20) this.textPool.push(t);
        else t.destroy();
      },
    });
  }

  /** Expanding bark rings attached to the hero's mouth. */
  barkRing(range: number, follow: () => { x: number; y: number }, max = 0.22): void {
    const g = this.scene.add.graphics().setDepth(DEPTH.fx);
    this.rings.push({ g, t: 0, max, range, follow });
  }

  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.release();
        this.live.splice(i, 1);
        continue;
      }
      const k = 1 - p.life / p.max;
      p.vy += p.g * dt;
      p.obj.x += p.vx * dt;
      p.obj.y += p.vy * dt;
      p.obj.rotation += p.spin * dt;
      const s = p.scale0 + (p.scale1 - p.scale0) * k;
      p.obj.setScale(p.obj instanceof Phaser.GameObjects.Text ? s : ART_SCALE * s);
      if (p.fade) p.obj.setAlpha(1 - k * k);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      const k = r.t / r.max;
      if (k >= 1) {
        r.g.destroy();
        this.rings.splice(i, 1);
        continue;
      }
      const o = r.follow();
      r.g.clear();
      for (let j = 0; j < 3; j++) {
        const kk = Math.max(0, k - j * 0.18);
        if (kk <= 0) continue;
        const rad = 10 + kk * (r.range - 10);
        const alpha = 1 - kk;
        r.g.lineStyle(8, 0x302331, alpha * 0.9);
        r.g.beginPath();
        r.g.arc(o.x, o.y, rad, -0.6, 0.6);
        r.g.strokePath();
        r.g.lineStyle(4.5, 0xfffdf6, alpha);
        r.g.beginPath();
        r.g.arc(o.x, o.y, rad, -0.6, 0.6);
        r.g.strokePath();
      }
    }
  }

  clear(): void {
    for (const p of this.live) p.release();
    this.live = [];
    for (const r of this.rings) r.g.destroy();
    this.rings = [];
  }
}
