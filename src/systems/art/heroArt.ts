import type Phaser from 'phaser';
import { ell, fillStroke, makeTexture, PAL, rr, stroke, type Ctx } from './canvas';

/**
 * Hero is assembled from separately animated parts (rubber-hose rig) so
 * squash/stretch, ears, legs and the propeller tail can move independently.
 * Part textures and their pivots are documented in docs/asset_manifest.md.
 */
export const HERO_PARTS = {
  body: { w: 124, h: 58, ox: 0.5, oy: 0.5 },
  head: { w: 80, h: 66, ox: 0.32, oy: 0.62 },
  ear: { w: 40, h: 66, ox: 0.42, oy: 0.07 },
  legNear: { w: 18, h: 28, ox: 0.5, oy: 0.14 },
  legFar: { w: 18, h: 28, ox: 0.5, oy: 0.14 },
  tail: { w: 46, h: 26, ox: 0.9, oy: 0.62 },
  collar: { w: 18, h: 42, ox: 0.5, oy: 0.5 },
  eye: { w: 36, h: 36, ox: 0.5, oy: 0.5 },
  mouth: { w: 22, h: 18, ox: 0.3, oy: 0.2 },
  propeller: { w: 64, h: 64, ox: 0.5, oy: 0.5 },
} as const;

export type EyeKind = 'open' | 'determined' | 'surprised' | 'happy' | 'closed' | 'dizzy';
export const EYES: EyeKind[] = ['open', 'determined', 'surprised', 'happy', 'closed', 'dizzy'];

function drawBody(c: Ctx): void {
  // Long sausage body.
  rr(c, 6, 9, 112, 40, 20);
  fillStroke(c, PAL.chestnut, 3.5);
  // Lighter chest/belly band.
  c.save();
  rr(c, 6, 9, 112, 40, 20);
  c.clip();
  ell(c, 70, 50, 52, 12);
  c.fillStyle = PAL.chestnutLight;
  c.fill();
  // Back shading.
  ell(c, 60, 6, 56, 10);
  c.fillStyle = PAL.chestnutDark;
  c.globalAlpha = 0.45;
  c.fill();
  c.globalAlpha = 1;
  c.restore();
  // Highlight.
  c.beginPath();
  c.moveTo(30, 17);
  c.quadraticCurveTo(60, 12, 92, 17);
  stroke(c, 3, 'rgba(255,240,215,0.55)');
  // Outline again so the clip edge stays crisp.
  rr(c, 6, 9, 112, 40, 20);
  stroke(c, 3.5);
}

function drawHead(c: Ctx): void {
  // Short cute snout (cream), drawn under a big round skull.
  ell(c, 54, 42, 16, 11, -0.08);
  fillStroke(c, PAL.cream, 3);
  ell(c, 28, 31, 26, 25);
  fillStroke(c, PAL.chestnut, 3.5);
  // Cheek blending into the muzzle, and a rosy blush.
  ell(c, 43, 41, 10, 8);
  c.fillStyle = PAL.cream;
  c.fill();
  ell(c, 33, 44, 7, 4.5);
  c.fillStyle = 'rgba(240,117,98,0.55)';
  c.fill();
  // Forehead highlight.
  ell(c, 22, 15, 10, 5, -0.3);
  c.fillStyle = 'rgba(255,240,215,0.35)';
  c.fill();
  // Button nose.
  ell(c, 68, 37, 6.5, 5.5);
  fillStroke(c, PAL.outline, 0);
  ell(c, 66.5, 35, 2, 1.4);
  c.fillStyle = '#9f8aa2';
  c.fill();
  // Little smile.
  c.beginPath();
  c.moveTo(50, 49);
  c.quadraticCurveTo(57, 53, 64, 46);
  stroke(c, 2.5);
}
function drawEar(c: Ctx): void {
  // Long, wide, floppy velvet ear with a soft curl at the tip.
  c.beginPath();
  c.moveTo(12, 4);
  c.quadraticCurveTo(34, 2, 33, 24);
  c.quadraticCurveTo(34, 50, 24, 61);
  c.quadraticCurveTo(14, 66, 8, 57);
  c.quadraticCurveTo(2, 40, 5, 22);
  c.quadraticCurveTo(6, 8, 12, 4);
  c.closePath();
  fillStroke(c, PAL.ear, 3);
  c.beginPath();
  c.moveTo(16, 14);
  c.quadraticCurveTo(22, 34, 16, 52);
  stroke(c, 2.5, 'rgba(255,225,170,0.22)');
}
function drawLeg(c: Ctx, color: string): void {
  rr(c, 3.5, 2, 11, 20, 5.5);
  fillStroke(c, color, 3);
  ell(c, 10, 22.5, 7.5, 4.2);
  fillStroke(c, color === PAL.chestnut ? PAL.chestnutDark : '#6d3818', 3);
}

function drawTail(c: Ctx): void {
  // Thick at the root (tucks under the body's rear), tapering to a curled tip.
  c.beginPath();
  c.moveTo(43, 10);
  c.quadraticCurveTo(26, 8, 12, 4);
  c.quadraticCurveTo(4, 2, 3, 7);
  c.quadraticCurveTo(4, 11, 12, 11);
  c.quadraticCurveTo(26, 17, 43, 22);
  c.closePath();
  fillStroke(c, PAL.chestnut, 3);
  ell(c, 7, 7, 3, 2.2);
  c.fillStyle = PAL.chestnutDark;
  c.fill();
}
function drawCollar(c: Ctx): void {
  rr(c, 3, 3, 12, 32, 6);
  fillStroke(c, PAL.teal, 3);
  c.beginPath();
  c.moveTo(6, 8);
  c.lineTo(6, 28);
  stroke(c, 2, 'rgba(255,255,255,0.5)');
  ell(c, 9, 36, 5, 5);
  fillStroke(c, PAL.butter, 2.5);
}

function drawEye(c: Ctx, kind: EyeKind): void {
  const cx = 18;
  const cy = 18;
  switch (kind) {
    case 'open':
    case 'determined': {
      ell(c, cx, cy, 11, 13);
      fillStroke(c, PAL.white, 3);
      ell(c, cx + 2.5, cy + 1.5, 7.5, 9);
      c.fillStyle = '#3B2A3E';
      c.fill();
      ell(c, cx + 3, cy + 3, 4.5, 5.5);
      c.fillStyle = PAL.outline;
      c.fill();
      ell(c, cx + 5.5, cy - 3, 3, 3.2);
      c.fillStyle = PAL.white;
      c.fill();
      ell(c, cx - 0.5, cy + 6, 1.5, 1.5);
      c.fill();
      if (kind === 'determined') {
        // A brave little brow, not an angry lid.
        c.beginPath();
        c.moveTo(cx - 10, cy - 15);
        c.quadraticCurveTo(cx, cy - 18, cx + 11, cy - 12);
        stroke(c, 3.2);
      }
      break;
    }
    case 'surprised': {
      ell(c, cx, cy, 13, 15);
      fillStroke(c, PAL.white, 3);
      ell(c, cx + 1, cy, 4, 4.5);
      c.fillStyle = PAL.outline;
      c.fill();
      ell(c, cx + 3, cy - 3, 1.5, 1.5);
      c.fillStyle = PAL.white;
      c.fill();
      break;
    }
    case 'happy': {
      c.beginPath();
      c.moveTo(cx - 9, cy + 4);
      c.quadraticCurveTo(cx, cy - 10, cx + 9, cy + 4);
      stroke(c, 3.5);
      break;
    }
    case 'closed': {
      c.beginPath();
      c.moveTo(cx - 9, cy + 2);
      c.quadraticCurveTo(cx, cy + 7, cx + 9, cy + 2);
      stroke(c, 3.5);
      break;
    }
    case 'dizzy': {
      c.beginPath();
      for (let i = 0; i < 30; i++) {
        const a = i * 0.55;
        const r = 1 + i * 0.38;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      stroke(c, 2.6);
      break;
    }
  }
}

function drawMouth(c: Ctx): void {
  c.beginPath();
  c.moveTo(2, 3);
  c.quadraticCurveTo(10, 2, 20, 4);
  c.quadraticCurveTo(14, 17, 5, 14);
  c.closePath();
  fillStroke(c, '#7a2a3a', 2.6);
  ell(c, 9, 12, 4.5, 3);
  c.fillStyle = PAL.coral;
  c.fill();
}

function drawPropeller(c: Ctx): void {
  // Motion-blur disc plus two solid tail "blades" so the spin reads at any frame.
  const g = c.createRadialGradient(32, 32, 4, 32, 32, 31);
  g.addColorStop(0, 'rgba(255,225,170,0.9)');
  g.addColorStop(0.7, 'rgba(255,225,170,0.45)');
  g.addColorStop(1, 'rgba(255,225,170,0)');
  ell(c, 32, 32, 31, 31);
  c.fillStyle = g;
  c.fill();
  ell(c, 32, 32, 27, 27);
  stroke(c, 2.5, 'rgba(48,35,49,0.35)');
  for (let i = 0; i < 2; i++) {
    c.save();
    c.translate(32, 32);
    c.rotate(i * Math.PI);
    c.beginPath();
    c.moveTo(2, -4);
    c.quadraticCurveTo(18, -9, 28, -2);
    c.quadraticCurveTo(18, 6, 2, 4);
    c.closePath();
    fillStroke(c, PAL.chestnut, 2.8);
    c.beginPath();
    c.arc(0, 0, 22, 0.35, 1.25);
    stroke(c, 3, 'rgba(255,255,255,0.85)');
    c.restore();
  }
  ell(c, 32, 32, 6, 6);
  fillStroke(c, PAL.chestnutDark, 2.5);
}

export function generateHeroArt(scene: Phaser.Scene): void {
  const P = HERO_PARTS;
  makeTexture(scene, 'hero_body', P.body.w, P.body.h, drawBody);
  makeTexture(scene, 'hero_head', P.head.w, P.head.h, drawHead);
  makeTexture(scene, 'hero_ear', P.ear.w, P.ear.h, drawEar);
  makeTexture(scene, 'hero_leg_near', P.legNear.w, P.legNear.h, (c) => drawLeg(c, PAL.chestnut));
  makeTexture(scene, 'hero_leg_far', P.legFar.w, P.legFar.h, (c) => drawLeg(c, '#8f4f27'));
  makeTexture(scene, 'hero_tail', P.tail.w, P.tail.h, drawTail);
  makeTexture(scene, 'hero_collar', P.collar.w, P.collar.h, drawCollar);
  makeTexture(scene, 'hero_mouth', P.mouth.w, P.mouth.h, drawMouth);
  makeTexture(scene, 'hero_propeller', P.propeller.w, P.propeller.h, drawPropeller);
  for (const e of EYES) makeTexture(scene, `hero_eye_${e}`, P.eye.w, P.eye.h, (c) => drawEye(c, e));
}
