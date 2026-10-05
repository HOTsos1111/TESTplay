// Canonical obstacles, power-ups and collectibles (brief §9). Written rules override board captions.

export type ObstacleId = 'OBS-01' | 'OBS-02' | 'OBS-03' | 'OBS-04' | 'OBS-05' | 'OBS-06' | 'OBS-07' | 'OBS-08' | 'OBS-09' | 'OBS-10' | 'OBS-11' | 'OBS-12';
export type PowerId = 'PU-01' | 'PU-02' | 'PU-03' | 'PU-04' | 'PU-05' | 'PU-06' | 'PU-07' | 'PU-08';
export type CollectibleId = 'COL-01' | 'COL-02' | 'COL-03' | 'COL-04';

export const OBSTACLES: Record<ObstacleId, { name: string; interaction: string }> = {
  'OBS-01': { name: 'Rolling Egg', interaction: 'Telegraphed; dodge or hop. Gentle bump setback.' },
  'OBS-02': { name: 'Mud Puddle', interaction: 'Slows movement.' },
  'OBS-03': { name: 'Swinging Bucket', interaction: 'Time your crossing; marked buckets can be ridden.' },
  'OBS-04': { name: 'Wobbly Perch', interaction: 'Tilts and sways; balance or brace.' },
  'OBS-05': { name: 'Straw Barrier', interaction: 'Peck to break.' },
  'OBS-06': { name: 'Low Fence Gap', interaction: 'Duck underneath.' },
  'OBS-07': { name: 'Heavy Hay Bale', interaction: 'Push to open an optional route.' },
  'OBS-08': { name: 'Moving Crate Platform', interaction: 'Ride and jump.' },
  'OBS-09': { name: 'Wind Gust', interaction: 'Telegraphed; changes airborne trajectory.' },
  'OBS-10': { name: 'Seed Spill', interaction: 'Slippery: less grip and braking.' },
  'OBS-11': { name: 'Springy Branch', interaction: 'Timed bounce.' },
  'OBS-12': { name: 'Tug Worm', interaction: 'Get in position and hold interact to pull. No mashing.' },
};

export interface PowerInfo { id: PowerId; name: string; duration: number; summary: string; color: string; glyph: string }
export const POWERS: Record<PowerId, PowerInfo> = {
  'PU-01': { id: 'PU-01', name: 'Speed Seed', duration: 6, summary: '+25% move speed', color: '#f2b632', glyph: '»' },
  'PU-02': { id: 'PU-02', name: 'Super Flap', duration: 6, summary: 'Less flap drain, more airtime', color: '#3fa7e8', glyph: '⌃' },
  'PU-03': { id: 'PU-03', name: 'Worm Magnet', duration: 8, summary: 'Pulls nearby loose treats', color: '#e2483d', glyph: 'U' },
  'PU-04': { id: 'PU-04', name: 'Shell Shield', duration: 10, summary: 'Blocks one bump', color: '#7cc6f0', glyph: '◈' },
  'PU-05': { id: 'PU-05', name: 'Power Corn', duration: 8, summary: '+35% pushing strength', color: '#f5c518', glyph: '✊' },
  'PU-06': { id: 'PU-06', name: 'Sticky Toes', duration: 8, summary: 'Better grip on perches and slippery ground', color: '#f08a3c', glyph: '✦' },
  'PU-07': { id: 'PU-07', name: 'Double Crumb', duration: 8, summary: 'Loose crumbs count twice', color: '#e8a838', glyph: '×2' },
  'PU-08': { id: 'PU-08', name: 'Cool Breeze', duration: 0, summary: 'Restores 40% flap stamina', color: '#56c7e8', glyph: '≈' },
};
export const MAX_ACTIVE_POWERS = 2;

export const COLLECTIBLES: Record<CollectibleId, { name: string; summary: string }> = {
  'COL-01': { name: 'Crumb', summary: 'Standard collectible.' },
  'COL-02': { name: 'Worm', summary: 'Higher value; won by tugging.' },
  'COL-03': { name: 'Golden Feather', summary: 'Rare; mastery and cosmetics.' },
  'COL-04': { name: 'Corn Bundle', summary: 'Heavy delivery cargo.' },
};

export const POWER_TUNING = {
  speedSeedMult: 1.25,
  superFlapDrain: 0.45,
  superFlapLift: 1.2,
  magnetRadius: 3.2,
  powerCornMult: 1.35,
  stickyGrip: 0.25,     // remaining slip/tilt fraction
  coolBreezeRestore: 0.4,
  maxSpeedCap: 1.6,     // final speed never exceeds this multiple of stage base run
};
