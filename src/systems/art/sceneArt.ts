import type Phaser from 'phaser';
import { ell, fillStroke, makeTexture, PAL, rng, rr, shade, stroke, wrapDraw, type Ctx } from './canvas';

const W = 1280;
const H = 720;

// ------------------------------------------------------------ depot layers

function drawDepotFar(c: Ctx): void {
  const sky = c.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#8FCDE3');
  sky.addColorStop(0.55, PAL.sky);
  sky.addColorStop(0.85, '#FCE6C8');
  c.fillStyle = sky;
  c.fillRect(0, 0, W, H);
  // Sun.
  ell(c, 980, 140, 56, 56);
  c.fillStyle = 'rgba(255,214,110,0.55)';
  c.fill();
  ell(c, 980, 140, 40, 40);
  c.fillStyle = '#FFE9A8';
  c.fill();
  // Clouds (wrap).
  const r = rng(7);
  for (let i = 0; i < 6; i++) {
    const x = r() * W;
    const y = 60 + r() * 140;
    const s = 0.7 + r() * 0.6;
    wrapDraw(W, x - 80 * s, 160 * s, (ox) => {
      const cx = ox + 80 * s;
      for (const [dx, dy, rad] of [[-40, 8, 26], [0, 0, 36], [42, 10, 24], [18, -16, 24]] as const) {
        ell(c, cx + dx * s, y + dy * s, rad * s, rad * s * 0.8);
        c.fillStyle = 'rgba(255,253,246,0.85)';
        c.fill();
      }
    });
  }
  // Distant skyline (pale, soft outline).
  const sr = rng(11);
  let x = 0;
  while (x < W) {
    const w = 50 + sr() * 90;
    const h = 120 + sr() * 200;
    const top = 470 - h;
    const color = sr() > 0.5 ? '#C9C3DD' : '#D6CDE3';
    const radius = sr() > 0.7 ? 14 : 3;
    wrapDraw(W, x, w, (ox) => {
      rr(c, ox, top, w - 6, h + 200, radius);
      fillStroke(c, color, 2, 'rgba(48,35,49,0.25)');
      c.fillStyle = 'rgba(255,255,255,0.35)';
      for (let wy = top + 16; wy < 460; wy += 26) {
        for (let wx = ox + 10; wx < ox + w - 20; wx += 18) c.fillRect(wx, wy, 7, 10);
      }
    });
    if (sr() > 0.75) {
      // Water tower / antenna.
      const ax = x + w / 2;
      c.beginPath();
      c.moveTo(ax, top);
      c.lineTo(ax, top - 40);
      stroke(c, 2, 'rgba(48,35,49,0.3)');
    }
    x += w + sr() * 20;
  }
  c.fillStyle = '#D9CDE0';
  c.fillRect(0, 470, W, 250);
}

function drawDepotMid(c: Ctx): void {
  // Warehouses with corrugated walls and cranes; transparent above roofline.
  const r = rng(23);
  const colors = ['#E8A87C', '#9CCBC4', '#F2C47E', '#D79A9A'];
  let x = 0;
  let i = 0;
  while (x < W) {
    const w = 260 + r() * 140;
    const top = 250 + r() * 90;
    const col = colors[i++ % colors.length];
    const draw = (ox: number) => {
      // Roof.
      c.beginPath();
      c.moveTo(ox, top + 20);
      c.lineTo(ox + w / 2, top - 10);
      c.lineTo(ox + w, top + 20);
      c.lineTo(ox + w, H);
      c.lineTo(ox, H);
      c.closePath();
      fillStroke(c, shade(col, 0.15), 2.5, 'rgba(48,35,49,0.55)');
      // Corrugation.
      c.save();
      c.clip();
      c.strokeStyle = shade(col, -0.12);
      c.lineWidth = 2;
      for (let cx = ox + 8; cx < ox + w; cx += 14) {
        c.beginPath();
        c.moveTo(cx, top);
        c.lineTo(cx, H);
        c.stroke();
      }
      c.restore();
      // Big window band.
      rr(c, ox + 30, top + 50, w - 60, 40, 6);
      fillStroke(c, '#FFF1CF', 2.5, 'rgba(48,35,49,0.55)');
      c.beginPath();
      for (let wx = ox + 70; wx < ox + w - 40; wx += 40) {
        c.moveTo(wx, top + 50);
        c.lineTo(wx, top + 90);
      }
      stroke(c, 2, 'rgba(48,35,49,0.4)');
    };
    wrapDraw(W, x, w, draw);
    x += w + 30 + r() * 40;
  }
  // Gantry crane.
  wrapDraw(W, 520, 260, (ox) => {
    c.beginPath();
    c.moveTo(ox, 470);
    c.lineTo(ox + 20, 180);
    c.moveTo(ox + 240, 470);
    c.lineTo(ox + 220, 180);
    c.moveTo(ox - 20, 180);
    c.lineTo(ox + 260, 180);
    stroke(c, 10, 'rgba(48,35,49,0.55)');
    stroke(c, 6, '#F2B84A');
    c.beginPath();
    c.moveTo(ox + 140, 180);
    c.lineTo(ox + 140, 260);
    stroke(c, 2.5, 'rgba(48,35,49,0.6)');
    rr(c, ox + 118, 260, 44, 30, 4);
    fillStroke(c, '#E07A63', 2.5, 'rgba(48,35,49,0.6)');
  });
  // Soft haze so the layer sits behind the action.
  const haze = c.createLinearGradient(0, 200, 0, 600);
  haze.addColorStop(0, 'rgba(252,230,200,0)');
  haze.addColorStop(1, 'rgba(252,230,200,0.35)');
  c.fillStyle = haze;
  c.fillRect(0, 200, W, 520);
}

function drawDepotNear(c: Ctx): void {
  // Loading-bay wall strip directly behind the play line, plus the dark pit band.
  const wallTop = 360;
  c.fillStyle = '#C98F7A';
  c.fillRect(0, wallTop, W, 600 - wallTop);
  c.fillStyle = '#B57D6A';
  for (let y = wallTop + 14; y < 600; y += 28) c.fillRect(0, y, W, 3);
  c.fillStyle = 'rgba(48,35,49,0.85)';
  c.fillRect(0, wallTop - 4, W, 6);
  // Bay doors with roller shutters.
  for (let i = 0; i < 3; i++) {
    const bx = 60 + i * 430;
    rr(c, bx, wallTop + 40, 260, 200, 6);
    fillStroke(c, '#7E95B5', 3, 'rgba(48,35,49,0.7)');
    c.fillStyle = '#6B819F';
    for (let y = wallTop + 52; y < wallTop + 236; y += 14) c.fillRect(bx + 6, y, 248, 4);
    // Bay number plate as a shape (no text): colored chevrons.
    rr(c, bx + 110, wallTop + 12, 40, 22, 5);
    fillStroke(c, [PAL.teal, PAL.butter, PAL.coral][i], 2.5, 'rgba(48,35,49,0.7)');
    // Hanging hose reel beside the door: decor that cannot be mistaken for a ground obstacle.
    c.beginPath();
    c.arc(bx + 330, wallTop + 90, 26, 0, Math.PI * 2);
    stroke(c, 7, 'rgba(48,35,49,0.35)');
    c.beginPath();
    c.arc(bx + 330, wallTop + 90, 16, 0, Math.PI * 2);
    stroke(c, 5, 'rgba(66,183,176,0.55)');
    c.beginPath();
    c.moveTo(bx + 330, wallTop + 116);
    c.quadraticCurveTo(bx + 345, wallTop + 170, bx + 320, wallTop + 200);
    stroke(c, 4, 'rgba(66,183,176,0.55)');
  }
  // Wall lamps.
  for (let i = 0; i < 3; i++) {
    const lx = 400 + i * 430;
    ell(c, lx, wallTop + 30, 14, 9);
    fillStroke(c, PAL.butter, 2.5, 'rgba(48,35,49,0.7)');
  }
  // Muted overlay so the strip stays behind gameplay.
  c.fillStyle = 'rgba(252,230,200,0.18)';
  c.fillRect(0, wallTop, W, 600 - wallTop);
  // Pit band (visible only through gaps).
  const pit = c.createLinearGradient(0, 600, 0, H);
  pit.addColorStop(0, '#4A3550');
  pit.addColorStop(1, '#1E1520');
  c.fillStyle = pit;
  c.fillRect(0, 600, W, H - 600);
}

// ------------------------------------------------------------ story art

function drawGarden(c: Ctx): void {
  const sky = c.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#9ED6EA');
  sky.addColorStop(1, '#FCE9CC');
  c.fillStyle = sky;
  c.fillRect(0, 0, W, H);
  ell(c, 200, 120, 50, 50);
  c.fillStyle = '#FFE9A8';
  c.fill();
  // House.
  rr(c, 760, 230, 420, 380, 8);
  fillStroke(c, '#F2C9A0', 4);
  c.beginPath();
  c.moveTo(730, 250);
  c.lineTo(970, 100);
  c.lineTo(1210, 250);
  c.closePath();
  fillStroke(c, PAL.coral, 4);
  rr(c, 820, 300, 110, 100, 8);
  fillStroke(c, '#FFF1CF', 4);
  rr(c, 1010, 400, 100, 210, 10);
  fillStroke(c, PAL.teal, 4);
  ell(c, 1090, 510, 6, 6);
  fillStroke(c, PAL.butter, 2.5);
  // Lawn.
  c.fillStyle = '#9CCB7A';
  c.fillRect(0, 600, W, 120);
  c.fillStyle = PAL.outline;
  c.fillRect(0, 598, W, 4);
  // Fence.
  for (let x = 0; x < 700; x += 46) {
    c.beginPath();
    c.moveTo(x + 4, 600);
    c.lineTo(x + 4, 470);
    c.lineTo(x + 20, 452);
    c.lineTo(x + 36, 470);
    c.lineTo(x + 36, 600);
    c.closePath();
    fillStroke(c, PAL.white, 3);
  }
  rr(c, 0, 500, 700, 14, 4);
  fillStroke(c, PAL.white, 3);
  // Flowers.
  const r = rng(5);
  for (let i = 0; i < 14; i++) {
    const fx = r() * 700;
    const fy = 620 + r() * 70;
    ell(c, fx, fy, 6, 6);
    fillStroke(c, [PAL.coral, PAL.butter, '#C59BE0'][i % 3], 2);
  }
}

function drawTruck(c: Ctx, open: boolean): void {
  // 520×300 delivery truck, cargo box on left with rear doors facing the viewer's left.
  rr(c, 20, 20, 340, 220, 14);
  fillStroke(c, '#F4EFE6', 4);
  c.fillStyle = PAL.teal;
  c.fillRect(24, 170, 332, 22);
  // Cab.
  c.beginPath();
  c.moveTo(360, 80);
  c.lineTo(450, 80);
  c.quadraticCurveTo(490, 80, 500, 150);
  c.lineTo(500, 240);
  c.lineTo(360, 240);
  c.closePath();
  fillStroke(c, PAL.coral, 4);
  c.beginPath();
  c.moveTo(380, 98);
  c.lineTo(445, 98);
  c.quadraticCurveTo(470, 100, 478, 150);
  c.lineTo(380, 150);
  c.closePath();
  fillStroke(c, PAL.sky, 3);
  // Wheels.
  for (const wx of [100, 420]) {
    ell(c, wx, 250, 36, 36);
    fillStroke(c, '#3A3340', 4);
    ell(c, wx, 250, 14, 14);
    fillStroke(c, '#C7CDD8', 3);
  }
  // Rear doors.
  if (open) {
    rr(c, 30, 32, 150, 200, 6);
    c.fillStyle = '#3E2E44';
    c.fill();
    c.fillStyle = 'rgba(255,214,110,0.2)';
    c.fillRect(40, 190, 130, 40);
    // Swung door.
    c.beginPath();
    c.moveTo(30, 32);
    c.lineTo(-10, 46);
    c.lineTo(-10, 220);
    c.lineTo(30, 232);
    c.closePath();
    fillStroke(c, '#E6DFD2', 4);
  } else {
    rr(c, 30, 32, 150, 200, 6);
    fillStroke(c, '#E6DFD2', 4);
    c.beginPath();
    c.moveTo(105, 34);
    c.lineTo(105, 230);
    stroke(c, 3);
    rr(c, 92, 120, 8, 30, 3);
    fillStroke(c, '#9AA9C2', 2);
    rr(c, 110, 120, 8, 30, 3);
    fillStroke(c, '#9AA9C2', 2);
  }
  // Logo (shape only): a parcel with wings.
  rr(c, 230, 70, 60, 46, 6);
  fillStroke(c, '#C98D52', 3);
  c.beginPath();
  c.moveTo(230, 86);
  c.quadraticCurveTo(206, 70, 200, 96);
  c.quadraticCurveTo(214, 92, 230, 100);
  c.moveTo(290, 86);
  c.quadraticCurveTo(314, 70, 320, 96);
  c.quadraticCurveTo(306, 92, 290, 100);
  fillStroke(c, PAL.white, 3);
}

// ---------------------------------------------------------------- UI art

function drawHeart(c: Ctx, state: 'full' | 'empty' | 'lost'): void {
  c.save();
  c.translate(20, 19);
  if (state === 'lost') c.rotate(0.2);
  c.beginPath();
  c.moveTo(0, 14);
  c.bezierCurveTo(-22, 0, -16, -18, -6, -16);
  c.bezierCurveTo(-2, -15, 0, -11, 0, -9);
  c.bezierCurveTo(0, -11, 2, -15, 6, -16);
  c.bezierCurveTo(16, -18, 22, 0, 0, 14);
  c.closePath();
  fillStroke(c, state === 'full' ? PAL.coral : state === 'lost' ? '#F5B3A7' : 'rgba(255,253,246,0.35)', 3);
  if (state === 'full') {
    ell(c, -7, -8, 4, 3, -0.6);
    c.fillStyle = 'rgba(255,255,255,0.6)';
    c.fill();
  }
  if (state === 'lost') {
    c.beginPath();
    c.moveTo(0, -9);
    c.lineTo(-3, -2);
    c.lineTo(2, 3);
    c.lineTo(-1, 12);
    stroke(c, 2.5);
  }
  c.restore();
}

function drawTailIcon(c: Ctx, empty: boolean): void {
  ell(c, 18, 18, 15, 15);
  c.fillStyle = empty ? 'rgba(255,253,246,0.25)' : 'rgba(66,183,176,0.35)';
  c.fill();
  for (let i = 0; i < 3; i++) {
    c.save();
    c.translate(18, 18);
    c.rotate((i * Math.PI * 2) / 3);
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(10, -4, 14, 0);
    c.quadraticCurveTo(10, 4, 0, 0);
    fillStroke(c, empty ? '#9A8E9C' : PAL.chestnut, 2);
    c.restore();
  }
  ell(c, 18, 18, 3.5, 3.5);
  fillStroke(c, PAL.cream, 2);
}

function drawBarkIcon(c: Ctx): void {
  ell(c, 14, 20, 9, 9);
  fillStroke(c, PAL.cream, 2.5);
  for (const r of [14, 20]) {
    c.beginPath();
    c.arc(14, 20, r, -0.7, 0.7);
    stroke(c, 3, PAL.white);
  }
}

function drawPauseIcon(c: Ctx): void {
  ell(c, 24, 24, 21, 21);
  fillStroke(c, 'rgba(48,35,49,0.55)', 3, PAL.white);
  rr(c, 15, 14, 6, 20, 2);
  c.fillStyle = PAL.white;
  c.fill();
  rr(c, 27, 14, 6, 20, 2);
  c.fill();
}

function drawTouchButton(c: Ctx, kind: 'jump' | 'bark'): void {
  ell(c, 64, 64, 60, 60);
  fillStroke(c, 'rgba(48,35,49,0.35)', 4, 'rgba(255,253,246,0.85)');
  ell(c, 64, 64, 50, 50);
  c.fillStyle = kind === 'jump' ? 'rgba(66,183,176,0.55)' : 'rgba(240,117,98,0.55)';
  c.fill();
  if (kind === 'jump') {
    c.beginPath();
    c.moveTo(64, 30);
    c.lineTo(88, 60);
    c.lineTo(74, 60);
    c.lineTo(74, 86);
    c.lineTo(54, 86);
    c.lineTo(54, 60);
    c.lineTo(40, 60);
    c.closePath();
    fillStroke(c, PAL.white, 3);
  } else {
    ell(c, 50, 64, 12, 12);
    fillStroke(c, PAL.white, 3);
    for (const r of [22, 32]) {
      c.beginPath();
      c.arc(50, 64, r, -0.75, 0.75);
      stroke(c, 5, PAL.white);
    }
  }
}

function drawBadge(c: Ctx, n: number): void {
  ell(c, 60, 60, 54, 54);
  fillStroke(c, [PAL.butter, PAL.coral, PAL.teal, '#C59BE0', '#9CCB7A', PAL.sky][n - 1], 4);
  ell(c, 60, 60, 44, 44);
  stroke(c, 2.5, 'rgba(255,255,255,0.7)');
  c.save();
  c.translate(60, 60);
  switch (n) {
    case 1: // parcel
      rr(c, -22, -18, 44, 36, 4);
      fillStroke(c, '#C98D52', 3);
      c.fillStyle = '#F2D9A2';
      c.fillRect(-5, -17, 10, 34);
      break;
    case 2: // shoe
      c.beginPath();
      c.moveTo(-24, 10);
      c.lineTo(-24, -14);
      c.lineTo(-6, -14);
      c.quadraticCurveTo(0, 0, 22, 2);
      c.quadraticCurveTo(28, 10, 22, 14);
      c.lineTo(-24, 14);
      c.closePath();
      fillStroke(c, PAL.white, 3);
      break;
    case 3: // goose head
      ell(c, -4, 0, 16, 14);
      fillStroke(c, PAL.white, 3);
      c.beginPath();
      c.moveTo(10, -4);
      c.lineTo(26, 0);
      c.lineTo(10, 6);
      c.closePath();
      fillStroke(c, '#F2A33A', 2.5);
      break;
    case 4: // bin
      rr(c, -16, -16, 32, 36, 4);
      fillStroke(c, '#7E95B5', 3);
      rr(c, -20, -22, 40, 8, 3);
      fillStroke(c, '#6B819F', 3);
      break;
    case 5: // fence
      for (const x of [-20, -4, 12]) {
        c.beginPath();
        c.moveTo(x, 18);
        c.lineTo(x, -12);
        c.lineTo(x + 5, -18);
        c.lineTo(x + 10, -12);
        c.lineTo(x + 10, 18);
        c.closePath();
        fillStroke(c, PAL.white, 2.5);
      }
      break;
    default: // house
      c.beginPath();
      c.moveTo(-24, -2);
      c.lineTo(0, -24);
      c.lineTo(24, -2);
      c.closePath();
      fillStroke(c, PAL.coral, 3);
      rr(c, -18, -2, 36, 26, 3);
      fillStroke(c, PAL.cream, 3);
  }
  c.restore();
}

export function generateSceneArt(scene: Phaser.Scene): void {
  makeTexture(scene, 'depot_far', W, H, drawDepotFar);
  makeTexture(scene, 'depot_mid', W, H, drawDepotMid);
  makeTexture(scene, 'depot_near', W, H, drawDepotNear);
  makeTexture(scene, 'story_garden', W, H, drawGarden);
  makeTexture(scene, 'story_truck_open', 520, 300, (c) => drawTruck(c, true));
  makeTexture(scene, 'story_truck_closed', 520, 300, (c) => drawTruck(c, false));
  for (const s of ['full', 'empty', 'lost'] as const) makeTexture(scene, `heart_${s}`, 40, 38, (c) => drawHeart(c, s));
  makeTexture(scene, 'icon_tail', 36, 36, (c) => drawTailIcon(c, false));
  makeTexture(scene, 'icon_tail_empty', 36, 36, (c) => drawTailIcon(c, true));
  makeTexture(scene, 'icon_bark', 40, 40, drawBarkIcon);
  makeTexture(scene, 'icon_pause', 48, 48, drawPauseIcon);
  makeTexture(scene, 'btn_jump', 128, 128, (c) => drawTouchButton(c, 'jump'));
  makeTexture(scene, 'btn_bark', 128, 128, (c) => drawTouchButton(c, 'bark'));
  for (let n = 1; n <= 6; n++) makeTexture(scene, `badge_ch${n}`, 120, 120, (c) => drawBadge(c, n));
}
