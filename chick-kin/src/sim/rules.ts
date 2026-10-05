// Shared gameplay rules: bumps, power-ups, abilities. Identical for player and rivals.
import type { Actor } from './actor';
import type { EventLog } from './events';
import { POWERS, MAX_ACTIVE_POWERS, POWER_TUNING, type PowerId } from '../data/items';

export interface RuleCtx { ev: EventLog; time: number; assist: boolean; drop: (a: Actor, treats: number, bundle: boolean) => void }

/** Recovery protection after any setback (prevents chain-stun). */
export const PROTECT_TIME = 1.2;

/**
 * Bump a competitor. `by` is the bumping sibling id or 'hazard'.
 * Returns true if the bump landed (not absorbed / dodged / protected).
 */
export function bump(a: Actor, dirX: number, dirY: number, strength: number, by: number | 'hazard', ctx: RuleCtx, hazard?: string): boolean {
  if (a.protectT > 0 || a.stunT > 0) return false;
  if (by !== 'hazard' && a.dodgeT > 0) {
    ctx.ev.emit({ type: 'dodge', a: a.id, x: a.x, y: a.y });
    return false;
  }
  if (a.shield) {
    a.shield = false;
    a.powers = a.powers.filter((p) => p.id !== 'PU-04');
    a.protectT = 0.6;
    ctx.ev.emit({ type: 'shield', a: a.id, x: a.x, y: a.y });
    return false;
  }
  const res = a.tuning.bumpRes * (a.bracing ? (a.cls === 'mighty' ? 3 : 2) : 1);
  const k = strength / res;
  a.stunT = Math.min(0.7, 0.32 + 0.18 * k / 4);
  a.protectT = a.stunT + PROTECT_TIME;
  const n = Math.hypot(dirX, dirY) || 1;
  a.vx = (dirX / n) * Math.min(9, k);
  a.vy = a.vy + (dirY / n) * Math.min(9, k);
  dropCargo(a, ctx);
  a.interactT = 0;
  a.interactTarget = -1;
  ctx.ev.emit({ type: 'bump', a: a.id, by, x: a.x, y: a.y, hazard });
  return true;
}

/** Cargo drops visibly and stays recoverable (the match turns it into loose items). */
export function dropCargo(a: Actor, ctx: RuleCtx) {
  if (a.carryTreats > 0 || a.carryBundle) {
    ctx.drop(a, a.carryTreats, a.carryBundle);
    ctx.ev.emit({ type: 'drop', a: a.id, x: a.x, y: a.y });
    a.carryTreats = 0;
    a.carryBundle = false;
  }
}

/**
 * Apply a power-up. Same power refreshes duration (no stacking multipliers).
 * At most two timed powers: the one closest to expiring is replaced, with feedback.
 */
export function applyPower(a: Actor, id: PowerId, ctx: RuleCtx) {
  const info = POWERS[id];
  if (id === 'PU-08') {
    a.stamina = Math.min(a.staminaMax, a.stamina + a.staminaMax * POWER_TUNING.coolBreezeRestore);
    ctx.ev.emit({ type: 'power', a: a.id, pu: id, x: a.x, y: a.y });
    return;
  }
  const existing = a.powers.find((p) => p.id === id);
  if (existing) {
    existing.t = info.duration;
    existing.warned = false;
    if (id === 'PU-04') a.shield = true;
    ctx.ev.emit({ type: 'power', a: a.id, pu: id, x: a.x, y: a.y, refreshed: true });
    return;
  }
  let replaced: string | undefined;
  if (a.powers.length >= MAX_ACTIVE_POWERS) {
    a.powers.sort((p, q) => p.t - q.t);
    const old = a.powers.shift()!;
    if (old.id === 'PU-04') a.shield = false;
    replaced = old.id;
  }
  a.powers.push({ id, t: info.duration, warned: false });
  if (id === 'PU-04') a.shield = true;
  ctx.ev.emit({ type: 'power', a: a.id, pu: id, x: a.x, y: a.y, replaced });
}

export function tickTimers(a: Actor, dt: number, ctx: RuleCtx) {
  if (a.stunT > 0) a.stunT -= dt;
  if (a.protectT > 0) a.protectT -= dt;
  if (a.dodgeT > 0) a.dodgeT -= dt;
  if (a.abilityT > 0) a.abilityT -= dt;
  if (a.abilityCd > 0) {
    a.abilityCd -= dt;
    if (a.abilityCd <= 0 && !a.abilityReadyNotified) {
      a.abilityReadyNotified = true;
      ctx.ev.emit({ type: 'abilityReady', a: a.id });
    }
  }
  if (a.peckT > 0) a.peckT -= dt;
  if (a.nudgeCd > 0) a.nudgeCd -= dt;
  if (a.pushT > 0) a.pushT -= dt;
  for (const p of a.powers) {
    p.t -= dt;
    if (!p.warned && p.t < 1.5) { p.warned = true; ctx.ev.emit({ type: 'powerWarn', a: a.id, pu: p.id }); }
  }
  const before = a.powers.length;
  if (before) {
    const ended = a.powers.filter((p) => p.t <= 0);
    if (ended.length) {
      for (const p of ended) {
        if (p.id === 'PU-04') a.shield = false;
        ctx.ev.emit({ type: 'powerEnd', a: a.id, pu: p.id });
      }
      a.powers = a.powers.filter((p) => p.t > 0);
    }
  }
}

/** Can the actor trigger its signature ability now? */
export function abilityReady(a: Actor) { return a.abilityCd <= 0 && a.canAct; }

/** Start the signature ability; returns the ability id for mode-specific effects. */
export function startAbility(a: Actor, ctx: RuleCtx) {
  const ab = a.ability;
  a.abilityCd = ab.cooldown * (ctx.assist && a.isPlayer ? 0.8 : 1);
  a.abilityReadyNotified = false;
  a.abilityT = ab.duration;
  if (a.cls === 'nimble') a.dodgeT = 0.45;
  ctx.ev.emit({ type: 'ability', a: a.id, ability: ab.id, x: a.x, y: a.y });
  return ab.id;
}

/** Speed multiplier from powers/ability/carry, bounded. */
export function speedMult(a: Actor, onMud: boolean): number {
  let m = 1;
  if (a.hasPower('PU-01')) m *= POWER_TUNING.speedSeedMult;
  if (a.cls === 'speedy' && a.abilityT > 0) m *= a.stage === 1 ? 1.6 : 1.9;
  if (onMud) m *= a.hasPower('PU-06') ? 0.75 : 0.55;
  if (a.carryBundle) m *= 0.8;
  if (a.carryTreats > 0) m *= 1 - 0.05 * a.carryTreats;
  return Math.min(m, 2.2);
}

/**
 * Generic peck-nudge (every class): a gentle shove to an adjacent sibling. No stun, no cargo drop,
 * scaled by the target's bump resistance and bracing. Mighty's Fluff Bump remains the strong version.
 */
export function nudge(a: Actor, o: Actor, dirX: number, dirY: number, ctx: RuleCtx) {
  if (a.nudgeCd > 0) return false;
  a.nudgeCd = 0.9;
  a.peckT = 0.2;
  if (o.protectT > 0 || o.dodgeT > 0) return false;
  const res = o.tuning.bumpRes * (o.bracing ? (o.cls === 'mighty' ? 3 : 2) : 1);
  const k = (4.2 * Math.sqrt(a.pushForce)) / res;
  const n = Math.hypot(dirX, dirY) || 1;
  o.vx += (dirX / n) * k;
  o.vy += (dirY / n) * k;
  ctx.ev.emit({ type: 'peck', a: a.id, x: o.x, y: o.y });
  return true;
}
