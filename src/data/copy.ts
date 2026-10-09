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
  jump: { keys: 'Press SPACE or ↑ to jump!', touch: 'Push the stick UP to jump!' },
  jump_hold: { keys: 'Tap for a hop — hold SPACE for a big leap. ← → to pace yourself.', touch: 'Flick UP for a hop, hold UP for a big leap. Left/right paces you.' },
  bones: { keys: 'Bones buy upgrades. Grab them!', touch: 'Bones buy upgrades. Grab them!' },
  bark: { keys: 'Big bark. Tiny dog. Press X or K to bark!', touch: 'Big bark. Tiny dog. Tap BARK!' },
  squirrel: { keys: 'Squirrels pelt you with acorns! Jump them, and BARK (X) when the squirrel comes close.', touch: 'Squirrels pelt you with acorns! Jump them, and tap BARK when the squirrel comes close.' },
  hover: { keys: 'Hold jump to give your tail a spin!', touch: 'Hold the stick UP to give your tail a spin!' },
  hover_recharge: { keys: 'Your tail recharges while your paws are on the ground.', touch: 'Your tail recharges while your paws are on the ground.' },
  burst: { keys: 'Arrows on the floor? Press SHIFT to BURST, then jump and hold!', touch: 'Arrows on the floor? Tap SPEED, then jump and hold!' },
  duck: { keys: 'Red beams pump up and down! Run under, DUCK (↓) or JUMP — time it!', touch: 'Red beams pump up and down! Run under, pull DOWN or jump — time it!' },
  double: { keys: 'Too tall! Jump EARLY, then press jump again at the top to double-jump.', touch: 'Too tall! Push UP early, let go, then push UP again at the top to double-jump.' },
  encounter: { keys: 'Jump the chargers, DUCK the gliders, BARK (X) them away!', touch: 'Jump the chargers, DUCK the gliders, tap BARK to blast them!' },
  encounter_pigeon: { keys: 'Jump the rolls, DUCK the swoops, BARK (X) when he lands!', touch: 'Jump the rolls, DUCK the swoops, BARK when he lands!' },
};

