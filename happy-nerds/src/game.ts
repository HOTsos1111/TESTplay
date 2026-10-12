import { BRAIN, GATE, INVULN, LIVES, RESTART_DELAY, VIEW } from './config';
import { LEVEL_1, makeProblem, type MathLevel, type Rng } from './questions';

export type Phase = 'ready' | 'playing' | 'over';
export type GateResult = 'correct' | 'wrong' | 'crash' | 'skipped';

/** A gate with two fixed openings. It only moves sideways. */
export interface Gate {
  x: number;
  /** Middle of the solid section that carries the question. */
  centerY: number;
  question: string;
  /** answers[0] belongs to the upper opening, answers[1] to the lower. */
  answers: [number, number];
  correct: 0 | 1;
  /** Set once, the first time the gate is judged; it is never judged again. */
  result: GateResult | null;
  /** A gate can cost at most one life, however long the brain stays tangled in it. */
  penalized: boolean;
}

export interface Brain {
  y: number;
  vy: number;
  invuln: number;
  /** Seconds since the last flap, for the wing animation. */
  sinceFlap: number;
}

export type GameEvent =
  | { type: 'flap' }
  | { type: 'correct'; gate: Gate }
  | { type: 'wrong'; gate: Gate }
  | { type: 'crash'; gate?: Gate }
  | { type: 'over' };

export interface GameState {
  phase: Phase;
  level: MathLevel;
  rng: Rng;
  brain: Brain;
  gates: Gate[];
  score: number;
  lives: number;
  speed: number;
  /** Scroll distance left before the next gate spawns. */
  untilSpawn: number;
  /** Time spent on the current screen (ready bob, game-over delay). */
  phaseTime: number;
  /** Things that happened since the caller last drained this, for sounds and pop-ups. */
  events: GameEvent[];
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Where the first gate waits on the tutorial screen. */
export const FIRST_GATE_X = 900;

export function newGame(rng: Rng = Math.random, level: MathLevel = LEVEL_1): GameState {
  const s: GameState = {
    phase: 'ready',
    level,
    rng,
    brain: { y: VIEW.height / 2, vy: 0, invuln: 0, sinceFlap: 9 },
    gates: [],
    score: 0,
    lives: LIVES,
    speed: GATE.startSpeed,
    untilSpawn: 0,
    phaseTime: 0,
    events: [],
  };
  // The first gate is on screen from the start, so the tutorial can point at a real one.
  spawnGate(s, FIRST_GATE_X);
  s.untilSpawn = GATE.spacing - (VIEW.width + GATE.width - FIRST_GATE_X);
  return s;
}

export function spawnGate(s: GameState, x = VIEW.width + GATE.width): Gate {
  const p = makeProblem(s.rng, s.level);
  const correct: 0 | 1 = s.rng() < 0.5 ? 0 : 1;
  const gate: Gate = {
    x,
    centerY: GATE.centerY + (s.rng() * 2 - 1) * GATE.centerJitter,
    question: p.question,
    answers: correct === 0 ? [p.answer, p.wrong] : [p.wrong, p.answer],
    correct,
    result: null,
    penalized: false,
  };
  s.gates.push(gate);
  return gate;
}

/** Top and bottom of each opening: [upper, lower]. */
export function openings(gate: Gate): [[number, number], [number, number]] {
  const half = GATE.middleHeight / 2;
  const h = GATE.openingHeight;
  return [
    [gate.centerY - half - h, gate.centerY - half],
    [gate.centerY + half, gate.centerY + half + h],
  ];
}

export function openingCenter(gate: Gate, i: 0 | 1): number {
  const [top, bottom] = openings(gate)[i];
  return (top + bottom) / 2;
}

/** Which opening the brain's hit circle fits inside at height `y`, or -1 for neither. */
export function openingAt(gate: Gate, y: number): 0 | 1 | -1 {
  const r = BRAIN.hitRadius;
  const o = openings(gate);
  for (const i of [0, 1] as const) if (y - r >= o[i][0] && y + r <= o[i][1]) return i;
  return -1;
}

export function overlapsGate(gate: Gate): boolean {
  return Math.abs(gate.x - BRAIN.x) < GATE.width / 2 + BRAIN.hitRadius;
}

/** The next gate the brain hasn't been judged at yet. */
export function nextGate(s: GameState): Gate | undefined {
  return s.gates.find((g) => g.result === null);
}

/** Tap / click / space: starts, flaps the brain, or restarts. */
export function flap(s: GameState): void {
  if (s.phase === 'over') {
    if (s.phaseTime < RESTART_DELAY) return;
    Object.assign(s, newGame(s.rng, s.level));
  }
  if (s.phase === 'ready') {
    s.phase = 'playing';
    s.phaseTime = 0;
  }
  s.brain.vy = -BRAIN.flapSpeed;
  s.brain.sinceFlap = 0;
  s.events.push({ type: 'flap' });
}

function penalize(s: GameState, type: 'wrong' | 'crash', gate?: Gate) {
  if (gate) {
    if (gate.penalized) return;
    gate.penalized = true;
    if (gate.result === null) gate.result = type;
  }
  s.lives -= 1;
  s.brain.invuln = INVULN;
  s.events.push(type === 'wrong' ? { type, gate: gate! } : { type, gate });
  if (s.lives <= 0) {
    s.phase = 'over';
    s.phaseTime = 0;
    s.events.push({ type: 'over' });
  }
}

function stepBrain(s: GameState, dt: number) {
  const b = s.brain;
  b.sinceFlap += dt;
  b.invuln = Math.max(0, b.invuln - dt);
  if (s.phase === 'ready') {
    // Hover gently in place until the first flap.
    b.y = VIEW.height / 2 + Math.sin(s.phaseTime * 3) * 10;
    b.vy = 0;
    return;
  }
  b.vy = Math.min(b.vy + BRAIN.gravity * dt, BRAIN.maxFall);
  b.y += b.vy * dt;
  if (b.y - BRAIN.hitRadius < BRAIN.ceiling) {
    b.y = BRAIN.ceiling + BRAIN.hitRadius;
    b.vy = Math.max(0, b.vy);
  }
  if (b.y + BRAIN.hitRadius > BRAIN.floor) {
    b.y = BRAIN.floor - BRAIN.hitRadius;
    if (b.invuln <= 0) penalize(s, 'crash');
    // Bounce back up so a dropped brain gets another go.
    b.vy = -BRAIN.flapSpeed;
    b.sinceFlap = 0;
  }
}

export function step(s: GameState, dt: number): void {
  s.phaseTime += dt;
  if (s.phase === 'over') return;
  stepBrain(s, dt);
  if (s.phase !== 'playing') return;

  const dx = s.speed * dt;
  for (const g of s.gates) g.x -= dx;
  s.untilSpawn -= dx;
  if (s.untilSpawn <= 0) {
    spawnGate(s);
    s.untilSpawn += GATE.spacing;
  }

  const y = s.brain.y;
  for (const g of s.gates) {
    if (s.phase !== 'playing') break;
    const inside = openingAt(g, y);
    // Solid parts of the gate.
    if (overlapsGate(g) && inside === -1 && s.brain.invuln <= 0) penalize(s, 'crash', g);
    // The answer is decided once, as the brain's centre reaches the gate's centre.
    if (g.result === null && g.x <= BRAIN.x) {
      if (s.brain.invuln > 0) {
        g.result = 'skipped';
      } else if (inside === g.correct) {
        g.result = 'correct';
        s.score += 1;
        s.speed = Math.min(GATE.maxSpeed, GATE.startSpeed + s.score * GATE.speedPerPoint);
        s.events.push({ type: 'correct', gate: g });
      } else {
        penalize(s, 'wrong', g);
      }
    }
  }

  s.gates = s.gates.filter((g) => g.x > -GATE.width);
}

/** Lean into the climb or dive: radians, nose-down positive. */
export function brainTilt(b: Brain): number {
  return clamp(b.vy / 900, -0.35, 0.55);
}
