// Side-view platforming (Coop Dash, Rafter Rivals, Championship side events). x → right, y → up, y = feet.
import type { Actor, ActorInput } from './actor';
import type { ArenaRuntime, Ent } from './arena';
import { bump, speedMult, startAbility, abilityReady, type RuleCtx } from './rules';
import { approach, clamp, rectOverlap, sign, type Rect } from './math';
import { POWER_TUNING } from '../data/items';

const JUMP_BUFFER = 0.1;
const COYOTE = 0.1;
const JUMP_CUT = 3.5;
const MAX_FALL = 20;

export function jumpVelocity(a: Actor) {
  const g = a.g.side;
  return Math.sqrt(2 * g.gravity * g.jumpHeight * a.tuning.jump) * (a.carryBundle ? 0.92 : 1);
}
export function flapVelocity(a: Actor) {
  return Math.sqrt(2 * a.g.side.gravity * 0.95) * (a.hasPower('PU-02') ? POWER_TUNING.superFlapLift : 1);
}

function box(a: Actor, h = a.colH): Rect { return { x: a.x - a.w / 2, y: a.y, w: a.w, h }; }

interface Platform { x: number; y: number; w: number; top: number; ent?: Ent; kind: string }

/** One-way surfaces: authored one-way solids, moving crates, rideable buckets, wobbly perches, springs. */
function platforms(ar: ArenaRuntime): Platform[] {
  const out: Platform[] = [];
  for (const s of ar.solids) if (s.oneWay) out.push({ x: s.x, y: s.y, w: s.w, top: s.y + s.h, kind: s.kind });
  for (const e of ar.ents) {
    if (!e.alive) continue;
    if (e.t === 'mover') out.push({ x: e.x, y: e.y, w: e.w, top: e.y + e.h, ent: e, kind: 'crate' });
    else if (e.t === 'bucket' && (e.def as { ride?: boolean }).ride) out.push({ x: e.x, y: e.y, w: e.w, top: e.y + e.h, ent: e, kind: 'bucket' });
    else if (e.t === 'wobbly' || e.t === 'spring') out.push({ x: e.x, y: e.y, w: e.w, top: e.y + e.h, ent: e, kind: e.t });
  }
  return out;
}

export function stepSide(a: Actor, inp: ActorInput, ar: ArenaRuntime, others: Actor[], ctx: RuleCtx, dt: number) {
  const g = a.g.side;
  const control = a.canAct;
  const mx = control ? clamp(inp.mx, -1, 1) : 0;
  const jumpPressed = control && inp.jump && !a.prevJump;
  const abilityPressed = control && inp.ability && !a.prevAbility;
  a.prevJump = inp.jump;
  a.prevAbility = inp.ability;
  const solids = ar.blockers();

  // ---- ride moving platforms (apply the platform's motion before our own)
  if (a.grounded && a.groundRef >= 0) {
    const e = ar.ents[a.groundRef];
    if (e && e.alive) {
      const nx = a.x + (e.x - e.px);
      if (!hitsAny({ x: nx - a.w / 2, y: a.y + 0.02, w: a.w, h: a.colH - 0.04 }, solids)) a.x = nx;
      a.y += e.y - e.py;
    }
  }

  // ---- duck / brace (stay ducked while a low ceiling is overhead)
  const wantDuck = control && inp.duck && a.g.canDuck;
  if (wantDuck) a.ducking = true;
  else if (a.ducking) {
    if (!hitsAny({ x: a.x - a.w / 2 + 0.02, y: a.y + 0.02, w: a.w - 0.04, h: a.h - 0.02 }, solids)) a.ducking = false;
  }
  a.bracing = a.ducking && a.g.canBrace && a.grounded;

  // ---- zones
  a.onMud = false; a.onSeed = false;
  let windX = 0, windY = 0;
  const me = box(a);
  for (const e of ar.ents) {
    if (e.t === 'mud' && a.grounded && rectOverlap(me, e)) a.onMud = true;
    else if (e.t === 'seed' && a.grounded && rectOverlap(me, e)) a.onSeed = true;
    else if (e.t === 'wind' && e.active && rectOverlap(me, e)) {
      const d = e.def as { fx: number; fy: number };
      windX += d.fx; windY += d.fy;
    }
  }

  // ---- signature ability
  if (abilityPressed && abilityReady(a) && a.g.stage >= 1) {
    startAbility(a, ctx);
    if (a.cls === 'speedy') {
      // Zoomies: ground dash; in the air from stage 3 it is a running flap launch (small lift).
      if (!a.grounded && a.stage >= 3) a.vy = Math.max(a.vy, 4);
    } else if (a.cls === 'mighty') {
      a.vx += a.facing * 3;
      fluffBumpSide(a, ar, others, ctx);
    } else {
      // Fancy Feathers: evasive hop on the ground, extra hop in the air from stage 2.
      if (a.grounded) { a.vy = jumpVelocity(a) * 0.62; a.grounded = false; }
      else if (a.stage >= 2) { a.vy = Math.max(a.vy, jumpVelocity(a) * (a.stage >= 3 ? 0.75 : 0.68)); }
      a.vx += a.facing * 1.5;
    }
  }

  // ---- horizontal control
  const base = g.run * a.tuning.run;
  let target = mx * base * speedMult(a, a.onMud);
  if (a.cls === 'speedy' && a.abilityT > 0 && a.grounded) target = a.facing * base * speedMult(a, a.onMud);
  if (a.ducking) target *= a.bracing && a.cls === 'mighty' ? 0.6 : 0.5;
  let acc = a.grounded ? g.accel : g.airAccel;
  let dec = a.grounded ? g.accel * 1.25 : g.airAccel;
  if (a.onSeed) {
    const sticky = a.hasPower('PU-06');
    acc *= sticky ? 0.75 : 0.3;
    dec *= sticky ? 0.6 : 0.12;
  }
  if (!control) { target = 0; dec = a.grounded ? 8 : 2; }
  const accelerating = target !== 0 && (sign(target) === sign(a.vx) || a.vx === 0) && Math.abs(target) > Math.abs(a.vx);
  a.vx = approach(a.vx, target, (accelerating ? acc : dec) * dt);
  if (mx !== 0 && control) a.facing = mx > 0 ? 1 : -1;

  // ---- wobbly perch: riders slide with the tilt unless braced / sticky
  if (a.grounded && a.groundRef >= 0) {
    const e = ar.ents[a.groundRef];
    if (e && e.t === 'wobbly') {
      let k = 4.5 * Math.sin(e.angle);
      if (a.bracing) k *= a.cls === 'mighty' ? 0.08 : 0.2;
      if (a.hasPower('PU-06')) k *= POWER_TUNING.stickyGrip;
      a.vx += k * dt * 6;
    }
  }

  // ---- jumping, flapping, gliding
  if (jumpPressed) a.jumpBuffer = JUMP_BUFFER; else a.jumpBuffer -= dt;
  if (a.grounded) { a.coyote = COYOTE; a.airHops = 0; } else a.coyote -= dt;
  if (a.grounded && a.g.canFlap) a.stamina = Math.min(a.staminaMax, a.stamina + dt * 2.2);

  const canStand = !a.ducking || !hitsAny({ x: a.x - a.w / 2 + 0.02, y: a.y + 0.02, w: a.w - 0.04, h: a.h }, solids);
  // drop through a one-way plank: duck + jump
  if (a.dropT > 0) a.dropT -= dt;
  if (jumpPressed && control && a.grounded && a.onOneWay && inp.duck) {
    a.dropT = 0.22; a.grounded = false; a.groundRef = -1; a.jumpBuffer = 0; a.y -= 0.05; a.vy = -2;
  } else if (a.jumpBuffer > 0 && (a.grounded || a.coyote > 0) && control && canStand) {
    a.vy = jumpVelocity(a);
    a.grounded = false; a.coyote = 0; a.jumpBuffer = 0;
    a.jumpCutDone = false; a.jumpHeld = true; a.ducking = false;
    a.groundRef = -1;
    ctx.ev.emit({ type: 'jump', a: a.id, x: a.x, y: a.y });
  } else if (jumpPressed && !a.grounded && a.coyote <= 0 && a.g.canFlap && control) {
    const drain = a.hasPower('PU-02') ? POWER_TUNING.superFlapDrain : 1;
    if (a.stamina >= drain * 0.999) {
      a.stamina -= drain;
      a.vy = Math.max(a.vy, flapVelocity(a));
      a.jumpBuffer = 0;
      a.jumpHeld = false;
      a.anim = 'flap'; a.animT = 0;
      ctx.ev.emit({ type: 'flap', a: a.id, x: a.x, y: a.y });
    }
  }
  if (a.jumpHeld && !inp.jump && !a.jumpCutDone && a.vy > JUMP_CUT) { a.vy = JUMP_CUT; a.jumpCutDone = true; }
  if (a.vy <= 0) a.jumpHeld = false;

  let gliding = false;
  if (a.g.canGlide && inp.jump && control && !a.grounded && a.vy < 0) {
    gliding = true;
    if (a.stamina > 0) {
      const drain = a.hasPower('PU-02') ? POWER_TUNING.superFlapDrain : 1;
      a.stamina = Math.max(0, a.stamina - dt * 0.55 * drain);
      a.vy = Math.max(a.vy, a.cls === 'nimble' ? -1.8 : -2.3);
    } else {
      a.vy = Math.max(a.vy, -4.5); // exhausted: safe limited descent, never a hover
    }
  }

  // ---- gravity + wind
  a.vy -= g.gravity * dt;
  if (!a.grounded) { a.vx += windX * dt; a.vy += windY * dt; }
  if (gliding) a.vy = Math.max(a.vy, a.stamina > 0 ? (a.cls === 'nimble' ? -1.8 : -2.3) : -4.5);
  a.vy = Math.max(a.vy, -MAX_FALL);

  // ---- integrate X with solids (push pushables)
  const prevBottom = a.y;
  a.x += a.vx * dt;
  resolveX(a, ar, solids, ctx);
  a.x = clamp(a.x, a.w / 2, ar.def.w - a.w / 2);

  // ---- integrate Y
  a.wasGrounded = a.grounded;
  a.y += a.vy * dt;
  const landedOn = resolveY(a, ar, solids, prevBottom);
  if (landedOn) {
    if (!a.wasGrounded && a.vy <= 0) {
      ctx.ev.emit({ type: 'land', a: a.id, x: a.x, y: a.y, speed: -a.vyBeforeLand });
      a.anim = 'land'; a.animT = 0;
    }
  }

  // ---- springy branch: land → bounce (press jump around the landing for a bigger bounce)
  if (a.grounded && a.groundRef >= 0 && ar.ents[a.groundRef]?.t === 'spring') {
    const e = ar.ents[a.groundRef];
    const d = e.def as { power: number };
    const timed = inp.jump ? 1.18 : 1;
    a.vy = d.power * timed;
    a.grounded = false; a.groundRef = -1; a.jumpHeld = false;
    ctx.ev.emit({ type: 'spring', a: a.id, x: a.x, y: a.y });
  }

  // ---- hazards: eggs, swinging buckets
  const hb = box(a);
  for (const e of ar.ents) {
    if (!e.alive) continue;
    if (e.t === 'egg' && e.active && rectOverlap(hb, { x: e.x + 0.08, y: e.y + 0.05, w: e.w - 0.16, h: e.h - 0.15 })) {
      bump(a, sign(e.vx) || -a.facing, 0.6, 6, 'hazard', ctx, 'OBS-01');
    } else if (e.t === 'bucket' && rectOverlap(hb, e) && a.groundRef !== e.i) {
      const fast = Math.abs(e.vx) > 1.2;
      const ride = (e.def as { ride?: boolean }).ride;
      if (fast && !(ride && a.y >= e.y + e.h - 0.15)) bump(a, sign(e.vx), 0.5, 7, 'hazard', ctx, 'OBS-03');
    }
  }

  // ---- fall out of the world → safe checkpoint, brief protection, small time penalty
  if (a.y < (ar.def.killY ?? -6)) respawn(a, ctx);
  else if (ar.def.fallRecovery && a.grounded) {
    // a long fall from a foothold returns you to the last lantern (if it is higher than where you landed)
    if (a.lastGroundY - a.y > ar.def.fallRecovery && a.checkpointY > a.y + 1) respawn(a, ctx);
    else a.lastGroundY = a.y;
  }

  // Side view: each chick runs on its own depth lane (2.5D), so siblings pass each other.
  // They interact through abilities (Fluff Bump, Zoomies) rather than blocking a single lane.
  void others;

  updateAnim(a, mx, gliding, dt);
}

export function respawn(a: Actor, ctx: RuleCtx) {
  a.x = a.checkpointX; a.y = a.checkpointY + 0.05; a.lastGroundY = a.checkpointY;
  a.vx = 0; a.vy = 0; a.grounded = false; a.groundRef = -1;
  a.stunT = 0.6; a.protectT = 0.6 + 1.5;
  a.stamina = a.staminaMax;
  a.carryBundle = false; a.carryTreats = 0;
  a.anim = 'respawn'; a.animT = 0;
  a.respawns++;
  ctx.ev.emit({ type: 'respawn', a: a.id, x: a.x, y: a.y });
}

export function hitsAny(r: Rect, solids: Rect[]) {
  for (const s of solids) if (!(s as { oneWay?: boolean }).oneWay && rectOverlap(r, s)) return true;
  return false;
}

function resolveX(a: Actor, ar: ArenaRuntime, solids: (Rect & { ent?: Ent; oneWay?: boolean })[], ctx: RuleCtx) {
  const r = { x: a.x - a.w / 2, y: a.y + 0.04, w: a.w, h: a.colH - 0.06 };
  for (const s of solids) {
    if (s.oneWay || !rectOverlap(r, s)) continue;
    const ent = s.ent;
    const movingRight = a.vx > 0 || (a.x < s.x + s.w / 2);
    if (ent && (ent.t === 'bale' || ent.t === 'crate') && a.grounded) {
      const mass = (ent.def as { mass?: number }).mass ?? (ent.t === 'bale' ? 1.0 : 0.5);
      if (a.pushForce >= mass - 1e-6) {
        const pen = movingRight ? r.x + r.w - s.x : -(s.x + s.w - r.x);
        if (tryMoveEnt(ent, pen, ar)) {
          a.vx = clamp(a.vx, -2.2 * a.pushForce / mass, 2.2 * a.pushForce / mass);
          if (a.pushT <= 0) ctx.ev.emit({ type: 'push', a: a.id, x: a.x, y: a.y });
          a.pushT = 0.15;
          continue;
        }
      }
    }
    if (movingRight && a.x < s.x + s.w / 2) a.x = s.x - a.w / 2 - 1e-4;
    else a.x = s.x + s.w + a.w / 2 + 1e-4;
    a.vx = 0;
    r.x = a.x - a.w / 2;
  }
}

function resolveY(a: Actor, ar: ArenaRuntime, solids: (Rect & { ent?: Ent; oneWay?: boolean })[], prevBottom: number): boolean {
  a.vyBeforeLand = a.vy;
  let landed = false;
  a.grounded = false;
  a.groundRef = -1;
  const r = { x: a.x - a.w / 2 + 0.03, y: a.y, w: a.w - 0.06, h: a.colH };
  for (const s of solids) {
    if (s.oneWay || !rectOverlap(r, s)) continue;
    if (a.vy <= 0 && prevBottom >= s.y + s.h - 0.25) {
      a.y = s.y + s.h; a.vy = 0; landed = true; a.grounded = true;
      a.groundKind = (s as { kind?: string }).kind ?? (s.ent ? s.ent.t : 'ground');
      a.groundRef = s.ent ? s.ent.i : -1;
    } else if (a.vy > 0) {
      a.y = s.y - a.colH - 1e-4; a.vy = 0;
    } else {
      // deep overlap from the side while falling: push up only if mostly above
      if (a.y > s.y + s.h * 0.5) { a.y = s.y + s.h; a.vy = 0; landed = true; a.grounded = true; }
    }
    r.y = a.y;
  }
  a.onOneWay = false;
  if (a.vy <= 0 && a.dropT <= 0) {
    for (const p of platforms(ar)) {
      if (r.x + r.w <= p.x || r.x >= p.x + p.w) continue;
      const platDy = p.ent ? p.ent.y - p.ent.py : 0;
      if (prevBottom >= p.top - 0.12 + Math.min(0, platDy) - 0.02 && a.y <= p.top + 0.001 && a.y >= p.top - 0.6) {
        a.y = p.top; a.vy = 0; landed = true; a.grounded = true;
        a.groundRef = p.ent ? p.ent.i : -1;
        a.groundKind = p.kind;
        a.onOneWay = !p.ent || p.ent.t === 'mover';
      }
    }
  }
  return landed;
}

/** Move a pushable along x if nothing blocks it. Returns true on success. */
export function tryMoveEnt(e: Ent, dx: number, ar: ArenaRuntime): boolean {
  const nx = e.x + dx;
  const r = { x: nx, y: e.y + 0.02, w: e.w, h: e.h - 0.04 };
  if (nx < 0 || nx + e.w > ar.def.w) return false;
  for (const s of ar.solids) if (!s.oneWay && rectOverlap(r, s)) return false;
  for (const o of ar.ents) {
    if (o === e || !o.alive) continue;
    if ((o.t === 'bale' || o.t === 'crate' || o.t === 'straw' || (o.t === 'gate' && !o.active)) && rectOverlap(r, o)) return false;
  }
  e.x = nx;
  return true;
}

/** Pushables fall under gravity and slide from Fluff Bump impulses (side arenas). */
export function stepPushablesSide(ar: ArenaRuntime, dt: number) {
  for (const e of ar.ents) {
    if (!e.alive || (e.t !== 'bale' && e.t !== 'crate')) continue;
    if (Math.abs(e.vx) > 0.01) {
      if (!tryMoveEnt(e, e.vx * dt, ar)) e.vx = 0;
      e.vx = approach(e.vx, 0, 10 * dt);
    }
    e.vy -= 30 * dt;
    const ny = e.y + e.vy * dt;
    const r = { x: e.x + 0.02, y: ny, w: e.w - 0.04, h: e.h };
    let blocked = false;
    for (const s of ar.solids) if (rectOverlap(r, s) && (!s.oneWay || e.y >= s.y + s.h - 0.05)) { blocked = true; e.y = s.y + s.h; break; }
    if (!blocked) for (const o of ar.ents) {
      if (o === e || !o.alive || (o.t !== 'bale' && o.t !== 'crate')) continue;
      if (rectOverlap(r, o)) { blocked = true; e.y = o.y + o.h; break; }
    }
    if (blocked) e.vy = 0; else e.y = ny;
    if (e.y < -20) e.alive = false;
  }
}

function fluffBumpSide(a: Actor, ar: ArenaRuntime, others: Actor[], ctx: RuleCtx) {
  const reach = { x: a.facing > 0 ? a.x : a.x - a.w / 2 - 1.0, y: a.y, w: a.w / 2 + 1.0, h: a.colH };
  for (const o of others) {
    if (o === a) continue;
    if (rectOverlap(reach, { x: o.x - o.w / 2, y: o.y, w: o.w, h: o.colH })) bump(o, a.facing, 0.4, 7 * a.pushForce, a.id, ctx);
  }
  for (const e of ar.ents) {
    if (!e.alive || !rectOverlap(reach, e)) continue;
    if (e.t === 'straw') { e.alive = false; ctx.ev.emit({ type: 'break', x: e.x + e.w / 2, y: e.y + e.h / 2 }); }
    else if (e.t === 'bale' || e.t === 'crate') { e.vx = a.facing * 5.5; ctx.ev.emit({ type: 'push', a: a.id, x: e.x, y: e.y }); }
  }
}

/** Peck the straw barrier in front of the actor (interact). */
export function peckSide(a: Actor, ar: ArenaRuntime, ctx: RuleCtx) {
  a.peckT = 0.22;
  ctx.ev.emit({ type: 'peck', a: a.id, x: a.x + a.facing * a.w * 0.5, y: a.y + a.colH * 0.6 });
  const reach = { x: a.facing > 0 ? a.x : a.x - a.w / 2 - 0.45, y: a.y, w: a.w / 2 + 0.45, h: a.colH };
  for (const e of ar.ents) {
    if (e.t === 'straw' && e.alive && rectOverlap(reach, e)) {
      e.hp -= 1;
      if (e.hp <= 0) { e.alive = false; ctx.ev.emit({ type: 'break', x: e.x + e.w / 2, y: e.y + e.h / 2 }); }
      return true;
    }
  }
  return false;
}

function updateAnim(a: Actor, mx: number, gliding: boolean, dt: number) {
  a.animT += dt;
  if (a.stunT > 0) { a.anim = 'bumped'; return; }
  if (a.anim === 'respawn' && a.animT < 0.6) return;
  if (a.finished) { a.anim = 'celebrate'; return; }
  if (a.abilityT > 0) { a.anim = 'ability'; return; }
  if (a.peckT > 0) { a.anim = 'peck'; return; }
  if (!a.grounded) {
    if (a.anim === 'flap' && a.animT < 0.25) return;
    a.anim = gliding ? 'glide' : a.vy > 0 ? 'jump' : 'fall';
    return;
  }
  if (a.anim === 'land' && a.animT < 0.12) return;
  if (a.ducking) { a.anim = a.bracing && Math.abs(a.vx) < 0.3 ? 'brace' : 'duck'; return; }
  if (a.pushT > 0) { a.anim = 'push'; return; }
  if (a.carryBundle || a.carryTreats > 0) { a.anim = Math.abs(a.vx) > 0.3 ? 'carry' : 'carry'; return; }
  a.anim = Math.abs(a.vx) > 0.4 || mx !== 0 ? 'run' : 'idle';
}
