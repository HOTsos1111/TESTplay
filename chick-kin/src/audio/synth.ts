// TEMP synthesized sound sources. Every buffer here is placeholder audio generated in code, labelled
// TEMP in the cue manifest; final recorded/composed assets replace them through the same cue names.

export type BufferFn = (ctx: BaseAudioContext, v: number) => AudioBuffer;

const SR = 44100;
function buf(ctx: BaseAudioContext, seconds: number, fill: (t: number, i: number, n: number) => number) {
  const n = Math.max(1, Math.floor(seconds * SR));
  const b = ctx.createBuffer(1, n, SR);
  const d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = fill(i / SR, i, n);
  // gentle fade edges (no clicks)
  const f = Math.min(200, n >> 2);
  for (let i = 0; i < f; i++) { d[i] *= i / f; d[n - 1 - i] *= i / f; }
  return b;
}
let seed = 12345;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const noise = () => rnd() * 2 - 1;
const env = (t: number, a: number, d: number) => (t < a ? t / a : Math.exp(-(t - a) / d));

/** One-pole lowpass helper over a generator. */
function lp(alpha: number) { let y = 0; return (x: number) => (y += alpha * (x - y)); }

export const SYNTH: Record<string, BufferFn> = {
  // ---- chick voices (class signatures: Speedy bright/quick, Mighty lower/rounder, Nimble light trill)
  peep: (c, v) => { const f0 = 1900 + v * 260; return buf(c, 0.16, (t) => Math.sin(2 * Math.PI * (f0 * t + 900 * t * t * (v % 2 ? -1 : 1) * 4)) * env(t, 0.008, 0.05) * 0.5); },
  chirrup: (c, v) => { const f0 = 900 + v * 90; return buf(c, 0.24, (t) => Math.sin(2 * Math.PI * f0 * t + 3 * Math.sin(2 * Math.PI * 28 * t)) * env(t, 0.015, 0.08) * 0.55); },
  trill: (c, v) => { const f0 = 2400 + v * 180; return buf(c, 0.28, (t) => Math.sin(2 * Math.PI * f0 * t + 6 * Math.sin(2 * Math.PI * 34 * t)) * env(t, 0.01, 0.1) * 0.35 * (0.6 + 0.4 * Math.sin(2 * Math.PI * 17 * t))); },
  // ---- movement
  step: (c, v) => { const g = lp(0.15 + v * 0.05); return buf(c, 0.07, (t) => g(noise()) * env(t, 0.002, 0.015) * 1.6); },
  stepWood: (c, v) => { const f = 180 + v * 30; return buf(c, 0.08, (t) => (Math.sin(2 * Math.PI * f * t) * 0.6 + noise() * 0.2) * env(t, 0.002, 0.02)); },
  stepMud: (c, v) => { const g = lp(0.05); return buf(c, 0.16, (t) => g(noise()) * Math.sin(2 * Math.PI * (60 + v * 10) * t) * env(t, 0.01, 0.05) * 4); },
  whoosh: (c, v) => { const g = lp(0.08 + v * 0.02); return buf(c, 0.3, (t) => g(noise()) * Math.sin(Math.PI * Math.min(1, t / 0.3)) * 1.2); },
  wingbeat: (c, v) => { const g = lp(0.12); return buf(c, 0.12, (t) => g(noise()) * env(t, 0.01, 0.03 + v * 0.005) * 2); },
  land: (c, v) => { const g = lp(0.06); return buf(c, 0.14, (t) => (g(noise()) * 1.5 + Math.sin(2 * Math.PI * (90 + v * 15) * t) * 0.5) * env(t, 0.002, 0.04)); },
  // ---- interactions
  peck: (c, v) => buf(c, 0.06, (t) => (Math.sin(2 * Math.PI * (1400 + v * 150) * t) * 0.4 + noise() * 0.5) * env(t, 0.001, 0.012)),
  straw: (c, v) => { const g = lp(0.4); return buf(c, 0.25 + v * 0.03, (t) => g(noise()) * (rnd() < 0.3 ? 1 : 0.3) * env(t, 0.005, 0.08)); },
  thud: (c, v) => buf(c, 0.22, (t) => Math.sin(2 * Math.PI * (70 + v * 8) * t * (1 - t)) * env(t, 0.003, 0.07) * 0.9),
  scrape: (c, v) => { const g = lp(0.1); return buf(c, 0.3, (t) => g(noise()) * (0.5 + 0.5 * Math.sin(2 * Math.PI * (30 + v * 5) * t)) * 0.8); },
  creak: (c, v) => buf(c, 0.45, (t) => Math.sin(2 * Math.PI * (210 + 60 * Math.sin(t * 9 + v)) * t) * (0.5 + 0.5 * Math.sin(2 * Math.PI * 45 * t)) * env(t, 0.05, 0.15) * 0.3),
  squelch: (c, v) => { const g = lp(0.05); return buf(c, 0.25, (t) => g(noise()) * Math.sin(2 * Math.PI * (40 + 80 * t + v * 5) * t) * env(t, 0.01, 0.08) * 5); },
  rustle: (c, v) => { const g = lp(0.25); return buf(c, 0.3, (t) => g(noise()) * env(t, 0.03, 0.09 + v * 0.01) * 0.9); },
  boing: (c, v) => buf(c, 0.4, (t) => Math.sin(2 * Math.PI * (220 + 180 * Math.sin(t * 18)) * t + v) * env(t, 0.005, 0.12) * 0.5),
  squeak: (c, v) => buf(c, 0.2, (t) => Math.sin(2 * Math.PI * (900 + 500 * t + v * 40) * t) * env(t, 0.01, 0.06) * 0.35),
  gate: (c, v) => buf(c, 0.35, (t) => (Math.sin(2 * Math.PI * (160 + v * 10) * t) * 0.4 + noise() * 0.15) * env(t, 0.005, 0.1)),
  basket: (c, v) => { const g = lp(0.3); return buf(c, 0.25, (t) => g(noise()) * env(t, 0.005, 0.06) * (0.7 + v * 0.05)); },
  // ---- abilities
  zoomies: (c) => { const g = lp(0.2); return buf(c, 0.55, (t) => g(noise()) * Math.sin(Math.PI * Math.min(1, t / 0.55)) * 1.1 + Math.sin(2 * Math.PI * (600 + 900 * t) * t) * 0.08 * env(t, 0.01, 0.2)); },
  fluffbump: (c) => buf(c, 0.35, (t) => (Math.sin(2 * Math.PI * 85 * t) * 0.8 + lpNoise(t) * 0.3) * env(t, 0.004, 0.09)),
  fancy: (c) => buf(c, 0.4, (t) => Math.sin(2 * Math.PI * (1200 + 1600 * t) * t) * env(t, 0.01, 0.12) * 0.3 + noise() * 0.1 * env(t, 0.01, 0.1)),
  ready: (c) => buf(c, 0.35, (t) => (Math.sin(2 * Math.PI * 1318 * t) + Math.sin(2 * Math.PI * 1760 * t) * (t > 0.08 ? 1 : 0)) * env(t, 0.005, 0.1) * 0.25),
  // ---- obstacles
  roll: (c, v) => { const g = lp(0.03); return buf(c, 0.5, (t) => g(noise()) * (1 + 0.5 * Math.sin(2 * Math.PI * (8 + v) * t)) * 2); },
  bonk: (c, v) => buf(c, 0.2, (t) => Math.sin(2 * Math.PI * (300 - 600 * t + v * 20) * t) * env(t, 0.002, 0.05) * 0.6),
  windwarn: (c) => { const g = lp(0.04); return buf(c, 0.9, (t) => g(noise()) * Math.sin(Math.PI * t / 0.9) * 2.5); },
  // ---- collectibles (rapid pickups ascend in pitch, bounded)
  crumb: (c, v) => buf(c, 0.12, (t) => (Math.sin(2 * Math.PI * (1046 * Math.pow(2, v / 12)) * t) * 0.5 + noise() * 0.06) * env(t, 0.002, 0.03)),
  worm: (c, v) => buf(c, 0.3, (t) => Math.sin(2 * Math.PI * (600 + 400 * Math.sin(t * 30) + v * 30) * t) * env(t, 0.01, 0.08) * 0.35),
  feather: (c) => buf(c, 0.9, (t) => [1, 1.5, 2, 2.5].reduce((s, k, i) => s + Math.sin(2 * Math.PI * 1046 * k * t) * env(t - i * 0.06, 0.005, 0.25) * (t > i * 0.06 ? 1 : 0), 0) * 0.15),
  husk: (c, v) => { const g = lp(0.5); return buf(c, 0.22, (t) => g(noise()) * (rnd() < 0.5 ? 1 : 0.2) * env(t, 0.005, 0.07 + v * 0.01) * 0.8); },
  power: (c, v) => buf(c, 0.5, (t) => (Math.sin(2 * Math.PI * (523 * Math.pow(2, Math.floor(t * 12) / 12 + v / 12)) * t)) * env(t, 0.005, 0.18) * 0.3),
  shieldbreak: (c) => buf(c, 0.4, (t) => (Math.sin(2 * Math.PI * 2093 * t) * 0.3 + noise() * 0.2) * env(t, 0.002, 0.1)),
  expire: (c) => buf(c, 0.3, (t) => Math.sin(2 * Math.PI * (880 - 400 * t) * t) * env(t, 0.005, 0.1) * 0.25),
  // ---- competition
  count: (c) => buf(c, 0.2, (t) => Math.sin(2 * Math.PI * 660 * t) * env(t, 0.003, 0.08) * 0.4),
  bell: (c) => buf(c, 1.2, (t) => [1, 2.76, 5.4].reduce((s, k, i) => s + Math.sin(2 * Math.PI * 880 * k * t) * Math.exp(-t * (3 + i * 2)) / (i + 1), 0) * 0.35),
  checkpoint: (c) => buf(c, 0.45, (t) => (Math.sin(2 * Math.PI * 784 * t) + Math.sin(2 * Math.PI * 1175 * t) * (t > 0.1 ? 1 : 0)) * env(t, 0.005, 0.15) * 0.2),
  claim: (c) => buf(c, 0.4, (t) => Math.sin(2 * Math.PI * (523 + (t > 0.12 ? 261 : 0)) * t) * env(t, 0.005, 0.15) * 0.3),
  lost: (c) => buf(c, 0.4, (t) => Math.sin(2 * Math.PI * (523 - (t > 0.12 ? 131 : 0)) * t) * env(t, 0.005, 0.15) * 0.25),
  tick: (c) => buf(c, 0.06, (t) => noise() * env(t, 0.001, 0.008) * 0.5),
  fanfare: (c) => buf(c, 1.6, (t) => { const notes = [523, 659, 784, 1046]; const i = Math.min(3, Math.floor(t / 0.16)); const f = notes[i]; return (Math.sin(2 * Math.PI * f * t) * 0.5 + Math.sin(2 * Math.PI * f * 2 * t) * 0.15) * env(t - i * 0.16, 0.01, i === 3 ? 0.5 : 0.1) * 0.35; }),
  nearmiss: (c) => buf(c, 1.0, (t) => { const notes = [523, 494, 440]; const i = Math.min(2, Math.floor(t / 0.22)); return Math.sin(2 * Math.PI * notes[i] * t) * env(t - i * 0.22, 0.01, 0.2) * 0.3; }),
  // ---- UI
  uiFocus: (c, v) => buf(c, 0.05, (t) => Math.sin(2 * Math.PI * (1200 + v * 60) * t) * env(t, 0.002, 0.012) * 0.25),
  uiConfirm: (c) => buf(c, 0.25, (t) => (Math.sin(2 * Math.PI * 784 * t) + Math.sin(2 * Math.PI * 1046 * t) * (t > 0.07 ? 1 : 0)) * env(t, 0.003, 0.08) * 0.25),
  uiBack: (c) => buf(c, 0.18, (t) => Math.sin(2 * Math.PI * (700 - 300 * t) * t) * env(t, 0.003, 0.06) * 0.25),
  uiDenied: (c) => buf(c, 0.2, (t) => Math.sin(2 * Math.PI * 220 * t) * env(t, 0.003, 0.06) * 0.25),
  saved: (c) => buf(c, 0.3, (t) => Math.sin(2 * Math.PI * 1568 * t) * env(t, 0.003, 0.1) * 0.12),
  // ---- growth / hatch
  bloom: (c) => buf(c, 2.2, (t) => [0, 4, 7, 12, 16].reduce((s, k, i) => s + Math.sin(2 * Math.PI * 392 * Math.pow(2, k / 12) * t) * env(t - i * 0.18, 0.02, 0.6) * (t > i * 0.18 ? 1 : 0), 0) * 0.14 + lpNoise(t) * 0.05 * Math.sin(Math.PI * t / 2.2)),
  crack: (c, v) => buf(c, 0.12, (t) => noise() * env(t, 0.001, 0.02 + v * 0.005) * 0.8),
};

let lpState = 0;
function lpNoise(_t: number) { lpState += 0.1 * (noise() - lpState); return lpState * 3; }
