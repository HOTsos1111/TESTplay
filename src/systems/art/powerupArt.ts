import type Phaser from 'phaser';
import { ell, fillStroke, makeTexture, PAL, rr, stroke, type Ctx } from './canvas';

export type PowerUpKind = 'magnet' | 'shield' | 'whistle' | 'bacon';

function drawBubble(c: Ctx): void {
  const g = c.createRadialGradient(28, 24, 4, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.7, 'rgba(169,217,235,0.25)');
  g.addColorStop(1, 'rgba(169,217,235,0.5)');
  ell(c, 32, 32, 29, 29);
  c.fillStyle = g;
  c.fill();
  stroke(c, 3, 'rgba(255,253,246,0.95)');
  c.beginPath();
  c.arc(32, 32, 22, -2.6, -1.8);
  stroke(c, 3, 'rgba(255,255,255,0.9)');
}

function miniBone(c: Ctx, x: number, y: number, rot: number, s: number): void {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.scale(s, s);
  for (const [bx, by] of [[-6, -2.5], [-6, 2.5], [6, -2.5], [6, 2.5]]) {
    ell(c, bx, by, 3.2, 3.2);
    fillStroke(c, PAL.cream, 1.6 / s);
  }
  rr(c, -6, -2.5, 12, 5, 1.5);
  c.fillStyle = PAL.cream;
  c.fill();
  c.restore();
}

/** Bone Magnet: red horseshoe magnet with bones zipping in. */
function drawMagnet(c: Ctx): void {
  c.save();
  c.translate(21, 30);
  c.rotate(-0.5);
  c.scale(0.9, 0.9);
  c.beginPath();
  c.arc(0, 0, 15, Math.PI, 0, true);
  c.lineTo(15, -14);
  c.lineTo(6, -14);
  c.lineTo(6, 0);
  c.arc(0, 0, 6, 0, Math.PI, false);
  c.lineTo(-6, -14);
  c.lineTo(-15, -14);
  c.closePath();
  fillStroke(c, '#E04A3A', 3);
  rr(c, -15, -20, 9, 8, 1.5);
  fillStroke(c, '#C9D1DC', 2.5);
  rr(c, 6, -20, 9, 8, 1.5);
  fillStroke(c, '#C9D1DC', 2.5);
  c.beginPath();
  c.arc(0, 0, 11, Math.PI * 0.9, Math.PI * 0.4, true);
  stroke(c, 2, 'rgba(255,255,255,0.55)');
  c.restore();
  miniBone(c, 38, 10, 0.4, 1);
  miniBone(c, 41, 28, -0.3, 0.85);
  // Speed dashes.
  c.beginPath();
  c.moveTo(30, 6);
  c.lineTo(26, 5);
  c.moveTo(32, 30);
  c.lineTo(28, 31);
  stroke(c, 2, PAL.outline);
}

/** Soap Bubble Shield: iridescent bubble with a paw print. */
function drawSoapBubble(c: Ctx): void {
  const g = c.createRadialGradient(20, 20, 3, 24, 26, 22);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.6, 'rgba(160,226,224,0.55)');
  g.addColorStop(1, 'rgba(66,183,176,0.85)');
  ell(c, 24, 26, 21, 21);
  c.fillStyle = g;
  c.fill();
  stroke(c, 3, PAL.tealDark);
  // Paw print.
  ell(c, 24, 31, 6.5, 5.5);
  c.fillStyle = PAL.tealDark;
  c.fill();
  for (const [x, y] of [[16.5, 24], [21, 20], [27, 20], [31.5, 24]]) {
    ell(c, x, y, 2.6, 3);
    c.fill();
  }
  c.beginPath();
  c.arc(24, 26, 16, -2.7, -1.9);
  stroke(c, 3, 'rgba(255,255,255,0.95)');
  ell(c, 42, 10, 3.5, 3.5);
  fillStroke(c, 'rgba(200,240,238,0.7)', 1.6, PAL.tealDark);
  ell(c, 6, 44, 2.6, 2.6);
  fillStroke(c, 'rgba(200,240,238,0.7)', 1.4, PAL.tealDark);
}

function drawWhistle(c: Ctx): void {
  c.save();
  c.translate(24, 26);
  c.rotate(-0.35);
  rr(c, -18, -7, 24, 14, 4);
  fillStroke(c, PAL.teal, 3);
  ell(c, 10, 3, 11, 11);
  fillStroke(c, PAL.teal, 3);
  ell(c, 10, 3, 4, 4);
  c.fillStyle = PAL.outline;
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.8)';
  c.fillRect(-15, -4, 16, 3);
  c.restore();
  for (const r of [8, 14]) {
    c.beginPath();
    c.arc(38, 12, r, -1.2, 0.2);
    stroke(c, 2.5, PAL.teal);
  }
}

/** Speed Biscuit: a golden dog biscuit with speed streaks. */
function drawBiscuit(c: Ctx): void {
  for (const [x, y, w] of [[2, 16, 12], [0, 26, 14], [4, 36, 10]]) {
    rr(c, x, y, w, 3.5, 1.7);
    c.fillStyle = PAL.tag;
    c.fill();
  }
  c.save();
  c.translate(29, 26);
  c.rotate(-0.4);
  c.scale(0.92, 0.92);
  for (const [bx, by] of [[-12, -5], [-12, 5], [12, -5], [12, 5]]) {
    ell(c, bx, by, 7, 7);
    fillStroke(c, '#E8A94E', 2.6);
  }
  rr(c, -12, -6, 24, 12, 3);
  c.fillStyle = '#E8A94E';
  c.fill();
  c.beginPath();
  c.moveTo(-10, -6);
  c.lineTo(10, -6);
  c.moveTo(-10, 6);
  c.lineTo(10, 6);
  stroke(c, 2.6);
  for (const [dx, dy] of [[-12, -3], [-5, 1], [3, -2], [9, 2], [13, -5]]) {
    ell(c, dx, dy, 1.2, 1.2);
    c.fillStyle = '#9A5A22';
    c.fill();
  }
  c.restore();
}

function drawShieldBubble(c: Ctx): void {
  // Soap bubble around the hero: clear centre, teal/pink iridescent rim.
  const g = c.createRadialGradient(80, 50, 20, 80, 50, 78);
  g.addColorStop(0, 'rgba(160,226,224,0)');
  g.addColorStop(0.72, 'rgba(160,226,224,0.12)');
  g.addColorStop(0.9, 'rgba(243,160,186,0.25)');
  g.addColorStop(1, 'rgba(66,183,176,0.5)');
  ell(c, 80, 50, 76, 46);
  c.fillStyle = g;
  c.fill();
  stroke(c, 3, 'rgba(200,240,238,0.95)');
  c.beginPath();
  c.ellipse(80, 50, 64, 36, 0, -2.7, -1.9);
  stroke(c, 4, 'rgba(255,255,255,0.8)');
}

export function generatePowerUpArt(scene: Phaser.Scene): void {
  makeTexture(scene, 'pu_bubble', 64, 64, drawBubble);
  makeTexture(scene, 'pu_magnet', 48, 48, drawMagnet);
  makeTexture(scene, 'pu_shield', 48, 52, drawSoapBubble);
  makeTexture(scene, 'pu_whistle', 52, 48, drawWhistle);
  makeTexture(scene, 'pu_bacon', 50, 48, drawBiscuit);
  makeTexture(scene, 'shield_bubble', 160, 100, drawShieldBubble);
}
