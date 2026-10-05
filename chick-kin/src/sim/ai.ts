// Sibling AI. Uses only the player's input vocabulary and the same movement rules: no teleporting,
// no hidden speed boosts, no taking banked score. Skill only changes reaction time, mistakes and route choice.
import type { Actor, ActorInput } from './actor';
import type { ArenaRuntime, Ent } from './arena';
import type { Match } from './match';
import type { RouteDef, RouteNode } from './types';
import { NavGrid, C } from './nav';
import { makeRng, type Rng } from './math';
import { hitsAny, jumpVelocity, flapVelocity } from './physicsSide';
import { hopVelocity } from './physicsTop';
import { CLASS_INFO } from '../data/classes';

export type PersonalityId = 'bossy' | 'scrappy' | 'snacky';
export interface Personality { id: PersonalityId; label: string; contest: number; distract: number; bumpy: number }
export const PERSONALITIES: Record<PersonalityId, Personality> = {
  bossy: { id: 'bossy', label: 'Bossy & confident', contest: 0.8, distract: 0.05, bumpy: 0.7 },
  scrappy: { id: 'scrappy', label: 'Scrappy & competitive', contest: 1.0, distract: 0.1, bumpy: 0.5 },
  snacky: { id: 'snacky', label: 'Snack-loving & distractible', contest: 0.4, distract: 0.45, bumpy: 0.2 },
};

export interface Skill { reaction: number; mistakes: number; routeSmart: number; abilityUse: number }
/** Bounded skill curve: difficulty and generation only sharpen decisions, never physics. */
export function skillFor(difficulty: 'relaxed' | 'standard' | 'expert', generation: number, isAutopilot = false): Skill {
  if (isAutopilot) return { reaction: 0.05, mistakes: 0, routeSmart: 0, abilityUse: 0.6 };
  const g = Math.min(4, Math.max(1, generation)) - 1;
  const base = difficulty === 'relaxed' ? 0 : difficulty === 'standard' ? 1 : 2;
  const lvl = Math.min(4, base + g * 0.5);
  return {
    reaction: 0.32 - lvl * 0.05,
    mistakes: [0.22, 0.12, 0.07, 0.04, 0.025][Math.round(lvl)],
    routeSmart: [0.2, 0.45, 0.65, 0.8, 0.9][Math.round(lvl)],
    abilityUse: [0.25, 0.5, 0.7, 0.85, 0.95][Math.round(lvl)],
  };
}

const grids = new WeakMap<ArenaRuntime, Map<string, NavGrid>>();
function gridFor(ar: ArenaRuntime, radius: number, hopClear: number, push = 0) {
  let m = grids.get(ar);
  if (!m) { m = new Map(); grids.set(ar, m); }
  const key = `${radius.toFixed(2)}:${hopClear.toFixed(2)}:${push.toFixed(2)}`;
  let g = m.get(key);
  if (!g) { g = new NavGrid(ar, radius, hopClear, push); m.set(key, g); }
  g.refresh();
  return g;
}

export interface Intent { x: number; y: number; kind: string }

export class SiblingAI {
  readonly rng: Rng;
  intent: Intent | null = null;
  private out: ActorInput = { mx: 0, my: 0, jump: false, interact: false, ability: false, duck: false };
  private thinkT = 0;
  private hesitateT = 0;
  // side state
  private route: RouteDef | null = null;
  private node = 0;
  private routeArena: ArenaRuntime | null = null;
  private jumpHoldT = 0;
  private flapCd = 0;
  private waitT = 0;
  private lastPos = { x: 0, y: 0, t: 0 };
  private stuckT = 0;
  private peckCd = 0;
  // top state
  private path: [number, number][] | null = null;
  private pathT = 0;
  private target: { x: number; y: number; kind: string; ent?: Ent; looseId?: number } | null = null;
  private snackT = 0;
  private perchWaitT = 0;
  private seenRespawns = 0;
  private perchAngle = 0;

  constructor(readonly actorId: number, readonly personality: Personality, readonly skill: Skill, seed: number) {
    this.rng = makeRng(seed);
  }

  think(m: Match, dt: number): ActorInput {
    const a = m.actors[this.actorId];
    const ar = m.arenaOf(a);
    if (m.state !== 'play') {
      this.out = { mx: 0, my: 0, jump: false, interact: false, ability: false, duck: false };
      this.route = null;
      return this.out;
    }
    if (a.finished) return this.celebrate(m, a, ar);
    this.thinkT -= dt;
    this.flapCd -= dt;
    this.peckCd -= dt;
    if (this.hesitateT > 0) {
      this.hesitateT -= dt;
      return { ...this.out, mx: this.out.mx * 0.3, my: this.out.my * 0.3, ability: false };
    }
    if (this.thinkT <= 0) {
      this.thinkT = this.skill.reaction * (0.6 + this.rng.next() * 0.8);
      // Bounded, visible mistakes: a short hesitation, never a teleport or speed change.
      if (this.rng.chance(this.skill.mistakes * 0.35)) this.hesitateT = 0.15 + this.rng.next() * 0.25;
    }
    return ar.mode === 'side' ? this.thinkSide(m, a, ar, dt) : this.thinkTop(m, a, ar, dt);
  }

  /** Finished siblings step off contested goals (perches) and cheer; they never block an objective. */
  private celebrate(m: Match, a: Actor, ar: ArenaRuntime): ActorInput {
    const out: ActorInput = { mx: 0, my: 0, jump: false, interact: false, ability: false, duck: false };
    const perch = ar.ents.find((e) => e.t === 'perch');
    if (perch) {
      const cx = perch.x + perch.w / 2, cy = perch.y + perch.h / 2;
      const inside = a.x > perch.x - 1.2 && a.x < perch.x + perch.w + 1.2 && (ar.mode === 'side' ? a.y > perch.y - 0.6 && a.y < perch.y + perch.h + 0.6 : a.y > perch.y - 1.2 && a.y < perch.y + perch.h + 1.2);
      if (inside) {
        if (ar.mode === 'side') { out.mx = a.x < cx ? -1 : 1; }
        else { const dx = a.x - cx, dy = a.y - cy, d = Math.hypot(dx, dy) || 1; out.mx = dx / d; out.my = dy / d; }
      }
    }
    void m;
    return out;
  }

  // ===================================================================== SIDE
  private pickRoute(m: Match, a: Actor, ar: ArenaRuntime) {
    const routes = ar.def.routes ?? [];
    const common = routes.find((r) => r.color === 'common') ?? routes[0];
    const mine = routes.find((r) => r.color === CLASS_INFO[a.cls].route);
    let r = common;
    if (mine && this.rng.next() < (a.isPlayer ? 0 : 0.35 + this.skill.routeSmart * 0.6)) r = mine;
    this.route = r ?? null;
    this.routeArena = ar;
    this.node = 0;
    void m;
    this.resync(a);
  }

  /** After a respawn, fall or phase change, continue from the most advanced node we can actually reach. */
  private resync(a: Actor) {
    if (!this.route) return;
    const reach = a.g.side.jumpHeight * a.tuning.jump + (a.g.canFlap ? 0.8 : 0);
    let best = -1, bestD = Infinity;
    this.route.nodes.forEach((n, i) => {
      const dy = n.y - a.y;
      if (dy > reach || dy < -3) return;
      const d = Math.abs(n.x - a.x) + Math.max(0, dy) * 1.5 + Math.max(0, -dy) * 0.5;
      if (d < bestD - 0.5 || (d < bestD + 0.5 && i > best)) { bestD = Math.min(d, bestD); best = i; }
    });
    this.node = best >= 0 ? best : 0;
  }

  private thinkSide(m: Match, a: Actor, ar: ArenaRuntime, dt: number): ActorInput {
    if (!this.route || this.routeArena !== ar) this.pickRoute(m, a, ar);
    const out: ActorInput = { mx: 0, my: 0, jump: false, interact: false, ability: false, duck: false };
    const route = this.route;
    if (!route) return out;
    const nodes = route.nodes;
    if (a.respawns !== this.seenRespawns) { this.seenRespawns = a.respawns; this.node = 0; this.resync(a); }

    // advance through reached nodes
    for (let guard = 0; guard < 3 && this.node < nodes.length; guard++) {
      const n = nodes[this.node];
      const near = Math.abs(n.x - a.x) < 0.35 && a.y > n.y - 0.3 && a.y < n.y + 1.2;
      // Overshoot: already closer to the following node than this one is, at a similar height.
      const nn = nodes[this.node + 1];
      const pn = nodes[this.node - 1];
      const monotonic = !pn || Math.sign(n.x - pn.x) === Math.sign(nn ? nn.x - n.x : 0);
      const passed = nn && !n.a && monotonic && a.grounded && Math.abs(a.y - n.y) < 0.4 && Math.abs(nn.y - n.y) < 0.4
        && Math.hypot(nn.x - a.x, nn.y - a.y) < Math.hypot(nn.x - n.x, nn.y - n.y);
      if ((near && (a.grounded || this.node === nodes.length - 1 || n.a === 'glide')) || passed) this.node++;
      else break;
    }
    if (this.node >= nodes.length && a.grounded && a.y < nodes[nodes.length - 1].y - 0.8) this.resync(a); // knocked off: climb back
    if (this.node >= nodes.length) {
      // goal: stand in the finish / perch zone; contest it
      const last = nodes[nodes.length - 1];
      out.mx = Math.abs(last.x - a.x) > 0.2 ? Math.sign(last.x - a.x) : 0;
      this.perchContestSide(m, a, out);
      this.out = out;
      return out;
    }
    let n = nodes[this.node];
    if (a.grounded && n.y - a.y > a.g.side.jumpHeight * a.tuning.jump + (a.g.canFlap ? Math.floor(a.staminaMax) * 0.9 : 0) + 0.3) {
      this.resync(a);
      n = nodes[Math.min(this.node, nodes.length - 1)];
    }
    const prev: RouteNode | undefined = nodes[this.node - 1];
    this.intent = { x: n.x, y: n.y, kind: 'route' };
    const dx = n.x - a.x;
    const dir = Math.abs(dx) > 0.12 ? Math.sign(dx) : 0;
    out.mx = dir;

    const act = prev?.a;
    // standing on a plank above the next node: drop through (duck + jump)
    if (a.grounded && a.onOneWay && n.y < a.y - 0.8 && Math.abs(dx) < 1.2) {
      out.duck = true;
      if (!this.out.jump) out.jump = true;
      out.mx = 0;
      this.out = out;
      return out;
    }
    // ---- wait for a moving platform / bucket phase
    if (act === 'wait' && prev?.wait && a.grounded && Math.abs(prev.x - a.x) < 0.6) {
      const e = ar.ents[prev.wait.e];
      const ph = e ? e.phase : 0;
      const ok = prev.wait.lo <= prev.wait.hi ? ph >= prev.wait.lo && ph <= prev.wait.hi : ph >= prev.wait.lo || ph <= prev.wait.hi;
      if (!ok) {
        this.waitT += dt;
        out.mx = Math.abs(prev.x - a.x) > 0.15 ? Math.sign(prev.x - a.x) * 0.6 : 0;
        this.out = out;
        return out;
      }
      this.waitT = 0;
      out.jump = true; this.jumpHoldT = 0.5;
    }

    // ---- duck under low fences
    const ahead = { x: a.x + (dir || a.facing) * (a.w / 2) - (dir < 0 ? 0.5 : 0), y: a.y + a.g.side.duckH + 0.05, w: 0.5, h: a.h - a.g.side.duckH - 0.08 };
    const lowAhead = a.grounded && hitsAny(ahead, ar.solids.filter((s) => s.lowFence)) && !hitsAny({ ...ahead, y: a.y + 0.05, h: a.g.side.duckH - 0.1 }, ar.solids);
    if (act === 'duck' || lowAhead || (a.ducking && hitsAny({ x: a.x - a.w / 2, y: a.y + 0.05, w: a.w, h: a.h }, ar.solids.filter((s) => s.lowFence)))) out.duck = true;

    // ---- straw barrier ahead: peck (Mighty may Fluff Bump through)
    const strawAhead = ar.ents.find((e) => e.alive && e.t === 'straw' && Math.abs(e.y - a.y) < 1 && (dir >= 0 ? e.x - (a.x + a.w / 2) : a.x - a.w / 2 - (e.x + e.w)) < 0.4 && (dir >= 0 ? e.x + e.w > a.x : e.x < a.x));
    if (strawAhead && a.grounded) {
      if (a.cls === 'mighty' && a.abilityCd <= 0 && this.rng.next() < this.skill.abilityUse + 0.3) out.ability = true;
      else if (this.peckCd <= 0) { out.interact = true; this.peckCd = 0.2; }
      out.mx = dir * 0.2;
      this.out = out;
      return out;
    }

    // ---- jumping
    const need = n.y - a.y;
    const solidsNoFence = ar.blockers().filter((s) => !(s as { oneWay?: boolean }).oneWay);
    const wallAhead = a.grounded && dir !== 0 && hitsAny({ x: a.x + dir * (a.w / 2 + 0.05) - (dir < 0 ? 0.25 : 0), y: a.y + 0.15, w: 0.25, h: Math.max(0.2, a.colH - 0.3) }, solidsNoFence)
      && !lowAhead && !strawAhead;
    const pushable = ar.ents.find((e) => e.alive && (e.t === 'bale' || e.t === 'crate') && Math.abs(e.y - a.y) < 0.3 && (dir > 0 ? Math.abs(e.x - (a.x + a.w / 2)) < 0.15 : Math.abs(a.x - a.w / 2 - (e.x + e.w)) < 0.15));
    const canPush = pushable && a.pushForce >= ((pushable.def as { mass?: number }).mass ?? (pushable.t === 'bale' ? 1 : 0.5)) && act === 'push';
    const groundAheadY = this.groundBelow(ar, a.x + dir * (a.w / 2 + 0.35), a.y + 0.3);
    const gapAhead = a.grounded && dir !== 0 && (groundAheadY === null || groundAheadY < a.y - 0.6) && need > -1.6 && Math.abs(dx) > 0.5;
    const jumpAct = (act === 'jump' && a.grounded && Math.abs((prev?.x ?? a.x) - a.x) < 0.5);
    const higher = need > 0.45 && a.grounded && Math.abs(dx) < this.jumpReach(a, need);
    if (a.grounded && !canPush && (jumpAct || higher || gapAhead || (wallAhead && !pushable) || (wallAhead && pushable && !canPush))) {
      out.jump = true;
      this.jumpHoldT = need > 0.3 || gapAhead ? 0.45 : 0.18;
    }
    if (pushable && !canPush && a.grounded) { out.jump = true; this.jumpHoldT = 0.45; }
    if (!a.grounded) {
      this.jumpHoldT -= dt;
      if (this.jumpHoldT > 0 && a.vy > 0) out.jump = true;
      // flap if falling short of the target
      if (a.g.canFlap && a.vy < 0.5 && a.y < n.y + 0.25 && this.flapCd <= 0 && a.stamina >= 1 && (need > -0.2 || Math.abs(dx) > 1.0)) {
        if (!this.out.jump) { out.jump = true; this.flapCd = 0.28; } // edge-triggered flap
      } else if (a.g.canGlide && a.vy < 0 && (a.y > n.y + 0.2 || Math.abs(dx) > 1.2) && a.stamina > 0.2 && this.flapCd < 0.1) {
        out.jump = true; // glide (held)
        if (!this.out.jump) out.jump = false; // need a fresh hold after release (prevents accidental flap)
      }
      // Nimble air hop / Speedy launch when short
      if (a.vy < 0 && a.y < n.y - 0.2 && a.abilityCd <= 0 && (a.cls === 'nimble' || (a.cls === 'speedy' && a.stage >= 3)) && this.rng.next() < this.skill.abilityUse) out.ability = true;
    }

    // ---- abilities on the flat
    if (a.grounded && a.abilityCd <= 0 && !out.jump) {
      if (a.cls === 'speedy' && Math.abs(dx) > 4 && Math.abs(need) < 0.4 && !gapAhead && groundAheadY !== null && this.rng.next() < this.skill.abilityUse * 0.08) out.ability = true;
      if (a.cls === 'mighty' && this.rng.next() < this.personality.bumpy * this.skill.abilityUse * 0.2) {
        const victim = m.actors.find((o) => o !== a && m.arenaOf(o) === ar && Math.abs(o.y - a.y) < 0.5 && (o.x - a.x) * a.facing > 0 && Math.abs(o.x - a.x) < 1.1);
        if (victim) out.ability = true;
      }
      if (canPush && a.cls === 'mighty' && this.rng.next() < 0.05) out.ability = true;
    }

    // ---- rolling eggs: hop them
    for (const e of ar.ents) {
      if (e.t !== 'egg' || !e.active || !a.grounded) continue;
      const ex = e.x + e.w / 2;
      const closing = (ex - a.x) * (e.vx - a.vx) < 0;
      if (closing && Math.abs(ex - a.x) < 1.3 && Math.abs(e.y - a.y) < 0.6) { out.jump = true; this.jumpHoldT = 0.3; }
    }

    // jump is edge-triggered: a grounded chick that still holds jump must release it for a frame
    if (a.grounded && out.jump && this.out.jump) out.jump = false;
    // ---- stuck recovery
    if (m.t - this.lastPos.t > 1.2) {
      const moved = Math.hypot(a.x - this.lastPos.x, a.y - this.lastPos.y);
      this.stuckT = moved < 0.25 && !(act === 'wait') ? this.stuckT + 1 : 0;
      this.lastPos = { x: a.x, y: a.y, t: m.t };
      if (this.stuckT >= 2) { this.resync(a); this.stuckT = 0; if (a.grounded) { out.jump = true; this.jumpHoldT = 0.45; } }
    }
    this.out = out;
    return out;
  }

  /** Horizontal distance at which to take off for a target `need` metres higher. */
  private jumpReach(a: Actor, need: number) {
    const v = jumpVelocity(a);
    const g = a.g.side.gravity;
    const tUp = v / g;
    const hMax = v * v / (2 * g);
    if (need > hMax + (a.g.canFlap ? 0.9 * Math.floor(a.stamina) : 0)) return 0.6;
    const speed = a.g.side.run * a.tuning.run;
    return Math.max(0.6, speed * tUp * 0.9);
  }

  private groundBelow(ar: ArenaRuntime, x: number, y: number): number | null {
    let best: number | null = null;
    const consider = (top: number, x0: number, w: number) => {
      if (x < x0 || x > x0 + w || top > y + 0.01) return;
      if (best === null || top > best) best = top;
    };
    for (const s of ar.solids) consider(s.y + s.h, s.x, s.w);
    for (const e of ar.ents) {
      if (!e.alive) continue;
      if (e.t === 'mover' || e.t === 'wobbly' || e.t === 'spring' || e.t === 'bale' || e.t === 'crate' || e.t === 'straw' || (e.t === 'bucket' && (e.def as { ride?: boolean }).ride)) consider(e.y + e.h, e.x, e.w);
    }
    return best;
  }

  private perchContestSide(m: Match, a: Actor, out: ActorInput) {
    const ar = m.arenaOf(a);
    const perch = ar.ents.find((e) => e.t === 'perch');
    if (!perch) return;
    const cx = perch.x + perch.w / 2;
    // crowded stand-off: less pushy siblings step back along the beam and wait for a lone owner
    const crowd = m.actors.filter((o) => o !== a && !o.finished && m.arenaOf(o) === ar && Math.abs(o.x - cx) < perch.w && Math.abs(o.y - a.y) < 1).length;
    if (this.perchWaitT > 0) {
      this.perchWaitT -= 1 / 120;
      const tx = cx + this.perchAngle * 2.6;
      out.mx = Math.abs(tx - a.x) > 0.25 ? Math.sign(tx - a.x) : 0;
      if (out.mx === 0) a.facing = cx > a.x ? 1 : -1;
      return;
    }
    if (crowd >= 2 && this.rng.chance((1 - this.personality.contest * 0.6) * 0.03)) {
      this.perchWaitT = 2 + this.rng.next() * 2;
      this.perchAngle = a.x < cx ? -1 : 1;
      return;
    }
    out.mx = Math.abs(cx - a.x) > 0.3 ? Math.sign(cx - a.x) : 0;
    const rival = m.actors.find((o) => o !== a && !o.finished && m.arenaOf(o) === ar && Math.abs(o.x - a.x) < 1.2 && Math.abs(o.y - a.y) < 0.5);
    if (rival && a.nudgeCd <= 0 && !this.out.interact && this.rng.chance(0.08 + this.personality.contest * 0.1)) { a.facing = Math.sign(rival.x - a.x) || 1; out.mx = Math.sign(rival.x - a.x) * 0.2; out.interact = true; }
    if (rival && a.abilityCd <= 0 && this.rng.next() < this.personality.contest * this.skill.abilityUse * 0.1) {
      a.facing = Math.sign(rival.x - a.x) || 1;
      out.mx = Math.sign(rival.x - a.x) * 0.3;
      out.ability = true;
    }
    if (rival && a.g.canBrace && this.rng.next() < 0.5) out.duck = true;
  }

  // ===================================================================== TOP-DOWN
  private thinkTop(m: Match, a: Actor, ar: ArenaRuntime, dt: number): ActorInput {
    const out: ActorInput = { mx: 0, my: 0, jump: false, interact: false, ability: false, duck: false };
    const obj = m.phaseOf(a).objective;
    this.pathT -= dt;
    if (this.snackT > 0) { this.snackT -= dt; this.out = out; return out; }

    // keep holding an interaction in progress
    if (a.interactTarget >= 0) {
      const e = ar.ents[a.interactTarget];
      out.interact = true;
      if (e?.t === 'tugworm') { const dx = a.x - e.x, dy = a.y - e.y; const d = Math.hypot(dx, dy) || 1; out.mx = dx / d; out.my = dy / d; }
      this.out = out;
      return out;
    }

    const tgt = this.chooseTarget(m, a, ar, obj);
    this.target = tgt;
    if (!tgt) { this.out = out; return out; }
    this.intent = { x: tgt.x, y: tgt.y, kind: tgt.kind };

    // arrived?
    const d = Math.hypot(tgt.x - a.x, tgt.y - a.y);
    const arriveR = tgt.kind === 'perch' ? 0.3 : tgt.kind === 'basket' ? ((tgt.ent?.def as { r?: number })?.r ?? 0.8) + a.r * 0.5 : tgt.kind === 'cornpile' ? a.r + 0.7 : tgt.kind === 'scratch' || tgt.kind === 'tugworm' ? a.r + 0.55 : 0.2;
    if (d < arriveR) {
      if (tgt.kind === 'basket' || tgt.kind === 'cornpile' || tgt.kind === 'scratch' || tgt.kind === 'tugworm') {
        if (!this.out.interact) out.interact = true;
      }
      if (tgt.kind === 'perch') this.perchContestTop(m, a, ar, out);
      this.out = out;
      return out;
    }

    const g = gridFor(ar, a.r + 0.06, a.g.top.hopHeight * a.tuning.jump * (a.g.canVault ? 1 : 0.85), a.pushForce);
    if (!this.path || this.pathT <= 0) {
      this.path = g.path(a.x, a.y, tgt.x, tgt.y, { hop: true, gate: true, straw: true });
      this.pathT = 0.4;
    }
    let mx = tgt.x - a.x, my = tgt.y - a.y;
    if (this.path && this.path.length > 1) {
      // furthest visible waypoint (cheap line-of-sight on the grid)
      let pick = 1;
      for (let i = Math.min(this.path.length - 1, 8); i >= 1; i--) {
        if (this.clearLine(g, a.x, a.y, this.path[i][0], this.path[i][1])) { pick = i; break; }
      }
      const [px, py] = this.path[pick];
      mx = px - a.x; my = py - a.y;
      if (Math.hypot(mx, my) < 0.15 && this.path.length > 2) this.path.shift();
      // obstacles on the next cells: hop low fences, open gates, peck straw
      const lx = a.x + Math.sign(mx) * Math.min(Math.abs(mx), a.r + 0.4), ly = a.y + Math.sign(my) * Math.min(Math.abs(my), a.r + 0.4);
      const c = g.at(lx, ly);
      if (c === C.Hop && a.z <= 0.01) out.jump = true;
      if (c === C.Gate || c === C.Straw) {
        if (!this.out.interact) out.interact = true;
      }
    }
    const L = Math.hypot(mx, my) || 1;
    out.mx = mx / L; out.my = my / L;

    // eggs: hop when one is about to hit
    for (const e of ar.ents) {
      if (e.t !== 'egg' || !e.active) continue;
      const r = (e.def as { r?: number }).r ?? 0.35;
      const ex = e.x + r, ey = e.y + r;
      const fx = ex + e.vx * 0.25, fy = ey + e.vy * 0.25;
      if (Math.hypot(fx - a.x, fy - a.y) < a.r + r + 0.35 && a.z <= 0.01) out.jump = true;
    }
    // abilities
    if (a.abilityCd <= 0 && this.rng.next() < this.skill.abilityUse * 0.05) {
      if (a.cls === 'speedy' && d > 4 && this.path && this.clearLine(g, a.x, a.y, tgt.x, tgt.y)) out.ability = true;
      if (a.cls === 'mighty') {
        const victim = m.actors.find((o) => o !== a && m.arenaOf(o) === ar && Math.hypot(o.x - a.x, o.y - a.y) < 1.2 && (o.carryTreats > 0 || o.carryBundle || tgt.kind === 'perch'));
        if (victim && this.rng.next() < this.personality.bumpy) { a.heading = Math.atan2(victim.y - a.y, victim.x - a.x); out.mx = Math.cos(a.heading); out.my = Math.sin(a.heading); out.ability = true; }
      }
    }
    if (a.cls === 'nimble' && a.abilityCd <= 0) {
      const threat = m.actors.find((o) => o !== a && o.cls === 'mighty' && o.abilityT > 0 && Math.hypot(o.x - a.x, o.y - a.y) < 1.6);
      if (threat && this.rng.next() < this.skill.abilityUse) out.ability = true;
    }
    // stuck recovery
    if (m.t - this.lastPos.t > 1.0) {
      const moved = Math.hypot(a.x - this.lastPos.x, a.y - this.lastPos.y);
      this.stuckT = moved < 0.2 ? this.stuckT + 1 : 0;
      this.lastPos = { x: a.x, y: a.y, t: m.t };
      if (this.stuckT >= 2) { this.path = null; out.jump = true; out.mx += this.rng.range(-1, 1); out.my += this.rng.range(-1, 1); this.stuckT = 0; }
    }
    void hopVelocity; void flapVelocity;
    this.out = out;
    return out;
  }

  private clearLine(g: NavGrid, x0: number, y0: number, x1: number, y1: number) {
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.2);
    for (let i = 1; i <= steps; i++) {
      const c = g.at(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
      if (c !== C.Free) return false;
    }
    return true;
  }

  private chooseTarget(m: Match, a: Actor, ar: ArenaRuntime, obj: ReturnType<Match['phaseOf']>['objective']) {
    const dist = (x: number, y: number) => Math.hypot(x - a.x, y - a.y);
    const others = m.actors.filter((o) => o !== a && m.arenaOf(o) === ar);
    // keep the current target for a moment for stability
    const keep = this.target;
    const stillValid = (t: typeof keep) => {
      if (!t) return false;
      if (t.ent) return t.ent.alive && (t.kind !== 'cornpile' || t.ent.count > 0);
      if (t.looseId !== undefined) return ar.loose.some((l) => l.id === t.looseId && l.alive);
      return true;
    };
    // snack-loving detours toward nearby powers / crumbs; occasionally stops to nibble
    if (this.personality.distract > 0 && this.rng.chance(this.personality.distract * 0.004)) this.snackT = 0.5;
    const power = ar.ents.find((e) => e.t === 'power' && e.alive && dist(e.x, e.y) < 2.5 + this.personality.distract * 4);
    if (power && this.rng.chance(0.5 + this.personality.distract)) return { x: power.x, y: power.y, kind: 'power', ent: power };

    const crumbTarget = () => {
      let best: { x: number; y: number; kind: string; ent?: Ent; looseId?: number } | null = null, bs = Infinity;
      for (const e of ar.ents) {
        if (e.t !== 'crumb' || !e.alive) continue;
        // prefer crumbs others aren't closer to (scrappy contests anyway)
        const mine = dist(e.x, e.y);
        const theirs = Math.min(...others.map((o) => Math.hypot(e.x - o.x, e.y - o.y)), 99);
        const s = mine + (theirs < mine ? (1 - this.personality.contest) * 3 : 0) + this.rng.next() * 0.4;
        if (s < bs) { bs = s; best = { x: e.x, y: e.y, kind: 'crumb', ent: e }; }
      }
      for (const l of ar.loose) {
        if (!l.alive || l.kind !== 'crumb') continue;
        const s = dist(l.x, l.y);
        if (s < bs) { bs = s; best = { x: l.x, y: l.y, kind: 'loose', looseId: l.id }; }
      }
      return best;
    };

    switch (obj.kind) {
      case 'collect': {
        if (stillValid(keep) && keep!.kind === 'crumb' && this.rng.next() > 0.03) return keep;
        return crumbTarget();
      }
      case 'tug': {
        let best: Ent | null = null, bs = Infinity;
        for (const e of ar.ents) if (e.t === 'tugworm' && e.alive) { const s = dist(e.x, e.y) + others.filter((o) => o.interactTarget === e.i).length * 2.5; if (s < bs) { bs = s; best = e; } }
        if (!best) {
          // wait near the next respawning worm
          const w = ar.ents.filter((e) => e.t === 'tugworm').sort((p, q) => dist(p.x, p.y) - dist(q.x, q.y))[0];
          return w ? { x: w.x + 1.2, y: w.y, kind: 'wait' } : null;
        }
        return { x: best.x, y: best.y, kind: 'tugworm', ent: best };
      }
      case 'perch': case 'reach': case 'race': {
        const p = ar.ents.find((e) => e.t === 'perch' || e.t === 'finish');
        if (!p) return null;
        const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
        if (obj.kind === 'perch') {
          // King-of-the-hill tactics: in a crowded stand-off, less pushy siblings back off and circle,
          // then return when the perch has a lone owner to knock off.
          const occupants = others.filter((o) => !o.finished && Math.hypot(o.x - cx, o.y - cy) < 1.6).length;
          if (this.perchWaitT > 0) {
            this.perchWaitT -= 1 / 120;
            const rr = 3.4;
            this.perchAngle += 0.004;
            return { x: cx + Math.cos(this.perchAngle) * rr, y: cy + Math.sin(this.perchAngle) * rr, kind: 'wait' };
          }
          if (occupants >= 2 && this.rng.chance((1 - this.personality.contest * 0.6) * 0.03)) {
            this.perchWaitT = 2 + this.rng.next() * 2.5;
            this.perchAngle = Math.atan2(a.y - cy, a.x - cx);
          }
        }
        return { x: cx + (this.actorId - 1.5) * 0.15, y: cy, kind: 'perch', ent: p };
      }
      case 'deliver': case 'mostDeliveries': {
        const bundle = obj.kind === 'deliver' && obj.cargo === 'bundle';
        const basket = ar.ents.filter((e) => e.t === 'basket' && (e.owner < 0 || e.owner === a.id)).sort((p, q) => dist(p.x, p.y) - dist(q.x, q.y))[0];
        if (!basket) return null;
        const need = obj.kind === 'deliver' ? obj.count - a.st.delivered : 99;
        const carrying = bundle ? (a.carryBundle ? 1 : 0) : a.carryTreats;
        if (carrying > 0 && (bundle || carrying >= Math.min(3, need) || (carrying > 0 && !this.anyTreatSource(ar)))) return { x: basket.x, y: basket.y, kind: 'basket', ent: basket };
        if (bundle) {
          const loose = ar.loose.filter((l) => l.alive && l.kind === 'bundle').sort((p, q) => dist(p.x, p.y) - dist(q.x, q.y))[0];
          const piles = ar.ents.filter((e) => e.t === 'cornpile' && e.count > 0).sort((p, q) => dist(p.x, p.y) - dist(q.x, q.y));
          if (loose && (!piles[0] || dist(loose.x, loose.y) < dist(piles[0].x, piles[0].y))) return { x: loose.x, y: loose.y, kind: 'loose', looseId: loose.id };
          if (piles[0]) return { x: piles[0].x, y: piles[0].y, kind: 'cornpile', ent: piles[0] };
          return { x: basket.x, y: basket.y + 2, kind: 'wait' };
        }
        // loose treats first (dropped or scratched)
        const loose = ar.loose.filter((l) => l.alive && l.kind === 'treat').sort((p, q) => dist(p.x, p.y) - dist(q.x, q.y))[0];
        if (loose && dist(loose.x, loose.y) < 6) return { x: loose.x, y: loose.y, kind: 'loose', looseId: loose.id };
        if (stillValid(keep) && keep!.kind === 'scratch') return keep;
        let best: Ent | null = null, bs = Infinity;
        for (const e of ar.ents) {
          if (e.t !== 'scratch' || !e.alive) continue;
          const busy = others.some((o) => o.interactTarget === e.i);
          const s = dist(e.x, e.y) + (busy ? 4 : 0) + this.rng.next() * 0.5;
          if (s < bs) { bs = s; best = e; }
        }
        if (best) return { x: best.x, y: best.y, kind: 'scratch', ent: best };
        if (loose) return { x: loose.x, y: loose.y, kind: 'loose', looseId: loose.id };
        if (carrying > 0) return { x: basket.x, y: basket.y, kind: 'basket', ent: basket };
        const anyPatch = ar.ents.find((e) => e.t === 'scratch');
        return anyPatch ? { x: anyPatch.x + 0.9, y: anyPatch.y + 0.9, kind: 'wait' } : null;
      }
    }
    return null;
  }

  private anyTreatSource(ar: ArenaRuntime) {
    return ar.ents.some((e) => e.t === 'scratch' && e.alive) || ar.loose.some((l) => l.alive && l.kind === 'treat');
  }

  private perchContestTop(m: Match, a: Actor, ar: ArenaRuntime, out: ActorInput) {
    const rival = m.actors.find((o) => o !== a && !o.finished && m.arenaOf(o) === ar && Math.hypot(o.x - a.x, o.y - a.y) < 1.1);
    if (!rival) return;
    // peck-nudge the neighbour off the perch (everyone can)
    if (a.nudgeCd <= 0 && !this.out.interact && this.rng.chance(0.08 + this.personality.contest * 0.1)) out.interact = true;
    if (a.abilityCd <= 0 && this.rng.next() < this.personality.contest * this.skill.abilityUse * 0.08 && a.cls === 'mighty') {
      a.heading = Math.atan2(rival.y - a.y, rival.x - a.x);
      out.ability = true;
    } else if (this.rng.next() < this.personality.contest * 0.3) {
      // shoulder toward the rival to nudge them off
      const dx = rival.x - a.x, dy = rival.y - a.y, d = Math.hypot(dx, dy) || 1;
      out.mx = dx / d * 0.6; out.my = dy / d * 0.6;
    }
    if (a.g.canBrace && this.rng.next() < 0.4) out.duck = true;
  }
}
