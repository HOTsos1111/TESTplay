import { levelById } from '../src/data/levels';
import { runLevel } from '../src/sim/harness';
import type { ChickClass } from '../src/data/classes';
const [id, cls, seed = '7', passive = '0'] = process.argv.slice(2);
const r = runLevel({ level: levelById(id)!, player: cls as ChickClass, seed: +seed, maxSeconds: 260, passiveRivals: passive === '1' });
console.log(r.result, r.seconds.toFixed(1));
console.log(r.stats);
