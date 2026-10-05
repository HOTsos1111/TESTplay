import { LEVELS } from '../src/data/levels';
import { runLevel } from '../src/sim/harness';
const t0 = performance.now(); let steps = 0;
for (const level of LEVELS) { const r = runLevel({ level, player: 'speedy', maxSeconds: 60, seed: 3 }); steps += Math.round(r.seconds * 120); }
const ms = performance.now() - t0;
console.log(`sim: ${steps} fixed steps (4 competitors + AI) in ${ms.toFixed(0)} ms → ${(ms / steps * 1000).toFixed(1)} µs/step`);
