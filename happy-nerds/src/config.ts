/** Logical play area. The canvas is scaled to fit the window. */
export const VIEW = { width: 1280, height: 720 };

/** The winged brain. The player flaps it; gravity pulls it down between flaps. */
export const BRAIN = {
  /** The brain holds this x; the gates scroll toward it. */
  x: 360,
  /** Size of the drawn body (the wings stick out beyond it). */
  bodyRadius: 35,
  /** Collision circle around the main body only. Smaller than the drawing so grazes are forgiven. */
  hitRadius: 23,
  /** Small, steerable hops: each flap lifts the brain about 40 px. */
  gravity: 1250,
  flapSpeed: 320,
  maxFall: 520,
  /** Touching the ceiling or the floor just stops or bounces the brain; neither costs a strike. */
  ceiling: 40,
  floor: VIEW.height - 30,
};

export const GATE = {
  width: 120,
  /** Height of each answer opening. */
  openingHeight: 170,
  /** Solid section between the openings that carries the question. */
  middleHeight: 150,
  /** Gate centres vary a little so every gate isn't flown at the same height. */
  centerY: VIEW.height / 2 + 5,
  centerJitter: 30,
  /** Horizontal distance between gates. */
  spacing: 640,
  /** Starts slow so players can find the rhythm, then builds up with each correct answer. */
  startSpeed: 115,
  speedPerPoint: 4,
  maxSpeed: 240,
};

/** Strikes allowed: each bump or wrong answer is one; the last one ends the run. */
export const LIVES = 3;
/** Seconds of no-collision after a strike, long enough to fly clear of the gate. */
export const INVULN = 2;
/** Ignore taps for this long on the game-over screen so a panic tap doesn't restart. */
export const RESTART_DELAY = 0.6;
