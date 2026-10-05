// Screenshots of levels mid-play (autopilot + fast-forward). Usage: node scripts/level-shots.mjs 2-4 3-4 ...
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
const ids = process.argv.slice(2);
const ff = Number(process.env.FF ?? 6);
const PORT = 4191;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((res) => { server.stdout.on('data', (d) => { if (String(d).includes('localhost')) res(); }); setTimeout(res, 8000); });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
for (const id of ids) {
  await page.goto(`http://localhost:${PORT}/?play=${id}&auto=1&cls=${process.env.CLS ?? 'nimble'}`);
  await page.waitForFunction(() => window.__ck?.match?.(), null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.evaluate((s) => window.__ck.fastForward(s), ff);
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `screenshots/level-${id}.png` });
  console.log('shot', id, await page.evaluate(() => window.__ck.state()));
}
console.log('errors:', errs.slice(0, 8));
await browser.close(); server.kill();
