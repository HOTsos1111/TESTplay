// Renders generated textures onto a contact sheet for art review.
//   node scripts/art-sheet.mjs out.png key1,key2,...   (dev server must not be running on 4180)
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const [out = 'screenshots/sheet.png', keyArg = ''] = process.argv.slice(2);
const PORT = 4180;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: ['ignore', 'pipe', 'ignore'] });
await new Promise((res) => server.stdout.on('data', (d) => String(d).includes('localhost') && res()));
process.on('exit', () => server.kill());
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: Number(process.env.DPR ?? 1) });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(`http://localhost:${PORT}/`);
await page.waitForFunction(() => window.__HH__?.scenes?.().includes('Title'), null, { timeout: 30000 });
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: out.replace('.png', '-title.png') });
if (process.env.CLIP) {
  const [x, y, width, height] = process.env.CLIP.split(',').map(Number);
  await page.screenshot({ path: out.replace('.png', '-clip.png'), clip: { x, y, width, height } });
}
const h = await page.evaluate((keys) => {
  const tm = window.__HH__.manager().game.textures;
  const list = keys ? keys.split(',') : tm.getTextureKeys();
  const cv = document.createElement('canvas');
  cv.width = 1400;
  cv.height = 4000;
  const c = cv.getContext('2d');
  c.fillStyle = '#FBF4E4';
  c.fillRect(0, 0, cv.width, cv.height);
  let x = 10, y = 10, rowH = 0;
  for (const k of list) {
    if (!tm.exists(k)) continue;
    const img = tm.get(k).getSourceImage();
    let w = img.width, hh = img.height;
    const s = Math.min(1, 640 / w, 500 / hh);
    w *= s; hh *= s;
    if (x + w > 1390) { x = 10; y += rowH + 24; rowH = 0; }
    c.drawImage(img, x, y, w, hh);
    c.fillStyle = '#333'; c.font = '12px sans-serif'; c.fillText(k, x, y + hh + 14);
    x += Math.max(w, 80) + 14; rowH = Math.max(rowH, hh);
  }
  const H = y + rowH + 30;
  document.body.innerHTML = '';
  document.body.style.margin = '0';
  cv.style.display = 'block';
  document.body.appendChild(cv);
  return H;
}, keyArg);
await page.setViewportSize({ width: 1400, height: Math.min(4000, h) });
await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1400, height: Math.min(4000, h) } });
await browser.close();
server.kill();
process.exit(0);
