// Crop boxes [x, y, w, h] in the 1536×1024 reference sheets (art-src/).
// scale: output size relative to the sheet; size: exact output [w, h] (2× logical px).
// flip: mirror horizontally (squirrels face left, toward the hero).
// keepFrac: also keep separate shapes at least this fraction of the biggest one.
// raw: copy the rectangle as-is (scenery).
const H = 'hero';
const S = 'squirrel';
const C = 'collectibles';
const E = 'environments';
export const SPRITE_CROPS = [
  { key: 'hero_s_side', sheet: H, rect: [80, 160, 425, 265] },
  { key: 'hero_s_idle', sheet: H, rect: [12, 510, 262, 220] },
  { key: 'hero_s_run', sheet: H, rect: [282, 540, 292, 196] },
  { key: 'hero_s_leap', sheet: H, rect: [556, 525, 316, 182] },
  { key: 'hero_s_prop', sheet: H, rect: [866, 490, 216, 246] },
  { key: 'hero_s_bark', sheet: H, rect: [1062, 510, 236, 222] },
  { key: 'hero_s_toy', sheet: H, rect: [1305, 520, 231, 214] },
  { key: 'squirrel_idle', sheet: S, rect: [12, 460, 220, 228], scale: 0.8, flip: true },
  { key: 'squirrel_run', sheet: S, rect: [318, 500, 220, 188], scale: 0.8 },
  { key: 'squirrel_taunt', sheet: S, rect: [748, 455, 166, 232], scale: 0.8, flip: true },
  { key: 'squirrel_throw', sheet: S, rect: [912, 500, 186, 188], scale: 0.8, flip: true },
  { key: 'squirrel_startled', sheet: S, rect: [1098, 470, 204, 218], scale: 0.8, flip: true },
  { key: 'squirrel_flee', sheet: S, rect: [1318, 495, 214, 192], scale: 0.8 },
  { key: 'acorn', sheet: S, rect: [962, 750, 68, 88], size: [40, 48] },
  { key: 'toy', sheet: C, rect: [428, 745, 310, 152], size: [124, 60], keepFrac: 0.05 },
  { key: 'bone', sheet: C, rect: [52, 165, 276, 210], size: [80, 60] },
  { key: 'heart_full', sheet: C, rect: [852, 185, 216, 180], size: [80, 76] },
  { key: 'pu_magnet', sheet: C, rect: [38, 722, 324, 182], size: [96, 54], keepFrac: 0.05 },
  { key: 'pu_shield', sheet: C, rect: [1222, 446, 222, 222], size: [96, 104] },
  { key: 'pu_bacon', sheet: C, rect: [882, 470, 196, 168], size: [100, 96] },
  { key: 'cardboard', sheet: E, rect: [168, 856, 132, 100], size: [120, 112], keepFrac: 0.02 },
  { key: 'barrel', sheet: E, rect: [942, 858, 106, 96], size: [96, 104] },
  { key: 'crate', sheet: E, rect: [314, 846, 124, 108], size: [128, 128] },
  { key: 'crate_parcel', sheet: E, rect: [28, 860, 130, 96], size: [128, 128] },
  { key: 'tyre', sheet: E, rect: [448, 862, 128, 90], size: [96, 64] },
  // Title logo from the sheet header (keeps the swoosh and the little accent dashes).
  { key: 'logo', sheet: H, rect: [335, 6, 870, 114], keepFrac: 0.004 },
  // Scenery: the distant skyline of the "Delivery Depot" panel (raw: background kept).
  { key: 'bg_depot_skyline', sheet: E, rect: [300, 140, 322, 128], raw: true },
];
