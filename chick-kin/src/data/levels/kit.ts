// Authoring helpers for level geometry. Levels stay plain data; these only reduce repetition.
import type { SolidDef, SolidKind, EntityDef, RouteNode } from '../../sim/types';

// ---------------------------------------------------------------- side view (y up, feet on top surfaces)
/** Solid ground slab whose top surface is at y. */
export const ground = (x0: number, x1: number, y = 0, kind: SolidKind = 'ground'): SolidDef => ({ x: x0, y: y - 4, w: x1 - x0, h: 4, kind });
/** Thin one-way plank you can jump up through; top surface at y. */
export const plank = (x: number, y: number, w: number, kind: SolidKind = 'plank'): SolidDef => ({ x, y: y - 0.3, w, h: 0.3, kind, oneWay: true });
/** Solid block from y0 to y1. */
export const block = (x: number, y0: number, w: number, y1: number, kind: SolidKind = 'wood'): SolidDef => ({ x, y: y0, w, h: y1 - y0, kind });
/** Low fence: solid from (groundY + gap) up to groundY + 2.4 — duck underneath. */
export const lowFence = (x: number, groundY: number, w = 0.5, gap = 0.62): SolidDef => ({ x, y: groundY + gap, w, h: 2.4 - gap, kind: 'fence', lowFence: true });
/** Stairs up from (x, y0) with n steps of rise/run. */
export function steps(x: number, y0: number, n: number, rise: number, run: number, kind: SolidKind = 'wood'): SolidDef[] {
  const out: SolidDef[] = [];
  for (let i = 1; i <= n; i++) out.push(block(x + (i - 1) * run, y0 - 2, run * (n - i + 1) + 0.001, y0 + rise * i, kind));
  return out;
}

// ---------------------------------------------------------------- top-down (plane x/y, walls have a height)
export const wall = (x: number, y: number, w: number, h: number, height = 1.2, kind: SolidKind = 'straw'): SolidDef => ({ x, y, w, h, height, kind });
/** Approximate an oval rim with box segments; `gaps` are angles (radians) left open. */
export function ovalRim(cx: number, cy: number, rx: number, ry: number, segs = 28, thick = 0.7, height = 1.2, gaps: number[] = [], kind: SolidKind = 'nestrim'): SolidDef[] {
  const out: SolidDef[] = [];
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    if (gaps.some((g) => Math.abs(angleDiff(a, g)) < Math.PI / segs * 1.6)) continue;
    const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
    const s = Math.max(rx, ry) * Math.PI * 2 / segs * 0.75 + thick * 0.5;
    out.push({ x: x - s / 2, y: y - s / 2, w: s, h: s, height, kind });
  }
  return out;
}
const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

/** Rectangular arena border walls. */
export function border(w: number, h: number, t = 0.6, height = 1.4, kind: SolidKind = 'fence'): SolidDef[] {
  return [wall(0, 0, w, t, height, kind), wall(0, h - t, w, t, height, kind), wall(0, 0, t, h, height, kind), wall(w - t, 0, t, h, height, kind)];
}

export const crumbs = (pts: [number, number][]): EntityDef[] => pts.map(([x, y]) => ({ t: 'crumb', x, y }));
export function crumbRing(cx: number, cy: number, rx: number, ry: number, n: number, phase = 0): EntityDef[] {
  const out: EntityDef[] = [];
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2;
    out.push({ t: 'crumb', x: +(cx + Math.cos(a) * rx).toFixed(2), y: +(cy + Math.sin(a) * ry).toFixed(2) });
  }
  return out;
}
export const crumbLine = (x0: number, y0: number, x1: number, y1: number, n: number): EntityDef[] =>
  Array.from({ length: n }, (_, i) => ({ t: 'crumb' as const, x: +(x0 + ((x1 - x0) * i) / Math.max(1, n - 1)).toFixed(2), y: +(y0 + ((y1 - y0) * i) / Math.max(1, n - 1)).toFixed(2) }));

export const route = (pts: (RouteNode | [number, number] | [number, number, RouteNode['a']])[]): RouteNode[] =>
  pts.map((p) => (Array.isArray(p) ? { x: p[0], y: p[1], ...(p[2] ? { a: p[2] } : {}) } : p));

/** Four start slots in a row (side) or a small diamond (top). */
export const sideStarts = (x: number, y: number): [number, number][] => [[x, y], [x + 0.9, y], [x + 1.8, y], [x + 2.7, y]];
export const topStarts = (x: number, y: number, spread = 0.9): [number, number][] => [[x - spread * 1.5, y], [x - spread * 0.5, y], [x + spread * 0.5, y], [x + spread * 1.5, y]];
