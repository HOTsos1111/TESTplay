import { HERO_BOX, TUNING } from '../data/config';

/** Axis-aligned rectangle in world space (x/y = top-left). */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Solid extends Rect {
  /** One-way platforms can only be landed on from above. */
  oneWay: boolean;
  /** Ground blocks never "bonk"; the hero just drops into the pit. */
  kind: 'ground' | 'platform' | 'crate' | 'cardboard';
  /** Opaque owner reference (e.g. the breakable box). */
  ref?: unknown;
  /** Top on the previous step, for moving platforms (a rising lift can scoop the hero up). */
  prevY?: number;
}

export interface FrameInput {
  /** True for exactly one simulation step after a fresh press. */
  jumpPressed: boolean;
  jumpHeld: boolean;
  barkPressed: boolean;
  burstPressed?: boolean;
  /** SPEED held: winds up a slingshot burst that fires on release. */
  burstHeld?: boolean;
  /** Down held: duck on the ground; a fresh press on a platform drops through it. */
  duckHeld?: boolean;
}

export type PlayerEvent =
  | { type: 'jump' }
  | { type: 'doubleJump' }
  | { type: 'duckStart' }
  | { type: 'duckEnd' }
  | { type: 'drop' }
  | { type: 'land'; impact: number }
  | { type: 'hoverStart' }
  | { type: 'hoverStop' }
  | { type: 'bark' }
  | { type: 'burstCharge' }
  | { type: 'burstStart'; power: number }
  | { type: 'burstEnd' }
  | { type: 'bonk'; solid: Solid };

export interface PlayerStats {
  wagCapacity: number;
  rechargeRate: number;
  barkRange: number;
  /** Learned in Level 6 (default on, for tests and the old chapters). */
  doubleJump?: boolean;
}

export function baseStats(): PlayerStats {
  return {
    wagCapacity: TUNING.wagCapacity,
    rechargeRate: TUNING.groundRecharge,
    barkRange: TUNING.barkRange,
  };
}

/**
 * Pure movement simulation for the hero. No Phaser dependency, so it can be
 * unit-tested and reused by the chunk validator.
 *
 * Position (x, y) is the feet anchor: x = horizontal centre of the body box,
 * y = bottom of the body box.
 */
export class PlayerController {
  x: number;
  y: number;
  vy = 0;
  speed: number = TUNING.scrollSpeed;
  grounded = true;
  hovering = false;
  wag: number;
  stats: PlayerStats;
  /** 1 = facing right (the run direction), -1 = facing left (boss arenas only). */
  facing: 1 | -1 = 1;
  barkCooldown = 0;
  invulnerable = 0;
  /** Burst meter 0..1; a burst needs it full. */
  burstMeter = 1;
  /** Remaining ground burst time. */
  burstT = 0;
  /** True while a burst's speed is being carried through a jump. */
  burstCarry = false;
  /** Seconds SPEED has been held winding up a slingshot burst (null when not charging). */
  charge: number | null = null;
  /** Strength of the current burst, 0 (tap) .. 1 (full wind-up). */
  burstPower = 0;
  /** Second jump already used this time in the air. */
  doubleUsed = false;
  ducking = false;
  /** Time spent airborne since leaving the ground. */
  airTime = 0;
  private coyote = 0;
  private buffer = 0;
  /** True while the current upward motion came from a jump (enables release clamp). */
  private jumpRising = false;
  private supportTop: number | null = null;
  private supportSolid: Solid | null = null;
  /** Seconds left falling through one-way platforms after a drop. */
  private dropT = 0;
  private downWas = false;

  constructor(x: number, y: number, stats: PlayerStats = baseStats()) {
    this.x = x;
    this.y = y;
    this.stats = stats;
    this.wag = stats.wagCapacity;
  }

  bodyRect(): Rect {
    const { width, height } = HERO_BOX.body;
    return { x: this.x - width / 2, y: this.y - height, w: width, h: height };
  }

  hurtRect(): Rect {
    const { width, bottomInset } = HERO_BOX.hurt;
    const height = this.ducking ? HERO_BOX.duckHurtHeight : HERO_BOX.hurt.height;
    return { x: this.x - width / 2, y: this.y - bottomInset - height, w: width, h: height };
  }

  pickupRect(): Rect {
    const { width, height } = HERO_BOX.pickup;
    return { x: this.x - width / 2, y: this.y - height, w: width, h: height };
  }

  barkRect(): Rect {
    const o = HERO_BOX.barkOrigin;
    const h = TUNING.barkHeight;
    const x = this.facing > 0 ? this.x + o.x : this.x - o.x - this.stats.barkRange;
    return { x, y: this.y + o.y - h / 2, w: this.stats.barkRange, h };
  }

  get bursting(): boolean {
    return this.burstT > 0 || this.burstCarry;
  }

  /** Wind-up so far, 0..1. */
  get chargeLevel(): number {
    return this.charge === null ? 0 : Math.min(1, this.charge / TUNING.burstChargeFull);
  }

  /** Current horizontal speed including any burst. */
  get effectiveSpeed(): number {
    const bonus = TUNING.burstSpeedBonus * (1 + 0.5 * this.burstPower);
    if (this.burstCarry) return this.speed * (1 + bonus);
    if (this.burstT <= 0) return this.speed;
    // Ease off over the final 0.2 s on the ground.
    const k = Math.min(1, this.burstT / 0.2);
    return this.speed * (1 + bonus * k);
  }

  get wagFraction(): number {
    return this.stats.wagCapacity > 0 ? this.wag / this.stats.wagCapacity : 0;
  }

  /** Called by the game when the hero takes a hit. */
  hit(): void {
    this.invulnerable = TUNING.invulnerability;
    this.vy = TUNING.hitBounceVelocity;
    this.grounded = false;
    this.jumpRising = false;
    this.coyote = 0;
    this.supportTop = null;
  }

  /** Clear transient input state, e.g. after unpausing. */
  resetInputState(): void {
    this.buffer = 0;
  }

  step(dt: number, input: FrameInput, solids: readonly Solid[]): PlayerEvent[] {
    const events: PlayerEvent[] = [];

    this.barkCooldown = Math.max(0, this.barkCooldown - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);

    if (input.barkPressed && this.barkCooldown <= 0) {
      this.barkCooldown = TUNING.barkCooldown;
      events.push({ type: 'bark' });
    }

    // --- Burst: needs a full meter; the meter refills slowly while not bursting.
    // Slingshot: pressing SPEED winds up (he stretches out long); releasing it
    // snaps him forward. The longer the wind-up, the faster and longer the shot;
    // a quick tap is the standard burst.
    if (input.burstPressed && this.burstMeter >= 1 && !this.bursting && this.charge === null) {
      this.charge = 0;
      events.push({ type: 'burstCharge' });
    }
    if (this.charge !== null) {
      if (input.burstHeld && this.charge < TUNING.burstHoldMax) this.charge += dt;
      else {
        const power = this.chargeLevel;
        this.charge = null;
        this.burstMeter = 0;
        this.burstPower = power;
        this.burstT = TUNING.burstDuration * (1 + 0.6 * power);
        events.push({ type: 'burstStart', power });
      }
    } else if (this.bursting) {
      if (this.burstT > 0) this.burstT = Math.max(0, this.burstT - dt);
      if (!this.bursting) events.push({ type: 'burstEnd' });
    } else {
      this.burstMeter = Math.min(1, this.burstMeter + dt / TUNING.burstChargeTime);
    }

    // --- Jump: fresh presses only (held jump never re-triggers on landing).
    if (!this.grounded) this.coyote = Math.max(0, this.coyote - dt);
    const airborne = !this.grounded && this.coyote <= 0;
    if (input.jumpPressed && airborne && !this.doubleUsed && this.stats.doubleJump !== false) {
      // Double jump: a fresh press in mid-air.
      this.doubleUsed = true;
      this.vy = TUNING.doubleJumpVelocity;
      this.jumpRising = true;
      this.buffer = 0;
      if (this.hovering) {
        this.hovering = false;
        events.push({ type: 'hoverStop' });
      }
      events.push({ type: 'doubleJump' });
    } else if (input.jumpPressed) this.buffer = TUNING.jumpBuffer;
    else this.buffer = Math.max(0, this.buffer - dt);

    if (this.buffer > 0 && (this.grounded || this.coyote > 0)) {
      this.vy = TUNING.jumpVelocity;
      this.grounded = false;
      this.coyote = 0;
      this.buffer = 0;
      this.airTime = 0;
      this.jumpRising = true;
      this.supportTop = null;
      this.doubleUsed = false;
      if (this.burstT > 0) this.burstCarry = true;
      events.push({ type: 'jump' });
    }

    // --- Variable jump height: early release clamps upward speed.
    if (this.jumpRising && !input.jumpHeld && this.vy < TUNING.jumpReleaseClamp) {
      this.vy = TUNING.jumpReleaseClamp;
    }

    // --- Drop through: a fresh DOWN press on a one-way platform falls to the layer below.
    this.dropT = Math.max(0, this.dropT - dt);
    const downPressed = !!input.duckHeld && !this.downWas;
    this.downWas = !!input.duckHeld;
    if (downPressed && this.grounded && this.supportSolid?.oneWay) {
      this.grounded = false;
      this.coyote = 0;
      this.vy = 120;
      this.y += 2;
      this.dropT = 0.25;
      this.airTime = 0;
      this.supportTop = null;
      this.supportSolid = null;
      events.push({ type: 'drop' });
    }

    // --- Gravity and hover.
    if (!this.grounded) {
      this.airTime += dt;
      this.vy = Math.min(TUNING.maxFallSpeed, this.vy + TUNING.gravity * dt);
      if (this.vy >= 0) this.jumpRising = false;

      const wantsHover =
        input.jumpHeld && this.airTime >= TUNING.hoverDelay && this.vy >= 0 && this.wag > 0;
      if (wantsHover) {
        if (!this.hovering) events.push({ type: 'hoverStart' });
        this.hovering = true;
        this.wag = Math.max(0, this.wag - dt);
        this.vy = Math.min(this.vy, TUNING.hoverMaxFall);
      } else if (this.hovering) {
        this.hovering = false;
        events.push({ type: 'hoverStop' });
      }
    }

    // --- Integrate.
    const prevBottom = this.y;
    const prevX = this.x;
    this.x += this.effectiveSpeed * dt;
    if (!this.grounded) this.y += this.vy * dt;

    // --- Collide.
    const half = HERO_BOX.body.width / 2;
    const height = HERO_BOX.body.height;
    const left = this.x - half;
    const right = this.x + half;

    if (this.grounded) {
      // Stay supported while any part of the body is over a surface.
      let support: number | null = null;
      this.supportSolid = null;
      for (const s of solids) {
        if (right > s.x && left < s.x + s.w && Math.abs(s.y - this.y) < 0.5) {
          support = s.y;
          this.supportSolid = s;
          break;
        }
      }
      if (support === null) {
        this.grounded = false;
        this.coyote = TUNING.coyoteTime;
        this.airTime = 0;
        this.vy = 0;
        this.supportTop = null;
      } else {
        this.supportTop = support;
      }
    } else {
      let landed: Solid | null = null;
      for (const s of solids) {
        if (right <= s.x || left >= s.x + s.w) continue;
        if (this.vy < 0) continue;
        if (this.dropT > 0 && s.oneWay) continue;
        const crossedTop = prevBottom <= (s.prevY ?? s.y) + 0.01 && this.y >= s.y;
        const stepUp = !s.oneWay && this.y >= s.y && this.y - s.y <= TUNING.stepUp && prevBottom - s.y <= TUNING.stepUp;
        if (crossedTop || stepUp) {
          if (!landed || s.y < landed.y) landed = s;
        }
      }
      if (landed) {
        const impact = this.vy;
        this.y = landed.y;
        this.vy = 0;
        this.grounded = true;
        this.jumpRising = false;
        this.supportTop = landed.y;
        this.supportSolid = landed;
        if (this.hovering) {
          this.hovering = false;
          events.push({ type: 'hoverStop' });
        }
        events.push({ type: 'land', impact });
        if (this.burstCarry) {
          this.burstCarry = false;
          if (this.burstT <= 0) events.push({ type: 'burstEnd' });
        }
      }
    }

    // Side contact with full solids (crates, cardboard). Ground edges never bonk:
    // the hero simply drops into the pit behind the ground's front face.
    if (this.invulnerable <= 0) {
      const top = this.y - height;
      for (const s of solids) {
        if (s.oneWay || s.kind === 'ground') continue;
        const overlapsX = right > s.x && left < s.x + s.w;
        const overlapsY = this.y > s.y + 0.5 && top < s.y + s.h;
        const wasLeft = prevX + half <= s.x + 1;
        if (overlapsX && overlapsY && wasLeft) {
          events.push({ type: 'bonk', solid: s });
          break;
        }
      }
    }

    // --- Duck: only while on the ground; jumping or falling stands him back up.
    const duck = this.grounded && !!input.duckHeld;
    if (duck !== this.ducking) {
      this.ducking = duck;
      events.push({ type: duck ? 'duckStart' : 'duckEnd' });
    }

    if (this.grounded) {
      this.doubleUsed = false;
      this.airTime = 0;
      this.wag = Math.min(this.stats.wagCapacity, this.wag + this.stats.rechargeRate * dt);
    }

    return events;
  }

  get support(): number | null {
    return this.supportTop;
  }
}
