export type Rng = () => number;

export interface Question {
  text: string;
  value: number;
}

/** One pipe's maths: the balloon carries `answer`; one gap is right, one is a near miss. */
export interface QuestionPair {
  answer: number;
  correct: Question;
  wrong: Question;
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

/** An addition or subtraction question that equals `value`, never going below zero. */
export function makeQuestion(value: number, rng: Rng, level: MathLevel = LEVEL_1): Question {
  const canSubtract = value + 1 <= level.maxOperand;
  if (canSubtract && rng() < 0.5) {
    const b = randInt(rng, 1, Math.min(10, level.maxOperand - value));
    return { text: `${value + b} − ${b}`, value };
  }
  // Keep both addends at least 1 when possible ("0 + 5" is too easy to spot).
  const a = value >= 2 ? randInt(rng, 1, value - 1) : 0;
  return { text: `${a} + ${value - a}`, value };
}

export function makePair(rng: Rng, level: MathLevel = LEVEL_1): QuestionPair {
  const answer = randInt(rng, level.minAnswer, level.maxAnswer);
  let wrongValue = answer;
  while (wrongValue === answer || wrongValue < 0) {
    const miss = randInt(rng, 1, level.maxMiss);
    wrongValue = answer + (rng() < 0.5 ? -miss : miss);
  }
  return { answer, correct: makeQuestion(answer, rng, level), wrong: makeQuestion(wrongValue, rng, level) };
}
