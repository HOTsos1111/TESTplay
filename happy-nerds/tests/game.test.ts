import { describe, expect, it } from 'vitest';
import { BRAIN, GATE, INVULN, LIVES, RESTART_DELAY, VIEW } from '../src/config';
import { flap, FIRST_GATE_X, newGame, nextGate, openingAt, openingCenter, openings, step, type Gate, type GameState } from '../src/game';
import { mulberry32 } from '../src/questions';

const DT = 1 / 120;

function started(seed = 1): GameState {
  const s = newGame(mulberry32(seed));
  flap(s);
  return s;
}

/** Hold the brain at a fixed height until the gate is judged. */
function holdAt(s: GameState, gate: Gate, y: number) {
  for (let i = 0; i < 120 * 30 && gate.result === null && s.phase === 'playing'; i++) {
    s.brain.y = y;
    s.brain.vy = 0;
    step(s, DT);
  }
}

/**
 * Plays like a careful player: steers for the right opening of the nearest gate it hasn't
 * cleared yet (staying lined up until fully out of it), flapping whenever it sinks below.
 */
function autopilot(s: GameState) {
  const g = s.gates.find((gate) => gate.x + GATE.width / 2 + BRAIN.hitRadius > BRAIN.x);
  const target = g ? openingCenter(g, g.correct) : VIEW.height / 2;
  if (s.brain.y > target + 12 && s.brain.vy > -60) flap(s);
}

describe('tutorial screen', () => {
  it('shows a real first gate and keeps the brain hovering until the first flap', () => {
    const s = newGame(mulberry32(1));
    expect(s.gates).toHaveLength(1);
    expect(s.gates[0].x).toBe(FIRST_GATE_X);
    for (let i = 0; i < 120 * 5; i++) step(s, DT);
    expect(s.phase).toBe('ready');
    expect(s.gates[0].x).toBe(FIRST_GATE_X);
    expect(Math.abs(s.brain.y - VIEW.height / 2)).toBeLessThanOrEqual(10);
    expect(s.lives).toBe(LIVES);
  });
});

describe('flight', () => {
  it('flap pushes the brain up, then gravity pulls it down', () => {
    const s = started();
    const y0 = s.brain.y;
    for (let i = 0; i < 12; i++) step(s, DT);
    expect(s.brain.y).toBeLessThan(y0);
    for (let i = 0; i < 120; i++) step(s, DT);
    expect(s.brain.vy).toBeGreaterThan(0);
  });

  it('each flap is a small, steerable hop', () => {
    const s = started();
    let top = s.brain.y;
    const y0 = s.brain.y;
    for (let i = 0; i < 60; i++) {
      step(s, DT);
      top = Math.min(top, s.brain.y);
    }
    expect(y0 - top).toBeGreaterThan(30);
    expect(y0 - top).toBeLessThanOrEqual(45);
  });

  it('the brain keeps its horizontal position; gates only move sideways', () => {
    const s = started();
    const g = s.gates[0];
    const centerY = g.centerY;
    const x0 = g.x;
    for (let i = 0; i < 60; i++) {
      if (i % 20 === 0) flap(s);
      step(s, DT);
    }
    expect(g.x).toBeLessThan(x0);
    expect(g.centerY).toBe(centerY);
  });

  it('the ceiling stops the climb without a penalty', () => {
    const s = started();
    for (let i = 0; i < 120 * 2; i++) {
      flap(s);
      step(s, DT);
      s.brain.invuln = 0;
    }
    expect(s.brain.y).toBe(BRAIN.ceiling + BRAIN.hitRadius);
    expect(s.lives).toBe(LIVES);
  });

  it('the floor is a free bounce, not a strike', () => {
    const s = started();
    let bounced = false;
    for (let i = 0; i < 120 * 6; i++) {
      step(s, DT);
      s.gates = []; // keep gates out of the way
      if (s.brain.vy < 0) bounced = true;
    }
    expect(bounced).toBe(true);
    expect(s.lives).toBe(LIVES);
    expect(s.brain.y).toBeLessThanOrEqual(BRAIN.floor - BRAIN.hitRadius);
  });

  it('the hit circle stays inside the drawn body, so wing tips never collide', () => {
    expect(BRAIN.hitRadius).toBeLessThan(BRAIN.bodyRadius);
  });
});

describe('gates', () => {
  it('the brain fits through each opening with room to spare', () => {
    const s = newGame(mulberry32(1));
    const g = s.gates[0];
    for (const i of [0, 1] as const) {
      const [top, bottom] = openings(g)[i];
      expect(bottom - top).toBeGreaterThanOrEqual(BRAIN.hitRadius * 2 * 3);
      expect(openingAt(g, openingCenter(g, i))).toBe(i);
      expect(top).toBeGreaterThan(BRAIN.ceiling);
      expect(bottom).toBeLessThan(BRAIN.floor);
    }
  });

  it('the right answer moves between the upper and lower opening', () => {
    const seen = new Set<number>();
    const t = started(5);
    for (let i = 0; i < 120 * 60; i++) {
      t.brain.invuln = 99;
      t.brain.y = VIEW.height / 2;
      step(t, DT);
      for (const g of t.gates) seen.add(g.correct);
    }
    expect(seen).toEqual(new Set([0, 1]));
  });

  it('the right opening scores once', () => {
    const s = started();
    const g = s.gates[0];
    holdAt(s, g, openingCenter(g, g.correct));
    expect(g.result).toBe('correct');
    expect(s.score).toBe(1);
    expect(s.lives).toBe(LIVES);
    // Keep flying through the rest of the gate: no second reward.
    for (let i = 0; i < 120; i++) {
      s.brain.y = openingCenter(g, g.correct);
      step(s, DT);
    }
    expect(s.score).toBe(1);
  });

  it('the wrong opening costs one life, once', () => {
    const s = started();
    const g = s.gates[0];
    const wrong = g.correct === 0 ? 1 : 0;
    holdAt(s, g, openingCenter(g, wrong));
    for (let i = 0; i < 120; i++) {
      s.brain.y = openingCenter(g, wrong);
      step(s, DT);
    }
    expect(g.result).toBe('wrong');
    expect(s.score).toBe(0);
    expect(s.lives).toBe(LIVES - 1);
  });

  it('hitting a solid part costs one life and the gate is not judged again', () => {
    const s = started();
    const g = s.gates[0];
    holdAt(s, g, g.centerY); // the middle section with the question
    expect(g.result).toBe('crash');
    for (let i = 0; i < 120 * 2; i++) {
      s.brain.y = g.centerY;
      step(s, DT);
    }
    expect(s.lives).toBe(LIVES - 1);
  });

  it('starts slow and speeds up with correct answers', () => {
    const s = started();
    expect(s.speed).toBeLessThanOrEqual(120);
    const g = s.gates[0];
    holdAt(s, g, openingCenter(g, g.correct));
    expect(s.speed).toBeGreaterThan(GATE.startSpeed);
  });

  it('there is time to read each gate before it arrives', () => {
    // From appearing at the right edge to reaching the brain, even at top speed.
    const seconds = (VIEW.width - BRAIN.x) / GATE.maxSpeed;
    expect(seconds).toBeGreaterThanOrEqual(3.5);
  });
});

describe('three strikes', () => {
  it('one bump is a strike, and play carries on', () => {
    const s = started();
    const g = s.gates[0];
    holdAt(s, g, g.centerY);
    expect(g.result).toBe('crash');
    expect(s.lives).toBe(LIVES - 1);
    expect(s.phase).toBe('playing');
    // Recovery lasts long enough to get clear of the gate it hit.
    expect(INVULN).toBeGreaterThanOrEqual((GATE.width + BRAIN.hitRadius * 2) / GATE.startSpeed);
  });

  it('a mix of bumps and wrong answers adds up to three strikes', () => {
    const s = started();
    const first = s.gates[0];
    holdAt(s, first, first.centerY); // bump
    s.brain.invuln = 0;
    const second = nextGate(s)!;
    holdAt(s, second, openingCenter(second, second.correct === 0 ? 1 : 0)); // wrong answer
    expect(s.lives).toBe(LIVES - 2);
    expect(s.phase).toBe('playing');
    s.brain.invuln = 0;
    const third = nextGate(s)!;
    holdAt(s, third, third.centerY);
    expect(s.phase).toBe('over');
  });
});

describe('game over', () => {
  it('losing every life ends the game, and a tap after the delay restarts', () => {
    const s = started();
    while (s.phase === 'playing') {
      const g = nextGate(s)!;
      s.brain.invuln = 0;
      holdAt(s, g, g.centerY);
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

describe('fairness', () => {
  it('a careful player can keep scoring', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = started(seed);
      for (let i = 0; i < 120 * 90 && s.phase === 'playing'; i++) {
        autopilot(s);
        step(s, DT);
      }
      expect(s.score, `seed ${seed}`).toBeGreaterThanOrEqual(15);
      expect(s.lives, `seed ${seed}`).toBe(LIVES);
    }
  });
});
