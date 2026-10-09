// Trims the transparent margins off art-src/buildings/building_N.webp and
// writes public/levels/shared/building_N.webp (max 900 px wide).
//   node scripts/trim-buildings.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

mkdirSync('public/levels/shared', { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
for (const f of readdirSync('art-src/buildings').filter((n) => n.endsWith('.webp')).sort()) {
  const url = `data:image/webp;base64,${readFileSync(`art-src/buildings/${f}`).toString('base64')}`;
  const out = await page.evaluate(async (url) => {
    const im = new Image();
    im.src = url;
    await im.decode();
    const cv = document.createElement('canvas');
    cv.width = im.width;
    cv.height = im.height;
    const c = cv.getContext('2d', { willReadFrequently: true });
    c.drawImage(im, 0, 0);
    const d = c.getImageData(0, 0, im.width, im.height).data;
    let x0 = im.width, y0 = im.height, x1 = 0, y1 = 0;
    for (let y = 0; y < im.height; y++)
      for (let x = 0; x < im.width; x++)
        if (d[(y * im.width + x) * 4 + 3] > 16) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    const k = Math.min(1, 900 / w);
    const t = document.createElement('canvas');
    t.width = Math.round(w * k);
    t.height = Math.round(h * k);
    const tc = t.getContext('2d');
    tc.imageSmoothingQuality = 'high';
    tc.drawImage(cv, x0, y0, w, h, 0, 0, t.width, t.height);
    return { w: t.width, h: t.height, data: t.toDataURL('image/webp', 0.9) };
  }, url);
  writeFileSync(`public/levels/shared/${f}`, Buffer.from(out.data.split(',')[1], 'base64'));
  console.log(f, `${out.w}x${out.h}`);
}
await browser.close();
