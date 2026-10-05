// GenerationDirector: sibling line-ups, seeded difficulty variants and the inherited family perk.
import { CLASSES, type ChickClass } from '../data/classes';
import { makeRng, hashString } from '../sim/math';
import type { PersonalityId } from '../sim/ai';
import type { LevelDef, EntityDef } from '../sim/types';
import type { Perk } from '../sim/actor';

export const SIBLING_NAMES = ['Sunny', 'Rocco', 'Pip', 'Clover', 'Biscuit', 'Maple', 'Pebble', 'Nugget', 'Hazel', 'Waffles', 'Juniper', 'Dot', 'Toffee', 'Basil', 'Poppy', 'Ziggy', 'Olive', 'Bramble', 'Mochi', 'Fennel'];
export const PLAYER_NAMES = ['Peep', 'Chirpy', 'Sprout', 'Honey', 'Ember', 'Lilac'];

export interface SiblingProfile { name: string; cls: ChickClass; personality: PersonalityId; look: number }

/** Deterministic rival composition with useful class variety: the two other classes plus one seeded pick. */
export function siblingsFor(generation: number, familySeed: number, player: ChickClass): SiblingProfile[] {
  const rng = makeRng(familySeed ^ hashString('gen' + generation));
  const others = CLASSES.filter((c) => c !== player);
  const classes = rng.shuffle([...others, rng.pick(CLASSES)]);
  const pers = rng.shuffle<PersonalityId>(['bossy', 'scrappy', 'snacky']);
  const names = rng.shuffle([...SIBLING_NAMES]).slice(0, 3);
  return classes.map((cls, i) => ({ name: names[i], cls, personality: pers[i], look: rng.int(0, 3) }));
}

/** Hazard tempo grows gently with generation, capped at +20%. */
export const hazardSpeedFor = (generation: number) => 1 + Math.min(0.2, 0.06 * (generation - 1));

/** Variant entities for a level in a generation: gen1 none, gen2 one, gen3 two, gen4+ capped seeded pool. */
export function variantsFor(level: LevelDef, generation: number, seed: number): { names: string[]; add: { phase: number; e: EntityDef }[] } {
  const pool = level.variants ?? [];
  const n = generation <= 1 ? 0 : Math.min(pool.length, generation === 2 ? 1 : 2);
  if (!n) return { names: [], add: [] };
  const rng = makeRng(seed ^ hashString(level.id + ':' + generation));
  const picked = rng.shuffle([...pool]).slice(0, n);
  return { names: picked.map((v) => v.name), add: picked.flatMap((v) => v.add.map((e) => ({ phase: v.phase ?? 0, e }))) };
}

/** Apply variants by cloning the level data (never mutating the authored base). */
export function withVariants(level: LevelDef, generation: number, seed: number): LevelDef {
  const v = variantsFor(level, generation, seed);
  if (!v.add.length) return level;
  const clone: LevelDef = structuredClone(level);
  for (const { phase, e } of v.add) clone.phases[Math.min(phase, clone.phases.length - 1)].arena.entities.push(e);
  return clone;
}

export const PERKS: Perk[] = [
  { id: 'quick-feet', name: 'Quick Feet', summary: '+4% run speed', stat: 'run', amount: 0.04 },
  { id: 'strong-shoulders', name: 'Strong Shoulders', summary: '+5% pushing strength', stat: 'push', amount: 0.05 },
  { id: 'light-wings', name: 'Light Wings', summary: '+5% flap endurance', stat: 'flap', amount: 0.05 },
  { id: 'springy-legs', name: 'Springy Legs', summary: '+4% jump height', stat: 'jump', amount: 0.04 },
  { id: 'sturdy-fluff', name: 'Sturdy Fluff', summary: '+5% bump resistance', stat: 'bumpRes', amount: 0.05 },
];
export const perkById = (id: string | null | undefined) => PERKS.find((p) => p.id === id) ?? null;

/** Three perk choices from the parent's class leaning. One modest perk; never cumulative. */
export function perkChoices(parent: ChickClass, generation: number, seed: number): Perk[] {
  const lean: Record<ChickClass, string> = { speedy: 'quick-feet', mighty: 'strong-shoulders', nimble: 'light-wings' };
  const rng = makeRng(seed ^ hashString('perk' + generation));
  const first = perkById(lean[parent])!;
  const rest = rng.shuffle(PERKS.filter((p) => p.id !== first.id)).slice(0, 2);
  return [first, ...rest];
}
