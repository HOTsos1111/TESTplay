// Top-down planar movement (Nest Scramble, Farmyard Mischief, Championship haul/scramble).
// Plane coordinates x/y (y toward camera); z = hop height.
import type { Actor, ActorInput } from './actor';
import type { ArenaRuntime, Ent } from './arena';
import { bump, speedMult, startAbility, abilityReady, type RuleCtx } from './rules';
import { circleRectPush, clamp, len, rectOverlap, pointInRect, type Rect } from './math';

const HOP_G = 22;

export function hopVelocity(a: Actor) {
  const vault = a.g.canVault ? 1 : 0.85;
  return Math.sqrt(2 * HOP_G * a.g.top.hopHeight * a.tuning.jump * vault);
}

type Blocker = Rect & { ent?: Ent; height: number };

export function topBlockers(ar: ArenaRuntime): Blocker[] {
  const out: Blocker[] = ar.solids.map((s) => ({ x: s.x, y: s.y, w: s.w, h: s.h, height: s.height }));
  for (const e of ar.ents) {
    if (!e.alive) continue;
    if (e.t === 'straw') out.push({ x: e.x, y: e.y, w: e.w, h: e.h, ent: e, height: 0.9 });
    else if (e.t === 'bale') out.push({ x: e.x, y: e.y, w: e.w, h: e.h, ent: e, height: 1.0 });
    else if (e.t === 'crate') out.push({ x: e.x, y: e.y, w: e.w, h: e.h, ent: e, height: 0.8 });
    else if (e.t === 'gate' && !e.active) out.push({ x: e.x, y: e.y, w: e.w, h: e.h, ent: e, height: 1.1 });
  }
  return out;
}

/** Can a hop at height z pass over a blocker? (vault fences are low; nest walls are not) */
export const clears = (z: number, height: number) => z > height * 0.85;

export function stepTop(a: Actor, inp: ActorInput, ar: ArenaRuntime, others: Actor[], ctx: RuleCtx, dt: number) {
  const control = a.canAct;
  let mx = control ? inp.mx : 0;
  let my = control ? inp.my : 0;
  const L = len(mx, my);
  if (L > 1) { mx /= L; my /= L; }
  const jumpPressed = control && inp.jump && !a.prevJump;
  const abilityPressed = control && inp.ability && !a.prevAbility;
  a.prevJump = inp.jump;
  a.prevAbility = inp.ability;

  a.onMud = false; a.onSeed = false;
  if (a.z <= 0.01) {
    for (const e of ar.ents) {
      if (e.t === 'mud' && pointInRect(a.x, a.y, e)) a.onMud = true;
      else if (e.t === 'seed' && pointInRect(a.x, a.y, e)) a.onSeed = true;
    }
  }
  a.ducking = control && inp.duck && a.g.canBrace;
  a.bracing = a.ducking;

  if (abilityPressed && abilityReady(a)) {
    startAbility(a, ctx);
    const hx = Math.cos(a.heading), hy = Math.sin(a.heading);
    if (a.cls === 'mighty') {
      a.vx += hx * 3.5; a.vy += hy * 3.5;
      fluffBumpTop(a, ar, others, ctx);
    } else if (a.cls === 'nimble') {
      if (a.z <= 0.01) a.vz = hopVelocity(a) * 1.15;
      a.vx += hx * 2.5; a.vy += hy * 2.5;
    }
  }

  const base = a.g.top.run * a.tuning.run;
  let sm = speedMult(a, a.onMud);
  if (a.bracing) sm *= 0.5;
  let tx = mx * base * sm, ty = my * base * sm;
  if (a.cls === 'speedy' && a.abilityT > 0) {
    const hx = Math.cos(a.heading), hy = Math.sin(a.heading);
    tx = hx * base * sm; ty = hy * base * sm;
  }
  let acc = a.g.top.accel;
  if (a.onSeed) acc *= a.hasPower('PU-06') ? 0.7 : 0.22;
  if (!control) { tx = 0; ty = 0; acc = 7; }
  if (a.z > 0.01) acc *= 0.6;
  const dx = tx - a.vx, dy = ty - a.vy;
  const dl = len(dx, dy);
  const step = acc * dt;
  if (dl <= step) { a.vx = tx; a.vy = ty; } else { a.vx += (dx / dl) * step; a.vy += (dy / dl) * step; }
  if (control && (Math.abs(mx) > 0.05 || Math.abs(my) > 0.05)) a.heading = Math.atan2(my, mx);

  // hop
  if (jumpPressed && a.z <= 0.01) {
    a.vz = hopVelocity(a);
    ctx.ev.emit({ type: 'jump', a: a.id, x: a.x, y: a.y });
  }
  if (a.z > 0 || a.vz > 0) {
    a.z += a.vz * dt;
    a.vz -= HOP_G * dt;
    if (a.z <= 0) {
      a.z = 0;
      ctx.ev.emit({ type: 'land', a: a.id, x: a.x, y: a.y, speed: -a.vz });
      a.vz = 0;
    }
  }
  a.grounded = a.z <= 0.01;

  // move & collide
  const blockers = topBlockers(ar);
  a.x += a.vx * dt;
  collide(a, ar, blockers, ctx, 'x');
  a.y += a.vy * dt;
  collide(a, ar, blockers, ctx, 'y');
  a.x = clamp(a.x, a.r, ar.def.w - a.r);
  a.y = clamp(a.y, a.r, ar.def.h - a.r);

  // rolling eggs (hop over them)
  for (const e of ar.ents) {
    if (e.t !== 'egg' || !e.active) continue;
    const r = (e.def as { r?: number }).r ?? 0.35;
    const ex = e.x + r, ey = e.y + r;
    if (Math.hypot(a.x - ex, a.y - ey) < a.r + r * 0.85 && a.z < r * 0.75) {
      const sp = Math.hypot(e.vx, e.vy) || 1;
      bump(a, e.vx / sp + (a.x - ex) * 0.5, e.vy / sp + (a.y - ey) * 0.5, 6, 'hazard', ctx, 'OBS-01');
    }
  }

  // sibling nudges
  for (const o of others) {
    if (o === a) continue;
    const ddx = a.x - o.x, ddy = a.y - o.y;
    const d = Math.hypot(ddx, ddy);
    const minD = a.r + o.r;
    if (d < minD && d > 1e-6 && Math.abs(a.z - o.z) < 0.4) {
      const wa = 1 / (a.tuning.bumpRes * (a.bracing ? 2.5 : 1));
      const wo = 1 / (o.tuning.bumpRes * (o.bracing ? 2.5 : 1));
      const k = (minD - d) * (wa / (wa + wo));
      a.x += (ddx / d) * k; a.y += (ddy / d) * k;
      // Zoomies passes nudge siblings aside without stunning.
      if (a.cls === 'speedy' && a.abilityT > 0 && o.protectT <= 0) { o.vx -= (ddx / d) * 2; o.vy -= (ddy / d) * 2; }
    }
  }
  collide(a, ar, blockers, ctx, 'x');

  // anim
  a.animT += dt;
  if (a.stunT > 0) a.anim = 'bumped';
  else if (a.finished) a.anim = 'celebrate';
  else if (a.abilityT > 0) a.anim = 'ability';
  else if (a.peckT > 0) a.anim = a.interactTarget >= 0 && ar.ents[a.interactTarget]?.t === 'scratch' ? 'scratch' : 'peck';
  else if (a.interactTarget >= 0 && ar.ents[a.interactTarget]?.t === 'tugworm') a.anim = 'tug';
  else if (a.interactTarget >= 0 && ar.ents[a.interactTarget]?.t === 'scratch') a.anim = 'scratch';
  else if (a.z > 0.02) a.anim = a.vz > 0 ? 'jump' : 'fall';
  else if (a.pushT > 0) a.anim = 'push';
  else if (a.bracing) a.anim = 'brace';
  else if (a.carryBundle || a.carryTreats > 0) a.anim = 'carry';
  else a.anim = len(a.vx, a.vy) > 0.4 ? 'run' : 'idle';
}

function collide(a: Actor, ar: ArenaRuntime, blockers: Blocker[], ctx: RuleCtx, axis: 'x' | 'y') {
  for (const b of blockers) {
    if (clears(a.z, b.height)) continue;
    const p = circleRectPush(a.x, a.y, a.r, b);
    if (!p) continue;
    const ent = b.ent;
    if (ent && (ent.t === 'bale' || ent.t === 'crate') && a.z < 0.05) {
      const mass = (ent.def as { mass?: number }).mass ?? (ent.t === 'bale' ? 1.0 : 0.5);
      if (a.pushForce >= mass - 1e-6) {
        // push along the dominant axis of contact
        const mvx = Math.abs(p.x) >= Math.abs(p.y) ? -p.x : 0;
        const mvy = Math.abs(p.y) > Math.abs(p.x) ? -p.y : 0;
        if (tryMoveTop(ent, mvx, mvy, ar)) {
          const cap = 2.0 * a.pushForce / mass;
          const sp = len(a.vx, a.vy);
          if (sp > cap) { a.vx *= cap / sp; a.vy *= cap / sp; }
          if (a.pushT <= 0) ctx.ev.emit({ type: 'push', a: a.id, x: a.x, y: a.y });
          a.pushT = 0.15;
          continue;
        }
      }
    }
    a.x += p.x; a.y += p.y;
    if (axis === 'x' && Math.abs(p.x) > 1e-6) a.vx *= 0.2;
    if (axis === 'y' && Math.abs(p.y) > 1e-6) a.vy *= 0.2;
  }
}

export function tryMoveTop(e: Ent, dx: number, dy: number, ar: ArenaRuntime): boolean {
  const nx = e.x + dx, ny = e.y + dy;
  if (nx < 0.1 || ny < 0.1 || nx + e.w > ar.def.w - 0.1 || ny + e.h > ar.def.h - 0.1) return false;
  const r = { x: nx + 0.01, y: ny + 0.01, w: e.w - 0.02, h: e.h - 0.02 };
  for (const s of ar.solids) if (rectOverlap(r, s)) return false;
  for (const o of ar.ents) {
    if (o === e || !o.alive) continue;
    if ((o.t === 'bale' || o.t === 'crate' || o.t === 'straw' || o.t === 'basket' || o.t === 'cornpile' || (o.t === 'gate' && !o.active)) && rectOverlap(r, o.t === 'basket' || o.t === 'cornpile' ? { x: o.x - 0.6, y: o.y - 0.6, w: 1.2, h: 1.2 } : o)) return false;
  }
  e.x = nx; e.y = ny;
  return true;
}

export function stepPushablesTop(ar: ArenaRuntime, dt: number) {
  for (const e of ar.ents) {
    if (!e.alive || (e.t !== 'bale' && e.t !== 'crate')) continue;
    if (Math.abs(e.vx) > 0.01 || Math.abs(e.vy) > 0.01) {
      if (!tryMoveTop(e, e.vx * dt, 0, ar)) e.vx = 0;
      if (!tryMoveTop(e, 0, e.vy * dt, ar)) e.vy = 0;
      const k = Math.max(0, 1 - 6 * dt);
      e.vx *= k; e.vy *= k;
    }
  }
}

function fluffBumpTop(a: Actor, ar: ArenaRuntime, others: Actor[], ctx: RuleCtx) {
  const hx = Math.cos(a.heading), hy = Math.sin(a.heading);
  const cx = a.x + hx * (a.r + 0.5), cy = a.y + hy * (a.r + 0.5);
  for (const o of others) {
    if (o === a) continue;
    if (Math.hypot(o.x - cx, o.y - cy) < 0.75 + o.r) bump(o, hx, hy, 7 * a.pushForce, a.id, ctx);
  }
  for (const e of ar.ents) {
    if (!e.alive) continue;
    const near = rectOverlap({ x: cx - 0.6, y: cy - 0.6, w: 1.2, h: 1.2 }, e);
    if (!near) continue;
    if (e.t === 'straw') { e.alive = false; ctx.ev.emit({ type: 'break', x: e.x + e.w / 2, y: e.y + e.h / 2 }); }
    else if (e.t === 'bale' || e.t === 'crate') {
      const ax = Math.abs(hx) >= Math.abs(hy);
      e.vx = ax ? Math.sign(hx) * 4.5 : 0; e.vy = ax ? 0 : Math.sign(hy) * 4.5;
      ctx.ev.emit({ type: 'push', a: a.id, x: e.x, y: e.y });
    }
  }
}
