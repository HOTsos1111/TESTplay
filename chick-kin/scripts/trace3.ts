// top-down solo trace with targets
import { levelById } from '../src/data/levels';
import { Match } from '../src/sim/match';
import { SiblingAI, PERSONALITIES, skillFor } from '../src/sim/ai';
import type { ChickClass } from '../src/data/classes';
const [id, cls, every = '2', until = '60'] = process.argv.slice(2);
const level = levelById(id)!;
const m = new Match({ level, stage: level.chapter, seed: 7, difficulty: 'standard', generation: 1, noCountdown: true,
  competitors: [{ cls: cls as ChickClass, name: 'P', isPlayer: true }, { cls: 'speedy', name: 'A', isPlayer: false }, { cls: 'mighty', name: 'B', isPlayer: false }, { cls: 'nimble', name: 'C', isPlayer: false }] });
const ai = new SiblingAI(0, PERSONALITIES.bossy, skillFor('standard', 1, true), 7);
let next = 0;
const idle = { mx: 0, my: 0, jump: false, interact: false, ability: false, duck: false };
for (let n = 0; n < 120 * +until && m.state !== 'done'; n++) {
  const inp = ai.think(m, 1 / 120);
  m.step(1 / 120, [inp, idle, idle, idle]);
  for (const e of m.ev.drain()) if ('a' in e && (e as { a: number }).a === 0 && ['pickup', 'deliver', 'bump', 'drop'].includes(e.type)) console.log(`  ${m.t.toFixed(2)} ${e.type}`);
  if (m.t >= next) { next += +every; const a = m.actors[0]; const t = (ai as unknown as { target: { kind: string; x: number; y: number } | null }).target; console.log(`${m.t.toFixed(1)} (${a.x.toFixed(2)},${a.y.toFixed(2)}) z=${a.z.toFixed(2)} carry=${a.carryBundle ? 'B' : a.carryTreats} del=${a.st.delivered} tgt=${t ? `${t.kind}(${t.x.toFixed(1)},${t.y.toFixed(1)})` : '-'} inp=${inp.mx.toFixed(2)},${inp.my.toFixed(2)} j${+inp.jump} i${+inp.interact}`); }
}
