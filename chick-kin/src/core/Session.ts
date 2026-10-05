// A running level: fixed-step simulation + rival AI + presentation. Owned by GameFlow while playing.
import { Match, type MatchOptions } from '../sim/match';
import { SiblingAI, PERSONALITIES, skillFor, type PersonalityId } from '../sim/ai';
import type { ActorInput } from '../sim/actor';
import type { SimEvent } from '../sim/events';
import { GameView } from '../render/GameView';
import type { Renderer } from '../render/Renderer';

export const STEP = 1 / 120;
const MAX_FRAME = 0.1;

export class Session {
  readonly match: Match;
  readonly view: GameView;
  private ais: (SiblingAI | null)[];
  private acc = 0;
  autopilot: SiblingAI | null = null;
  paused = false;

  constructor(r: Renderer, opts: MatchOptions, personalities: PersonalityId[], autopilot = false) {
    this.match = new Match(opts);
    this.view = new GameView(r, this.match);
    let k = 0;
    this.ais = this.match.actors.map((a) => {
      if (a.isPlayer) return null;
      const p = PERSONALITIES[personalities[k++ % personalities.length]];
      return new SiblingAI(a.id, p, skillFor(opts.difficulty, opts.generation), opts.seed * 7 + a.id * 13);
    });
    if (autopilot) this.autopilot = new SiblingAI(this.match.player.id, PERSONALITIES.bossy, skillFor('standard', 1, true), opts.seed);
  }

  /** Advance by real frame time; returns semantic events produced this frame. */
  frame(dt: number, player: ActorInput): SimEvent[] {
    const events: SimEvent[] = [];
    if (this.paused) return events;
    this.acc += Math.min(dt, MAX_FRAME);
    while (this.acc >= STEP) {
      this.acc -= STEP;
      const inputs = this.match.actors.map((a, i) => {
        if (a.isPlayer) return this.autopilot ? this.autopilot.think(this.match, STEP) : player;
        return this.ais[i]!.think(this.match, STEP);
      });
      this.match.step(STEP, inputs);
      this.view.afterStep();
      const ev = this.match.ev.drain();
      if (ev.length) events.push(...ev);
      if (this.match.state === 'done') break;
    }
    this.view.onEvents(events);
    this.view.update(Math.min(dt, MAX_FRAME), this.acc / STEP);
    return events;
  }

  dispose() { this.view.dispose(); }
}
