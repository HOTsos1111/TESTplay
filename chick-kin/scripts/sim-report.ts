// Quick headless report: node --experimental-strip-types is not enough for imports; run via vitest-node.
import { LEVELS } from '../src/data/levels';
import { runLevel } from '../src/sim/harness';
import { CLASSES } from '../src/data/classes';

const only = process.argv[2];
for (const level of LEVELS) {
  if (only && !level.id.startsWith(only)) continue;
  for (const cls of CLASSES) {
    const solo = runLevel({ level, player: cls, passiveRivals: true, maxSeconds: 260 });
    const full = runLevel({ level, player: cls, maxSeconds: 260, seed: 7 });
    console.log(`${level.id} ${cls.padEnd(6)} solo ${solo.playerDone ? 'OK ' : 'NO '} ${solo.seconds.toFixed(1)}s | vs rivals ${full.result?.success ? 'WIN' : 'lose'} place ${full.result?.placement} ${full.seconds.toFixed(1)}s order ${full.result?.order.join(',')}`);
    if (process.argv.includes('-v')) console.log(full.stats);
  }
}
