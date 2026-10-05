import { levelById } from '../src/data/levels';
import { Match } from '../src/sim/match';
import { SiblingAI, PERSONALITIES, skillFor } from '../src/sim/ai';
const level = levelById(process.argv[2] ?? '1-5')!;
const m = new Match({ level, stage: level.chapter, seed: 7, difficulty: 'standard', generation: 1, noCountdown: true,
  competitors: [{ cls: 'nimble', name: 'P', isPlayer: true }, { cls: 'speedy', name: 'A', isPlayer: false }, { cls: 'mighty', name: 'B', isPlayer: false }, { cls: 'nimble', name: 'C', isPlayer: false }] });
const ais = m.actors.map((a, i) => new SiblingAI(a.id, PERSONALITIES[(['bossy', 'scrappy', 'snacky'] as const)[i % 3]], skillFor('standard', 1, i === 0), 7 + i));
let next = 0; const counts: Record<string, number> = {};
for (let n = 0; n < 120 * 90 && m.state !== 'done'; n++) {
  m.step(1 / 120, ais.map((ai) => ai.think(m, 1 / 120)));
  for (const e of m.ev.drain()) counts[e.type] = (counts[e.type] ?? 0) + 1;
  if (m.t >= next) { next += 10; const p = m.arenas[0].ents.find((e) => e.t === 'perch')!; console.log(m.t.toFixed(0), m.actors.map((a) => `${a.cls[0]}:${a.st.perchTime.toFixed(1)} (${a.x.toFixed(1)},${a.y.toFixed(1)}) stun${a.stunT > 0 ? 1 : 0}`).join(' | '), 'cont', p.active); }
}
console.log(counts);
