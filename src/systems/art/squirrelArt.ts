import type Phaser from 'phaser';
import { ell, fillStroke, makeTexture, PAL, rr, stroke, type Ctx } from './canvas';

/**
 * Squirrels, per the style guide: rust fur, cream belly, salmon tail inner,
 * pink inner ears. Minions are the small nut-throwers; Boss Nutso is their
 * enormous, very jacked leader who stole the hero's toy.
 */

const FUR = PAL.rust;
const FUR_DARK = PAL.rustDark;
const FUR_LIGHT = PAL.rustLight;
const CREAM = PAL.squirrelCream;

export function drawAcorn(c: Ctx, x: number, y: number, s = 1): void {
  ell(c, x, y + 2 * s, 6 * s, 7.2 * s);
  fillStroke(c, '#D08A45', 2.2);
  ell(c, x - 2 * s, y + 1 * s, 1.8 * s, 3 * s);
  c.fillStyle = 'rgba(255,255,255,0.35)';
  c.fill();
  c.beginPath();
  c.ellipse(x, y - 3 * s, 7.8 * s, 4.4 * s, 0, Math.PI, 0);
  c.closePath();
  fillStroke(c, '#7A4A2B', 2.2);
  c.beginPath();
  c.moveTo(x - 4 * s, y - 4 * s);
  c.lineTo(x + 4 * s, y - 4 * s);
  stroke(c, 1.2, 'rgba(255,255,255,0.3)');
  c.beginPath();
  c.moveTo(x, y - 7 * s);
  c.lineTo(x + 1.5 * s, y - 10.5 * s);
  stroke(c, 2.2);
}

/** Sausage squeaky toy with bone-knob ends (the hero's favourite). */
export function drawToy(c: Ctx): void {
  const knob = (x: number, y: number) => {
    ell(c, x, y, 5.5, 5.5);
    fillStroke(c, CREAM, 2.5);
  };
  knob(8, 10);
  knob(8, 20);
  knob(54, 10);
  knob(54, 20);
  rr(c, 9, 6, 44, 18, 9);
  fillStroke(c, '#E0503F', 3);
  ell(c, 24, 11, 9, 2.4);
  c.fillStyle = 'rgba(255,255,255,0.55)';
  c.fill();
  // Stitched patch: well loved.
  c.beginPath();
  c.moveTo(36, 13);
  c.lineTo(44, 19);
  c.moveTo(38, 19);
  c.lineTo(42, 12);
  stroke(c, 1.8, '#8A2A22');
}

function tuft(c: Ctx, x: number, y: number, dir: number): void {
  c.beginPath();
  c.moveTo(x, y);
  c.quadraticCurveTo(x + dir * 3, y - 4, x + dir * 1, y - 7);
  stroke(c, 2.4);
}

/** A big S-curled squirrel tail with a lighter inner stripe. Root at (0,0), curling up and back. */
function squirrelTail(c: Ctx, scale: number, bushy = 1): void {
  c.save();
  c.scale(scale, scale);
  c.beginPath();
  c.moveTo(-8, 4);
  c.bezierCurveTo(30 * bushy, 8, 38 * bushy, -36, 18, -56);
  c.bezierCurveTo(6, -70, -22, -66, -22, -48);
  c.bezierCurveTo(-22, -36, -8, -34, -4, -40);
  c.bezierCurveTo(4, -30, 12, -16, -10, -8);
  c.closePath();
  fillStroke(c, FUR, 3 / scale);
  c.beginPath();
  c.moveTo(-2, -2);
  c.bezierCurveTo(22 * bushy, -4, 24 * bushy, -34, 10, -50);
  c.bezierCurveTo(2, -58, -12, -56, -14, -48);
  c.bezierCurveTo(-4, -50, 6, -42, 6, -30);
  c.bezierCurveTo(6, -18, 0, -10, -2, -2);
  c.closePath();
  c.fillStyle = FUR_LIGHT;
  c.fill();
  c.restore();
}

// ------------------------------------------------------------- minions

export type SquirrelPose = 'idle' | 'taunt' | 'throw' | 'run' | 'startled';

function limb(c: Ctx, pts: [number, number][], w: number, color: string): void {
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  stroke(c, w + 5, PAL.outline);
  stroke(c, w, color);
}

/** Minion squirrel, 90×90, feet at y=86, facing left (toward the hero). */
export function drawSquirrel(c: Ctx, pose: SquirrelPose): void {
  c.save();
  if (pose === 'run') {
    c.translate(90, 0);
    c.scale(-1, 1);
  }
  const startled = pose === 'startled';
  // Tail.
  c.save();
  c.translate(56, 74);
  squirrelTail(c, startled ? 0.92 : 0.8, startled ? 1.25 : 1);
  c.restore();
  // Feet.
  ell(c, 34, 85, 8, 3.6);
  fillStroke(c, FUR_DARK, 2.4);
  ell(c, 50, 85, 8, 3.6);
  fillStroke(c, FUR_DARK, 2.4);
  const lean = pose === 'throw' ? -0.22 : pose === 'run' ? -0.55 : startled ? 0.12 : 0;
  c.save();
  c.translate(44, 82);
  c.rotate(lean);
  // Body: pear shape with cream belly.
  ell(c, 0, -16, 15, 17);
  fillStroke(c, FUR, 3);
  ell(c, -5, -13, 8.5, 12);
  c.fillStyle = CREAM;
  c.fill();
  // Far arm (behind the head) for throw/startled.
  if (pose === 'startled') limb(c, [[6, -24], [16, -36], [18, -46]], 3.6, FUR);
  // Head: big and round.
  const hx = -6;
  const hy = -44;
  ell(c, hx, hy, 15.5, 14);
  fillStroke(c, FUR, 3);
  // Ear with pink inner and tuft.
  c.beginPath();
  c.moveTo(hx + 2, hy - 10);
  c.quadraticCurveTo(hx + 4, hy - 26, hx + 12, hy - 22);
  c.quadraticCurveTo(hx + 14, hy - 14, hx + 10, hy - 8);
  c.closePath();
  fillStroke(c, FUR, 2.6);
  ell(c, hx + 8, hy - 16, 2.6, 5, 0.3);
  c.fillStyle = PAL.innerEar;
  c.fill();
  tuft(c, hx + 6, hy - 22, 1);
  // Cream muzzle and cheek.
  ell(c, hx - 10, hy + 4, 9, 7.5);
  fillStroke(c, CREAM, 2.6);
  ell(c, hx - 18, hy + 1, 3.4, 2.8);
  fillStroke(c, PAL.nose, 0);
  // Whiskers.
  c.beginPath();
  c.moveTo(hx - 14, hy + 3);
  c.lineTo(hx - 24, hy - 1);
  c.moveTo(hx - 14, hy + 5);
  c.lineTo(hx - 24, hy + 6);
  stroke(c, 1.1);
  // Eye.
  const ex = hx - 4;
  const ey = hy - 4;
  if (startled) {
    ell(c, ex, ey, 6.5, 8);
    fillStroke(c, PAL.white, 2.4);
    ell(c, ex - 1, ey, 2, 2.2);
    c.fillStyle = PAL.nose;
    c.fill();
  } else {
    ell(c, ex, ey, 5.8, 7);
    fillStroke(c, PAL.white, 2.4);
    ell(c, ex - 2, ey + 1, 3.4, 4.4);
    c.fillStyle = PAL.nose;
    c.fill();
    ell(c, ex - 3, ey - 1.5, 1.3, 1.5);
    c.fillStyle = PAL.white;
    c.fill();
    // Mischievous, furrowed brow (slanting down to the nose).
    c.beginPath();
    c.moveTo(ex - 8, ey - 6);
    c.lineTo(ex + 6, ey - 10);
    stroke(c, 3.2);
  }
  // Mouth + buck teeth.
  if (startled || pose === 'throw') {
    ell(c, hx - 12, hy + 8, 3.6, 3);
    fillStroke(c, '#7a2a3a', 2);
  } else {
    c.beginPath();
    c.moveTo(hx - 17, hy + 6);
    c.quadraticCurveTo(hx - 10, hy + 10, hx - 4, hy + 4);
    stroke(c, 2.2);
  }
  rr(c, hx - 16, hy + 7, 5, 5, 1.2);
  fillStroke(c, PAL.white, 1.6);
  // Near arm.
  if (pose === 'taunt') limb(c, [[-6, -22], [-12, -32], [-14, -44]], 3.6, FUR);
  else if (pose === 'throw') limb(c, [[-4, -22], [-16, -22], [-26, -26]], 3.6, FUR);
  else if (startled) limb(c, [[-4, -22], [-16, -32], [-20, -42]], 3.6, FUR);
  else if (pose === 'run') limb(c, [[-4, -20], [-14, -14], [-20, -18]], 3.6, FUR);
  else {
    // Arms folded smugly across the chest.
    limb(c, [[-2, -24], [-12, -18], [4, -16]], 3.6, FUR);
  }
  if (pose === 'taunt') drawAcorn(c, -15, -52, 1.05);
  if (pose === 'throw') drawAcorn(c, -29, -29, 0.9);
  c.restore();
  c.restore();
}

// ------------------------------------------------------------ the boss

export type BossPose = 'sneak' | 'grab' | 'run' | 'flex' | 'stunned';
export const BOSS_SIZE = { w: 220, h: 240 } as const;

interface BossRig {
  lean: number;
  near: [number, number][];
  far: [number, number][];
  legs: [[number, number], [number, number]];
  face: 'smirk' | 'sneaky' | 'laugh' | 'dizzy';
  toy?: [number, number, number];
}

const BOSS_RIGS: Record<BossPose, BossRig> = {
  flex: {
    lean: 0,
    near: [[66, 112], [32, 104], [40, 62]],
    far: [[150, 112], [184, 104], [176, 62]],
    legs: [[88, 232], [130, 232]],
    face: 'laugh',
  },
  grab: {
    lean: -0.05,
    near: [[66, 112], [46, 76], [58, 36]],
    far: [[150, 112], [178, 140], [148, 160]],
    legs: [[88, 232], [130, 232]],
    face: 'smirk',
    toy: [58, 26, -0.3],
  },
  sneak: {
    lean: -0.2,
    near: [[66, 116], [44, 136], [64, 92]],
    far: [[150, 114], [130, 150], [92, 150]],
    legs: [[82, 230], [138, 228]],
    face: 'sneaky',
  },
  run: {
    lean: -0.38,
    near: [[66, 114], [46, 148], [70, 162]],
    far: [[150, 112], [170, 80], [150, 56]],
    legs: [[64, 228], [150, 214]],
    face: 'laugh',
    toy: [70, 152, 0.2],
  },
  stunned: {
    lean: 0.1,
    near: [[66, 114], [50, 152], [56, 186]],
    far: [[150, 114], [166, 152], [160, 186]],
    legs: [[90, 232], [128, 232]],
    face: 'dizzy',
  },
};

function bossArm(c: Ctx, pts: [number, number][]): void {
  const [s, e, f] = pts;
  // Bulging bicep along the upper arm.
  const mx = (s[0] + e[0]) / 2;
  const my = (s[1] + e[1]) / 2;
  const ang = Math.atan2(e[1] - s[1], e[0] - s[0]);
  const len = Math.hypot(e[0] - s[0], e[1] - s[1]);
  ell(c, mx, my, len / 2 + 9, 16, ang);
  fillStroke(c, FUR, 3.5);
  // Bicep highlight.
  ell(c, mx, my - 4, len / 4, 4.5, ang);
  c.fillStyle = 'rgba(255,220,190,0.35)';
  c.fill();
  // Forearm (thick, tapering) and a big fist.
  const fa = Math.atan2(f[1] - e[1], f[0] - e[0]);
  const flen = Math.hypot(f[0] - e[0], f[1] - e[1]);
  ell(c, (e[0] + f[0]) / 2, (e[1] + f[1]) / 2, flen / 2 + 6, 11, fa);
  fillStroke(c, FUR, 3.5);
  ell(c, f[0], f[1], 12, 11);
  fillStroke(c, CREAM, 3);
  c.beginPath();
  c.moveTo(f[0] - 6, f[1] - 3);
  c.lineTo(f[0] - 6, f[1] + 3);
  c.moveTo(f[0], f[1] - 4);
  c.lineTo(f[0], f[1] + 4);
  stroke(c, 1.8);
}

/** Boss Nutso, 220×240, feet at y≈234, facing left. */
export function drawBoss(c: Ctx, pose: BossPose): void {
  const r = BOSS_RIGS[pose];
  c.save();
  c.translate(110, 234);
  c.rotate(r.lean);
  c.translate(-110, -234);
  // Huge tail.
  c.save();
  c.translate(150, 196);
  squirrelTail(c, 2.1, 1.1);
  c.restore();
  // Far arm behind the torso when it is lowered.
  const farBehind = pose === 'run' || pose === 'sneak';
  if (farBehind) bossArm(c, r.far);
  // Legs: chunky thighs and big feet.
  for (const [i, [fx, fy]] of r.legs.entries()) {
    const hx = i === 0 ? 92 : 124;
    ell(c, (hx + fx) / 2, (180 + fy) / 2 - 6, 18, 30, Math.atan2(fx - hx, 1) * -0.4);
    fillStroke(c, FUR, 3.5);
    ell(c, fx - 6, fy, 20, 8);
    fillStroke(c, FUR_DARK, 3);
  }
  // V-shaped torso.
  c.beginPath();
  c.moveTo(56, 108);
  c.quadraticCurveTo(108, 84, 160, 108);
  c.quadraticCurveTo(150, 160, 132, 190);
  c.quadraticCurveTo(108, 202, 84, 190);
  c.quadraticCurveTo(66, 160, 56, 108);
  c.closePath();
  fillStroke(c, FUR, 4);
  // Cream chest and abs.
  c.beginPath();
  c.moveTo(74, 112);
  c.quadraticCurveTo(108, 100, 142, 112);
  c.quadraticCurveTo(138, 160, 124, 188);
  c.quadraticCurveTo(108, 194, 92, 188);
  c.quadraticCurveTo(78, 160, 74, 112);
  c.closePath();
  fillStroke(c, CREAM, 3);
  // Pecs.
  c.beginPath();
  c.moveTo(80, 136);
  c.quadraticCurveTo(94, 144, 107, 134);
  c.moveTo(109, 134);
  c.quadraticCurveTo(122, 144, 136, 136);
  c.moveTo(108, 116);
  c.lineTo(108, 186);
  stroke(c, 2.6);
  // Six-pack.
  for (const y of [152, 166, 178]) {
    c.beginPath();
    c.moveTo(94, y);
    c.quadraticCurveTo(101, y + 3, 106, y);
    c.moveTo(110, y);
    c.quadraticCurveTo(115, y + 3, 122, y);
    stroke(c, 2.2);
  }
  // Gold chain with an acorn medallion.
  c.beginPath();
  c.moveTo(76, 108);
  c.quadraticCurveTo(108, 142, 140, 108);
  stroke(c, 7, PAL.outline);
  stroke(c, 4, PAL.tag);
  ell(c, 108, 130, 11, 12);
  fillStroke(c, PAL.tag, 2.6);
  drawAcorn(c, 108, 131, 0.75);
  // Head: small for that body, turned three-quarters to the left.
  const hx = 102;
  const hy = 70;
  // Far ear (notched, a battle scar).
  c.beginPath();
  c.moveTo(hx + 8, hy - 22);
  c.quadraticCurveTo(hx + 16, hy - 52, hx + 28, hy - 42);
  c.lineTo(hx + 24, hy - 36);
  c.lineTo(hx + 30, hy - 32);
  c.quadraticCurveTo(hx + 28, hy - 22, hx + 22, hy - 16);
  c.closePath();
  fillStroke(c, FUR, 3);
  tuft(c, hx + 22, hy - 44, 1);
  ell(c, hx, hy, 32, 28);
  fillStroke(c, FUR, 3.5);
  // Near ear with pink inner.
  c.beginPath();
  c.moveTo(hx - 18, hy - 18);
  c.quadraticCurveTo(hx - 16, hy - 52, hx - 2, hy - 44);
  c.quadraticCurveTo(hx + 2, hy - 30, hx - 2, hy - 22);
  c.closePath();
  fillStroke(c, FUR, 3);
  ell(c, hx - 8, hy - 34, 3.5, 8, 0.15);
  c.fillStyle = PAL.innerEar;
  c.fill();
  tuft(c, hx - 8, hy - 48, -1);
  // Cream muzzle and big cheeks.
  ell(c, hx - 18, hy + 12, 20, 14);
  fillStroke(c, CREAM, 3);
  ell(c, hx - 36, hy + 4, 7, 5.5);
  fillStroke(c, PAL.nose, 2);
  ell(c, hx - 38, hy + 2, 2.2, 1.4);
  c.fillStyle = 'rgba(255,255,255,0.6)';
  c.fill();
  // Eyes.
  const eye = (x: number, y: number, s: number) => {
    if (r.face === 'dizzy') {
      c.beginPath();
      for (let i = 0; i < 24; i++) {
        const a = i * 0.6;
        const rr2 = 1 + i * 0.32 * s;
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2);
      }
      stroke(c, 2.4);
      return;
    }
    ell(c, x, y, 7 * s, 8 * s);
    fillStroke(c, PAL.white, 2.6);
    if (r.face === 'sneaky') {
      // Half-lidded, side-eye.
      ell(c, x - 3 * s, y + 2 * s, 3.4 * s, 3.8 * s);
      c.fillStyle = PAL.nose;
      c.fill();
      c.beginPath();
      c.moveTo(x - 7.5 * s, y - 1 * s);
      c.lineTo(x + 7.5 * s, y - 1 * s);
      stroke(c, 3);
      c.beginPath();
      c.ellipse(x, y - 1 * s, 7 * s, 7.5 * s, 0, Math.PI, 0);
      c.closePath();
      c.fillStyle = FUR;
      c.fill();
      stroke(c, 2.6);
    } else {
      ell(c, x - 2.5 * s, y + 1 * s, 3.8 * s, 4.6 * s);
      c.fillStyle = PAL.nose;
      c.fill();
      ell(c, x - 3.5 * s, y - 1.5 * s, 1.3 * s, 1.5 * s);
      c.fillStyle = PAL.white;
      c.fill();
    }
  };
  eye(hx - 20, hy - 8, 1.15);
  eye(hx + 4, hy - 9, 1);
  // Heavy angry brows (one with a scar through it).
  if (r.face !== 'dizzy') {
    c.beginPath();
    c.moveTo(hx - 32, hy - 22);
    c.lineTo(hx - 10, hy - 16);
    c.moveTo(hx - 4, hy - 17);
    c.lineTo(hx + 14, hy - 22);
    stroke(c, 5);
  }
  c.beginPath();
  c.moveTo(hx + 10, hy - 26);
  c.lineTo(hx + 2, hy + 2);
  stroke(c, 2.6, PAL.coral);
  // Mouth: smirk / laugh, with buck teeth (one gold).
  if (r.face === 'laugh') {
    c.beginPath();
    c.moveTo(hx - 32, hy + 16);
    c.quadraticCurveTo(hx - 16, hy + 40, hx - 2, hy + 14);
    c.closePath();
    fillStroke(c, '#7a2a3a', 2.6);
    ell(c, hx - 16, hy + 26, 6, 3.5);
    c.fillStyle = PAL.coral;
    c.fill();
  } else if (r.face === 'dizzy') {
    c.beginPath();
    c.moveTo(hx - 30, hy + 20);
    c.quadraticCurveTo(hx - 24, hy + 16, hx - 18, hy + 20);
    c.quadraticCurveTo(hx - 12, hy + 24, hx - 6, hy + 20);
    stroke(c, 2.6);
  } else {
    c.beginPath();
    c.moveTo(hx - 32, hy + 18);
    c.quadraticCurveTo(hx - 18, hy + 24, hx - 4, hy + 12);
    stroke(c, 2.8);
  }
  rr(c, hx - 30, hy + 17, 7, 8, 1.5);
  fillStroke(c, PAL.white, 2);
  rr(c, hx - 23, hy + 17, 7, 8, 1.5);
  fillStroke(c, PAL.tag, 2);
  // Whiskers.
  c.beginPath();
  c.moveTo(hx - 30, hy + 8);
  c.lineTo(hx - 50, hy + 2);
  c.moveTo(hx - 30, hy + 12);
  c.lineTo(hx - 50, hy + 14);
  stroke(c, 1.4);
  // Arms in front.
  if (!farBehind) bossArm(c, r.far);
  bossArm(c, r.near);
  if (r.toy) {
    c.save();
    c.translate(r.toy[0], r.toy[1]);
    c.rotate(r.toy[2]);
    c.translate(-31, -15);
    drawToy(c);
    c.restore();
    // Re-draw the fist over the toy so he is gripping it.
    const fist = r.toy[1] < 100 ? r.near[2] : r.near[2];
    ell(c, fist[0], fist[1], 12, 11);
    fillStroke(c, CREAM, 3);
  }
  if (pose === 'sneak') {
    // Finger to the lips: shhh.
    rr(c, r.near[2][0] - 16, r.near[2][1] - 18, 6, 18, 3);
    fillStroke(c, CREAM, 2.4);
  }
  c.restore();
}

export function generateSquirrelArt(scene: Phaser.Scene): void {
  makeTexture(scene, 'toy', 62, 30, drawToy);
  for (const p of ['idle', 'taunt', 'throw', 'run', 'startled'] as SquirrelPose[]) {
    makeTexture(scene, `squirrel_${p}`, 90, 90, (c) => drawSquirrel(c, p));
  }
  for (const p of ['sneak', 'grab', 'run', 'flex', 'stunned'] as BossPose[]) {
    makeTexture(scene, `boss_${p}`, BOSS_SIZE.w, BOSS_SIZE.h, (c) => drawBoss(c, p));
  }
  makeTexture(scene, 'acorn', 22, 24, (c) => drawAcorn(c, 11, 13, 1.1));
  makeTexture(scene, 'nut_pile', 40, 28, (c) => {
    // Prefer the hand-drawn acorn when it is loaded.
    const art = scene.textures.exists('acorn') ? (scene.textures.get('acorn').getSourceImage() as CanvasImageSource) : null;
    if (art) {
      c.drawImage(art, 1, 7, 18, 21);
      c.drawImage(art, 21, 7, 18, 21);
      c.save();
      c.translate(20, 13);
      c.rotate(0.3);
      c.drawImage(art, -10, -12, 19, 23);
      c.restore();
      return;
    }
    drawAcorn(c, 10, 17, 1);
    drawAcorn(c, 29, 17, 1);
    drawAcorn(c, 20, 11, 1.1);
  });
}
