/** Logical play area. The canvas is scaled to fit the window. */
export const VIEW = { width: 1280, height: 720 };

export const BALLOON = {
  /** The balloon holds this x; the pipes scroll past it. */
  x: 360,
  radius: 30,
  /** Hitbox is a little smaller than the drawing so grazes feel fair. */
  hitScale: 0.85,
  minY: 110,
  maxY: 610,
  /** Seconds between the balloon's own random puffs. */
  puffMin: 0.45,
  puffMax: 1.3,
  /** Largest vertical kick (px/s) a single puff gives. */
  puffStrength: 160,
  damping: 1.4,
  /** Weak spring back toward the middle so it never camps at an edge. */
  centerPull: 0.6,
  maxSpeed: 160,
};

export const PIPE = {
  width: 120,
  gapHeight: 190,
  /** Distance between the two gap centres in one pipe. */
  gapSpacing: 300,
  /** The active pipe falls under gravity; each tap flaps it upward. */
  gravity: 1100,
  flapSpeed: 280,
  maxFall: 600,
  /** Horizontal distance between pipes. */
  spacing: 560,
  startSpeed: 190,
  speedPerPoint: 4,
  maxSpeed: 300,
};

/** Pipe offset limits: either gap can line up with anywhere the balloon can go. */
export const PIPE_OFFSET = {
  min: BALLOON.minY - PIPE.gapSpacing / 2,
  max: BALLOON.maxY + PIPE.gapSpacing / 2,
};

export const LIVES = 3;
/** Seconds of no-collision after losing a life. */
export const INVULN = 1.4;
/** Ignore taps for this long on the game-over screen so a panic tap doesn't restart. */
export const RESTART_DELAY = 0.6;
