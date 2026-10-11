import { describe, expect, it } from 'vitest';
import { LEVEL_1, makePair, makeQuestion, mulberry32 } from '../src/questions';

/** Evaluate "a + b" / "a − b" the way a player would. */
function evaluate(text: string): { value: number; operands: number[] } {
  const m = text.match(/^(\d+) ([+−]) (\d+)$/);
  if (!m) throw new Error(`bad question text: ${text}`);
  const a = Number(m[1]);
  const b = Number(m[3]);
  return { value: m[2] === '+' ? a + b : a - b, operands: [a, b] };
}

describe('level 1 questions', () => {
  it('every question equals its value and stays within the level', () => {
    const rng = mulberry32(1);
    for (let v = 0; v <= 15; v++) {
      for (let i = 0; i < 50; i++) {
        const q = makeQuestion(v, rng);
        const { value, operands } = evaluate(q.text);
        expect(value).toBe(v);
        expect(q.value).toBe(v);
        for (const n of operands) {
          expect(n).toBeGreaterThanOrEqual(0);
          expect(n).toBeLessThanOrEqual(LEVEL_1.maxOperand);
        }
      }
    }
  });

  it('uses both addition and subtraction', () => {
    const rng = mulberry32(2);
    const texts = Array.from({ length: 200 }, () => makePair(rng).correct.text);
    expect(texts.some((t) => t.includes('+'))).toBe(true);
    expect(texts.some((t) => t.includes('−'))).toBe(true);
  });

  it('pairs have exactly one right answer and a close, non-negative wrong one', () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 1000; i++) {
      const p = makePair(rng);
      expect(p.answer).toBeGreaterThanOrEqual(LEVEL_1.minAnswer);
      expect(p.answer).toBeLessThanOrEqual(LEVEL_1.maxAnswer);
      expect(evaluate(p.correct.text).value).toBe(p.answer);
      const wrong = evaluate(p.wrong.text).value;
      expect(wrong).not.toBe(p.answer);
      expect(wrong).toBeGreaterThanOrEqual(0);
      expect(Math.abs(wrong - p.answer)).toBeLessThanOrEqual(LEVEL_1.maxMiss);
    }
  });

  it('is deterministic for a seed', () => {
    const a = Array.from({ length: 20 }, ((r) => () => makePair(r))(mulberry32(9)));
    const b = Array.from({ length: 20 }, ((r) => () => makePair(r))(mulberry32(9)));
    expect(a).toEqual(b);
  });
});
