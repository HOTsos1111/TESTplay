// Builds the Homeward Hound hero as a small, animated, compressed glTF for WebAR.
//
//   cd webar && npm install && node build-hound.mjs
//
// Writes hound.glb: one self-contained binary glTF 2.0 file (geometry, materials and animation embedded,
// no textures, no extensions, so no Draco/meshopt decoder is needed by the viewer).
//
// Everything is procedural (no source art). Facing +Z, Y up, metres; the pup is ~0.5 m nose to tail.
// One looping clip "Idle" (4 s): breathing, curious head tilt, ear sway, tail wag, a blink.

import { Document, NodeIO } from '@gltf-transform/core';
import { dedup, prune, weld, reorder } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';

// ---------- palette (from art-src/hero.png) ----------
const srgb = (hex) => {
  const c = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map((v) => v / 255);
  return c.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
};
const PALETTE = {
  fur: { color: 0xb66b38, rough: 0.75 },
  ears: { color: 0x5a3a2e, rough: 0.8 },
  cream: { color: 0xffe1aa, rough: 0.8 },
  collar: { color: 0x42b7b0, rough: 0.5 },
  tag: { color: 0xffd95a, rough: 0.3, metal: 0.4 },
  black: { color: 0x1e1a1e, rough: 0.25 },
  white: { color: 0xffffff, rough: 0.3 },
  tongue: { color: 0xe86a6a, rough: 0.5 },
};

// ---------- tiny matrix helpers ----------
const deg = Math.PI / 180;
function mat(t = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
  // M = T * Rz * Ry * Rx * S  (column vectors), stored as 3x3 + translation
  const [cx, cy, cz] = r.map((a) => Math.cos(a * deg));
  const [sx, sy, sz] = r.map((a) => Math.sin(a * deg));
  const R = [
    [cy * cz, sx * sy * cz - cx * sz, cx * sy * cz + sx * sz],
    [cy * sz, sx * sy * sz + cx * cz, cx * sy * sz - sx * cz],
    [-sy, sx * cy, cx * cy],
  ];
  return { R: R.map((row) => row.map((v, j) => v * s[j])), t };
}
const apply = (m, p) => [0, 1, 2].map((i) => m.R[i][0] * p[0] + m.R[i][1] * p[1] + m.R[i][2] * p[2] + m.t[i]);

function quatFromEuler(x, y, z) {
  // same order as mat(): R = Rz * Ry * Rx
  const [hx, hy, hz] = [x, y, z].map((a) => (a * deg) / 2);
  const [cx, cy, cz] = [Math.cos(hx), Math.cos(hy), Math.cos(hz)];
  const [sx, sy, sz] = [Math.sin(hx), Math.sin(hy), Math.sin(hz)];
  return [
    sx * cy * cz - cx * sy * sz,
    cx * sy * cz + sx * cy * sz,
    cx * cy * sz - sx * sy * cz,
    cx * cy * cz + sx * sy * sz,
  ];
}

// ---------- shape generators (positions + triangle indices) ----------
function lathe(profile, seg) {
  // profile: [[radius, y], ...] bottom -> top; revolved around Y
  const pos = [];
  const idx = [];
  for (const [r, y] of profile) {
    for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * Math.PI * 2;
      pos.push([r * Math.sin(a), y, r * Math.cos(a)]);
    }
  }
  const row = seg + 1;
  for (let i = 0; i < profile.length - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const a = i * row + j, b = a + 1, c = a + row, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  return { pos, idx };
}
const sphereProfile = (rings) =>
  Array.from({ length: rings + 1 }, (_, i) => {
    const th = (i / rings) * Math.PI;
    return [Math.sin(th), -Math.cos(th)];
  });
const ellipsoid = (detail = 1) => lathe(sphereProfile(Math.round(12 * detail)), Math.round(20 * detail));

function capsule(length, r0, r1, detail = 1) {
  // tapered capsule along +Y from y=0 to y=length (radius r0 at base, r1 at tip)
  const n = Math.round(5 * detail);
  const prof = [];
  for (let i = 0; i <= n; i++) {
    const th = (i / n) * (Math.PI / 2);
    prof.push([r0 * Math.sin(th), -r0 * Math.cos(th)]);
  }
  for (let i = 1; i <= n; i++) {
    const th = (i / n) * (Math.PI / 2);
    prof.push([r1 * Math.cos(th), length + r1 * Math.sin(th)]);
  }
  return lathe(prof, Math.round(16 * detail));
}

function torus(R, r, arc = 360, seg = 32, tube = 10, start = 0) {
  const pos = [];
  const idx = [];
  for (let i = 0; i <= seg; i++) {
    const u = (start + (i / seg) * arc) * deg;
    for (let j = 0; j <= tube; j++) {
      const v = (j / tube) * Math.PI * 2;
      const k = R + r * Math.cos(v);
      pos.push([k * Math.cos(u), r * Math.sin(v), k * Math.sin(u)]);
    }
  }
  const row = tube + 1;
  for (let i = 0; i < seg; i++) {
    for (let j = 0; j < tube; j++) {
      const a = i * row + j, b = a + 1, c = a + row, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  return { pos, idx };
}

// smooth normals, welding coincident positions (hides lathe seams and poles)
function finish(shape, m, opts = {}) {
  let pos = shape.pos.map((p) => apply(m, p));
  if (opts.post) pos = pos.map(opts.post);
  let idx = shape.idx.slice();
  // make winding outward-facing (positive signed volume)
  let vol = 0;
  for (let i = 0; i < idx.length; i += 3) {
    const [a, b, c] = [pos[idx[i]], pos[idx[i + 1]], pos[idx[i + 2]]];
    vol += a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
  }
  if (vol < 0 && !opts.keepWinding) for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
  const key = (p) => p.map((v) => Math.round(v * 1e5)).join(',');
  // drop zero-area triangles (lathe poles)
  idx = idx.filter((_, i, all) => {
    const t = i - (i % 3);
    const [ka, kb, kc] = [all[t], all[t + 1], all[t + 2]].map((v) => key(pos[v]));
    return ka !== kb && kb !== kc && ka !== kc;
  });
  const acc = new Map();
  for (let i = 0; i < idx.length; i += 3) {
    const [a, b, c] = [pos[idx[i]], pos[idx[i + 1]], pos[idx[i + 2]]];
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    for (const v of [a, b, c]) {
      const k = key(v);
      const s = acc.get(k) || [0, 0, 0];
      acc.set(k, [s[0] + n[0], s[1] + n[1], s[2] + n[2]]);
    }
  }
  const nrm = pos.map((p) => {
    const n = acc.get(key(p)) || [0, 1, 0];
    const l = Math.hypot(...n) || 1;
    return n.map((v) => v / l);
  });
  return { pos, nrm, idx };
}

// ---------- the pup ----------
// Each node: parts grouped by material. Coordinates are in that node's local space.
const E = (t, radii, r = [0, 0, 0], detail = 1) => finish(ellipsoid(detail), mat(t, r, radii));

const parts = { Legs: [], Body: [], Head: [], EarL: [], EarR: [], EyeL: [], EyeR: [], Tail: [] };
const add = (node, material, geo) => parts[node].push({ material, geo });

// Legs + paws (stay planted on the root)
for (const x of [-0.065, 0.065]) {
  for (const z of [-0.15, 0.15]) {
    add('Legs', 'fur', finish(capsule(0.075, 0.034, 0.036), mat([x, 0.04, z])));
    add('Legs', 'cream', E([x, 0.024, z + 0.014], [0.04, 0.026, 0.05]));
  }
}

// Body (long sausage!), pivot at its centre
add('Body', 'fur', E([0, 0, 0], [0.11, 0.1, 0.25], [0, 0, 0], 1.2));
add('Body', 'cream', E([0, -0.03, 0.01], [0.086, 0.076, 0.21]));
add('Body', 'cream', E([0, 0.0, 0.175], [0.072, 0.082, 0.08]));
// collar + tag around the neck (neck sits at body-space (0, 0.07, 0.19))
const collarM = mat([0, 0.065, 0.19], [32, 0, 0]);
add('Body', 'collar', finish(torus(0.074, 0.016, 360, 36, 10), collarM));
const tagAt = apply(collarM, [0, 0, 0.092]);
add('Body', 'tag', finish(lathe([[0, -0.004], [0.022, -0.004], [0.022, 0.004], [0, 0.004]], 18),
  mat([tagAt[0], tagAt[1] - 0.022, tagAt[2] + 0.006], [80, 0, 0])));
add('Body', 'tag', finish(torus(0.008, 0.003, 360, 12, 6), mat([tagAt[0], tagAt[1] - 0.002, tagAt[2]], [90, 0, 0])));

// Head, pivot at the top of the neck (body-space (0, 0.09, 0.2))
add('Head', 'fur', E([0, -0.02, -0.01], [0.075, 0.09, 0.075], [-20, 0, 0]));
add('Head', 'fur', E([0, 0.09, 0.04], [0.1, 0.095, 0.1], [0, 0, 0], 1.2));
add('Head', 'fur', E([0, 0.172, 0.03], [0.03, 0.025, 0.04], [-20, 0, 0], 0.6)); // tuft
const muzzle = { c: [0, 0.05, 0.13], r: [0.056, 0.046, 0.088] };
add('Head', 'cream', E(muzzle.c, muzzle.r));
add('Head', 'cream', E([-0.045, 0.045, 0.1], [0.04, 0.035, 0.04], [0, 0, 0], 0.7)); // cheeks
add('Head', 'cream', E([0.045, 0.045, 0.1], [0.04, 0.035, 0.04], [0, 0, 0], 0.7));
add('Head', 'black', E([0, 0.074, 0.214], [0.03, 0.023, 0.022], [-15, 0, 0], 0.8)); // nose
add('Head', 'white', E([0.01, 0.084, 0.228], [0.007, 0.004, 0.003], [0, 0, 0], 0.4)); // nose shine
// smile: a lower arc pressed onto the muzzle surface
const onMuzzle = (lift) => (p) => {
  const [cx, cy, cz] = muzzle.c, [rx, ry, rz] = muzzle.r;
  const k = 1 - ((p[0] - cx) / rx) ** 2 - ((p[1] - cy) / ry) ** 2;
  const zs = cz + rz * Math.sqrt(Math.max(k, 0.02));
  return [p[0], p[1], zs + (p[2] - 0.2) + lift];
};
add('Head', 'black', finish(torus(0.024, 0.0045, 130, 20, 6, 25), mat([0, 0.05, 0.2], [90, 0, 0]), { post: onMuzzle(0) }));
add('Head', 'tongue', E([0, 0.022, 0.196], [0.012, 0.006, 0.01], [-30, 0, 0], 0.6));

// Eyes (own nodes so they can blink), pivot at the eye centre
for (const [node, sx] of [['EyeL', 1], ['EyeR', -1]]) {
  add(node, 'white', E([0, 0, 0], [0.031, 0.04, 0.022], [0, 18 * sx, 0], 0.8));
  add(node, 'black', E([-0.004 * sx, -0.005, 0.017], [0.017, 0.022, 0.01], [0, 18 * sx, 0], 0.6));
  add(node, 'white', E([0.003 * sx, 0.006, 0.026], [0.006, 0.006, 0.003], [0, 0, 0], 0.4));
}

// Ears: long and floppy, pivot at the top of the head
for (const [node, sx] of [['EarL', 1], ['EarR', -1]]) {
  add(node, 'ears', E([0.022 * sx, -0.085, -0.005], [0.024, 0.115, 0.066], [0, 0, 10 * sx]));
}

// Tail, pivot at the rump
add('Tail', 'fur', finish(capsule(0.15, 0.024, 0.009), mat([0, 0, 0], [-55, 0, 0])));

// ---------- glTF document ----------
const doc = new Document();
const buffer = doc.createBuffer();
const materials = {};
for (const [name, p] of Object.entries(PALETTE)) {
  materials[name] = doc
    .createMaterial(name)
    .setBaseColorFactor([...srgb(p.color), 1])
    .setRoughnessFactor(p.rough)
    .setMetallicFactor(p.metal ?? 0);
}

function meshFor(name) {
  const byMat = {};
  for (const { material, geo } of parts[name]) (byMat[material] ||= []).push(geo);
  const mesh = doc.createMesh(name);
  for (const [m, geos] of Object.entries(byMat)) {
    const P = [], N = [], I = [];
    for (const g of geos) {
      const base = P.length / 3;
      g.pos.forEach((p) => P.push(...p));
      g.nrm.forEach((n) => N.push(...n));
      g.idx.forEach((i) => I.push(i + base));
    }
    const prim = doc
      .createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(P)).setBuffer(buffer))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(N)).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint16Array(I)).setBuffer(buffer))
      .setMaterial(materials[m]);
    mesh.addPrimitive(prim);
  }
  return mesh;
}
const node = (name, t) => doc.createNode(name).setTranslation(t).setMesh(meshFor(name));

const root = doc.createNode('Hound');
const legs = node('Legs', [0, 0, 0]);
const body = node('Body', [0, 0.175, 0]);
const head = node('Head', [0, 0.09, 0.2]);
const eyeL = node('EyeL', [0.044, 0.122, 0.112]);
const eyeR = node('EyeR', [-0.044, 0.122, 0.112]);
const earL = node('EarL', [0.088, 0.15, 0.0]);
const earR = node('EarR', [-0.088, 0.15, 0.0]);
const tail = node('Tail', [0, 0.04, -0.235]);
root.addChild(legs).addChild(body);
body.addChild(head).addChild(tail);
head.addChild(eyeL).addChild(eyeR).addChild(earL).addChild(earR);
doc.createScene('Scene').addChild(root);
doc.getRoot().setDefaultScene(doc.getRoot().listScenes()[0]);

// ---------- animation: "Idle" ----------
const T = 4; // seconds, seamless loop
const FPS = 24;
const times = Array.from({ length: T * FPS + 1 }, (_, i) => i / FPS);
const wave = (t, cycles, phase = 0) => Math.sin(2 * Math.PI * (cycles * t / T) + phase);
const anim = doc.createAnimation('Idle');

function channel(target, path, keyTimes, values, interp = 'LINEAR') {
  const sampler = doc
    .createAnimationSampler()
    .setInput(doc.createAccessor().setType('SCALAR').setArray(new Float32Array(keyTimes)).setBuffer(buffer))
    .setOutput(doc.createAccessor().setType(path === 'rotation' ? 'VEC4' : 'VEC3').setArray(new Float32Array(values.flat())).setBuffer(buffer))
    .setInterpolation(interp);
  anim.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(target).setTargetPath(path).setSampler(sampler));
}

// breathing + gentle bob
channel(body, 'translation', times, times.map((t) => [0, 0.175 + 0.003 * wave(t, 2), 0]));
channel(body, 'scale', times, times.map((t) => [1 + 0.012 * wave(t, 2), 1 + 0.018 * wave(t, 2), 1]));
// curious head tilt one way then the other, small nod
channel(head, 'rotation', times, times.map((t) => quatFromEuler(-4 + 4 * wave(t, 2, 0.5), 7 * wave(t, 1, 0.3), 9 * wave(t, 1))));
// ears swing after the head, with a little flop
for (const ear of [earL, earR]) {
  channel(ear, 'rotation', times, times.map((t) => quatFromEuler(5 * wave(t, 2, -0.4), 0, -8 * wave(t, 1, -0.9) + 3 * wave(t, 4, -0.5))));
}
// happy tail wag (2 wags a second)
channel(tail, 'rotation', times, times.map((t) => quatFromEuler(6 * wave(t, 4, 1), 32 * wave(t, 8), 0)));
// blink (its own keys so it stays crisp)
const bt = [0, 2.55, 2.62, 2.66, 2.76, T];
const bs = [1, 1, 0.08, 0.08, 1, 1].map((s) => [1, s, 1]);
for (const eye of [eyeL, eyeR]) channel(eye, 'scale', bt, bs);

// ---------- optimise + write ----------
// Plain glTF 2.0: no extensions, no external files, no decoders needed.
await MeshoptEncoder.ready;
const io = new NodeIO();
await doc.transform(prune(), dedup(), weld(), reorder({ encoder: MeshoptEncoder }));
await io.write(new URL('./hound.glb', import.meta.url).pathname, doc);

const triCount = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives()).reduce((n, p) => n + p.getIndices().getCount() / 3, 0);
console.log(`triangles: ${triCount}`);
