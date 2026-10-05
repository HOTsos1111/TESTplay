// Grid navigation for top-down arenas: A* over an occupancy grid rebuilt when dynamic blockers change.
import type { ArenaRuntime } from './arena';
import { topBlockers } from './physicsTop';

export const CELL = 0.35;
export const enum C { Free = 0, Wall = 1, Hop = 2, Gate = 3, Straw = 4, Push = 5 }

export class NavGrid {
  readonly cols: number;
  readonly rows: number;
  cells: Uint8Array;
  private builtAt = -1;
  constructor(readonly ar: ArenaRuntime, readonly radius: number, readonly hopClear: number, readonly push = 0) {
    this.cols = Math.ceil(ar.def.w / CELL);
    this.rows = Math.ceil(ar.def.h / CELL);
    this.cells = new Uint8Array(this.cols * this.rows);
  }

  /** Rebuild at most ~3×/s (gates, straw and pushables change). */
  refresh() {
    if (this.builtAt >= 0 && this.ar.time - this.builtAt < 0.33) return;
    this.builtAt = this.ar.time;
    this.cells.fill(0);
    const r = this.radius;
    for (const b of topBlockers(this.ar)) {
      let kind: C = b.height * 0.85 < this.hopClear - 0.2 ? C.Hop : C.Wall;
      if (b.ent?.t === 'gate') kind = C.Gate;
      else if (b.ent?.t === 'straw') kind = C.Straw;
      else if ((b.ent?.t === 'crate' || b.ent?.t === 'bale') && this.push >= ((b.ent.def as { mass?: number }).mass ?? (b.ent.t === 'bale' ? 1 : 0.5))) kind = C.Push;
      const x0 = Math.max(0, Math.floor((b.x - r) / CELL)), x1 = Math.min(this.cols - 1, Math.floor((b.x + b.w + r) / CELL));
      const y0 = Math.max(0, Math.floor((b.y - r) / CELL)), y1 = Math.min(this.rows - 1, Math.floor((b.y + b.h + r) / CELL));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const cx = (x + 0.5) * CELL, cy = (y + 0.5) * CELL;
        const nx = Math.max(b.x, Math.min(cx, b.x + b.w)), ny = Math.max(b.y, Math.min(cy, b.y + b.h));
        if (Math.hypot(cx - nx, cy - ny) > r) continue;
        const i = y * this.cols + x;
        if (this.cells[i] === C.Wall) continue;
        if (kind === C.Wall || this.cells[i] === 0) this.cells[i] = kind;
      }
    }
    // arena border
    for (let x = 0; x < this.cols; x++) { this.cells[x] = C.Wall; this.cells[(this.rows - 1) * this.cols + x] = C.Wall; }
    for (let y = 0; y < this.rows; y++) { this.cells[y * this.cols] = C.Wall; this.cells[y * this.cols + this.cols - 1] = C.Wall; }
  }

  at(x: number, y: number) {
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return C.Wall;
    return this.cells[cy * this.cols + cx] as C;
  }

  /** A* path from (sx,sy) to (tx,ty). Hop/gate/straw cells are passable at extra cost. */
  path(sx: number, sy: number, tx: number, ty: number, allow: { hop: boolean; gate: boolean; straw: boolean }): [number, number][] | null {
    const cols = this.cols, rows = this.rows;
    const s = this.nearestFree(Math.floor(sx / CELL), Math.floor(sy / CELL));
    const t = this.nearestFree(Math.floor(tx / CELL), Math.floor(ty / CELL));
    if (s < 0 || t < 0) return null;
    const n = cols * rows;
    const g = new Float32Array(n).fill(Infinity);
    const from = new Int32Array(n).fill(-1);
    const closed = new Uint8Array(n);
    const heap = new MinHeap();
    g[s] = 0;
    const tcx = t % cols, tcy = (t / cols) | 0;
    const h = (i: number) => { const x = i % cols, y = (i / cols) | 0; const dx = Math.abs(x - tcx), dy = Math.abs(y - tcy); return (dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy)); };
    heap.push(s, h(s));
    let iter = 0;
    while (heap.size && iter++ < 20000) {
      const cur = heap.pop();
      if (cur === t) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cx = cur % cols, cy = (cur / cols) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const ni = ny * cols + nx;
        const cost = this.cost(this.cells[ni] as C, allow);
        if (cost === Infinity) continue;
        if (dx && dy) {
          // no corner cutting
          if (this.cost(this.cells[cy * cols + nx] as C, allow) === Infinity || this.cost(this.cells[ny * cols + cx] as C, allow) === Infinity) continue;
        }
        const ng = g[cur] + (dx && dy ? Math.SQRT2 : 1) * cost;
        if (ng < g[ni]) { g[ni] = ng; from[ni] = cur; heap.push(ni, ng + h(ni)); }
      }
    }
    if (from[t] < 0 && t !== s) return null;
    const out: [number, number][] = [];
    for (let i = t; i >= 0; i = from[i]) { out.push([(i % cols + 0.5) * CELL, (((i / cols) | 0) + 0.5) * CELL]); if (i === s) break; }
    out.reverse();
    return out;
  }

  private cost(c: C, allow: { hop: boolean; gate: boolean; straw: boolean }) {
    switch (c) {
      case C.Free: return 1;
      case C.Wall: return Infinity;
      case C.Hop: return allow.hop ? 2.5 : Infinity;
      case C.Gate: return allow.gate ? 3 : Infinity;
      case C.Straw: return allow.straw ? 4 : Infinity;
      case C.Push: return 3;
    }
  }

  private nearestFree(cx: number, cy: number): number {
    for (let r = 0; r < 8; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) continue;
        if (this.cells[y * this.cols + x] !== C.Wall) return y * this.cols + x;
      }
    }
    return -1;
  }
}

class MinHeap {
  private ids: number[] = [];
  private ks: number[] = [];
  get size() { return this.ids.length; }
  push(id: number, k: number) {
    this.ids.push(id); this.ks.push(k);
    let i = this.ids.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.ks[p] <= this.ks[i]) break;
      [this.ids[p], this.ids[i]] = [this.ids[i], this.ids[p]];
      [this.ks[p], this.ks[i]] = [this.ks[i], this.ks[p]];
      i = p;
    }
  }
  pop(): number {
    const top = this.ids[0];
    const lid = this.ids.pop()!, lk = this.ks.pop()!;
    if (this.ids.length) {
      this.ids[0] = lid; this.ks[0] = lk;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < this.ids.length && this.ks[l] < this.ks[m]) m = l;
        if (r < this.ids.length && this.ks[r] < this.ks[m]) m = r;
        if (m === i) break;
        [this.ids[m], this.ids[i]] = [this.ids[i], this.ids[m]];
        [this.ks[m], this.ks[i]] = [this.ks[i], this.ks[m]];
        i = m;
      }
    }
    return top;
  }
}
