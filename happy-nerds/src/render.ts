import { BALLOON, PIPE, VIEW } from './config';
import { activePipe, gapCenters, type GameState, type Pipe } from './game';

/** Placeholder look: flat shapes only. Real art from assets/ replaces these later. */
const COLORS = {
  skyTop: '#7FD3F7',
  skyBottom: '#D9F3FF',
  pipe: '#4CAF50',
  pipeIdle: '#3E8E41',
  pipeEdge: '#2E6B30',
  pipeActiveGlow: '#FFE45C',
  balloon: '#F2545B',
  balloonShine: 'rgba(255,255,255,0.45)',
  string: '#555',
  ink: '#1F2A44',
  plaque: 'rgba(255,255,255,0.85)',
  good: '#2E9E44',
  bad: '#D63A3A',
};

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

function drawPipe(ctx: CanvasRenderingContext2D, pipe: Pipe, active: boolean) {
  const left = pipe.x - PIPE.width / 2;
  const half = PIPE.gapHeight / 2;
  const [a, b] = gapCenters(pipe);
  const segments: [number, number][] = [
    [-60, a - half],
    [a + half, b - half],
    [b + half, VIEW.height + 60],
  ];
  ctx.fillStyle = active ? COLORS.pipe : COLORS.pipeIdle;
  ctx.strokeStyle = active ? COLORS.pipeActiveGlow : COLORS.pipeEdge;
  ctx.lineWidth = active ? 6 : 4;
  for (const [top, bottom] of segments) {
    if (bottom <= top) continue;
    roundRect(ctx, left, top, PIPE.width, bottom - top, 10);
    ctx.fill();
    ctx.stroke();
  }

  // Question plaques sit in each gap.
  ctx.font = 'bold 30px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  [a, b].forEach((cy, i) => {
    const text = pipe.questions[i].text;
    const w = Math.max(96, ctx.measureText(text).width + 24);
    ctx.fillStyle = COLORS.plaque;
    roundRect(ctx, pipe.x - w / 2, cy - 22, w, 44, 12);
    ctx.fill();
    ctx.fillStyle = COLORS.ink;
    ctx.fillText(text, pipe.x, cy + 1);
  });
}

function drawBalloon(ctx: CanvasRenderingContext2D, s: GameState, time: number) {
  const { y, invuln } = s.balloon;
  if (invuln > 0 && Math.floor(time * 12) % 2 === 0) return;
  const x = BALLOON.x;
  const r = BALLOON.radius;

  // String, swaying a little.
  ctx.strokeStyle = COLORS.string;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y + r * 1.15);
  ctx.quadraticCurveTo(x - 10 + Math.sin(time * 3) * 8, y + r * 2, x - 4, y + r * 2.8);
  ctx.stroke();

  ctx.fillStyle = COLORS.balloon;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 1.15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 6, y + r * 1.25);
  ctx.lineTo(x + 6, y + r * 1.25);
  ctx.lineTo(x, y + r * 1.08);
  ctx.fill();
  ctx.fillStyle = COLORS.balloonShine;
  ctx.beginPath();
  ctx.ellipse(x - r * 0.4, y - r * 0.45, r * 0.22, r * 0.34, -0.5, 0, Math.PI * 2);
  ctx.fill();

  const pipe = activePipe(s);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 32px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(pipe ? String(pipe.answer) : '?', x, y + 2);
}

function drawHud(ctx: CanvasRenderingContext2D, s: GameState, best: number) {
  ctx.fillStyle = COLORS.ink;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.font = 'bold 40px "Trebuchet MS", sans-serif';
  ctx.fillText(`Score ${s.score}`, 28, 22);
  ctx.font = '22px "Trebuchet MS", sans-serif';
  ctx.fillText(`Best ${best}   ·   ${s.level.name}`, 30, 70);

  for (let i = 0; i < s.lives; i++) {
    const cx = VIEW.width - 40 - i * 44;
    ctx.fillStyle = COLORS.balloon;
    ctx.beginPath();
    ctx.ellipse(cx, 44, 14, 17, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCenterCard(ctx: CanvasRenderingContext2D, lines: string[]) {
  const w = 760;
  const h = 70 + lines.length * 44;
  const x = (VIEW.width - w) / 2;
  const y = (VIEW.height - h) / 2;
  ctx.fillStyle = 'rgba(31,42,68,0.82)';
  roundRect(ctx, x, y, w, h, 24);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((line, i) => {
    ctx.font = i === 0 ? 'bold 52px "Trebuchet MS", sans-serif' : '26px "Trebuchet MS", sans-serif';
    ctx.fillText(line, VIEW.width / 2, y + 60 + i * 44 + (i === 0 ? 0 : 14));
  });
}

export function render(ctx: CanvasRenderingContext2D, s: GameState, popups: Popup[], best: number, time: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  sky.addColorStop(0, COLORS.skyTop);
  sky.addColorStop(1, COLORS.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  const active = activePipe(s);
  for (const p of s.pipes) drawPipe(ctx, p, p === active && s.phase === 'playing');
  drawBalloon(ctx, s, time);

  for (const p of popups) {
    ctx.globalAlpha = Math.min(1, p.ttl * 2);
    ctx.fillStyle = p.color;
    ctx.font = 'bold 34px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;

  drawHud(ctx, s, best);

  if (s.phase === 'ready') {
    drawCenterCard(ctx, [
      'HAPPY NERDS',
      'The balloon floats on its own and carries an answer.',
      'Tap, click or press Space to flap the PIPE up.',
      'Line up the gap whose sum matches the balloon!',
      'Tap to start',
    ]);
  } else if (s.phase === 'over') {
    drawCenterCard(ctx, ['POP!', `You got ${s.score} right.`, best > 0 && s.score >= best ? 'New best!' : `Best: ${best}`, 'Tap to try again']);
  }
}

export { COLORS };
