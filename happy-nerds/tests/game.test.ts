import { describe, expect, it } from 'vitest';
import { BALLOON, LIVES, PIPE, PIPE_OFFSET, RESTART_DELAY } from '../src/config';
import { activePipe, flap, gapAt, gapCenters, newGame, step, type GameState, type Pipe } from '../src/game';
import { mulberry32 } from '../src/questions';

const DT = 1 / 120;

function started(seed = 1): GameState {
  const s = newGame(mulberry32(seed));
  flap(s);
  return s;
}

/** Run until the given pipe is judged, holding the balloon still and the pipe's chosen gap on it. */
function flyThrough(s: GameState, pipe: Pipe, gap: 0 | 1 | 'wall') {
  const y = 360;
  for (let i = 0; i < 120 * 20 && pipe.result === null; i++) {
    s.balloon.y = y;
    s.balloon.vy = 0;
    pipe.vy = 0;
    const half = PIPE.gapSpacing / 2;
    // Centre the chosen gap on the balloon, or put solid wall in front of it.
    pipe.offset = gap === 0 ? y + half : gap === 1 ? y - half : y;
    step(s, DT);
  }
}

describe('balloon', () => {
  it('drifts on its own but stays on screen', () => {
    const s = started(4);
    let moved = 0;
    for (let i = 0; i < 120 * 60; i++) {
      const before = s.balloon.y;
      step(s, DT);
      s.balloon.invuln = 99; // ignore pipes, just watch the drift
      moved += Math.abs(s.balloon.y - before);
      expect(s.balloon.y).toBeGreaterThanOrEqual(BALLOON.minY);
      expect(s.balloon.y).toBeLessThanOrEqual(BALLOON.maxY);
    }
    expect(moved).toBeGreaterThan(1000);
  });
});

describe('pipes', () => {
  it('only the active pipe flaps and falls; the others hold still', () => {
    const s = started();
    for (let i = 0; i < 120 * 4; i++) step(s, DT);
    expect(s.pipes.length).toBeGreaterThan(1);
    const [first, second] = s.pipes;
    expect(activePipe(s)).toBe(first);
    const secondOffset = second.offset;
    const before = first.offset;
    flap(s);
    for (let i = 0; i < 10; i++) step(s, DT);
    expect(first.offset).toBeLessThan(before);
    expect(second.offset).toBe(secondOffset);
  });

  it('never leaves the offset range', () => {
    const s = started();
    const p = activePipe(s)!;
    for (let i = 0; i < 120 * 2; i++) step(s, DT);
    expect(p.offset).toBe(PIPE_OFFSET.max);
    for (let i = 0; i < 400; i++) {
      flap(s);
      step(s, DT);
    }
    expect(p.offset).toBe(PIPE_OFFSET.min);
  });

  it('either gap can reach the balloon at both extremes', () => {
    const s = started();
    const p = activePipe(s)!;
    p.offset = PIPE_OFFSET.min;
    expect(gapAt(p, BALLOON.minY)).toBe(1);
    p.offset = PIPE_OFFSET.max;
    expect(gapAt(p, BALLOON.maxY)).toBe(0);
    expect(gapCenters(p)[0]).toBe(BALLOON.maxY);
  });
});

describe('answers', () => {
  it('the right gap scores and keeps lives', () => {
    const s = started();
    const p = activePipe(s)!;
    flyThrough(s, p, p.correctGap);
    expect(p.result).toBe('correct');
    expect(s.score).toBe(1);
    expect(s.lives).toBe(LIVES);
    expect(activePipe(s)).not.toBe(p);
  });

  it('the wrong gap pops a life', () => {
    const s = started();
    const p = activePipe(s)!;
    flyThrough(s, p, p.correctGap === 0 ? 1 : 0);
    expect(p.result).toBe('wrong');
    expect(s.score).toBe(0);
    expect(s.lives).toBe(LIVES - 1);
    expect(s.balloon.invuln).toBeGreaterThan(0);
  });

  it('hitting the wall pops a life', () => {
    const s = started();
    const p = activePipe(s)!;
    flyThrough(s, p, 'wall');
    expect(p.result).toBe('crash');
    expect(s.lives).toBe(LIVES - 1);
  });

  it('losing every life ends the game, and a tap after the delay restarts', () => {
    const s = started();
    while (s.phase === 'playing') {
      const p = activePipe(s)!;
      s.balloon.invuln = 0;
      flyThrough(s, p, 'wall');
    }
    expect(s.phase).toBe('over');
    expect(s.lives).toBe(0);
    flap(s);
    expect(s.phase).toBe('over'); // too soon
    for (let t = 0; t <= RESTART_DELAY + 0.05; t += DT) step(s, DT);
    flap(s);
    expect(s.phase).toBe('playing');
    expect(s.lives).toBe(LIVES);
    expect(s.score).toBe(0);
  });
});

/** Plays like a careful player: waits for the pipe to start falling, then flaps while the right gap is below the balloon. */
function autopilot(s: GameState) {
  const p = activePipe(s);
  if (!p) return;
  const gapY = gapCenters(p)[p.correctGap];
  if (gapY > s.balloon.y + 4 && p.vy >= 0) flap(s);
}

describe('fairness', () => {
  it('a careful player can keep scoring', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = started(seed);
      for (let i = 0; i < 120 * 90 && s.phase === 'playing'; i++) {
        autopilot(s);
        step(s, DT);
      }
      expect(s.score, `seed ${seed}`).toBeGreaterThanOrEqual(15);
    }
  });
});
