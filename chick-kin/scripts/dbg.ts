import { levelById } from '../src/data/levels';
import { Match } from '../src/sim/match';
const level = levelById('2-1')!;
const m = new Match({ level, stage: 2, seed: 7, difficulty: 'standard', generation: 1, noCountdown: true,
  competitors: [{ cls: 'speedy', name: 'P', isPlayer: true }, { cls: 'speedy', name: 'A', isPlayer: false }, { cls: 'mighty', name: 'B', isPlayer: false }, { cls: 'nimble', name: 'C', isPlayer: false }] });
const a = m.actors[0];
for (let i = 0; i < 40; i++) {
  const x0 = a.x;
  m.step(1/120, [{ mx: 1, my: 0, jump: false, interact: false, ability: false, duck: false }]);
  if (i % 5 === 0) console.log(i, x0.toFixed(3), '->', a.x.toFixed(3), 'vx', a.vx.toFixed(2), 'g', a.grounded, 'others', m.actors.slice(1).map(o => o.x.toFixed(2)).join(','));
}
