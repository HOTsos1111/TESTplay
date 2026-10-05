// Growth stages (brief §4, §10). Each stage changes proportions, mechanics and the gameplay format.

export type Stage = 1 | 2 | 3 | 4 | 5;
export const STAGES: readonly Stage[] = [1, 2, 3, 4, 5];

export interface GrowthProfile {
  stage: Stage;
  name: string;
  /** Model proportions: overall scale, body stretch (height/width), leg length, wing size, eye scale. */
  model: { scale: number; stretch: number; legs: number; wings: number; eyes: number; tuft: number; neck: number };
  /** Base movement values before class multipliers. */
  side: { run: number; accel: number; airAccel: number; gravity: number; jumpHeight: number; w: number; h: number; duckH: number };
  top: { run: number; accel: number; hopHeight: number; radius: number };
  /** Mechanics unlocked at this stage. */
  canDuck: boolean;
  canFlap: boolean;   // airborne flap using stamina
  canGlide: boolean;
  canCarry: boolean;
  canVault: boolean;
  canBrace: boolean;
  stamina: number;    // base flap stamina (multiplied by class flap)
}

export const GROWTH: Record<Stage, GrowthProfile> = {
  1: {
    stage: 1, name: 'Hatchling',
    model: { scale: 0.62, stretch: 0.95, legs: 0.55, wings: 0.45, eyes: 1.25, tuft: 0.55, neck: 0 },
    side: { run: 4.0, accel: 26, airAccel: 16, gravity: 30, jumpHeight: 1.0, w: 0.5, h: 0.55, duckH: 0.35 },
    top: { run: 3.4, accel: 22, hopHeight: 0.45, radius: 0.28 },
    canDuck: false, canFlap: false, canGlide: false, canCarry: false, canVault: false, canBrace: false, stamina: 0,
  },
  2: {
    stage: 2, name: 'Fluffy Chick',
    model: { scale: 0.78, stretch: 1.0, legs: 0.7, wings: 0.55, eyes: 1.12, tuft: 0.75, neck: 0.05 },
    side: { run: 5.0, accel: 32, airAccel: 20, gravity: 32, jumpHeight: 1.75, w: 0.62, h: 0.72, duckH: 0.38 },
    top: { run: 4.0, accel: 26, hopHeight: 0.55, radius: 0.32 },
    canDuck: true, canFlap: false, canGlide: false, canCarry: false, canVault: false, canBrace: false, stamina: 0,
  },
  3: {
    stage: 3, name: 'Awkward Adolescent',
    model: { scale: 0.92, stretch: 1.12, legs: 0.95, wings: 0.8, eyes: 1.0, tuft: 0.9, neck: 0.18 },
    side: { run: 5.3, accel: 32, airAccel: 22, gravity: 30, jumpHeight: 1.9, w: 0.66, h: 0.86, duckH: 0.46 },
    top: { run: 4.4, accel: 28, hopHeight: 0.7, radius: 0.36 },
    canDuck: true, canFlap: true, canGlide: true, canCarry: true, canVault: false, canBrace: true, stamina: 3,
  },
  4: {
    stage: 4, name: 'Young Chicken',
    model: { scale: 1.02, stretch: 1.12, legs: 1.0, wings: 0.95, eyes: 0.94, tuft: 1.0, neck: 0.24 },
    side: { run: 5.7, accel: 34, airAccel: 22, gravity: 30, jumpHeight: 2.0, w: 0.7, h: 0.92, duckH: 0.5 },
    top: { run: 4.7, accel: 30, hopHeight: 0.85, radius: 0.38 },
    canDuck: true, canFlap: true, canGlide: true, canCarry: true, canVault: true, canBrace: true, stamina: 3,
  },
  5: {
    stage: 5, name: 'Almost Grown',
    model: { scale: 1.12, stretch: 1.15, legs: 1.05, wings: 1.05, eyes: 0.9, tuft: 1.1, neck: 0.3 },
    side: { run: 6.0, accel: 36, airAccel: 24, gravity: 30, jumpHeight: 2.1, w: 0.72, h: 0.96, duckH: 0.52 },
    top: { run: 5.0, accel: 32, hopHeight: 0.9, radius: 0.4 },
    canDuck: true, canFlap: true, canGlide: true, canCarry: true, canVault: true, canBrace: true, stamina: 3.4,
  },
};

/** Adult parent proportions for the celebration/family tree (not a playable stage). */
export const ADULT_MODEL = { scale: 1.35, stretch: 1.25, legs: 1.1, wings: 1.2, eyes: 0.8, tuft: 1.3, neck: 0.4 };
