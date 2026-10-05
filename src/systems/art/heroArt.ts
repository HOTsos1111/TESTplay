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
  ear: { w: 40, h: 76, ox: 0.4, oy: 0.06 },
  legNear: { w: 18, h: 28, ox: 0.5, oy: 0.14 },
  legFar: { w: 18, h: 28, ox: 0.5, oy: 0.14 },
  tail: { w: 46, h: 26, ox: 0.9, oy: 0.62 },
  collar: { w: 18, h: 42, ox: 0.5, oy: 0.5 },
  eye: { w: 40, h: 44, ox: 0.5, oy: 0.5 },
  mouth: { w: 22, h: 18, ox: 0.3, oy: 0.2 },
  propeller: { w: 64, h: 64, ox: 0.5, oy: 0.5 },
} as const;

export type EyeKind = 'open' | 'determined' | 'surprised' | 'happy' | 'closed' | 'dizzy';
export const EYES: EyeKind[] = ['open', 'determined', 'surprised', 'happy', 'closed', 'dizzy'];

function drawBody(c: Ctx): void {
  // Long sausage body (style guide: chestnut with a cream underside and chest).
  rr(c, 6, 9, 112, 40, 20);
  fillStroke(c, PAL.chestnut, 3.5);
  c.save();
  rr(c, 6, 9, 112, 40, 20);
  c.clip();
  // Cream belly running the length of the underside, widening into the chest.
  c.beginPath();
  c.moveTo(14, 52);
  c.quadraticCurveTo(30, 40, 60, 42);
  c.quadraticCurveTo(92, 42, 104, 26);
  c.quadraticCurveTo(116, 30, 122, 52);
  c.closePath();
  c.fillStyle = PAL.cream;
  c.fill();
  c.beginPath();
  c.moveTo(18, 47);
  c.quadraticCurveTo(34, 38, 60, 40);
  c.quadraticCurveTo(90, 40, 103, 25);
  stroke(c, 2.5);
  // Back shading.
  ell(c, 58, 5, 56, 9);
  c.fillStyle = PAL.chestnutDark;
  c.globalAlpha = 0.4;
  c.fill();
  c.globalAlpha = 1;
  c.restore();
  // Highlight along the back.
  c.beginPath();
  c.moveTo(28, 17);
  c.quadraticCurveTo(56, 12, 86, 16);
  stroke(c, 3, 'rgba(255,240,215,0.5)');
  rr(c, 6, 9, 112, 40, 20);
  stroke(c, 3.5);
}

function drawHead(c: Ctx): void {
  // Long-ish snout: chestnut bridge, cream jaw, big shiny nose at the tip.
  c.beginPath();
  c.moveTo(34, 18);
  c.quadraticCurveTo(54, 21, 70, 28);
  c.quadraticCurveTo(78, 32, 75, 40);
  c.quadraticCurveTo(70, 47, 56, 50);
  c.quadraticCurveTo(44, 53, 36, 48);
  c.closePath();
  fillStroke(c, PAL.chestnut, 3.5);
  c.save();
  c.clip();
  ell(c, 56, 49, 24, 10, -0.12);
  c.fillStyle = PAL.cream;
  c.fill();
  c.restore();
  // Round skull.
  ell(c, 26, 31, 25, 25);
  fillStroke(c, PAL.chestnut, 3.5);
  // Cream cheek flowing into the jaw.
  c.beginPath();
  c.moveTo(30, 52);
  c.quadraticCurveTo(38, 38, 52, 44);
  c.quadraticCurveTo(46, 54, 30, 52);
  c.closePath();
  c.fillStyle = PAL.cream;
  c.fill();
  // Re-stroke the snout seam over the skull so the profile reads.
  c.beginPath();
  c.moveTo(44, 21);
  c.quadraticCurveTo(58, 23, 70, 28);
  stroke(c, 3.5);
  // Forehead highlight and a little hair tuft.
  ell(c, 18, 14, 9, 4.5, -0.4);
  c.fillStyle = 'rgba(255,240,215,0.35)';
  c.fill();
  // Big glossy nose.
  ell(c, 73, 32, 7.5, 6, 0.2);
  fillStroke(c, PAL.nose, 2.5);
  ell(c, 71, 29.5, 2.6, 1.6, 0.2);
  c.fillStyle = 'rgba(255,255,255,0.7)';
  c.fill();
  // Happy grin that tucks up into the cheek.
  c.beginPath();
  c.moveTo(45, 45);
  c.quadraticCurveTo(57, 50, 69, 42);
  stroke(c, 2.8);
  c.beginPath();
  c.moveTo(47, 42);
  c.quadraticCurveTo(44, 45, 46, 48);
  stroke(c, 2.4);
  // Rosy blush.
  ell(c, 38, 42, 5.5, 3.2);
  c.fillStyle = 'rgba(240,117,98,0.45)';
  c.fill();
}
function drawEar(c: Ctx): void {
  // Long floppy velvet ear: a narrow root, widening into a rounded paddle.
  c.beginPath();
  c.moveTo(13, 3);
  c.quadraticCurveTo(26, 1, 28, 16);
  c.quadraticCurveTo(37, 44, 33, 62);
  c.quadraticCurveTo(28, 75, 17, 73);
  c.quadraticCurveTo(5, 71, 4, 56);
  c.quadraticCurveTo(3, 30, 7, 13);
  c.quadraticCurveTo(8, 5, 13, 3);
  c.closePath();
  fillStroke(c, PAL.ear, 3.2);
  c.save();
  c.clip();
  ell(c, 27, 54, 9, 22, 0.15);
  c.fillStyle = PAL.earDark;
  c.globalAlpha = 0.55;
  c.fill();
  c.restore();
  c.beginPath();
  c.moveTo(14, 14);
  c.quadraticCurveTo(19, 40, 14, 62);
  stroke(c, 2.5, 'rgba(255,225,170,0.22)');
}
function drawLeg(c: Ctx, color: string, paw: string): void {
  rr(c, 4, 2, 11, 19, 5.5);
  fillStroke(c, color, 3);
  // Cream paw with toe lines.
  ell(c, 10.5, 22.5, 7.5, 4.6);
  fillStroke(c, paw, 3);
  c.beginPath();
  c.moveTo(10.5, 20);
  c.lineTo(10.5, 25);
  c.moveTo(14, 20.5);
  c.lineTo(14, 24.5);
  stroke(c, 1.6);
}

function drawTail(c: Ctx): void {
  // Thin, tapering tail with an upturned tip; the thick root tucks under the body.
  c.beginPath();
  c.moveTo(45, 11);
  c.quadraticCurveTo(24, 15, 9, 6);
  c.quadraticCurveTo(3, 1, 3, 4);
  c.quadraticCurveTo(4, 9, 10, 12);
  c.quadraticCurveTo(26, 22, 45, 22);
  c.closePath();
  fillStroke(c, PAL.chestnut, 3);
}
function drawCollar(c: Ctx): void {
  rr(c, 3, 3, 12, 32, 6);
  fillStroke(c, PAL.teal, 3);
  c.beginPath();
  c.moveTo(6, 8);
  c.lineTo(6, 28);
  stroke(c, 2, 'rgba(255,255,255,0.5)');
  // Round golden tag.
  ell(c, 9, 37, 6, 6);
  fillStroke(c, PAL.tag, 2.5);
  ell(c, 9, 37, 2.5, 2.5);
  stroke(c, 1.5, 'rgba(48,35,49,0.5)');
}

function drawEye(c: Ctx, kind: EyeKind): void {
  const cx = 20;
  const cy = 22;
  switch (kind) {
    case 'open':
    case 'determined': {
      // Classic cartoon eye: tall white oval, big black pupil looking ahead.
      ell(c, cx, cy, 12, 16);
      fillStroke(c, PAL.white, 3);
      ell(c, cx + 4, cy + 2, 6.5, 9.5);
      c.fillStyle = PAL.nose;
      c.fill();
      ell(c, cx + 5.5, cy - 3, 2.6, 3.2);
      c.fillStyle = PAL.white;
      c.fill();
      c.beginPath();
      if (kind === 'determined') {
        c.moveTo(cx - 11, cy - 19);
        c.quadraticCurveTo(cx, cy - 23, cx + 12, cy - 17);
      } else {
        c.moveTo(cx - 6, cy - 21);
        c.quadraticCurveTo(cx + 1, cy - 24, cx + 8, cy - 21);
      }
      stroke(c, 3.2);
      break;
    }
    case 'surprised': {
      ell(c, cx, cy, 14, 18);
      fillStroke(c, PAL.white, 3);
      ell(c, cx + 1, cy, 4.5, 5.5);
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
  makeTexture(scene, 'hero_leg_near', P.legNear.w, P.legNear.h, (c) => drawLeg(c, PAL.chestnut, PAL.cream));
  makeTexture(scene, 'hero_leg_far', P.legFar.w, P.legFar.h, (c) => drawLeg(c, '#93552C', '#E6C38C'));
  makeTexture(scene, 'hero_tail', P.tail.w, P.tail.h, drawTail);
  makeTexture(scene, 'hero_collar', P.collar.w, P.collar.h, drawCollar);
  makeTexture(scene, 'hero_mouth', P.mouth.w, P.mouth.h, drawMouth);
  makeTexture(scene, 'hero_propeller', P.propeller.w, P.propeller.h, drawPropeller);
  for (const e of EYES) makeTexture(scene, `hero_eye_${e}`, P.eye.w, P.eye.h, (c) => drawEye(c, e));
}
