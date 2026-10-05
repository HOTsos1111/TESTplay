import type Phaser from 'phaser';
import { BAND, ell, fillStroke, makeBand, makeTexture, PAL, rng, rr, shade, stroke, wrapDraw, type Ctx } from './canvas';

const W = 1280;
const H = 720;
const WALL_TOP = 360;
const SOFT = 'rgba(48,35,49,0.9)';

/** Common base: wall band, its top rule, the haze and the dark pit band below the floor. */
function wallBase(c: Ctx, color: string, stripe: string | null, draw: () => void): void {
  c.fillStyle = color;
  c.fillRect(0, WALL_TOP, W, 600 - WALL_TOP);
  if (stripe) {
    c.fillStyle = stripe;
    for (let y = WALL_TOP + 14; y < 600; y += 28) c.fillRect(0, y, W, 3);
  }
  draw();
  c.fillStyle = 'rgba(48,35,49,0.85)';
  c.fillRect(0, WALL_TOP - 4, W, 6);
  c.fillStyle = 'rgba(252,230,200,0.16)';
  c.fillRect(0, WALL_TOP, W, 600 - WALL_TOP);
  const pit = c.createLinearGradient(0, 600, 0, H);
  pit.addColorStop(0, '#4A3550');
  pit.addColorStop(1, '#1E1520');
  c.fillStyle = pit;
  c.fillRect(0, 600, W, H - 600);
}

// --------------------------------------------------------- near wall zones

function drawSortingHall(c: Ctx): void {
  wallBase(c, '#E6CFA4', '#D6BB8A', () => {
    // Two conveyor belts running along the wall, loaded with parcels.
    for (const y of [430, 520]) {
      rr(c, -10, y, W + 20, 16, 6);
      fillStroke(c, '#4F5B73', 2.5, SOFT);
      for (let x = 10; x < W; x += 40) {
        ell(c, x, y + 8, 5, 5);
        fillStroke(c, '#8C99B3', 1.5, SOFT);
      }
      const r = rng(y);
      for (let x = 30; x < W - 60; x += 90 + r() * 120) {
        const w = 34 + r() * 30;
        const h = 22 + r() * 20;
        rr(c, x, y - h, w, h, 3);
        fillStroke(c, r() > 0.5 ? '#D9A85E' : '#E8C48A', 2, SOFT);
        c.fillStyle = 'rgba(255,255,255,0.4)';
        c.fillRect(x + w / 2 - 3, y - h, 6, h);
      }
      // Support legs.
      for (let x = 60; x < W; x += 160) {
        c.fillStyle = 'rgba(79,91,115,0.8)';
        c.fillRect(x, y + 16, 8, 600 - y - 16);
      }
    }
    // Hazard-light strip along the top (decorative, high up).
    for (let x = 30; x < W; x += 160) {
      ell(c, x, WALL_TOP + 22, 9, 9);
      fillStroke(c, '#FFB04A', 2, SOFT);
    }
  });
}

function drawColdStorage(c: Ctx): void {
  wallBase(c, '#A9CFE0', null, () => {
    // Insulated panels.
    c.strokeStyle = 'rgba(48,35,49,0.25)';
    c.lineWidth = 2;
    for (let x = 0; x < W; x += 80) {
      c.beginPath();
      c.moveTo(x, WALL_TOP);
      c.lineTo(x, 600);
      c.stroke();
    }
    // Freezer doors with plastic strip curtains.
    for (let i = 0; i < 2; i++) {
      const bx = 180 + i * 640;
      rr(c, bx, WALL_TOP + 30, 220, 210, 8);
      fillStroke(c, '#6FA3BE', 3, SOFT);
      for (let x = bx + 8; x < bx + 212; x += 22) {
        c.fillStyle = 'rgba(230,248,255,0.6)';
        c.fillRect(x, WALL_TOP + 40, 16, 200);
      }
      // Snowflake sign (shape only).
      c.save();
      c.translate(bx + 110, WALL_TOP + 14);
      for (let k = 0; k < 3; k++) {
        c.rotate(Math.PI / 3);
        c.beginPath();
        c.moveTo(-10, 0);
        c.lineTo(10, 0);
        stroke(c, 3, '#FFFFFF');
      }
      c.restore();
    }
    // Icicles and frost along the top.
    const r = rng(77);
    for (let x = 0; x < W; x += 14 + r() * 20) {
      const l = 8 + r() * 26;
      c.beginPath();
      c.moveTo(x, WALL_TOP + 2);
      c.lineTo(x + 5, WALL_TOP + 2 + l);
      c.lineTo(x + 10, WALL_TOP + 2);
      c.closePath();
      c.fillStyle = 'rgba(240,252,255,0.9)';
      c.fill();
    }
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.fillRect(0, 580, W, 20);
  });
}

function drawContainerYard(c: Ctx): void {
  // Open air: chain-link fence in front of stacked shipping containers.
  const cols = ['#D9614C', '#3E8FB0', '#E3A13B', '#5E9C6A', '#9B6BB5'];
  const r = rng(5);
  for (let x = -40; x < W; x += 230) {
    const stack = 1 + Math.floor(r() * 3);
    for (let k = 0; k < stack; k++) {
      const col = cols[Math.floor(r() * cols.length)];
      const y = 600 - (k + 1) * 78;
      const draw = (ox: number) => {
        rr(c, ox, y, 220, 76, 3);
        fillStroke(c, shade(col, 0.15), 2.5, SOFT);
        c.strokeStyle = shade(col, -0.15);
        c.lineWidth = 2;
        for (let cx = ox + 12; cx < ox + 210; cx += 12) {
          c.beginPath();
          c.moveTo(cx, y + 6);
          c.lineTo(cx, y + 70);
          c.stroke();
        }
      };
      wrapDraw(W, x, 220, draw);
    }
  }
  // Fence.
  c.fillStyle = 'rgba(160,170,190,0.18)';
  c.fillRect(0, 470, W, 130);
  c.strokeStyle = 'rgba(80,90,110,0.55)';
  c.lineWidth = 1.5;
  for (let x = -130; x < W + 130; x += 14) {
    c.beginPath();
    c.moveTo(x, 470);
    c.lineTo(x + 130, 600);
    c.moveTo(x + 130, 470);
    c.lineTo(x, 600);
    c.stroke();
  }
  for (let x = 0; x < W; x += 160) {
    c.fillStyle = '#7C8AA3';
    c.fillRect(x, 460, 8, 140);
  }
  c.fillStyle = '#7C8AA3';
  c.fillRect(0, 462, W, 6);
  c.fillStyle = 'rgba(252,230,200,0.12)';
  c.fillRect(0, 380, W, 220);
  const pit = c.createLinearGradient(0, 600, 0, H);
  pit.addColorStop(0, '#4A3550');
  pit.addColorStop(1, '#1E1520');
  c.fillStyle = pit;
  c.fillRect(0, 600, W, H - 600);
}

function drawStreetWall(c: Ctx): void {
  wallBase(c, '#C9765F', null, () => {
    // Brick courses.
    c.strokeStyle = 'rgba(80,35,30,0.35)';
    c.lineWidth = 2;
    for (let y = WALL_TOP + 20, row = 0; y < 600; y += 20, row++) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(W, y);
      c.stroke();
      for (let x = (row % 2) * 30; x < W; x += 60) {
        c.beginPath();
        c.moveTo(x, y - 20);
        c.lineTo(x, y);
        c.stroke();
      }
    }
    // Shop back doors and a window with a striped awning.
    for (let i = 0; i < 2; i++) {
      const bx = 120 + i * 640;
      rr(c, bx, WALL_TOP + 90, 110, 150, 6);
      fillStroke(c, i ? PAL.teal : '#6C8C5A', 3, SOFT);
      ell(c, bx + 92, WALL_TOP + 170, 5, 5);
      fillStroke(c, PAL.butter, 2, SOFT);
      const wx = bx + 230;
      rr(c, wx, WALL_TOP + 70, 170, 100, 6);
      fillStroke(c, '#FFF1CF', 3, SOFT);
      for (let s = 0; s < 6; s++) {
        c.beginPath();
        c.moveTo(wx - 10 + s * 32, WALL_TOP + 50);
        c.lineTo(wx - 10 + (s + 1) * 32, WALL_TOP + 50);
        c.lineTo(wx - 10 + (s + 1) * 32 - 4, WALL_TOP + 72);
        c.lineTo(wx - 10 + s * 32 + 4, WALL_TOP + 72);
        c.closePath();
        fillStroke(c, s % 2 ? PAL.white : PAL.coral, 2, SOFT);
      }
    }
    // Drainpipes.
    for (const x of [560, 1180]) {
      c.fillStyle = '#7C8AA3';
      c.fillRect(x, WALL_TOP, 12, 240);
    }
  });
}

/** Mid layer for open-air zones: crane gantries and container stacks in the distance. */
function drawMidYard(c: Ctx): void {
  const r = rng(91);
  const cols = ['#E6A28F', '#9CC6D8', '#F0C98A', '#A8CBA8'];
  for (let x = 0; x < W; x += 160) {
    const n = 1 + Math.floor(r() * 4);
    for (let k = 0; k < n; k++) {
      const col = cols[Math.floor(r() * cols.length)];
      wrapDraw(W, x, 150, (ox) => {
        rr(c, ox, 470 - (k + 1) * 46, 150, 44, 2);
        fillStroke(c, col, 2, 'rgba(48,35,49,0.35)');
      });
    }
  }
  for (const x of [200, 820]) {
    wrapDraw(W, x - 40, 320, (ox) => {
      c.beginPath();
      c.moveTo(ox + 40, 470);
      c.lineTo(ox + 60, 150);
      c.moveTo(ox + 260, 470);
      c.lineTo(ox + 240, 150);
      c.moveTo(ox, 150);
      c.lineTo(ox + 320, 150);
      stroke(c, 9, 'rgba(48,35,49,0.45)');
      stroke(c, 5, '#E05F4E');
    });
  }
  const haze = c.createLinearGradient(0, 150, 0, 600);
  haze.addColorStop(0, 'rgba(252,230,200,0)');
  haze.addColorStop(1, 'rgba(252,230,200,0.4)');
  c.fillStyle = haze;
  c.fillRect(0, 150, W, 450);
}

// ------------------------------------------------------- wall decals

type Decal = { key: string; w: number; h: number; draw: (c: Ctx) => void };

export const DECALS: Decal[] = [
  { key: 'decor_clock', w: 60, h: 60, draw: (c) => {
    ell(c, 30, 30, 26, 26);
    fillStroke(c, PAL.white, 3);
    c.beginPath();
    c.moveTo(30, 30);
    c.lineTo(30, 12);
    c.moveTo(30, 30);
    c.lineTo(42, 34);
    stroke(c, 3);
  } },
  { key: 'decor_poster_dog', w: 70, h: 90, draw: (c) => {
    rr(c, 3, 3, 64, 84, 3);
    fillStroke(c, PAL.butter, 3);
    // A "lost dog?" style poster drawn as shapes: a little sausage dog.
    rr(c, 14, 40, 40, 14, 7);
    fillStroke(c, PAL.chestnut, 2);
    ell(c, 54, 40, 8, 7);
    fillStroke(c, PAL.chestnut, 2);
    for (const x of [18, 24, 44, 50]) c.fillRect(x, 54, 3, 7);
    c.fillStyle = PAL.outline;
    c.fillRect(12, 14, 46, 5);
    c.fillRect(12, 70, 30, 4);
  } },
  { key: 'decor_poster_arrow', w: 70, h: 90, draw: (c) => {
    rr(c, 3, 3, 64, 84, 3);
    fillStroke(c, PAL.teal, 3);
    c.beginPath();
    c.moveTo(14, 45);
    c.lineTo(50, 45);
    c.moveTo(38, 30);
    c.lineTo(54, 45);
    c.lineTo(38, 60);
    stroke(c, 6, PAL.white);
  } },
  { key: 'decor_extinguisher', w: 36, h: 70, draw: (c) => {
    rr(c, 8, 16, 20, 50, 8);
    fillStroke(c, '#D9443A', 3);
    rr(c, 12, 6, 12, 12, 3);
    fillStroke(c, PAL.outline, 0);
    c.beginPath();
    c.moveTo(24, 10);
    c.quadraticCurveTo(34, 18, 30, 40);
    stroke(c, 3);
  } },
  { key: 'decor_vent', w: 90, h: 60, draw: (c) => {
    rr(c, 3, 3, 84, 54, 6);
    fillStroke(c, '#9AA6BA', 3);
    for (let y = 14; y < 50; y += 9) {
      c.fillStyle = 'rgba(48,35,49,0.55)';
      c.fillRect(12, y, 66, 4);
    }
  } },
  { key: 'decor_window', w: 110, h: 80, draw: (c) => {
    rr(c, 3, 3, 104, 74, 6);
    fillStroke(c, '#CFEAF5', 3);
    c.beginPath();
    c.moveTo(55, 4);
    c.lineTo(55, 76);
    c.moveTo(4, 40);
    c.lineTo(106, 40);
    stroke(c, 3);
    c.beginPath();
    c.moveTo(18, 30);
    c.lineTo(34, 14);
    stroke(c, 3, 'rgba(255,255,255,0.8)');
  } },
  { key: 'decor_lamp', w: 60, h: 70, draw: (c) => {
    c.beginPath();
    c.moveTo(30, 0);
    c.lineTo(30, 26);
    stroke(c, 3);
    c.beginPath();
    c.moveTo(8, 46);
    c.quadraticCurveTo(30, 14, 52, 46);
    c.closePath();
    fillStroke(c, '#6F86A8', 3);
    ell(c, 30, 50, 10, 6);
    fillStroke(c, PAL.butter, 2);
    const g = c.createRadialGradient(30, 56, 2, 30, 56, 26);
    g.addColorStop(0, 'rgba(255,214,110,0.55)');
    g.addColorStop(1, 'rgba(255,214,110,0)');
    c.fillStyle = g;
    c.fillRect(0, 40, 60, 30);
  } },
  { key: 'decor_pipe', w: 160, h: 40, draw: (c) => {
    rr(c, 0, 12, 160, 16, 8);
    fillStroke(c, '#A3B3C9', 3);
    for (const x of [30, 120]) {
      rr(c, x, 8, 12, 24, 3);
      fillStroke(c, '#7C8AA3', 2.5);
    }
    ell(c, 75, 20, 8, 8);
    fillStroke(c, PAL.coral, 2.5);
  } },
  { key: 'decor_board', w: 100, h: 74, draw: (c) => {
    rr(c, 3, 3, 94, 68, 4);
    fillStroke(c, '#C79B6A', 3);
    const r = rng(3);
    for (let i = 0; i < 4; i++) {
      const x = 10 + (i % 2) * 42;
      const y = 10 + Math.floor(i / 2) * 30;
      rr(c, x, y, 36, 24, 2);
      fillStroke(c, [PAL.white, PAL.butter, '#CFEAF5', PAL.cream][i], 1.5);
      c.fillStyle = PAL.coral;
      ell(c, x + 18, y + 2, 2.5 + r(), 2.5);
      c.fill();
    }
  } },
  { key: 'decor_bunting', w: 200, h: 40, draw: (c) => {
    c.beginPath();
    c.moveTo(0, 6);
    c.quadraticCurveTo(100, 22, 200, 6);
    stroke(c, 2);
    const cols = [PAL.coral, PAL.butter, PAL.teal, PAL.white];
    for (let i = 0; i < 8; i++) {
      const x = 10 + i * 24;
      const y = 6 + Math.sin((x / 200) * Math.PI) * 15;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + 18, y);
      c.lineTo(x + 9, y + 18);
      c.closePath();
      fillStroke(c, cols[i % 4], 1.5);
    }
  } },
];

/** Decals used per zone. */
/** Animated background actors per zone (they ride on the near wall, never on the play floor). */
export const ZONE_ACTORS: Record<string, string[]> = {
  depot_near: ['forklift', 'pigeons', 'beacon'],
  depot_near_sorting: ['beacon', 'steam', 'pigeons'],
  depot_near_cold: ['steam', 'beacon'],
  depot_near_yard: ['forklift', 'pigeons'],
  depot_near_street: ['cat', 'pigeons', 'pigeons'],
};

export const ZONE_DECALS: Record<string, string[]> = {
  depot_near: ['decor_clock', 'decor_poster_arrow', 'decor_extinguisher', 'decor_board', 'decor_vent', 'decor_lamp'],
  depot_near_sorting: ['decor_clock', 'decor_poster_arrow', 'decor_pipe', 'decor_vent', 'decor_lamp', 'decor_extinguisher'],
  depot_near_cold: ['decor_pipe', 'decor_vent', 'decor_lamp', 'decor_extinguisher'],
  depot_near_yard: ['decor_poster_arrow', 'decor_board'],
  depot_near_street: ['decor_poster_dog', 'decor_window', 'decor_bunting', 'decor_lamp', 'decor_board', 'decor_poster_arrow'],
};

// --------------------------------------------------------- foreground

function drawChain(c: Ctx, len: number, hook: boolean): void {
  for (let y = 0; y < len; y += 14) {
    ell(c, 12, y + 7, y % 28 === 0 ? 5 : 3, 7);
    stroke(c, 3.5, '#241A26');
  }
  if (hook) {
    c.beginPath();
    c.moveTo(12, len);
    c.lineTo(12, len + 10);
    c.arc(18, len + 18, 7, Math.PI, Math.PI * 0.2, true);
    stroke(c, 5, '#241A26');
  }
}

function drawFgLamp(c: Ctx): void {
  c.fillStyle = '#241A26';
  c.fillRect(38, 0, 4, 70);
  c.beginPath();
  c.moveTo(4, 110);
  c.quadraticCurveTo(40, 50, 76, 110);
  c.closePath();
  c.fill();
  ell(c, 40, 112, 14, 6);
  c.fillStyle = 'rgba(255,214,110,0.9)';
  c.fill();
}

function drawFgBeam(c: Ctx): void {
  c.fillStyle = '#241A26';
  c.fillRect(0, 0, 260, 26);
  for (let x = 6; x < 260; x += 36) {
    c.beginPath();
    c.moveTo(x, 26);
    c.lineTo(x + 18, 4);
    c.lineTo(x + 36, 26);
    c.lineWidth = 4;
    c.strokeStyle = '#3A2C3D';
    c.stroke();
  }
}

// ----------------------------------------------------------- sky life

function drawBird(c: Ctx, up: boolean): void {
  c.beginPath();
  if (up) {
    c.moveTo(2, 14);
    c.quadraticCurveTo(10, 2, 18, 12);
    c.quadraticCurveTo(26, 2, 34, 14);
  } else {
    c.moveTo(2, 8);
    c.quadraticCurveTo(10, 16, 18, 12);
    c.quadraticCurveTo(26, 16, 34, 8);
  }
  stroke(c, 3, 'rgba(48,35,49,0.7)');
}

// ------------------------------------------------------- obstacle skins

export const LOW_HAZARD_SKINS = ['tyre', 'tyre', 'hazard_cone'];
export const CRATE_SKINS = ['crate', 'crate_parcel'];
export const CARDBOARD_SKINS = ['cardboard'];
export const PLATFORM_SKINS = ['steel', 'conveyor', 'plank'];

function drawCone(c: Ctx): void {
  c.beginPath();
  c.moveTo(24, 3);
  c.lineTo(38, 36);
  c.lineTo(10, 36);
  c.closePath();
  fillStroke(c, '#F2793A', 3.5);
  c.fillStyle = PAL.white;
  c.beginPath();
  c.moveTo(19, 15);
  c.lineTo(29, 15);
  c.lineTo(32, 23);
  c.lineTo(16, 23);
  c.closePath();
  c.fill();
  rr(c, 4, 34, 40, 7, 2);
  fillStroke(c, '#C9542A', 3);
}

function drawToolbox(c: Ctx): void {
  c.beginPath();
  c.moveTo(16, 14);
  c.lineTo(16, 6);
  c.lineTo(32, 6);
  c.lineTo(32, 14);
  stroke(c, 4);
  rr(c, 3, 13, 42, 27, 4);
  fillStroke(c, '#D9443A', 3.5);
  c.fillStyle = 'rgba(48,35,49,0.4)';
  c.fillRect(5, 22, 38, 3);
  rr(c, 20, 20, 8, 7, 2);
  fillStroke(c, '#C7CDD8', 2);
}

function drawPaint(c: Ctx): void {
  rr(c, 7, 9, 34, 31, 4);
  fillStroke(c, '#C7CDD8', 3.5);
  rr(c, 7, 18, 34, 12, 0);
  c.fillStyle = PAL.teal;
  c.fill();
  ell(c, 24, 9, 17, 4);
  fillStroke(c, '#9AA6BA', 3);
  // Drip.
  c.beginPath();
  c.moveTo(12, 30);
  c.quadraticCurveTo(10, 38, 13, 40);
  stroke(c, 3, PAL.teal);
  c.beginPath();
  c.moveTo(10, 4);
  c.quadraticCurveTo(24, -4, 38, 4);
  stroke(c, 2.5);
}

function drawMetalCrate(c: Ctx): void {
  rr(c, 2, 2, 60, 60, 5);
  fillStroke(c, '#7F93B0', 3.5);
  rr(c, 9, 9, 46, 46, 3);
  fillStroke(c, '#93A7C3', 2, 'rgba(48,35,49,0.5)');
  c.fillStyle = PAL.outline;
  for (let i = 0; i < 4; i++) {
    for (const [x, y] of [[6 + i * 17, 6], [6 + i * 17, 58]]) {
      ell(c, x, y, 1.7, 1.7);
      c.fill();
    }
  }
  c.fillStyle = PAL.butter;
  c.beginPath();
  c.moveTo(18, 40);
  c.lineTo(32, 18);
  c.lineTo(46, 40);
  c.closePath();
  c.fill();
  c.fillStyle = PAL.outline;
  c.fillRect(30.5, 25, 3, 9);
  c.fillRect(30.5, 35, 3, 3);
}

function drawSlatCrate(c: Ctx): void {
  const wood = '#C08A55';
  rr(c, 2, 2, 60, 60, 4);
  fillStroke(c, shade(wood, -0.35), 3.5);
  for (let y = 6; y < 58; y += 13) {
    rr(c, 5, y, 54, 9, 2);
    fillStroke(c, wood, 1.5);
  }
  c.fillStyle = shade(wood, -0.3);
  c.fillRect(8, 2, 6, 60);
  c.fillRect(50, 2, 6, 60);
  rr(c, 2, 2, 60, 60, 4);
  stroke(c, 3.5);
}

function drawCardboardVariant(c: Ctx, base: string, tape: string, arrows: boolean): void {
  rr(c, 2, 2, 56, 52, 4);
  fillStroke(c, base, 3.5);
  c.fillStyle = tape;
  c.fillRect(2, 22, 56, 10);
  if (arrows) {
    for (const x of [14, 40]) {
      c.beginPath();
      c.moveTo(x, 16);
      c.lineTo(x - 6, 24);
      c.moveTo(x, 16);
      c.lineTo(x + 6, 24);
      c.moveTo(x, 16);
      c.lineTo(x, 30);
      stroke(c, 2.5);
    }
  }
  // Fragile glass icon and dashed perforation, shared by every cardboard skin.
  c.beginPath();
  c.moveTo(36, 36);
  c.lineTo(48, 36);
  c.quadraticCurveTo(48, 46, 42, 47);
  c.quadraticCurveTo(36, 46, 36, 36);
  c.closePath();
  fillStroke(c, PAL.coral, 2);
  c.setLineDash([4, 4]);
  rr(c, 6, 6, 48, 44, 3);
  stroke(c, 1.5, 'rgba(48,35,49,0.45)');
  c.setLineDash([]);
}

function drawConveyorMid(c: Ctx): void {
  c.fillStyle = '#3A3340';
  c.fillRect(0, 0, 64, 18);
  c.fillStyle = '#5A5266';
  for (let x = 0; x < 64; x += 16) c.fillRect(x, 3, 8, 3);
  c.fillStyle = PAL.outline;
  c.fillRect(0, 0, 64, 3);
  c.fillRect(0, 15, 64, 3);
  for (const x of [16, 48]) {
    ell(c, x, 11, 3, 3);
    c.fillStyle = '#9AA6BA';
    c.fill();
  }
}

function drawPlankMid(c: Ctx): void {
  c.fillStyle = '#C08A55';
  c.fillRect(0, 2, 64, 14);
  c.fillStyle = '#A06F42';
  c.fillRect(0, 9, 64, 2);
  c.fillStyle = PAL.outline;
  c.fillRect(0, 0, 64, 3);
  c.fillRect(0, 15, 64, 3);
  c.fillRect(62, 2, 2, 14);
}

function drawBarrel(c: Ctx): void {
  // Green wheelie bin (style guide), 48×52, rolling toward the hero on its wheel.
  const green = '#3E9B5A';
  c.beginPath();
  c.moveTo(8, 12);
  c.lineTo(40, 12);
  c.lineTo(37, 44);
  c.lineTo(11, 44);
  c.closePath();
  fillStroke(c, green, 3.5);
  c.fillStyle = 'rgba(255,255,255,0.25)';
  c.fillRect(13, 16, 4, 24);
  for (const x of [22, 30]) {
    c.beginPath();
    c.moveTo(x, 18);
    c.lineTo(x - 0.5, 38);
    stroke(c, 2, '#2C7444');
  }
  // Lid with handle.
  rr(c, 4, 6, 40, 8, 3);
  fillStroke(c, '#2F7D47', 3);
  rr(c, 38, 2, 8, 6, 2);
  fillStroke(c, '#2F7D47', 2.5);
  // Wheel.
  ell(c, 34, 44, 7.5, 7.5);
  fillStroke(c, '#3A3340', 3);
  ell(c, 34, 44, 2.6, 2.6);
  c.fillStyle = '#C7CDD8';
  c.fill();
}

// ------------------------------------------------------- background actors

function drawForklift(c: Ctx): void {
  // Faces right. Mast and forks at the front carrying a pallet of boxes.
  const body = '#E3A13B';
  rr(c, 18, 40, 70, 34, 6);
  fillStroke(c, body, 3);
  rr(c, 28, 16, 36, 28, 4);
  c.fillStyle = 'rgba(169,217,235,0.7)';
  c.fill();
  stroke(c, 3);
  c.fillStyle = PAL.outline;
  c.fillRect(26, 12, 42, 5);
  c.fillRect(88, 6, 6, 70);
  c.fillRect(92, 64, 30, 5);
  rr(c, 94, 46, 26, 18, 2);
  fillStroke(c, '#D9A85E', 2.5);
  rr(c, 100, 30, 18, 16, 2);
  fillStroke(c, '#E8C48A', 2.5);
  for (const x of [32, 76]) {
    ell(c, x, 76, 10, 10);
    fillStroke(c, '#3A3340', 3);
    ell(c, x, 76, 4, 4);
    c.fillStyle = '#9AA6BA';
    c.fill();
  }
  // Driver: a round head in a cap.
  ell(c, 46, 30, 8, 8);
  fillStroke(c, '#F2B48C', 2);
  rr(c, 37, 20, 18, 6, 3);
  fillStroke(c, '#4F6AA3', 2);
}

function drawPigeon(c: Ctx): void {
  ell(c, 15, 15, 11, 8);
  fillStroke(c, '#8E8FA8', 2.5);
  ell(c, 24, 9, 6, 6);
  fillStroke(c, '#8E8FA8', 2.5);
  c.beginPath();
  c.moveTo(29, 9);
  c.lineTo(34, 11);
  c.lineTo(29, 12);
  c.closePath();
  fillStroke(c, PAL.butter, 1.5);
  ell(c, 25, 8, 1.5, 1.5);
  c.fillStyle = PAL.outline;
  c.fill();
  ell(c, 21, 14, 4, 3);
  c.fillStyle = 'rgba(66,183,176,0.7)';
  c.fill();
  c.beginPath();
  c.moveTo(12, 22);
  c.lineTo(12, 26);
  c.moveTo(17, 22);
  c.lineTo(17, 26);
  stroke(c, 2, PAL.coral);
}

function drawCat(c: Ctx): void {
  ell(c, 24, 34, 15, 13);
  fillStroke(c, '#5C5470', 3);
  ell(c, 24, 16, 11, 10);
  fillStroke(c, '#5C5470', 3);
  for (const x of [16, 32]) {
    c.beginPath();
    c.moveTo(x - 5, 10);
    c.lineTo(x, 0);
    c.lineTo(x + 5, 10);
    c.closePath();
    fillStroke(c, '#5C5470', 2.5);
  }
  for (const x of [20, 28]) {
    ell(c, x, 15, 2.5, 3.5);
    c.fillStyle = PAL.butter;
    c.fill();
    c.fillStyle = PAL.outline;
    c.fillRect(x - 0.6, 12.5, 1.2, 5);
  }
}

function drawCatTail(c: Ctx): void {
  c.beginPath();
  c.moveTo(2, 6);
  c.quadraticCurveTo(18, 2, 30, 8);
  stroke(c, 7, PAL.outline);
  stroke(c, 4, '#5C5470');
}

function drawBeacon(c: Ctx, on: boolean): void {
  rr(c, 6, 16, 16, 8, 2);
  fillStroke(c, '#5C5466', 2);
  c.beginPath();
  c.arc(14, 16, 8, Math.PI, 0);
  c.closePath();
  fillStroke(c, on ? '#FFB04A' : '#9C7A4A', 2);
  if (on) {
    const g = c.createRadialGradient(14, 12, 2, 14, 12, 14);
    g.addColorStop(0, 'rgba(255,214,110,0.8)');
    g.addColorStop(1, 'rgba(255,214,110,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 28, 28);
  }
}

function drawLowSign(c: Ctx): void {
  // Low overhead pipe (style guide): rusty steel pipe with bolted flanges and a hazard band.
  const steel = '#6F7E96';
  rr(c, 3, 12, 104, 44, 20);
  fillStroke(c, steel, 4);
  c.save();
  rr(c, 3, 12, 104, 44, 20);
  c.clip();
  c.fillStyle = 'rgba(255,255,255,0.28)';
  c.fillRect(0, 18, 110, 7);
  c.fillStyle = 'rgba(30,26,30,0.22)';
  c.fillRect(0, 44, 110, 12);
  // Rust patches.
  for (const [x, y, rx, ry] of [[22, 30, 6, 3.5], [80, 40, 7, 3], [64, 22, 4, 2.5], [38, 46, 4, 2.5]]) {
    ell(c, x, y, rx, ry);
    c.fillStyle = '#B5653A';
    c.fill();
  }
  // Hazard band.
  c.fillStyle = '#FFC93C';
  c.fillRect(46, 0, 18, 66);
  c.fillStyle = PAL.outline;
  for (let y = -10; y < 70; y += 12) {
    c.beginPath();
    c.moveTo(46, y);
    c.lineTo(64, y + 10);
    c.lineTo(64, y + 15);
    c.lineTo(46, y + 5);
    c.closePath();
    c.fill();
  }
  c.restore();
  rr(c, 3, 12, 104, 44, 20);
  stroke(c, 4);
  // Flanges with bolts at each end.
  for (const x of [8, 90]) {
    rr(c, x, 8, 12, 52, 4);
    fillStroke(c, '#8693A8', 3);
    for (const y of [16, 34, 52]) {
      ell(c, x + 6, y, 2, 2);
      c.fillStyle = PAL.outline;
      c.fill();
    }
  }
}

// ------------------------------------------------------- extra parallax layers

const CLOUD_W = 1600;
const ROOF_BAND = { y0: 60, h: 320 } as const;

/** Puffy outlined clouds in the guide's style; wraps horizontally. */
function drawCloudLayer(c: Ctx): void {
  const r = rng(91);
  for (let i = 0; i < 7; i++) {
    const x = (i / 7) * CLOUD_W + r() * 120;
    const y = 50 + r() * 120;
    const s = 0.7 + r() * 0.7;
    wrapDraw(CLOUD_W, x - 90 * s, 200 * s, (ox) => {
      const cx = ox + 90 * s;
      c.beginPath();
      c.moveTo(cx - 80 * s, y + 20 * s);
      c.arc(cx - 52 * s, y + 4 * s, 28 * s, Math.PI * 0.6, Math.PI * 1.55);
      c.arc(cx - 6 * s, y - 14 * s, 38 * s, Math.PI * 1.15, Math.PI * 1.95);
      c.arc(cx + 44 * s, y + 2 * s, 30 * s, Math.PI * 1.35, Math.PI * 0.3);
      c.closePath();
      c.fillStyle = '#FFFDF6';
      c.fill();
      c.lineWidth = 3;
      c.strokeStyle = 'rgba(111,150,180,0.55)';
      c.stroke();
      // Soft blue shade along the bottom.
      c.save();
      c.clip();
      c.fillStyle = 'rgba(169,210,232,0.45)';
      c.fillRect(cx - 100 * s, y + 8 * s, 200 * s, 40 * s);
      c.restore();
    });
  }
}

/** Rooftop skyline between the warehouses and the bay wall: cranes, a water tower, masts. */
function drawRoofline(c: Ctx): void {
  const OUTL = '#302331';
  // Yellow gantry crane.
  wrapDraw(W, 150, 300, (ox) => {
    for (const lx of [ox + 20, ox + 260]) {
      c.beginPath();
      c.moveTo(lx, 380);
      c.lineTo(lx + (lx === ox + 20 ? 18 : -18), 120);
      stroke(c, 11, OUTL);
      stroke(c, 6, '#F2B84A');
    }
    rr(c, ox - 20, 108, 340, 18, 4);
    fillStroke(c, '#F2B84A', 3.5, OUTL);
    c.fillStyle = 'rgba(48,35,49,0.35)';
    for (let x = ox - 10; x < ox + 310; x += 22) c.fillRect(x, 112, 10, 10);
    c.beginPath();
    c.moveTo(ox + 190, 126);
    c.lineTo(ox + 190, 200);
    stroke(c, 3, OUTL);
    rr(c, ox + 168, 200, 44, 30, 4);
    fillStroke(c, '#C98D52', 3, OUTL);
  });
  // Water tower.
  wrapDraw(W, 640, 120, (ox) => {
    for (const lx of [ox + 20, ox + 100]) {
      c.beginPath();
      c.moveTo(lx, 380);
      c.lineTo(ox + 60 + (lx - ox - 60) * 0.6, 210);
      stroke(c, 6, OUTL);
    }
    c.beginPath();
    c.moveTo(ox + 20, 300);
    c.lineTo(ox + 100, 250);
    c.moveTo(ox + 100, 300);
    c.lineTo(ox + 20, 250);
    stroke(c, 3, OUTL);
    rr(c, ox + 6, 150, 108, 66, 10);
    fillStroke(c, '#6FA9B8', 3.5, OUTL);
    c.fillStyle = 'rgba(255,255,255,0.25)';
    c.fillRect(ox + 16, 158, 14, 50);
    c.beginPath();
    c.moveTo(ox, 152);
    c.lineTo(ox + 60, 118);
    c.lineTo(ox + 120, 152);
    c.closePath();
    fillStroke(c, '#C2614A', 3.5, OUTL);
  });
  // Radio mast with a blinking-light cap, and a flag.
  wrapDraw(W, 960, 80, (ox) => {
    c.beginPath();
    c.moveTo(ox + 40, 380);
    c.lineTo(ox + 40, 90);
    stroke(c, 6, OUTL);
    for (let y = 120; y < 360; y += 40) {
      c.beginPath();
      c.moveTo(ox + 30, y);
      c.lineTo(ox + 50, y + 20);
      stroke(c, 2, OUTL);
    }
    ell(c, ox + 40, 86, 6, 6);
    fillStroke(c, '#F07562', 2.5, OUTL);
  });
  wrapDraw(W, 1130, 90, (ox) => {
    c.beginPath();
    c.moveTo(ox + 10, 380);
    c.lineTo(ox + 10, 200);
    stroke(c, 5, OUTL);
    c.beginPath();
    c.moveTo(ox + 12, 204);
    c.quadraticCurveTo(ox + 50, 196, ox + 80, 212);
    c.lineTo(ox + 80, 246);
    c.quadraticCurveTo(ox + 50, 232, ox + 12, 240);
    c.closePath();
    fillStroke(c, PAL.teal, 3, OUTL);
    ell(c, ox + 44, 224, 6, 5);
    c.fillStyle = PAL.white;
    c.fill();
  });
}

/** Dark foreground silhouettes along the bottom edge (in front of the ground). */
function drawFgTuft(c: Ctx): void {
  // Rounded leafy bush silhouette (nothing spiky: it must never read as a hazard).
  c.fillStyle = '#302331';
  c.beginPath();
  c.moveTo(2, 60);
  for (const [x, y, r] of [[14, 40, 14], [32, 28, 18], [54, 30, 17], [74, 40, 14]]) c.arc(x, y, r, Math.PI, 0);
  c.lineTo(88, 60);
  c.closePath();
  c.fill();
}
function drawFgBollard(c: Ctx): void {
  rr(c, 8, 4, 32, 84, 10);
  c.fillStyle = '#302331';
  c.fill();
  c.fillStyle = 'rgba(255,201,60,0.55)';
  c.fillRect(8, 22, 32, 8);
  c.fillRect(8, 42, 32, 8);
}
function drawFgWeeds(c: Ctx): void {
  c.strokeStyle = '#302331';
  c.lineWidth = 5;
  c.lineCap = 'round';
  for (const [x, h, bend] of [[14, 60, -10], [26, 78, 6], [40, 52, 12], [52, 70, -4]]) {
    c.beginPath();
    c.moveTo(x, 84);
    c.quadraticCurveTo(x + bend, 84 - h / 2, x + bend * 1.6, 84 - h);
    c.stroke();
    ell(c, x + bend * 1.6, 84 - h, 6, 4, 0.4);
    c.fillStyle = '#302331';
    c.fill();
  }
}

export function generateDecorArt(scene: Phaser.Scene): void {
  makeTexture(scene, 'sky_clouds', CLOUD_W, 240, drawCloudLayer);
  makeBand(scene, 'depot_roofline', W, ROOF_BAND, drawRoofline);
  makeTexture(scene, 'fg_tuft', 90, 60, drawFgTuft);
  makeTexture(scene, 'fg_bollard', 48, 90, drawFgBollard);
  makeTexture(scene, 'fg_weeds', 70, 86, drawFgWeeds);
  makeTexture(scene, 'lowbar', 110, 62, drawLowSign);
  makeTexture(scene, 'actor_forklift', 124, 90, drawForklift);
  makeTexture(scene, 'actor_pigeon', 36, 28, drawPigeon);
  makeTexture(scene, 'actor_cat', 48, 48, drawCat);
  makeTexture(scene, 'actor_cat_tail', 32, 12, drawCatTail);
  makeTexture(scene, 'actor_beacon_on', 28, 28, (c) => drawBeacon(c, true));
  makeTexture(scene, 'actor_beacon_off', 28, 28, (c) => drawBeacon(c, false));
  makeBand(scene, 'depot_near_sorting', W, BAND.near, drawSortingHall);
  makeBand(scene, 'depot_near_cold', W, BAND.near, drawColdStorage);
  makeBand(scene, 'depot_near_yard', W, BAND.near, drawContainerYard);
  makeBand(scene, 'depot_near_street', W, BAND.near, drawStreetWall);
  makeBand(scene, 'depot_mid_yard', W, BAND.mid, drawMidYard);
  for (const d of DECALS) makeTexture(scene, d.key, d.w, d.h, d.draw);
  makeTexture(scene, 'fg_chain', 30, 200, (c) => drawChain(c, 180, true));
  makeTexture(scene, 'fg_chain_short', 30, 110, (c) => drawChain(c, 100, false));
  makeTexture(scene, 'fg_lamp', 80, 122, drawFgLamp);
  makeTexture(scene, 'fg_beam', 260, 30, drawFgBeam);
  makeTexture(scene, 'bird_up', 36, 18, (c) => drawBird(c, true));
  makeTexture(scene, 'bird_down', 36, 18, (c) => drawBird(c, false));
  makeTexture(scene, 'hazard_cone', 48, 42, drawCone);
  makeTexture(scene, 'hazard_toolbox', 48, 42, drawToolbox);
  makeTexture(scene, 'hazard_paint', 48, 42, drawPaint);
  makeTexture(scene, 'crate_metal', 64, 64, drawMetalCrate);
  makeTexture(scene, 'crate_slat', 64, 64, drawSlatCrate);
  makeTexture(scene, 'cardboard_white', 60, 56, (c) => drawCardboardVariant(c, '#F2EDE2', '#E25B4B', false));
  makeTexture(scene, 'cardboard_arrows', 60, 56, (c) => drawCardboardVariant(c, '#D8A05A', '#F6E7B8', true));
  makeTexture(scene, 'platform_mid_conveyor', 64, 18, drawConveyorMid);
  makeTexture(scene, 'platform_mid_plank', 64, 18, drawPlankMid);
  makeTexture(scene, 'barrel', 48, 52, drawBarrel);
}

export { ROOF_BAND };
