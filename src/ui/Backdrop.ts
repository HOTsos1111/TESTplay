import Phaser from 'phaser';
import { DEPTH, VIEW } from '../data/config';
import { ART_SCALE } from '../systems/AssetRegistry';
import { COLOR } from './theme';
import { centerMenu } from './layout';

/** Slowly scrolling depot parallax used behind menus. */
export class Backdrop {
  private layers: { ts: Phaser.GameObjects.TileSprite; f: number }[] = [];
  private x = 0;
  constructor(scene: Phaser.Scene, dim = 0.35, private speed = 40, into?: Phaser.GameObjects.Container) {
    for (const [key, f, d] of [['depot_far', 0.1, DEPTH.farBg], ['depot_mid', 0.35, DEPTH.midBg], ['depot_near', 0.7, DEPTH.nearBg]] as const) {
      const ts = scene.add.tileSprite(0, 0, VIEW.width, VIEW.height, key).setOrigin(0).setTileScale(ART_SCALE).setDepth(d);
      this.layers.push({ ts, f });
      into?.add(ts);
    }
    const ground = scene.add.tileSprite(0, 600, VIEW.width, 120, 'ground_mid').setOrigin(0).setTileScale(ART_SCALE).setDepth(DEPTH.ground);
    this.layers.push({ ts: ground, f: 1 });
    into?.add(ground);
    let dimRect: Phaser.GameObjects.Rectangle | null = null;
    if (dim > 0) {
      dimRect = scene.add.rectangle(0, 0, VIEW.width, VIEW.height, COLOR.outline, dim).setOrigin(0).setDepth(DEPTH.ground + 5);
      into?.add(dimRect);
    }
    // Cover the full (possibly wider than 1280) screen while menu content stays centred.
    centerMenu(scene, (w, left) => {
      for (const l of this.layers) l.ts.setPosition(left, l.ts.y).setSize(w, l.ts.height);
      dimRect?.setPosition(left, 0).setSize(w, VIEW.height);
    });
  }
  update(dt: number): void {
    this.x += dt * this.speed;
    for (const l of this.layers) l.ts.tilePositionX = (this.x * l.f) / ART_SCALE;
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
