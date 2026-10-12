export type Rng = () => number;

/** One gate's maths: a question and two answers, exactly one of them right. */
export interface Problem {
  question: string;
  answer: number;
  /** A near miss, never equal to the answer and never negative. */
  wrong: number;
}

export interface MathLevel {
  name: string;
  minAnswer: number;
  maxAnswer: number;
  /** Largest number that may appear in a question. */
  maxOperand: number;
  /** How far (±) the wrong answer may be from the right one. */
  maxMiss: number;
}

export const LEVEL_1: MathLevel = {
  name: 'Level 1 · Adding and taking away',
  minAnswer: 1,
  maxAnswer: 12,
  maxOperand: 20,
  maxMiss: 3,
};

export const randInt = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));

/** Small seeded generator so tests (and replays) are deterministic. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** An addition or subtraction sum that equals `value`, never going below zero. */
export function makeSum(value: number, rng: Rng, level: MathLevel = LEVEL_1): string {
  const canSubtract = value + 1 <= level.maxOperand;
  if (canSubtract && rng() < 0.5) {
    const b = randInt(rng, 1, Math.min(10, level.maxOperand - value));
    return `${value + b} − ${b}`;
  }
  // Keep both addends at least 1 when possible ("0 + 5" is too easy to spot).
  const a = value >= 2 ? randInt(rng, 1, value - 1) : 0;
  return `${a} + ${value - a}`;
}

export function makeProblem(rng: Rng, level: MathLevel = LEVEL_1): Problem {
  const answer = randInt(rng, level.minAnswer, level.maxAnswer);
  let wrong = answer;
  while (wrong === answer || wrong < 0) {
    const miss = randInt(rng, 1, level.maxMiss);
    wrong = answer + (rng() < 0.5 ? -miss : miss);
  }
  return { question: `${makeSum(answer, rng, level)} = ?`, answer, wrong };
}
