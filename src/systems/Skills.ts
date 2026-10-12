import { TUNING } from '../data/config';
import type { ChapterDef } from '../data/chapters';
import { chunkById } from '../data/chunks';
import { UPGRADE_KEYS, UPGRADE_TUNING, maxLevel, type UpgradeKey } from '../data/upgrades';
import { debugFlags } from './debug';
import type { PlayerStats } from './PlayerController';
import { progress } from './ProgressStore';

/** Bought upgrade levels (?upgrades=max maxes them all for playtesting). */
export function upgradeLevels(): Record<UpgradeKey, number> {
  if (debugFlags.maxUpgrades) return Object.fromEntries(UPGRADE_KEYS.map((k) => [k, maxLevel(k)])) as Record<UpgradeKey, number>;
  return progress.state.upgrades;
}

/** Bone-shop skills a level's layout cannot be finished without (the double jump is built in). */
export function chapterNeeds(ch: ChapterDef): { burst: boolean } {
  const req = new Set(ch.chunks.flatMap((id) => chunkById(id).requires));
  return { burst: req.has('burst') };
}

/** Skills still to buy before this level can be played (empty = ready). */
export function missingSkills(ch: ChapterDef): 'Speed Burst'[] {
  if (debugFlags.unlockAll) return [];
  return chapterNeeds(ch).burst && upgradeLevels().burst < 1 ? ['Speed Burst'] : [];
}

/** How far through the bone shop the pup is, 0 (nothing bought) .. 1 (everything maxed). */
export function upgradePower(): number {
  const u = upgradeLevels();
  const have = UPGRADE_KEYS.reduce((n, k) => n + u[k], 0);
  const all = UPGRADE_KEYS.reduce((n, k) => n + maxLevel(k), 0);
  return all ? have / all : 0;
}

export function maxHearts(): number {
  return TUNING.maxHearts + upgradeLevels().health;
}

/** The pup's movement and bark stats from the bone shop. */
export function statsFromUpgrades(ch?: ChapterDef): PlayerStats {
  const u = upgradeLevels();
  const T = UPGRADE_TUNING;
  // Playtesting every level (?unlock=all): lend the skills a level needs.
  const lend = debugFlags.unlockAll && ch ? chapterNeeds(ch) : { burst: false };
  return {
    wagCapacity: TUNING.wagCapacity * (1 + T.tailPerLevel * u.tail),
    rechargeRate: TUNING.groundRecharge * (1 + T.rechargePerLevel * u.recharge),
    barkRange: TUNING.barkRange + T.barkPerLevel * u.bark,
    // The double jump is built in; Double Jump+ makes it higher, then adds a third.
    doubleJump: ch ? ch.doubleJump : true,
    airJumps: u.double >= 2 ? 2 : 1,
    jumpMul: 1 + T.jumpPerLevel * u.jump,
    airJumpMul: u.double >= 1 ? 1 + T.doublePerLevel : 1,
    burst: u.burst >= 1 || lend.burst,
    burstBonus: u.burst >= 2 ? T.burstFaster : 0,
    burstDurMul: u.burst >= 3 ? T.burstLonger : 1,
    burstRechargeMul: u.burst >= 3 ? T.burstLonger : 1,
    barkCooldownMul: u.doubleBark >= 2 ? 0.75 : 1,
    barkHeight: u.doubleBark >= 2 ? TUNING.barkHeight * 1.5 : TUNING.barkHeight,
  };
}
