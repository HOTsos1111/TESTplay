// Collects render statistics per chapter (draw calls, triangles, geometries, textures, JS heap).
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
const PORT = 4193;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((res) => { server.stdout.on('data', (d) => { if (String(d).includes('localhost')) res(); }); setTimeout(res, 8000); });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
for (const id of ['1-4', '2-5', '3-4', '4-4', '5-1', '5-5']) {
  await page.goto(`http://localhost:${PORT}/?play=${id}&auto=1&quality=high`);
  await page.waitForFunction(() => window.__ck?.match?.(), null, { timeout: 30000 });
  await page.evaluate(() => window.__ck.fastForward(5));
  await page.waitForTimeout(2500);
  const s = await page.evaluate(() => { const r = window.__ck.flow.r.gl; const i = r.info; return { calls: i.render.calls, tris: i.render.triangles, geos: i.memory.geometries, tex: i.memory.textures, heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null }; });
  console.log(id, JSON.stringify(s));
}
await browser.close(); server.kill();
