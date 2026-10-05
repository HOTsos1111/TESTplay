// Procedural canvas textures (TEMP production art): wood, straw, dirt, grass, feathers, sky.
// Generated once at boot and cached; deterministic so screenshots are stable.
import * as THREE from 'three';
import { makeRng } from '../sim/math';

const cache = new Map<string, THREE.Texture>();

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')!] as const;
}

function finish(key: string, c: HTMLCanvasElement, repeat = 1, color = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
function shade(col: number, k: number) {
  const r = Math.min(255, Math.max(0, ((col >> 16) & 255) * k)), g = Math.min(255, Math.max(0, ((col >> 8) & 255) * k)), b = Math.min(255, Math.max(0, (col & 255) * k));
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

export function woodTex(base = 0xb07a45, planks = 4, key = 'wood'): THREE.Texture {
  const k = `${key}:${base}:${planks}`;
  if (cache.has(k)) return cache.get(k)!;
  const [c, x] = canvas(256, 256);
  const rng = makeRng(base + planks);
  const ph = 256 / planks;
  for (let p = 0; p < planks; p++) {
    x.fillStyle = shade(base, 0.9 + rng.next() * 0.2);
    x.fillRect(0, p * ph, 256, ph);
    for (let i = 0; i < 26; i++) {
      x.strokeStyle = shade(base, 0.7 + rng.next() * 0.25);
      x.globalAlpha = 0.25 + rng.next() * 0.3;
      x.lineWidth = 0.6 + rng.next() * 1.4;
      const y0 = p * ph + rng.next() * ph;
      x.beginPath();
      x.moveTo(0, y0);
      for (let s = 0; s <= 8; s++) x.lineTo(s * 32, y0 + Math.sin(s * 0.9 + rng.next()) * 2.2);
      x.stroke();
    }
    // knots
    if (rng.next() < 0.6) {
      x.globalAlpha = 0.45;
      x.fillStyle = shade(base, 0.55);
      x.beginPath();
      x.ellipse(rng.next() * 256, p * ph + ph / 2, 6 + rng.next() * 5, 3 + rng.next() * 2, 0, 0, Math.PI * 2);
      x.fill();
    }
    x.globalAlpha = 0.6;
    x.fillStyle = shade(base, 0.45);
    x.fillRect(0, p * ph, 256, 2.5);
    x.globalAlpha = 1;
  }
  return finish(k, c);
}

export function strawTex(base = 0xe6b84e, key = 'straw'): THREE.Texture {
  const k = `${key}:${base}`;
  if (cache.has(k)) return cache.get(k)!;
  const [c, x] = canvas(256, 256);
  const rng = makeRng(base);
  x.fillStyle = shade(base, 0.82);
  x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    const px = rng.next() * 256, py = rng.next() * 256, L = 10 + rng.next() * 34, a = -0.5 + rng.next() * 1.0 + (i % 3 === 0 ? Math.PI / 2 : 0);
    x.strokeStyle = shade(base, 0.7 + rng.next() * 0.55);
    x.globalAlpha = 0.6 + rng.next() * 0.4;
    x.lineWidth = 0.8 + rng.next() * 1.8;
    x.beginPath();
    x.moveTo(px, py);
    x.lineTo(px + Math.cos(a) * L, py + Math.sin(a) * L);
    x.stroke();
  }
  x.globalAlpha = 1;
  return finish(k, c);
}

export function dirtTex(base = 0x8a6236, key = 'dirt'): THREE.Texture {
  const k = `${key}:${base}`;
  if (cache.has(k)) return cache.get(k)!;
  const [c, x] = canvas(256, 256);
  const rng = makeRng(base + 3);
  x.fillStyle = shade(base, 1);
  x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) {
    x.fillStyle = shade(base, 0.7 + rng.next() * 0.6);
    x.globalAlpha = 0.25 + rng.next() * 0.5;
    const r = 0.6 + rng.next() * 2.6;
    x.beginPath(); x.arc(rng.next() * 256, rng.next() * 256, r, 0, Math.PI * 2); x.fill();
  }
  x.globalAlpha = 1;
  return finish(k, c);
}

export function grassTex(base = 0x6aa84a, key = 'grass'): THREE.Texture {
  const k = `${key}:${base}`;
  if (cache.has(k)) return cache.get(k)!;
  const [c, x] = canvas(256, 256);
  const rng = makeRng(base + 9);
  x.fillStyle = shade(base, 0.85);
  x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1600; i++) {
    const px = rng.next() * 256, py = rng.next() * 256;
    x.strokeStyle = shade(base, 0.65 + rng.next() * 0.7);
    x.globalAlpha = 0.5 + rng.next() * 0.5;
    x.lineWidth = 1 + rng.next();
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + rng.range(-2, 2), py - 4 - rng.next() * 6); x.stroke();
  }
  x.globalAlpha = 1;
  return finish(k, c);
}

/** Soft feather-noise used as a bump map on chick bodies for a fluffy, tactile surface. */
export function featherBump(): THREE.Texture {
  const k = 'featherBump';
  if (cache.has(k)) return cache.get(k)!;
  const [c, x] = canvas(256, 256);
  const rng = makeRng(77);
  x.fillStyle = '#808080';
  x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const px = rng.next() * 256, py = rng.next() * 256;
    const L = 4 + rng.next() * 9;
    x.strokeStyle = rng.next() < 0.5 ? '#b8b8b8' : '#505050';
    x.globalAlpha = 0.35;
    x.lineWidth = 1.2;
    x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + 2, py + L * 0.5, px + rng.range(-2, 2), py + L); x.stroke();
  }
  x.globalAlpha = 1;
  return finish(k, c, 3, false);
}

export function radialTex(inner: string, outer: string, key: string): THREE.Texture {
  if (cache.has(key)) return cache.get(key)!;
  const [c, x] = canvas(128, 128);
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner); g.addColorStop(1, outer);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = finish(key, c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export function skyTex(top: string, mid: string, bottom: string, key: string): THREE.Texture {
  if (cache.has(key)) return cache.get(key)!;
  const [c, x] = canvas(16, 256);
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, top); g.addColorStop(0.55, mid); g.addColorStop(1, bottom);
  x.fillStyle = g; x.fillRect(0, 0, 16, 256);
  const t = finish(key, c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** Checkered ribbon / flag texture. */
export function checkerTex(a: string, b: string, n = 8, key = 'checker'): THREE.Texture {
  const k = `${key}:${a}:${b}:${n}`;
  if (cache.has(k)) return cache.get(k)!;
  const [c, x] = canvas(128, 64);
  const s = 128 / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n / 2; j++) {
    x.fillStyle = (i + j) % 2 ? a : b;
    x.fillRect(i * s, j * s, s, s);
  }
  return finish(k, c);
}

export function basketTex(): THREE.Texture {
  const k = 'basket';
  if (cache.has(k)) return cache.get(k)!;
  const [c, x] = canvas(128, 128);
  x.fillStyle = '#a7743d'; x.fillRect(0, 0, 128, 128);
  for (let r = 0; r < 8; r++) for (let q = 0; q < 8; q++) {
    x.fillStyle = (r + q) % 2 ? '#c99254' : '#8a5b2b';
    x.beginPath(); x.ellipse(q * 16 + 8, r * 16 + 8, 7, 5, (r + q) % 2 ? 0.5 : -0.5, 0, Math.PI * 2); x.fill();
  }
  return finish(k, c, 2);
}

export { hex };
