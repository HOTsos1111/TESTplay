import Phaser from 'phaser';
import { DEPTH, VIEW } from '../data/config';
import { ART_SCALE } from '../systems/AssetRegistry';
import { BAND } from '../systems/art/canvas';
import { drawGround3D } from '../systems/Ground3D';
import { ROOF_BAND } from '../systems/art/decorArt';
import { COLOR } from './theme';
import { centerMenu } from './layout';

/** Slowly scrolling depot parallax used behind menus. */
export class Backdrop {
  private layers: { ts: Phaser.GameObjects.TileSprite; f: number }[] = [];
  private x = 0;
  private ground: Phaser.GameObjects.Graphics;
  private left = 0;
  private width: number = VIEW.width;
  constructor(scene: Phaser.Scene, dim = 0.35, private speed = 40, into?: Phaser.GameObjects.Container) {
    for (const [key, f, d] of [
      ['depot_far', 0.1, DEPTH.farBg],
      ['sky_clouds', 0.05, DEPTH.farBg + 0.4],
      ['depot_mid', 0.35, DEPTH.midBg],
      ['depot_roofline', 0.5, DEPTH.midBg + 5],
      ['depot_near', 0.7, DEPTH.nearBg],
    ] as const) {
      const band = key === 'depot_near' ? BAND.near : key === 'depot_mid' ? BAND.mid : key === 'depot_roofline' ? ROOF_BAND : key === 'sky_clouds' ? { y0: 10, h: 240 } : { y0: 0, h: VIEW.height };
      const ts = scene.add.tileSprite(0, band.y0, VIEW.width, band.h, key).setOrigin(0).setTileScale(ART_SCALE).setDepth(d);
      this.layers.push({ ts, f });
      into?.add(ts);
    }
    this.ground = scene.add.graphics().setDepth(DEPTH.ground);
    into?.add(this.ground);
    let dimRect: Phaser.GameObjects.Rectangle | null = null;
    if (dim > 0) {
      dimRect = scene.add.rectangle(0, 0, VIEW.width, VIEW.height, COLOR.outline, dim).setOrigin(0).setDepth(DEPTH.ground + 5);
      into?.add(dimRect);
    }
    // Cover the full (possibly wider than 1280) screen while menu content stays centred.
    centerMenu(scene, (w, left) => {
      for (const l of this.layers) l.ts.setPosition(left, l.ts.y).setSize(w, l.ts.height);
      this.left = left;
      this.width = w;
      this.drawGround();
      dimRect?.setPosition(left, 0).setSize(w, VIEW.height);
    });
  }
  update(dt: number): void {
    this.x += dt * this.speed;
    for (const l of this.layers) l.ts.tilePositionX = (this.x * l.f) / ART_SCALE;
    this.drawGround();
  }

  private drawGround(): void {
    const g = this.ground;
    g.clear();
    g.x = -this.x;
    const l = this.x + this.left;
    drawGround3D(g, l - 120, l + this.width + 120, l + this.width / 2, false, false);
  }
}

/** Rounded translucent panel. */
export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, alpha = 0.88): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(COLOR.outline, 0.6);
  g.fillRoundedRect(x - w / 2 + 6, y - h / 2 + 8, w, h, 28);
  g.fillStyle(0x4a3550, alpha);
  g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 28);
  g.lineStyle(4, COLOR.cream, 0.85);
  g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 28);
  return g;
}
