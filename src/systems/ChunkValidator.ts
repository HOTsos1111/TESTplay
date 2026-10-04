import { HERO_BOX, TUNING, WORLD } from '../data/config';
import { OBJECT_SIZE, type ChunkDef } from '../data/chunks';
import { PlayerController, baseStats, type Solid } from './PlayerController';

export interface Reach {
  /** Widest gap crossable with a full held jump and no hover. */
  jumpGap: number;
  /** Widest gap crossable with a full jump plus a full hover. */
  hoverGap: number;
  /** Max height the feet reach above the takeoff surface. */
  apex: number;
}

/**
 * Measures reach by running the real PlayerController over a flat floor with
 * the jump held, at base stats. This keeps validation honest when tuning moves.
 */
export function measureReach(speed: number, hover: boolean): { distance: number; apex: number } {
  const floorY = WORLD.groundY;
  const floor: Solid[] = [{ x: -10_000, y: floorY, w: 10_000, h: 200, oneWay: false, kind: 'ground' }];
  const pc = new PlayerController(-1, floorY, baseStats());
  pc.speed = speed;
  const dt = TUNING.maxStep;
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

export function reachAt(speed: number): Reach {
  const j = measureReach(speed, false);
  const h = measureReach(speed, true);
  // The long body adds its own length of forgiveness (rear leaves late, nose lands early).
  return { jumpGap: j.distance + HERO_BOX.body.width, hoverGap: h.distance + HERO_BOX.body.width, apex: j.apex };
}

export interface ValidationIssue {
  chunk: string;
  message: string;
}

/** Safety margins: authored challenges may use at most this fraction of measured reach. */
const MARGIN = 0.85;

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
  const canBark = c.requires.includes('bark');

  for (const [x, w] of c.gaps ?? []) {
    const limit = (canHover ? slow.hoverGap : slow.jumpGap) * MARGIN;
    if (w > limit) add(`gap at ${x} (${w}px) exceeds safe reach ${limit.toFixed(0)}px at ${minSpeed}px/s`);
    if (!canHover && w > slow.jumpGap * MARGIN) add(`gap at ${x} needs hover but chunk does not declare it`);
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
    if (top - before > apex * MARGIN) add(`crate column at ${x} (${top}px) cannot be climbed`);
  }

  for (const cb of c.cardboard ?? []) {
    const top = (cb.h ?? 0) + cb.stack * OBJECT_SIZE.cardboard.h;
    if (top > apex * MARGIN && !canBark) add(`cardboard wall at ${cb.x} needs bark but chunk does not declare it`);
  }

  for (const p of c.platforms ?? []) {
    if (p.h > apex * 2) add(`platform at ${p.x} is very high (${p.h}px)`);
  }

  // Readable spacing: hazards on the main route need room to land between them.
  const hazards = [
    ...(c.tyres ?? []).filter((t) => !t.h).map((t) => ({ x: t.x, w: OBJECT_SIZE.tyre.w })),
    ...(c.cardboard ?? []).filter((b) => !b.h).map((b) => ({ x: b.x, w: OBJECT_SIZE.cardboard.w })),
    ...(c.gaps ?? []).map(([x, w]) => ({ x, w })),
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
  const rechargeDistance = (TUNING.wagCapacity / TUNING.groundRecharge) * speedEnd;
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
    }
    cursor += c.length;
  }
  return issues;
}
