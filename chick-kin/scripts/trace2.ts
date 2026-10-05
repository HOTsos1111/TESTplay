// trace with harness-identical setup (runLevel seeds) for actor W
import { levelById } from '../src/data/levels';
import { Match } from '../src/sim/match';
import { SiblingAI, PERSONALITIES, skillFor } from '../src/sim/ai';
import { CLASSES, type ChickClass } from '../src/data/classes';
const [id, cls, seedS = '7', W = '0', every = '1', from = '0'] = process.argv.slice(2);
const level = levelById(id)!; const seed = +seedS; const player = cls as ChickClass;
const rivals = CLASSES.filter((c) => c !== player).concat([player]).slice(0, 3);
const m = new Match({ level, stage: level.chapter, seed, difficulty: 'standard', generation: 1, noCountdown: true,
  competitors: [{ cls: player, name: 'Player', isPlayer: true }, ...rivals.map((c, i) => ({ cls: c, name: `Sib${i + 1}`, isPlayer: false }))] });
const ais = m.actors.map((a, i) => new SiblingAI(a.id, PERSONALITIES[(['bossy', 'scrappy', 'snacky'] as const)[i % 3]], skillFor('standard', 1, i === 0), seed * 31 + i));
let next = +from;
for (let n = 0; n < 120 * 260 && m.state !== 'done'; n++) {
  const inp = ais.map((ai) => ai.think(m, 1 / 120));
  m.step(1 / 120, inp);
  const w = +W; const a = m.actors[w];
  for (const e of m.ev.drain()) if ('a' in e && (e as { a: number }).a === w && ['respawn', 'bump', 'complete', 'pickup'].includes(e.type)) console.log(`  ${m.t.toFixed(2)} ${e.type} ${JSON.stringify(e)}`);
  if (m.t >= next) { next += +every; const ai = ais[w] as unknown as { node: number }; console.log(`${m.t.toFixed(1)} x=${a.x.toFixed(2)} y=${a.y.toFixed(2)} vx=${a.vx.toFixed(1)} vy=${a.vy.toFixed(1)} g=${a.grounded} anim=${a.anim} node=${ai.node} st=${a.stamina.toFixed(1)} inp=${JSON.stringify(inp[w])}`); }
}
