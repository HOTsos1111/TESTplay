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
}

export interface FrameInput {
  /** True for exactly one simulation step after a fresh press. */
  jumpPressed: boolean;
  jumpHeld: boolean;
  barkPressed: boolean;
}

export type PlayerEvent =
  | { type: 'jump' }
  | { type: 'land'; impact: number }
  | { type: 'hoverStart' }
  | { type: 'hoverStop' }
  | { type: 'bark' }
  | { type: 'bonk'; solid: Solid };

export interface PlayerStats {
  wagCapacity: number;
  rechargeRate: number;
  barkRange: number;
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
  barkCooldown = 0;
  invulnerable = 0;
  /** Time spent airborne since leaving the ground. */
  airTime = 0;
  private coyote = 0;
  private buffer = 0;
  /** True while the current upward motion came from a jump (enables release clamp). */
  private jumpRising = false;
  private supportTop: number | null = null;

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
    const { width, height, bottomInset } = HERO_BOX.hurt;
    return { x: this.x - width / 2, y: this.y - bottomInset - height, w: width, h: height };
  }

  pickupRect(): Rect {
    const { width, height } = HERO_BOX.pickup;
    return { x: this.x - width / 2, y: this.y - height, w: width, h: height };
  }

  barkRect(): Rect {
    const o = HERO_BOX.barkOrigin;
    const h = TUNING.barkHeight;
    return { x: this.x + o.x, y: this.y + o.y - h / 2, w: this.stats.barkRange, h };
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

    // --- Jump: fresh presses only (held jump never re-triggers on landing).
    if (input.jumpPressed) this.buffer = TUNING.jumpBuffer;
    else this.buffer = Math.max(0, this.buffer - dt);

    if (!this.grounded) this.coyote = Math.max(0, this.coyote - dt);

    if (this.buffer > 0 && (this.grounded || this.coyote > 0)) {
      this.vy = TUNING.jumpVelocity;
      this.grounded = false;
      this.coyote = 0;
      this.buffer = 0;
      this.airTime = 0;
      this.jumpRising = true;
      this.supportTop = null;
      events.push({ type: 'jump' });
    }

    // --- Variable jump height: early release clamps upward speed.
    if (this.jumpRising && !input.jumpHeld && this.vy < TUNING.jumpReleaseClamp) {
      this.vy = TUNING.jumpReleaseClamp;
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
    this.x += this.speed * dt;
    if (!this.grounded) this.y += this.vy * dt;

    // --- Collide.
    const half = HERO_BOX.body.width / 2;
    const height = HERO_BOX.body.height;
    const left = this.x - half;
    const right = this.x + half;

    if (this.grounded) {
      // Stay supported while any part of the body is over a surface.
      let support: number | null = null;
      for (const s of solids) {
        if (right > s.x && left < s.x + s.w && Math.abs(s.y - this.y) < 0.5) {
          support = s.y;
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
        const crossedTop = prevBottom <= s.y + 0.01 && this.y >= s.y;
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
        if (this.hovering) {
          this.hovering = false;
          events.push({ type: 'hoverStop' });
        }
        events.push({ type: 'land', impact });
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

    if (this.grounded) {
      this.airTime = 0;
      this.wag = Math.min(this.stats.wagCapacity, this.wag + this.stats.rechargeRate * dt);
    }

    return events;
  }

  get support(): number | null {
    return this.supportTop;
  }
}
