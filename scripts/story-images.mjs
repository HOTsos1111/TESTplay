// Prepares the illustrated story pages: art-src/story/NN.(webp|png|jpg) ->
// public/story/NN.webp. Pages 09-13 carry a page-number badge in the top-left
// corner; it is painted out with a mirrored patch of the neighbouring scenery.
//   node scripts/story-images.mjs
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const SRC = 'art-src/story';
const OUT = 'public/story';
const MAX_W = 1600;
/** Badge area as a fraction of the image (width, height), plus a soft bottom edge. */
const BADGE = { w: 0.072, h: 0.126, feather: 0.02 };
const BADGE_PAGES = new Set([9, 10, 11, 12, 13]);

mkdirSync(OUT, { recursive: true });
const MIME = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
const files = readdirSync(SRC)
  .map((f) => /^(\d+)\.(webp|png|jpe?g)$/i.exec(f))
  .filter(Boolean)
  .map((m) => ({ n: Number(m[1]), url: `data:${MIME[m[2].toLowerCase()]};base64,${readFileSync(`${SRC}/${m[0]}`).toString('base64')}` }))
  .sort((a, b) => a.n - b.n);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
for (const f of files) {
  const out = await page.evaluate(
    async ({ f, BADGE, badge, MAX_W }) => {
      const im = new Image();
      im.src = f.url;
      await im.decode();
      const k = Math.min(1, MAX_W / im.width);
      const w = Math.round(im.width * k);
      const h = Math.round(im.height * k);
      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      const c = cv.getContext('2d', { willReadFrequently: true });
      c.imageSmoothingQuality = 'high';
      c.drawImage(im, 0, 0, w, h);
      if (badge) {
        const bw = Math.ceil(w * BADGE.w);
        const bh = Math.ceil(h * BADGE.h);
        const fh = Math.ceil(h * BADGE.feather);
        const id = c.getImageData(0, 0, bw * 2, bh);
        const d = id.data;
        const W2 = bw * 2;
        for (let y = 0; y < bh; y++) {
          // Fade back to the original pixels along the bottom edge.
          const a = y < bh - fh ? 1 : (bh - y) / fh;
          for (let x = 0; x < bw; x++) {
            const dst = (y * W2 + x) * 4;
            const src = (y * W2 + (2 * bw - 1 - x)) * 4;
            for (let ch = 0; ch < 3; ch++) d[dst + ch] = d[src + ch] * a + d[dst + ch] * (1 - a);
          }
        }
        c.putImageData(id, 0, 0);
      }
      return { w, h, data: cv.toDataURL('image/webp', 0.86) };
    },
    { f, BADGE, badge: BADGE_PAGES.has(f.n), MAX_W },
  );
  const name = `${String(f.n).padStart(2, '0')}.webp`;
  const buf = Buffer.from(out.data.split(',')[1], 'base64');
  writeFileSync(`${OUT}/${name}`, buf);
  console.log(`${name} ${out.w}x${out.h} ${(buf.length / 1024).toFixed(0)} KB${BADGE_PAGES.has(f.n) ? ' (badge removed)' : ''}`);
}
await browser.close();
