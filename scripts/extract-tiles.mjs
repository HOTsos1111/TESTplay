// Cuts the nine level-select tiles out of art-src/level_buttons.webp (a 3x3
// sheet on white or transparency) into public/ui/tile_01..09.webp, page white removed from the edges.
//   node scripts/extract-tiles.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const url = `data:image/webp;base64,${readFileSync('art-src/level_buttons.webp').toString('base64')}`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
const tiles = await page.evaluate(async (url) => {
  const im = new Image();
  im.src = url;
  await im.decode();
  const W = im.width;
  const H = im.height;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const c = cv.getContext('2d', { willReadFrequently: true });
  c.drawImage(im, 0, 0);
  const id = c.getImageData(0, 0, W, H);
  const d = id.data;
  const white = (p) => d[p * 4 + 3] < 24 || (d[p * 4] > 236 && d[p * 4 + 1] > 236 && d[p * 4 + 2] > 236);
  // Flood the page white in from the sheet edges.
  const bg = new Uint8Array(W * H);
  const st = [];
  for (let x = 0; x < W; x++) st.push(x, x + (H - 1) * W);
  for (let y = 0; y < H; y++) st.push(y * W, y * W + W - 1);
  for (const p of st) if (white(p)) bg[p] = 1;
  const stack = st.filter((p) => bg[p]);
  while (stack.length) {
    const p = stack.pop();
    const x = p % W;
    const y = (p / W) | 0;
    for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]) {
      if (q >= 0 && !bg[q] && white(q)) {
        bg[q] = 1;
        stack.push(q);
      }
    }
  }
  // Tiles: connected non-page regions.
  const lab = new Int32Array(W * H).fill(-1);
  const boxes = [];
  for (let s = 0; s < W * H; s++) {
    if (bg[s] || lab[s] >= 0) continue;
    const b = { x0: W, y0: H, x1: 0, y1: 0, n: 0 };
    const q = [s];
    lab[s] = boxes.length;
    while (q.length) {
      const p = q.pop();
      const x = p % W;
      const y = (p / W) | 0;
      b.n++;
      b.x0 = Math.min(b.x0, x);
      b.x1 = Math.max(b.x1, x);
      b.y0 = Math.min(b.y0, y);
      b.y1 = Math.max(b.y1, y);
      for (const r of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]) {
        if (r >= 0 && !bg[r] && lab[r] < 0) {
          lab[r] = boxes.length;
          q.push(r);
        }
      }
    }
    boxes.push(b);
  }
  for (let p = 0; p < W * H; p++) if (bg[p]) d[p * 4 + 3] = 0;
  c.putImageData(id, 0, 0);
  const big = boxes.filter((b) => b.n > 20000).sort((a, b) => (Math.abs(a.y0 - b.y0) > 100 ? a.y0 - b.y0 : a.x0 - b.x0));
  return big.map((b) => {
    const t = document.createElement('canvas');
    t.width = b.x1 - b.x0 + 1;
    t.height = b.y1 - b.y0 + 1;
    t.getContext('2d').drawImage(cv, -b.x0, -b.y0);
    return { w: t.width, h: t.height, data: t.toDataURL('image/webp', 0.9) };
  });
}, url);
console.log(tiles.length, 'tiles', tiles.map((t) => `${t.w}x${t.h}`).join(' '));
tiles.forEach((t, i) => writeFileSync(`public/ui/tile_0${i + 1}.webp`, Buffer.from(t.data.split(',')[1], 'base64')));
await browser.close();
