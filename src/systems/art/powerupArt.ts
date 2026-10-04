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

function drawGoldenBone(c: Ctx): void {
  c.save();
  c.translate(24, 24);
  c.rotate(-0.5);
  for (const [x, y] of [[-14, -5], [-14, 5], [14, -5], [14, 5]]) {
    ell(c, x, y, 7, 7);
    fillStroke(c, PAL.butter, 2.5);
  }
  rr(c, -14, -5, 28, 10, 3);
  c.fillStyle = PAL.butter;
  c.fill();
  c.beginPath();
  c.moveTo(-12, -5);
  c.lineTo(12, -5);
  c.moveTo(-12, 5);
  c.lineTo(12, 5);
  stroke(c, 2.5);
  c.fillStyle = 'rgba(255,255,255,0.7)';
  c.fillRect(-10, -3, 14, 2);
  c.restore();
  // Magnet sparkles.
  for (const [x, y] of [[6, 8], [42, 40], [40, 6]]) {
    c.beginPath();
    c.moveTo(x, y - 5);
    c.lineTo(x + 1.5, y - 1.5);
    c.lineTo(x + 5, y);
    c.lineTo(x + 1.5, y + 1.5);
    c.lineTo(x, y + 5);
    c.lineTo(x - 1.5, y + 1.5);
    c.lineTo(x - 5, y);
    c.lineTo(x - 1.5, y - 1.5);
    c.closePath();
    c.fillStyle = PAL.white;
    c.fill();
  }
}

function drawCollar(c: Ctx): void {
  // Spiked collar ring with a glowing shield-shaped gem.
  ell(c, 24, 24, 18, 16);
  stroke(c, 10, PAL.outline);
  ell(c, 24, 24, 18, 16);
  stroke(c, 6, '#7A4FB5');
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x = 24 + Math.cos(a) * 18;
    const y = 24 + Math.sin(a) * 16;
    c.beginPath();
    c.moveTo(x + Math.cos(a) * 7, y + Math.sin(a) * 7);
    c.lineTo(x + Math.cos(a + 1.6) * 3, y + Math.sin(a + 1.6) * 3);
    c.lineTo(x + Math.cos(a - 1.6) * 3, y + Math.sin(a - 1.6) * 3);
    c.closePath();
    fillStroke(c, '#E6E9F0', 1.5);
  }
  c.beginPath();
  c.moveTo(24, 32);
  c.lineTo(16, 38);
  c.lineTo(16, 45);
  c.quadraticCurveTo(24, 50, 32, 45);
  c.lineTo(32, 38);
  c.closePath();
  fillStroke(c, PAL.teal, 2.5);
}

function drawWhistle(c: Ctx): void {
  c.save();
  c.translate(24, 26);
  c.rotate(-0.35);
  rr(c, -18, -7, 24, 14, 4);
  fillStroke(c, '#D7DEE8', 3);
  ell(c, 10, 3, 11, 11);
  fillStroke(c, '#D7DEE8', 3);
  ell(c, 10, 3, 4, 4);
  c.fillStyle = PAL.outline;
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.8)';
  c.fillRect(-15, -4, 16, 3);
  c.restore();
  for (const r of [8, 14]) {
    c.beginPath();
    c.arc(38, 12, r, -1.2, 0.2);
    stroke(c, 2.5, PAL.coral);
  }
}

function drawBacon(c: Ctx): void {
  c.beginPath();
  c.moveTo(6, 30);
  c.bezierCurveTo(14, 18, 20, 38, 28, 24);
  c.bezierCurveTo(34, 12, 40, 26, 44, 16);
  c.lineTo(44, 28);
  c.bezierCurveTo(40, 38, 34, 24, 28, 36);
  c.bezierCurveTo(20, 50, 14, 30, 6, 42);
  c.closePath();
  fillStroke(c, '#D9604A', 3);
  c.beginPath();
  c.moveTo(8, 36);
  c.bezierCurveTo(14, 26, 20, 44, 28, 30);
  c.bezierCurveTo(34, 18, 40, 32, 44, 22);
  stroke(c, 3.5, '#FFD9C4');
  // Steam wiggles: it's hot and fresh.
  for (const x of [16, 30]) {
    c.beginPath();
    c.moveTo(x, 14);
    c.quadraticCurveTo(x - 4, 9, x, 5);
    c.quadraticCurveTo(x + 4, 1, x, -3);
    stroke(c, 2, 'rgba(255,255,255,0.85)');
  }
}

function drawShieldBubble(c: Ctx): void {
  const g = c.createRadialGradient(80, 50, 20, 80, 50, 78);
  g.addColorStop(0, 'rgba(122,79,181,0)');
  g.addColorStop(0.75, 'rgba(122,79,181,0.12)');
  g.addColorStop(1, 'rgba(160,120,230,0.45)');
  ell(c, 80, 50, 76, 46);
  c.fillStyle = g;
  c.fill();
  stroke(c, 3, 'rgba(220,200,255,0.9)');
  c.beginPath();
  c.ellipse(80, 50, 64, 36, 0, -2.7, -1.9);
  stroke(c, 4, 'rgba(255,255,255,0.8)');
}

export function generatePowerUpArt(scene: Phaser.Scene): void {
  makeTexture(scene, 'pu_bubble', 64, 64, drawBubble);
  makeTexture(scene, 'pu_magnet', 48, 48, drawGoldenBone);
  makeTexture(scene, 'pu_shield', 48, 52, drawCollar);
  makeTexture(scene, 'pu_whistle', 52, 48, drawWhistle);
  makeTexture(scene, 'pu_bacon', 50, 48, drawBacon);
  makeTexture(scene, 'shield_bubble', 160, 100, drawShieldBubble);
}
