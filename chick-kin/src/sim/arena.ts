// Runtime state for one arena: static solids, dynamic entities and their timed behaviour.
import type { ArenaDef, EntityDef, SolidDef } from './types';
import type { PowerId } from '../data/items';
import { pointInRect, type Rect } from './math';

export interface Solid extends Rect { kind: string; oneWay: boolean; height: number; lowFence: boolean }

/** Dynamic entity runtime record. `def` is the authored data; other fields are live state. */
export interface Ent {
  i: number;
  def: EntityDef;
  t: EntityDef['t'];
  alive: boolean;
  x: number; y: number; w: number; h: number;   // current box (side) or footprint (top)
  px: number; py: number;                        // previous position (for carrying riders)
  vx: number; vy: number;
  phase: number;                                 // 0..1 cycle phase for periodic things
  hp: number;
  timer: number;                                 // respawn / open / cooldown timer
  count: number;                                 // cornpile stock
  owner: number;                                 // perch owner / tug leader / basket owner
  tug: number[];                                 // tug progress per actor
  angle: number;                                 // bucket/wobbly angle
  active: boolean;                               // wind on / egg rolling / gate open
  warn: boolean;
  taken: number;                                 // per-competitor bitmask (golden feathers are personal)
}

export interface LooseItem { id: number; kind: 'treat' | 'crumb' | 'bundle'; x: number; y: number; vx: number; vy: number; t: number; alive: boolean }

export class ArenaRuntime {
  readonly def: ArenaDef;
  readonly mode: ArenaDef['mode'];
  readonly solids: Solid[];
  readonly ents: Ent[];
  loose: LooseItem[] = [];
  private looseId = 1;
  time = 0;
  hazardSpeed: number;

  constructor(def: ArenaDef, hazardSpeed = 1) {
    this.def = def;
    this.mode = def.mode;
    this.hazardSpeed = hazardSpeed;
    this.solids = def.solids.map((s: SolidDef) => ({
      x: s.x, y: s.y, w: s.w, h: s.h, kind: s.kind ?? 'ground', oneWay: !!s.oneWay,
      height: s.height ?? 1.2, lowFence: !!s.lowFence,
    }));
    this.ents = def.entities.map((d, i) => makeEnt(d, i));
  }

  /** Advance periodic entity behaviour. Called once per fixed step before actors move. */
  update(dt: number) {
    this.time += dt;
    const T = this.time * this.hazardSpeed;
    for (const e of this.ents) {
      e.px = e.x; e.py = e.y;
      const d = e.def;
      switch (d.t) {
        case 'mover': {
          e.phase = frac(T / d.period + (d.phase ?? 0));
          const k = (1 - Math.cos(e.phase * Math.PI * 2)) / 2;
          e.x = d.x + (d.x2 - d.x) * k;
          e.y = d.y + (d.y2 - d.y) * k;
          e.vx = (e.x - e.px) / dt; e.vy = (e.y - e.py) / dt;
          break;
        }
        case 'bucket': {
          e.phase = frac(T / d.period + (d.phase ?? 0));
          e.angle = d.amp * Math.sin(e.phase * Math.PI * 2);
          const bx = d.px + Math.sin(e.angle) * d.len;
          const by = d.py - Math.cos(e.angle) * d.len;
          e.x = bx - 0.45; e.y = by - 0.55; e.w = 0.9; e.h = 0.55;
          e.vx = (e.x - e.px) / dt; e.vy = (e.y - e.py) / dt;
          break;
        }
        case 'wobbly': {
          e.phase = frac(T / d.period + (d.phase ?? 0));
          e.angle = d.amp * Math.sin(e.phase * Math.PI * 2);
          break;
        }
        case 'wind': {
          const cyc = d.on + d.off;
          const p = (T + (d.phase ?? 0) * cyc) % cyc;
          const wasActive = e.active;
          e.active = p < d.on;
          e.warn = !e.active && p > cyc - 0.9; // visible telegraph before each gust
          e.phase = p / cyc;
          if (e.active && !wasActive) e.timer = 0;
          break;
        }
        case 'spring': {
          e.phase = frac(T / d.period + (d.phase ?? 0));
          break;
        }
        case 'egg': {
          // Telegraph (wobble at the top) for 0.8 s, roll along the path, then rest until the next cycle.
          const total = pathLength(d.path);
          const rollTime = total / d.speed;
          const cyc = Math.max(d.period, rollTime + 1.2);
          const p = (T + (d.phase ?? 0) * cyc) % cyc;
          const r = d.r ?? 0.35;
          e.w = e.h = r * 2;
          const wasActive = e.active;
          if (p < 0.8) {
            e.active = false; e.warn = true;
            const [sx, sy] = d.path[0];
            e.x = sx - r; e.y = sy - r;
          } else if (p < 0.8 + rollTime) {
            e.active = true; e.warn = false;
            const [px, py] = pointAlong(d.path, (p - 0.8) * d.speed);
            e.x = px - r; e.y = py - r;
          } else {
            e.active = false; e.warn = false;
            e.x = -999; e.y = -999;
          }
          e.vx = (e.x - e.px) / dt; e.vy = (e.y - e.py) / dt;
          if (e.active && !wasActive) e.timer = -1; // release marker consumed by match
          break;
        }
        case 'gate': {
          if (e.active) {
            e.timer -= dt;
            if (e.timer <= 0) e.timer = 0; // closing is resolved by the match (never closes on a chick)
          }
          break;
        }
        case 'crumb': case 'feather': case 'power': {
          if (!e.alive && e.timer > 0) {
            e.timer -= dt;
            if (e.timer <= 0) e.alive = true;
          }
          break;
        }
        case 'cornpile': {
          const rs = d.respawn ?? 0;
          if (rs > 0 && e.count < d.count) {
            e.timer += dt;
            if (e.timer >= rs) { e.count++; e.timer = 0; }
          }
          break;
        }
        case 'scratch': case 'tugworm': {
          if (e.timer > 0) { e.timer -= dt; if (e.timer <= 0) e.alive = true; }
          break;
        }
        default: break;
      }
    }
    // Loose items settle and expire never (dropped cargo remains recoverable).
    for (const l of this.loose) {
      if (!l.alive) continue;
      l.t += dt;
      l.x += l.vx * dt; l.y += l.vy * dt;
      l.vx *= Math.max(0, 1 - 6 * dt); l.vy *= Math.max(0, 1 - 6 * dt);
      // keep within arena
      l.x = Math.min(Math.max(l.x, 0.4), this.def.w - 0.4);
      l.y = Math.min(Math.max(l.y, 0.4), this.def.h - 0.4);
      for (const s of this.solids) {
        if (pointInRect(l.x, l.y, s)) { l.vx = -l.vx; l.vy = -l.vy; l.x += (l.x < s.x + s.w / 2 ? -0.3 : 0.3); }
      }
    }
    if (this.loose.length > 64) this.loose = this.loose.filter((l) => l.alive);
  }

  addLoose(kind: LooseItem['kind'], x: number, y: number, vx = 0, vy = 0) {
    const l: LooseItem = { id: this.looseId++, kind, x, y, vx, vy, t: 0, alive: true };
    this.loose.push(l);
    return l;
  }

  /** Solid boxes currently blocking (static + live straw/bale/crate/gates/movers/buckets). */
  blockers(): Rect[] {
    const out: (Rect & { ent?: Ent })[] = [...this.solids];
    for (const e of this.ents) {
      if (!e.alive) continue;
      if (e.t === 'straw' || e.t === 'bale' || e.t === 'crate') out.push({ x: e.x, y: e.y, w: e.w, h: e.h, ent: e });
      else if (e.t === 'gate' && !e.active) out.push({ x: e.x, y: e.y, w: e.w, h: e.h, ent: e });
    }
    return out;
  }

  powerAt(e: Ent): PowerId | null { return e.def.t === 'power' ? e.def.pu : null; }
}

function makeEnt(d: EntityDef, i: number): Ent {
  const e: Ent = {
    i, def: d, t: d.t, alive: true, x: 0, y: 0, w: 0, h: 0, px: 0, py: 0, vx: 0, vy: 0,
    phase: 0, hp: 0, timer: 0, count: 0, owner: -1, tug: [0, 0, 0, 0], angle: 0, active: false, warn: false, taken: 0,
  };
  switch (d.t) {
    case 'mover': case 'straw': case 'bale': case 'crate': case 'mud': case 'seed': case 'wind': case 'perch': case 'finish': case 'gate':
      e.x = d.x; e.y = d.y; e.w = d.w; e.h = d.h; break;
    case 'spring': e.x = d.x; e.y = d.y; e.w = d.w; e.h = 0.3; break;
    case 'wobbly': e.x = d.x; e.y = d.y; e.w = d.w; e.h = 0.3; break;
    case 'bucket': e.x = d.px; e.y = d.py - d.len; e.w = 0.9; e.h = 0.55; break;
    case 'egg': e.x = d.path[0][0]; e.y = d.path[0][1]; break;
    case 'basket': e.x = d.x; e.y = d.y; e.w = e.h = d.r * 2; e.owner = d.owner ?? -1; break;
    case 'mound': e.x = d.x; e.y = d.y; e.w = e.h = d.r * 2; break;
    case 'cornpile': e.x = d.x; e.y = d.y; e.count = d.count; break;
    default: e.x = (d as { x: number }).x; e.y = (d as { y: number }).y; break;
  }
  if (d.t === 'straw') e.hp = d.hp ?? 3;
  if (d.t === 'egg' || d.t === 'wind') e.active = false;
  return e;
}

export const frac = (v: number) => v - Math.floor(v);

export function pathLength(p: [number, number][]) {
  let L = 0;
  for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
  return L;
}
export function pointAlong(p: [number, number][], dist: number): [number, number] {
  for (let i = 1; i < p.length; i++) {
    const seg = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    if (dist <= seg) {
      const k = seg === 0 ? 0 : dist / seg;
      return [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * k, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * k];
    }
    dist -= seg;
  }
  return p[p.length - 1];
}
