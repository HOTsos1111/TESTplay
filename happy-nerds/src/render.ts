import { BRAIN, GATE, LIVES, VIEW } from './config';
import { brainTilt, openings, type Brain, type GameState, type Gate } from './game';

/** Placeholder look: flat shapes only. Real art from assets/ replaces these later. */
const COLORS = {
  skyTop: '#7FD3F7',
  skyBottom: '#D9F3FF',
  gate: '#4CAF50',
  gateEdge: '#2E6B30',
  gateLip: '#66C26A',
  brain: '#FF9DBB',
  brainEdge: '#D9577F',
  brainFold: '#E8789C',
  wing: '#FFFFFF',
  wingBack: '#DCE9F5',
  wingEdge: '#8FB3D1',
  ink: '#1F2A44',
  plaque: '#FFFFFF',
  answer: '#FFD84D',
  answerEdge: '#C99A00',
  panel: 'rgba(255,255,255,0.86)',
  shade: 'rgba(31,42,68,0.94)',
  good: '#2E9E44',
  bad: '#D63A3A',
};

const FONT = '"Trebuchet MS", "Segoe UI", sans-serif';

export interface Popup {
  text: string;
  color: string;
  x: number;
  y: number;
  ttl: number;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Break text into lines no wider than maxWidth (longer questions wrap cleanly). */
export function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// ---------- Gate ----------

const QUESTION_MAX_WIDTH = 300;

function drawGate(ctx: CanvasRenderingContext2D, gate: Gate, time: number) {
  const left = gate.x - GATE.width / 2;
  const [[aTop, aBottom], [bTop, bBottom]] = openings(gate);
  const solids: [number, number][] = [
    [-60, aTop],
    [aBottom, bTop],
    [bBottom, VIEW.height + 60],
  ];
  ctx.lineWidth = 4;
  for (const [top, bottom] of solids) {
    ctx.fillStyle = COLORS.gate;
    ctx.strokeStyle = COLORS.gateEdge;
    roundRect(ctx, left, top, GATE.width, bottom - top, 8);
    ctx.fill();
    ctx.stroke();
  }
  // Lips around each opening, like pipe ends.
  for (const y of [aTop, aBottom, bTop, bBottom]) {
    const lipTop = y === aTop || y === bTop ? y - 22 : y;
    ctx.fillStyle = COLORS.gateLip;
    roundRect(ctx, left - 8, lipTop, GATE.width + 16, 22, 6);
    ctx.fill();
    ctx.stroke();
  }

  // The question sits on the solid middle section, between its two answers.
  ctx.font = `bold 46px ${FONT}`;
  const lines = wrapLines(ctx, gate.question, QUESTION_MAX_WIDTH);
  const lineH = 50;
  const w = Math.min(QUESTION_MAX_WIDTH, Math.max(...lines.map((l) => ctx.measureText(l).width))) + 28;
  const h = lines.length * lineH + 20;
  const midY = (aBottom + bTop) / 2;
  ctx.fillStyle = COLORS.plaque;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 3;
  roundRect(ctx, gate.x - w / 2, midY - h / 2, w, h, 14);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = COLORS.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, gate.x, midY - h / 2 + 10 + lineH * (i + 0.5)));

  // Each answer floats in the middle of its own gap, so it's obvious which gap it belongs to.
  const bob = (phase: number) => Math.sin(time * 2.2 + phase) * 5;
  drawAnswer(ctx, gate.x, (aTop + aBottom) / 2 + bob(0), String(gate.answers[0]));
  drawAnswer(ctx, gate.x, (bTop + bBottom) / 2 + bob(1.7), String(gate.answers[1]));
}

function drawAnswer(ctx: CanvasRenderingContext2D, x: number, y: number, text: string) {
  const r = 40;
  ctx.fillStyle = COLORS.answer;
  ctx.strokeStyle = COLORS.answerEdge;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = COLORS.ink;
  ctx.font = `bold 44px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 2);
}

// ---------- Winged brain ----------

/** Wing angle in radians: a quick down-stroke after each flap, a gentle flutter otherwise. */
function wingAngle(b: Brain, time: number): number {
  const stroke = 0.26;
  if (b.sinceFlap < stroke) {
    const t = b.sinceFlap / stroke;
    return -1.0 + t * 1.6; // up high, sweeping down
  }
  return 0.15 + Math.sin(time * 5) * 0.22;
}

/** One feathered wing reaching out to the left of its shoulder. Mirror it for the right side. */
function drawWing(ctx: CanvasRenderingContext2D, angle: number) {
  ctx.save();
  ctx.rotate(-0.2 + angle);
  ctx.fillStyle = COLORS.wing;
  ctx.strokeStyle = COLORS.wingEdge;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-10, -30, -40, -52, -66, -50);
  ctx.quadraticCurveTo(-60, -38, -70, -30);
  ctx.quadraticCurveTo(-58, -22, -64, -10);
  ctx.quadraticCurveTo(-46, -8, -46, 4);
  ctx.quadraticCurveTo(-24, 8, 0, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Feather lines.
  ctx.strokeStyle = COLORS.wingBack;
  ctx.beginPath();
  ctx.moveTo(-14, -6);
  ctx.quadraticCurveTo(-36, -24, -56, -38);
  ctx.moveTo(-14, -2);
  ctx.quadraticCurveTo(-36, -10, -54, -18);
  ctx.stroke();
  ctx.restore();
}

/** The hero: a front-facing brain with a wing on each side and big nerdy glasses. */
export function drawBrain(ctx: CanvasRenderingContext2D, x: number, y: number, b: Brain, time: number) {
  const r = BRAIN.bodyRadius;
  const wing = wingAngle(b, time);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(brainTilt(b));

  // Wings behind the body, one per side, flapping together.
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * r * 0.9, -r * 0.35);
    ctx.scale(-side, 1);
    drawWing(ctx, wing);
    ctx.restore();
  }

  // Body: two hemispheres made of overlapping lobes.
  ctx.fillStyle = COLORS.brain;
  ctx.strokeStyle = COLORS.brainEdge;
  ctx.lineWidth = 3;
  const lobes: [number, number][] = [
    [-0.6, -0.25], [-0.22, -0.5], [0.22, -0.5], [0.6, -0.25],
    [-0.55, 0.3], [0, 0.38], [0.55, 0.3],
  ];
  ctx.beginPath();
  for (const [lx, ly] of lobes) {
    ctx.moveTo(lx * r + r * 0.55, ly * r);
    ctx.arc(lx * r, ly * r, r * 0.55, 0, Math.PI * 2);
  }
  ctx.stroke();
  ctx.fill();

  // The split between the hemispheres, and a few folds on each side.
  ctx.strokeStyle = COLORS.brainFold;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.98);
  ctx.quadraticCurveTo(r * 0.08, -r * 0.6, 0, -r * 0.3);
  for (const side of [-1, 1]) {
    ctx.moveTo(side * r * 0.25, -r * 0.82);
    ctx.quadraticCurveTo(side * r * 0.5, -r * 0.55, side * r * 0.35, -r * 0.35);
    ctx.moveTo(side * r * 0.75, -r * 0.6);
    ctx.quadraticCurveTo(side * r * 0.95, -r * 0.3, side * r * 0.9, r * 0.05);
    ctx.moveTo(side * r * 0.85, r * 0.45);
    ctx.quadraticCurveTo(side * r * 0.6, r * 0.7, side * r * 0.35, r * 0.62);
  }
  ctx.stroke();

  // Big nerdy glasses: thick round frames, tape on the bridge.
  const gy = r * 0.08;
  const lens = r * 0.38;
  const gap = r * 0.47;
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 4.5;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * gap, gy, lens, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-gap - lens, gy - 2);
  ctx.lineTo(-r * 1.05, gy - 6);
  ctx.moveTo(gap + lens, gy - 2);
  ctx.lineTo(r * 1.05, gy - 6);
  ctx.moveTo(-gap + lens - 1, gy - 2);
  ctx.quadraticCurveTo(0, gy - 7, gap - lens + 1, gy - 2);
  ctx.stroke();
  ctx.fillStyle = '#FFFFFF';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.rect(-4, gy - 9, 8, 9);
  ctx.fill();
  ctx.stroke();
  // Pupils glance ahead, the way it's flying.
  ctx.fillStyle = COLORS.ink;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * gap + 3, gy + 1, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cheeks and smile.
  ctx.fillStyle = COLORS.brainEdge;
  ctx.globalAlpha = 0.35;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * r * 0.72, r * 0.5, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, r * 0.46, 8, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  ctx.restore();
}

// ---------- HUD and screens ----------

/** Compact panel in the top-left corner, kept clear of where gates show their answers. */
function drawHud(ctx: CanvasRenderingContext2D, s: GameState, best: number) {
  ctx.fillStyle = COLORS.panel;
  roundRect(ctx, 14, 12, 270, 84, 16);
  ctx.fill();
  ctx.fillStyle = COLORS.ink;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.font = `bold 34px ${FONT}`;
  ctx.fillText(`Score ${s.score}`, 28, 20);
  ctx.font = `19px ${FONT}`;
  ctx.fillText(`Best ${best}  ·  ${s.level.name.split(' · ')[0]}`, 30, 64);

  // Strikes: three slots, crossed out as they are used.
  const used = LIVES - s.lives;
  for (let i = 0; i < LIVES; i++) {
    const cx = 202 + i * 28;
    const cy = 37;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 11, 0, Math.PI * 2);
    if (i < used) {
      ctx.fillStyle = COLORS.bad;
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(cx - 5, cy - 5);
      ctx.lineTo(cx + 5, cy + 5);
      ctx.moveTo(cx + 5, cy - 5);
      ctx.lineTo(cx - 5, cy + 5);
      ctx.stroke();
    } else {
      ctx.strokeStyle = COLORS.ink;
      ctx.globalAlpha = 0.35;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}

function callout(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, toX: number, toY: number) {
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(toX, toY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = `bold 24px ${FONT}`;
  const w = ctx.measureText(text).width + 24;
  ctx.fillStyle = COLORS.ink;
  roundRect(ctx, x, y - 20, w, 40, 20);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + 12, y + 1);
}

/** Tutorial screen: points at the real first gate and explains the controls. */
function drawTutorial(ctx: CanvasRenderingContext2D, s: GameState, time: number) {
  const gate = s.gates[0];
  if (gate) {
    const [[aTop, aBottom], [bTop, bBottom]] = openings(gate);
    const cx = gate.x + GATE.width / 2 + 90;
    callout(ctx, 'Answer', cx, (aTop + aBottom) / 2, gate.x + 44, (aTop + aBottom) / 2);
    callout(ctx, 'Question', cx, gate.centerY, gate.x + 140, gate.centerY);
    callout(ctx, 'Answer', cx, (bTop + bBottom) / 2, gate.x + 44, (bTop + bBottom) / 2);
  }

  ctx.fillStyle = COLORS.panel;
  roundRect(ctx, 40, 24, 690, 150, 22);
  ctx.fill();
  ctx.fillStyle = COLORS.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `bold 56px ${FONT}`;
  ctx.fillText('HAPPY NERDS', 66, 40);
  ctx.font = `24px ${FONT}`;
  ctx.fillText('Read the question. Pick the right answer.', 68, 108);
  ctx.fillText('Flap your brain through that answer’s opening!', 68, 138);

  ctx.fillStyle = COLORS.panel;
  roundRect(ctx, 40, 470, 690, 210, 22);
  ctx.fill();
  ctx.fillStyle = COLORS.ink;
  ctx.font = `bold 28px ${FONT}`;
  ctx.fillText('How to fly', 66, 490);
  ctx.font = `24px ${FONT}`;
  const steps = [
    'Tap, click or press Space to flap up.',
    'Fly through the gap with the right answer: +1.',
    'A bump or a wrong answer is a strike. 3 strikes: out!',
  ];
  steps.forEach((t, i) => ctx.fillText(`${i + 1}.  ${t}`, 68, 534 + i * 36));

  const pulse = 0.6 + 0.4 * Math.sin(time * 4);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = COLORS.ink;
  ctx.font = `bold 30px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('Tap to start', BRAIN.x, 412);
  ctx.globalAlpha = 1;
}

function drawGameOver(ctx: CanvasRenderingContext2D, s: GameState, best: number) {
  const w = 640;
  const h = 250;
  const x = (VIEW.width - w) / 2;
  const y = (VIEW.height - h) / 2;
  ctx.fillStyle = COLORS.shade;
  roundRect(ctx, x, y, w, h, 24);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold 56px ${FONT}`;
  ctx.fillText('Brain dead', VIEW.width / 2, y + 62);
  ctx.font = `28px ${FONT}`;
  ctx.fillText(`Three strikes! You got ${s.score} right.`, VIEW.width / 2, y + 122);
  ctx.fillText(best > 0 && s.score >= best ? 'New best!' : `Best: ${best}`, VIEW.width / 2, y + 160);
  ctx.font = `bold 28px ${FONT}`;
  ctx.fillText('Tap to try again', VIEW.width / 2, y + 208);
}

export function render(ctx: CanvasRenderingContext2D, s: GameState, popups: Popup[], best: number, time: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  sky.addColorStop(0, COLORS.skyTop);
  sky.addColorStop(1, COLORS.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  for (const g of s.gates) drawGate(ctx, g, time);

  const blink = s.brain.invuln > 0 && Math.floor(time * 12) % 2 === 0;
  if (!blink) drawBrain(ctx, BRAIN.x, s.brain.y, s.brain, time);

  for (const p of popups) {
    ctx.globalAlpha = Math.min(1, p.ttl * 2);
    ctx.font = `bold 34px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#FFFFFF';
    ctx.strokeText(p.text, p.x, p.y);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;

  if (s.phase === 'ready') drawTutorial(ctx, s, time);
  else drawHud(ctx, s, best);
  if (s.phase === 'over') drawGameOver(ctx, s, best);
}

export { COLORS };
