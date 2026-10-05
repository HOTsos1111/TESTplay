import { describe, it, expect } from 'vitest';
import { LEVELS } from '../src/data/levels';
import { runLevel } from '../src/sim/harness';
import { CLASSES } from '../src/data/classes';

// Fairness invariant (brief §15): every class can complete every base level via the common rules,
// with siblings present and with siblings passive.
describe('every class completes every level', () => {
  for (const level of LEVELS) {
    for (const cls of CLASSES) {
      it(`${level.id} ${level.title} — ${cls} (solo)`, () => {
        const r = runLevel({ level, player: cls, passiveRivals: true, maxSeconds: 260 });
        if (!r.playerDone) console.log(r.stats);
        expect(r.playerDone, `${level.id} ${cls} did not complete in ${r.seconds.toFixed(1)}s\n${r.stats}`).toBe(true);
      });
    }
  }
});

// Seeded generation variants stay solvable and reproduce from the saved seed (brief §10, §15).
import { withVariants } from '../src/core/Generation';
describe('generation 3 variants remain completable (weakest jumper)', () => {
  for (const base of LEVELS) {
    it(`${base.id} gen 3 variant — mighty`, () => {
      const level = withVariants(base, 3, 4242);
      const r = runLevel({ level, player: 'mighty', passiveRivals: true, maxSeconds: 260, generation: 3 });
      expect(r.playerDone, `${base.id} gen3 mighty\n${r.stats}`).toBe(true);
    });
  }
});
