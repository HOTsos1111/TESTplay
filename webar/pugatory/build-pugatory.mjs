// PUGATORY: the pug hero, armed to the teeth, howling while demon cats circle him.
//
//   cd webar/pugatory && npm install && node build-pugatory.mjs
//
// Writes pugatory.glb: one self-contained binary glTF 2.0 file (geometry, materials and animation embedded,
// no textures, no extensions, no decoders needed). Y up, metres, pug faces +Z, standing on the origin.
// One looping clip "Howl" (6 s): idle breathing, wind-up, a big howl with see-through sound rings rippling
// out of his mouth and across the floor, the cats getting blown back, then settling again.

import { Document, NodeIO } from '@gltf-transform/core';
import { dedup, prune, weld, reorder } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';

// ---------------------------------------------------------------- palette
const lin = (hex) =>
  [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map((v) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
const PALETTE = {
  fawn: { c: 0xd9a96b, rough: 0.85 },
  fawnLight: { c: 0xeccb96, rough: 0.85 },
  wrinkle: { c: 0x8a5a32, rough: 0.85 },
  mask: { c: 0x221816, rough: 0.6 },
  nose: { c: 0x141010, rough: 0.2 },
  eyeWhite: { c: 0xf4eee2, rough: 0.15 },
  iris: { c: 0x3b2112, rough: 0.1 },
  pupil: { c: 0x050404, rough: 0.05 },
  shine: { c: 0xffffff, rough: 0.1, emit: 0x666666 },
  mouth: { c: 0x6e1622, rough: 0.5 },
  tongue: { c: 0xe2687a, rough: 0.45 },
  tooth: { c: 0xfff6e6, rough: 0.3 },
  vest: { c: 0x2a282d, rough: 0.8 },
  leather: { c: 0x4a2a1a, rough: 0.6 },
  gunmetal: { c: 0x3b3e45, rough: 0.35, metal: 0.85 },
  steel: { c: 0xb4bac4, rough: 0.22, metal: 1 },
  brass: { c: 0xd1a043, rough: 0.28, metal: 1 },
  hazard: { c: 0xc4161c, rough: 0.45 },
  shell: { c: 0xb51b1b, rough: 0.5 },
  olive: { c: 0x4a5232, rough: 0.6 },
  catFur: { c: 0x2a1838, rough: 0.7 },
  catBelly: { c: 0x4c2b62, rough: 0.75 },
  catInner: { c: 0xa3263c, rough: 0.6 },
  horn: { c: 0xe8d4a6, rough: 0.4 },
  hornTip: { c: 0x2a0c0c, rough: 0.4 },
  catEye: { c: 0xffc23a, rough: 0.2, emit: 0xffa21a },
  wing: { c: 0x6e1022, rough: 0.6, emit: 0x1c0006, double: true },
  wingBone: { c: 0x1c1024, rough: 0.6 },
  spade: { c: 0xc41c28, rough: 0.4, emit: 0x3a0006 },
  howl: { c: 0xffe6b8, rough: 1, emit: 0x8a5a2e, alpha: 0.2, double: true },
};

// ---------------------------------------------------------------- math
const deg = Math.PI / 180;
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul3 = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => mul3(a, 1 / (Math.hypot(...a) || 1));
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const smooth = (t) => ((t = clamp01(t)), t * t * (3 - 2 * t));
const easeOut = (t) => 1 - (1 - clamp01(t)) ** 3;

// affine transform {R (3x3 rows), t}; mat() = T * Rz * Ry * Rx * S
function mat(t = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
  if (typeof s === 'number') s = [s, s, s];
  const [cx, cy, cz] = r.map((a) => Math.cos(a * deg));
  const [sx, sy, sz] = r.map((a) => Math.sin(a * deg));
  const R = [
    [cy * cz, sx * sy * cz - cx * sz, cx * sy * cz + sx * sz],
    [cy * sz, sx * sy * sz + cx * cz, cx * sy * sz - sx * cz],
    [-sy, sx * cy, cx * cy],
  ];
  return { R: R.map((row) => row.map((v, j) => v * s[j])), t: [...t] };
}
const applyR = (m, p) => [0, 1, 2].map((i) => m.R[i][0] * p[0] + m.R[i][1] * p[1] + m.R[i][2] * p[2]);
const apply = (m, p) => add3(applyR(m, p), m.t);
function mul(A, ...rest) {
  // A * B * C ...
  let M = A;
  for (const B of rest) {
    const R = [0, 1, 2].map((i) => [0, 1, 2].map((j) => M.R[i][0] * B.R[0][j] + M.R[i][1] * B.R[1][j] + M.R[i][2] * B.R[2][j]));
    M = { R, t: apply(M, B.t) };
  }
  return M;
}
// frame whose local +Y points along `axis` (lathe shapes are built along Y)
function along(origin, axis, scale = [1, 1, 1], upHint = [0, 0, 1]) {
  if (typeof scale === 'number') scale = [scale, scale, scale];
  const y = norm(axis);
  let x = cross(upHint, y);
  if (Math.hypot(...x) < 1e-4) x = cross([1, 0, 0], y);
  x = norm(x);
  const z = cross(x, y);
  const R = [0, 1, 2].map((i) => [x[i] * scale[0], y[i] * scale[1], z[i] * scale[2]]);
  return { R, t: [...origin] };
}
function quatFromEuler(x, y, z) {
  const [hx, hy, hz] = [x, y, z].map((a) => (a * deg) / 2);
  const [cx, cy, cz] = [Math.cos(hx), Math.cos(hy), Math.cos(hz)];
  const [sx, sy, sz] = [Math.sin(hx), Math.sin(hy), Math.sin(hz)];
  return [sx * cy * cz - cx * sy * sz, cx * sy * cz + sx * cy * sz, cx * cy * sz - sx * sy * cz, cx * cy * cz + sx * sy * sz];
}

// ---------------------------------------------------------------- shapes
function grid(rows, cols, fn, wrapCols = true) {
  // rows x cols parametric surface -> {pos, idx}; fn(i/(rows-1), j/cols) -> point
  const pos = [];
  const idx = [];
  const C = wrapCols ? cols + 1 : cols;
  for (let i = 0; i < rows; i++) for (let j = 0; j < C; j++) pos.push(fn(i / (rows - 1), j / (wrapCols ? cols : cols - 1)));
  for (let i = 0; i < rows - 1; i++)
    for (let j = 0; j < C - 1; j++) {
      const a = i * C + j, b = a + 1, c = a + C, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  return { pos, idx };
}
function lathe(profile, seg = 28) {
  return grid(profile.length, seg, (u, v) => {
    const [r, y] = profile[Math.round(u * (profile.length - 1))];
    const a = v * Math.PI * 2;
    return [r * Math.sin(a), y, r * Math.cos(a)];
  });
}
const sphere = (q = 1) =>
  grid(Math.max(6, Math.round(18 * q)), Math.max(8, Math.round(30 * q)), (u, v) => {
    const th = u * Math.PI, a = v * Math.PI * 2;
    return [Math.sin(th) * Math.sin(a), -Math.cos(th), Math.sin(th) * Math.cos(a)];
  });
// rounded box (superellipsoid), unit half-size
const sgnpow = (x, p) => Math.sign(x) * Math.abs(x) ** p;
const rbox = (round = 0.25, q = 1) =>
  grid(Math.round(20 * q), Math.round(32 * q), (u, v) => {
    const th = -Math.PI / 2 + u * Math.PI, a = v * Math.PI * 2;
    const ct = sgnpow(Math.cos(th), round), st = sgnpow(Math.sin(th), round);
    return [ct * sgnpow(Math.sin(a), round), st, ct * sgnpow(Math.cos(a), round)];
  });
function cylinder(r0, r1, h, seg = 24, cap = true) {
  const prof = cap ? [[0, 0], [r0, 0], [r0, 0], [r1, h], [r1, h], [0, h]] : [[r0, 0], [r1, h]];
  return lathe(prof, seg);
}
const cone = (r, h, seg = 16) => lathe([[0, 0], [r, 0], [r, 0], [r * 0.02, h], [0, h]], seg);
function capsule(len, r0, r1 = r0, q = 1) {
  const n = Math.max(3, Math.round(6 * q)), prof = [];
  for (let i = 0; i <= n; i++) prof.push([r0 * Math.sin((i / n) * Math.PI / 2), -r0 * Math.cos((i / n) * Math.PI / 2)]);
  for (let i = 1; i <= n; i++) prof.push([r1 * Math.cos((i / n) * Math.PI / 2), len + r1 * Math.sin((i / n) * Math.PI / 2)]);
  return lathe(prof, Math.round(20 * q));
}
// torus in the XZ plane (axis Y); arc in degrees starting at `start`
function torus(R, r, { arc = 360, start = 0, seg = 48, tube = 12 } = {}) {
  const closed = arc >= 360;
  const g = grid(seg + 1, tube, (u, v) => {
    const a = (start + u * arc) * deg, b = v * Math.PI * 2, k = R + r * Math.cos(b);
    return [k * Math.cos(a), r * Math.sin(b), k * Math.sin(a)];
  });
  if (!closed) capEnds(g, seg + 1, tube + 1);
  return g;
}
function capEnds(g, rows, C) {
  for (const row of [0, rows - 1]) {
    const ring = Array.from({ length: C - 1 }, (_, j) => row * C + j);
    const c = mul3(ring.map((k) => g.pos[k]).reduce(add3, [0, 0, 0]), 1 / ring.length);
    const ci = g.pos.push(c) - 1;
    for (let j = 0; j < ring.length; j++) {
      const a = ring[j], b = ring[(j + 1) % ring.length];
      row === 0 ? g.idx.push(ci, b, a) : g.idx.push(ci, a, b);
    }
  }
}
// tube along a polyline path with per-point radius (number or fn(t))
function tube(path, radius, sides = 12) {
  const n = path.length;
  const T = path.map((p, i) => norm(sub3(path[Math.min(n - 1, i + 1)], path[Math.max(0, i - 1)])));
  let N = norm(cross(T[0], Math.abs(T[0][1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
  const frames = [];
  for (let i = 0; i < n; i++) {
    if (i > 0) N = norm(cross(cross(T[i], N), T[i]));
    frames.push([N, cross(T[i], N)]);
  }
  const g = grid(n, sides, (u, v) => {
    const i = Math.round(u * (n - 1)), a = v * Math.PI * 2;
    const r = typeof radius === 'function' ? radius(i / (n - 1)) : radius;
    const [A, B] = frames[i];
    return add3(path[i], add3(mul3(A, Math.cos(a) * r), mul3(B, Math.sin(a) * r)));
  });
  capEnds(g, n, sides + 1);
  return g;
}
const curve = (fn, steps = 24) => Array.from({ length: steps + 1 }, (_, i) => fn(i / steps));
// flat fan polygon in XY (for wing membranes), single sided (material is double sided)
function fan(points) {
  const pos = [[0, 0, 0], ...points.map(([x, y]) => [x, y, 0])];
  const idx = [];
  for (let i = 1; i < pos.length - 1; i++) idx.push(0, i, i + 1);
  return { pos, idx, open: true };
}

// transform, fix winding, smooth normals (welding seams/poles), drop degenerate triangles
function finish(shape, m, { post, clip } = {}) {
  let pos = shape.pos.map((p) => apply(m, p));
  if (post) pos = pos.map(post);
  const key = (p) => p.map((v) => Math.round(v * 2e5)).join(',');
  let idx = [];
  for (let i = 0; i < shape.idx.length; i += 3) {
    const t = [shape.idx[i], shape.idx[i + 1], shape.idx[i + 2]];
    const k = t.map((v) => key(pos[v]));
    if (k[0] === k[1] || k[1] === k[2] || k[0] === k[2]) continue;
    if (clip && !t.every((v) => clip(pos[v]))) continue;
    idx.push(...t);
  }
  if (!shape.open && !clip) {
    let vol = 0;
    for (let i = 0; i < idx.length; i += 3) vol += dot(pos[idx[i]], cross(pos[idx[i + 1]], pos[idx[i + 2]]));
    if (vol < 0) for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
  }
  // crease-aware smoothing: a vertex averages the faces at its position that bend less than ~55deg
  // from its own faces, so lathe seams and poles vanish but cylinder rims stay crisp
  const own = pos.map(() => [0, 0, 0]);
  const byKey = new Map();
  for (let i = 0; i < idx.length; i += 3) {
    const [a, b, c] = [pos[idx[i]], pos[idx[i + 1]], pos[idx[i + 2]]];
    const n = cross(sub3(b, a), sub3(c, a));
    for (let j = 0; j < 3; j++) {
      own[idx[i + j]] = add3(own[idx[i + j]], n);
      const k = key(pos[idx[i + j]]);
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(n);
    }
  }
  const nrm = pos.map((p, i) => {
    const o = norm(own[i]);
    let s = [0, 0, 0];
    for (const n of byKey.get(key(p)) || []) if (dot(norm(n), o) > 0.57) s = add3(s, n);
    const n = norm(Math.hypot(...s) > 1e-12 ? s : o);
    return Math.hypot(...n) > 0.5 ? n : norm(sub3(p, m.t)); // collinear slivers: point away from the part's origin
  });
  // keep only vertices that a triangle still uses
  const remap = new Map();
  const P = [], N = [];
  const I = idx.map((v) => {
    if (!remap.has(v)) { remap.set(v, P.length); P.push(pos[v]); N.push(nrm[v]); }
    return remap.get(v);
  });
  return { pos: P, nrm: N, idx: I };
}

// ---------------------------------------------------------------- scene graph
const parts = new Map(); // node name -> [{material, geo}]
const put = (node, material, shape, m, opts) => {
  if (!parts.has(node)) parts.set(node, []);
  parts.get(node).push({ material, geo: finish(shape, m, opts) });
};
const E = (node, material, t, radii, r = [0, 0, 0], q = 1) => put(node, material, sphere(q), mat(t, r, radii));

// =============================================================== THE PUG
// Body centre at world y 0.2; Head pivot (neck) at body (0, 0.07, 0.13); head centre at head (0, 0.07, 0.05).
const BODY = [0, 0.2, 0];
const HEAD_PIVOT = [0, 0.07, 0.13];
const HC = [0, 0.07, 0.05]; // head centre in head space
const HR = [0.122, 0.108, 0.098]; // head radii
const h = (x, y, z) => [HC[0] + x, HC[1] + y, HC[2] + z];

// legs + paws (planted)
for (const x of [-0.078, 0.078])
  for (const z of [-0.105, 0.105]) {
    put('Legs', 'fawn', capsule(0.1, 0.037, 0.04), mat([x, 0.045, z]));
    E('Legs', 'fawnLight', [x, 0.026, z + 0.014], [0.043, 0.027, 0.052]);
    for (const dx of [-0.018, 0, 0.018]) E('Legs', 'mask', [x + dx, 0.012, z + 0.06], [0.007, 0.006, 0.008], [0, 0, 0], 0.35);
  }

// body
E('Body', 'fawn', [0, 0, 0], [0.122, 0.106, 0.17], [0, 0, 0], 1.4);
E('Body', 'fawnLight', [0, -0.012, 0.1], [0.092, 0.086, 0.082]);
E('Body', 'fawnLight', [0, -0.045, -0.01], [0.09, 0.07, 0.15]);
for (const sx of [-1, 1]) E('Body', 'fawn', [0.085 * sx, -0.045, -0.1], [0.045, 0.06, 0.062]); // haunches
// back wrinkle rolls behind the neck
for (const [z, s] of [[0.075, 1], [0.045, 0.9]])
  put('Body', 'wrinkle', torus(0.085 * s, 0.006, { arc: 120, start: 210, seg: 20, tube: 8 }), mul(mat([0, 0.035, z], [-70, 0, 0]), mat([0, 0, 0], [0, 0, 0], [1.05, 1, 1])));

// tactical vest: the top of a shell around the body
put('Body', 'vest', sphere(1.4), mat([0, 0.006, -0.005], [0, 0, 0], [0.13, 0.114, 0.14]), {
  clip: (p) => p[1] > 0.02 && p[2] < 0.1 && p[2] > -0.13,
});
// straps around the body (elliptical bands)
const band = (z, tilt, w, thick = 0.006, pad = 0.008) => {
  const s = Math.sqrt(Math.max(0.05, 1 - (z / 0.17) ** 2));
  const rx = 0.122 * s + pad, ry = 0.106 * s + pad;
  const m = mul(mat([0, 0, z], [tilt, 0, 0]), mat([0, 0, 0], [90, 0, 0]), mat([0, 0, 0], [0, 0, 0], [1, w / 0.05, 1]));
  return { shape: torus(1, 0.05, { seg: 56, tube: 8 }), m: mul(m, mat([0, 0, 0], [0, 0, 0], [rx, 1, ry])), rx, ry, frame: mul(mat([0, 0, z], [tilt, 0, 0]), mat([0, 0, 0], [90, 0, 0])) };
};
for (const z of [0.045, -0.095]) {
  const b = band(z, 0, 0.013);
  put('Body', 'leather', b.shape, b.m);
  put('Body', 'steel', rbox(0.3, 0.5), mat([b.rx + 0.003, -0.01, z], [0, 0, 0], [0.006, 0.014, 0.016])); // buckle
}
// bandolier with shotgun shells (red body, brass head)
{
  const z = 0.1, tilt = 22;
  const b = band(z, tilt, 0.016, 0.006, 0.012);
  put('Body', 'leather', b.shape, b.m);
  const normal = norm(applyR(b.frame, [0, 1, 0]));
  for (let u = 18; u <= 162; u += 12) {
    const a = u * deg;
    const local = [Math.cos(a) * (b.rx + 0.007), 0, Math.sin(a) * (b.ry + 0.007)];
    const p = apply(b.frame, [local[0], local[1], local[2]]);
    const base = add3(p, mul3(normal, -0.014));
    put('Body', 'shell', cylinder(0.0062, 0.0062, 0.02, 12), along(base, normal));
    put('Body', 'brass', cylinder(0.0066, 0.0066, 0.008, 12), along(add3(base, mul3(normal, -0.002)), normal));
  }
}
// spiked collar
{
  const C = mat([0, 0.075, 0.135], [28, 0, 0]);
  put('Body', 'mask', torus(0.086, 0.014, { seg: 48, tube: 10 }), C);
  put('Body', 'steel', torus(0.086, 0.004, { seg: 48, tube: 6 }), mul(C, mat([0, 0.011, 0])));
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    const dir = [Math.cos(a), 0, Math.sin(a)];
    if (dir[2] < -0.6) continue; // none buried in the back of the neck
    put('Body', 'steel', cone(0.0085, 0.024, 12), mul(C, along(mul3(dir, 0.096), dir)));
  }
  const tag = apply(C, [0, 0, 0.1]);
  put('Body', 'hazard', rbox(0.5, 0.6), mat([tag[0], tag[1] - 0.026, tag[2] + 0.004], [-10, 0, 45], [0.016, 0.016, 0.004])); // red diamond tag
}
// combat knife strapped on the left shoulder
{
  const base = mat([-0.118, 0.0, 0.06], [0, -8, -18]);
  put('Body', 'mask', rbox(0.35, 0.6), mul(base, mat([0, -0.01, 0], [0, 0, 0], [0.007, 0.04, 0.014])));
  put('Body', 'steel', rbox(0.3, 0.5), mul(base, mat([0, 0.032, 0], [0, 0, 0], [0.01, 0.003, 0.02])));
  put('Body', 'leather', cylinder(0.0065, 0.0065, 0.035, 12), mul(base, mat([0, 0.035, 0])));
  put('Body', 'steel', sphere(0.4), mul(base, mat([0, 0.072, 0], [0, 0, 0], 0.008)));
}
// grenades on the right flank
for (const [i, z] of [-0.06, -0.093, -0.126].entries()) {
  const x = 0.122 * Math.sqrt(1 - (z / 0.17) ** 2) + 0.012;
  const p = [x, -0.005 + (i % 2) * 0.004, z];
  E('Body', 'olive', p, [0.014, 0.019, 0.014], [0, 0, 0], 0.6);
  for (const dy of [-0.007, 0.0, 0.007]) put('Body', 'olive', torus(0.0145, 0.0018, { seg: 20, tube: 5 }), mat(add3(p, [0, dy, 0])));
  put('Body', 'steel', cylinder(0.006, 0.006, 0.008, 12), mat(add3(p, [0, 0.017, 0])));
  put('Body', 'steel', torus(0.006, 0.0012, { seg: 16, tube: 5 }), mat(add3(p, [0.006, 0.026, 0]), [0, 0, 90]));
  put('Body', 'steel', rbox(0.4, 0.4), mat(add3(p, [0.009, 0.008, 0]), [0, 0, -8], [0.0025, 0.014, 0.004]));
}
// drum magazine on the back + ammo belt to the gatling
{
  const D = mat([0.0, 0.135, -0.075], [0, 0, 90]);
  put('Body', 'gunmetal', cylinder(0.042, 0.042, 0.075, 32), mul(D, mat([0, -0.0375, 0])));
  put('Body', 'hazard', cylinder(0.0435, 0.0435, 0.012, 32, false), mul(D, mat([0, -0.006, 0])));
  for (const s of [-1, 1]) put('Body', 'steel', cylinder(0.012, 0.012, 0.004, 16), mul(D, mat([0, 0.0375 * s + (s < 0 ? -0.004 : 0), 0])));
  put('Body', 'gunmetal', rbox(0.3, 0.6), mat([0, 0.1, -0.075], [0, 0, 0], [0.035, 0.012, 0.03])); // cradle
  const belt = curve((t) => [lerp(0.04, 0.072, t), 0.155 + Math.sin(t * Math.PI) * 0.03, lerp(-0.07, 0.01, t)], 12);
  for (let i = 0; i < belt.length - 1; i++) {
    const p = belt[i], q = belt[i + 1], dir = norm(sub3(q, p)), side = norm(cross(dir, [0, 1, 0]));
    put('Body', 'brass', capsule(0.016, 0.0045, 0.003, 0.5), along(add3(p, mul3(side, -0.008)), side));
    put('Body', 'gunmetal', rbox(0.3, 0.3), mat(p, [0, Math.atan2(dir[0], dir[2]) / deg, 0], [0.012, 0.003, 0.004]));
  }
  // weapon mounts rising from the vest
  put('Body', 'gunmetal', cylinder(0.01, 0.008, 0.05, 12), mat([0.075, 0.095, 0.03], [0, 0, -12]));
  put('Body', 'gunmetal', cylinder(0.01, 0.008, 0.05, 12), mat([-0.075, 0.095, 0.01], [0, 0, 12]));
}

// gatling (right shoulder), barrels spin
const GATLING = [0.082, 0.155, 0.03];
put('Gatling', 'gunmetal', rbox(0.3), mat([0, 0, -0.01], [0, 0, 0], [0.026, 0.026, 0.045]));
put('Gatling', 'gunmetal', cylinder(0.018, 0.018, 0.02, 20), mat([0, 0, -0.055], [90, 0, 0]));
put('Gatling', 'hazard', rbox(0.3, 0.5), mat([0.0, 0.027, -0.01], [0, 0, 0], [0.012, 0.004, 0.03]));
put('Gatling', 'steel', cylinder(0.006, 0.006, 0.04, 12), mat([0, 0.034, -0.02], [90, 0, 0])); // sight rail
put('Gatling', 'brass', rbox(0.3, 0.4), mat([-0.028, -0.008, -0.01], [0, 0, 0], [0.004, 0.012, 0.02]));
put('Barrels', 'gunmetal', cylinder(0.0065, 0.0065, 0.13, 12), mat([0, 0, 0], [90, 0, 0]));
for (let k = 0; k < 6; k++) {
  const a = (k / 6) * Math.PI * 2;
  put('Barrels', 'steel', cylinder(0.0052, 0.0052, 0.13, 12), mat([Math.cos(a) * 0.0135, Math.sin(a) * 0.0135, 0], [90, 0, 0]));
  put('Barrels', 'pupil', cylinder(0.0032, 0.0032, 0.0012, 10), mat([Math.cos(a) * 0.0135, Math.sin(a) * 0.0135, 0.1305], [90, 0, 0]));
}
for (const z of [0.012, 0.075, 0.122]) put('Barrels', 'gunmetal', cylinder(0.022, 0.022, 0.008, 24), mat([0, 0, z], [90, 0, 0]));

// rocket pod (left shoulder)
const POD = [-0.082, 0.16, 0.012];
put('Pod', 'gunmetal', rbox(0.22), mat([0, 0, 0], [0, 0, 0], [0.034, 0.03, 0.058]));
put('Pod', 'hazard', rbox(0.2, 0.6), mat([0, 0, -0.018], [0, 0, 0], [0.0345, 0.0305, 0.008]));
put('Pod', 'mask', rbox(0.3, 0.6), mat([0, 0, 0.055], [0, 0, 0], [0.03, 0.026, 0.006]));
for (const x of [-0.015, 0.015])
  for (const y of [-0.013, 0.013]) {
    put('Pod', 'pupil', cylinder(0.011, 0.011, 0.012, 16), mat([x, y, 0.052], [90, 0, 0]));
    put('Pod', 'hazard', cone(0.0095, 0.022, 16), mat([x, y, 0.058], [90, 0, 0]));
    put('Pod', 'steel', cylinder(0.0098, 0.0098, 0.004, 16, false), mat([x, y, 0.056], [90, 0, 0]));
  }
put('Pod', 'steel', cylinder(0.0025, 0.0015, 0.05, 8), mat([-0.025, 0.03, -0.03], [-20, 0, 10])); // antenna
E('Pod', 'hazard', [-0.034, 0.078, -0.047], [0.004, 0.004, 0.004], [0, 0, 0], 0.4);

// curly tail
put('Tail', 'fawn', tube(curve((t) => {
  const a = t * 1.75 * Math.PI, r = 0.034 * (1 - 0.35 * t);
  return [0.012 * t, 0.03 + Math.sin(a) * r, -0.02 + (1 - Math.cos(a)) * -r * 0.0 - Math.sin(a * 0.5) * 0.02 + Math.cos(a) * r - r];
}, 30), (t) => 0.017 * (1 - 0.5 * t), 14), mat());

// ---------------- head
E('Head', 'fawn', [0, 0.01, -0.005], [0.088, 0.085, 0.072]); // neck
E('Head', 'fawn', HC, HR, [0, 0, 0], 1.5);
E('Head', 'fawn', h(0, 0.055, -0.01), [0.1, 0.06, 0.08], [0, 0, 0], 1); // broad skull
// black mask + jowls
E('Head', 'mask', h(0, -0.03, 0.058), [0.084, 0.06, 0.05], [0, 0, 0], 1.2);
for (const s of [-1, 1]) E('Head', 'mask', h(0.04 * s, -0.048, 0.072), [0.046, 0.038, 0.04], [0, 0, 0], 1);
E('Head', 'mask', h(0, 0.002, 0.07), [0.05, 0.03, 0.035]); // mask up between the eyes
// nose + nostrils
E('Head', 'nose', h(0, -0.006, 0.112), [0.026, 0.016, 0.013], [-10, 0, 0], 0.8);
for (const s of [-1, 1]) E('Head', 'pupil', h(0.01 * s, -0.008, 0.124), [0.006, 0.004, 0.003], [0, 0, 0], 0.4);
E('Head', 'shine', h(0.006, 0.004, 0.122), [0.008, 0.003, 0.002], [0, 0, 0], 0.4);
// the famous nose roll + forehead wrinkles, pressed onto the face
const onHead = (lift) => (p) => {
  const k = 1 - ((p[0] - HC[0]) / HR[0]) ** 2 - ((p[1] - HC[1]) / HR[1]) ** 2;
  return [p[0], p[1], HC[2] + HR[2] * Math.sqrt(Math.max(k, 0.02)) + lift];
};
put('Head', 'fawn', torus(0.03, 0.009, { arc: 150, start: 15, seg: 24, tube: 10 }), mat(h(0, -0.004, 0.104), [-90, 0, 0]));
put('Head', 'wrinkle', torus(0.041, 0.0032, { arc: 130, start: 25, seg: 24, tube: 6 }), mat(h(0, -0.006, 0.1), [-90, 0, 0]));
for (const [y, R] of [[0.04, 0.03], [0.058, 0.036]])
  put('Head', 'wrinkle', torus(R, 0.0035, { arc: 110, start: 35, seg: 24, tube: 6 }), mat(h(0, y - R, 0), [-90, 0, 0]), { post: onHead(0.001) });
// brave brows
for (const s of [-1, 1])
  put('Head', 'wrinkle', tube(curve((t) => h(s * lerp(0.022, 0.078, t), 0.052 + t * 0.012 - Math.sin(t * Math.PI) * 0.004, 0), 10), (t) => 0.0055 * (1 - 0.4 * t), 8), mat(), { post: onHead(0.0) });
// upper mouth (seen when the jaw drops) + upper fangs
E('Head', 'mouth', h(0, -0.06, 0.065), [0.05, 0.016, 0.04]);
for (const s of [-1, 1]) put('Head', 'tooth', cone(0.006, 0.016, 10), mat(h(0.026 * s, -0.07, 0.096), [180, 0, 0]));

// eyes (pivot at eyeball centre)
for (const [node, s] of [['EyeL', 1], ['EyeR', -1]]) {
  const yaw = 14 * s;
  E(node, 'eyeWhite', [0, 0, 0], [0.037, 0.037, 0.032], [0, yaw, 0], 1);
  E(node, 'iris', [0.021 * Math.sin(yaw * deg), 0, 0.021 * Math.cos(yaw * deg)], [0.03, 0.031, 0.014], [0, yaw, 0], 0.9);
  E(node, 'pupil', [0.031 * Math.sin(yaw * deg), 0, 0.031 * Math.cos(yaw * deg)], [0.017, 0.018, 0.006], [0, yaw, 0], 0.7);
  E(node, 'shine', [0.008 + 0.03 * Math.sin(yaw * deg), 0.012, 0.035], [0.008, 0.008, 0.003], [0, 0, 0], 0.5);
  E(node, 'shine', [-0.008 + 0.03 * Math.sin(yaw * deg), -0.011, 0.034], [0.004, 0.004, 0.002], [0, 0, 0], 0.4);
  // eyelid rim
  put(node, 'mask', torus(0.035, 0.0035, { seg: 32, tube: 6 }), mat([0, 0, 0.012], [90, yaw, 0]));
}
// ears: black rose ears folded forward
for (const [node, s] of [['EarL', 1], ['EarR', -1]]) {
  E(node, 'mask', [0.015 * s, -0.022, 0.01], [0.014, 0.042, 0.036], [35, 0, 28 * s], 1);
}
// lower jaw (pivot at the hinge)
E('Jaw', 'mask', [0, -0.012, 0.032], [0.05, 0.022, 0.042], [0, 0, 0], 1);
E('Jaw', 'mouth', [0, 0.004, 0.03], [0.042, 0.008, 0.034], [0, 0, 0], 0.8);
E('Jaw', 'tongue', [0, 0.008, 0.034], [0.03, 0.007, 0.03], [0, 0, 0], 0.8);
for (const s of [-1, 1]) put('Jaw', 'tooth', cone(0.005, 0.013, 10), mat([0.03 * s, 0.006, 0.058]));

// =============================================================== HOWL RINGS
// open bands of unit radius / unit length; nodes scale them out (radius) and thin them (length) to fade
const ringBand = lathe([[1, -0.5], [1, 0.5]], 64);
for (let i = 0; i < 5; i++) put(`HowlRing${i}`, 'howl', ringBand, mat([0, 0, 0], [90, 0, 0]));
for (let i = 0; i < 3; i++) put(`GroundRipple${i}`, 'howl', ringBand, mat());

// =============================================================== DEMON CATS
// cat local: faces +Z, origin at the body centre
function buildCat(n) {
  const c = `Cat${n}`;
  E(c, 'catFur', [0, -0.025, -0.012], [0.04, 0.038, 0.05]);
  E(c, 'catBelly', [0, -0.034, 0.002], [0.03, 0.028, 0.038], [0, 0, 0], 0.7);
  E(c, 'catFur', [0, 0.045, 0.018], [0.058, 0.051, 0.05], [0, 0, 0], 1.1);
  for (const s of [-1, 1]) {
    E(c, 'catFur', [0.046 * s, 0.028, 0.02], [0.022, 0.018, 0.022], [0, 0, 25 * s], 0.6); // cheek tufts
    put(c, 'catFur', cone(0.022, 0.045, 16), mat([0.034 * s, 0.083, 0.012], [0, 0, -24 * s], [1, 1, 0.6]));
    put(c, 'catInner', cone(0.013, 0.03, 12), mat([0.034 * s, 0.086, 0.019], [0, 0, -24 * s], [1, 1, 0.3]));
    // curved horns
    const horn = curve((t) => [s * (0.018 + 0.03 * t), 0.085 + 0.05 * t - 0.02 * t * t, 0.03 - 0.03 * t * t], 12);
    put(c, 'horn', tube(horn, (t) => 0.008 * (1 - 0.85 * t), 10), mat());
    E(c, 'hornTip', horn[12], [0.0025, 0.0025, 0.0025], [0, 0, 0], 0.3);
    // glowing slanted eyes with slit pupils
    E(c, 'catEye', [0.022 * s, 0.05, 0.059], [0.016, 0.012, 0.008], [0, 18 * s, -18 * s], 0.7);
    E(c, 'pupil', [0.022 * s, 0.05, 0.066], [0.0028, 0.011, 0.003], [0, 18 * s, -10 * s], 0.4);
    E(c, 'catFur', [0.022 * s, 0.063, 0.06], [0.019, 0.004, 0.009], [0, 18 * s, -22 * s], 0.5); // scowl
    put(c, 'tooth', cone(0.0035, 0.011, 8), mat([0.008 * s, 0.028, 0.064], [180, 0, 0]));
    E(c, 'catFur', [0.022 * s, -0.062, 0.025], [0.011, 0.01, 0.013], [0, 0, 0], 0.5); // front paws
    E(c, 'catFur', [0.026 * s, -0.058, -0.035], [0.012, 0.011, 0.015], [0, 0, 0], 0.5);
  }
  E(c, 'catInner', [0, 0.036, 0.067], [0.006, 0.004, 0.003], [0, 0, 0], 0.4); // nose
  put(c, 'pupil', torus(0.008, 0.0015, { arc: 150, start: 15, seg: 12, tube: 4 }), mat([0, 0.032, 0.066], [90, 0, 0]));
  // wings: membrane + bones
  for (const [w, s] of [[`Cat${n}WingL`, 1], [`Cat${n}WingR`, -1]]) {
    const tips = [[0.065, 0.075], [0.115, 0.04], [0.11, -0.008], [0.07, -0.03]];
    const edge = [];
    tips.forEach((p, i) => {
      edge.push(p);
      if (i < tips.length - 1) {
        const q = tips[i + 1];
        edge.push([lerp(p[0], q[0], 0.5) * 0.8, lerp(p[1], q[1], 0.5) * 0.8]);
      }
    });
    edge.push([0.03, -0.02]);
    const S = mat([0, 0, 0], [0, 0, 0], [s, 1, 1]);
    put(w, 'wing', fan(edge), S);
    for (const p of tips) put(w, 'wingBone', tube(curve((t) => [p[0] * t, p[1] * t + Math.sin(t * Math.PI) * 0.01, 0], 8), (t) => 0.0035 * (1 - 0.6 * t), 6), S);
    put(w, 'horn', cone(0.003, 0.012, 8), mul(S, mat([0.065, 0.075, 0], [0, 0, -30])));
  }
  // spade tail
  const tail = curve((t) => [0.02 * Math.sin(t * 3), -0.01 + 0.07 * t - 0.03 * Math.sin(t * Math.PI), -0.09 * t], 16);
  put(`Cat${n}Tail`, 'catFur', tube(tail, (t) => 0.007 * (1 - 0.5 * t), 8), mat());
  const tip = tail[16], dir = norm(sub3(tail[16], tail[15]));
  put(`Cat${n}Tail`, 'spade', cone(0.014, 0.028, 4), mul(along(tip, dir), mat([0, 0, 0], [0, 45, 0], [1, 1, 0.35])));
}
for (let n = 0; n < 4; n++) buildCat(n);

// =============================================================== glTF
const doc = new Document();
const buffer = doc.createBuffer();
const materials = {};
for (const [name, p] of Object.entries(PALETTE)) {
  const m = doc
    .createMaterial(name)
    .setBaseColorFactor([...lin(p.c), p.alpha ?? 1])
    .setRoughnessFactor(p.rough)
    .setMetallicFactor(p.metal ?? 0)
    .setDoubleSided(!!p.double);
  if (p.emit) m.setEmissiveFactor(lin(p.emit));
  if (p.alpha != null) m.setAlphaMode('BLEND');
  materials[name] = m;
}
function meshFor(name) {
  const byMat = {};
  for (const { material, geo } of parts.get(name) || []) (byMat[material] ||= []).push(geo);
  const mesh = doc.createMesh(name);
  for (const [m, geos] of Object.entries(byMat)) {
    const P = [], N = [], I = [];
    for (const g of geos) {
      const base = P.length / 3;
      g.pos.forEach((p) => P.push(...p));
      g.nrm.forEach((n) => N.push(...n));
      g.idx.forEach((i) => I.push(i + base));
    }
    const IndexArray = P.length / 3 > 65535 ? Uint32Array : Uint16Array;
    mesh.addPrimitive(
      doc
        .createPrimitive()
        .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(P)).setBuffer(buffer))
        .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(N)).setBuffer(buffer))
        .setIndices(doc.createAccessor().setType('SCALAR').setArray(new IndexArray(I)).setBuffer(buffer))
        .setMaterial(materials[m]),
    );
  }
  return mesh;
}
const node = (name, t = [0, 0, 0], withMesh = true) => {
  const n = doc.createNode(name).setTranslation(t);
  if (withMesh && parts.has(name)) n.setMesh(meshFor(name));
  return n;
};

const root = node('Pugatory', [0, 0, 0], false);
const pug = node('Pug', [0, 0, 0], false);
const legs = node('Legs');
const body = node('Body', BODY);
const head = node('Head', HEAD_PIVOT);
const eyeL = node('EyeL', h(0.05, 0.022, 0.066));
const eyeR = node('EyeR', h(-0.05, 0.022, 0.066));
const earL = node('EarL', h(0.088, 0.072, -0.005));
const earR = node('EarR', h(-0.088, 0.072, -0.005));
const jaw = node('Jaw', h(0, -0.058, 0.04));
const gatling = node('Gatling', GATLING);
const barrels = node('Barrels', [0, 0, 0.013]);
const pod = node('Pod', POD);
const tailN = node('Tail', [0, 0.06, -0.15]);
root.addChild(pug);
pug.addChild(legs).addChild(body);
body.addChild(head).addChild(gatling).addChild(pod).addChild(tailN);
gatling.addChild(barrels);
head.addChild(eyeL).addChild(eyeR).addChild(earL).addChild(earR).addChild(jaw);
const MOUTH = h(0, -0.06, 0.115);
const rings = Array.from({ length: 5 }, (_, i) => {
  const r = node(`HowlRing${i}`, MOUTH).setScale([1e-4, 1e-4, 1e-4]);
  head.addChild(r);
  return r;
});
const ripples = Array.from({ length: 3 }, (_, i) => {
  const r = node(`GroundRipple${i}`, [0, 0.01, 0]).setScale([1e-4, 1e-4, 1e-4]);
  root.addChild(r);
  return r;
});
const orbit = node('CatOrbit', [0, 0, 0], false);
root.addChild(orbit);
const CAT_R = 0.62;
const cats = [0, 1, 2, 3].map((n) => {
  const a = (45 + n * 90) * deg;
  const pos = [Math.sin(a) * CAT_R, n % 2 ? 0.5 : 0.38, Math.cos(a) * CAT_R];
  const cat = node(`Cat${n}`, pos);
  const wl = node(`Cat${n}WingL`, [0.03, 0.0, -0.03]);
  const wr = node(`Cat${n}WingR`, [-0.03, 0.0, -0.03]);
  const tl = node(`Cat${n}Tail`, [0, -0.03, -0.05]);
  cat.addChild(wl).addChild(wr).addChild(tl);
  orbit.addChild(cat);
  return { cat, wl, wr, tl, a, pos, yaw: Math.atan2(-pos[0], -pos[2]) / deg };
});
doc.createScene('Scene').addChild(root);
doc.getRoot().setDefaultScene(doc.getRoot().listScenes()[0]);

// =============================================================== ANIMATION "Howl"
const T = 6;
const FPS = 30;
const times = Array.from({ length: T * FPS + 1 }, (_, i) => i / FPS);
const anim = doc.createAnimation('Howl');
function channel(target, path, keyTimes, values) {
  const s = doc
    .createAnimationSampler()
    .setInput(doc.createAccessor().setType('SCALAR').setArray(new Float32Array(keyTimes)).setBuffer(buffer))
    .setOutput(doc.createAccessor().setType(path === 'rotation' ? 'VEC4' : 'VEC3').setArray(new Float32Array(values.flat())).setBuffer(buffer))
    .setInterpolation('LINEAR');
  anim.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(target).setTargetPath(path).setSampler(s));
}
const sampled = (target, path, fn) => channel(target, path, times, times.map(fn));
const wave = (t, cycles, ph = 0) => Math.sin(2 * Math.PI * (cycles * t) / T + ph);
// howl envelope: 0 idle -> 1 full howl
const HOWL_IN = [1.75, 2.15], HOWL_OUT = [4.25, 4.9];
const howl = (t) => smooth((t - HOWL_IN[0]) / (HOWL_IN[1] - HOWL_IN[0])) * (1 - smooth((t - HOWL_OUT[0]) / (HOWL_OUT[1] - HOWL_OUT[0])));
const windup = (t) => Math.exp(-(((t - 1.6) / 0.18) ** 2)); // head dips before the howl
const tremble = (t) => Math.sin(t * 2 * Math.PI * 9) * howl(t);

sampled(body, 'translation', (t) => [0, BODY[1] + 0.003 * wave(t, 3) + 0.012 * howl(t), 0]);
sampled(body, 'rotation', (t) => quatFromEuler(-7 * howl(t) + 3 * windup(t), 0, 0.6 * tremble(t)));
sampled(body, 'scale', (t) => [1 + 0.012 * wave(t, 3) * (1 - howl(t)), 1 + 0.018 * wave(t, 3) * (1 - howl(t)) + 0.02 * howl(t), 1]);
sampled(head, 'rotation', (t) => quatFromEuler(-38 * howl(t) + 14 * windup(t) + 2 * wave(t, 3, 0.4) * (1 - howl(t)) + 1.2 * tremble(t), 6 * wave(t, 1) * (1 - howl(t)), 5 * wave(t, 1, 1) * (1 - howl(t))));
sampled(jaw, 'rotation', (t) => quatFromEuler(30 * howl(t) + 3 * Math.abs(tremble(t)), 0, 0));
for (const [ear, s] of [[earL, 1], [earR, -1]]) sampled(ear, 'rotation', (t) => quatFromEuler(-35 * howl(t) + 4 * wave(t, 3, -0.6), 0, s * (6 * howl(t) + 3 * wave(t, 2, -0.8))));
// eyes squeeze shut for the howl, plus one idle blink
for (const eye of [eyeL, eyeR]) {
  sampled(eye, 'scale', (t) => {
    const blink = Math.exp(-(((t - 0.9) / 0.05) ** 2));
    return [1, Math.max(0.12, 1 - 0.85 * howl(t) - 0.9 * blink), 1];
  });
}
sampled(tailN, 'rotation', (t) => quatFromEuler(0, 0, 14 * wave(t, 12) * (1 - howl(t))));
// gatling: lazy idle spin, screaming fast during the howl; total turn snapped to a whole number of barrels
{
  const speed = (t) => 120 + 1400 * howl(t); // deg/s
  const raw = [0];
  for (let i = 1; i < times.length; i++) raw.push(raw[i - 1] + speed(times[i]) / FPS);
  const k = Math.round(raw.at(-1) / 60) * 60 / raw.at(-1);
  channel(barrels, 'rotation', times, raw.map((a) => quatFromEuler(0, 0, a * k)));
}
sampled(pod, 'rotation', (t) => quatFromEuler(-14 * howl(t), 0, 0));
sampled(gatling, 'rotation', (t) => quatFromEuler(-10 * howl(t) + 1.5 * tremble(t), 0, 0));

// howl rings: open bands that grow out of the mouth, travel forward and thin away to nothing
function burst(target, start, life, fn) {
  const kt = [0];
  const kv = [[1e-4, 1e-4, 1e-4]];
  const kp = [];
  if (start > 0.02) { kt.push(start - 0.01); kv.push([1e-4, 1e-4, 1e-4]); }
  for (let i = 0; i <= 12; i++) {
    const u = i / 12;
    kt.push(start + u * life);
    kv.push(fn(u).scale);
    kp.push([start + u * life, fn(u).pos]);
  }
  kt.push(start + life + 0.01); kv.push([1e-4, 1e-4, 1e-4]);
  kt.push(T); kv.push([1e-4, 1e-4, 1e-4]);
  channel(target, 'scale', kt, kv);
  return kp;
}
rings.forEach((r, i) => {
  const start = 2.15 + i * 0.42;
  const kp = burst(r, start, 1.25, (u) => {
    const rad = lerp(0.03, 0.5, easeOut(u));
    const len = 0.075 * (1 - u) ** 1.5 + 1e-4;
    return { scale: [rad, rad, len], pos: add3(MOUTH, [0, 0, lerp(0.0, 0.32, easeOut(u))]) };
  });
  channel(r, 'translation', [0, ...kp.map((k) => k[0]), T], [MOUTH, ...kp.map((k) => k[1]), MOUTH]);
});
ripples.forEach((r, i) => {
  const start = 2.2 + i * 0.6;
  burst(r, start, 1.6, (u) => {
    const rad = lerp(0.12, 1.1, easeOut(u));
    return { scale: [rad, 0.045 * (1 - u) ** 1.5 + 1e-4, rad], pos: [0, 0, 0] };
  });
});

// cats: slow orbit (quarter turn per loop = seamless with four cats), bobbing, flapping, blown back by the howl
sampled(orbit, 'rotation', (t) => quatFromEuler(0, (90 * t) / T, 0));
const push = (t, n) => {
  const t0 = 2.3 + n * 0.12;
  return smooth((t - t0) / 0.35) * (1 - smooth((t - 4.3) / 0.9));
};
cats.forEach(({ cat, wl, wr, tl, pos, yaw }, n) => {
  const dir = norm([pos[0], 0, pos[2]]);
  sampled(cat, 'translation', (t) => {
    const p = push(t, n);
    return add3(pos, add3(mul3(dir, 0.17 * p), [0, 0.025 * wave(t, 3, n * 1.7) + 0.05 * p, 0]));
  });
  sampled(cat, 'rotation', (t) => {
    const p = push(t, n);
    return quatFromEuler(-28 * p + 6 * wave(t, 3, n), yaw + 8 * wave(t, 1, n), 10 * Math.sin(t * 2 * Math.PI * 5) * p + 4 * wave(t, 2, n));
  });
  const flapRate = 18 + (n % 2) * 3; // flaps per loop (whole numbers keep it seamless)
  sampled(wl, 'rotation', (t) => quatFromEuler(0, -20, 38 * Math.sin((2 * Math.PI * flapRate * t) / T + n) + 8));
  sampled(wr, 'rotation', (t) => quatFromEuler(0, 20, -38 * Math.sin((2 * Math.PI * flapRate * t) / T + n) - 8));
  sampled(tl, 'rotation', (t) => quatFromEuler(10 * wave(t, 4, n), 25 * wave(t, 3, n * 2), 0));
});

// =============================================================== write
await MeshoptEncoder.ready;
await doc.transform(prune(), dedup(), weld(), reorder({ encoder: MeshoptEncoder }), prune());
await new NodeIO().write(new URL('./pugatory.glb', import.meta.url).pathname, doc);
const prims = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives());
console.log(`triangles: ${prims.reduce((n, p) => n + p.getIndices().getCount() / 3, 0)}, nodes: ${doc.getRoot().listNodes().length}`);
