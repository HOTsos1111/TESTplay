import { WORLD } from '../data/config';
import type { ChapterDef } from '../data/chapters';
import { chunkById, OBJECT_SIZE, type BonePattern, type ChunkDef } from '../data/chunks';

/** A placed object in world space, created lazily by the spawner. */
export type Spawnable =
  | { type: 'ground'; x: number; w: number; edgeLeft: boolean; edgeRight: boolean }
  | { type: 'platform'; x: number; w: number; top: number; floating?: boolean }
  | { type: 'crate'; x: number; top: number }
  | { type: 'cardboard'; x: number; top: number; stack: string }
  | { type: 'tyre'; x: number; bottom: number }
  | { type: 'squirrel'; x: number; bottom: number }
  | { type: 'bone'; x: number; y: number; id: string }
  | { type: 'scent'; x: number; y: number }
  | { type: 'hint'; x: number; id: string }
  | { type: 'gate'; x: number }
  | { type: 'burstMarker'; x: number }
  | { type: 'barrel'; x: number }
  | { type: 'lowbar'; x: number; phase?: number }
  | { type: 'powerup'; x: number; y: number; kind: 'magnet' | 'shield' | 'whistle' | 'bacon' }
  | { type: 'lift'; x: number; w: number; lowTop: number; highTop: number; period: number };

export interface LevelLayout {
  items: Spawnable[];
  /** World x where the hero starts a fresh attempt. */
  startX: number;
  /** World x of the street exit; reaching it starts the encounter. */
  encounterX: number;
  /** End of authored content (used for progress display). */
  length: number;
  chunkStarts: { id: string; x: number }[];
}

const LEAD_IN = 1200;
const GROUND_PIECE = 1024;
/** Flat street after the gate; GameScene keeps extending it for as long as the encounter lasts. */
const ENCOUNTER_RUNWAY = 4_000;

function bonePositions(p: BonePattern): { x: number; h: number }[] {
  const out: { x: number; h: number }[] = [];
  if (p.kind === 'line') {
    const sp = p.spacing ?? 60;
    for (let i = 0; i < p.n; i++) out.push({ x: p.x + i * sp, h: p.h });
  } else {
    for (let i = 0; i < p.n; i++) {
      const t = p.n === 1 ? 0.5 : i / (p.n - 1);
      out.push({ x: p.x - p.width / 2 + t * p.width, h: p.h + Math.sin(t * Math.PI) * p.rise });
    }
  }
  return out;
}

/**
 * Fill long empty stretches of floor with gently waving bone trails so no part
 * of a run is barren. Keeps clear of every obstacle, gap and authored bone.
 */
export function autoBoneTrails(c: ChunkDef, chapterId: number, ci: number): { type: 'bone'; x: number; h: number; id: string }[] {
  const blocked: [number, number][] = [[0, 150], [c.length - 120, c.length]];
  const pad = (x: number, w: number, before = 110, after = 110) => blocked.push([x - before, x + w + after]);
  for (const [x, w] of c.gaps ?? []) pad(x, w, 130, 130);
  for (const t of c.tyres ?? []) pad(t.x, OBJECT_SIZE.tyre.w);
  for (const b of c.cardboard ?? []) pad(b.x, OBJECT_SIZE.cardboard.w, 220, 110);
  for (const cr of c.crates ?? []) pad(cr.x, OBJECT_SIZE.crate.w);
  for (const b of c.barrels ?? []) pad(b.x - 320, 380);
  for (const l of c.lowbars ?? []) pad(l.x, 104, 180, 120);
  for (const s of c.squirrels ?? []) pad(s.x, 40);
  for (const p of c.platforms ?? []) pad(p.x, p.w, 40, 40);
  for (const l of c.lifts ?? []) pad(l.x, l.w, 40, 40);
  for (const p of c.powerupSlots ?? []) pad(p.x, 0, 120, 120);
  for (const m of c.burstMarkers ?? []) pad(m.x, 144, 60, 60);
  if (c.exitGate) pad(c.exitGate.x, 0, 200, 400);
  for (const b of c.bones ?? []) {
    const span = b.kind === 'line' ? [b.x, b.x + (b.n - 1) * (b.spacing ?? 60)] : [b.x - b.width / 2, b.x + b.width / 2];
    pad(span[0], span[1] - span[0], 100, 100);
  }
  blocked.sort((a, b) => a[0] - b[0]);
  const out: { type: 'bone'; x: number; h: number; id: string }[] = [];
  let cursor = 0;
  let n = 0;
  const fill = (from: number, to: number) => {
    if (to - from < 340) return;
    for (let x = from + 60; x <= to - 60; x += 70) {
      out.push({ type: 'bone', x, h: 30 + Math.sin(x / 90) * 14, id: `${chapterId}:${ci}:auto:${n++}` });
    }
  };
  for (const [a, b] of blocked) {
    if (a > cursor) fill(cursor, a);
    cursor = Math.max(cursor, b);
  }
  fill(cursor, c.length);
  return out;
}

/** Heights of the three platform tiers (the first is the authored ledge height). */
export const TIERS = [90, 190, 290] as const;

/**
 * A floating sky route over one chunk: up a tier-1 step, a tier-2 deck, a
 * tier-3 deck and back down via tier 2. Each step is one normal jump above the
 * last; it is an optional path, so it is placed only where it neither cuts into
 * crates, hanging bars or lifts nor ends over a pit.
 */
export function skyRoute(c: ChunkDef, ci: number): { x: number; w: number; h: number }[] {
  const ROUTE = [
    { dx: 0, w: 300, h: TIERS[0] },
    { dx: 230, w: 330, h: TIERS[1] },
    { dx: 500, w: 320, h: TIERS[2] },
    { dx: 760, w: 300, h: TIERS[1] },
  ];
  // Things each tier must keep clear of: [x0, x1, tallest point].
  const solid: [number, number, number][] = [];
  for (const cr of c.crates ?? []) solid.push([cr.x - 50, cr.x + OBJECT_SIZE.crate.w + 50, (cr.h ?? 0) + (cr.stack ?? 1) * OBJECT_SIZE.crate.h]);
  for (const cb of c.cardboard ?? []) solid.push([cb.x - 50, cb.x + OBJECT_SIZE.cardboard.w + 50, (cb.h ?? 0) + cb.stack * OBJECT_SIZE.cardboard.h]);
  for (const p of c.platforms ?? []) solid.push([p.x - 60, p.x + p.w + 60, p.h + 40]);
  // Duck beams float low over the street (no ceiling pipes in the guide levels).
  for (const l of c.lowbars ?? []) solid.push([l.x - 60, l.x + 170, 230]);
  for (const l of c.lifts ?? []) solid.push([l.x - 80, l.x + l.w + 80, 9999]);
  for (const b of c.bones ?? []) {
    const top = b.h + (b.kind === 'arc' ? b.rise : 0);
    const [a, z] = b.kind === 'line' ? [b.x, b.x + (b.n - 1) * (b.spacing ?? 60)] : [b.x - b.width / 2, b.x + b.width / 2];
    // Bones just under a deck are fine; only ones that would sit inside it block.
    solid.push([a - 20, z + 20, top + 50]);
  }
  const overGap = (x: number) => (c.gaps ?? []).some(([gx, gw]) => x > gx - 60 && x < gx + gw + 60);
  const end = c.exitGate ? c.exitGate.x - 500 : c.length - 260;
  // Prefer a different spot in each chunk.
  const offset = ((ci * 137) % 5) * 60;
  const fits = (r: { dx: number; w: number; h: number }, s: number) => {
    const x0 = s + r.dx;
    const x1 = x0 + r.w;
    return !solid.some(([a, z, top]) => z > x0 && a < x1 && top > r.h - 40);
  };
  // Full route first, then shorter ones (tier 2 is a double jump from the floor).
  const variants = [ROUTE, ROUTE.slice(1), ROUTE.slice(1, 3), ROUTE.slice(0, 2), [ROUTE[1]]];
  for (const steps of variants) {
    const len = steps[steps.length - 1].dx + steps[steps.length - 1].w;
    for (let s = 260 + offset - steps[0].dx; s + len <= end; s += 40) {
      // Every way down (off each deck's far end) must land on floor.
      if (steps.every((r) => fits(r, s) && !overGap(s + r.dx + r.w + 40)) && !overGap(s + steps[0].dx - 40)) {
        return steps.map((r) => ({ x: s + r.dx, w: r.w, h: r.h }));
      }
    }
  }
  return [];
}

/** How many power-ups appear per run of a chapter. */
export const POWERUPS_PER_RUN = 5;

export function buildLevel(chapter: ChapterDef, random: () => number = Math.random): LevelLayout {
  const g = WORLD.groundY;
  const items: Spawnable[] = [];
  const slots: { x: number; h: number }[] = [];
  const gaps: [number, number][] = [];
  const chunkStarts: { id: string; x: number }[] = [];
  let cursor = 0;
  let encounterX = -1;

  chapter.chunks.forEach((chunkId, ci) => {
    const c: ChunkDef = chunkById(chunkId);
    const o = cursor;
    chunkStarts.push({ id: c.id, x: o });
    for (const [gx, gw] of c.gaps ?? []) gaps.push([o + gx, gw]);
    for (const p of c.platforms ?? []) items.push({ type: 'platform', x: o + p.x, w: p.w, top: g - p.h });
    // Upper tiers: floating decks with a bone trail along the top one.
    if (chapter.skyRoutes && ci > 0) {
      const route = skyRoute(c, ci);
      route.forEach((r, ri) => {
        items.push({ type: 'platform', x: o + r.x, w: r.w, top: g - r.h, floating: true });
        if (r.h > TIERS[0]) {
          for (let k = 0; k < 4; k++) items.push({ type: 'bone', x: o + r.x + 60 + k * ((r.w - 120) / 3), y: g - r.h - 34, id: `${chapter.id}:${ci}:sky${ri}:${k}` });
        }
      });
    }
    for (const cr of c.crates ?? []) {
      const base = cr.h ?? 0;
      for (let i = 0; i < (cr.stack ?? 1); i++) {
        items.push({ type: 'crate', x: o + cr.x, top: g - base - (i + 1) * OBJECT_SIZE.crate.h });
      }
    }
    for (const cb of c.cardboard ?? []) {
      const base = cb.h ?? 0;
      for (let i = 0; i < cb.stack; i++) {
        items.push({ type: 'cardboard', x: o + cb.x, top: g - base - (i + 1) * OBJECT_SIZE.cardboard.h, stack: `${ci}:${cb.x}` });
      }
    }
    for (const t of c.tyres ?? []) items.push({ type: 'tyre', x: o + t.x, bottom: g - (t.h ?? 0) });
    for (const s of c.squirrels ?? []) items.push({ type: 'squirrel', x: o + s.x, bottom: g - (s.h ?? 0) });
    (c.bones ?? []).forEach((p, pi) => {
      bonePositions(p).forEach((b, bi) => {
        items.push({ type: 'bone', x: o + b.x, y: g - b.h, id: `${chapter.id}:${ci}:${pi}:${bi}` });
      });
    });
    for (const s of c.scent ?? []) {
      for (let i = 0; i < s.n; i++) items.push({ type: 'scent', x: o + s.x + i * s.spacing, y: g - s.h - Math.sin((i / Math.max(1, s.n - 1)) * Math.PI) * 40 });
    }
    for (const p of c.powerupSlots ?? []) slots.push({ x: o + p.x, h: p.h });
    for (const l of c.lifts ?? []) items.push({ type: 'lift', x: o + l.x, w: l.w, lowTop: g - l.low, highTop: g - l.high, period: l.period });
    for (const l of c.lowbars ?? []) items.push({ type: 'lowbar', x: o + l.x, phase: l.phase });
    for (const b of c.barrels ?? []) items.push({ type: 'barrel', x: o + b.x });
    for (const m of c.burstMarkers ?? []) items.push({ type: 'burstMarker', x: o + m.x });
    autoBoneTrails(c, chapter.id, ci).forEach((b) => items.push({ ...b, x: o + b.x, y: g - b.h }));
    if (c.hint) items.push({ type: 'hint', x: o + c.hint.x, id: c.hint.id });
    if (c.exitGate) {
      encounterX = o + c.exitGate.x;
      items.push({ type: 'gate', x: encounterX });
    }
    cursor += c.length;
  });

  if (encounterX < 0) encounterX = cursor;

  // Power-ups: a different random handful of spots and kinds every run. Low
  // spots get raised so grabbing one takes a deliberate, well-timed jump.
  const pool = [...slots];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const kinds: ('magnet' | 'shield' | 'whistle' | 'bacon')[] = ['magnet', 'shield', 'whistle', 'bacon'];
  kinds.push(kinds[Math.floor(random() * kinds.length)]);
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  pool.slice(0, POWERUPS_PER_RUN).forEach((slot, i) => {
    const h = slot.h < 120 ? [145, 170, 215][Math.floor(random() * 3)] : slot.h;
    items.push({ type: 'powerup', x: slot.x + (random() - 0.5) * 80, y: g - h, kind: kinds[i % kinds.length] });
  });

  // Ground: everything from the lead-in to the end of the encounter runway, minus gaps.
  gaps.sort((a, b) => a[0] - b[0]);
  const segments: [number, number][] = [];
  let start = -LEAD_IN;
  for (const [gx, gw] of gaps) {
    if (gx > start) segments.push([start, gx]);
    start = Math.max(start, gx + gw);
  }
  segments.push([start, cursor + ENCOUNTER_RUNWAY]);
  segments.forEach(([a, b], si) => {
    for (let x = a; x < b; x += GROUND_PIECE) {
      const w = Math.min(GROUND_PIECE, b - x);
      items.push({ type: 'ground', x, w, edgeLeft: si > 0 && x === a, edgeRight: si < segments.length - 1 && x + w >= b });
    }
  });

  items.sort((a, b) => a.x - b.x);
  return { items, startX: 0, encounterX, length: cursor, chunkStarts };
}
