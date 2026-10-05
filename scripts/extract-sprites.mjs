// Cuts sprites out of the reference sheets in art-src/ (cream background removed,
// largest connected shape kept, trimmed) and writes PNGs to public/sprites/.
//   node scripts/extract-sprites.mjs [preview.png]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { SPRITE_CROPS } from './sprite-crops.mjs';

const preview = process.argv[2];
mkdirSync('public/sprites', { recursive: true });
const sheets = {};
for (const c of SPRITE_CROPS) sheets[c.sheet] ??= `data:image/png;base64,${readFileSync(`art-src/${c.sheet}.png`).toString('base64')}`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
const out = await page.evaluate(async ({ sheets, crops }) => {
  const imgs = {};
  for (const [k, url] of Object.entries(sheets)) {
    const im = new Image();
    im.src = url;
    await im.decode();
    imgs[k] = im;
  }
  const results = [];
  for (const cr of crops) {
    const [x0, y0, w, h] = cr.rect;
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const c = cv.getContext('2d', { willReadFrequently: true });
    c.drawImage(imgs[cr.sheet], -x0, -y0);
    const id = c.getImageData(0, 0, w, h);
    const d = id.data;
    // Background colour: median of the crop's border.
    const border = [];
    for (let x = 0; x < w; x++) border.push(x, x + (h - 1) * w);
    for (let y = 0; y < h; y++) border.push(y * w, y * w + w - 1);
    const bg = [0, 1, 2].map((ch) => border.map((p) => d[p * 4 + ch]).sort((a, b) => a - b)[border.length >> 1]);
    const dist = (p) => Math.hypot(d[p * 4] - bg[0], d[p * 4 + 1] - bg[1], d[p * 4 + 2] - bg[2]);
    const tol = cr.tol ?? 52;
    // Flood the background in from the crop edges.
    const isBg = new Uint8Array(w * h);
    const stack = border.filter((p) => dist(p) < tol);
    for (const p of stack) isBg[p] = 1;
    while (stack.length) {
      const p = stack.pop();
      const x = p % w;
      const y = (p / w) | 0;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
        if (q >= 0 && !isBg[q] && dist(q) < tol) {
          isBg[q] = 1;
          stack.push(q);
        }
      }
    }
    // Second pass: eat the soft grey-beige ground shadows that touch the feet
    // (light, unsaturated pixels reachable from the background).
    const shadowy = (p) => {
      const r = d[p * 4], g = d[p * 4 + 1], b = d[p * 4 + 2];
      return Math.max(r, g, b) - Math.min(r, g, b) < (cr.shadowChroma ?? 42) && (r + g + b) / 3 > 150;
    };
    const st2 = [];
    for (let p = 0; p < w * h; p++) if (isBg[p]) st2.push(p);
    while (st2.length) {
      const p = st2.pop();
      const x = p % w;
      const y = (p / w) | 0;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
        if (q >= 0 && !isBg[q] && shadowy(q)) {
          isBg[q] = 1;
          st2.push(q);
        }
      }
    }
    // Keep the largest connected foreground shape (drops dust, motion lines, labels).
    const comp = new Int32Array(w * h).fill(-1);
    const sizes = [];
    for (let p = 0; p < w * h; p++) {
      if (isBg[p] || comp[p] >= 0) continue;
      const id2 = sizes.length;
      let n = 0;
      const st = [p];
      comp[p] = id2;
      while (st.length) {
        const q = st.pop();
        n++;
        const x = q % w;
        const y = (q / w) | 0;
        for (const r of [x > 0 ? q - 1 : -1, x < w - 1 ? q + 1 : -1, y > 0 ? q - w : -1, y < h - 1 ? q + w : -1]) {
          if (r >= 0 && !isBg[r] && comp[r] < 0) {
            comp[r] = id2;
            st.push(r);
          }
        }
      }
      sizes.push(n);
    }
    const biggest = sizes.indexOf(Math.max(...sizes));
    const keepMin = (cr.keepFrac ?? 1) * sizes[biggest];
    let minX = w, minY = h, maxX = 0, maxY = 0;
    for (let p = 0; p < w * h; p++) {
      const keep = !isBg[p] && (comp[p] === biggest || sizes[comp[p]] >= keepMin);
      if (!keep) {
        d[p * 4 + 3] = 0;
        continue;
      }
      // Soften the edge: pixels next to the cut that are close to the paper colour fade out.
      const x = p % w;
      const y = (p / w) | 0;
      const edge = (x > 0 && isBg[p - 1]) || (x < w - 1 && isBg[p + 1]) || (y > 0 && isBg[p - w]) || (y < h - 1 && isBg[p + w]);
      if (edge) d[p * 4 + 3] = Math.round(255 * Math.min(1, Math.max(0.15, (dist(p) - tol * 0.6) / 90)));
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    c.putImageData(id, 0, 0);
    const pad = 3;
    const tw = maxX - minX + 1 + pad * 2;
    const th = maxY - minY + 1 + pad * 2;
    const [ow, oh] = cr.size ?? [Math.round(tw * (cr.scale ?? 1)), Math.round(th * (cr.scale ?? 1))];
    const t = document.createElement('canvas');
    t.width = ow;
    t.height = oh;
    const tc = t.getContext('2d');
    tc.imageSmoothingQuality = 'high';
    if (cr.flip) {
      tc.translate(ow, 0);
      tc.scale(-1, 1);
    }
    tc.drawImage(cv, minX - pad, minY - pad, tw, th, 0, 0, ow, oh);
    results.push({ key: cr.key, w: ow, h: oh, png: t.toDataURL('image/png') });
  }
  return results;
}, { sheets, crops: SPRITE_CROPS });

const sizes = {};
for (const r of out) {
  writeFileSync(`public/sprites/${r.key}.png`, Buffer.from(r.png.split(',')[1], 'base64'));
  sizes[r.key] = [r.w, r.h];
}
writeFileSync('src/data/spriteSizes.json', JSON.stringify(sizes, null, 2) + '\n');
console.log(Object.entries(sizes).map(([k, [w, h]]) => `${k} ${w}x${h}`).join('\n'));

if (preview) {
  await page.setContent(`<body style="margin:0;background:#7f9cb0">${out.map((r) => `<figure style="display:inline-block;margin:6px;background:#5d7a8c;font:12px sans-serif;color:#fff"><img src="${r.png}" style="max-width:300px;max-height:260px;display:block"><figcaption>${r.key}</figcaption></figure>`).join('')}</body>`);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.screenshot({ path: preview, fullPage: true });
}
await browser.close();
