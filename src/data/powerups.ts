import type { PowerUpKind } from '../systems/art/powerupArt';

export type { PowerUpKind };

export interface PowerUpDef {
  kind: PowerUpKind;
  name: string;
  blurb: string;
  /** Seconds the effect lasts (the shield also ends when it blocks a hit). */
  duration: number;
  icon: string;
}

/** Short-lived pickups. None is ever required to finish a chapter. */
export const POWERUPS: Record<PowerUpKind, PowerUpDef> = {
  magnet: { kind: 'magnet', name: 'Golden Bone', blurb: 'Bones fly to you!', duration: 9, icon: 'pu_magnet' },
  shield: { kind: 'shield', name: 'Spiked Collar', blurb: 'Blocks the next hit!', duration: 15, icon: 'pu_shield' },
  whistle: { kind: 'whistle', name: 'Dog Whistle', blurb: 'Super-range rapid barks!', duration: 7, icon: 'pu_whistle' },
  bacon: { kind: 'bacon', name: 'Bacon Zoomies', blurb: 'Unlimited tail spins and bursts!', duration: 6, icon: 'pu_bacon' },
};

export const POWERUP_TUNING = {
  magnetRadius: 420,
  magnetPull: 950,
  whistleExtraRange: 170,
  whistleCooldown: 0.22,
  shieldGraceInvulnerability: 1.0,
} as const;
