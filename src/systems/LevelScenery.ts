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
  shadow: Phaser.GameObjects.Ellipse;
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
      // Contact shadow so the piece sits on the back street instead of hovering.
      const shadow = this.scene.add
        .ellipse(this.cursor + w / 2, s.bottom - 2, w * 0.92, 16, 0x2a1d18, 0.22 * (s.alpha ?? 1))
        .setScrollFactor(s.factor, 0)
        .setDepth(s.depth - 0.5);
      this.items.push({ img, shadow, right: this.cursor + w });
      this.cursor += w + s.gap[0] + this.rand() * (s.gap[1] - s.gap[0]);
    }
    for (let i = this.items.length - 1; i >= 0; i--) {
      if (this.items[i].right < left - 300) {
        this.items[i].img.destroy();
        this.items[i].shadow.destroy();
        this.items.splice(i, 1);
      }
    }
  }

  destroy(): void {
    for (const p of this.items) {
      p.img.destroy();
      p.shadow.destroy();
    }
    this.items = [];
  }
}

/** Back street: where the mid-ground floor meets the haze, and how fast it scrolls there. */
const FLOOR_TOP = 512;
const FLOOR_NEAR = 600;
const FLOOR_FAR_F = 0.4;
/** Screen y on the back street of something scrolling at parallax factor f. */
export const floorY = (f: number) => FLOOR_TOP + ((f - FLOOR_FAR_F) / (1 - FLOOR_FAR_F)) * (FLOOR_NEAR - FLOOR_TOP);

const mix = (a: number, b: number, t: number) => {
  const ca = Phaser.Display.Color.IntegerToColor(a);
  const cb = Phaser.Display.Color.IntegerToColor(b);
  return Phaser.Display.Color.GetColor(ca.red + (cb.red - ca.red) * t, ca.green + (cb.green - ca.green) * t, ca.blue + (cb.blue - ca.blue) * t);
};
const css = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/**
 * The mid-ground street the scenery stands on: thin horizontal strips whose
 * scroll speed rises from the buildings' pace at the kerb to the play layer's
 * at the front, so the paving joints fan out in perspective. Below the front
 * edge (seen only through gaps in the path) it falls away into shadow.
 */
class BackStreet {
  private strips: { ts: Phaser.GameObjects.TileSprite; f: number }[] = [];

  constructor(scene: Phaser.Scene, level: number) {
    const art = LEVEL_ART[level];
    const key = `backstreet_lv${level}`;
    const lipKey = `${key}_lip`;
    const W = 168;
    const H = 4;
    // Solid ground, only lightly hazed, so the scenery clearly stands on something.
    const paving = mix(art.ground.topDark, art.haze, 0.12);
    const joint = mix(art.ground.seam, 0x302331, 0.25);
    const lip = mix(art.ground.lip, art.ground.top, 0.4);
    const tex = (k: string, fill: number) => {
      if (scene.textures.exists(k)) return;
      const t = scene.textures.createCanvas(k, W, H);
      if (!t) return;
      const c = t.getContext();
      c.fillStyle = css(fill);
      c.fillRect(0, 0, W, H);
      c.fillStyle = css(joint);
      c.fillRect(0, 0, 2, H);
      t.refresh();
    };
    tex(key, paving);
    tex(lipKey, lip);
    const depth = DEPTH.midBg - 1;
    for (let y = FLOOR_TOP - 2; y < VIEW.height; y += H - 1) {
      const t = Math.min(1, Math.max(0, (y - FLOOR_TOP) / (FLOOR_NEAR - FLOOR_TOP)));
      const f = FLOOR_FAR_F + t * (1 - FLOOR_FAR_F);
      const ts = scene.add.tileSprite(0, y, scene.scale.width, H, y < FLOOR_TOP + 6 ? lipKey : key).setOrigin(0, 0).setScrollFactor(0).setDepth(depth);
      // Slab joints across the street, and the drop-off below the front kerb.
      const rowJoint = [530, 548, 566, 584].some((j) => y <= j && j < y + H - 1);
      let shade = rowJoint ? 0.86 : 1;
      if (y >= FLOOR_TOP + 4 && y < FLOOR_TOP + 10) shade *= 0.8; // kerb shadow
      if (y > FLOOR_NEAR) shade *= Math.max(0.35, 1 - (y - FLOOR_NEAR) / 70);
      if (shade < 1) ts.setTint(Phaser.Display.Color.GetColor(255 * shade, 255 * shade, 255 * shade));
      this.strips.push({ ts, f });
    }
  }

  update(camX: number, width: number): void {
    for (const s of this.strips) {
      s.ts.tilePositionX = camX * s.f;
      if (s.ts.width !== width) s.ts.width = width;
    }
  }

  destroy(): void {
    for (const s of this.strips) s.ts.destroy();
    this.strips = [];
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
  private street: BackStreet;

  constructor(private scene: Phaser.Scene, private level: number, startCamX: number) {
    const art = LEVEL_ART[level];
    const rand = rng(level * 7919);
    this.sky = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.farBg - 2);
    this.haze = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.farBg + 1);
    this.veil = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.nearBg + 2);
    this.layout(scene.scale.width);
    this.street = new BackStreet(scene, level);
    // Everything from MG1 forward stands on the back street at the depth its
    // parallax implies, with a contact shadow, so nothing floats.
    const on = (f: number) => Math.round(floorY(f)) + 4;
    const [fg1, fg2] = art.near;
    const specs: LayerSpec[] = [
      // The far landmark and skyline fill most of the sky, with little space between.
      { pieces: [art.far], factor: 0.08, height: 440, bottom: FLOOR_TOP - 10, gap: [-60, 120], depth: DEPTH.farBg, alpha: 0.92, mirror: true },
      { pieces: [art.distant], factor: 0.18, height: 330, bottom: FLOOR_TOP + 8, gap: [-30, -10], depth: DEPTH.farBg + 2, alpha: 0.97, mirror: true },
      // Scenery is drawn big and set well back (slow parallax, behind the far edge
      // of the street, under a veil of haze) so it never reads as an obstacle.
      art.buildings
        ? { pieces: [], keys: art.buildings, factor: 0.4, height: 0, width: 600, bottom: on(0.4), gap: [40, 260], depth: DEPTH.midBg }
        : { pieces: [art.mid[0]], factor: 0.4, height: 600, bottom: on(0.4), gap: [220, 700], depth: DEPTH.midBg },
      { pieces: [art.mid[1]], factor: 0.5, height: art.mid2Height ?? 460, bottom: on(0.5), gap: [700, 1400], depth: DEPTH.midBg + 1 },
      { pieces: [fg2, fg1], factor: 0.62, height: 192, bottom: on(0.62), gap: [500, 1200], depth: DEPTH.nearBg },
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
    this.veil.fillStyle(art.haze, 0.36).fillRect(0, 0, width, FLOOR_TOP);
    this.veil.fillStyle(art.haze, 0.14).fillRect(0, FLOOR_TOP, width, 590 - FLOOR_TOP);
  }

  get debug(): unknown {
    return { level: this.level };
  }

  update(_dt: number, camX: number, _heroX?: number): void {
    const w = this.scene.scale.width;
    this.street.update(camX, w);
    for (const l of this.layers) l.update(camX, w);
  }

  destroy(): void {
    for (const l of this.layers) l.destroy();
    this.street.destroy();
    this.sky.destroy();
    this.haze.destroy();
    this.veil.destroy();
  }
}
