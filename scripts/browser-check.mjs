// End-to-end browser check: builds must exist (npm run build). Starts `vite preview`,
// drives the real game in Chromium and reports what it verified.
//   node scripts/browser-check.mjs [--quick]
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const PORT = 4179;
const BASE = `http://localhost:${PORT}/`;
const quick = process.argv.includes('--quick');
const exe = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
mkdirSync('screenshots', { recursive: true });

// Refuse to test a stale build: the preview serves dist/, not src/.
{
  const { statSync, readdirSync } = await import('node:fs');
  const newest = (dir) => readdirSync(dir, { withFileTypes: true }).reduce((m, e) => Math.max(m, e.isDirectory() ? newest(`${dir}/${e.name}`) : statSync(`${dir}/${e.name}`).mtimeMs), 0);
  let built = 0;
  try {
    built = statSync('dist/index.html').mtimeMs;
  } catch {
    /* no build */
  }
  if (newest('src') > built) {
    console.error('dist/ is older than src/ — run `npm run build` first.');
    process.exit(2);
  }
}
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: ['ignore', 'pipe', 'ignore'] });
await new Promise((res, rej) => {
  const onData = (d) => {
    if (String(d).includes('localhost')) {
      server.stdout.off('data', onData);
      server.stdout.resume();
      res();
    }
  };
  server.stdout.on('data', onData);
  server.on('exit', () => rej(new Error(`preview server exited (is port ${PORT} busy?)`)));
  setTimeout(() => rej(new Error('preview server timeout')), 20000);
});
process.on('exit', () => server.kill());

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const errors = [];

// Pages open on the Title menu (?intro=0 skips the launch story and instructions).
const withIntroOff = (query) => (query.includes('intro=') ? query : query ? `${query}&intro=0` : '?intro=0');
/** A page switch can blur the game and pause it; resume so long runs are not stalled. */
async function keepRunning(page) {
  await page.bringToFront();
  await page.evaluate(() => {
    const m = window.__HH__?.manager?.();
    const pause = m?.getScene('Pause');
    if (pause && m.isActive('Pause')) pause.resume?.();
  });
}

async function newPage(query = '') {
  const page = await context.newPage();
  await page.bringToFront();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  await page.goto(BASE + withIntroOff(query));
  await page.waitForFunction(() => window.__HH__?.scenes?.().includes('Title'), null, { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 500));
  return page;
}
const scenes = (page) => page.evaluate(() => window.__HH__.scenes());
const state = (page) => page.evaluate(() => window.__HH__.game?.() ?? null);
const waitScene = async (page, key, timeout = 15000) => {
  try {
    await page.waitForFunction((k) => window.__HH__.scenes().includes(k), key, { timeout });
  } catch (e) {
    await page.screenshot({ path: `screenshots/timeout-${key}.png` });
    throw new Error(`waiting for ${key}; active scenes: ${(await scenes(page)).join(',')}`);
  }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  let page;
  // BOSSES=2,5 runs only those boss fights.
  if (!process.env.BOSSES) {
  // ---------------------------------------------------------------- fresh start, story, controls
  page = await newPage();
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await waitScene(page, 'Title');
  await sleep(500);
  await page.screenshot({ path: 'screenshots/01-title.png' });
  check('title scene loads', (await scenes(page)).includes('Title'));

  // Every sound effect and music track synthesises without errors.
  await page.mouse.click(5, 5);
  const audioErr = await page.evaluate(async () => {
    const a = window.__HH__.audio();
    a.unlock();
    await new Promise((r) => setTimeout(r, 200));
    const keys = ['bark', 'jump', 'land', 'step', 'bone', 'hit', 'defeat', 'box_break', 'boss_hit', 'boss_clear', 'ui_select', 'ui_confirm', 'ui_back', 'whistle', 'squirrel', 'throw', 'parcel', 'squeak', 'retreat', 'burst_stretch', 'burst_snap', 'burst_ready'];
    try {
      for (const k of keys) a.play(k);
      a.startTail();
      a.stopTail();
      for (const m of ['depot', 'chase', 'home', 'title']) {
        a.playMusic(m);
        await new Promise((r) => setTimeout(r, 300));
      }
      return a.unlocked ? null : 'audio context not running';
    } catch (e) {
      return String(e);
    }
  });
  check('all sound effects and music tracks play without errors', audioErr === null, audioErr ?? '');

  // A normal launch plays the story, then How to Play, then opens the level select.
  await page.goto(BASE);
  await waitScene(page, 'Story');
  await sleep(1200);
  await page.screenshot({ path: 'screenshots/02-story.png' });
  await page.keyboard.press('Space');
  await sleep(1500);
  await page.screenshot({ path: 'screenshots/02b-story.png' });
  await page.keyboard.press('Escape');
  await waitScene(page, 'HowTo', 8000);
  await sleep(800);
  await page.screenshot({ path: 'screenshots/02c-howto-controls.png' });
  await page.keyboard.press('ArrowRight');
  await sleep(800);
  await page.screenshot({ path: 'screenshots/02d-howto-obstacles.png' });
  await page.keyboard.press('ArrowRight');
  await waitScene(page, 'ChapterMap', 8000);
  await sleep(600);
  await page.screenshot({ path: 'screenshots/02e-level-select.png' });
  // Enter opens the level card, Enter again presses Let's Go.
  await page.keyboard.press('Enter');
  await sleep(500);
  await page.keyboard.press('Enter');
  await waitScene(page, 'Game', 8000);
  check('launch plays story and how-to-play, then the level select starts chapter 1', true);
  await sleep(1500);
  await page.screenshot({ path: 'screenshots/03-game-start.png' });

  // Hold jump across landing: exactly one jump, then hover, then stay grounded.
  let s0 = await state(page);
  await page.keyboard.down('Space');
  let jumps = 0;
  let wasGrounded = s0.grounded;
  let sawHover = false;
  let minWag = 1;
  const t0 = Date.now();
  // Run until he has hovered and landed again (slow headless frames make wall time unreliable).
  let landedAfterHover = false;
  while (Date.now() - t0 < 15000 && !landedAfterHover) {
    const s = await state(page);
    if (wasGrounded && !s.grounded && s.vy < -200) jumps++;
    wasGrounded = s.grounded;
    sawHover ||= s.hovering;
    minWag = Math.min(minWag, s.wag);
    landedAfterHover = sawHover && s.grounded;
    await sleep(16);
  }
  await sleep(400);
  const sHeld = await state(page);
  await page.keyboard.up('Space');
  check('holding jump across landing triggers only one jump', jumps === 1, `jumps=${jumps}`);
  check('holding jump while falling hovers and drains the wag meter', sawHover && minWag < 0.9, `minWag=${minWag.toFixed(2)}`);
  check('hero is back on the ground while jump is still held', sHeld.grounded);
  {
    const t1 = Date.now();
    while (Date.now() - t1 < 12000 && (await state(page)).wag < minWag + 0.55) await sleep(100);
  }
  const sRecharged = await state(page);
  check('wag meter recharges on the ground', sRecharged.wag > minWag + 0.5, `wag=${sRecharged.wag.toFixed(2)}`);

  const vis = (await state(page)).heroView;
  check('hero rig is visible with sane scale', vis.visible && vis.alpha > 0.3 && vis.scaleX > 0.4 && vis.scaleX < 1.6 && vis.scaleY > 0.4 && vis.scaleY < 1.6, JSON.stringify(vis));
  await page.screenshot({ path: 'screenshots/03b-before-pause.png' });

  // Burst: stretch, speed boost, meter empties.
  await page.keyboard.press('Shift');
  await sleep(60);
  await page.screenshot({ path: 'screenshots/03c-burst-stretch.png' });
  const bs = await state(page);
  check('burst boosts speed and empties the meter', bs.bursting && bs.effectiveSpeed > bs.speed * 1.3 && bs.burstMeter < 0.2, `speed=${bs.speed} eff=${Math.round(bs.effectiveSpeed)} meter=${bs.burstMeter.toFixed(2)}`);
  await sleep(250);
  await page.screenshot({ path: 'screenshots/03d-burst-run.png' });

  // Pause freezes simulation.
  await page.keyboard.press('Escape');
  await waitScene(page, 'Pause');
  const p1 = await state(page);
  await sleep(1000);
  const p2 = await state(page);
  await page.screenshot({ path: 'screenshots/04-pause.png' });
  check('pause freezes the world', p1.x === p2.x && p1.barkCooldown === p2.barkCooldown, `dx=${p2.x - p1.x}`);
  await page.keyboard.press('Escape');
  await sleep(400);
  const p3 = await state(page);
  check('resume continues the run', p3.x > p2.x && !(await scenes(page)).includes('Pause'));

  // Bark cooldown prevents spam.
  // Wait for the bark to register (frames are slow in headless runs), then press
  // again straight away: the second press must not restart the cooldown.
  await page.keyboard.press('x');
  let b1 = await state(page);
  for (let i = 0; i < 40 && !(b1.barkCooldown > 0.3); i++) {
    await sleep(25);
    b1 = await state(page);
  }
  await page.keyboard.press('x');
  await sleep(50);
  const b2 = await state(page);
  check('bark starts a cooldown that blocks immediate re-bark', b1.barkCooldown > 0.3 && b2.barkCooldown <= b1.barkCooldown, `cd1=${b1.barkCooldown.toFixed(2)} cd2=${b2.barkCooldown.toFixed(2)}`);

  // The earlier control tests leave the dog running unattended, losing health
  // (or falling into the first pit).
  // Always begin the power-up and damage checks on a fresh, full-health run.
  await page.evaluate(() => {
    const live = window.__HH__.manager().getScenes(true).find((sc) => sc.scene.key === 'Game' || sc.scene.key === 'Results');
    live?.scene.start('Game', { chapter: 1, startAt: 'start' });
  });
  await waitScene(page, 'Game');
  await sleep(800);
  // Power-ups are placed at random each run: read the next one from the level
  // layout and drop the hero right onto it.
  {
    let got = false;
    const where = await page.evaluate(() => {
      const g = window.__HH__.manager().getScene('Game');
      // Pick one with solid floor beneath (some float over pits for hover routes).
      const overGround = (x) => g.layout.items.some((i) => i.type === 'ground' && x > i.x + 200 && x < i.x + i.w - 200);
      const p = g?.layout?.items.find((i) => i.type === 'powerup' && i.x > g.pc.x + 100 && overGround(i.x));
      return p ? { x: p.x, y: p.y } : null;
    });
    if (where) {
      await page.evaluate((w) => window.__HH__.teleport?.()?.(w.x, w.y + 40), where);
      const t1 = Date.now();
      while (Date.now() - t1 < 5000 && !got) {
        const s = await state(page);
        got = Object.keys(s?.powerups ?? {}).length > 0;
        await sleep(50);
      }
    }
    check('touching a power-up bubble activates it', got, where ? `${JSON.stringify(where)} after=${JSON.stringify(await state(page))?.slice(0, 300)} scenes=${await scenes(page)}` : `no power-up found (scenes=${await scenes(page)} state=${JSON.stringify(await state(page))?.slice(0, 160)})`);
  }

  // Run without input until something hurts the hero; verify invulnerability then defeat flow.
  let hurt = null;
  // A collected Soap Bubble Shield would absorb the hit we are looking for.
  await page.evaluate(() => {
    const g = window.__HH__.manager().getScene('Game');
    for (const k of Object.keys(g?.power ?? {})) g.expirePowerUp(k);
  });
  let lineup = null;
  // Line the dog up before the next ground obstacle with no pit in between, so it
  // meets an obstacle first (earlier teleports leave nothing behind the camera).
  for (let i = 0; i < 20; i++) {
    const s = await state(page);
    if (!s) break;
    const hz = s.hazardsAhead.find((h) => h.bottom < 18 && h.dx > 400 && !s.gapsAhead.some((g) => g[0] < h.dx));
    if (hz) {
      lineup = { from: Math.round(s.x), hz };
      await page.evaluate((x) => window.__HH__.teleport?.()?.(x, undefined, 0), s.x + hz.dx - 300);
      break;
    }
    await page.evaluate((x) => window.__HH__.teleport?.()?.(x), s.x + 1200);
    await sleep(300);
  }
  await sleep(100);
  const startHearts = (await state(page))?.hearts ?? 0;
  const t1 = Date.now();
  while (Date.now() - t1 < 25000) {
    const s = await state(page);
    if (!s) break;
    if (s.hearts < startHearts) {
      hurt = s;
      break;
    }
    await sleep(30);
  }
  check('obstacles damage an idle hero', !!hurt, hurt ? `hearts=${hurt.hearts}` : `no hit (start=${startHearts} lineup=${JSON.stringify(lineup)} now=${JSON.stringify(await state(page))?.slice(0, 260)} scenes=${await scenes(page)})`);
  if (hurt) {
    await sleep(300);
    const s = await state(page);
    check('post-hit invulnerability prevents a repeated hit', s === null || s.hearts >= hurt.hearts - 0 || s.phase === 'defeat', `hearts ${hurt.hearts} -> ${s?.hearts}`);
  }
  await waitScene(page, 'Results', 60000);
  await sleep(600);
  await page.screenshot({ path: 'screenshots/05-results-fail.png' });
  check('failure leads to the results screen', true);
  const bonesAfterFail = await page.evaluate(() => JSON.parse(localStorage.getItem('homeward-hound.progress')).boneBalance);
  check('bones collected before failing are saved', bonesAfterFail > 0, `boneBalance=${bonesAfterFail}`);
  await page.close();

  // ---------------------------------------------------------------- full chapter (god mode autopilot)
  if (!quick) {
    page = await newPage('?god=1&realtime=1');
    await page.keyboard.press('Enter');
    await waitScene(page, 'ChapterMap');
    await sleep(400);
    await page.keyboard.press('Enter');
    await sleep(500);
    await page.keyboard.press('Enter');
    await waitScene(page, 'Game');
    const shots = { hover: false, bark: false, boss: false };
    const tStart = Date.now();
    let lastBark = 0;
    let lastJump = 0;
    while (Date.now() - tStart < 600000) {
      const sc = await scenes(page);
      if (sc.includes('Results')) break;
      const s = await state(page);
      if (!s) {
        await sleep(100);
        continue;
      }
      const now = Date.now();
      if (now - lastBark > 800) {
        await page.keyboard.press('k');
        lastBark = now;
        if (!shots.bark && s.x > 15000) {
          await sleep(60);
          await page.screenshot({ path: 'screenshots/06-bark.png' });
          shots.bark = true;
        }
      }
      // Boss fights: pace forward so enemies come into bark reach, and bark often.
      if (s.phase === 'encounter') {
        await page.keyboard.down('d');
        if (now - lastBark > 300) {
          await page.keyboard.press('k');
          lastBark = now;
        }
      }
      if (s.phase === 'run' && now - lastJump > 1500 && s.grounded) {
        await page.keyboard.down('Space');
        await sleep(700);
        const sh = await state(page);
        if (!shots.hover && sh?.hovering && sh.x > 18000) {
          await page.screenshot({ path: 'screenshots/07-hover.png' });
          shots.hover = true;
        }
        await page.keyboard.up('Space');
        lastJump = Date.now();
      }
      if (!shots.boss && s.bossPhase === 'fight' && (s.bossHits ?? 0) >= 2) {
        await page.screenshot({ path: 'screenshots/08-boss.png' });
        shots.boss = true;
      }
      await sleep(40);
    }
    const sc = await scenes(page);
    check('full chapter run reaches the results screen', sc.includes('Results'), `${sc.join(',')} after ${Math.round((Date.now() - tStart) / 1000)}s ${JSON.stringify(await state(page))?.slice(0, 300)}`);
    await sleep(800);
    await page.screenshot({ path: 'screenshots/09-results-win.png' });
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('homeward-hound.progress')));
    check('chapter completion is saved', saved.completedChapters.includes(1) && saved.unlockedChapter >= 2, JSON.stringify({ c: saved.completedChapters, u: saved.unlockedChapter, bones: saved.boneBalance }));
    check('first-clear bonus is claimed once', saved.claimedRewards.filter((r) => r === 'chapter1_clear').length === 1);

    // Progress survives a refresh.
    await page.reload();
    await waitScene(page, 'Title');
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('homeward-hound.progress')));
    check('progress survives refresh', after.completedChapters.includes(1));
    await page.close();
  }

  // ---------------------------------------------------------------- whole chapter at base stats, no god mode
  if (!quick) {
    page = await newPage('?realtime=1');
    await page.evaluate(() => {
      const p = JSON.parse(localStorage.getItem('homeward-hound.progress') ?? '{}');
      p.storySeen = true;
      p.upgrades = { tail: 0, recharge: 0, bark: 0 };
      p.checkpoint = null;
      p.completedChapters = [];
      localStorage.setItem('homeward-hound.progress', JSON.stringify(p));
    });
    await page.reload();
    await waitScene(page, 'Title');
    await sleep(400);
    await page.evaluate(() => { window.__HH__.manager().getScene('Title').scene.start('Game', { chapter: 1, startAt: 'start' }); });
    await waitScene(page, 'Game');
    await page.evaluate(() => {
      const w = window;
      w.__bot = { minHearts: Infinity, barks: 0, jumps: 0, hits: [], frames: 0, t0: performance.now() };
      w.__hold = null;
      let lastHearts = null;
      const tick = () => {
        const s = w.__HH__.game?.();
        const input = w.__HH__.input?.();
        if (!s || !input) {
          // State can be briefly unavailable (scene switch); keep polling.
          if (!w.__HH__.scenes().includes('Results')) requestAnimationFrame(tick);
          return;
        }
        const now = performance.now();
        // Time a jump from how fast the nearest low threat is closing in.
        // Shockwaves can come from behind too: measure the gap on either side.
        const closing = (s, now) => {
          const gapOf = (h) => (h.dx > -20 ? h.dx : -(h.dx + h.w));
          const low = s.hazardsAhead.filter((h) => h.bottom < 18 && (h.dx > -20 || h.dx + h.w < -10)).sort((a, b) => gapOf(a) - gapOf(b))[0];
          if (!low) {
            w.__lp = null;
            return false;
          }
          const gap = gapOf(low);
          let v = w.__lv ?? 400;
          if (w.__lp && now > w.__lp.t && w.__lp.gap > gap) v = Math.max(60, Math.min(1400, (w.__lp.gap - gap) / ((now - w.__lp.t) / 1000)));
          w.__lp = { gap, t: now };
          w.__lv = v;
          const tc = (gap - 30) / v;
          return tc > 0 && tc < 0.3;
        };
        if (lastHearts !== null && s.hearts < lastHearts) w.__bot.hits.push(Math.round(s.x));
        lastHearts = s.hearts;
        w.__bot.minHearts = Math.min(w.__bot.minHearts, s.hearts);
        // Bark at anything barkable inside reach (cardboard, squirrels, acorns, the latch).
        const reachable = s.barkTargetsAhead.find((b) => b.dx > 55 && b.dx < 60 + s.barkRange - 25 && b.bottom < s.height + 105 && b.top > s.height - 15);
        if (reachable && s.barkCooldown <= 0) {
          input.touchDown('bark', 78);
          input.touchUp(78);
          w.__bot.barks++;
        }
        // Boss arena: read the warning, keep clear of marked spots, jump the low
        // lane, duck the high one, and run in to bark while the guard is down.
        if (s.phase === 'encounter' && 'bossAttack' in s) {
          const a = s.bossAttack;
          let mx = 0;
          let duck = false;
          // Hold station just outside the boss's reach and bark whenever in range.
          const bx = s.bossScreenX ?? 660;
          const want = bx - 290;
          if (Math.abs(s.screenX - bx) < 310 && s.barkCooldown <= 0) {
            input.touchDown('bark', 78);
            input.touchUp(78);
            w.__bot.barks++;
          }
          if (a && (a.kind === 'volley' || a.kind === 'drop' || a.kind === 'geyser')) {
            const tx = a.targetX - (s.x - s.screenX);
            mx = Math.abs(s.screenX - tx) > 200 || s.screenX < 110 ? 0 : tx > s.screenX ? -1 : s.screenX < want - 40 ? 1 : -1;
          } else mx = s.screenX < want - 30 ? 1 : s.screenX > want + 30 ? -1 : 0;
          duck = !!a && a.height === 'high';
          input.setStick(duck ? 0 : mx, duck ? 0.95 : 0, duck || mx !== 0);
          if (closing(s, now) && s.grounded && !w.__hold && !duck) {
            input.touchDown('jump', 77);
            w.__hold = { mode: 'hop', air: false };
            w.__bot.jumps++;
          } else if (w.__hold && !s.grounded) w.__hold.air = true;
          if (w.__hold && w.__hold.air && s.vy > 0) {
            input.touchUp(77);
            w.__hold = null;
          }
          w.__bot.frames++;
          w.__bot.last = { x: Math.round(s.x), phase: s.phase, boss: s.bossPhase, hits: s.bossHits };
          if (s.phase !== 'victory' && s.phase !== 'defeat') requestAnimationFrame(tick);
          return;
        }
        // Long gaps (painted arrows) need a burst first.
        const longGap = s.gapsAhead.find((g) => g[1] - g[0] > 560 && g[0] > 60 && g[0] < 380);
        if (longGap && !s.bursting && s.burstMeter >= 1 && s.grounded) {
          input.touchDown('burst', 79);
          input.touchUp(79);
          w.__bot.bursts = (w.__bot.bursts ?? 0) + 1;
        }
        // Duck under low signs (overhead hazards).
        const overhead = s.hazardsAhead.find((h) => h.bottom > 18 && h.dx + h.w > -50 && h.dx < 170);
        if (overhead && s.grounded && !w.__hold) {
          // A pumping pipe that is slamming down: ease back while ducking.
          input.setStick(overhead.bottom < 26 && overhead.dx > 20 ? -0.9 : 0, 0.95, true);
          w.__duck = true;
        } else if (w.__duck) {
          input.setStick(0, 0, false);
          w.__duck = false;
        }
        // Double-jump tall crate towers: second press near the top of the first jump.
        const tower = s.solidsAhead.find((c) => c.kind === 'crate' && c.dx > -30 && c.dx < 300 && c.top > 110 && c.top > s.height + 10);
        if (tower && !s.grounded && !s.doubleUsed && s.vy > -300) {
          input.touchDown('jump', 77);
          w.__bot.doubles = (w.__bot.doubles ?? 0) + 1;
          w.__hold = { mode: 'gap', air: true };
        }
        // Hold like a player: across a gap until landing; for hops/crates until the apex.
        if (s.grounded && !w.__hold && !w.__duck) {
          let mode = null;
          const gap = s.gapsAhead.find((g) => g[0] >= 0 && g[0] < (s.bursting ? 170 : 110) && s.height < 5);
          if (gap) mode = 'gap';
          const hz = s.hazardsAhead.find((h) => h.bottom < 18 && h.dx > 45 && h.dx < 125 && h.top > s.height);
          if (!mode && hz) mode = 'hop';
          // Stacked crates arrive as one solid per crate: judge each column by its tallest crate.
          const crate = [...s.solidsAhead].sort((a, b) => b.top - a.top).find((c) => c.kind === 'crate' && c.dx > (c.top > s.height + 110 ? 280 : 140) && c.dx < (c.top > s.height + 110 ? 360 : 220) && c.top > s.height + 5);
          if (!mode && crate) mode = 'hop';
          if (mode) {
            input.touchDown('jump', 77);
            w.__hold = { mode, air: false };
            w.__bot.jumps++;
          }
        } else if (w.__hold) {
          const h = w.__hold;
          if (!s.grounded) h.air = true;
          // Across a gap, let go once the whole body is past it (like a player would)
          // instead of hovering on and overshooting into the next pit.
          const overGap = s.gapsAhead.some((g) => g[0] < 60 && g[1] > -50);
          const release = h.mode === 'gap' ? h.air && (s.grounded || (!overGap && s.vy > 0)) : h.air && s.vy > 0;
          if (release) {
            input.touchUp(77);
            w.__hold = null;
          }
        }
        w.__bot.frames++;
        w.__bot.fps = Math.round((w.__bot.frames * 1000) / (now - w.__bot.t0));
        w.__bot.last = { x: Math.round(s.x), y: Math.round(s.y), phase: s.phase, gaps: s.gapsAhead, solids: s.solidsAhead, hz: s.hazardsAhead };
        if (s.phase !== 'victory' && s.phase !== 'defeat') requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    try {
      const t0 = Date.now();
      while (Date.now() - t0 < 720000 && !(await scenes(page)).includes('Results')) {
        await keepRunning(page);
        await sleep(4000);
      }
    } catch {
      /* reported below */
    }
    const bot = await page.evaluate(() => window.__bot);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('homeward-hound.progress')));
    await page.screenshot({ path: 'screenshots/10-basestat-results.png' });
    check('whole chapter + boss completed at base stats without god mode', saved.completedChapters.includes(1) && saved.checkpoint === null, JSON.stringify(bot));
    await page.close();
  }

  }

  // ---------------------------------------------------------------- finales at base stats, no god mode
  const BOSS_NAMES = ['Don Crumb', 'Forklift Frankie', 'Captain Gull', 'Switchback Badger', 'Boiler Brutus', 'Hardhat Hank', 'Net-O-Matic', 'Honkzilla', 'Squirrel Boss'];
  for (const fin of BOSS_NAMES.map((name, i) => ({ chapter: i + 1, name })).filter((f) => !quick || f.chapter <= 2).filter((f) => !process.env.BOSSES || process.env.BOSSES.split(',').map(Number).includes(f.chapter))) {
  page = await newPage('?realtime=1');
  await page.evaluate((fin) => {
    const p = JSON.parse(localStorage.getItem('homeward-hound.progress') ?? '{}');
    p.version = 2;
    p.storySeen = true;
    p.upgrades = { tail: 0, recharge: 0, bark: 0 };
    p.checkpoint = { chapter: fin.chapter, at: 'encounter' };
    localStorage.setItem('homeward-hound.progress', JSON.stringify(p));
  }, fin);
  await page.reload();
  await waitScene(page, 'Title');
  await sleep(400);
  await page.evaluate((ch) => { window.__HH__.manager().getScene('Title').scene.start('Game', { chapter: ch, startAt: 'encounter' }); }, fin.chapter);
  await waitScene(page, 'Game');
  await keepRunning(page);
  {
    // In-page autopilot: reacts every animation frame using only what a player sees
    // (hazards ahead, the glowing latch), injecting input like a touch player would.
    await page.evaluate(() => {
      const w = window;
      w.__bot = { minHearts: Infinity, barks: 0, jumps: 0 };
      let holdUntil = 0;
      const tick = () => {
        const s = w.__HH__.game?.();
        const input = w.__HH__.input?.();
        if (!s || !input) {
          // State can be briefly unavailable (scene switch); keep polling.
          if (!w.__HH__.scenes().includes('Results')) requestAnimationFrame(tick);
          return;
        }
        const now = performance.now();
        // Time a jump from how fast the nearest low threat is closing in.
        // Shockwaves can come from behind too: measure the gap on either side.
        const closing = (s, now) => {
          const gapOf = (h) => (h.dx > -20 ? h.dx : -(h.dx + h.w));
          const low = s.hazardsAhead.filter((h) => h.bottom < 18 && (h.dx > -20 || h.dx + h.w < -10)).sort((a, b) => gapOf(a) - gapOf(b))[0];
          if (!low) {
            w.__lp = null;
            return false;
          }
          const gap = gapOf(low);
          let v = w.__lv ?? 400;
          if (w.__lp && now > w.__lp.t && w.__lp.gap > gap) v = Math.max(60, Math.min(1400, (w.__lp.gap - gap) / ((now - w.__lp.t) / 1000)));
          w.__lp = { gap, t: now };
          w.__lv = v;
          const tc = (gap - 30) / v;
          return tc > 0 && tc < 0.3;
        };
        w.__bot.minHearts = Math.min(w.__bot.minHearts, s.hearts);
        // What hit us (for diagnosing an unfair attack).
        if (w.__lastHearts !== undefined && s.hearts < w.__lastHearts) {
          (w.__bot.hurt ??= []).push({ by: s.lastHurtBy, ph: s.bossPhase, a: s.bossAttack?.kind, open: s.bossVulnerable, sx: Math.round(s.screenX), bx: Math.round(s.bossScreenX ?? 0), h: Math.round(s.height), hz: s.hazardsAhead.filter((z) => z.dx > -150 && z.dx < 150).map((z) => [z.dx, z.w, z.bottom, z.top]) });
        }
        w.__lastHearts = s.hearts;
        const bark = () => {
          if (s.barkCooldown > 0) return;
          input.touchDown('bark', 78);
          input.touchUp(78);
          w.__bot.barks++;
        };
        // Bark anything in reach (rollers, crumbs).
        // Bark anything in reach, whichever way the dog faces.
        const f = s.facing ?? 1;
        const inReach = (t) => (f > 0 ? t.dx < 50 + s.barkRange && t.dx + (t.w ?? 40) > 60 : t.dx + (t.w ?? 40) > -(50 + s.barkRange) && t.dx < -60);
        const reach = s.barkTargetsAhead.find((t) => inReach(t) && t.bottom < s.height + 105 && t.top > s.height - 15);
        if (reach) bark();
        // The arena: read the boss's warning, keep clear of marked spots, and run
        // in to bark while its guard is down. Duck the high lane; jump the low one.
        const a = s.bossAttack;
        let mx = 0;
        let duck = false;
        const bx = s.bossScreenX ?? 660;
        // Armoured while attacking: keep to the middle, away from it. When it is
        // dazed (stars, BARK NOW!) rush in and bark.
        const open = !!s.bossVulnerable;
        const side = s.screenX > bx ? 1 : -1;
        // Every bark lands now: stay just in reach and keep barking.
        const want = Math.max(110, Math.min(1170, bx + side * (open ? 160 : 230)));
        if (Math.abs(s.screenX - bx) < 260) bark();
        if (a && a.kind === 'slam') {
          // Clear the landing spot toward the roomier side.
          const tx = a.targetX - (s.x - s.screenX);
          mx = Math.abs(s.screenX - tx) > (a.reach ?? 150) + 70 ? 0 : tx > 640 ? -1 : 1;
        } else if (a && (a.kind === 'volley' || a.kind === 'drop' || a.kind === 'geyser')) {
          const tx = a.targetX - (s.x - s.screenX);
          mx = Math.abs(s.screenX - tx) > 200 || s.screenX < 110 ? 0 : tx > s.screenX ? -1 : s.screenX < want - 40 ? 1 : -1;
        } else mx = s.screenX < want - 30 ? 1 : s.screenX > want + 30 ? -1 : 0;
        // Step off any red marker (lobbed shots, drops, steam vents) unless dodging a slam.
        if (!(a && a.kind === 'slam')) {
          const mark = (s.dangers ?? []).find((d) => Math.abs(d.dx) < d.w / 2 + 55);
          if (mark) {
            mx = mark.dx > 0 ? -1 : 1;
            if (mx < 0 && s.screenX < 140) mx = 1;
            if (mx > 0 && s.screenX > 1140) mx = -1;
          }
        }
        if (a && a.height === 'high') duck = true;
        // Duck-height things from either side (the boss can be on the left or right).
        const near = (h, r) => (h.dx > -40 && h.dx < r) || (h.dx + h.w < 40 && h.dx + h.w > -r);
        const glider = duck || s.hazardsAhead.find((h) => h.bottom > 18 && h.bottom < 70 && near(h, 200));
        // Something in the air lane: stay on the ground.
        const airNear = s.hazardsAhead.some((h) => h.bottom > 100 && h.bottom < 190 && near(h, 260));
        if (glider && s.grounded && holdUntil === 0) {
          input.setStick(0, 0.95, true);
          w.__duck = true;
        } else {
          input.setStick(mx, 0, mx !== 0);
          w.__duck = false;
        }
        if (closing(s, now) && s.grounded && holdUntil === 0 && !w.__duck && !airNear) {
          input.touchDown('jump', 77);
          holdUntil = now + 380;
          w.__bot.jumps++;
        }
        if (holdUntil && now > holdUntil) {
          input.touchUp(77);
          holdUntil = 0;
        }
        if (s.phase !== 'victory' && s.phase !== 'defeat') requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    let fightSecs = 0;
    {
      const t0 = Date.now();
      while (Date.now() - t0 < 420000 && !(await scenes(page)).includes('Results')) {
        await keepRunning(page);
        await sleep(4000);
      }
      fightSecs = Math.round((Date.now() - t0) / 1000);
    }
    const sc = await scenes(page);
    const bot = await page.evaluate(() => ({ ...window.__bot, end: (({ phase, bossPhase, bossHits, bossVulnerable, screenX, height, grounded }) => ({ phase, bossPhase, bossHits, bossVulnerable, screenX, height, grounded }))(window.__HH__.game?.() ?? {}) }));
    await page.screenshot({ path: `screenshots/11-boss-${fin.chapter}.png` });
    writeFileSync(`screenshots/11-boss-${fin.chapter}.json`, JSON.stringify(bot, null, 1));
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('homeward-hound.progress')));
    check(`Level ${fin.chapter} boss ${fin.name} is beatable at base stats without god mode`, sc.includes('Results') && saved.checkpoint === null && saved.completedChapters.includes(fin.chapter), `${fightSecs}s wall, scenes=${sc} bot=${JSON.stringify(bot)}`);
  }
  await page.close();
  }

  if (!process.env.BOSSES) {
  // ---------------------------------------------------------------- retries do not leak
  page = await newPage();
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('homeward-hound.progress') ?? '{}');
    p.storySeen = true;
    p.checkpoint = { chapter: 1, at: 'encounter' };
    localStorage.setItem('homeward-hound.progress', JSON.stringify(p));
  });
  await page.reload();
  await waitScene(page, 'Title');
  const listenerCounts = [];
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => {
      // Restart the game scene directly (equivalent to pressing Try Again).
      const mgr = window.__HH__.manager?.();
      mgr?.start('Game', { chapter: 1, startAt: 'encounter' });
    });
    await waitScene(page, 'Game');
    await sleep(700);
    listenerCounts.push(await page.evaluate(() => window.__HH__.listeners?.()));
  }
  const s10 = await state(page);
  check('checkpoint retry starts at the encounter', s10?.phase === 'encounter', s10?.phase);
  const growth = Object.keys(listenerCounts[1]).filter((k) => listenerCounts[9][k] > listenerCounts[1][k]);
  check('ten retries do not accumulate listeners or objects', growth.length === 0, listenerCounts.map((c) => Object.values(c).join('/')).join(' '));
  check('ten retries do not accumulate entities', s10.entities < 40, `entities=${s10.entities}`);
  await page.close();
  }
} catch (e) {
  check('browser run completed without exceptions', false, String(e));
} finally {
  check('no page errors or console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
  await browser.close();
  server.kill();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
