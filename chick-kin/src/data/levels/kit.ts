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

// ---------------------------------------------------------------- mazes (top-down)
/**
 * Braided maze on a room grid, generated once from a fixed seed (the layout is authored data, stable
 * across plays). Returns ASCII rows: '#' tall straw wall, '-' low straw (hop), '.' floor,
 * 'S' start tile, 'P' power-up tile, 'C' clearing floor.
 */
export function braidedMaze(roomsW: number, roomsH: number, seed: number, opts: { braid?: number; extraOpen?: number; lowWalls?: number; clearing?: [number, number, number, number]; startRow?: boolean } = {}): string[] {
  let a = seed >>> 0;
  const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const W = roomsW * 2 + 1, H = roomsH * 2 + 1;
  const g: string[][] = Array.from({ length: H }, () => Array.from({ length: W }, () => '#'));
  const open = (rx: number, ry: number) => (g[ry * 2 + 1][rx * 2 + 1] = '.');
  const seen = new Set<string>();
  const stack: [number, number][] = [[Math.floor(roomsW / 2), roomsH - 1]];
  seen.add(stack[0].join());
  open(...stack[0]);
  const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const n = dirs.map(([dx, dy]) => [x + dx, y + dy] as [number, number]).filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < roomsW && ny < roomsH && !seen.has(`${nx},${ny}`));
    if (!n.length) { stack.pop(); continue; }
    const [nx, ny] = n[Math.floor(rnd() * n.length)];
    g[y + ny + 1][x + nx + 1] = '.';
    open(nx, ny);
    seen.add(`${nx},${ny}`);
    stack.push([nx, ny]);
  }
  // braid: knock through most dead ends so siblings can loop and cut each other off
  for (let ry = 0; ry < roomsH; ry++) for (let rx = 0; rx < roomsW; rx++) {
    const cx = rx * 2 + 1, cy = ry * 2 + 1;
    const walls = dirs.filter(([dx, dy]) => g[cy + dy][cx + dx] === '#' && cx + dx * 2 > 0 && cy + dy * 2 > 0 && cx + dx * 2 < W - 1 && cy + dy * 2 < H - 1);
    if (4 - dirs.filter(([dx, dy]) => g[cy + dy][cx + dx] === '#').length === 1 && walls.length && rnd() < (opts.braid ?? 0.75)) {
      const [dx, dy] = walls[Math.floor(rnd() * walls.length)];
      g[cy + dy][cx + dx] = '.';
    }
  }
  // a few extra openings
  for (let i = 0; i < (opts.extraOpen ?? 0); i++) {
    const x = 1 + Math.floor(rnd() * (W - 2)), y = 1 + Math.floor(rnd() * (H - 2));
    if ((x % 2) !== (y % 2) && g[y][x] === '#') g[y][x] = '.';
  }
  // some remaining interior walls become low straw you can hop (shortcuts)
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (g[y][x] === '#' && (x % 2) !== (y % 2) && rnd() < (opts.lowWalls ?? 0.15)) g[y][x] = '-';
  }
  if (opts.clearing) {
    const [x0, y0, x1, y1] = opts.clearing;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = 'C';
    g[Math.floor((y0 + y1) / 2)][Math.floor((x0 + x1) / 2)] = 'P';
  }
  if (opts.startRow) {
    const mid = Math.floor(W / 2);
    for (let x = mid - 3; x <= mid + 3; x++) { g[H - 2][x] = x >= mid - 2 && x <= mid + 1 ? 'S' : '.'; g[H - 3][x] = g[H - 3][x] === '#' && (x % 2 === 0) ? '#' : '.'; }
  }
  return g.map((r) => r.join(''));
}

/** Turn ASCII maze rows into merged wall rectangles plus useful point lists (cell size in metres). */
export function mazeFromAscii(rows: string[], cell: number) {
  const solids: SolidDef[] = [];
  const H = rows.length, W = rows[0].length;
  const used = rows.map((r) => r.split('').map(() => false));
  for (const [ch, height] of [['#', 1.2], ['-', 0.32]] as const) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (rows[y][x] !== ch || used[y][x]) continue;
      // prefer horizontal runs, else vertical runs
      let x1 = x; while (x1 + 1 < W && rows[y][x1 + 1] === ch && !used[y][x1 + 1]) x1++;
      let y1 = y; if (x1 === x) while (y1 + 1 < H && rows[y1 + 1][x] === ch && !used[y1 + 1][x]) y1++;
      for (let yy = y; yy <= y1; yy++) for (let xx = x; xx <= x1; xx++) used[yy][xx] = true;
      // slim the wall across its run so corridors feel roomy and walls don't hide the chicks
      const m = cell * 0.17;
      const horiz = x1 > x, vert = y1 > y;
      solids.push({ x: x * cell + (vert || !horiz ? m : 0), y: y * cell + (horiz || !vert ? m : 0), w: (x1 - x + 1) * cell - (vert || !horiz ? 2 * m : 0), h: (y1 - y + 1) * cell - (horiz || !vert ? 2 * m : 0), height, kind: 'straw' });
    }
  }
  const pts = (pred: (c: string) => boolean) => {
    const out: [number, number][] = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (pred(rows[y][x])) out.push([+((x + 0.5) * cell).toFixed(2), +((y + 0.5) * cell).toFixed(2)]);
    return out;
  };
  return { solids, w: W * cell, h: H * cell, floor: pts((c) => c === '.' || c === 'C'), starts: pts((c) => c === 'S'), power: pts((c) => c === 'P') };
}
