// Headless runner: plays a level with AI driving every competitor (the player slot uses an
// autopilot with the same AI and no mistakes). Used by tests and the debug menu.
import { Match, type Difficulty, type MatchResult } from './match';
import { SiblingAI, PERSONALITIES, skillFor } from './ai';
import type { LevelDef } from './types';
import type { ChickClass } from '../data/classes';
import { CLASSES } from '../data/classes';

export const DT = 1 / 120;

export interface RunOptions {
  level: LevelDef;
  player: ChickClass;
  rivals?: ChickClass[];
  seed?: number;
  difficulty?: Difficulty;
  generation?: number;
  maxSeconds?: number;
  /** Rivals sit still (isolates "can this class complete the level alone"). */
  passiveRivals?: boolean;
}

export interface RunReport { result: MatchResult | null; seconds: number; playerDone: boolean; stats: string; match: Match }

export function runLevel(o: RunOptions): RunReport {
  const rivals = o.rivals ?? CLASSES.filter((c) => c !== o.player).concat([o.player]).slice(0, 3);
  const stage = o.level.chapter;
  const m = new Match({
    level: o.level, stage, seed: o.seed ?? 1, difficulty: o.difficulty ?? 'standard', generation: o.generation ?? 1,
    competitors: [
      { cls: o.player, name: 'Player', isPlayer: true },
      ...rivals.map((c, i) => ({ cls: c, name: `Sib${i + 1}`, isPlayer: false })),
    ],
    noCountdown: true,
  });
  const ais = m.actors.map((a, i) => new SiblingAI(a.id, PERSONALITIES[(['bossy', 'scrappy', 'snacky'] as const)[i % 3]], skillFor(o.difficulty ?? 'standard', o.generation ?? 1, i === 0), (o.seed ?? 1) * 31 + i));
  const max = (o.maxSeconds ?? 300) / DT;
  let n = 0;
  while (m.state !== 'done' && n < max) {
    const inputs = ais.map((ai, i) => (o.passiveRivals && i > 0 ? { mx: 0, my: 0, jump: false, interact: false, ability: false, duck: false } : ai.think(m, DT)));
    m.step(DT, inputs);
    m.ev.drain();
    n++;
  }
  const p = m.player;
  const stats = m.actors.map((a) => `${a.name}(${a.cls}) x=${a.x.toFixed(1)} y=${a.y.toFixed(1)} crumbs=${a.st.crumbs} worms=${a.st.worms} perch=${a.st.perchTime.toFixed(1)} del=${a.st.delivered} feath=${a.st.feathers} prog=${a.st.progress.toFixed(2)} phase=${a.phase} fin=${a.finished}`).join('\n');
  return { result: m.result, seconds: n * DT, playerDone: p.finished || (m.result?.success ?? false), stats, match: m };
}
