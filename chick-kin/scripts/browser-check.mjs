// End-to-end browser check: drives the real game in Chromium (software GL) and reports what it verified.
//   npm run check:browser            (starts the Vite dev server itself)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const PORT = 4192;
const BASE = `http://localhost:${PORT}/`;
mkdirSync('screenshots', { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((res, rej) => { server.stdout.on('data', (d) => { if (String(d).includes('localhost')) res(); }); setTimeout(() => rej(new Error('server timeout')), 20000); });
process.on('exit', () => server.kill());

const exe = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const state = () => page.evaluate(() => window.__ck?.state?.() ?? null);
const click = (t) => page.evaluate((t) => window.__ck.click(t), t);
const waitState = async (s, ms = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await state()) === s) return true; await sleep(250); } return false; };
const ff = (s) => page.evaluate((s) => window.__ck.fastForward(s), s);
const shot = (n) => page.screenshot({ path: `screenshots/check-${n}.png` });

try {
  // ---------------------------------------------------------------- boot + new game
  await page.goto(BASE + '?quality=low');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  check('title loads', await waitState('title'));
  await shot('title');

  // keyboard navigation: Enter on the focused Play button opens chick select
  await sleep(500);
  await page.keyboard.press('Enter');
  check('keyboard: Enter on Play opens chick select', await waitState('select', 8000));
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter'); // select the focused card (Mighty)
  await sleep(300);
  await click('Confirm');
  check('confirm creates a generation and opens the map', await waitState('map'));
  const save1 = await page.evaluate(() => window.__ck.save());
  check('save written with chosen class', save1.current?.cls === 'mighty', save1.current?.cls);

  // ---------------------------------------------------------------- play 1-1 with autopilot
  await click('Play');
  check('briefing opens', await waitState('intro'));
  await page.evaluate(() => { window.__ck.flow.autopilot = true; });
  await click('Start!');
  check('level starts', await waitState('play'));
  await sleep(800);
  await shot('play-1-1');
  // pause / resume
  await page.keyboard.press('Escape');
  await sleep(400);
  check('Escape pauses', await page.evaluate(() => window.__ck.paused()));
  await click('Resume');
  await sleep(300);
  check('Resume unpauses', !(await page.evaluate(() => window.__ck.paused())));
  await ff(90);
  check('autopilot completes 1-1 → results', await waitState('results', 15000));
  const r11 = await page.evaluate(() => window.__ck.result());
  check('1-1 result is a success', !!r11?.success, JSON.stringify(r11?.medals));
  await shot('results-1-1');
  const save2 = await page.evaluate(() => window.__ck.save());
  check('results autosaved and unlocked 1-2', save2.current.unlocked.includes('1-2'));

  // ---------------------------------------------------------------- growth: finish 1-5 → stage 2
  await page.evaluate(() => window.__ck.flow.debugStart('1-5', 'mighty', 1, true));
  await waitState('play');
  await ff(200);
  check('1-5 completes', await waitState('results', 20000));
  check('results offer Grow Up!', await click('Grow Up!'));
  check('growth vignette plays', await waitState('growth'));
  await sleep(3500);
  await shot('growth');
  const save3 = await page.evaluate(() => window.__ck.save());
  check('growth saved: chapter 2 unlocked', save3.current.chapter === 2 && save3.current.unlocked.includes('2-1'));
  await click('Continue');
  check('map shows the next chapter', await waitState('map'));

  // ---------------------------------------------------------------- side race + relay + showdown run through the real flow
  for (const id of ['2-1', '3-1', '4-1', '5-4', '5-5']) {
    await page.evaluate((id) => window.__ck.flow.debugStart(id, 'speedy', 1, true), id);
    await waitState('play');
    await sleep(600);
    await shot(`play-${id}`);
    await ff(id === '5-5' ? 420 : 200);
    const ok = await waitState('results', 25000);
    const res = await page.evaluate(() => window.__ck.result());
    check(`${id} plays through to results`, ok && !!res, res ? `place ${res.placement}${res.points ? ' points ' + res.points.join('/') : ''}` : 'no result');
  }

  // ---------------------------------------------------------------- adult → brood → generation 2
  await page.evaluate(() => window.__ck.flow.debugStart('5-5', 'nimble', 1, false, false, true));
  check('adult celebration', await waitState('adult'));
  await sleep(2500);
  await shot('adult');
  await click('Hatch the new brood');
  check('new brood / family tree', await waitState('brood'));
  await sleep(3000);
  await shot('brood');
  await click('Choose Your Chick');
  check('chick select for generation 2', await waitState('select'));
  await click('Confirm');
  await waitState('map');
  const save4 = await page.evaluate(() => window.__ck.save());
  check('generation 2 started with a modest perk', save4.current.generation === 2 && !!save4.current.perk && save4.family.lineage.length >= 1, `${save4.current.generation} ${save4.current.perk}`);

  // ---------------------------------------------------------------- settings persist
  await page.evaluate(() => window.__ck.flow.goTitle());
  await click('Settings');
  await sleep(300);
  await click('Accessibility');
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('.setting')).find((s) => s.textContent.includes('Reduced motion')); b.querySelectorAll('button')[1].click(); });
  await click('Done');
  await page.reload();
  await waitState('title');
  check('settings persist across reload', await page.evaluate(() => window.__ck.save().settings.reducedMotion === true));

  // ---------------------------------------------------------------- corrupted save recovery
  await page.evaluate(() => { localStorage.setItem('chickkin.save', '{broken'); });
  await page.reload();
  check('corrupted main save recovers from backup', await waitState('title') && await page.evaluate(() => window.__ck.save().family.generation >= 1 && window.__ck.flow.save.lastStatus === 'recovered'));

  // ---------------------------------------------------------------- audio: every cue + music plays without errors
  await page.mouse.click(5, 5);
  const audioErr = await page.evaluate(async () => {
    const a = window.__ck.flow.audio;
    a.unlock();
    await new Promise((r) => setTimeout(r, 300));
    try { for (const n of a.cueNames()) a.play(n); for (const m of ['title', 'nest', 'coop', 'rafters', 'farmyard', 'championship', 'family']) { a.playMusic(m); a.music.tick(); } a.ambience('farmyard'); return null; } catch (e) { return String(e); }
  });
  check('all audio cues and music cues play', audioErr === null, audioErr ?? '');
} catch (e) {
  check('browser check crashed', false, String(e));
  await shot('crash');
}
check('no page errors', errors.length === 0, errors.slice(0, 5).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
