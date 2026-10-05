// Content validation: ids, references and geometry sanity for every level (fails visibly here,
// never in a player's session).
import { describe, it, expect } from 'vitest';
import { LEVELS } from '../src/data/levels';
import { ArenaRuntime } from '../src/sim/arena';
import { NavGrid } from '../src/sim/nav';
import { pointInRect } from '../src/sim/math';
import { POWERS } from '../src/data/items';
import type { ArenaDef, LevelDef } from '../src/sim/types';

const arenas = (l: LevelDef) => [...l.phases.map((p) => ({ name: p.name, a: p.arena, o: p.objective })), ...(l.tiebreak ? [{ name: 'tiebreak', a: l.tiebreak.arena, o: l.tiebreak.objective }] : [])];

function insideSolid(a: ArenaDef, x: number, y: number, margin = 0) {
  return a.solids.some((s) => !s.oneWay && pointInRect(x, y, { x: s.x - margin, y: s.y - margin, w: s.w + margin * 2, h: s.h + margin * 2 }) && (a.mode === 'side' || (s.height ?? 1.2) > 0.5));
}

describe('level content', () => {
  it('has 25 levels with unique ids, 5 per chapter', () => {
    expect(LEVELS.length).toBe(25);
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(25);
    for (let c = 1; c <= 5; c++) expect(LEVELS.filter((l) => l.chapter === c).map((l) => l.index)).toEqual([1, 2, 3, 4, 5]);
  });

  for (const l of LEVELS) {
    describe(`${l.id} ${l.title}`, () => {
      for (const { name, a, o } of arenas(l)) {
        it(`${name}: starts and items are clear of solids`, () => {
          expect(a.starts.length).toBeGreaterThanOrEqual(4);
          for (const [x, y] of a.starts) expect(insideSolid(a, x, a.mode === 'side' ? y + 0.3 : y, a.mode === 'top' ? 0.25 : 0), `start ${x},${y}`).toBe(false);
          for (const e of a.entities) {
            if (e.t === 'crumb' || e.t === 'feather' || e.t === 'power' || e.t === 'scratch' || e.t === 'tugworm' || e.t === 'checkpoint' || e.t === 'basket' || e.t === 'cornpile') {
              expect(insideSolid(a, e.x, a.mode === 'side' ? e.y + 0.2 : e.y), `${e.t} at ${e.x},${e.y}`).toBe(false);
            }
            if (e.t === 'power') expect(POWERS[e.pu]).toBeTruthy();
          }
        });
        it(`${name}: objective entities exist`, () => {
          const has = (t: string) => a.entities.some((e) => e.t === t);
          if (o.kind === 'collect') expect(has('crumb')).toBe(true);
          if (o.kind === 'tug') expect(has('tugworm')).toBe(true);
          if (o.kind === 'perch') expect(has('perch')).toBe(true);
          if (o.kind === 'race' || o.kind === 'reach') expect(has('finish')).toBe(true);
          if (o.kind === 'reach' && o.feathers) expect(a.entities.filter((e) => e.t === 'feather').length).toBeGreaterThanOrEqual(o.feathers);
          if (o.kind === 'deliver' || o.kind === 'mostDeliveries') expect(has('basket')).toBe(true);
          if (o.kind === 'deliver' && o.cargo === 'bundle') expect(has('cornpile')).toBe(true);
          if (o.kind === 'deliver' && o.cargo === 'treat') expect(has('scratch')).toBe(true);
          if (a.mode === 'side') expect((a.routes ?? []).some((r) => r.color === 'common'), 'side arenas need a common AI route').toBe(true);
        });
        if (a.mode === 'top') {
          it(`${name}: every objective item is reachable from every start`, () => {
            const ar = new ArenaRuntime(a);
            const g = new NavGrid(ar, 0.3, 0.3);
            g.refresh();
            const targets = a.entities.filter((e) => ['crumb', 'tugworm', 'scratch', 'basket', 'cornpile', 'perch'].includes(e.t)) as { x: number; y: number; w?: number; h?: number; t: string }[];
            for (const [sx, sy] of a.starts) for (const t of targets) {
              const tx = t.t === 'perch' ? t.x + (t.w ?? 0) / 2 : t.x, ty = t.t === 'perch' ? t.y + (t.h ?? 0) / 2 : t.y;
              expect(g.path(sx, sy, tx, ty, { hop: true, gate: true, straw: true }), `${t.t} ${tx},${ty} from ${sx},${sy}`).not.toBeNull();
            }
          });
        }
      }
    });
  }
});
