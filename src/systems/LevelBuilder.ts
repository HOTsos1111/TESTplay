import { WORLD } from '../data/config';
import type { ChapterDef } from '../data/chapters';
import { chunkById, OBJECT_SIZE, type BonePattern, type ChunkDef } from '../data/chunks';

/** A placed object in world space, created lazily by the spawner. */
export type Spawnable =
  | { type: 'ground'; x: number; w: number; edgeLeft: boolean; edgeRight: boolean }
  | { type: 'platform'; x: number; w: number; top: number }
  | { type: 'crate'; x: number; top: number }
  | { type: 'cardboard'; x: number; top: number; stack: string }
  | { type: 'tyre'; x: number; bottom: number }
  | { type: 'squirrel'; x: number; bottom: number }
  | { type: 'bone'; x: number; y: number; id: string }
  | { type: 'scent'; x: number; y: number }
  | { type: 'hint'; x: number; id: string }
  | { type: 'gate'; x: number }
  | { type: 'burstMarker'; x: number };

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

export function buildLevel(chapter: ChapterDef): LevelLayout {
  const g = WORLD.groundY;
  const items: Spawnable[] = [];
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
    for (const m of c.burstMarkers ?? []) items.push({ type: 'burstMarker', x: o + m.x });
    if (c.hint) items.push({ type: 'hint', x: o + c.hint.x, id: c.hint.id });
    if (c.exitGate) {
      encounterX = o + c.exitGate.x;
      items.push({ type: 'gate', x: encounterX });
    }
    cursor += c.length;
  });

  if (encounterX < 0) encounterX = cursor;

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
