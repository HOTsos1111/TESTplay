/**
 * All gameplay tuning lives here. Values are the handoff's proposed starting
 * points (section 4, "Initial tuning") — not a tested balance.
 */
export const VIEW = {
  /** Design width. Wide phones get a wider game (up to maxWidth) at the same height. */
  width: 1280,
  maxWidth: 1720,
  height: 720,
  /** Hero is held at this fraction of the screen width. */
  heroScreenX: 0.25,
} as const;

export const WORLD = {
  /** World y of the top of the single ground plane. */
  groundY: 600,
  /** Falling below this world y ends the attempt. */
  pitDeathY: 790,
  /** How far ahead of the camera's right edge objects are spawned. */
  spawnAhead: 700,
  /** How far behind the camera's left edge objects are released. */
  despawnBehind: 300,
} as const;

export const TUNING = {
  scrollSpeed: 320,
  scrollSpeedCap: 460,
  gravity: 1800,
  maxFallSpeed: 1100,
  jumpVelocity: -650,
  jumpReleaseClamp: -300,
  /** Second jump, triggered by a fresh press while airborne (once per air time). */
  doubleJumpVelocity: -680,
  /** Extra px/s the hero gains or loses relative to the scroll when pacing forward/back. */
  paceSpeed: 130,
  /** On-screen range the hero can pace within (px from the left edge). */
  paceMinX: 150,
  paceMaxX: 560,
  coyoteTime: 0.1,
  jumpBuffer: 0.12,
  hoverDelay: 0.18,
  /** Seconds of hover at base stats. */
  wagCapacity: 1.0,
  hoverMaxFall: 70,
  /** Meter units (seconds of hover) recharged per second on the ground. */
  groundRecharge: 0.6,
  /** Seconds for the burst meter to fill from empty. */
  burstChargeTime: 6,
  /** Seconds a burst lasts on the ground; a jump started during it keeps the speed until landing. */
  burstDuration: 0.9,
  /** Extra speed during a burst, as a fraction of the current run speed. */
  burstSpeedBonus: 0.65,
  /** How far forward the hero slides on screen while bursting (cosmetic camera lead). */
  burstScreenLead: 90,
  barkCooldown: 0.75,
  barkRange: 190,
  barkLifetime: 0.18,
  /** Vertical extent of the bark pulse, centred on the head. */
  barkHeight: 130,
  maxHearts: 6,
  invulnerability: 1.2,
  /** Upward kick applied when the hero is hit. */
  hitBounceVelocity: -480,
  /** Feet may snap up onto a ledge this many px above them (contact forgiveness). */
  stepUp: 14,
  /** Fixed simulation sub-step and per-frame cap (seconds). */
  maxStep: 1 / 120,
  maxFrameDelta: 0.1,
} as const;

/**
 * Collision geometry. Cosmetic stretch/ears/tail never touch these.
 * The body box is anchored at the feet (x = centre, y = bottom).
 */
export const HERO_BOX = {
  body: { width: 92, height: 46 },
  /** Inset hurtbox covering the central body only. */
  hurt: { width: 76, height: 34, bottomInset: 6 },
  /** Hurtbox height while ducking (squashed flat to the floor). */
  duckHurtHeight: 16,
  /** Bones are collected with a more generous box. */
  pickup: { width: 120, height: 80 },
  /** Bark origin relative to feet anchor. */
  barkOrigin: { x: 60, y: -46 },
} as const;

export const UPGRADE_PRICES = [50, 100, 175] as const;
export const UPGRADE_MAX_LEVEL = 3;

export const UPGRADE_EFFECTS = {
  /** + seconds of hover per level. */
  tail: 0.2,
  /** + fraction of base recharge per level. */
  recharge: 0.1,
  /** + px bark reach per level. */
  bark: 20,
} as const;

export const SCORING = {
  /** World px per displayed "metre" (display only; not real-world time). */
  pxPerMetre: 40,
  firstClearBonus: 50,
} as const;

export const DEPTH = {
  farBg: -30,
  midBg: -20,
  nearBg: -10,
  scent: 5,
  platform: 20,
  prop: 30,
  bone: 35,
  enemy: 40,
  shadow: 44,
  hero: 50,
  /** The faux-3D floor's top face rises above foot level, so it sits behind everything on it. */
  ground: -5,
  groundShadow: 2,
  boss: 45,
  fx: 70,
  debug: 90,
  hud: 1000,
  touch: 1100,
  overlay: 1200,
} as const;
