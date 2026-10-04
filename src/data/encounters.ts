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
  speed: 340,
  enterTime: 2.2,
  /** Screen x of the trolley's front face while resting. */
  restScreenX: 960,
  /** Screen x of the trolley's front face during the vulnerable window (inside base bark reach). */
  lungeScreenX: 500,
  warnTime: 1.1,
  lungeWarnTime: 0.6,
  lungeTime: 0.7,
  windowTime: 2.2,
  hitReactTime: 0.6,
  retreatTime: 0.9,
  /** World-space parcel speed (negative = toward the hero). */
  parcelSpeed: -190,
  rounds: [
    { parcels: ['small', 'small'], interval: 1.15 },
    { parcels: ['small', 'big', 'small'], interval: 1.0 },
    { parcels: ['big', 'small', 'big', 'small'], interval: 0.95 },
  ] as TrolleyRound[],
} as const;
