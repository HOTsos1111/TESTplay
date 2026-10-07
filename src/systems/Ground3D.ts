import type Phaser from 'phaser';
import type { GroundPalette } from '../data/levelArt';

/**
 * Faux-3D ground: a paved top face seen from slightly above, with seams that
 * fan out from the screen centre (so they shift with parallax as the camera
 * scrolls), a stone front face below it, and side walls at pit edges.
 *
 * Collision is unchanged: characters stand at y = 600, inside the top face.
 */
export const GROUND3D = {
  backY: 584,
  frontY: 642,
  bottomY: 720,
  /** How much further the front edge is spread from the view centre than the back edge. */
  spread: 0.13,
  seam: 64,
} as const;

const OUT = 0x302331;
/** The depot's paving; levels built from guides swap in their own colours. */
const DEFAULT_PALETTE: GroundPalette = { top: 0xe8d2a8, topDark: 0xd7bd8c, seam: 0xc4a678, front: 0xa9876a, frontDark: 0x8c6c55, side: 0x6e5244, lip: 0xfff3d8 };
let pal: GroundPalette = DEFAULT_PALETTE;

/** Sets the ground colours for the level being built (null restores the depot). */
export function setGroundPalette(p: GroundPalette | null): void {
  pal = p ?? DEFAULT_PALETTE;
}

/** Front-edge x for a back-edge x, given the view centre. */
export function frontX(x: number, centre: number): number {
  return x + (x - centre) * GROUND3D.spread;
}

/**
 * Draws one ground piece from x0 to x1 (world or screen coordinates, matching
 * the Graphics object's space) for a view centred at `centre`.
 */
export function drawGround3D(g: Phaser.GameObjects.Graphics, x0: number, x1: number, centre: number, edgeLeft: boolean, edgeRight: boolean): void {
  const { backY: B, frontY: F, bottomY: Z, seam } = GROUND3D;
  const f0 = frontX(x0, centre);
  const f1 = frontX(x1, centre);
  // Side walls at pit edges (only the side facing the viewer shows).
  if (edgeLeft && f0 > x0) {
    g.fillStyle(pal.side, 1).fillPoints([{ x: x0, y: B }, { x: f0, y: F }, { x: f0, y: Z }, { x: x0, y: Z }], true);
    g.lineStyle(3, OUT, 1).strokePoints([{ x: x0, y: B }, { x: x0, y: Z }], false);
  }
  if (edgeRight && f1 < x1) {
    g.fillStyle(pal.side, 1).fillPoints([{ x: x1, y: B }, { x: f1, y: F }, { x: f1, y: Z }, { x: x1, y: Z }], true);
    g.lineStyle(3, OUT, 1).strokePoints([{ x: x1, y: B }, { x: x1, y: Z }], false);
  }
  // Top face: paving with a sunlit back half.
  g.fillStyle(pal.top, 1).fillPoints([{ x: x0, y: B }, { x: x1, y: B }, { x: f1, y: F }, { x: f0, y: F }], true);
  const mid = (B + F) / 2;
  const m0 = (x0 + f0) / 2;
  const m1 = (x1 + f1) / 2;
  g.fillStyle(pal.topDark, 1).fillPoints([{ x: m0, y: mid }, { x: m1, y: mid }, { x: f1, y: F }, { x: f0, y: F }], true);
  // Seams fan out with perspective; a staggered middle row of joints.
  g.lineStyle(2.5, pal.seam, 1);
  const startSeam = Math.ceil(x0 / seam) * seam;
  for (let sx = startSeam; sx < x1; sx += seam) {
    g.lineBetween(sx, B, (sx + frontX(sx, centre)) / 2, mid);
    const hx = sx + seam / 2;
    if (hx < x1) g.lineBetween((hx + frontX(hx, centre)) / 2, mid, frontX(hx, centre), F);
  }
  g.lineBetween(m0, mid, m1, mid);
  // Front face: stone courses.
  g.fillStyle(pal.front, 1).fillRect(f0, F, f1 - f0, Z - F);
  g.fillStyle(pal.frontDark, 1).fillRect(f0, F + 44, f1 - f0, Z - F - 44);
  g.lineStyle(2, pal.frontDark, 1);
  g.lineBetween(f0, F + 22, f1, F + 22);
  for (let sx = startSeam; sx < x1; sx += seam) {
    const fx = frontX(sx, centre);
    g.lineBetween(fx, F, fx, F + 22);
    const hx = frontX(sx + seam / 2, centre);
    if (hx < f1) g.lineBetween(hx, F + 22, hx, F + 44);
  }
  // Crisp outlines: back edge, front lip with a highlight.
  g.lineStyle(3, OUT, 1);
  g.lineBetween(x0, B, x1, B);
  g.lineStyle(2, pal.lip, 0.9);
  g.lineBetween(f0, F - 2, f1, F - 2);
  g.lineStyle(3.5, OUT, 1);
  g.lineBetween(f0, F, f1, F);
  if (edgeLeft) g.strokePoints([{ x: x0, y: B }, { x: f0, y: F }, { x: f0, y: Z }], false);
  if (edgeRight) g.strokePoints([{ x: x1, y: B }, { x: f1, y: F }, { x: f1, y: Z }], false);
}
