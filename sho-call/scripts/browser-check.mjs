// End-to-end browser check of the showcase walkthrough with two real browser
// contexts (Director laptop + Audio phone), plus responsive and accessibility
// smoke checks. Requires `npm run build` first and a Chromium binary
// (CHROME=/path/to/chrome, or Playwright's default location).
//
//   npm run build && npm run check:browser
//
// Screenshots are written to screenshots/.

import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const PORT = Number(process.env.CHECK_PORT ?? 8797);
const BASE = `http://localhost:${PORT}`;
const OUT = 'screenshots';
mkdirSync(OUT, { recursive: true });

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
  if (!existsSync(root)) return undefined;
  const dir = readdirSync(root).find((d) => d.startsWith('chromium-'));
  return dir ? join(root, dir, 'chrome-linux', 'chrome') : undefined;
}

if (!existsSync('dist/index.html')) {
  console.error('dist/ is missing: run `npm run build` first.');
  process.exit(1);
}

const dataDir = mkdtempSync(join(tmpdir(), 'sho-call-browser-'));
const server = spawn(process.execPath, ['server/index.ts'], {
  env: { ...process.env, PORT: String(PORT), DATABASE_PATH: join(dataDir, 'check.db'), NODE_ENV: 'production', DEMO_LOGIN: 'true' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.stderr.on('data', (d) => {
  const t = String(d);
  if (!t.includes('ExperimentalWarning') && !t.includes('trace-warnings')) process.stderr.write(t);
});

const results = [];
let failed = 0;
async function step(name, fn) {
  try {
    await fn();
    results.push(`  ok   ${name}`);
  } catch (e) {
    failed++;
    results.push(`  FAIL ${name}\n       ${String(e?.message ?? e).split('\n')[0]}`);
  }
}
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`${BASE}/healthz`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('server did not start');
}

async function login(ctx, email) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => results.push(`  page error (${email}): ${e.message}`));
  await page.goto(`${BASE}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('showcall-demo');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  return page;
}

async function noHorizontalOverflow(page, label) {
  const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  assert(sw <= iw + 1, `${label}: page scrolls horizontally (${sw}px > ${iw}px)`);
}

async function a11ySmoke(page, label) {
  const problems = await page.evaluate(() => {
    const out = [];
    for (const b of document.querySelectorAll('button, a[href]')) {
      const name = (b.getAttribute('aria-label') || b.textContent || '').trim();
      if (!name && !b.querySelector('img[alt]:not([alt=""])')) out.push(`unnamed ${b.tagName.toLowerCase()} ${b.outerHTML.slice(0, 80)}`);
    }
    for (const i of document.querySelectorAll('input:not([type=hidden]), select, textarea')) {
      const labelled = i.getAttribute('aria-label') || i.closest('label') || (i.id && document.querySelector(`label[for="${i.id}"]`)) || i.getAttribute('aria-labelledby');
      if (!labelled && !i.classList.contains('sr-only')) out.push(`unlabelled ${i.tagName.toLowerCase()} ${i.outerHTML.slice(0, 80)}`);
    }
    for (const img of document.querySelectorAll('img')) if (!img.hasAttribute('alt')) out.push('img without alt');
    if (!document.querySelector('main')) out.push('no <main> landmark');
    return out;
  });
  assert(problems.length === 0, `${label}: ${problems.slice(0, 3).join('; ')}`);
}

try {
  await waitForServer();
  const browser = await chromium.launch({ executablePath: findChrome() });
  const dCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const aCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });

  const login0 = await dCtx.newPage();
  await login0.goto(`${BASE}/login`);
  await step('login page renders with brand and demo accounts', async () => {
    await login0.getByRole('img', { name: 'Sho Call' }).waitFor();
    await login0.getByRole('button', { name: 'Director' }).waitFor();
    await a11ySmoke(login0, 'login');
    await login0.screenshot({ path: `${OUT}/01-login.png` });
  });
  await step('invalid credentials show a recoverable error', async () => {
    await login0.getByLabel('Email').fill('director@summit-live.example');
    await login0.getByLabel('Password').fill('wrong-password');
    await login0.getByRole('button', { name: 'Sign in' }).click();
    await login0.getByRole('alert').filter({ hasText: 'do not match' }).waitFor();
  });
  await login0.close();

  const d = await login(dCtx, 'director@summit-live.example');
  await step('dashboard lists Summit Live and the template', async () => {
    await d.getByRole('heading', { name: 'Summit Live' }).waitFor();
    await d.getByText('Conference general session (template)').waitFor();
    await a11ySmoke(d, 'dashboard');
    await d.screenshot({ path: `${OUT}/02-dashboard.png` });
  });

  await d.goto(`${BASE}/`);
  await d.getByRole('link', { name: 'Director console' }).first().click();
  await d.locator('.focus-card').waitFor();

  const a = await login(aCtx, 'audio@summit-live.example');
  await a.getByRole('link', { name: 'Crew view' }).first().click();
  await a.locator('.cue-card.current').waitFor();

  await step('crew phone view identifies Audio with icon and label; no Director controls', async () => {
    await a.locator('.identity-label', { hasText: 'Audio' }).waitFor();
    assert((await a.getByRole('button', { name: /^Go/ }).count()) === 0, 'Go button visible to operator');
    await noHorizontalOverflow(a, 'crew phone');
    await a11ySmoke(a, 'crew phone');
  });

  await step('Director console starts read-only and takes control explicitly', async () => {
    await d.getByText('Read-only console').waitFor();
    assert(await d.getByRole('button', { name: /^Go/ }).isDisabled(), 'Go enabled before taking control');
    await d.getByRole('button', { name: 'Take control here…' }).click();
    await d.getByRole('dialog').getByRole('button', { name: 'Take control' }).click();
    await d.getByText('Read-only console').waitFor({ state: 'detached' });
    await d.screenshot({ path: `${OUT}/03-director-desktop.png` });
  });

  await step('Standby via keyboard (S) alerts the Audio operator', async () => {
    await d.locator('body').press('s');
    await d.locator('.focus-card .chip-standby').first().waitFor();
    await a.locator('.alert-standby').waitFor({ timeout: 5000 });
  });

  await step('Audio marks Ready and the Director sees it', async () => {
    await a.getByRole('button', { name: 'Ready', exact: true }).click();
    await d.locator('.focus-card .chip-ready').first().waitFor({ timeout: 5000 });
  });

  await step('Go on the linked opening (G) reaches the crew as one call', async () => {
    await d.locator('body').press('g');
    await d.locator('.focus-card .chip-called').first().waitFor();
    await a.locator('.alert-go').waitFor({ timeout: 5000 });
    await a.screenshot({ path: `${OUT}/04-audio-phone-go.png` });
    const goEvents = await d.locator('.activity li', { hasText: 'Go: Q-Link House open' }).count();
    assert(goEvents === 1, `expected one Go event, saw ${goEvents}`);
  });

  await step('pressing G again does not issue a second Go', async () => {
    await d.locator('body').press('g');
    await d.waitForTimeout(400);
    const goEvents = await d.locator('.activity li', { hasText: 'Go:' }).count();
    assert(goEvents === 1, `second G issued another Go (${goEvents} Go events)`);
    await d.locator('.focus-card', { hasText: 'House open' }).waitFor();
  });

  await step('keyboard shortcuts do not fire while typing in a field', async () => {
    await d.locator('body').press('n');
    const armedBefore = await d.locator('.focus-num').innerText();
    await d.getByRole('button', { name: 'Live edit' }).click();
    await d.getByRole('button', { name: 'Edit instructions' }).click();
    await d.getByLabel('Find cue').fill('gsgn');
    await d.keyboard.press('Escape');
    const armedAfter = await d.locator('.focus-num').innerText();
    assert(armedBefore === armedAfter, 'armed target changed while typing');
    const standbys = await d.locator('.activity li', { hasText: /^.*Standby:/ }).count();
    assert(standbys === 1, `unexpected standby events: ${standbys}`);
  });

  await step('independent cue can be called on its own', async () => {
    await d.locator('tr[data-call-id]', { hasText: 'Sponsor message bed' }).click();
    await d.locator('.focus-card', { hasText: 'Sponsor message bed' }).waitFor();
    await d.getByRole('button', { name: /^Go/ }).click();
    await d.locator('.activity li', { hasText: 'Go: Audio 021' }).waitFor();
  });

  await step('Director moves the panel earlier and applies +05:00; crew sees the revision', async () => {
    await d.getByRole('button', { name: 'Live edit' }).click();
    await d.getByRole('button', { name: 'Move Panel: The future of live events up' }).click();
    await d.getByRole('button', { name: 'Adjust timing' }).click();
    await d.getByRole('button', { name: '+05:00' }).click();
    await d.getByText(/upcoming estimates \+05:00/).waitFor();
    await d.screenshot({ path: `${OUT}/05-director-live-edit.png` });
    await d.getByRole('button', { name: 'Apply changes' }).click();
    await d.getByRole('dialog').waitFor({ state: 'detached' });
    await a.locator('.banner-revision', { hasText: 'Panel' }).waitFor({ timeout: 5000 });
    await a.locator('.banner-revision', { hasText: '+05:00' }).waitFor();
    await d.locator('.banner-revision').waitFor();
  });

  await step('Undo applies a compensating revision and keeps earlier calls', async () => {
    await d.getByRole('button', { name: 'Undo' }).first().click();
    await d.locator('.activity li', { hasText: 'Undo revision' }).waitFor({ timeout: 5000 });
    const goEvents = await d.locator('.activity li', { hasText: 'Go: Q-Link House open' }).count();
    assert(goEvents === 1, 'Go history changed after undo');
  });

  await step('crew filters to Lighting, then expands Audio context (personal only)', async () => {
    const t = await browser.newContext({ viewport: { width: 1180, height: 820 } });
    const lx = await login(t, 'lighting@summit-live.example');
    await lx.goto(`${BASE}/shows/${d.url().split('/')[4]}/crew`);
    await lx.locator('.identity-label', { hasText: 'Lighting' }).waitFor();
    await lx.getByRole('button', { name: /Audio/ }).first().click();
    await lx.locator('.identity-label', { hasText: 'Lighting + Audio' }).waitFor();
    await lx.screenshot({ path: `${OUT}/06-lighting-tablet-landscape.png` });
    await noHorizontalOverflow(lx, 'crew tablet');
    // The Director's view is unaffected by the operator's filter.
    assert(!(await d.locator('.segmented [aria-pressed="true"]', { hasText: 'Audio' }).count()), 'director filter changed');
    await t.close();
  });

  await step('history review pauses follow and offers Return to Live', async () => {
    await d.locator('.ro-scroll').hover();
    await d.mouse.wheel(0, -2000);
    await d.getByRole('button', { name: /Return to Live/ }).waitFor();
    await d.locator('body').press('f');
    await d.getByRole('button', { name: /Return to Live/ }).waitFor({ state: 'detached' });
  });

  await step('crew going offline shows stale state and disables actions; reconnect recovers', async () => {
    await aCtx.setOffline(true);
    await a.locator('.banner-offline').waitFor({ timeout: 5000 });
    await a.getByText(/Offline — showing revision/).waitFor();
    assert(await a.getByRole('button', { name: 'Ready', exact: true }).isDisabled(), 'Ready enabled while offline');
    await a.screenshot({ path: `${OUT}/07-audio-phone-offline.png` });
    // Director keeps working while the crew device is offline.
    await d.getByRole('button', { name: 'Arm next' }).click();
    await aCtx.setOffline(false);
    await a.locator('.conn-connected').waitFor({ timeout: 15000 });
    await a.locator('.banner-offline').waitFor({ state: 'detached' });
  });

  await step('Director presets: Compact and Expanded render', async () => {
    await d.locator('body').press('3');
    await d.locator('.density-compact').waitFor();
    await d.locator('body').press('4');
    await d.locator('.dept-cells').first().waitFor();
    await d.screenshot({ path: `${OUT}/08-director-expanded.png` });
    await d.locator('body').press('1');
    await a11ySmoke(d, 'director console');
  });

  for (const [w, h, name] of [
    [390, 844, 'phone'],
    [820, 1180, 'tablet-portrait'],
    [1180, 820, 'tablet-landscape'],
  ]) {
    await step(`Director console has no horizontal scroll at ${name}`, async () => {
      await d.setViewportSize({ width: w, height: h });
      await d.waitForTimeout(200);
      await noHorizontalOverflow(d, `director ${name}`);
      await d.screenshot({ path: `${OUT}/09-director-${name}.png` });
    });
  }
  await d.setViewportSize({ width: 1440, height: 900 });

  await step('viewer has no enabled calling or readiness controls', async () => {
    const v = await browser.newContext({ viewport: { width: 1024, height: 768 } });
    const vp = await login(v, 'viewer@summit-live.example');
    await vp.goto(`${BASE}/shows/${d.url().split('/')[4]}/console`);
    await vp.locator('.focus-card').waitFor();
    const go = vp.getByRole('button', { name: /^Go/ });
    assert((await go.count()) === 0 || (await go.isDisabled()), 'viewer has an enabled Go button');
    await vp.goto(`${BASE}/shows/${d.url().split('/')[4]}/crew`);
    await vp.getByText('View only').first().waitFor();
    assert(await vp.getByRole('button', { name: 'Ready', exact: true }).isDisabled(), 'viewer can send readiness');
    await v.close();
  });

  await step('Show Designer renders the running order with Q-Links', async () => {
    await d.goto(`${BASE}/shows/${d.url().split('/')[4]}/designer`);
    await d.locator('.designer-seg').first().waitFor();
    await d.locator('.qlink').first().waitFor();
    await d.locator('.dcue').nth(1).click();
    await d.getByLabel('Instruction').waitFor();
    await a11ySmoke(d, 'designer');
    await d.screenshot({ path: `${OUT}/10-designer.png` });
  });

  await step('Add cue asks for departments; ALL creates one linked cue per department', async () => {
    const before = await d.locator('.dcue').count();
    const depts = await d.locator('.toolbar .segmented button').count() - 1;
    await d.getByRole('button', { name: 'Add cue' }).click();
    const dlg = d.getByRole('dialog');
    assert(await dlg.getByRole('button', { name: /^Add cue/ }).isDisabled(), 'Add enabled with no departments chosen');
    await dlg.getByRole('button', { name: 'ALL', exact: true }).click();
    await d.screenshot({ path: `${OUT}/12-designer-add-cue.png` });
    await dlg.getByRole('button', { name: `Add cue for ${depts} departments` }).click();
    await dlg.waitFor({ state: 'detached' });
    const after = await d.locator('.dcue').count();
    assert(after === before + depts, `expected ${depts} new cues, got ${after - before}`);
  });

  await step('Import: sample CSV preview, mapping and review', async () => {
    await d.goto(`${BASE}/import`);
    const csv = await (await fetch(`${BASE}/sample-run-of-show.csv`)).text();
    await d.locator('#import-file').setInputFiles({ name: 'sample-run-of-show.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await d.getByRole('heading', { name: '4. Review' }).waitFor();
    await d.getByText(/No blocking problems/).waitFor();
    await d.screenshot({ path: `${OUT}/11-import-review.png`, fullPage: true });
    await d.getByRole('button', { name: /Confirm import/ }).click();
    await d.waitForURL(/designer/);
    await d.locator('.designer-seg').first().waitFor();
  });

  await browser.close();
} catch (e) {
  failed++;
  results.push(`  FAIL setup: ${e?.message ?? e}`);
} finally {
  server.kill();
  rmSync(dataDir, { recursive: true, force: true });
}

console.log('Browser check');
console.log(results.join('\n'));
console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
