// Class balance tournament: four AI chicks with identical skill/personality rotation; counts wins per class.
// Usage: npx vite-node scripts/tournament.ts [levelPrefix] [seeds]
import { LEVELS } from '../src/data/levels';
import { Match } from '../src/sim/match';
import { SiblingAI, PERSONALITIES, skillFor, type PersonalityId } from '../src/sim/ai';
import type { ChickClass } from '../src/data/classes';

const prefix = process.argv[2] ?? '';
const N = Number(process.argv[3] ?? 6);
const LINEUPS: ChickClass[][] = [
  ['speedy', 'mighty', 'nimble', 'speedy'], ['mighty', 'nimble', 'speedy', 'mighty'], ['nimble', 'speedy', 'mighty', 'nimble'],
];
const PERS: PersonalityId[] = ['bossy', 'scrappy', 'snacky', 'scrappy'];
const total: Record<string, { wins: number; entries: number; placeSum: number }> = {};
for (const level of LEVELS.filter((l) => l.id.startsWith(prefix))) {
  const per: Record<string, { wins: number; entries: number; placeSum: number }> = {};
  for (let s = 0; s < N; s++) {
    const lineup = LINEUPS[s % 3];
    const rot = Math.floor(s / 3) % 4;
    const cls = lineup.map((_, i) => lineup[(i + rot) % 4]);
    const m = new Match({ level, stage: level.chapter, seed: 100 + s, difficulty: 'standard', generation: 1, noCountdown: true,
      competitors: cls.map((c, i) => ({ cls: c, name: `${c}${i}`, isPlayer: i === 0 })) });
    const ais = m.actors.map((a, i) => new SiblingAI(a.id, PERSONALITIES[PERS[(i + s) % 4]], skillFor('standard', 1), 500 + s * 7 + i));
    for (let n = 0; n < 120 * 300 && m.state !== 'done'; n++) { m.step(1 / 120, ais.map((ai) => ai.think(m, 1 / 120))); m.ev.drain(); }
    // rank everyone (player-ending levels end early: use current order)
    const order = m.result?.order ?? m.currentOrder();
    order.forEach((id, place) => {
      const c = m.actors[id].cls;
      for (const t of [per, total]) { t[c] ??= { wins: 0, entries: 0, placeSum: 0 }; t[c].entries++; t[c].placeSum += place + 1; if (place === 0) t[c].wins++; }
    });
  }
  console.log(level.id.padEnd(4), Object.entries(per).map(([c, v]) => `${c} win ${(100 * v.wins / v.entries).toFixed(0)}% avgPlace ${(v.placeSum / v.entries).toFixed(2)}`).join(' | '));
}
console.log('TOTAL', Object.entries(total).map(([c, v]) => `${c} win ${(100 * v.wins / v.entries).toFixed(0)}% avgPlace ${(v.placeSum / v.entries).toFixed(2)}`).join(' | '));
