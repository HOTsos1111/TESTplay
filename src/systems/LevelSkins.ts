import type Phaser from 'phaser';
import { LEVEL_ART, pieceKey, type Piece } from '../data/levelArt';
import { makeTexture, type Ctx } from './art/canvas';
import { THEMES } from './LevelTheme';

type Fit = 'contain' | 'cover' | 'stretch';

interface Src {
  img: CanvasImageSource;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

function source(scene: Phaser.Scene, level: number, p: Piece): Src | null {
  const key = pieceKey(level, p.code);
  if (!scene.textures.exists(key)) return null;
  const img = scene.textures.get(key).getSourceImage() as HTMLImageElement;
  const [x0, y0, x1, y1] = p.crop ?? [0, 0, 1, 1];
  const W = img.width;
  const H = img.height;
  return { img, sx: Math.round(x0 * W), sy: Math.round(y0 * H), sw: Math.max(1, Math.round((x1 - x0) * W)), sh: Math.max(1, Math.round((y1 - y0) * H)) };
}

function draw(c: Ctx, s: Src, w: number, h: number, fit: Fit, align: 'bottom' | 'center' = 'bottom'): void {
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  if (fit === 'stretch') {
    c.drawImage(s.img, s.sx, s.sy, s.sw, s.sh, 0, 0, w, h);
    return;
  }
  const k = fit === 'contain' ? Math.min(w / s.sw, h / s.sh) : Math.max(w / s.sw, h / s.sh);
  const dw = s.sw * k;
  const dh = s.sh * k;
  const dx = (w - dw) / 2;
  const dy = align === 'bottom' ? h - dh : (h - dh) / 2;
  if (fit === 'cover') {
    // Crop the overflow from the centre of the source instead of drawing outside.
    const cw = w / k;
    const ch = h / k;
    c.drawImage(s.img, s.sx + (s.sw - cw) / 2, s.sy + (s.sh - ch) / 2, cw, ch, 0, 0, w, h);
    return;
  }
  c.drawImage(s.img, s.sx, s.sy, s.sw, s.sh, dx, dy, dw, dh);
}

/** A guide piece (optionally cropped) fitted into a w×h texture; returns its key or null if the piece is not loaded. */
export function pieceTexture(scene: Phaser.Scene, level: number, p: Piece, w: number, h: number, fit: Fit = 'contain', align: 'bottom' | 'center' = 'center'): string | null {
  const key = `${pieceKey(level, p.code)}_${(p.crop ?? []).join('_')}_${w}x${h}_${fit}`;
  if (scene.textures.exists(key)) return key;
  const s = source(scene, level, p);
  if (!s) return null;
  makeTexture(scene, key, w, h, (c) => draw(c, s, w, h, fit, align));
  return key;
}

/** Builds role textures for one level from its guide pieces (if loaded) and registers its theme. */
export function buildLevelTheme(scene: Phaser.Scene, level: number): string | null {
  const art = LEVEL_ART[level];
  if (!art) return null;
  const id = `lv${level}`;
  if (THEMES[id]) return id;
  const make = (key: string, p: Piece, w: number, h: number, fit: Fit, align: 'bottom' | 'center' = 'bottom'): string | null => {
    const s = source(scene, level, p);
    if (!s) return null;
    makeTexture(scene, key, w, h, (c) => draw(c, s, w, h, fit, align));
    return key;
  };
  const block = make(`${id}_block`, art.block, 64, 64, 'cover');
  const breakable = art.breakable ? make(`${id}_break`, art.breakable, 60, 56, 'contain') : null;
  const low = make(`${id}_low`, art.low, 52, 44, 'contain');
  const roller = make(`${id}_roll`, art.roller, 50, 50, 'contain', 'center');
  const duck = make(`${id}_duck`, art.duck, 180, 64, 'stretch');
  const shot = make(`${id}_shot`, art.shot, 28, 28, 'contain', 'center');
  const pile = make(`${id}_pile`, art.shot, 40, 30, 'contain');
  // Thrower: 90 px tall, as wide as its proportions need.
  const ts = source(scene, level, art.thrower);
  const tw = ts ? Math.min(150, Math.round((ts.sw / ts.sh) * 90)) : 90;
  const enemy = make(`${id}_enemy`, art.thrower, tw, 90, 'contain');
  // Exit landmark: a big piece of street furniture at the end of the route.
  const gate = make(`${id}_gate`, art.exit, 320, 260, 'contain');
  // Platform deck tile: the chosen band, 22 px thick, repeating sideways.
  const ds = source(scene, level, art.deck);
  if (ds) {
    const th = 22;
    const tw2 = Math.max(32, Math.round((ds.sw / ds.sh) * th));
    makeTexture(scene, `platform_mid_${id}`, tw2, th, (c) => draw(c, ds, tw2, th, 'stretch'));
  }
  THEMES[id] = {
    far: 'depot_far',
    roof: 'depot_roofline',
    low: [low ?? 'tyre'],
    crate: [block ?? 'crate'],
    cardboard: [breakable ?? 'cardboard'],
    platform: [ds ? id : 'steel'],
    lowbar: duck ?? 'lowbar',
    lowbarPole: { dark: 0x302331, mid: 0x6f7e96 },
    gate: gate ?? 'exit_gate',
    gateDoor: '',
    defaultZone: { near: 'depot_near', mid: 'depot_mid', indoor: false },
    level,
    roller: roller ?? 'barrel',
    enemy: enemy ?? undefined,
    shot: shot ?? undefined,
    pile: pile ?? undefined,
    deckThickness: ds ? 22 : undefined,
  };
  return id;
}
