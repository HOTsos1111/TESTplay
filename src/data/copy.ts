/** All player-facing text. Menus use live text, never baked into art. */
export const COPY = {
  title: 'HOMEWARD HOUND',
  subtitle: 'Tiny legs. Long way home.',
  credit: 'Parody Games',
  start: "Let's Go!",
  continue: 'Keep Going',
  map: 'Follow Your Nose',
  shop: 'Good Dog, Great Gear',
  settings: 'Settings',
  failed: 'A Little Detour…',
  cleared: 'Landmark Reached!',
  tryAgain: 'Try Again',
  headHome: 'Head Home',
  nextStop: 'Next Stop',
  distance: 'Distance',
  bonesFound: 'Bones Found',
  bestRun: 'Best Run',
  wagHint: 'Hold jump to give your tail a spin!',
  barkHint: 'Big bark. Tiny dog.',
  tagline: 'One little chase. One very long way home.',
  comingSoon: 'Coming soon',
  paused: 'Paused',
  resume: 'Resume',
  back: 'Back',
  endless: 'Endless mode',
} as const;

export interface HintCopy {
  keys: string;
  touch: string;
}

/** Tutorial hints, keyboard and touch wording. Each shows once per save. */
export const HINTS: Record<string, HintCopy> = {
  jump: { keys: 'Press SPACE or ↑ to jump!', touch: 'Tap JUMP to jump!' },
  jump_hold: { keys: 'Tap for a hop — hold SPACE for a big leap.', touch: 'Tap for a hop — hold JUMP for a big leap.' },
  bones: { keys: 'Bones buy upgrades. Grab them!', touch: 'Bones buy upgrades. Grab them!' },
  bark: { keys: 'Big bark. Tiny dog. Press X or K to bark!', touch: 'Big bark. Tiny dog. Tap BARK!' },
  squirrel: { keys: 'Bark to spook squirrels — or jump their acorns.', touch: 'Bark to spook squirrels — or jump their acorns.' },
  hover: { keys: 'Hold jump to give your tail a spin!', touch: 'Hold jump to give your tail a spin!' },
  hover_recharge: { keys: 'Your tail recharges while your paws are on the ground.', touch: 'Your tail recharges while your paws are on the ground.' },
  burst: { keys: 'Arrows on the floor? Press SHIFT to BURST, then jump and hold!', touch: 'Arrows on the floor? Tap BURST, then jump and hold!' },
  encounter: { keys: 'Jump the parcels. Bark the latch when it glows!', touch: 'Jump the parcels. Bark the latch when it glows!' },
};

export const STORY_PANELS = [
  'Morning. Squeak. Squeak. Life is perfect.',
  'A squirrel. With THE toy. And that face.',
  'Over the fence! Into the… truck?',
  'The doors close. “Yip.”',
  'The city looks enormous from down here.',
  'Wait — that smell on the collar. Home.',
] as const;
