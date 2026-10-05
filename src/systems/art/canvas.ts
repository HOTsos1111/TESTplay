import type Phaser from 'phaser';

/** Source art is generated at 2× logical size, matching the export contract. */
export const RES = 2;

export const PAL = {
  outline: '#302331',
  chestnut: '#B66B38',
  chestnutDark: '#8A4A22',
  chestnutLight: '#D38E55',
  ear: '#5A3A2E',
  earDark: '#45291F',
  cream: '#FFE1AA',
  teal: '#42B7B0',
  tealDark: '#2E8B86',
  coral: '#F07562',
  butter: '#FFD66E',
  tag: '#FFD95A',
  nose: '#1E1A1E',
  // Squirrel palette (style guide).
  rust: '#C65A3B',
  rustDark: '#7A3A2B',
  rustLight: '#E9876A',
  squirrelCream: '#FFF1DA',
  innerEar: '#F3A0BA',
  sky: '#A9D9EB',
  white: '#FFFDF6',
  plumSoft: '#5C4560',
} as const;

export type Ctx = CanvasRenderingContext2D;

export function makeTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: Ctx) => void): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, Math.ceil(w * RES), Math.ceil(h * RES));
  if (!tex) return;
  const c = tex.getContext();
  c.save();
  c.scale(RES, RES);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  draw(c);
  c.restore();
  tex.refresh();
}

/**
 * Background bands only store the rows that contain art: a near-wall layer is
 * drawn in full-screen coordinates but stored from y0 down (saves GPU memory).
 */
export const BAND = {
  near: { y0: 340, h: 380 },
  mid: { y0: 110, h: 610 },
} as const;

export function makeBand(scene: Phaser.Scene, key: string, w: number, band: { y0: number; h: number }, draw: (c: Ctx) => void): void {
  makeTexture(scene, key, w, band.h, (c) => {
    c.translate(0, -band.y0);
    draw(c);
  });
}

export function rr(c: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rad = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rad, y);
  c.arcTo(x + w, y, x + w, y + h, rad);
  c.arcTo(x + w, y + h, x, y + h, rad);
  c.arcTo(x, y + h, x, y, rad);
  c.arcTo(x, y, x + w, y, rad);
  c.closePath();
}

export function ell(c: Ctx, cx: number, cy: number, rx: number, ry: number, rot = 0): void {
  c.beginPath();
  c.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
}

export function fillStroke(c: Ctx, fill: string, lw = 3, stroke: string = PAL.outline): void {
  c.fillStyle = fill;
  c.fill();
  if (lw > 0) {
    c.lineWidth = lw;
    c.strokeStyle = stroke;
    c.stroke();
  }
}

export function stroke(c: Ctx, lw = 3, color: string = PAL.outline): void {
  c.lineWidth = lw;
  c.strokeStyle = color;
  c.stroke();
}

/** Simple seeded RNG so procedural scenery is stable between sessions. */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Draw something twice so it wraps seamlessly across a horizontally repeating strip. */
export function wrapDraw(width: number, x: number, w: number, draw: (ox: number) => void): void {
  draw(x);
  if (x + w > width) draw(x - width);
  if (x < 0) draw(x + width);
}

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
