// Match orchestration: countdown, phases (single / relay / showdown rounds), interactions, objectives, results.
import { Actor, NO_INPUT, type ActorInput, type Perk } from './actor';
import { ArenaRuntime, type Ent } from './arena';
import { EventLog } from './events';
import { stepSide, stepPushablesSide, peckSide } from './physicsSide';
import { stepTop, stepPushablesTop, topBlockers } from './physicsTop';
import { applyPower, tickTimers, type RuleCtx } from './rules';
import type { LevelDef, ObjectiveDef, PhaseDef, ArenaDef } from './types';
import type { ChickClass } from '../data/classes';
import type { Stage } from '../data/growth';
import { POWERS, POWER_TUNING } from '../data/items';
import { rectOverlap, pointInRect, makeRng } from './math';

export type Difficulty = 'relaxed' | 'standard' | 'expert';
export interface CompetitorSpec { cls: ChickClass; name: string; isPlayer: boolean; perk?: Perk | null }

export interface MatchOptions {
  level: LevelDef;
  stage: Stage;
  competitors: CompetitorSpec[];
  seed: number;
  difficulty: Difficulty;
  generation: number;
  /** Hazard tempo multiplier from generation variants (capped at 1.2). */
  hazardSpeed?: number;
  /** Skip the countdown (tests / debug). */
  noCountdown?: boolean;
}

export interface MatchResult {
  success: boolean;
  placement: number;           // player's placement 1..4
  order: number[];             // actor ids by rank
  time: number;                // player's completion time (or match time)
  points?: number[];           // showdown totals by actor id
  medals: { complete: boolean; first: boolean; time: boolean; feathers: boolean };
  reason: string;
}

export const SHOWDOWN_POINTS = [5, 3, 2, 1];
const ROUND_GRACE = 10;      // seconds after the first finisher before a race round closes
const ROUND_CAP = 120;
const ROUND_PAUSE = 3.2;

export class Match {
  readonly level: LevelDef;
  readonly opts: MatchOptions;
  readonly actors: Actor[];
  readonly ev = new EventLog();
  arenas: ArenaRuntime[] = [];
  state: 'countdown' | 'play' | 'roundEnd' | 'done' = 'countdown';
  countdown = 3;
  t = 0;            // play time (current level)
  roundT = 0;       // time in current showdown round
  round = 0;
  points = [0, 0, 0, 0];
  roundOrders: number[][] = [];
  tiebreak = false;
  tiebreakIds: number[] = [];
  finishOrder: number[] = [];
  result: MatchResult | null = null;
  pauseT = 0;
  firstFinishT = -1;
  leader = -1;
  private ctx: RuleCtx;
  private lowTimerSaid = new Set<number>();
  readonly rng;

  constructor(opts: MatchOptions) {
    this.opts = opts;
    this.level = opts.level;
    this.rng = makeRng(opts.seed);
    this.actors = opts.competitors.map((c, i) => new Actor({ id: i, cls: c.cls, stage: opts.stage, name: c.name, isPlayer: c.isPlayer, perk: c.perk }));
    this.ctx = { ev: this.ev, time: 0, assist: opts.difficulty === 'relaxed', drop: (a, treats, bundle) => this.dropCargo(a, treats, bundle) };
    const hz = Math.min(1.2, opts.hazardSpeed ?? 1);
    if (this.level.format === 'showdown') {
      this.arenas = [new ArenaRuntime(this.level.phases[0].arena, hz)];
    } else {
      this.arenas = this.level.phases.map((p) => new ArenaRuntime(p.arena, hz));
    }
    this.actors.forEach((a, i) => this.placeActor(a, this.level.phases[0].arena, i));
    if (opts.noCountdown) { this.state = 'play'; this.countdown = 0; }
  }

  get player() { return this.actors.find((a) => a.isPlayer) ?? this.actors[0]; }
  get phaseDef(): PhaseDef {
    if (this.tiebreak && this.level.tiebreak) return this.level.tiebreak;
    return this.level.phases[this.level.format === 'showdown' ? this.round : 0];
  }
  phaseOf(a: Actor): PhaseDef {
    if (this.tiebreak && this.level.tiebreak) return this.level.tiebreak;
    if (this.level.format === 'relay') return this.level.phases[a.phase];
    return this.phaseDef;
  }
  arenaOf(a: Actor): ArenaRuntime {
    if (this.level.format === 'relay') return this.arenas[a.phase];
    return this.arenas[0];
  }
  /** Actors taking part (tiebreak excludes untied siblings). */
  participants(): Actor[] { return this.tiebreak ? this.actors.filter((a) => this.tiebreakIds.includes(a.id)) : this.actors; }

  private placeActor(a: Actor, arena: ArenaDef, slot: number) {
    const [sx, sy] = arena.starts[slot % arena.starts.length];
    a.resetForPhase(sx, sy);
    a.facing = 1;
    a.heading = arena.mode === 'top' ? -Math.PI / 2 : 0;
  }

  step(dt: number, inputs: ActorInput[]) {
    this.ctx.time = this.t;
    if (this.state === 'done') return;
    if (this.state === 'countdown') {
      const before = Math.ceil(this.countdown);
      this.countdown -= dt;
      const after = Math.ceil(this.countdown);
      if (after !== before && after > 0) this.ev.emit({ type: 'countdown', n: after });
      if (this.countdown <= 0) { this.state = 'play'; this.ev.emit({ type: 'go' }); }
      // Arenas idle-animate during countdown so hazards are readable before play.
      for (const ar of this.arenas) ar.update(dt);
      return;
    }
    if (this.state === 'roundEnd') {
      this.pauseT -= dt;
      if (this.pauseT <= 0) this.nextRound();
      return;
    }
    this.t += dt;
    this.roundT += dt;
    for (const ar of this.arenas) {
      ar.update(dt);
      if (ar.mode === 'side') stepPushablesSide(ar, dt); else stepPushablesTop(ar, dt);
      for (const e of ar.ents) if (e.t === 'egg' && e.timer === -1) { e.timer = 0; this.ev.emit({ type: 'eggRelease', x: e.x, y: e.y }); }
      for (const e of ar.ents) if (e.t === 'wind' && e.warn && e.timer === 0) { e.timer = 1; this.ev.emit({ type: 'windWarn', x: e.x + e.w / 2, y: e.y + e.h / 2 }); }
    }
    const parts = this.participants();
    for (const a of parts) {
      const ar = this.arenaOf(a);
      const others = parts.filter((o) => o !== a && this.arenaOf(o) === ar);
      const inp = inputs[a.id] ?? NO_INPUT;
      tickTimers(a, dt, this.ctx);
      if (ar.mode === 'side') stepSide(a, inp, ar, others, this.ctx, dt);
      else stepTop(a, inp, ar, others, this.ctx, dt);
      this.interact(a, inp, ar, others, dt);
      a.prevInteract = inp.interact;
      this.trackProgress(a, ar);
    }
    for (const ar of this.arenas) {
      this.updatePerch(ar, dt);
      this.updateTugs(ar, parts.filter((a) => this.arenaOf(a) === ar), inputs, dt);
      this.updateGates(ar, parts.filter((a) => this.arenaOf(a) === ar));
    }
    this.evaluate();
  }

  // ------------------------------------------------------------------ interactions
  private interact(a: Actor, inp: ActorInput, ar: ArenaRuntime, _others: Actor[], dt: number) {
    const side = ar.mode === 'side';
    const reachZ = side ? true : a.z < 0.6;
    const ax = a.x, ay = side ? a.y + a.colH * 0.5 : a.y;
    const pickR = (side ? 0.55 : a.r + 0.32);
    const magnet = a.hasPower('PU-03');
    const pressed = inp.interact && !a.prevInteract && a.canAct && !a.finished;

    for (const e of ar.ents) {
      if (!e.alive) continue;
      if (e.t === 'crumb' || e.t === 'feather' || e.t === 'power') {
        if (!reachZ) continue;
        const d = Math.hypot(e.x - ax, e.y - ay);
        let r = pickR;
        if (magnet && e.t === 'crumb' && d < POWER_TUNING.magnetRadius && this.los(ar, ax, ay, e.x, e.y)) r = POWER_TUNING.magnetRadius;
        if (d > r) continue;
        if (a.finished && e.t !== 'power') continue;
        e.alive = false;
        if (e.t === 'crumb') {
          const v = a.hasPower('PU-07') ? 2 : 1;
          a.st.crumbs += v;
          e.timer = ar.def.crumbRespawn ?? 0;
          this.ev.emit({ type: 'pickup', a: a.id, item: 'crumb', x: e.x, y: e.y, value: v });
        } else if (e.t === 'feather') {
          a.st.feathers += 1;
          e.timer = 0;
          this.ev.emit({ type: 'pickup', a: a.id, item: 'feather', x: e.x, y: e.y, value: 1 });
        } else {
          const pu = (e.def as { pu: keyof typeof POWERS }).pu;
          applyPower(a, pu, this.ctx);
          e.timer = (e.def as { respawn?: number }).respawn ?? 14;
        }
      }
    }
    // loose items (dropped cargo, scratched treats, scramble crumbs)
    for (const l of ar.loose) {
      if (!l.alive || !reachZ || a.finished) continue;
      let r = pickR + (a.cls === 'speedy' && a.abilityT > 0 && a.stage >= 4 ? 0.6 : 0);
      const d = Math.hypot(l.x - ax, l.y - ay);
      if (magnet && l.kind !== 'bundle' && d < POWER_TUNING.magnetRadius && this.los(ar, ax, ay, l.x, l.y)) r = POWER_TUNING.magnetRadius;
      if (d > r || l.t < 0.35) continue;
      if (l.kind === 'crumb') {
        const v = a.hasPower('PU-07') ? 2 : 1;
        a.st.crumbs += v; l.alive = false;
        this.ev.emit({ type: 'pickup', a: a.id, item: 'crumb', x: l.x, y: l.y, value: v });
      } else if (l.kind === 'treat' && a.g.canCarry && !a.carryBundle && a.carryTreats < 3) {
        a.carryTreats++; l.alive = false;
        this.ev.emit({ type: 'pickup', a: a.id, item: 'treat', x: l.x, y: l.y, value: 1 });
      } else if (l.kind === 'bundle' && a.g.canCarry && !a.carryBundle && a.carryTreats === 0 && d < pickR) {
        a.carryBundle = true; l.alive = false;
        this.ev.emit({ type: 'pickup', a: a.id, item: 'bundle', x: l.x, y: l.y, value: 1 });
      }
    }

    if (side) {
      if (pressed) peckSide(a, ar, this.ctx);
      this.sideZones(a, ar);
      return;
    }

    // ---- top-down contextual interact: deliver > take bundle > gate > straw > scratch > tug
    if (!a.canAct || a.finished) { a.interactTarget = -1; a.interactT = 0; return; }
    if (pressed) {
      const target = this.interactTargetTop(a, ar);
      if (target) {
        const e = target;
        if (e.t === 'basket') {
          const n = a.carryBundle ? 1 : a.carryTreats;
          if (n > 0) {
            a.st.delivered += n;
            a.carryBundle = false; a.carryTreats = 0;
            this.ev.emit({ type: 'deliver', a: a.id, count: n, x: e.x, y: e.y });
          }
        } else if (e.t === 'cornpile') {
          if (e.count > 0 && !a.carryBundle && a.carryTreats === 0) {
            e.count--; a.carryBundle = true;
            this.ev.emit({ type: 'pickup', a: a.id, item: 'bundle', x: e.x, y: e.y, value: 1 });
          }
        } else if (e.t === 'gate') {
          e.active = true; e.timer = 6;
          this.ev.emit({ type: 'gate', open: true, x: e.x + e.w / 2, y: e.y + e.h / 2 });
        } else if (e.t === 'straw') {
          a.peckT = 0.22;
          e.hp -= 1;
          this.ev.emit({ type: 'peck', a: a.id, x: e.x + e.w / 2, y: e.y + e.h / 2 });
          if (e.hp <= 0) { e.alive = false; this.ev.emit({ type: 'break', x: e.x + e.w / 2, y: e.y + e.h / 2 }); }
        } else if (e.t === 'scratch' || e.t === 'tugworm') {
          a.interactTarget = e.i; a.interactT = 0;
          if (e.t === 'tugworm') this.ev.emit({ type: 'tugStart', a: a.id, x: e.x, y: e.y });
        }
      }
    }
    if (a.interactTarget >= 0) {
      const e = ar.ents[a.interactTarget];
      const near = e && e.alive && Math.hypot(e.x - a.x, e.y - a.y) < a.r + (e.t === 'tugworm' ? 1.0 : 0.85);
      if (!inp.interact || !near) { a.interactTarget = -1; a.interactT = 0; return; }
      if (e.t === 'scratch') {
        a.interactT += dt;
        if (a.peckT <= 0) { a.peckT = 0.18; this.ev.emit({ type: 'scratch', a: a.id, x: e.x, y: e.y }); }
        if (a.interactT >= 0.7) {
          a.interactT = 0;
          e.alive = false; e.timer = 2.2;
          const ang = this.rng.range(0, Math.PI * 2);
          ar.addLoose('treat', e.x, e.y, Math.cos(ang) * 2.2, Math.sin(ang) * 2.2);
          a.interactTarget = -1;
        }
      }
    }
  }

  /** Nearest valid top-down interactable within reach, by priority. */
  interactTargetTop(a: Actor, ar: ArenaRuntime): Ent | null {
    let best: Ent | null = null, bestScore = Infinity;
    for (const e of ar.ents) {
      if (!e.alive) continue;
      let cx = e.x, cy = e.y, reach = a.r + 0.8, pri = 9;
      switch (e.t) {
        case 'basket': {
          const own = e.owner < 0 || e.owner === a.id;
          if (!own || (!a.carryBundle && a.carryTreats === 0)) continue;
          reach = (e.def as { r: number }).r + a.r + 0.3; pri = 0; break;
        }
        case 'cornpile': if (a.carryBundle || a.carryTreats > 0 || e.count <= 0 || !a.g.canCarry) continue; reach = a.r + 1.0; pri = 1; break;
        case 'gate': if (e.active) continue; cx = e.x + e.w / 2; cy = e.y + e.h / 2; reach = a.r + Math.max(e.w, e.h) / 2 + 0.6; pri = 2; break;
        case 'straw': cx = e.x + e.w / 2; cy = e.y + e.h / 2; reach = a.r + Math.max(e.w, e.h) / 2 + 0.45; pri = 3; break;
        case 'scratch': if (!a.g.canCarry && a.stage !== 1) continue; pri = 4; break;
        case 'tugworm': pri = 5; reach = a.r + 0.95; break;
        default: continue;
      }
      const d = Math.hypot(cx - a.x, cy - a.y);
      if (d > reach) continue;
      const score = pri * 100 + d;
      if (score < bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  private sideZones(a: Actor, ar: ArenaRuntime) {
    // checkpoints (only advance)
    ar.ents.forEach((e) => {
      if (e.t === 'checkpoint' && e.i > a.cpIdx && Math.hypot(e.x - a.x, e.y - a.y) < 1.6 && a.grounded) {
        a.cpIdx = e.i; a.checkpointX = e.x; a.checkpointY = e.y;
        this.ev.emit({ type: 'checkpoint', a: a.id, x: e.x, y: e.y });
      }
    });
  }

  private los(ar: ArenaRuntime, x0: number, y0: number, x1: number, y1: number) {
    const bl = ar.mode === 'top' ? topBlockers(ar) : ar.blockers();
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.25);
    for (let i = 1; i < steps; i++) {
      const px = x0 + ((x1 - x0) * i) / steps, py = y0 + ((y1 - y0) * i) / steps;
      for (const b of bl) if (!(b as { oneWay?: boolean }).oneWay && pointInRect(px, py, b)) return false;
    }
    return true;
  }

  private dropCargo(a: Actor, treats: number, bundle: boolean) {
    const ar = this.arenaOf(a);
    if (ar.mode !== 'top') return;
    for (let i = 0; i < treats; i++) {
      const ang = (i / Math.max(1, treats)) * Math.PI * 2 + this.rng.range(0, 1);
      ar.addLoose('treat', a.x, a.y, Math.cos(ang) * 2.5, Math.sin(ang) * 2.5);
    }
    if (bundle) ar.addLoose('bundle', a.x, a.y, a.vx * 0.3, a.vy * 0.3);
  }

  // ------------------------------------------------------------------ perch / tug / gates
  private updatePerch(ar: ArenaRuntime, dt: number) {
    for (const e of ar.ents) {
      if (e.t !== 'perch') continue;
      const occ = this.participants().filter((a) => this.arenaOf(a) === ar && !a.finished && this.onPerch(a, ar, e));
      const prev = e.owner;
      const wasContested = e.active;
      e.active = occ.length > 1; // contested occupancy pauses accumulation
      if (occ.length === 1) {
        e.owner = occ[0].id;
        occ[0].st.perchTime += dt;
        if (prev !== e.owner) this.ev.emit({ type: 'perchClaim', a: e.owner });
      } else {
        if (prev >= 0) this.ev.emit({ type: 'perchLost', a: prev });
        if (e.active && !wasContested) this.ev.emit({ type: 'perchContest' });
        e.owner = -1;
      }
    }
  }
  onPerch(a: Actor, ar: ArenaRuntime, e: Ent) {
    if (ar.mode === 'side') return a.grounded && pointInRect(a.x, a.y + 0.1, e);
    return a.z < 0.1 && pointInRect(a.x, a.y, e);
  }

  private updateTugs(ar: ArenaRuntime, parts: Actor[], inputs: ActorInput[], dt: number) {
    for (const e of ar.ents) {
      if (e.t !== 'tugworm' || !e.alive) continue;
      const holders = parts.filter((a) => a.interactTarget === e.i && a.canAct);
      for (let i = 0; i < 4; i++) if (!holders.some((h) => h.id === i)) e.tug[i] = Math.max(0, e.tug[i] - dt * 0.12);
      for (const h of holders) {
        // Tether: tugging keeps you near the worm; leaning away (holding away) pulls hardest.
        const dx = h.x - e.x, dy = h.y - e.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d > 0.95) { h.x = e.x + (dx / d) * 0.95; h.y = e.y + (dy / d) * 0.95; }
        const inp = inputs[h.id] ?? NO_INPUT;
        const away = (inp.mx * dx + inp.my * dy) / d > 0.3;
        const rate = 0.4 * Math.sqrt(h.pushForce) * (away ? 1 : 0.6) / (holders.length > 1 ? 1.5 : 1);
        e.tug[h.id] += rate * dt;
        h.vx *= 0.2; h.vy *= 0.2;
        if (e.tug[h.id] >= 1) {
          h.st.worms += 1;
          e.alive = false; e.timer = 2.5; e.tug = [0, 0, 0, 0];
          for (const o of holders) { o.interactTarget = -1; o.interactT = 0; }
          this.ev.emit({ type: 'tugWin', a: h.id, x: e.x, y: e.y });
          this.ev.emit({ type: 'pickup', a: h.id, item: 'crumb', x: e.x, y: e.y, value: 0 });
          break;
        }
      }
    }
  }

  private updateGates(ar: ArenaRuntime, parts: Actor[]) {
    for (const e of ar.ents) {
      if (e.t !== 'gate' || !e.active || e.timer > 0) continue;
      // Never close on a chick (no trapping).
      const blocked = parts.some((a) => rectOverlap({ x: a.x - a.r, y: a.y - a.r, w: a.r * 2, h: a.r * 2 }, e));
      if (!blocked) { e.active = false; this.ev.emit({ type: 'gate', open: false, x: e.x + e.w / 2, y: e.y + e.h / 2 }); }
    }
  }

  // ------------------------------------------------------------------ objectives
  isComplete(obj: ObjectiveDef, a: Actor): boolean {
    const s = a.st;
    switch (obj.kind) {
      case 'collect': return s.crumbs >= obj.count;
      case 'tug': return s.worms >= obj.count;
      case 'perch': return s.perchTime >= obj.seconds;
      case 'race': return s.reached;
      case 'reach': return s.reached;
      case 'deliver': return s.delivered >= obj.count;
      case 'mostDeliveries': return false;
    }
  }
  /** 0..1 progress used for HUD and ranking unfinished competitors. */
  progress(obj: ObjectiveDef, a: Actor): number {
    const s = a.st;
    switch (obj.kind) {
      case 'collect': return Math.min(1, s.crumbs / obj.count);
      case 'tug': return Math.min(1, s.worms / obj.count);
      case 'perch': return Math.min(1, s.perchTime / obj.seconds);
      case 'deliver': return Math.min(1, s.delivered / obj.count);
      case 'mostDeliveries': return s.delivered / 100;
      case 'race': case 'reach': return s.reached ? 1 : s.progress;
    }
  }

  private trackProgress(a: Actor, ar: ArenaRuntime) {
    const ph = this.phaseOf(a);
    const fin = ar.ents.find((e) => e.t === 'finish' || (ph.objective.kind === 'reach' && e.t === 'perch'));
    if (!fin) return;
    const [sx, sy] = ph.arena.starts[0];
    const fx = fin.x + fin.w / 2, fy = fin.y + fin.h / 2;
    const total = Math.hypot(fx - sx, fy - sy) || 1;
    const p = 1 - Math.min(1, Math.hypot(fx - a.x, fy - a.y) / total);
    if (p > a.st.progress) a.st.progress = p;
    if (fin.t === 'finish' || ph.objective.kind === 'reach') {
      const inside = ar.mode === 'side' ? rectOverlap({ x: a.x - a.w / 2, y: a.y, w: a.w, h: a.colH }, fin) : pointInRect(a.x, a.y, fin);
      const need = ph.objective.kind === 'reach' ? ph.objective.feathers ?? 0 : 0;
      if (inside && a.st.feathers >= need && (ar.mode !== 'side' || fin.t === 'finish' || a.grounded)) a.st.reached = true;
    }
  }

  private evaluate() {
    const fmt = this.level.format;
    const parts = this.participants();
    for (const a of parts) {
      if (a.finished) continue;
      const ph = this.phaseOf(a);
      if (!this.isComplete(ph.objective, a)) continue;
      a.st.completeAt = this.t;
      if (fmt === 'relay' && a.phase < this.level.phases.length - 1) {
        a.phase++;
        const next = this.level.phases[a.phase];
        const slot = a.id;
        this.placeActor(a, next.arena, slot);
        a.st.completeAt = -1;
        this.ev.emit({ type: 'phase', a: a.id, phase: a.phase });
        continue;
      }
      a.finished = true;
      if (this.firstFinishT < 0) this.firstFinishT = this.roundT;
      this.finishOrder.push(a.id);
      this.ev.emit({ type: 'complete', a: a.id, place: this.finishOrder.length });
    }

    // lead change feedback
    const order = this.currentOrder();
    if (order[0] !== this.leader && this.t > 1) {
      if (this.leader >= 0) this.ev.emit({ type: 'leadChange', a: order[0] });
      this.leader = order[0];
    }

    const obj = this.phaseDef.objective;
    if (fmt === 'showdown') {
      const cap = obj.kind === 'mostDeliveries' ? obj.seconds : ROUND_CAP;
      const done = parts.every((a) => a.finished)
        || (obj.kind === 'perch' && this.finishOrder.length > 0)
        || (obj.kind === 'deliver' && this.finishOrder.length > 0)
        || (obj.kind === 'collect' && this.finishOrder.length > 0)
        || (this.firstFinishT >= 0 && this.roundT - this.firstFinishT > ROUND_GRACE)
        || this.roundT >= cap;
      this.timerCue(cap - this.roundT);
      if (done) this.endRound();
      return;
    }

    const p = this.player;
    if (obj.kind === 'mostDeliveries') {
      this.timerCue(obj.seconds - this.t);
      if (this.t >= obj.seconds) this.finish();
      return;
    }
    if (p.finished) {
      this.finish();
      return;
    }
    // A finish-first race the player can no longer win still lets them cross the line.
    if (this.t >= this.level.timeLimit) this.finish();
  }

  private timerCue(remaining: number) {
    const s = Math.ceil(remaining);
    if (s <= 10 && s > 0 && !this.lowTimerSaid.has(s)) { this.lowTimerSaid.add(s); this.ev.emit({ type: 'timerLow', seconds: s }); }
  }

  /** Current ranking: finished first (in order), then by objective progress. */
  currentOrder(): number[] {
    const parts = this.participants();
    const fmt = this.level.format;
    const key = (a: Actor) => {
      const ph = this.phaseOf(a);
      const done = this.finishOrder.indexOf(a.id);
      if (done >= 0) return 1000 - done;
      const legBonus = fmt === 'relay' ? a.phase * 10 : 0;
      return legBonus + this.progress(ph.objective, a) + (ph.objective.kind === 'mostDeliveries' ? a.st.delivered : 0);
    };
    return [...parts].sort((x, y) => key(y) - key(x) || x.id - y.id).map((a) => a.id);
  }

  private endRound() {
    const order = this.currentOrder();
    if (this.tiebreak) {
      this.complete(order);
      return;
    }
    order.forEach((id, i) => { this.points[id] += SHOWDOWN_POINTS[i] ?? 0; });
    this.roundOrders.push(order);
    this.ev.emit({ type: 'roundEnd', round: this.round, order });
    this.state = 'roundEnd';
    this.pauseT = ROUND_PAUSE;
  }

  private nextRound() {
    const last = this.round >= this.level.phases.length - 1;
    if (last) {
      const top = Math.max(...this.points);
      const tied = this.actors.filter((a) => this.points[a.id] === top).map((a) => a.id);
      if (tied.length > 1 && this.level.tiebreak && !this.tiebreak) {
        this.tiebreak = true;
        this.tiebreakIds = tied;
        this.arenas = [new ArenaRuntime(this.level.tiebreak.arena, this.opts.hazardSpeed ?? 1)];
        this.resetRound(this.level.tiebreak.arena);
        this.ev.emit({ type: 'tiebreak' });
        return;
      }
      const order = [...this.actors].sort((x, y) => this.points[y.id] - this.points[x.id] || x.id - y.id).map((a) => a.id);
      this.complete(order);
      return;
    }
    this.round++;
    this.arenas = [new ArenaRuntime(this.level.phases[this.round].arena, this.opts.hazardSpeed ?? 1)];
    this.resetRound(this.level.phases[this.round].arena);
    this.ev.emit({ type: 'round', round: this.round });
  }

  private resetRound(arena: ArenaDef) {
    this.finishOrder = [];
    this.firstFinishT = -1;
    this.roundT = 0;
    this.lowTimerSaid.clear();
    this.participants().forEach((a, i) => this.placeActor(a, arena, i));
    this.state = 'countdown';
    this.countdown = 2;
  }

  private finish() {
    this.complete(this.currentOrder());
  }

  private complete(orderIn: number[]) {
    let order = orderIn;
    if (this.tiebreak) {
      // tied siblings by tiebreak result, then everyone else by points
      const rest = this.actors.filter((a) => !this.tiebreakIds.includes(a.id)).sort((x, y) => this.points[y.id] - this.points[x.id] || x.id - y.id).map((a) => a.id);
      order = [...orderIn.filter((id) => this.tiebreakIds.includes(id)), ...rest];
    }
    const p = this.player;
    const placement = order.indexOf(p.id) + 1;
    const obj = this.level.phases[0].objective;
    const fmt = this.level.format;
    const relaxed = this.opts.difficulty === 'relaxed';
    let success: boolean;
    let reason: string;
    if (fmt === 'showdown') {
      success = placement === 1 || relaxed;
      reason = placement === 1 ? 'Champion of the Barnyard!' : relaxed ? 'Finished the Championship (relaxed mode)' : 'So close! Win the most points to become champion.';
    } else if (obj.kind === 'mostDeliveries') {
      success = placement === 1 || (relaxed && p.st.delivered > 0);
      reason = placement === 1 ? 'Most deliveries!' : success ? 'Deliveries counted (relaxed mode)' : 'Another sibling delivered more. Try again!';
    } else {
      const done = p.finished;
      const needFirst = (obj.kind === 'race' && obj.requireFirst) || ((obj.kind === 'deliver' || obj.kind === 'reach') && !!obj.requireFirst) || fmt === 'relay';
      success = done && (!needFirst || placement === 1 || relaxed);
      reason = !done ? 'Time ran out.' : success ? (placement === 1 ? 'First place!' : 'Objective complete!') : 'You finished, but this event needs first place.';
    }
    const time = p.st.completeAt >= 0 ? p.st.completeAt : this.t;
    const medalTime = this.level.medals?.time;
    const featherNeed = this.level.medals?.feathers;
    this.result = {
      success, placement, order, time,
      points: fmt === 'showdown' ? [...this.points] : undefined,
      medals: {
        complete: success,
        first: placement === 1,
        time: success && medalTime !== undefined && time <= medalTime,
        feathers: success && featherNeed !== undefined && p.st.feathers >= featherNeed,
      },
      reason,
    };
    this.state = 'done';
    this.ev.emit({ type: 'finish' });
  }
}
