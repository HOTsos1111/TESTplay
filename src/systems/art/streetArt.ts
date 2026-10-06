import type Phaser from 'phaser';
import { BAND, ell, fillStroke, makeBand, makeTexture, PAL, rng, rr, stroke, wrapDraw, type Ctx } from './canvas';
import { DECALS, ROOF_BAND, ZONE_ACTORS, ZONE_DECALS } from './decorArt';

/**
 * Chapter 2, the shopping street (style guide "Shopping Street" panel):
 * cream and terracotta shopfronts, striped awnings, bakery windows, café
 * signs, market stalls and the park railings at the far end.
 */

const W = 1280;
const H = 720;
const OUT = '#302331';
const WALL_TOP = 360;

// ------------------------------------------------------------ helpers

function awning(c: Ctx, x: number, y: number, w: number, h: number, a: string, b: string): void {
  // Striped canvas with a scalloped valance.
  c.save();
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x + w, y);
  c.lineTo(x + w + 8, y + h);
  c.lineTo(x - 8, y + h);
  c.closePath();
  c.clip();
  const n = Math.max(4, Math.round(w / 30));
  for (let i = 0; i < n; i++) {
    c.fillStyle = i % 2 ? b : a;
    c.fillRect(x - 8 + (i * (w + 16)) / n, y, (w + 16) / n + 1, h);
  }
  c.fillStyle = 'rgba(48,35,49,0.12)';
  c.fillRect(x - 8, y + h * 0.65, w + 16, h);
  c.restore();
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x + w, y);
  c.lineTo(x + w + 8, y + h);
  c.lineTo(x - 8, y + h);
  c.closePath();
  stroke(c, 3.5, OUT);
  // Scallops.
  const sc = Math.max(4, Math.round((w + 16) / 26));
  const sw = (w + 16) / sc;
  for (let i = 0; i < sc; i++) {
    c.beginPath();
    c.moveTo(x - 8 + i * sw, y + h);
    c.arc(x - 8 + i * sw + sw / 2, y + h, sw / 2, Math.PI, 0, true);
    c.closePath();
    fillStroke(c, i % 2 ? b : a, 3, OUT);
  }
}

function flowers(c: Ctx, x: number, y: number, w: number, r: () => number, colors: string[]): void {
  for (let i = 0; i < Math.max(3, w / 14); i++) {
    const fx = x + 4 + r() * (w - 8);
    const fy = y - 4 - r() * 12;
    ell(c, fx, fy + 6, 7, 6);
    c.fillStyle = '#5DAA55';
    c.fill();
    for (let k = 0; k < 5; k++) {
      ell(c, fx + Math.cos(k * 1.26) * 3, fy + Math.sin(k * 1.26) * 3, 2.4, 2.4);
      c.fillStyle = colors[i % colors.length];
      c.fill();
    }
    ell(c, fx, fy, 1.6, 1.6);
    c.fillStyle = PAL.tag;
    c.fill();
  }
}

function flowerBox(c: Ctx, x: number, y: number, w: number, r: () => number): void {
  flowers(c, x, y, w, r, ['#F07562', '#F3A0BA', PAL.white]);
  rr(c, x, y, w, 14, 3);
  fillStroke(c, '#B9763F', 3, OUT);
}

function lamp(c: Ctx, x: number, base: number, top: number): void {
  // Dark green street lamp with a glowing lantern.
  rr(c, x - 10, base - 22, 20, 22, 3);
  fillStroke(c, '#2F6B54', 3, OUT);
  c.beginPath();
  c.moveTo(x, base - 20);
  c.lineTo(x, top + 34);
  stroke(c, 9, OUT);
  stroke(c, 5, '#2F6B54');
  c.beginPath();
  c.moveTo(x - 16, top + 6);
  c.lineTo(x + 16, top + 6);
  c.lineTo(x + 10, top + 34);
  c.lineTo(x - 10, top + 34);
  c.closePath();
  fillStroke(c, '#FFE38A', 3, OUT);
  c.beginPath();
  c.moveTo(x - 20, top + 6);
  c.lineTo(x, top - 10);
  c.lineTo(x + 20, top + 6);
  c.closePath();
  fillStroke(c, '#2F6B54', 3, OUT);
  ell(c, x, top - 13, 4, 4);
  fillStroke(c, '#2F6B54', 2.5, OUT);
}

function tree(c: Ctx, x: number, base: number, size: number): void {
  c.beginPath();
  c.moveTo(x - 9, base);
  c.quadraticCurveTo(x - 4, base - size * 0.6, x - 6, base - size);
  c.lineTo(x + 6, base - size);
  c.quadraticCurveTo(x + 4, base - size * 0.6, x + 9, base);
  c.closePath();
  fillStroke(c, '#8A5A3A', 3, OUT);
  for (const [dx, dy, rad] of [[-40, -size - 10, 42], [0, -size - 40, 52], [42, -size - 8, 40], [-14, -size + 14, 34], [22, -size + 16, 34]]) {
    ell(c, x + dx, base + dy, rad, rad * 0.86);
    fillStroke(c, '#5DAA55', 3.5, OUT);
  }
  for (const [dx, dy] of [[-24, -size - 40], [14, -size - 62], [36, -size - 20]]) {
    ell(c, x + dx, base + dy, 14, 9);
    c.fillStyle = '#7CC26B';
    c.fill();
  }
}

function wallBase(c: Ctx, color: string, draw: () => void): void {
  c.fillStyle = color;
  c.fillRect(0, WALL_TOP, W, 600 - WALL_TOP);
  draw();
  c.fillStyle = OUT;
  c.fillRect(0, WALL_TOP - 4, W, 6);
  // Stone kerb along the foot of the wall.
  c.fillStyle = '#CFC3B0';
  c.fillRect(0, 584, W, 16);
  c.fillStyle = 'rgba(48,35,49,0.25)';
  for (let x = 0; x < W; x += 80) c.fillRect(x, 584, 3, 16);
  c.fillStyle = OUT;
  c.fillRect(0, 582, W, 3);
  // Soft overlay so the wall sits behind the action.
  c.fillStyle = 'rgba(255,248,232,0.12)';
  c.fillRect(0, WALL_TOP, W, 600 - WALL_TOP);
  const pit = c.createLinearGradient(0, 600, 0, H);
  pit.addColorStop(0, '#4A3550');
  pit.addColorStop(1, '#1E1520');
  c.fillStyle = pit;
  c.fillRect(0, 600, W, H - 600);
}

function bricks(c: Ctx, x: number, y: number, w: number, h: number, mortar: string): void {
  c.fillStyle = mortar;
  for (let by = y; by < y + h; by += 18) {
    c.fillRect(x, by, w, 2);
    for (let bx = x + ((by / 18) % 2) * 22; bx < x + w; bx += 44) c.fillRect(bx, by, 2, 18);
  }
}

function shopWindow(c: Ctx, x: number, y: number, w: number, h: number, goods: 'bakery' | 'cafe', r: () => number): void {
  rr(c, x - 6, y - 6, w + 12, h + 12, 6);
  fillStroke(c, PAL.white, 4, OUT);
  rr(c, x, y, w, h, 4);
  fillStroke(c, '#CBE8F2', 3, OUT);
  // Shelves of goods.
  for (const sy of [y + h * 0.45, y + h * 0.92]) {
    c.fillStyle = '#B9763F';
    c.fillRect(x + 4, sy, w - 8, 5);
    for (let gx = x + 14; gx < x + w - 14; gx += 26 + r() * 6) {
      if (goods === 'bakery') {
        const k = r();
        if (k < 0.4) {
          ell(c, gx, sy - 8, 11, 8);
          fillStroke(c, '#E0A35A', 2.5, OUT);
          c.beginPath();
          c.moveTo(gx - 6, sy - 10);
          c.lineTo(gx - 2, sy - 6);
          c.moveTo(gx + 1, sy - 11);
          c.lineTo(gx + 5, sy - 7);
          stroke(c, 1.6, '#9A5A22');
        } else if (k < 0.7) {
          c.beginPath();
          c.arc(gx, sy - 2, 11, Math.PI, 0);
          c.closePath();
          fillStroke(c, '#E8B65E', 2.5, OUT);
        } else {
          ell(c, gx, sy - 9, 9, 9);
          fillStroke(c, '#F3A0BA', 2.5, OUT);
          ell(c, gx, sy - 13, 3, 3);
          c.fillStyle = '#E0503F';
          c.fill();
        }
      } else {
        rr(c, gx - 8, sy - 18, 16, 18, 3);
        fillStroke(c, PAL.white, 2.5, OUT);
        c.beginPath();
        c.arc(gx + 9, sy - 10, 5, -Math.PI / 2, Math.PI / 2);
        stroke(c, 2.5, OUT);
      }
    }
  }
  // Glass glint.
  c.beginPath();
  c.moveTo(x + w * 0.65, y + 6);
  c.lineTo(x + w * 0.45, y + h * 0.4);
  stroke(c, 4, 'rgba(255,255,255,0.6)');
}

function door(c: Ctx, x: number, top: number, w: number, color: string): void {
  rr(c, x, top, w, 600 - top - 16, 6);
  fillStroke(c, color, 4, OUT);
  rr(c, x + 10, top + 12, w - 20, 50, 4);
  fillStroke(c, '#CBE8F2', 3, OUT);
  ell(c, x + w - 14, top + (600 - top) / 2 + 10, 4.5, 4.5);
  fillStroke(c, PAL.tag, 2, OUT);
}

function signBoard(c: Ctx, x: number, y: number, w: number, color: string, icon: 'bone' | 'loaf' | 'cup' | 'apple'): void {
  rr(c, x, y, w, 30, 6);
  fillStroke(c, color, 3.5, OUT);
  const ix = x + 24;
  const iy = y + 15;
  if (icon === 'bone') {
    for (const [dx, dy] of [[-9, -4], [-9, 4], [9, -4], [9, 4]]) {
      ell(c, ix + dx, iy + dy, 4, 4);
      fillStroke(c, PAL.white, 2, OUT);
    }
    rr(c, ix - 9, iy - 4, 18, 8, 2);
    c.fillStyle = PAL.white;
    c.fill();
  } else if (icon === 'loaf') {
    c.beginPath();
    c.arc(ix, iy + 6, 11, Math.PI, 0);
    c.closePath();
    fillStroke(c, '#E8B65E', 2.5, OUT);
  } else if (icon === 'cup') {
    rr(c, ix - 8, iy - 8, 14, 15, 3);
    fillStroke(c, PAL.white, 2.5, OUT);
    c.beginPath();
    c.arc(ix + 7, iy - 1, 4, -Math.PI / 2, Math.PI / 2);
    stroke(c, 2.5, OUT);
  } else {
    ell(c, ix, iy + 1, 9, 8);
    fillStroke(c, '#E0503F', 2.5, OUT);
    c.beginPath();
    c.moveTo(ix, iy - 7);
    c.lineTo(ix + 3, iy - 12);
    stroke(c, 2.5, OUT);
  }
  // Lettering as bars (no baked-in text).
  c.fillStyle = 'rgba(255,253,246,0.9)';
  rr(c, x + 46, y + 9, w - 64, 5, 2);
  c.fill();
  rr(c, x + 46, y + 18, (w - 64) * 0.7, 4, 2);
  c.fill();
}

// ------------------------------------------------------------ far / mid / roofline

const SKY_K = 2.0;
const SKY_SRC = { w: 734, h: 150 };

function drawStreetFar(c: Ctx, art: CanvasImageSource): void {
  const sw = SKY_SRC.w * SKY_K;
  const sh = SKY_SRC.h * SKY_K;
  const bottom = 480;
  const top = bottom - sh;
  const sky = c.createLinearGradient(0, 0, 0, top + 40);
  sky.addColorStop(0, '#6FC0E8');
  sky.addColorStop(1, '#A9DBF1');
  c.fillStyle = sky;
  c.fillRect(0, 0, sw * 2, H);
  c.imageSmoothingQuality = 'high';
  c.drawImage(art, 0, top, sw, sh);
  c.save();
  c.translate(sw * 2, 0);
  c.scale(-1, 1);
  c.drawImage(art, 0, top, sw, sh);
  c.restore();
  const blend = c.createLinearGradient(0, top - 2, 0, top + 60);
  blend.addColorStop(0, '#A9DBF1');
  blend.addColorStop(1, 'rgba(169,219,241,0)');
  c.fillStyle = blend;
  c.fillRect(0, top - 2, sw * 2, 62);
  c.fillStyle = 'rgba(214,236,246,0.3)';
  c.fillRect(0, top, sw * 2, sh);
  c.fillStyle = '#D9CDBA';
  c.fillRect(0, bottom, sw * 2, H - bottom);
}

function drawStreetMid(c: Ctx): void {
  // Townhouse upper floors: chimneys, roofs, windows with boxes and shutters.
  const r = rng(77);
  const walls = ['#F3D9A4', '#E7A07E', '#9CC9C0', '#F6E3C0', '#D98B6C', '#B9C6D6'];
  let x = 0;
  let i = 0;
  while (x < W - 100) {
    const w = 170 + r() * 90;
    const top = 170 + r() * 80;
    const col = walls[i++ % walls.length];
    const pitched = r() > 0.45;
    const chim = r() > 0.35;
    const draw = (ox: number) => {
      if (chim) {
        rr(c, ox + w * 0.7, top - (pitched ? 70 : 40), 26, 70, 2);
        fillStroke(c, '#C2614A', 3.5, OUT);
        rr(c, ox + w * 0.7 - 4, top - (pitched ? 78 : 48), 34, 10, 2);
        fillStroke(c, '#8A6A5A', 3, OUT);
      }
      if (pitched) {
        c.beginPath();
        c.moveTo(ox - 10, top + 4);
        c.lineTo(ox + w / 2, top - 46);
        c.lineTo(ox + w + 10, top + 4);
        c.closePath();
        fillStroke(c, '#C9654A', 3.5, OUT);
        c.fillStyle = 'rgba(48,35,49,0.18)';
        for (let ry = top - 30; ry < top; ry += 12) c.fillRect(ox + 10, ry, w - 20, 2);
      }
      rr(c, ox, top, w, H - top, 3);
      fillStroke(c, col, 3.5, OUT);
      if (!pitched) {
        rr(c, ox - 6, top - 10, w + 12, 14, 3);
        fillStroke(c, '#E6CFA4', 3, OUT);
      }
      for (let wy = top + 28; wy < 380; wy += 70) {
        for (let wx = ox + 24; wx < ox + w - 50; wx += 62) {
          rr(c, wx - 6, wy, 8, 42, 2);
          fillStroke(c, '#2E8B86', 2.5, OUT);
          rr(c, wx + 32, wy, 8, 42, 2);
          fillStroke(c, '#2E8B86', 2.5, OUT);
          rr(c, wx + 2, wy, 30, 42, 4);
          fillStroke(c, '#E3F2F8', 3, OUT);
          c.beginPath();
          c.moveTo(wx + 17, wy);
          c.lineTo(wx + 17, wy + 42);
          stroke(c, 2, OUT);
          flowerBox(c, wx - 2, wy + 42, 38, r);
        }
      }
    };
    wrapDraw(W, x, w, draw);
    x += w + 8 + r() * 30;
  }
  const haze = c.createLinearGradient(0, 160, 0, 600);
  haze.addColorStop(0, 'rgba(214,236,246,0.05)');
  haze.addColorStop(1, 'rgba(214,236,246,0.32)');
  c.save();
  c.globalCompositeOperation = 'source-atop';
  c.fillStyle = haze;
  c.fillRect(0, 110, W, 610);
  c.restore();
}

function drawStreetRoofline(c: Ctx): void {
  // Lamp posts with bunting strung between them, and a couple of street trees.
  const posts = [120, 540, 960];
  wrapDraw(W, 290, 120, (ox) => tree(c, ox + 60, 380, 120));
  wrapDraw(W, 1110, 120, (ox) => tree(c, ox + 60, 380, 100));
  for (let i = 0; i < posts.length; i++) {
    const a = posts[i];
    const b = i + 1 < posts.length ? posts[i + 1] : posts[0] + W;
    // Bunting.
    c.beginPath();
    const sag = (t: number) => 150 + Math.sin(t * Math.PI) * 40;
    c.moveTo(a, 150);
    for (let t = 0; t <= 1.001; t += 0.05) c.lineTo(a + (b - a) * t, sag(t));
    stroke(c, 2.5, OUT);
    const cols = ['#F07562', '#FFD95A', '#42B7B0', '#FFFDF6', '#F3A0BA'];
    for (let k = 1; k < 12; k++) {
      const t = k / 12;
      const fx = a + (b - a) * t;
      const fy = sag(t);
      c.beginPath();
      c.moveTo(fx - 9, fy);
      c.lineTo(fx + 9, fy);
      c.lineTo(fx, fy + 18);
      c.closePath();
      fillStroke(c, cols[k % cols.length], 2.5, OUT);
    }
  }
  for (const p of posts) {
    wrapDraw(W, p - 30, 60, (ox) => {
      lamp(c, ox + 30, 380, 130);
      // Hanging flower basket.
      c.beginPath();
      c.moveTo(ox + 30, 210);
      c.lineTo(ox + 58, 210);
      c.lineTo(ox + 58, 222);
      stroke(c, 4, OUT);
      c.beginPath();
      c.arc(ox + 58, 232, 14, 0, Math.PI);
      c.closePath();
      fillStroke(c, '#B9763F', 3, OUT);
      flowers(c, ox + 42, 232, 32, rng(p), ['#F07562', '#F3A0BA', '#C59BE0']);
    });
  }
}

// ------------------------------------------------------------ near walls (zones)

function drawBakeryRow(c: Ctx): void {
  const r = rng(5);
  wallBase(c, '#F6E3C0', () => {
    const facades = ['#F6E3C0', '#F2C4C0', '#F3D9A4'];
    const icons = ['loaf', 'bone', 'loaf'] as const;
    const aw = [['#F07562', '#FFFDF6'], ['#42B7B0', '#FFFDF6'], ['#F2B84A', '#FFFDF6']];
    for (let i = 0; i < 3; i++) {
      const x0 = i * 426 + 8;
      c.fillStyle = facades[i];
      c.fillRect(x0, WALL_TOP, 412, 230);
      signBoard(c, x0 + 60, 370, 290, i === 1 ? '#C9654A' : '#2E8B86', icons[i]);
      awning(c, x0 + 30, 408, 340, 30, aw[i][0], aw[i][1]);
      shopWindow(c, x0 + 40, 466, 196, 98, 'bakery', r);
      door(c, x0 + 268, 458, 70, i === 1 ? '#42B7B0' : '#C9654A');
      flowerBox(c, x0 + 40, 570, 196, r);
      // Stone pilasters between shops.
      rr(c, x0 - 8, WALL_TOP, 16, 224, 2);
      fillStroke(c, '#E6CFA4', 3, OUT);
    }
  });
}

function drawCafeCorner(c: Ctx): void {
  const r = rng(9);
  wallBase(c, '#3A9E98', () => {
    for (let i = 0; i < 3; i++) {
      const x0 = i * 426 + 8;
      c.fillStyle = i === 1 ? '#F6E3C0' : '#3A9E98';
      c.fillRect(x0, WALL_TOP, 412, 230);
      signBoard(c, x0 + 60, 370, 290, i === 1 ? '#2E8B86' : '#C9654A', i === 2 ? 'bone' : 'cup');
      awning(c, x0 + 30, 408, 340, 30, '#F2B84A', '#FFFDF6');
      shopWindow(c, x0 + 40, 466, 196, 98, 'cafe', r);
      door(c, x0 + 268, 458, 70, i === 1 ? '#C9654A' : '#F6E3C0');
      // Chalkboard menu on the wall.
      rr(c, x0 + 352, 470, 44, 64, 4);
      fillStroke(c, '#3B3540', 3, OUT);
      c.fillStyle = 'rgba(255,255,255,0.7)';
      for (let k = 0; k < 4; k++) c.fillRect(x0 + 358, 480 + k * 12, 32 - (k % 2) * 10, 3);
      rr(c, x0 - 8, WALL_TOP, 16, 224, 2);
      fillStroke(c, '#E6CFA4', 3, OUT);
    }
  });
}

function drawMarket(c: Ctx): void {
  const r = rng(13);
  wallBase(c, '#C9765F', () => {
    bricks(c, 0, WALL_TOP, W, 224, 'rgba(255,230,210,0.25)');
    const canopies = [['#5DAA55', '#FFFDF6'], ['#F07562', '#FFFDF6'], ['#42B7B0', '#FFFDF6']];
    for (let i = 0; i < 3; i++) {
      const x0 = i * 426 + 30;
      // Poles, canopy and a stall table of fruit crates.
      for (const px of [x0 + 10, x0 + 350]) {
        c.beginPath();
        c.moveTo(px, 400);
        c.lineTo(px, 584);
        stroke(c, 8, OUT);
        stroke(c, 4, '#8A5A3A');
      }
      awning(c, x0, 384, 360, 34, canopies[i][0], canopies[i][1]);
      rr(c, x0 + 10, 512, 340, 14, 3);
      fillStroke(c, '#B9763F', 3, OUT);
      for (let k = 0; k < 4; k++) {
        const cx = x0 + 28 + k * 80;
        rr(c, cx, 478, 64, 34, 4);
        fillStroke(c, '#D9A86C', 3, OUT);
        const fruit = ['#F2963B', '#E0503F', '#8CC152', '#FFD95A'][(i + k) % 4];
        for (let f = 0; f < 5; f++) {
          ell(c, cx + 9 + f * 12, 476 - (f % 2) * 6, 7.5, 7.5);
          fillStroke(c, fruit, 2, OUT);
        }
      }
      // Price tags (shapes only).
      rr(c, x0 + 150, 440, 60, 26, 4);
      fillStroke(c, '#3B3540', 2.5, OUT);
      c.fillStyle = 'rgba(255,255,255,0.75)';
      c.fillRect(x0 + 160, 450, 40, 4);
      void r;
    }
  });
}

function drawParkEdge(c: Ctx): void {
  wallBase(c, '#9CCB7A', () => {
    // Trees and hedges behind iron railings on a low brick wall.
    const sky = c.createLinearGradient(0, WALL_TOP, 0, 520);
    sky.addColorStop(0, '#BFE6F2');
    sky.addColorStop(1, '#D9EFD0');
    c.fillStyle = sky;
    c.fillRect(0, WALL_TOP, W, 170);
    for (let x = 60; x < W; x += 260) tree(c, x, 540, 70);
    for (let x = -20; x < W; x += 70) {
      ell(c, x, 500, 50, 34);
      fillStroke(c, '#4E9A4E', 3, OUT);
    }
    // Low wall with coping.
    c.fillStyle = '#C9765F';
    c.fillRect(0, 532, W, 52);
    bricks(c, 0, 532, W, 52, 'rgba(255,230,210,0.3)');
    rr(c, -4, 522, W + 8, 14, 3);
    fillStroke(c, '#E6CFA4', 3, OUT);
    // Railings with spear tips.
    for (let x = 6; x < W; x += 22) {
      c.beginPath();
      c.moveTo(x, 522);
      c.lineTo(x, 430);
      stroke(c, 4, OUT);
      c.beginPath();
      c.moveTo(x - 5, 432);
      c.lineTo(x, 420);
      c.lineTo(x + 5, 432);
      c.closePath();
      fillStroke(c, OUT, 0);
    }
    c.fillStyle = OUT;
    c.fillRect(0, 446, W, 4);
    c.fillRect(0, 500, W, 4);
    for (const x of [200, 840]) lamp(c, x, 584, 400);
  });
}

// ------------------------------------------------------------ obstacles and props

function drawAwningBar(c: Ctx): void {
  // Retractable shop-awning cassette (the street's duck-under bar), 110×62.
  rr(c, 3, 10, 104, 22, 8);
  fillStroke(c, '#2F6B54', 4, OUT);
  c.fillStyle = 'rgba(255,255,255,0.25)';
  c.fillRect(10, 14, 90, 5);
  c.save();
  c.beginPath();
  c.rect(3, 30, 104, 24);
  c.clip();
  for (let i = 0; i < 8; i++) {
    c.fillStyle = i % 2 ? '#FFFDF6' : '#F07562';
    c.fillRect(3 + i * 13, 30, 13, 24);
  }
  c.restore();
  // Scalloped valance.
  for (let i = 0; i < 8; i++) {
    c.beginPath();
    c.moveTo(3 + i * 13, 52);
    c.arc(3 + i * 13 + 6.5, 52, 6.5, Math.PI, 0, true);
    c.closePath();
    fillStroke(c, i % 2 ? '#FFFDF6' : '#F07562', 2.5, OUT);
  }
  rr(c, 3, 30, 104, 22, 2);
  stroke(c, 3.5, OUT);
  for (const x of [12, 98]) {
    ell(c, x, 21, 3.5, 3.5);
    fillStroke(c, PAL.tag, 2, OUT);
  }
}

function drawAwningDeck(c: Ctx): void {
  // 64×18 platform deck: a taut striped awning.
  for (let i = 0; i < 4; i++) {
    c.fillStyle = i % 2 ? '#FFFDF6' : '#F07562';
    c.fillRect(i * 16, 3, 16, 12);
  }
  c.fillStyle = 'rgba(48,35,49,0.18)';
  c.fillRect(0, 11, 64, 4);
  c.fillStyle = OUT;
  c.fillRect(0, 0, 64, 3);
  c.fillRect(0, 15, 64, 3);
}

function drawParkGate(c: Ctx): void {
  // 220×282 frame: brick pillars with stone caps and a wrought-iron arch.
  for (const px of [0, 180]) {
    rr(c, px + 2, 66, 38, 214, 3);
    fillStroke(c, '#C9765F', 3.5, OUT);
    c.fillStyle = 'rgba(255,230,210,0.3)';
    for (let y = 80; y < 280; y += 16) c.fillRect(px + 4, y, 34, 2);
    rr(c, px - 4, 54, 50, 16, 3);
    fillStroke(c, '#E6CFA4', 3, OUT);
    ell(c, px + 21, 44, 12, 12);
    fillStroke(c, '#E6CFA4', 3, OUT);
  }
  c.beginPath();
  c.moveTo(40, 92);
  c.quadraticCurveTo(110, 20, 180, 92);
  stroke(c, 8, OUT);
  stroke(c, 4, '#3B3540');
  for (let x = 60; x <= 160; x += 20) {
    c.beginPath();
    c.moveTo(x, 92);
    c.lineTo(x, 92 - (40 - Math.abs(x - 110) * 0.6));
    stroke(c, 3, OUT);
  }
  // Heart crest, as on the garden gate in the guide.
  c.beginPath();
  c.moveTo(110, 66);
  c.bezierCurveTo(96, 54, 98, 40, 110, 46);
  c.bezierCurveTo(122, 40, 124, 54, 110, 66);
  fillStroke(c, '#F07562', 2.5, OUT);
}

function drawParkGateDoor(c: Ctx): void {
  // 84×240 wrought-iron gate leaf.
  rr(c, 4, 40, 76, 196, 4);
  stroke(c, 6, OUT);
  for (let x = 14; x < 76; x += 14) {
    c.beginPath();
    c.moveTo(x, 236);
    c.lineTo(x, 40);
    stroke(c, 4, OUT);
    c.beginPath();
    c.moveTo(x - 4, 42);
    c.lineTo(x, 30);
    c.lineTo(x + 4, 42);
    c.closePath();
    fillStroke(c, OUT, 0);
  }
  for (const y of [80, 200]) {
    c.beginPath();
    c.moveTo(4, y);
    c.lineTo(80, y);
    stroke(c, 5, OUT);
  }
  for (const y of [140]) {
    ell(c, 42, y, 16, 16);
    stroke(c, 4, OUT);
  }
}

// ------------------------------------------------------------ decals (on the near wall)

DECALS.push(
  { key: 'st_basket', w: 70, h: 80, draw: (c) => {
    c.beginPath();
    c.moveTo(8, 6);
    c.lineTo(52, 6);
    c.lineTo(52, 18);
    stroke(c, 4, OUT);
    c.beginPath();
    c.arc(52, 40, 16, 0, Math.PI);
    c.closePath();
    fillStroke(c, '#B9763F', 3, OUT);
    flowers(c, 34, 40, 36, rng(3), ['#F07562', '#F3A0BA', '#FFFDF6']);
  } },
  { key: 'st_lantern', w: 50, h: 70, draw: (c) => {
    c.beginPath();
    c.moveTo(4, 8);
    c.lineTo(26, 8);
    c.lineTo(26, 18);
    stroke(c, 4, OUT);
    rr(c, 14, 18, 24, 34, 4);
    fillStroke(c, '#FFE38A', 3, OUT);
    c.beginPath();
    c.moveTo(10, 20);
    c.lineTo(26, 10);
    c.lineTo(42, 20);
    c.closePath();
    fillStroke(c, '#2F6B54', 3, OUT);
  } },
  { key: 'st_poster_lost', w: 64, h: 84, draw: (c) => {
    rr(c, 3, 3, 58, 78, 3);
    fillStroke(c, PAL.white, 3, OUT);
    ell(c, 32, 34, 16, 14);
    fillStroke(c, '#B66B38', 2.5, OUT);
    ell(c, 24, 36, 5, 9, 0.3);
    c.fillStyle = '#5A3A2E';
    c.fill();
    c.fillStyle = OUT;
    c.fillRect(12, 56, 40, 4);
    c.fillRect(16, 66, 32, 3);
  } },
);
ZONE_DECALS.street_near_bakery = ['st_basket', 'st_lantern', 'decor_bunting'];
ZONE_DECALS.street_near_cafe = ['st_basket', 'st_lantern', 'decor_clock'];
ZONE_DECALS.street_near_market = ['st_poster_lost', 'st_basket', 'decor_bunting'];
ZONE_DECALS.street_near_park = ['st_lantern'];
ZONE_ACTORS.street_near_bakery = ['pigeons', 'cat'];
ZONE_ACTORS.street_near_cafe = ['pigeons'];
ZONE_ACTORS.street_near_market = ['pigeons', 'cat'];
ZONE_ACTORS.street_near_park = ['pigeons', 'pigeons'];

export function generateStreetArt(scene: Phaser.Scene): void {
  if (scene.textures.exists('bg_street_skyline')) {
    const art = scene.textures.get('bg_street_skyline').getSourceImage() as CanvasImageSource;
    makeTexture(scene, 'street_far', SKY_SRC.w * SKY_K * 2, H, (c) => drawStreetFar(c, art));
  }
  makeBand(scene, 'street_mid', W, BAND.mid, drawStreetMid);
  makeBand(scene, 'street_roofline', W, ROOF_BAND, drawStreetRoofline);
  makeBand(scene, 'street_near_bakery', W, BAND.near, drawBakeryRow);
  makeBand(scene, 'street_near_cafe', W, BAND.near, drawCafeCorner);
  makeBand(scene, 'street_near_market', W, BAND.near, drawMarket);
  makeBand(scene, 'street_near_park', W, BAND.near, drawParkEdge);
  makeTexture(scene, 'lowbar_awning', 110, 62, drawAwningBar);
  makeTexture(scene, 'platform_mid_awning', 64, 18, drawAwningDeck);
  makeTexture(scene, 'park_gate', 220, 282, drawParkGate);
  makeTexture(scene, 'park_gate_door', 84, 240, drawParkGateDoor);
}
