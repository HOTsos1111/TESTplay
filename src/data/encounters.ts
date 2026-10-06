/**
 * Encounter definitions. Screen-space x values are measured on the 1280-wide
 * logical viewport (the hero runs at x = 320).
 */
export interface TrolleyRound {
  parcels: ('small' | 'big')[];
  /** Seconds between parcel launches. */
  interval: number;
}

export const TROLLEY = {
  hitsToWin: 3,
  /** Constant run speed during the encounter. */
  speed: 360,
  enterTime: 2.2,
  /** Screen x of the trolley's front face while resting. */
  restScreenX: 960,
  /** Screen x of the trolley's front face during the vulnerable window (inside base bark reach). */
  lungeScreenX: 500,
  warnTime: 1.1,
  lungeWarnTime: 0.6,
  lungeTime: 0.7,
  windowTime: 1.7,
  hitReactTime: 0.6,
  retreatTime: 0.9,
  /** World-space parcel speed (negative = toward the hero). */
  parcelSpeed: -190,
  rounds: [
    { parcels: ['small', 'big', 'small'], interval: 1.1 },
    { parcels: ['big', 'small', 'big', 'small'], interval: 1.0 },
    { parcels: ['small', 'big', 'small', 'big', 'big'], interval: 0.95 },
  ] as TrolleyRound[],
} as const;

/** Chapter-one finale: Nutso's squirrel swarm. Screen x values on the 1280 viewport. */
export const SWARM = {
  size: 10,
  /** Constant run speed during the fight. */
  speed: 360,
  enterTime: 1.6,
  /** Squirrels on screen at once: early, then after `rampAfter` are out. */
  activeEarly: 2,
  activeLate: 3,
  rampAfter: 4,
  spawnGap: 1.1,
  /** Where minions loiter between attacks (screen x). */
  restMin: 640,
  restMax: 1040,
  /** Attack mix (the rest is darting in to taunt, the easy bark window). */
  weights: { lob: 0.28, charge: 0.24, glide: 0.2 },
  chargeWarn: 0.75,
  chargeSpeed: 560,
  glideWarn: 0.85,
  glideSpeed: 520,
  tauntMin: 1.1,
  tauntMax: 1.6,
} as const;

/** Chapter-two finale: the Pigeon Captain. Heights are above the floor; x on the 1280 viewport. */
export const PIGEON = {
  hitsToWin: 4,
  speed: 370,
  enterTime: 2.0,
  hoverX: 860,
  hoverHeight: 300,
  /** World-space speed of rolls along the street (negative = toward the hero). */
  rollSpeed: -210,
  swoopWarn: 0.9,
  /** Pause after the last roll before the first swoop warning. */
  swoopDelay: 1.7,
  swoopStartX: 1180,
  /** Body height while swooping: hits a standing dog, misses a ducking one. */
  swoopHeight: 34,
  /** Where he lands to peck (inside base bark reach once the hero paces up). */
  landX: 560,
  rounds: [
    { rolls: 3, rollGap: 0.9, swoops: 1, swoopSpeed: 640, peckTime: 1.9 },
    { rolls: 4, rollGap: 0.8, swoops: 1, swoopSpeed: 720, peckTime: 1.7 },
    { rolls: 4, rollGap: 0.75, swoops: 2, swoopSpeed: 760, peckTime: 1.6 },
    { rolls: 5, rollGap: 0.7, swoops: 2, swoopSpeed: 820, peckTime: 1.5 },
  ],
} as const;
