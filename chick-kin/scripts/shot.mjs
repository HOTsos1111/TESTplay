// Screenshot helper: node scripts/shot.mjs "<query>" out.png [waitMs] [w] [h]
// Serves the dev build via vite preview if needed (expects `npm run build` first) or uses DEV_URL.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
const [query = '', out = 'screenshots/shot.png', wait = '1500', w = '1280', h = '720'] = process.argv.slice(2);
const PORT = 4188;
let server = null;
const base = process.env.DEV_URL;
if (!base) {
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((res) => { server.stdout.on('data', (d) => { if (String(d).includes('localhost')) res(); }); setTimeout(res, 8000); });
}
const url = (base ?? `http://localhost:${PORT}/`) + query;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
await page.goto(url);
await page.waitForTimeout(+wait);
await page.screenshot({ path: out });
if (errs.length) console.log('ERRORS:\n' + errs.slice(0, 10).join('\n'));
await browser.close();
server?.kill();
console.log('saved', out);
