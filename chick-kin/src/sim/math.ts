// Small deterministic math helpers shared by simulation, AI and tests.

export interface V2 { x: number; y: number }

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const sign = (v: number) => (v > 0 ? 1 : v < 0 ? -1 : 0);
export const approach = (v: number, target: number, step: number) =>
  v < target ? Math.min(v + step, target) : Math.max(v - step, target);
export const len = (x: number, y: number) => Math.sqrt(x * x + y * y);

/** Mulberry32: tiny seeded PRNG. Same seed => same sequence on every platform. */
export function makeRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (lo: number, hi: number) => lo + (hi - lo) * next(),
    int: (lo: number, hiInclusive: number) => lo + Math.floor(next() * (hiInclusive - lo + 1)),
    pick: <T>(arr: readonly T[]) => arr[Math.floor(next() * arr.length)],
    chance: (p: number) => next() < p,
    shuffle: <T>(arr: T[]) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
  };
}
export type Rng = ReturnType<typeof makeRng>;

/** Stable 32-bit string hash (FNV-1a) for deriving seeds from ids. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Axis-aligned rectangle in the active play plane (side: x/y, top-down: x/z stored as x/y). */
export interface Rect { x: number; y: number; w: number; h: number }
export const rectOverlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export const pointInRect = (px: number, py: number, r: Rect) =>
  px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;

/** Closest point on rect to a circle centre; returns penetration push-out vector or null. */
export function circleRectPush(cx: number, cy: number, r: number, rc: Rect): V2 | null {
  const nx = clamp(cx, rc.x, rc.x + rc.w);
  const ny = clamp(cy, rc.y, rc.y + rc.h);
  let dx = cx - nx;
  let dy = cy - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 > r * r) return null;
  if (d2 < 1e-9) {
    // Centre is inside: push out along the shallowest axis.
    const left = cx - rc.x, right = rc.x + rc.w - cx, top = cy - rc.y, bottom = rc.y + rc.h - cy;
    const m = Math.min(left, right, top, bottom);
    if (m === left) return { x: -(left + r), y: 0 };
    if (m === right) return { x: right + r, y: 0 };
    if (m === top) return { x: 0, y: -(top + r) };
    return { x: 0, y: bottom + r };
  }
  const d = Math.sqrt(d2);
  dx /= d;
  dy /= d;
  return { x: dx * (r - d), y: dy * (r - d) };
}
