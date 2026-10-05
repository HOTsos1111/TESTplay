import SPRITE_SIZES from './spriteSizes.json';
/**
 * Stable asset keys. Every entry is currently a procedural placeholder.
 *
 * To replace one: drop a PNG at `file` (2× logical size, transparent) and set
 * `placeholder: false`. The Boot scene loads files for non-placeholder
 * entries and only generates art for keys that are still missing, so no
 * gameplay code changes are needed.
 */
export interface AssetEntry {
  key: string;
  category: 'player' | 'enemies' | 'props' | 'tiles' | 'backgrounds' | 'fx' | 'ui' | 'story';
  /** Logical size in px (source art is 2×). */
  size: [number, number];
  /** Intended replacement path under public/. */
  file: string;
  placeholder: boolean;
  note?: string;
}

const e = (
  key: string,
  category: AssetEntry['category'],
  size: [number, number],
  note?: string,
): AssetEntry => ({ key, category, size, file: `assets/${category === 'story' ? 'backgrounds' : category}/${key}.png`, placeholder: true, note });

const MANIFEST: AssetEntry[] = [
  // Hero rig parts (procedural rubber-hose rig; final art may switch to an atlas — see docs/asset_manifest.md).
  e('hero_body', 'player', [124, 58], 'pivot centre; sits at (0,-36) from feet'),
  e('hero_head', 'player', [76, 62], 'pivot (0.32,0.62) at neck'),
  e('hero_ear', 'player', [28, 42], 'pivot top (0.5,0.1)'),
  e('hero_leg_near', 'player', [18, 28], 'pivot hip (0.5,0.14)'),
  e('hero_leg_far', 'player', [18, 28], 'pivot hip (0.5,0.14)'),
  e('hero_tail', 'player', [38, 16], 'pivot base (0.92,0.5)'),
  e('hero_collar', 'player', [18, 42]),
  e('hero_mouth', 'player', [22, 18], 'bark / pant overlay'),
  e('hero_propeller', 'player', [64, 64], 'spinning tail blur during hover'),
  ...['open', 'determined', 'surprised', 'happy', 'closed', 'dizzy'].map((k) => e(`hero_eye_${k}`, 'player', [26, 26])),
  e('shadow', 'fx', [120, 20], 'separate oval ground shadow'),
  // Enemies.
  ...['idle', 'taunt', 'throw', 'run', 'startled'].map((k) => e(`squirrel_${k}`, 'enemies', [90, 90], 'feet at bottom-centre')),
  ...['sneak', 'grab', 'run', 'flex', 'stunned'].map((k) => e(`boss_${k}`, 'enemies', [220, 240], 'Boss Nutso; feet near bottom-centre')),
  e('acorn', 'enemies', [22, 24]),
  e('nut_pile', 'enemies', [40, 28], 'lobbed acorns left on the path'),
  ...['walk', 'run', 'windup', 'frustrated', 'tumble'].map((k) => e(`dogcatcher_${k}`, 'enemies', [170, 250], 'feet at (90,246)')),
  e('trolley_body', 'enemies', [300, 180]),
  e('trolley_door', 'enemies', [30, 110]),
  e('trolley_wheel', 'enemies', [56, 56]),
  ...['intact', 'damaged', 'broken'].map((k) => e(`trolley_latch_${k}`, 'enemies', [44, 56])),
  e('parcel_small', 'props', [46, 42]),
  e('parcel_big', 'props', [58, 56]),
  // Props and tiles.
  e('crate', 'props', [64, 64]),
  e('cardboard', 'props', [60, 56]),
  e('cardboard_breaking', 'props', [60, 56]),
  e('cardboard_bit', 'fx', [18, 14]),
  e('cardboard_flat', 'props', [68, 16]),
  e('tyre', 'props', [48, 42]),
  e('bone', 'props', [36, 20]),
  e('scent', 'fx', [28, 28]),
  e('exit_gate', 'props', [220, 282]),
  e('gate_door', 'props', [84, 240]),
  e('toy', 'props', [62, 30]),
  e('burst_marker', 'props', [144, 18], 'painted floor chevrons before a burst gap'),
  e('platform_mid', 'tiles', [64, 18], 'tileable horizontally'),
  e('platform_left', 'tiles', [16, 18]),
  e('platform_right', 'tiles', [16, 18]),
  e('platform_leg', 'tiles', [16, 120], 'decorative support, behind hero'),
  e('ground_mid', 'tiles', [64, 120], 'tileable horizontally'),
  e('ground_edge_left', 'tiles', [24, 120]),
  e('ground_edge_right', 'tiles', [24, 120]),
  // Backgrounds (left/right edges match for looping).
  e('depot_far', 'backgrounds', [1280, 720]),
  e('depot_mid', 'backgrounds', [1280, 720]),
  e('depot_near', 'backgrounds', [1280, 720], 'includes the dark pit band below y=600'),
  ...['sorting', 'cold', 'yard', 'street'].map((z) => e(`depot_near_${z}`, 'backgrounds', [1280, 720], 'zone variant of the near wall')),
  e('depot_mid_yard', 'backgrounds', [1280, 720], 'open-air zones'),
  ...['clock', 'poster_dog', 'poster_arrow', 'extinguisher', 'vent', 'window', 'lamp', 'pipe', 'board', 'bunting'].map((k) => e(`decor_${k}`, 'backgrounds', [100, 90], 'wall decal (behind gameplay)')),
  ...['fg_chain', 'fg_chain_short', 'fg_lamp', 'fg_beam'].map((k) => e(k, 'backgrounds', [80, 200], 'foreground silhouette hanging from the top')),
  e('bird_up', 'fx', [36, 18]),
  e('bird_down', 'fx', [36, 18]),
  ...['hazard_cone', 'hazard_toolbox', 'hazard_paint'].map((k) => e(k, 'props', [48, 42], 'low-hazard skin (same hitbox as tyre)')),
  e('crate_metal', 'props', [64, 64]),
  e('crate_slat', 'props', [64, 64]),
  e('cardboard_white', 'props', [60, 56]),
  e('cardboard_arrows', 'props', [60, 56]),
  e('platform_mid_conveyor', 'tiles', [64, 18]),
  e('platform_mid_plank', 'tiles', [64, 18]),
  e('barrel', 'props', [48, 48], 'rolling hazard'),
  e('lowbar', 'props', [110, 62], 'low-clearance sign: duck under it'),
  e('pu_bubble', 'props', [64, 64], 'power-up bubble'),
  e('pu_magnet', 'props', [48, 48], 'Bone Magnet power-up'),
  e('pu_shield', 'props', [48, 52], 'Soap Bubble Shield power-up'),
  e('pu_whistle', 'props', [52, 48], 'Dog Whistle power-up'),
  e('pu_bacon', 'props', [50, 48], 'Speed Biscuit power-up'),
  e('shield_bubble', 'fx', [160, 100], 'shield around the hero'),
  e('actor_forklift', 'backgrounds', [124, 90], 'background actor (wall plane)'),
  e('actor_pigeon', 'backgrounds', [36, 28], 'background actor (wall plane)'),
  e('actor_cat', 'backgrounds', [48, 48], 'background actor (wall plane)'),
  e('actor_cat_tail', 'backgrounds', [32, 12]),
  e('actor_beacon_on', 'backgrounds', [28, 28]),
  e('actor_beacon_off', 'backgrounds', [28, 28]),
  e('story_garden', 'story', [1280, 720]),
  e('story_dogbed', 'story', [200, 70]),
  e('sky_clouds', 'backgrounds', [1600, 240], 'drifting cloud layer'),
  e('depot_roofline', 'backgrounds', [1280, 320], 'rooftop parallax layer (band from y=60)'),
  e('fg_tuft', 'fx', [90, 60], 'bottom foreground silhouette'),
  e('fg_bollard', 'fx', [48, 90], 'bottom foreground silhouette'),
  e('fg_weeds', 'fx', [70, 86], 'bottom foreground silhouette'),
  ...['full', 'empty', 'lost'].map((k) => e(`hp_link_${k}`, 'ui', [48, 32], 'sausage-link health')),
  ...['ui_play', 'ui_gear', 'ui_expand'].map((k) => e(k, 'ui', [40, 40], 'button icon')),
  ...['ui_paw', 'ui_paw_teal'].map((k) => e(k, 'ui', [40, 36], 'paw glyph')),
  e('story_truck_open', 'story', [520, 300]),
  e('story_truck_closed', 'story', [520, 300]),
  // FX.
  e('fx_puff', 'fx', [40, 36]),
  e('fx_star', 'fx', [22, 22]),
  e('fx_sparkle', 'fx', [18, 18]),
  e('fx_exclaim', 'fx', [36, 44], 'warning bubble'),
  e('fx_streak', 'fx', [48, 8], 'burst speed line'),
  // UI.
  ...['full', 'empty', 'lost'].map((k) => e(`heart_${k}`, 'ui', [40, 38])),
  e('icon_tail', 'ui', [36, 36]),
  e('icon_tail_empty', 'ui', [36, 36]),
  e('icon_bark', 'ui', [40, 40]),
  e('icon_burst', 'ui', [40, 36]),
  e('icon_burst_empty', 'ui', [40, 36]),
  e('btn_burst', 'ui', [128, 128]),
  e('icon_pause', 'ui', [48, 48]),
  e('btn_jump', 'ui', [128, 128]),
  e('btn_bark', 'ui', [128, 128]),
  ...[1, 2, 3, 4, 5, 6].map((n) => e(`badge_ch${n}`, 'ui', [120, 120])),
];

/**
 * Hand-drawn sprites cut from the reference sheets in art-src/ by
 * scripts/extract-sprites.mjs. They replace the procedural placeholders of the
 * same key, and add the hero's pose sprites.
 */
const SPRITE_NOTES: Record<string, string> = {
  hero_s_side: 'hero side pose (also defeat/sniff)',
  hero_s_idle: 'hero idle',
  hero_s_run: 'hero run',
  hero_s_leap: 'hero jump/fall',
  hero_s_prop: 'hero tail propeller (hover)',
  hero_s_bark: 'hero bark',
  hero_s_toy: 'hero proud with toy',
  logo: 'title logo from the reference sheet header',
  squirrel_flee: 'squirrel fleeing with the toy',
  crate_parcel: 'sealed parcel crate skin',
};

export const ASSET_MANIFEST: AssetEntry[] = (() => {
  const list = MANIFEST.map((a) => ({ ...a }));
  for (const [key, [w, h]] of Object.entries(SPRITE_SIZES as Record<string, number[]>)) {
    const file = `sprites/${key}.png`;
    const found = list.find((a) => a.key === key);
    if (found) Object.assign(found, { file, placeholder: false, size: [w / 2, h / 2] });
    else list.push({ key, category: key.startsWith('hero') ? 'player' : key.startsWith('squirrel') ? 'enemies' : 'props', size: [w / 2, h / 2], file, placeholder: false, note: SPRITE_NOTES[key] });
  }
  return list;
})();
