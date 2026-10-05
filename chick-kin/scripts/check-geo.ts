import { LEVELS } from '../src/data/levels';
import { pointInRect } from '../src/sim/math';
for (const l of LEVELS) for (const p of [...l.phases, ...(l.tiebreak ? [l.tiebreak] : [])]) {
  const a = p.arena;
  const bad = (x: number, y: number, m: number) => a.solids.some((s) => !s.oneWay && pointInRect(x, y, { x: s.x - m, y: s.y - m, w: s.w + 2 * m, h: s.h + 2 * m }) && (a.mode === 'side' || (s.height ?? 1.2) > 0.5));
  a.starts.forEach(([x, y]) => { if (bad(x, a.mode === 'side' ? y + 0.3 : y, a.mode === 'top' ? 0.25 : 0)) console.log(l.id, p.name, 'start', x, y); });
  for (const e of a.entities) if ('x' in e && ['crumb', 'feather', 'power', 'scratch', 'tugworm', 'checkpoint', 'basket', 'cornpile'].includes(e.t)) if (bad(e.x, a.mode === 'side' ? e.y + 0.2 : e.y, 0)) console.log(l.id, p.name, e.t, e.x, e.y);
}
