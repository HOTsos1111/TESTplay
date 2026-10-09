import Phaser from 'phaser';
import { DEPTH, VIEW } from '../data/config';
import { LEVEL_ART, pieceKey, type Piece } from '../data/levelArt';
import { rng } from './art/canvas';

interface LayerSpec {
  pieces: Piece[];
  /** Camera scroll factor. */
  factor: number;
  /** Display height of each piece and the y of its bottom edge. */
  height: number;
  bottom: number;
  /** Gap between pieces [min, max] (negative overlaps them into a strip). */
  gap: [number, number];
  depth: number;
  alpha?: number;
  /** Mirror every other copy so a repeated strip never looks stamped. */
  mirror?: boolean;
  /** Ready-made texture keys used instead of guide pieces, picked in a shuffled order. */
  keys?: string[];
  /** Scale every piece to this display width instead of to `height`. */
  width?: number;
}

interface Placed {
  img: Phaser.GameObjects.Image;
  right: number;
}

class Layer {
  private lastKey = '';
  private items: Placed[] = [];
  private cursor: number;
  private n = 0;
  constructor(
    private scene: Phaser.Scene,
    private level: number,
    private spec: LayerSpec,
    private rand: () => number,
    startCamX: number,
  ) {
    this.cursor = startCamX * spec.factor - 300 - rand() * 200;
  }

  update(camX: number, width: number): void {
    const s = this.spec;
    const left = camX * s.factor;
    const right = left + width;
    while (this.cursor < right + 400) {
      let key: string;
      if (s.keys?.length) {
        // Mix and match: a random building, never the same one twice in a row.
        let pick = Math.floor(this.rand() * s.keys.length);
        if (s.keys.length > 1 && s.keys[pick] === this.lastKey) pick = (pick + 1) % s.keys.length;
        key = s.keys[pick];
        this.lastKey = key;
      } else key = pieceKey(this.level, s.pieces[this.n % s.pieces.length].code);
      this.n++;
      if (!this.scene.textures.exists(key)) {
        this.cursor += 400;
        continue;
      }
      const img = this.scene.add.image(this.cursor, s.bottom, key).setOrigin(0, 1).setScrollFactor(s.factor, 0).setDepth(s.depth);
      const k = s.width ? s.width / img.width : s.height / img.height;
      img.setScale(k).setAlpha(s.alpha ?? 1);
      if (s.mirror && this.n % 2 === 0) img.setFlipX(true);
      const w = img.width * k;
      this.items.push({ img, right: this.cursor + w });
      this.cursor += w + s.gap[0] + this.rand() * (s.gap[1] - s.gap[0]);
    }
    for (let i = this.items.length - 1; i >= 0; i--) {
      if (this.items[i].right < left - 300) {
        this.items[i].img.destroy();
        this.items.splice(i, 1);
      }
    }
  }

  destroy(): void {
    for (const p of this.items) p.img.destroy();
    this.items = [];
  }
}

/**
 * Backdrop for a level built from its asset guide: a sky gradient, then the
 * guide's distant landmark (BG2, 0.08), skyline (BG1, 0.18), architecture
 * (MG1, 0.55) and nearer scenery (MG2, 0.75), street dressing at the ground's
 * own pace, and sparse foreground accents along the bottom edge (1.08).
 * Nothing here collides.
 */
export class LevelScenery {
  private sky: Phaser.GameObjects.Graphics;
  private haze: Phaser.GameObjects.Graphics;
  /** Light atmospheric wash over all the scenery, so the play layer pops in front of it. */
  private veil!: Phaser.GameObjects.Graphics;
  private layers: Layer[] = [];

  constructor(private scene: Phaser.Scene, private level: number, startCamX: number) {
    const art = LEVEL_ART[level];
    const rand = rng(level * 7919);
    this.sky = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.farBg - 2);
    this.haze = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.farBg + 1);
    this.veil = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.nearBg + 2);
    this.layout(scene.scale.width);
    const [fg1, fg2] = art.near;
    const specs: LayerSpec[] = [
      { pieces: [art.far], factor: 0.08, height: 250, bottom: 482, gap: [260, 760], depth: DEPTH.farBg, alpha: 0.95, mirror: true },
      { pieces: [art.distant], factor: 0.18, height: 200, bottom: 528, gap: [-30, -10], depth: DEPTH.farBg + 2, alpha: 0.97, mirror: true },
      // Scenery is drawn big and set well back (slow parallax, behind the far edge
      // of the street, under a veil of haze) so it never reads as an obstacle.
      art.buildings
        ? { pieces: [], keys: art.buildings, factor: 0.4, height: 0, width: 600, bottom: 586, gap: [40, 260], depth: DEPTH.midBg }
        : { pieces: [art.mid[0]], factor: 0.4, height: 600, bottom: 586, gap: [220, 700], depth: DEPTH.midBg },
      { pieces: [art.mid[1]], factor: 0.5, height: 460, bottom: 586, gap: [700, 1400], depth: DEPTH.midBg + 1 },
      { pieces: [fg2, fg1], factor: 0.62, height: 192, bottom: 586, gap: [500, 1200], depth: DEPTH.nearBg },
    ];
    this.layers = specs.map((s) => new Layer(scene, level, s, rand, startCamX));
  }

  layout(width: number): void {
    this.drawSky(width);
  }

  private drawSky(width: number): void {
    const g = this.sky;
    g.clear();
    const art = LEVEL_ART[this.level];
    if (!art) return;
    const [top, bottom] = art.sky;
    const a = Phaser.Display.Color.IntegerToColor(top);
    const b = Phaser.Display.Color.IntegerToColor(bottom);
    const steps = 24;
    const h = VIEW.height;
    for (let i = 0; i < steps; i++) {
      const k = i / (steps - 1);
      const col = Phaser.Display.Color.GetColor(a.red + (b.red - a.red) * k, a.green + (b.green - a.green) * k, a.blue + (b.blue - a.blue) * k);
      g.fillStyle(col, 1).fillRect(0, (h * 0.75 * i) / steps, width, (h * 0.75) / steps + 1);
    }
    g.fillStyle(bottom, 1).fillRect(0, h * 0.75 - 1, width, h * 0.25 + 1);
    // Haze between the skyline and the ground so gaps never show sky at street level.
    this.haze.clear();
    this.haze.fillStyle(art.haze, 0.55).fillRect(0, 470, width, 140);
    this.haze.fillStyle(art.haze, 0.85).fillRect(0, 520, width, 90);
    this.veil.clear();
    this.veil.fillStyle(art.haze, 0.36).fillRect(0, 0, width, 590);
  }

  get debug(): unknown {
    return { level: this.level };
  }

  update(_dt: number, camX: number, _heroX?: number): void {
    const w = this.scene.scale.width;
    for (const l of this.layers) l.update(camX, w);
  }

  destroy(): void {
    for (const l of this.layers) l.destroy();
    this.sky.destroy();
    this.haze.destroy();
    this.veil.destroy();
  }
}
