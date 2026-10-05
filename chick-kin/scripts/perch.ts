import { levelById } from '../src/data/levels';
import { runLevel } from '../src/sim/harness';
const id = process.argv[2] ?? '1-5';
const r = runLevel({ level: levelById(id)!, player: 'speedy', seed: 7, maxSeconds: 60 });
console.log(r.stats);
const m = r.match;
const perch = m.arenas[0].ents.find((e) => e.t === 'perch')!;
console.log('perch', perch.x, perch.y, perch.w, perch.h, 'owner', perch.owner, 'contested', perch.active);
