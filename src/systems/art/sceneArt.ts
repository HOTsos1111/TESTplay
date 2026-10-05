import type Phaser from 'phaser';
import { BAND, ell, fillStroke, makeBand, makeTexture, PAL, rng, rr, stroke, wrapDraw, type Ctx } from './canvas';

const W = 1280;
const H = 720;

// ------------------------------------------------------------ depot layers

/** Logical size of the far layer built from the reference skyline (mirrored so it tiles). */
const SKY_K = 3.05;
const SKY_W = 322 * SKY_K;
const SKY_H = 128 * SKY_K;
const SKY_BOTTOM = 476;

function drawDepotFarArt(c: Ctx, art: CanvasImageSource): void {
  // Sky to match the painted panel, then the panel skyline twice (once mirrored) so it wraps.
  const sky = c.createLinearGradient(0, 0, 0, SKY_BOTTOM - SKY_H + 40);
  sky.addColorStop(0, '#6FC0E8');
  sky.addColorStop(1, '#A9DBF1');
  c.fillStyle = sky;
  c.fillRect(0, 0, SKY_W * 2, H);
  const top = SKY_BOTTOM - SKY_H;
  // The source pixels are 2× too small for the 2× contract, so smooth them as they scale up.
  c.imageSmoothingQuality = 'high';
  c.drawImage(art, 0, top, SKY_W, SKY_H);
  c.save();
  c.translate(SKY_W * 2, 0);
  c.scale(-1, 1);
  c.drawImage(art, 0, top, SKY_W, SKY_H);
  c.restore();
  // Blend the panel's top edge into the sky.
  const blend = c.createLinearGradient(0, top - 2, 0, top + 70);
  blend.addColorStop(0, '#A9DBF1');
  blend.addColorStop(1, 'rgba(169,219,241,0)');
  c.fillStyle = blend;
  c.fillRect(0, top - 2, SKY_W * 2, 72);
  // Atmospheric haze keeps it behind the action.
  c.fillStyle = 'rgba(214,236,246,0.22)';
  c.fillRect(0, top, SKY_W * 2, SKY_H);
  c.fillStyle = '#CFC6B8';
  c.fillRect(0, SKY_BOTTOM, SKY_W * 2, H - SKY_BOTTOM);
}

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

const OUT = '#302331';
const TEAL_TRIM = '#2E8B86';

/** Paw-print plaque (shape only: menus and signs never bake in text). */
function pawPlaque(c: Ctx, x: number, y: number, w: number, h: number): void {
  rr(c, x, y, w, h, 6);
  fillStroke(c, '#FFF6E2', 3.5, OUT);
  const cx = x + h * 0.55;
  const cy = y + h / 2 + 2;
  c.fillStyle = OUT;
  ell(c, cx, cy + 4, 8, 6.5);
  c.fill();
  for (const [dx, dy] of [[-8, -4], [-3, -9], [3, -9], [8, -4]]) {
    ell(c, cx + dx, cy + dy, 2.8, 3.3);
    c.fill();
  }
  // Two "lines of lettering" as simple bars.
  c.fillStyle = 'rgba(48,35,49,0.75)';
  rr(c, x + h * 1.05, y + h * 0.3, w - h * 1.3, 5, 2);
  c.fill();
  rr(c, x + h * 1.05, y + h * 0.58, (w - h * 1.3) * 0.75, 5, 2);
  c.fill();
}

function gooseneckLamp(c: Ctx, x: number, y: number): void {
  c.beginPath();
  c.moveTo(x, y + 26);
  c.lineTo(x, y + 8);
  c.quadraticCurveTo(x, y, x + 12, y);
  stroke(c, 7, OUT);
  stroke(c, 3.5, TEAL_TRIM);
  c.beginPath();
  c.moveTo(x + 4, y - 2);
  c.lineTo(x + 26, y - 2);
  c.lineTo(x + 30, y + 10);
  c.lineTo(x, y + 10);
  c.closePath();
  fillStroke(c, TEAL_TRIM, 3, OUT);
  ell(c, x + 15, y + 12, 7, 3.5);
  c.fillStyle = '#FFE38A';
  c.fill();
}

function drawDepotMid(c: Ctx): void {
  // Warehouse tops behind the loading-bay wall (style guide: beige stone, slate
  // roofs, brick chimneys, teal trim, thick outlines). Transparent above roofs.
  const r = rng(23);
  const kinds = ['warehouse', 'office', 'shed', 'warehouse', 'office'] as const;
  let x = 0;
  let i = 0;
  while (x < W - 120) {
    const kind = kinds[i++ % kinds.length];
    const w = kind === 'shed' ? 190 + r() * 60 : 240 + r() * 90;
    const top = kind === 'office' ? 175 + r() * 40 : 225 + r() * 50;
    const draw = (ox: number) => {
      if (kind === 'warehouse') {
        // Brick chimney first so the roof overlaps its base.
        rr(c, ox + w * 0.72, top - 70, 30, 90, 3);
        fillStroke(c, '#C2614A', 3.5, OUT);
        c.fillStyle = 'rgba(48,35,49,0.18)';
        for (let yy = top - 60; yy < top + 10; yy += 12) c.fillRect(ox + w * 0.72 + 3, yy, 24, 2);
        rr(c, ox + w * 0.72 - 4, top - 78, 38, 12, 3);
        fillStroke(c, '#7A7F8C', 3, OUT);
        // Beige stone walls with quoins and a parapet.
        rr(c, ox, top, w, H - top, 4);
        fillStroke(c, '#F1DDB2', 3.5, OUT);
        c.fillStyle = '#E2C38D';
        for (let yy = top + 10; yy < 600; yy += 26) {
          rr(c, ox + 4, yy, 18, 20, 3);
          c.fill();
          rr(c, ox + w - 22, yy, 18, 20, 3);
          c.fill();
        }
        rr(c, ox - 6, top - 10, w + 12, 16, 4);
        fillStroke(c, '#D9BE8C', 3, OUT);
        pawPlaque(c, ox + w * 0.18, top + 26, Math.min(170, w * 0.55), 44);
        gooseneckLamp(c, ox + w * 0.18 + Math.min(170, w * 0.55) + 10, top + 30);
      } else if (kind === 'office') {
        // Blue-grey office block with a gable and rows of windows.
        c.beginPath();
        c.moveTo(ox, top + 34);
        c.lineTo(ox + w / 2, top - 6);
        c.lineTo(ox + w, top + 34);
        c.lineTo(ox + w, H);
        c.lineTo(ox, H);
        c.closePath();
        fillStroke(c, '#B9C6D6', 3.5, OUT);
        c.beginPath();
        c.moveTo(ox - 8, top + 38);
        c.lineTo(ox + w / 2, top - 14);
        c.lineTo(ox + w + 8, top + 38);
        stroke(c, 9, OUT);
        stroke(c, 5, '#6B7A8F');
        for (let wy = top + 52; wy < 420; wy += 56) {
          for (let wx = ox + 24; wx < ox + w - 40; wx += 52) {
            rr(c, wx, wy, 30, 38, 4);
            fillStroke(c, '#E3F2F8', 3, OUT);
            c.beginPath();
            c.moveTo(wx + 15, wy);
            c.lineTo(wx + 15, wy + 38);
            stroke(c, 2, OUT);
          }
        }
      } else {
        // Corrugated shed with a teal roller door strip.
        rr(c, ox, top + 20, w, H - top, 3);
        fillStroke(c, '#9FC3BD', 3.5, OUT);
        c.save();
        rr(c, ox, top + 20, w, H - top, 3);
        c.clip();
        c.fillStyle = 'rgba(48,35,49,0.15)';
        for (let cx = ox + 8; cx < ox + w; cx += 14) c.fillRect(cx, top + 20, 3, H);
        c.restore();
        rr(c, ox - 8, top + 8, w + 16, 16, 4);
        fillStroke(c, '#6B7A8F', 3, OUT);
      }
    };
    wrapDraw(W, x, w, draw);
    x += w + 20 + r() * 50;
  }
  // Soft haze so the layer sits behind the action.
  const haze = c.createLinearGradient(0, 160, 0, 600);
  haze.addColorStop(0, 'rgba(214,236,246,0.05)');
  haze.addColorStop(1, 'rgba(214,236,246,0.3)');
  c.save();
  c.globalCompositeOperation = 'source-atop';
  c.fillStyle = haze;
  c.fillRect(0, 110, W, 610);
  c.restore();
}

function drawDepotNear(c: Ctx): void {
  // Loading-bay wall directly behind the play line (style guide "Delivery Depot"):
  // beige stone, dark roller doors in teal frames, paw-print plaques, lamps, kerb stripe.
  const wallTop = 360;
  c.fillStyle = '#EBD3A6';
  c.fillRect(0, wallTop, W, 600 - wallTop);
  c.fillStyle = 'rgba(160,120,70,0.18)';
  for (let y = wallTop + 18; y < 590; y += 30) {
    c.fillRect(0, y, W, 3);
    for (let x = ((y / 30) % 2) * 40; x < W; x += 80) c.fillRect(x, y, 3, 30);
  }
  c.fillStyle = OUT;
  c.fillRect(0, wallTop - 4, W, 7);
  for (let i = 0; i < 3; i++) {
    const bx = 70 + i * 430;
    // Teal frame and dark roller door.
    rr(c, bx - 12, wallTop + 56, 284, 190, 6);
    fillStroke(c, TEAL_TRIM, 4, OUT);
    rr(c, bx, wallTop + 66, 260, 180, 3);
    fillStroke(c, '#4C5468', 3.5, OUT);
    c.fillStyle = '#5E677D';
    for (let y = wallTop + 74; y < wallTop + 240; y += 14) c.fillRect(bx + 6, y, 248, 5);
    rr(c, bx + 112, wallTop + 226, 36, 10, 3);
    fillStroke(c, '#C7CDD8', 2.5, OUT);
    pawPlaque(c, bx + 50, wallTop + 12, 160, 36);
    // Stone pier between bays with a lamp.
    const px = bx + 300;
    rr(c, px, wallTop, 70, 240, 3);
    fillStroke(c, '#DCC08E', 3, OUT);
    c.fillStyle = 'rgba(48,35,49,0.12)';
    for (let y = wallTop + 26; y < 600; y += 30) c.fillRect(px + 3, y, 64, 3);
    gooseneckLamp(c, px + 22, wallTop + 34);
  }
  // Yellow/black kerb stripe along the foot of the wall.
  c.save();
  c.beginPath();
  c.rect(0, 586, W, 14);
  c.clip();
  c.fillStyle = '#FFC93C';
  c.fillRect(0, 586, W, 14);
  c.fillStyle = OUT;
  for (let x = -20; x < W + 20; x += 32) {
    c.beginPath();
    c.moveTo(x, 600);
    c.lineTo(x + 14, 586);
    c.lineTo(x + 30, 586);
    c.lineTo(x + 16, 600);
    c.closePath();
    c.fill();
  }
  c.restore();
  c.fillStyle = OUT;
  c.fillRect(0, 584, W, 3);
  // Muted overlay so the strip stays behind gameplay.
  c.fillStyle = 'rgba(252,240,220,0.14)';
  c.fillRect(0, wallTop, W, 600 - wallTop);
  // Pit band (visible only through gaps).
  const pit = c.createLinearGradient(0, 600, 0, H);
  pit.addColorStop(0, '#4A3550');
  pit.addColorStop(1, '#1E1520');
  c.fillStyle = pit;
  c.fillRect(0, 600, W, H - 600);
}

// ------------------------------------------------------------ story art

function cloud(c: Ctx, x: number, y: number, s: number): void {
  c.beginPath();
  c.arc(x, y, 22 * s, Math.PI * 0.5, Math.PI * 1.5);
  c.arc(x + 26 * s, y - 16 * s, 26 * s, Math.PI, Math.PI * 1.9);
  c.arc(x + 58 * s, y - 6 * s, 20 * s, Math.PI * 1.3, Math.PI * 0.5);
  c.closePath();
  fillStroke(c, PAL.white, 3);
}

function bush(c: Ctx, x: number, y: number, w: number, color: string, flowers: string | null, r: () => number): void {
  c.beginPath();
  const n = Math.max(3, Math.round(w / 34));
  c.moveTo(x, y);
  for (let i = 0; i <= n; i++) {
    const bx = x + (i / n) * w;
    c.arc(bx, y - 14, 22 + r() * 8, Math.PI, 0);
  }
  c.lineTo(x + w + 20, y);
  c.closePath();
  fillStroke(c, color, 3.5);
  if (!flowers) return;
  for (let i = 0; i < n * 3; i++) {
    const fx = x + r() * w;
    const fy = y - 10 - r() * 26;
    for (let k = 0; k < 5; k++) {
      ell(c, fx + Math.cos(k * 1.26) * 3.2, fy + Math.sin(k * 1.26) * 3.2, 2.6, 2.6);
      c.fillStyle = flowers;
      c.fill();
    }
    ell(c, fx, fy, 1.8, 1.8);
    c.fillStyle = PAL.tag;
    c.fill();
  }
}

function drawGarden(c: Ctx): void {
  // "Home Sweet Home": the hero's garden, per the environment guide.
  const sky = c.createLinearGradient(0, 0, 0, 600);
  sky.addColorStop(0, '#8FD0E6');
  sky.addColorStop(1, '#E4F4EC');
  c.fillStyle = sky;
  c.fillRect(0, 0, W, H);
  cloud(c, 140, 120, 1.1);
  cloud(c, 520, 80, 0.8);
  cloud(c, 1080, 70, 0.9);
  const r = rng(11);
  // Distant rooftops and trees.
  for (let x = -40; x < W; x += 170) {
    const hh = 60 + r() * 50;
    c.fillStyle = '#C9DCCF';
    c.fillRect(x, 470 - hh, 110, hh + 40);
    c.beginPath();
    c.moveTo(x - 10, 470 - hh);
    c.lineTo(x + 55, 470 - hh - 40);
    c.lineTo(x + 120, 470 - hh);
    c.closePath();
    c.fillStyle = '#E2B6A6';
    c.fill();
    ell(c, x + 140, 450, 38, 46);
    c.fillStyle = '#A9CFA0';
    c.fill();
  }
  // Big tree on the left (squirrel territory).
  c.beginPath();
  c.moveTo(70, 600);
  c.quadraticCurveTo(96, 470, 84, 330);
  c.lineTo(132, 330);
  c.quadraticCurveTo(124, 470, 156, 600);
  c.closePath();
  fillStroke(c, '#8A5A3A', 4);
  c.beginPath();
  c.moveTo(110, 380);
  c.quadraticCurveTo(170, 350, 230, 300);
  stroke(c, 18, PAL.outline);
  stroke(c, 12, '#8A5A3A');
  for (const [x, y, rad] of [[40, 270, 80], [140, 210, 96], [250, 260, 78], [90, 330, 60], [200, 320, 62]]) {
    ell(c, x, y, rad, rad * 0.86);
    fillStroke(c, '#5DAA55', 4);
  }
  for (const [x, y] of [[90, 220], [170, 180], [230, 250], [60, 300]]) {
    ell(c, x, y, 26, 18);
    c.fillStyle = '#7CC26B';
    c.fill();
  }
  // House on the right: cream walls, terracotta roof, teal door, flower boxes.
  rr(c, 780, 250, 470, 360, 6);
  fillStroke(c, '#F6E3C0', 4);
  c.fillStyle = 'rgba(214,170,120,0.25)';
  for (let y = 270; y < 600; y += 26) for (let x = 790 + ((y / 26) % 2) * 20; x < 1240; x += 60) c.fillRect(x, y, 34, 3);
  c.beginPath();
  c.moveTo(748, 262);
  c.lineTo(1015, 110);
  c.lineTo(1282, 262);
  c.closePath();
  fillStroke(c, '#D9674A', 4);
  c.save();
  c.clip();
  c.fillStyle = 'rgba(48,35,49,0.18)';
  for (let y = 150; y < 262; y += 22) c.fillRect(740, y, 560, 3);
  c.restore();
  rr(c, 1120, 120, 48, 90, 4);
  fillStroke(c, '#C0573E', 4);
  // Windows with flower boxes.
  for (const wx of [820, 1130]) {
    rr(c, wx, 320, 100, 96, 10);
    fillStroke(c, '#BFE3EF', 4);
    c.beginPath();
    c.moveTo(wx + 50, 322);
    c.lineTo(wx + 50, 414);
    c.moveTo(wx + 2, 368);
    c.lineTo(wx + 98, 368);
    stroke(c, 3.5);
    rr(c, wx - 8, 416, 116, 20, 5);
    fillStroke(c, '#C98D52', 3.5);
    bush(c, wx - 4, 418, 100, '#5DAA55', PAL.coral, r);
  }
  // Teal front door with a yellow knob and a lamp.
  rr(c, 975, 400, 96, 210, 46);
  fillStroke(c, PAL.teal, 4);
  rr(c, 990, 430, 66, 70, 30);
  stroke(c, 3, PAL.tealDark);
  ell(c, 1055, 520, 7, 7);
  fillStroke(c, PAL.tag, 2.5);
  rr(c, 1086, 400, 18, 30, 5);
  fillStroke(c, PAL.butter, 3);
  // Lawn with mowing stripes.
  c.fillStyle = '#9CCB7A';
  c.fillRect(0, 600, W, 120);
  c.fillStyle = 'rgba(255,255,255,0.12)';
  for (let x = 0; x < W; x += 120) c.fillRect(x, 600, 60, 120);
  c.fillStyle = PAL.outline;
  c.fillRect(0, 598, W, 4);
  // Picket fence along the back of the garden.
  for (let x = 250; x < 770; x += 40) {
    c.beginPath();
    c.moveTo(x + 6, 600);
    c.lineTo(x + 6, 488);
    c.lineTo(x + 20, 472);
    c.lineTo(x + 34, 488);
    c.lineTo(x + 34, 600);
    c.closePath();
    fillStroke(c, PAL.white, 3);
  }
  rr(c, 246, 512, 528, 12, 4);
  fillStroke(c, PAL.white, 3);
  rr(c, 246, 560, 528, 12, 4);
  fillStroke(c, PAL.white, 3);
  // Bushes and flower beds in front of the fence and house.
  bush(c, 250, 602, 160, '#4E9A4E', '#F3A0BA', r);
  bush(c, 640, 602, 120, '#4E9A4E', PAL.white, r);
  bush(c, 1150, 602, 120, '#4E9A4E', PAL.coral, r);
  // Flower pots.
  for (const px of [180, 1260]) {
    c.beginPath();
    c.moveTo(px - 22, 570);
    c.lineTo(px + 22, 570);
    c.lineTo(px + 16, 604);
    c.lineTo(px - 16, 604);
    c.closePath();
    fillStroke(c, '#D9674A', 3);
    bush(c, px - 22, 572, 30, '#5DAA55', PAL.tag, r);
  }
}

function drawDogBed(c: Ctx): void {
  // Round cushion bed, 200×70: teal rim, cream cushion.
  ell(c, 100, 44, 96, 24);
  fillStroke(c, PAL.teal, 4);
  ell(c, 100, 38, 78, 15);
  fillStroke(c, PAL.cream, 3);
  c.beginPath();
  c.ellipse(100, 44, 96, 24, 0, 0.1, Math.PI - 0.1);
  stroke(c, 3, PAL.tealDark);
  for (const x of [40, 100, 160]) {
    ell(c, x, 58, 5, 3);
    c.fillStyle = PAL.tealDark;
    c.fill();
  }
}

function drawTruck(c: Ctx, open: boolean): void {
  // 520×300 teal parcel van, cargo box on the left, rear doors facing the viewer's left.
  rr(c, 20, 20, 340, 220, 14);
  fillStroke(c, PAL.cream, 4);
  c.fillStyle = PAL.teal;
  c.fillRect(24, 168, 332, 26);
  c.fillStyle = PAL.outline;
  c.fillRect(24, 166, 332, 3);
  // Cab.
  c.beginPath();
  c.moveTo(360, 80);
  c.lineTo(450, 80);
  c.quadraticCurveTo(490, 80, 500, 150);
  c.lineTo(500, 240);
  c.lineTo(360, 240);
  c.closePath();
  fillStroke(c, PAL.teal, 4);
  c.beginPath();
  c.moveTo(380, 98);
  c.lineTo(445, 98);
  c.quadraticCurveTo(470, 100, 478, 150);
  c.lineTo(380, 150);
  c.closePath();
  fillStroke(c, PAL.sky, 3);
  rr(c, 484, 196, 20, 14, 4);
  fillStroke(c, PAL.butter, 2.5);
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
    // A couple of parcels inside.
    rr(c, 50, 170, 50, 46, 4);
    fillStroke(c, '#C98D52', 3);
    rr(c, 110, 186, 40, 30, 4);
    fillStroke(c, '#C98D52', 3);
    c.beginPath();
    c.moveTo(30, 32);
    c.lineTo(-10, 46);
    c.lineTo(-10, 220);
    c.lineTo(30, 232);
    c.closePath();
    fillStroke(c, '#EFE0C4', 4);
  } else {
    rr(c, 30, 32, 150, 200, 6);
    fillStroke(c, '#EFE0C4', 4);
    c.beginPath();
    c.moveTo(105, 34);
    c.lineTo(105, 230);
    stroke(c, 3);
    rr(c, 92, 120, 8, 30, 3);
    fillStroke(c, '#9AA9C2', 2);
    rr(c, 110, 120, 8, 30, 3);
    fillStroke(c, '#9AA9C2', 2);
  }
  // Logo (shape only): a big teal paw print in a circle.
  ell(c, 270, 96, 44, 44);
  fillStroke(c, PAL.white, 3.5);
  c.fillStyle = PAL.teal;
  ell(c, 270, 108, 17, 14);
  c.fill();
  for (const [x, y] of [[248, 88], [262, 76], [278, 76], [292, 88]]) {
    ell(c, x, y, 7, 8.5);
    c.fill();
  }
}

// ---------------------------------------------------------------- UI art

/** One sausage link of the health chain, with the twisted casing joining it to the next. */
function drawSausageLink(c: Ctx, state: 'full' | 'empty' | 'lost'): void {
  const body = state === 'full' ? '#D0583F' : state === 'lost' ? '#FFFDF6' : 'rgba(255,253,246,0.35)';
  // Twisted casing on the right (links the chain).
  c.beginPath();
  c.moveTo(36, 13);
  c.quadraticCurveTo(41, 15, 46, 12);
  c.lineTo(46, 20);
  c.quadraticCurveTo(41, 17, 36, 19);
  c.closePath();
  fillStroke(c, state === 'full' ? '#E8B07A' : 'rgba(255,253,246,0.35)', 2.4);
  rr(c, 3, 5, 36, 22, 11);
  fillStroke(c, body, 3.2);
  if (state === 'full') {
    c.save();
    rr(c, 3, 5, 36, 22, 11);
    c.clip();
    ell(c, 21, 27, 20, 6);
    c.fillStyle = '#A8402E';
    c.fill();
    c.restore();
    ell(c, 15, 11, 8, 2.6);
    c.fillStyle = 'rgba(255,255,255,0.7)';
    c.fill();
    rr(c, 3, 5, 36, 22, 11);
    stroke(c, 3.2);
  } else if (state === 'empty') {
    c.setLineDash([3, 3]);
    rr(c, 8, 10, 26, 12, 6);
    stroke(c, 1.6, 'rgba(48,35,49,0.45)');
    c.setLineDash([]);
  }
}

function drawUiPlay(c: Ctx): void {
  c.beginPath();
  c.moveTo(10, 6);
  c.lineTo(34, 20);
  c.lineTo(10, 34);
  c.closePath();
  fillStroke(c, PAL.white, 4);
}

function drawUiGear(c: Ctx): void {
  c.save();
  c.translate(20, 20);
  c.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = i % 2 === 0 ? 17 : 13;
    const a2 = a + Math.PI / 16;
    c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    c.lineTo(Math.cos(a2) * r, Math.sin(a2) * r);
  }
  c.closePath();
  fillStroke(c, PAL.white, 3.5);
  ell(c, 0, 0, 5.5, 5.5);
  fillStroke(c, '#6F86A8', 3);
  c.restore();
}

function drawUiExpand(c: Ctx): void {
  c.lineWidth = 4;
  for (const [x, y, dx, dy] of [[6, 6, 1, 1], [34, 6, -1, 1], [6, 34, 1, -1], [34, 34, -1, -1]] as const) {
    c.beginPath();
    c.moveTo(x, y + dy * 11);
    c.lineTo(x, y);
    c.lineTo(x + dx * 11, y);
    stroke(c, 8);
    stroke(c, 4, PAL.white);
  }
}

function drawUiPaw(c: Ctx, color: string): void {
  c.fillStyle = color;
  ell(c, 20, 25, 9, 7.5);
  c.fill();
  for (const [x, y] of [[9, 16], [15, 9], [25, 9], [31, 16]]) {
    ell(c, x, y, 3.6, 4.4);
    c.fill();
  }
}

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

function drawBurstIcon(c: Ctx, empty: boolean): void {
  // Double chevron with speed lines.
  const fill = empty ? '#9A8E9C' : PAL.butter;
  for (const ox of [4, 16]) {
    c.beginPath();
    c.moveTo(ox, 8);
    c.lineTo(ox + 12, 18);
    c.lineTo(ox, 28);
    c.lineTo(ox + 6, 28);
    c.lineTo(ox + 18, 18);
    c.lineTo(ox + 6, 8);
    c.closePath();
    fillStroke(c, fill, 2.2);
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

function drawTouchButton(c: Ctx, kind: 'jump' | 'bark' | 'burst'): void {
  ell(c, 64, 64, 60, 60);
  fillStroke(c, 'rgba(48,35,49,0.35)', 4, 'rgba(255,253,246,0.85)');
  ell(c, 64, 64, 50, 50);
  c.fillStyle = kind === 'jump' ? 'rgba(66,183,176,0.55)' : kind === 'bark' ? 'rgba(240,117,98,0.55)' : 'rgba(255,214,110,0.6)';
  c.fill();
  if (kind === 'burst') {
    for (const ox of [34, 60]) {
      c.beginPath();
      c.moveTo(ox, 38);
      c.lineTo(ox + 24, 64);
      c.lineTo(ox, 90);
      c.lineTo(ox + 12, 90);
      c.lineTo(ox + 36, 64);
      c.lineTo(ox + 12, 38);
      c.closePath();
      fillStroke(c, PAL.white, 3);
    }
  } else if (kind === 'jump') {
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
  if (scene.textures.exists('bg_depot_skyline')) {
    const art = scene.textures.get('bg_depot_skyline').getSourceImage() as CanvasImageSource;
    makeTexture(scene, 'depot_far', SKY_W * 2, H, (c) => drawDepotFarArt(c, art));
  } else makeTexture(scene, 'depot_far', W, H, drawDepotFar);
  makeBand(scene, 'depot_mid', W, BAND.mid, drawDepotMid);
  makeBand(scene, 'depot_near', W, BAND.near, drawDepotNear);
  makeTexture(scene, 'story_garden', W, H, drawGarden);
  makeTexture(scene, 'story_dogbed', 200, 70, drawDogBed);
  makeTexture(scene, 'story_truck_open', 520, 300, (c) => drawTruck(c, true));
  makeTexture(scene, 'story_truck_closed', 520, 300, (c) => drawTruck(c, false));
  for (const s of ['full', 'empty', 'lost'] as const) makeTexture(scene, `heart_${s}`, 40, 38, (c) => drawHeart(c, s));
  for (const s of ['full', 'empty', 'lost'] as const) makeTexture(scene, `hp_link_${s}`, 48, 32, (c) => drawSausageLink(c, s));
  makeTexture(scene, 'ui_play', 40, 40, drawUiPlay);
  makeTexture(scene, 'ui_gear', 40, 40, drawUiGear);
  makeTexture(scene, 'ui_expand', 40, 40, drawUiExpand);
  makeTexture(scene, 'ui_paw', 40, 36, (c) => drawUiPaw(c, PAL.white));
  makeTexture(scene, 'ui_paw_teal', 40, 36, (c) => drawUiPaw(c, PAL.teal));
  makeTexture(scene, 'icon_tail', 36, 36, (c) => drawTailIcon(c, false));
  makeTexture(scene, 'icon_tail_empty', 36, 36, (c) => drawTailIcon(c, true));
  makeTexture(scene, 'icon_bark', 40, 40, drawBarkIcon);
  makeTexture(scene, 'icon_pause', 48, 48, drawPauseIcon);
  makeTexture(scene, 'btn_jump', 128, 128, (c) => drawTouchButton(c, 'jump'));
  makeTexture(scene, 'btn_bark', 128, 128, (c) => drawTouchButton(c, 'bark'));
  makeTexture(scene, 'btn_burst', 128, 128, (c) => drawTouchButton(c, 'burst'));
  makeTexture(scene, 'icon_burst', 40, 36, (c) => drawBurstIcon(c, false));
  makeTexture(scene, 'icon_burst_empty', 40, 36, (c) => drawBurstIcon(c, true));
  for (let n = 1; n <= 6; n++) makeTexture(scene, `badge_ch${n}`, 120, 120, (c) => drawBadge(c, n));
}
