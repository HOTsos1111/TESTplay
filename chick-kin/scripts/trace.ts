import { levelById } from '../src/data/levels';
import { Match } from '../src/sim/match';
import { SiblingAI, PERSONALITIES, skillFor } from '../src/sim/ai';
import type { ChickClass } from '../src/data/classes';
const [id, cls, who = '0', every = '0.5', passive = '1'] = process.argv.slice(2);
const level = levelById(id)!;
const m = new Match({ level, stage: level.chapter, seed: 7, difficulty: 'standard', generation: 1, noCountdown: true,
  competitors: [{ cls: cls as ChickClass, name: 'P', isPlayer: true }, { cls: 'speedy', name: 'A', isPlayer: false }, { cls: 'mighty', name: 'B', isPlayer: false }, { cls: 'nimble', name: 'C', isPlayer: false }] });
const ais = m.actors.map((a, i) => new SiblingAI(a.id, PERSONALITIES.bossy, skillFor('standard', 1, i === 0), 7 + i));
const W = +who; let next = 0;
for (let n = 0; n < 120 * 200 && m.state !== 'done'; n++) {
  const inp = ais.map((ai, i) => (passive === '1' && i !== W ? { mx: 0, my: 0, jump: false, interact: false, ability: false, duck: false } : ai.think(m, 1 / 120)));
  m.step(1 / 120, inp);
  const ev = m.ev.drain().filter((e) => 'a' in e && (e as { a: number }).a === W && !['step'].includes(e.type));
  const a = m.actors[W];
  for (const e of ev) if (['respawn', 'bump', 'complete', 'phase'].includes(e.type)) console.log(`  ${m.t.toFixed(2)} EVENT ${e.type}`);
  if (m.t >= next) { next += +every; const ai = ais[W] as unknown as { node: number; route: { color: string } | null }; console.log(`${m.t.toFixed(1)} x=${a.x.toFixed(2)} y=${a.y.toFixed(2)} vx=${a.vx.toFixed(1)} vy=${a.vy.toFixed(1)} g=${a.grounded} anim=${a.anim} node=${ai.node} ${ai.route?.color ?? ''} inp=${JSON.stringify(inp[W])}`); }
}
console.log('state', m.state, m.result);
