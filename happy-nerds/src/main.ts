import { BRAIN, VIEW } from './config';
import { flap, newGame, step, type GameEvent } from './game';
import { COLORS, render, type Popup } from './render';

const STEP = 1 / 120;
const MAX_FRAME = 0.1;
const BEST_KEY = 'happy-nerds.best';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

const state = newGame();
const popups: Popup[] = [];

function loadBest(): number {
  try {
    const n = Number(localStorage.getItem(BEST_KEY));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}
let best = loadBest();
function saveBest() {
  try {
    localStorage.setItem(BEST_KEY, String(best));
  } catch {
    // Storage blocked (private mode etc.): keep the best in memory only.
  }
}

function onEvent(e: GameEvent) {
  const at = { x: BRAIN.x + 80, y: state.brain.y - 50 };
  if (e.type === 'correct') {
    popups.push({ text: '+1', color: COLORS.good, ...at, ttl: 0.8 });
  } else if (e.type === 'wrong') {
    const g = e.gate;
    const q = g.question.replace(' = ?', '');
    popups.push({ text: `Oops! ${q} = ${g.answers[g.correct]}`, color: COLORS.bad, x: VIEW.width / 2, y: 150, ttl: 1.8 });
  } else if (e.type === 'crash') {
    popups.push({ text: 'Bonk!', color: COLORS.bad, ...at, ttl: 0.8 });
  } else if (e.type === 'over' && state.score > best) {
    best = state.score;
    saveBest();
  }
}

// Fit the 1280×720 play area into the window, sharp on high-DPI screens.
function fit() {
  const scale = Math.min(window.innerWidth / VIEW.width, window.innerHeight / VIEW.height);
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${VIEW.width * scale}px`;
  canvas.style.height = `${VIEW.height * scale}px`;
  canvas.width = Math.round(VIEW.width * scale * dpr);
  canvas.height = Math.round(VIEW.height * scale * dpr);
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
}
window.addEventListener('resize', fit);
fit();

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    if (!e.repeat) flap(state);
  }
});
// Mouse, pen and touch all arrive as pointer events.
window.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  flap(state);
});

let last = performance.now();
let acc = 0;
let time = 0;
function frame(now: number) {
  const dt = Math.min(MAX_FRAME, (now - last) / 1000);
  last = now;
  acc += dt;
  time += dt;
  while (acc >= STEP) {
    step(state, STEP);
    acc -= STEP;
  }
  for (const e of state.events.splice(0)) onEvent(e);
  for (const p of popups) {
    p.ttl -= dt;
    p.y -= 40 * dt;
  }
  for (let i = popups.length - 1; i >= 0; i--) if (popups[i].ttl <= 0) popups.splice(i, 1);

  render(ctx, state, popups, best, time);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Test hook for browser checks.
(window as unknown as { __happyNerds: unknown }).__happyNerds = { state };
