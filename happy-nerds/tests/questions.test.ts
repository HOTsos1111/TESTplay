import { describe, expect, it } from 'vitest';
import { LEVEL_1, makeProblem, makeSum, mulberry32 } from '../src/questions';

/** Evaluate "a + b" / "a − b" the way a player would. */
function evaluate(text: string): { value: number; operands: number[] } {
  const m = text.match(/^(\d+) ([+−]) (\d+)( = \?)?$/);
  if (!m) throw new Error(`bad question text: ${text}`);
  const a = Number(m[1]);
  const b = Number(m[3]);
  return { value: m[2] === '+' ? a + b : a - b, operands: [a, b] };
}

describe('level 1 problems', () => {
  it('every sum equals its value and stays within the level', () => {
    const rng = mulberry32(1);
    for (let v = 0; v <= 15; v++) {
      for (let i = 0; i < 50; i++) {
        const { value, operands } = evaluate(makeSum(v, rng));
        expect(value).toBe(v);
        for (const n of operands) {
          expect(n).toBeGreaterThanOrEqual(0);
          expect(n).toBeLessThanOrEqual(LEVEL_1.maxOperand);
        }
      }
    }
  });

  it('uses both addition and subtraction', () => {
    const rng = mulberry32(2);
    const qs = Array.from({ length: 200 }, () => makeProblem(rng).question);
    expect(qs.some((t) => t.includes('+'))).toBe(true);
    expect(qs.some((t) => t.includes('−'))).toBe(true);
  });

  it('one question, exactly one right answer and a close, non-negative wrong one', () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 1000; i++) {
      const p = makeProblem(rng);
      expect(p.answer).toBeGreaterThanOrEqual(LEVEL_1.minAnswer);
      expect(p.answer).toBeLessThanOrEqual(LEVEL_1.maxAnswer);
      expect(evaluate(p.question).value).toBe(p.answer);
      expect(p.wrong).not.toBe(p.answer);
      expect(p.wrong).toBeGreaterThanOrEqual(0);
      expect(Math.abs(p.wrong - p.answer)).toBeLessThanOrEqual(LEVEL_1.maxMiss);
    }
  });

  it('is deterministic for a seed', () => {
    const run = (r: () => number) => Array.from({ length: 20 }, () => makeProblem(r));
    expect(run(mulberry32(9))).toEqual(run(mulberry32(9)));
  });
});
