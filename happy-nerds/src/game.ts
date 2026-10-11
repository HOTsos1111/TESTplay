import { BALLOON, INVULN, LIVES, PIPE, PIPE_OFFSET, RESTART_DELAY, VIEW } from './config';
import { LEVEL_1, makePair, type MathLevel, type Question, type Rng } from './questions';

export type Phase = 'ready' | 'playing' | 'over';
export type PipeResult = 'correct' | 'wrong' | 'crash' | 'skipped';

export interface Pipe {
  x: number;
  /** Midpoint between the two gaps. Only the active pipe moves. */
  offset: number;
  vy: number;
  /** questions[0] is the upper gap, questions[1] the lower. */
  questions: [Question, Question];
  correctGap: 0 | 1;
  answer: number;
  result: PipeResult | null;
}

export interface Balloon {
  y: number;
  vy: number;
  puffTimer: number;
  invuln: number;
}

export type GameEvent =
  | { type: 'correct'; pipe: Pipe }
  | { type: 'wrong'; pipe: Pipe }
  | { type: 'crash'; pipe: Pipe }
  | { type: 'over' };

export interface GameState {
  phase: Phase;
  level: MathLevel;
  rng: Rng;
  balloon: Balloon;
  pipes: Pipe[];
  score: number;
  lives: number;
  speed: number;
  /** Scroll distance left before the next pipe spawns. */
  untilSpawn: number;
  /** Time spent on the game-over screen. */
  overTime: number;
  /** Things that happened this step, for sounds and pop-ups. Drained by the caller. */
  events: GameEvent[];
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function newGame(rng: Rng = Math.random, level: MathLevel = LEVEL_1): GameState {
  return {
    phase: 'ready',
    level,
    rng,
    balloon: { y: VIEW.height / 2, vy: 0, puffTimer: 0.6, invuln: 0 },
    pipes: [],
    score: 0,
    lives: LIVES,
    speed: PIPE.startSpeed,
    untilSpawn: 0,
    overTime: 0,
    events: [],
  };
}

export function spawnPipe(s: GameState, x = VIEW.width + PIPE.width): Pipe {
  const pair = makePair(s.rng, s.level);
  const correctGap: 0 | 1 = s.rng() < 0.5 ? 0 : 1;
  const pipe: Pipe = {
    x,
    offset: VIEW.height / 2 + (s.rng() * 2 - 1) * 150,
    vy: 0,
    questions: correctGap === 0 ? [pair.correct, pair.wrong] : [pair.wrong, pair.correct],
    correctGap,
    answer: pair.answer,
    result: null,
  };
  s.pipes.push(pipe);
  return pipe;
}

/** The pipe the player is steering: the nearest one the balloon hasn't reached yet. */
export function activePipe(s: GameState): Pipe | undefined {
  return s.pipes.find((p) => p.result === null);
}

export function gapCenters(pipe: Pipe): [number, number] {
  const half = PIPE.gapSpacing / 2;
  return [pipe.offset - half, pipe.offset + half];
}

/** Which gap the balloon's hitbox fits inside at height `y`, or -1 for neither. */
export function gapAt(pipe: Pipe, y: number): 0 | 1 | -1 {
  const r = BALLOON.radius * BALLOON.hitScale;
  const half = PIPE.gapHeight / 2;
  const [a, b] = gapCenters(pipe);
  if (y - r >= a - half && y + r <= a + half) return 0;
  if (y - r >= b - half && y + r <= b + half) return 1;
  return -1;
}

export function overlapsPipe(pipe: Pipe): boolean {
  return Math.abs(pipe.x - BALLOON.x) < PIPE.width / 2 + BALLOON.radius * BALLOON.hitScale;
}

/** Tap / space. Starts, flaps the active pipe, or restarts. */
export function flap(s: GameState): void {
  if (s.phase === 'over') {
    if (s.overTime < RESTART_DELAY) return;
    Object.assign(s, newGame(s.rng, s.level));
  }
  if (s.phase === 'ready') {
    s.phase = 'playing';
    spawnPipe(s);
    s.untilSpawn = PIPE.spacing;
  }
  const pipe = activePipe(s);
  if (pipe) pipe.vy = -PIPE.flapSpeed;
}

function loseLife(s: GameState, pipe: Pipe, type: 'wrong' | 'crash') {
  if (pipe.result === null) pipe.result = type;
  s.lives -= 1;
  s.balloon.invuln = INVULN;
  s.events.push({ type, pipe });
  if (s.lives <= 0) {
    s.phase = 'over';
    s.overTime = 0;
    s.events.push({ type: 'over' });
  }
}

function stepBalloon(s: GameState, dt: number) {
  const b = s.balloon;
  b.puffTimer -= dt;
  if (b.puffTimer <= 0) {
    b.vy += (s.rng() * 2 - 1) * BALLOON.puffStrength;
    b.puffTimer = BALLOON.puffMin + s.rng() * (BALLOON.puffMax - BALLOON.puffMin);
  }
  b.vy += (VIEW.height / 2 - b.y) * BALLOON.centerPull * dt;
  b.vy -= b.vy * BALLOON.damping * dt;
  b.vy = clamp(b.vy, -BALLOON.maxSpeed, BALLOON.maxSpeed);
  b.y += b.vy * dt;
  if (b.y < BALLOON.minY || b.y > BALLOON.maxY) {
    b.y = clamp(b.y, BALLOON.minY, BALLOON.maxY);
    b.vy = -b.vy * 0.5;
  }
  b.invuln = Math.max(0, b.invuln - dt);
}

function stepPipe(pipe: Pipe, dt: number) {
  pipe.vy = Math.min(pipe.vy + PIPE.gravity * dt, PIPE.maxFall);
  pipe.offset += pipe.vy * dt;
  if (pipe.offset < PIPE_OFFSET.min || pipe.offset > PIPE_OFFSET.max) {
    pipe.offset = clamp(pipe.offset, PIPE_OFFSET.min, PIPE_OFFSET.max);
    pipe.vy = 0;
  }
}

export function step(s: GameState, dt: number): void {
  if (s.phase === 'over') {
    s.overTime += dt;
    return;
  }
  stepBalloon(s, dt);
  if (s.phase === 'ready') return;

  const active = activePipe(s);
  if (active) stepPipe(active, dt);

  const dx = s.speed * dt;
  for (const p of s.pipes) p.x -= dx;
  s.untilSpawn -= dx;
  if (s.untilSpawn <= 0) {
    spawnPipe(s);
    s.untilSpawn += PIPE.spacing;
  }

  const by = s.balloon.y;
  for (const p of s.pipes) {
    if (s.phase !== 'playing') break;
    // The moment the balloon's centre reaches the pipe's centre decides the answer.
    if (p.result === null && p.x <= BALLOON.x) {
      const gap = gapAt(p, by);
      if (gap === p.correctGap) {
        p.result = 'correct';
        s.score += 1;
        s.speed = Math.min(PIPE.maxSpeed, PIPE.startSpeed + s.score * PIPE.speedPerPoint);
        s.events.push({ type: 'correct', pipe: p });
      } else if (gap !== -1 && s.balloon.invuln <= 0) {
        loseLife(s, p, 'wrong');
      } else if (s.balloon.invuln > 0) {
        // Still recovering from a pop: let this pipe go by without judging it.
        p.result = 'skipped';
      }
    }
    if (s.balloon.invuln <= 0 && overlapsPipe(p) && gapAt(p, by) === -1) loseLife(s, p, 'crash');
  }

  s.pipes = s.pipes.filter((p) => p.x > -PIPE.width);
}
