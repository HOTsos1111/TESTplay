import { TUNING } from './config';

/**
 * The bone shop: every skill the pup can buy, level by level. Each purchase
 * shows a pop-up explaining what it does and how to use it.
 */
export type UpgradeKey = 'jump' | 'double' | 'tail' | 'recharge' | 'health' | 'burst' | 'bark' | 'doubleBark' | 'boomerang';

export interface UpgradeIntro {
  title: string;
  body: string;
  /** How to use it: keyboard, then touch. */
  keys?: string;
  touch?: string;
}

export interface UpgradeDef {
  key: UpgradeKey;
  name: string;
  icon: string;
  /** Bone price of each level, in order (its length is the max level). */
  prices: number[];
  /** One-line summary of the current level (0 = not bought). */
  describe: (level: number) => string;
  /** Pop-up shown after buying each level (index = new level - 1). */
  intro: UpgradeIntro[];
  /** Level 1 unlocks a new ability (shown as "Unlock" in the shop). */
  unlock?: boolean;
}

/** Tuning applied per upgrade level (see systems/Skills). */
export const UPGRADE_TUNING = {
  /** Jump velocity multiplier per Springy Paws level. */
  jumpPerLevel: 0.06,
  /** Second-jump velocity bonus from Double Jump+ level 1. */
  doublePerLevel: 0.12,
  /** + seconds of tail spin per level. */
  tailPerLevel: 0.25,
  /** + fraction of tail recharge per level. */
  rechargePerLevel: 0.15,
  /** + px bark reach per level. */
  barkPerLevel: 22,
  /** Speed Burst level 2: extra speed bonus fraction; level 3: duration and recharge multiplier. */
  burstFaster: 0.2,
  burstLonger: 1.4,
  /** Boomerang reach and speed by level (index = level). */
  boomerangRange: [0, 420, 560, 600],
  boomerangSpeed: [0, 950, 1100, 1150],
} as const;

const pct = (n: number) => `${Math.round(n * 100)}%`;

export const UPGRADES: UpgradeDef[] = [
  {
    key: 'jump',
    name: 'Springy Paws',
    icon: 'hero_s_run',
    prices: [120, 240, 400],
    describe: (l) => (l ? `Jumps ${pct(UPGRADE_TUNING.jumpPerLevel * l * 2)} higher` : 'Jump higher'),
    intro: [1, 2, 3].map((l) => ({
      title: l === 3 ? 'Springiest Paws!' : 'Springy Paws!',
      body: `Every jump now goes about ${pct(UPGRADE_TUNING.jumpPerLevel * l * 2)} higher. Reach the high ledges and bone trails more easily.`,
      keys: 'SPACE / ↑ to jump — hold it for the full height',
      touch: 'Push the stick UP to jump — hold it for the full height',
    })),
  },
  {
    key: 'double',
    name: 'Double Jump+',
    icon: 'hero_s_leap',
    prices: [260, 520],
    describe: (l) => ['Double jump (built in)', `Double jump ${pct(UPGRADE_TUNING.doublePerLevel)} higher`, 'TRIPLE jump!'][l],
    intro: [
      { title: 'Bigger Double Jump!', body: `Your second jump in mid-air goes ${pct(UPGRADE_TUNING.doublePerLevel)} higher.`, keys: 'SPACE / ↑ again in mid-air', touch: 'Push UP again in mid-air' },
      {
        title: 'New skill: TRIPLE Jump!',
        body: 'You can now jump a third time in mid-air. Reach the very top platforms and hop over a charging boss with room to spare.',
        keys: 'SPACE / ↑ twice in mid-air',
        touch: 'Push UP twice in mid-air',
      },
    ],
  },
  {
    key: 'tail',
    name: 'Tail Spin',
    icon: 'hero_s_prop',
    prices: [130, 260, 450],
    describe: (l) => `Hover ${(1 + UPGRADE_TUNING.tailPerLevel * l).toFixed(2)}x as long`,
    intro: [1, 2, 3].map(() => ({
      title: 'Longer Tail Spin!',
      body: `Your tail spins for an extra ${UPGRADE_TUNING.tailPerLevel.toFixed(2)} s, so you can glide further over gaps.`,
      keys: 'Hold SPACE / ↑ while falling',
      touch: 'Hold the stick UP while falling',
    })),
  },
  {
    key: 'recharge',
    name: 'Zoomie Recharge',
    icon: 'icon_tail_empty',
    prices: [100, 200, 360],
    describe: (l) => `Tail recharge +${pct(UPGRADE_TUNING.rechargePerLevel * l)}`,
    intro: [1, 2, 3].map((l) => ({
      title: 'Zoomie Recharge!',
      body: `Your tail spin refills ${pct(UPGRADE_TUNING.rechargePerLevel * l)} faster once your paws touch the ground.`,
    })),
  },
  {
    key: 'health',
    name: 'Sausage Links',
    icon: 'hp_link_full',
    prices: [100, 180, 300, 450, 650],
    describe: (l) => `${TUNING.maxHearts + l} sausage links of health`,
    intro: [1, 2, 3, 4, 5].map((l) => ({
      title: 'Extra Sausage Link!',
      body: `You now start every level with ${TUNING.maxHearts + l} links of health. One more hit before a detour!`,
    })),
  },
  {
    key: 'burst',
    name: 'Speed Burst',
    icon: 'icon_burst',
    unlock: true,
    prices: [220, 330, 520],
    describe: (l) => ['Locked: slingshot dash', 'Speed Burst', `Burst +${pct(UPGRADE_TUNING.burstFaster)} faster`, 'Faster, longer bursts'][l],
    intro: [
      {
        title: 'New skill: Speed Burst!',
        body: 'HOLD the speed button: the pup stretches out long. LET GO: he snaps forward and the whole street rushes by. Needed for the long gaps from Level 5. In boss fights it dashes you across the arena.',
        keys: 'HOLD SHIFT, then let go',
        touch: 'HOLD the SPEED button, then let go',
      },
      { title: 'Faster Speed Burst!', body: `Your bursts are ${pct(UPGRADE_TUNING.burstFaster)} faster.`, keys: 'HOLD SHIFT, then let go', touch: 'HOLD SPEED, then let go' },
      { title: 'Longer Speed Burst!', body: 'Bursts last 40% longer and recharge 40% faster.', keys: 'HOLD SHIFT, then let go', touch: 'HOLD SPEED, then let go' },
    ],
  },
  {
    key: 'bark',
    name: 'Bigger Bark',
    icon: 'icon_bark',
    prices: [130, 260, 450],
    describe: (l) => `Bark reach +${UPGRADE_TUNING.barkPerLevel * l} px`,
    intro: [1, 2, 3].map(() => ({
      title: 'Bigger Bark!',
      body: `Your bark reaches ${UPGRADE_TUNING.barkPerLevel} px further. Hit squirrels and bosses from a safer distance.`,
      keys: 'X or K to bark',
      touch: 'Tap BARK',
    })),
  },
  {
    key: 'doubleBark',
    name: 'Double Bark',
    icon: 'hero_s_bark',
    unlock: true,
    prices: [400, 650],
    describe: (l) => ['Locked: bark twice', 'Double Bark', 'MEGA Bark'][l],
    intro: [
      {
        title: 'New skill: Double Bark!',
        body: 'Every bark now echoes a split second later for a second hit. Bosses take double damage from each bark.',
        keys: 'X or K to bark',
        touch: 'Tap BARK',
      },
      {
        title: 'MEGA Bark!',
        body: 'Your bark is taller and reloads 25% faster. Hit flying bosses and things on the ledges above you.',
        keys: 'X or K to bark',
        touch: 'Tap BARK',
      },
    ],
  },
  {
    key: 'boomerang',
    name: 'Boomerang Bone',
    icon: 'hero_s_toy',
    unlock: true,
    prices: [320, 420, 620],
    describe: (l) => ['Locked: throw your squeaky toy', 'Boomerang Bone', 'Longer, faster throws', 'Double-back: hits going and coming'][l],
    intro: [
      {
        title: 'New skill: Boomerang Bone!',
        body: 'The squeaky toy you rescued, slung at your side. Throw it: it flies out, hits squirrels, nuts and bosses, fetches bones on the way and comes back to you. Big cardboard boxes are bark-only: it bounces off those.',
        keys: 'V or E to throw',
        touch: 'Tap the TOSS button',
      },
      { title: 'Longer Boomerang!', body: 'Your Boomerang Bone flies further and faster.', keys: 'V or E to throw', touch: 'Tap TOSS' },
      { title: 'Double-back Boomerang!', body: 'It now hits everything twice: once on the way out and again on the way back.', keys: 'V or E to throw', touch: 'Tap TOSS' },
    ],
  },
];

export const UPGRADE_KEYS: UpgradeKey[] = UPGRADES.map((u) => u.key);
export const upgradeDef = (key: UpgradeKey): UpgradeDef => UPGRADES.find((u) => u.key === key)!;
export const maxLevel = (key: UpgradeKey): number => upgradeDef(key).prices.length;
