import type Phaser from 'phaser';
import { ell, fillStroke, makeTexture, PAL, rr, stroke, type Ctx } from './canvas';

/**
 * The Pigeon Captain (chapter 2 finale), in the character-sheet style: a portly
 * lilac-grey pigeon with an iridescent neck, a navy captain's hat with a gold
 * badge, and big coral feet. 220×180 canvas, facing left, feet near y=170.
 */
export type PigeonPose = 'fly_up' | 'fly_down' | 'dive' | 'peck' | 'stunned';
export const PIGEON_SIZE = { w: 220, h: 180 } as const;

const OUT = '#302331';
const BODY = '#A9A3C6';
const BODY_DARK = '#7E7AA0';
const BELLY = '#D9D4EA';
const NECK_A = '#6FB59A';
const NECK_B = '#9A6FC0';
const FEET = '#F07562';
const NAVY = '#2E3A66';

function wing(c: Ctx, x: number, y: number, angle: number, len: number): void {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.beginPath();
  c.moveTo(0, -10);
  c.quadraticCurveTo(len * 0.5, -26, len, -12);
  c.lineTo(len - 8, -2);
  c.lineTo(len - 20, 4);
  c.lineTo(len - 34, 8);
  c.quadraticCurveTo(len * 0.4, 18, 0, 12);
  c.closePath();
  fillStroke(c, BODY_DARK, 3.5, OUT);
  // Dark wing bars.
  for (const t of [0.45, 0.62]) {
    c.beginPath();
    c.moveTo(len * t, -16);
    c.lineTo(len * t + 6, 10);
    stroke(c, 5, '#4E4A6E');
  }
  c.restore();
}

function hat(c: Ctx, x: number, y: number, tilt: number, off = false): void {
  c.save();
  c.translate(x, y);
  c.rotate(tilt);
  // Crown, band, peak and gold badge.
  rr(c, -26, -26, 52, 22, 8);
  fillStroke(c, NAVY, 3.5, OUT);
  rr(c, -24, -8, 48, 8, 2);
  fillStroke(c, '#1E2648', 2.5, OUT);
  c.beginPath();
  c.moveTo(-30, 0);
  c.quadraticCurveTo(-44, 6, -48, 2);
  c.lineTo(-24, -2);
  c.closePath();
  fillStroke(c, '#1E2648', 3, OUT);
  ell(c, -4, -16, 7, 6);
  fillStroke(c, PAL.tag, 2.5, OUT);
  c.beginPath();
  c.moveTo(-26, -6);
  c.lineTo(26, -6);
  stroke(c, 2.5, PAL.tag);
  c.restore();
  void off;
}

export function drawPigeon(c: Ctx, pose: PigeonPose): void {
  const dive = pose === 'dive';
  const peck = pose === 'peck';
  const stunned = pose === 'stunned';
  c.save();
  if (pose === 'fly_up') c.translate(0, 18);
  if (dive) {
    c.translate(110, 90);
    c.rotate(-0.22);
    c.translate(-110, -90);
  }
  // Far wing (behind the body).
  if (pose === 'fly_up') wing(c, 128, 74, -2.0, 80);
  else if (pose === 'fly_down') wing(c, 128, 84, -0.5, 92);
  else if (dive) wing(c, 132, 80, -0.15, 100);
  // Tail fan.
  c.beginPath();
  c.moveTo(150, 92);
  c.lineTo(206, 78);
  c.lineTo(212, 96);
  c.lineTo(206, 112);
  c.lineTo(150, 112);
  c.closePath();
  fillStroke(c, BODY_DARK, 3.5, OUT);
  c.fillStyle = '#4E4A6E';
  c.fillRect(196, 82, 8, 28);
  // Legs and big feet (tucked when flying).
  if (peck || stunned) {
    for (const lx of [92, 116]) {
      c.beginPath();
      c.moveTo(lx, 128);
      c.lineTo(lx - 2, 162);
      stroke(c, 6, OUT);
      stroke(c, 3, FEET);
      for (const [dx, dy] of [[-12, 6], [-4, 8], [6, 6]]) {
        c.beginPath();
        c.moveTo(lx - 2, 162);
        c.lineTo(lx - 2 + dx, 162 + dy);
        stroke(c, 6, OUT);
        stroke(c, 3, FEET);
      }
    }
  } else {
    for (const lx of [110, 124]) {
      ell(c, lx, 132, 8, 6);
      fillStroke(c, FEET, 2.5, OUT);
    }
  }
  // Plump body with a pale belly.
  ell(c, 112, 100, 56, 40, peck ? 0.2 : 0);
  fillStroke(c, BODY, 4, OUT);
  ell(c, 100, 112, 34, 20, peck ? 0.2 : 0);
  c.fillStyle = BELLY;
  c.fill();
  // Head and iridescent neck.
  const hx = peck ? 56 : 66;
  const hy = peck ? 112 : 60;
  ell(c, hx + 14, hy + 20, 26, 22);
  fillStroke(c, NECK_A, 3.5, OUT);
  c.save();
  ell(c, hx + 14, hy + 20, 26, 22);
  c.clip();
  ell(c, hx + 26, hy + 30, 20, 14);
  c.fillStyle = NECK_B;
  c.fill();
  c.restore();
  ell(c, hx, hy, 24, 22);
  fillStroke(c, BODY, 4, OUT);
  // Beak with a white cere.
  c.beginPath();
  c.moveTo(hx - 20, hy + 2);
  c.lineTo(hx - 40, hy + 8);
  c.lineTo(hx - 20, hy + 12);
  c.closePath();
  fillStroke(c, '#3B3540', 3, OUT);
  ell(c, hx - 19, hy + 2, 5, 3.5);
  fillStroke(c, PAL.white, 2, OUT);
  // Eye: orange ring, beady pupil, and a stern brow (or dizzy spirals).
  if (stunned) {
    c.beginPath();
    for (let i = 0; i < 22; i++) {
      const a = i * 0.6;
      const rad = 1 + i * 0.4;
      const px = hx - 4 + Math.cos(a) * rad;
      const py = hy - 4 + Math.sin(a) * rad;
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    stroke(c, 2.5, OUT);
  } else {
    ell(c, hx - 4, hy - 4, 8.5, 8.5);
    fillStroke(c, '#F2963B', 3, OUT);
    ell(c, hx - 5, hy - 4, 4, 4.5);
    c.fillStyle = OUT;
    c.fill();
    ell(c, hx - 6.5, hy - 6, 1.4, 1.4);
    c.fillStyle = PAL.white;
    c.fill();
    c.beginPath();
    c.moveTo(hx - 16, hy - 16);
    c.lineTo(hx + 6, hy - 10);
    stroke(c, 4.5, OUT);
  }
  // Near wing.
  if (pose === 'fly_up') wing(c, 118, 82, -1.65, 88);
  else if (pose === 'fly_down') wing(c, 118, 92, 0.35, 100);
  else if (dive) wing(c, 120, 90, 0.05, 108);
  else wing(c, 116, 96, 0.12, 74);
  // Captain's hat (knocked askew when stunned).
  if (stunned) hat(c, hx + 22, hy - 30, 0.6);
  else hat(c, hx + 4, hy - 16, peck ? -0.15 : -0.05);
  c.restore();
}

function drawBreadRoll(c: Ctx): void {
  // 46×32 crusty roll with score marks.
  ell(c, 23, 18, 20, 12);
  fillStroke(c, '#E0A35A', 3, OUT);
  ell(c, 19, 13, 12, 4);
  c.fillStyle = 'rgba(255,240,200,0.6)';
  c.fill();
  for (const x of [14, 22, 30]) {
    c.beginPath();
    c.moveTo(x - 3, 13);
    c.lineTo(x + 3, 20);
    stroke(c, 2, '#9A5A22');
  }
}

function drawFeather(c: Ctx): void {
  c.beginPath();
  c.moveTo(4, 20);
  c.quadraticCurveTo(10, 2, 26, 4);
  c.quadraticCurveTo(18, 18, 4, 20);
  c.closePath();
  fillStroke(c, BODY, 2, OUT);
  c.beginPath();
  c.moveTo(4, 20);
  c.lineTo(22, 6);
  stroke(c, 1.5, OUT);
}

export function generatePigeonArt(scene: Phaser.Scene): void {
  for (const p of ['fly_up', 'fly_down', 'dive', 'peck', 'stunned'] as PigeonPose[]) {
    makeTexture(scene, `pigeon_${p}`, PIGEON_SIZE.w, PIGEON_SIZE.h, (c) => drawPigeon(c, p));
  }
  makeTexture(scene, 'bread_roll', 46, 32, drawBreadRoll);
  makeTexture(scene, 'fx_feather', 30, 24, drawFeather);
}
