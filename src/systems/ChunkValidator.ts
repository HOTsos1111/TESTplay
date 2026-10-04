import { HERO_BOX, TUNING, WORLD } from '../data/config';
import { OBJECT_SIZE, type ChunkDef } from '../data/chunks';
import { PlayerController, baseStats, type Solid } from './PlayerController';

export interface Reach {
  /** Widest gap crossable with a full held jump and no hover. */
  jumpGap: number;
  /** Widest gap crossable with a full jump plus a full hover. */
  hoverGap: number;
  /** Widest gap crossable with a burst, a full jump and a full hover. */
  burstGap: number;
  /** Max height the feet reach above the takeoff surface. */
  apex: number;
}

/**
 * Measures reach by running the real PlayerController over a flat floor with
 * the jump held, at base stats. This keeps validation honest when tuning moves.
 */
export function measureReach(speed: number, hover: boolean, burst = false): { distance: number; apex: number } {
  const floorY = WORLD.groundY;
  const floor: Solid[] = [{ x: -10_000, y: floorY, w: 10_000, h: 200, oneWay: false, kind: 'ground' }];
  const pc = new PlayerController(-1, floorY, baseStats());
  pc.speed = speed;
  const dt = TUNING.maxStep;
  // A burst is triggered a few frames before takeoff, as a player would.
  if (burst) for (let i = 0; i < 6; i++) pc.step(dt, { jumpPressed: false, jumpHeld: false, barkPressed: false, burstPressed: i === 0 }, floor);
  // Take off from the floor, then remove it: we measure free-flight distance.
  pc.step(dt, { jumpPressed: true, jumpHeld: true, barkPressed: false }, floor);
  const x0 = pc.x;
  let apex = 0;
  for (let i = 0; i < 2000; i++) {
    pc.step(dt, { jumpPressed: false, jumpHeld: hover || pc.vy < 0, barkPressed: false }, []);
    apex = Math.max(apex, floorY - pc.y);
    if (pc.vy > 0 && pc.y >= floorY) break;
  }
  return { distance: pc.x - x0, apex };
}

/** Highest the feet reach with a full jump plus a double jump pressed at the apex. */
export function measureDoubleApex(): number {
  const floorY = WORLD.groundY;
  const floor: Solid[] = [{ x: -10_000, y: floorY, w: 20_000, h: 200, oneWay: false, kind: 'ground' }];
  const pc = new PlayerController(0, floorY, baseStats());
  const dt = TUNING.maxStep;
  pc.step(dt, { jumpPressed: true, jumpHeld: true, barkPressed: false }, floor);
  let apex = 0;
  let pressed = false;
  for (let i = 0; i < 2000; i++) {
    const press = !pressed && pc.vy >= 0;
    if (press) pressed = true;
    pc.step(dt, { jumpPressed: press, jumpHeld: press || pc.vy < 0, barkPressed: false }, []);
    apex = Math.max(apex, floorY - pc.y);
    if (pressed && pc.vy > 0 && pc.y >= floorY) break;
  }
  return apex;
}

export function reachAt(speed: number): Reach {
  const j = measureReach(speed, false);
  const h = measureReach(speed, true);
  const b = measureReach(speed, true, true);
  // The long body adds its own length of forgiveness (rear leaves late, nose lands early).
  const body = HERO_BOX.body.width;
  return { jumpGap: j.distance + body, hoverGap: h.distance + body, burstGap: b.distance + body, apex: j.apex };
}

export interface ValidationIssue {
  chunk: string;
  message: string;
}

/** Safety margins: authored challenges may use at most this fraction of measured reach. */
const MARGIN = 0.85;
/** Approximate roll distance of a barrel before it reaches the hero (trigger 900 px, 170 vs ~350 px/s). */
const BARREL_TRAVEL = 280;

/**
 * Checks one chunk against the abilities it declares, at the slowest and
 * fastest speeds it will be played at (gaps are hardest when slow).
 */
export function validateChunk(c: ChunkDef, minSpeed: number, maxSpeed: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (message: string) => issues.push({ chunk: c.id, message });
  const slow = reachAt(minSpeed);
  const fast = reachAt(maxSpeed);
  const apex = Math.min(slow.apex, fast.apex);
  const canHover = c.requires.includes('hover');
  const canBurst = c.requires.includes('burst');
  const canDouble = c.requires.includes('double');
  const doubleApex = measureDoubleApex();
  const canBark = c.requires.includes('bark');

  for (const [x, w] of c.gaps ?? []) {
    const limit = (canBurst ? slow.burstGap : canHover ? slow.hoverGap : slow.jumpGap) * MARGIN;
    if (w > limit) add(`gap at ${x} (${w}px) exceeds safe reach ${limit.toFixed(0)}px at ${minSpeed}px/s`);
    if (!canHover && w > slow.jumpGap * MARGIN) add(`gap at ${x} needs hover but chunk does not declare it`);
    if (w > slow.hoverGap * MARGIN && !(c.burstMarkers ?? []).some((m) => m.x < x && x - m.x < 900)) add(`burst gap at ${x} has no burst marker before it`);
    if (x < 200 || x + w > c.length - 200) add(`gap at ${x} too close to chunk edge`);
    if (!c.requires.includes('jump')) add(`gap at ${x} but chunk does not require jump`);
  }

  // Heavy crate columns taller than a jump must be reachable from a step before them.
  const columns = new Map<number, number>();
  for (const cr of c.crates ?? []) {
    const top = (cr.h ?? 0) + (cr.stack ?? 1) * OBJECT_SIZE.crate.h;
    columns.set(cr.x, Math.max(columns.get(cr.x) ?? 0, top));
  }
  for (const [x, top] of columns) {
    if (top <= apex * MARGIN) continue;
    const before = columns.get(x - OBJECT_SIZE.crate.w) ?? 0;
    const reach = (canDouble ? doubleApex : apex) * MARGIN;
    if (top - before > reach) add(`crate column at ${x} (${top}px) cannot be climbed${canDouble ? '' : ' (needs double jump?)'}`);
    // Climbing from a lower step needs run-up: at least three crates of that step to land on.
    if (before > 0 && top > before) {
      let run = 0;
      while ((columns.get(x - (run + 1) * OBJECT_SIZE.crate.w) ?? -1) === before) run++;
      if (run < 3) add(`crate step before column at ${x} is only ${run} crate(s) wide; needs 3 to land and re-jump`);
    }
  }

  if ((c.lowbars ?? []).length && !c.requires.includes('duck')) add('low signs present but chunk does not declare duck');

  for (const cb of c.cardboard ?? []) {
    const top = (cb.h ?? 0) + cb.stack * OBJECT_SIZE.cardboard.h;
    if (top > apex * MARGIN && !canBark) add(`cardboard wall at ${cb.x} needs bark but chunk does not declare it`);
  }

  for (const b of c.barrels ?? []) {
    const meet = b.x - BARREL_TRAVEL;
    const blocked = (c.gaps ?? []).some(([gx, gw]) => gx < b.x && gx + gw > meet - 150);
    if (blocked) add(`barrel at ${b.x} would roll into a gap before reaching the hero`);
  }

  for (const p of c.platforms ?? []) {
    if (p.h > apex * 2) add(`platform at ${p.x} is very high (${p.h}px)`);
  }

  // Readable spacing: hazards on the main route need room to land between them.
  const hazards = [
    ...(c.tyres ?? []).filter((t) => !t.h).map((t) => ({ x: t.x, w: OBJECT_SIZE.tyre.w })),
    ...(c.cardboard ?? []).filter((b) => !b.h).map((b) => ({ x: b.x, w: OBJECT_SIZE.cardboard.w })),
    ...(c.gaps ?? []).map(([x, w]) => ({ x, w })),
    ...(c.lowbars ?? []).map((l) => ({ x: l.x, w: 104 })),
    // Barrels roll about this far toward the hero before they meet him.
    ...(c.barrels ?? []).map((b) => ({ x: b.x - BARREL_TRAVEL, w: 48 })),
  ].sort((a, b) => a.x - b.x);
  const minClear = TUNING.barkCooldown * maxSpeed;
  for (let i = 1; i < hazards.length; i++) {
    const clear = hazards[i].x - (hazards[i - 1].x + hazards[i - 1].w);
    if (clear < minClear) add(`only ${clear}px between hazards at ${hazards[i - 1].x} and ${hazards[i].x}`);
  }

  const last = hazards.length ? hazards[hazards.length - 1] : null;
  if (last && c.length - (last.x + last.w) < c.recovery) {
    add(`declared recovery ${c.recovery}px but only ${c.length - (last.x + last.w)}px after last hazard`);
  }
  return issues;
}

/**
 * Validates a chunk sequence: each chunk individually, plus the rule that a
 * forced hover is never followed by another before the tail can recharge.
 */
export function validateSequence(chunks: ChunkDef[], speedStart: number, speedEnd: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const total = chunks.reduce((s, c) => s + c.length, 0);
  let cursor = 0;
  let lastHoverEnd = -Infinity;
  let lastBurstEnd = -Infinity;
  const rechargeDistance = (TUNING.wagCapacity / TUNING.groundRecharge) * speedEnd;
  // A burst meter must be full again before the next burst gap (burst and carry time included).
  const burstRecharge = (TUNING.burstChargeTime + TUNING.burstDuration) * speedEnd * (1 + TUNING.burstSpeedBonus * 0.3);
  for (const c of chunks) {
    const t = total > 0 ? cursor / total : 0;
    const v = speedStart + (speedEnd - speedStart) * t;
    issues.push(...validateChunk(c, v, speedEnd));
    const slow = reachAt(v);
    for (const [gx, gw] of c.gaps ?? []) {
      if (gw > slow.jumpGap * MARGIN) {
        const start = cursor + gx;
        if (start - lastHoverEnd < rechargeDistance) {
          issues.push({ chunk: c.id, message: `forced hover at ${gx} only ${(start - lastHoverEnd).toFixed(0)}px after previous one (needs ${rechargeDistance.toFixed(0)})` });
        }
        lastHoverEnd = start + gw;
      }
      if (gw > slow.hoverGap * MARGIN) {
        const start = cursor + gx;
        if (start - lastBurstEnd < burstRecharge) {
          issues.push({ chunk: c.id, message: `burst gap at ${gx} only ${(start - lastBurstEnd).toFixed(0)}px after previous one (needs ${burstRecharge.toFixed(0)})` });
        }
        lastBurstEnd = start + gw;
      }
    }
    cursor += c.length;
  }
  return issues;
}
