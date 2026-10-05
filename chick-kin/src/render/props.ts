// Procedural farm prop kit (TEMP production art). Every builder returns a Group with its pivot at the
// base centre, in metres, so colliders (sim) and visuals share one scale.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { woodTex, strawTex, dirtTex, grassTex, checkerTex, basketTex, radialTex } from './textures';
import { POWERS, type PowerId } from '../data/items';

const mats = new Map<string, THREE.Material>();
export function mat(key: string, make: () => THREE.Material) {
  if (!mats.has(key)) mats.set(key, make());
  return mats.get(key)!;
}
const std = (color: number, rough = 0.8, extra: THREE.MeshStandardMaterialParameters = {}) => mat(`std:${color}:${rough}:${JSON.stringify(extra)}`, () => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra }));
export const M = {
  wood: () => mat('wood', () => new THREE.MeshStandardMaterial({ map: woodTex(0xb07a45, 4), roughness: 0.82 })),
  woodDark: () => mat('woodDark', () => new THREE.MeshStandardMaterial({ map: woodTex(0x7d5230, 3, 'wd'), roughness: 0.85 })),
  woodLight: () => mat('woodLight', () => new THREE.MeshStandardMaterial({ map: woodTex(0xcf9a5c, 5, 'wl'), roughness: 0.8 })),
  plank: () => mat('plank', () => new THREE.MeshStandardMaterial({ map: woodTex(0xc08850, 2, 'pl'), roughness: 0.8 })),
  straw: () => mat('straw', () => new THREE.MeshStandardMaterial({ map: strawTex(0xe8b94f), roughness: 0.95 })),
  hay: () => mat('hay', () => new THREE.MeshStandardMaterial({ map: strawTex(0xd9a843, 'hay'), roughness: 0.95 })),
  dirt: () => mat('dirt', () => new THREE.MeshStandardMaterial({ map: dirtTex(0x8f6538), roughness: 1 })),
  grass: () => mat('grass', () => new THREE.MeshStandardMaterial({ map: grassTex(0x6fae4c), roughness: 1 })),
  red: () => std(0xb8332c, 0.7),
  white: () => std(0xf7efe2, 0.6),
  metal: () => std(0x6f7478, 0.45, { metalness: 0.6 }),
  orange: () => std(0xf39a2c, 0.55),
  mud: () => mat('mud', () => new THREE.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 0.25, metalness: 0.05 })),
  water: () => mat('water', () => new THREE.MeshStandardMaterial({ color: 0x5aa7c8, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.85 })),
  rope: () => std(0xc9a46a, 0.9),
  leaf: () => std(0x5f9e3c, 0.8),
  gold: () => mat('gold', () => new THREE.MeshStandardMaterial({ color: 0xffc533, roughness: 0.25, metalness: 0.6, emissive: 0x6b4200, emissiveIntensity: 0.4 })),
  egg: () => mat('egg', () => new THREE.MeshPhysicalMaterial({ color: 0xf6ead6, roughness: 0.45, clearcoat: 0.3 })),
  pink: () => mat('worm', () => new THREE.MeshPhysicalMaterial({ color: 0xf08a8e, roughness: 0.5, sheen: 0.6, sheenColor: new THREE.Color(0xffc0c0) })),
};

const box = (w: number, h: number, d: number, m: THREE.Material, r = 0.06) => {
  const g = new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.2, h / 2.2, d / 2.2));
  const mesh = new THREE.Mesh(g, m);
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
};
const cyl = (rt: number, rb: number, h: number, m: THREE.Material, seg = 16) => {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
};
const ball = (r: number, m: THREE.Material, w = 20, h = 14) => {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, w, h), m);
  mesh.castShadow = true;
  return mesh;
};
function setUV(mesh: THREE.Mesh, sx: number, sy: number) {
  const uv = mesh.geometry.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
  uv.needsUpdate = true;
  return mesh;
}

// ------------------------------------------------------------------ terrain pieces
export function slab(w: number, h: number, d: number, top: THREE.Material, side: THREE.Material) {
  const g = new THREE.Group();
  const body = box(w, h, d, side, 0.08);
  body.position.y = -h / 2;
  setUV(body, w / 2, h / 2);
  g.add(body);
  const t = box(w + 0.04, 0.16, d + 0.04, top, 0.06);
  t.position.y = -0.07;
  setUV(t, w / 1.5, d / 1.5);
  g.add(t);
  return g;
}

export function plankPlatform(w: number, d = 1.8, supports = 0) {
  const g = new THREE.Group();
  const n = Math.max(1, Math.round(w / 1.2));
  for (let i = 0; i < n; i++) {
    const p = box(w / n - 0.04, 0.22, d, i % 2 ? M.plank() : M.woodLight(), 0.05);
    p.position.set(-w / 2 + (i + 0.5) * (w / n), -0.11, 0);
    setUV(p, 1, 0.5);
    g.add(p);
  }
  for (let i = 0; i < supports; i++) {
    const x = -w / 2 + 0.3 + (i * (w - 0.6)) / Math.max(1, supports - 1);
    const s = box(0.22, 1.2, 0.22, M.woodDark(), 0.04);
    s.position.set(x, -0.8, -d / 2 + 0.2);
    g.add(s);
  }
  return g;
}

export function beam(w: number, h = 0.36, d = 0.6) {
  const g = new THREE.Group();
  const b = box(w, h, d, M.wood(), 0.07);
  b.position.y = -h / 2;
  setUV(b, w / 2, 0.5);
  g.add(b);
  return g;
}

export function crate(w = 1, h = 1, d = 1) {
  const g = new THREE.Group();
  const b = box(w, h, d, M.woodLight(), 0.05);
  b.position.y = h / 2;
  g.add(b);
  // X brace on the front and frame
  const fm = M.woodDark();
  const frame = (fw: number, fh: number, x: number, y: number, rz = 0) => {
    const f = box(fw, fh, 0.06, fm, 0.02);
    f.position.set(x, y, d / 2 + 0.02);
    f.rotation.z = rz;
    g.add(f);
  };
  frame(w, 0.12, 0, h - 0.06); frame(w, 0.12, 0, 0.06); frame(0.12, h, -w / 2 + 0.06, h / 2); frame(0.12, h, w / 2 - 0.06, h / 2);
  frame(Math.hypot(w, h) * 0.85, 0.1, 0, h / 2, Math.atan2(h, w));
  return g;
}

export function hayBale(w = 1.4, h = 0.9, d = 1.0) {
  const g = new THREE.Group();
  const b = box(w, h, d, M.hay(), 0.18);
  b.position.y = h / 2;
  setUV(b, w, h);
  g.add(b);
  for (const x of [-w * 0.28, w * 0.28]) {
    const band = box(0.06, h + 0.02, d + 0.02, M.rope(), 0.02);
    band.position.set(x, h / 2, 0);
    g.add(band);
  }
  return g;
}

export function roundBale(r = 0.6, len = 1.1) {
  const g = new THREE.Group();
  const c = cyl(r, r, len, M.hay(), 24);
  c.rotation.x = Math.PI / 2;
  c.position.y = r;
  g.add(c);
  const face = new THREE.Mesh(new THREE.CircleGeometry(r * 0.98, 24), mat('baleFace', () => new THREE.MeshStandardMaterial({ map: strawTex(0xc99a3c, 'baleface'), roughness: 1 })));
  face.position.set(0, r, len / 2 + 0.01);
  g.add(face);
  for (const z of [-len * 0.25, len * 0.25]) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(r + 0.01, 0.025, 6, 32), M.rope());
    t.position.set(0, r, z);
    g.add(t);
  }
  return g;
}

export function strawBarrier(w = 1, h = 1.2, d = 1) {
  const g = new THREE.Group();
  const b = box(w, h, d, M.straw(), 0.22);
  b.position.y = h / 2;
  setUV(b, 1.2, 1.2);
  g.add(b);
  // stray straws poking out
  const sm = M.straw();
  for (let i = 0; i < 14; i++) {
    const s = cyl(0.012, 0.012, 0.35 + (i % 4) * 0.08, sm, 4);
    const a = (i / 14) * Math.PI * 2;
    s.position.set(Math.cos(a) * w * 0.45, h * (0.25 + (i % 5) * 0.14), Math.sin(a) * d * 0.45);
    s.rotation.set(Math.sin(i) * 0.9, 0, Math.cos(i * 1.7) * 0.9);
    g.add(s);
  }
  return g;
}

export function fence(w: number, h = 1.2, gap = 0) {
  const g = new THREE.Group();
  const posts = Math.max(2, Math.round(w / 1.4) + 1);
  for (let i = 0; i < posts; i++) {
    const p = box(0.16, h + gap, 0.16, M.woodDark(), 0.03);
    p.position.set(-w / 2 + (i * w) / (posts - 1), (h + gap) / 2, 0);
    g.add(p);
  }
  for (const y of [gap + h * 0.35, gap + h * 0.8]) {
    const r = box(w + 0.1, 0.16, 0.08, M.wood(), 0.03);
    r.position.set(0, y, 0.08);
    setUV(r, w / 2, 0.3);
    g.add(r);
  }
  return g;
}

export function lowFenceGap(w: number, gap: number, h: number) {
  // OBS-06: rails high up, a gap underneath to duck through
  const g = new THREE.Group();
  for (const x of [-w / 2, w / 2]) {
    const p = box(0.14, gap + h, 0.14, M.woodDark(), 0.03);
    p.position.set(x, (gap + h) / 2, -0.9);
    g.add(p);
    const p2 = p.clone(); p2.position.z = 0.9; g.add(p2);
  }
  for (const y of [gap + 0.1, gap + 0.55, gap + 1.0]) {
    const r = box(w + 0.2, 0.14, 2.0, M.wood(), 0.03);
    r.position.set(0, y, 0);
    setUV(r, w, 1);
    g.add(r);
  }
  return g;
}

export function nestRim(len: number, thick: number, height: number) {
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.CapsuleGeometry(thick * 0.55, len, 6, 12), M.straw());
  c.rotation.z = Math.PI / 2;
  c.scale.set(1, 1, height / thick);
  c.position.y = height * 0.42;
  c.castShadow = true; c.receiveShadow = true;
  g.add(c);
  return g;
}

export function egg(scale = 1) {
  const geo = new THREE.SphereGeometry(0.36, 28, 20);
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 0.36;
    const k = 1 - 0.13 * y; // narrower toward the top, rounder at the base
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * 1.28, p.getZ(i) * k);
  }
  geo.computeVertexNormals();
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, M.egg());
  m.castShadow = true;
  m.scale.setScalar(scale);
  m.position.y = 0.46 * scale;
  g.add(m);
  return g;
}

export function worm() {
  const g = new THREE.Group();
  const pts = [new THREE.Vector3(0, -0.1, 0), new THREE.Vector3(0.05, 0.2, 0), new THREE.Vector3(-0.08, 0.45, 0.02), new THREE.Vector3(0.05, 0.62, 0.05)];
  const curve = new THREE.CatmullRomCurve3(pts);
  const body = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.09, 10, false), M.pink());
  body.castShadow = true;
  g.add(body);
  const head = ball(0.1, M.pink());
  head.position.copy(pts[3]);
  g.add(head);
  const wm = std(0x1a1010, 0.3);
  for (const s of [-1, 1]) {
    const e = ball(0.035, M.white(), 10, 8);
    e.position.set(pts[3].x + s * 0.045, pts[3].y + 0.04, pts[3].z + 0.08);
    g.add(e);
    const p = ball(0.018, wm, 8, 6);
    p.position.set(e.position.x, e.position.y, e.position.z + 0.025);
    g.add(p);
  }
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.092, 0.012, 6, 16), std(0xd86f75, 0.5));
    const p = curve.getPoint(0.2 + i * 0.15);
    ring.position.copy(p); ring.rotation.x = Math.PI / 2;
    g.add(ring);
  }
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.3, 20), std(0x4a2f17, 1));
  hole.rotation.x = -Math.PI / 2; hole.position.y = 0.01;
  g.add(hole);
  return g;
}

export function crumb(scale = 1) {
  const g = new THREE.Group();
  const m = mat('crumb', () => new THREE.MeshStandardMaterial({ color: 0xf2b640, roughness: 0.55, emissive: 0x6a3a00, emissiveIntensity: 0.35, flatShading: true }));
  const geo = new THREE.IcosahedronGeometry(0.16, 1);
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const k = 0.8 + 0.35 * Math.abs(Math.sin(i * 12.9898) * 0.9);
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.8, p.getZ(i) * k);
  }
  geo.computeVertexNormals();
  const c = new THREE.Mesh(geo, m);
  c.castShadow = true;
  c.scale.setScalar(scale);
  c.position.y = 0.15 * scale;
  g.add(c);
  const c2 = new THREE.Mesh(geo, m);
  c2.scale.setScalar(scale * 0.5);
  c2.position.set(0.15 * scale, 0.07 * scale, 0.06 * scale);
  g.add(c2);
  return g;
}

export function goldenFeather() {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(0.22, 0.35, 0.05, 0.9);
  shape.quadraticCurveTo(-0.18, 0.4, 0, 0);
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.01, bevelSegments: 2 }), M.gold());
  m.position.set(0, 0.1, 0);
  m.castShadow = true;
  g.add(m);
  const quill = cyl(0.012, 0.012, 0.95, M.gold(), 6);
  quill.position.set(0.02, 0.55, 0.02); quill.rotation.z = -0.06;
  g.add(quill);
  return g;
}

export function cornBundle() {
  const g = new THREE.Group();
  const corn = std(0xf5c518, 0.5);
  const husk = std(0x9cbf4a, 0.8);
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.4, 4, 10), corn);
    c.position.set((i - 1) * 0.16, 0.22, 0);
    c.rotation.z = (i - 1) * 0.15;
    c.castShadow = true;
    g.add(c);
    const h = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.35, 6), husk);
    h.position.set((i - 1) * 0.18, 0.12, 0.05);
    h.rotation.set(0.3, 0, (i - 1) * 0.3);
    g.add(h);
  }
  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 6, 16), M.red());
  tie.rotation.x = Math.PI / 2; tie.position.y = 0.2;
  g.add(tie);
  return g;
}

export function treat() {
  // loose treat (scratched from the ground): a kernel cluster
  const g = new THREE.Group();
  const corn = std(0xf6c22b, 0.45, { emissive: 0x5a3200, emissiveIntensity: 0.25 });
  for (let i = 0; i < 3; i++) {
    const k = ball(0.08, corn, 10, 8);
    k.scale.set(1, 1.2, 0.8);
    k.position.set(Math.cos(i * 2.1) * 0.07, 0.09, Math.sin(i * 2.1) * 0.07);
    g.add(k);
  }
  return g;
}

export function powerUp(id: PowerId) {
  const g = new THREE.Group();
  const col = new THREE.Color(POWERS[id].color);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), mat('glow:' + id, () => new THREE.MeshBasicMaterial({ map: radialTex(`rgba(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0},0.7)`, 'rgba(255,255,255,0)', 'glow' + id), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  glow.name = 'glow';
  g.add(glow);
  const item = new THREE.Group();
  item.name = 'item';
  g.add(item);
  const shiny = (c: number) => mat('pu' + c, () => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.25, clearcoat: 0.6, emissive: c, emissiveIntensity: 0.15 }));
  switch (id) {
    case 'PU-01': { const s = ball(0.17, shiny(0xe6a42a)); s.scale.set(0.8, 1.3, 0.8); s.rotation.z = 0.5; item.add(s); const l = ball(0.08, M.leaf()); l.scale.set(1.6, 0.4, 0.8); l.position.set(0.12, 0.2, 0); item.add(l); break; }
    case 'PU-02': case 'PU-08': {
      if (id === 'PU-08') { const t = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.05, 8, 24, Math.PI * 1.6), shiny(0x56c7e8)); item.add(t); const t2 = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.035, 8, 20, Math.PI * 1.5), shiny(0x9ee3f5)); t2.rotation.z = 1; item.add(t2); }
      else { const f = goldenFeather(); f.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = shiny(0x3fa7e8); }); f.scale.setScalar(0.5); f.position.y = -0.25; item.add(f); }
      break;
    }
    case 'PU-03': {
      const t = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.06, 10, 24, Math.PI), shiny(0xe2483d));
      t.rotation.z = Math.PI; item.add(t);
      for (const x of [-0.15, 0.15]) { const tip = cyl(0.062, 0.062, 0.1, M.metal(), 12); tip.position.set(x, 0.04, 0); item.add(tip); }
      break;
    }
    case 'PU-04': { const s = ball(0.2, mat('shell', () => new THREE.MeshPhysicalMaterial({ color: 0xbfe6ff, roughness: 0.05, transmission: 0.6, transparent: true, opacity: 0.7, clearcoat: 1 }))); item.add(s); const e = egg(0.32); e.position.y = -0.15; item.add(e); break; }
    case 'PU-05': { const k = ball(0.16, shiny(0xf5c518)); k.scale.set(0.9, 1.25, 0.75); item.add(k); break; }
    case 'PU-06': { for (const r of [-0.5, 0, 0.5]) { const t = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.18, 4, 8), shiny(0xf08a3c)); t.rotation.z = r; t.position.set(Math.sin(r) * 0.1, 0.05 + Math.cos(r) * 0.06, 0); item.add(t); } break; }
    case 'PU-07': { const a = crumb(0.9); a.position.x = -0.1; const b = crumb(0.9); b.position.x = 0.12; b.position.y = 0.05; item.add(a, b); item.position.y = -0.15; break; }
  }
  return g;
}

export function basket(r = 0.8, ribbon = 0xffffff) {
  const g = new THREE.Group();
  const b = cyl(r, r * 0.8, r * 0.75, mat('basketM', () => new THREE.MeshStandardMaterial({ map: basketTex(), roughness: 0.9 })), 24);
  b.position.y = r * 0.37;
  g.add(b);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.07, 8, 28), M.woodDark());
  rim.rotation.x = Math.PI / 2; rim.position.y = r * 0.75;
  g.add(rim);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(r * 0.7, 0.05, 8, 24, Math.PI), M.woodDark());
  handle.position.y = r * 0.75;
  g.add(handle);
  const cloth = new THREE.Mesh(new THREE.CircleGeometry(r * 0.85, 20), mat('cloth', () => new THREE.MeshStandardMaterial({ map: checkerTex('#c8322c', '#f4ead8', 8, 'cloth'), roughness: 0.9 })));
  cloth.rotation.x = -Math.PI / 2; cloth.position.y = r * 0.62;
  g.add(cloth);
  const rib = box(0.5, 0.18, 0.04, std(ribbon, 0.6), 0.03);
  rib.position.set(0, r * 0.45, r * 0.82);
  rib.name = 'ribbon';
  g.add(rib);
  return g;
}

export function scratchPatch() {
  const g = new THREE.Group();
  const d = new THREE.Mesh(new THREE.CircleGeometry(0.75, 24), mat('patch', () => new THREE.MeshStandardMaterial({ map: dirtTex(0x6e4a28, 'patch'), roughness: 1, transparent: true })));
  d.rotation.x = -Math.PI / 2; d.position.y = 0.015;
  d.receiveShadow = true;
  g.add(d);
  for (let i = 0; i < 5; i++) {
    const s = box(0.5, 0.02, 0.05, std(0x4a2f17, 1), 0.01);
    s.position.set((i - 2) * 0.18, 0.03, Math.sin(i) * 0.15);
    s.rotation.y = 0.5 + i * 0.1;
    g.add(s);
  }
  for (let i = 0; i < 4; i++) {
    const k = ball(0.05, std(0xf2c14a, 0.5), 8, 6);
    k.position.set(Math.cos(i * 1.7) * 0.35, 0.05, Math.sin(i * 1.7) * 0.3);
    k.name = 'seed';
    g.add(k);
  }
  return g;
}

export function cornPile() {
  const g = new THREE.Group();
  const s = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.12, 20), M.hay());
  s.position.y = 0.06; s.receiveShadow = true;
  g.add(s);
  return g;
}

export function gate(w: number, h = 1.1) {
  const g = new THREE.Group();
  const door = new THREE.Group();
  door.name = 'door';
  const f = fence(w, h * 0.9, 0.1);
  f.position.x = w / 2;
  door.add(f);
  const brace = box(Math.hypot(w, h) * 0.85, 0.12, 0.06, M.wood(), 0.02);
  brace.rotation.z = Math.atan2(h * 0.7, w);
  brace.position.set(w / 2, h * 0.55, 0.12);
  door.add(brace);
  door.position.x = -w / 2;
  g.add(door);
  return g;
}

export function lantern(lit = false) {
  const g = new THREE.Group();
  const post = box(0.12, 1.6, 0.12, M.woodDark(), 0.03);
  post.position.y = 0.8; g.add(post);
  const arm = box(0.4, 0.08, 0.08, M.woodDark(), 0.02);
  arm.position.set(0.18, 1.55, 0); g.add(arm);
  const lamp = new THREE.Group();
  lamp.position.set(0.35, 1.3, 0);
  const cage = box(0.24, 0.3, 0.24, M.metal(), 0.04);
  lamp.add(cage);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, 0.2), mat(lit ? 'lampOn' : 'lampOff', () => new THREE.MeshStandardMaterial({ color: lit ? 0xffd27a : 0xe8d9b0, emissive: lit ? 0xffa83a : 0x000000, emissiveIntensity: lit ? 1.6 : 0, roughness: 0.3 })));
  glass.name = 'glass';
  lamp.add(glass);
  g.add(lamp);
  return g;
}

export function ribbonArch(width: number, finish: boolean) {
  const g = new THREE.Group();
  for (const x of [-width / 2, width / 2]) {
    const p = box(0.18, 2.6, 0.18, M.woodDark(), 0.04);
    p.position.set(x, 1.3, 0); g.add(p);
  }
  const tex = finish ? checkerTex('#c8322c', '#fff4e4', 10, 'finish') : checkerTex('#2f6fb5', '#f4f4f4', 10, 'start');
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(width, 0.6, 8, 1), mat('banner' + finish, () => new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.9 })));
  banner.position.set(0, 2.25, 0.05);
  g.add(banner);
  return g;
}

export function crownPerch(w = 1.6) {
  const g = new THREE.Group();
  const post = box(0.3, 0.5, 0.3, M.woodDark(), 0.05);
  post.position.y = -0.25; g.add(post);
  const nest = new THREE.Mesh(new THREE.TorusGeometry(w * 0.38, 0.14, 8, 24), M.straw());
  nest.rotation.x = Math.PI / 2; nest.position.y = 0.06; nest.castShadow = true;
  g.add(nest);
  const crown = new THREE.Group();
  crown.name = 'crown';
  const band = cyl(0.2, 0.22, 0.14, M.gold(), 16);
  crown.add(band);
  for (let i = 0; i < 5; i++) {
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 6), M.gold());
    const a = (i / 5) * Math.PI * 2;
    sp.position.set(Math.cos(a) * 0.19, 0.14, Math.sin(a) * 0.19);
    crown.add(sp);
  }
  crown.position.y = 1.6;
  g.add(crown);
  return g;
}

export function bucket() {
  const g = new THREE.Group();
  const b = cyl(0.42, 0.32, 0.55, M.metal(), 18);
  b.position.y = 0.27; g.add(b);
  for (const y of [0.1, 0.45]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.4 - y * 0.15, 0.025, 6, 24), std(0x4a4e52, 0.4, { metalness: 0.7 }));
    band.rotation.x = Math.PI / 2; band.position.y = y; g.add(band);
  }
  return g;
}

export function springBranch(w: number) {
  const g = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-w / 2 - 0.4, -0.5, 0), new THREE.Vector3(-w / 4, -0.05, 0), new THREE.Vector3(w / 4, 0.05, 0), new THREE.Vector3(w / 2 + 0.2, 0.3, 0)]);
  const b = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.12, 8), M.woodDark());
  b.castShadow = true;
  b.name = 'branch';
  g.add(b);
  for (let i = 0; i < 5; i++) {
    const l = ball(0.14, M.leaf(), 8, 6);
    l.scale.set(1.4, 0.4, 0.8);
    const p = curve.getPoint(0.2 + i * 0.16);
    l.position.set(p.x, p.y + 0.12, (i % 2 ? 0.2 : -0.2));
    g.add(l);
  }
  return g;
}

export function wobblyLog(w: number) {
  const g = new THREE.Group();
  const log = cyl(0.2, 0.2, w, M.wood(), 14);
  log.rotation.z = Math.PI / 2; log.position.y = -0.18;
  log.name = 'log';
  const tilt = new THREE.Group();
  tilt.name = 'tilt';
  tilt.add(log);
  g.add(tilt);
  const pivot = box(0.3, 0.8, 0.3, M.woodDark(), 0.04);
  pivot.position.y = -0.7;
  g.add(pivot);
  return g;
}

export function moverCart(w: number, h: number) {
  const g = new THREE.Group();
  const c = crate(w, h * 0.8, 1.4);
  c.position.y = 0;
  g.add(c);
  for (const x of [-w * 0.35, w * 0.35]) for (const z of [-0.6, 0.6]) {
    const wh = cyl(0.14, 0.14, 0.08, M.woodDark(), 12);
    wh.rotation.x = Math.PI / 2; wh.position.set(x, 0.05, z); g.add(wh);
  }
  return g;
}

export function mudPuddle(w: number, d: number) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CircleGeometry(0.5, 28), M.mud());
  m.rotation.x = -Math.PI / 2; m.scale.set(w, d, 1); m.position.y = 0.02;
  m.receiveShadow = true;
  g.add(m);
  for (let i = 0; i < 4; i++) {
    const b = ball(0.05 + (i % 2) * 0.03, M.mud(), 10, 8);
    b.scale.y = 0.5;
    b.position.set(Math.cos(i * 1.9) * w * 0.3, 0.03, Math.sin(i * 1.9) * d * 0.3);
    g.add(b);
  }
  return g;
}

export function seedSpill(w: number, d: number) {
  const g = new THREE.Group();
  const sm = std(0xe9c35a, 0.5);
  const geo = new THREE.SphereGeometry(0.045, 6, 4);
  const n = Math.min(160, Math.round(w * d * 40));
  const inst = new THREE.InstancedMesh(geo, sm, n);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    const a = Math.sin(i * 12.9898) * 43758.5453, b = Math.sin(i * 78.233) * 12345.678;
    const fx = (a - Math.floor(a)) - 0.5, fz = (b - Math.floor(b)) - 0.5;
    m4.makeScale(1, 0.6, 1.3);
    m4.setPosition(fx * w, 0.03, fz * d);
    inst.setMatrixAt(i, m4);
  }
  g.add(inst);
  const sack = ball(0.35, mat('sack', () => new THREE.MeshStandardMaterial({ color: 0xc8a776, roughness: 1 })));
  sack.scale.set(1, 1.2, 0.9); sack.position.set(-w / 2, 0.35, -d / 2);
  g.add(sack);
  return g;
}

export function windGust(w: number, h: number) {
  const g = new THREE.Group();
  const wm = mat('wind', () => new THREE.MeshBasicMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
  for (let i = 0; i < 5; i++) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.4 + i * 0.12, 0.03, 6, 30, Math.PI * 1.3), wm);
    t.position.set((i - 2) * w * 0.15, (i % 3) * h * 0.25, 0);
    t.rotation.z = i;
    g.add(t);
  }
  g.name = 'wind';
  return g;
}

export function moundPerch(r: number, elev: number) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r, elev, 28), M.hay());
  m.position.y = elev / 2; m.castShadow = true; m.receiveShadow = true;
  g.add(m);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, 0.12, 24), M.woodLight());
  top.position.y = elev + 0.06; top.receiveShadow = true;
  g.add(top);
  return g;
}

export function flower(col = 0xffa0c8) {
  const g = new THREE.Group();
  const stem = cyl(0.015, 0.015, 0.3, M.leaf(), 4);
  stem.position.y = 0.15; g.add(stem);
  for (let i = 0; i < 5; i++) {
    const p = ball(0.06, std(col, 0.7), 8, 6);
    p.scale.set(1, 0.4, 0.6);
    p.position.set(Math.cos(i * 1.256) * 0.07, 0.3, Math.sin(i * 1.256) * 0.07);
    g.add(p);
  }
  const c = ball(0.04, std(0xffd23a, 0.6), 8, 6); c.position.y = 0.31; g.add(c);
  return g;
}

export function tree(s = 1) {
  const g = new THREE.Group();
  const t = cyl(0.25 * s, 0.35 * s, 2.4 * s, M.woodDark(), 10);
  t.position.y = 1.2 * s; g.add(t);
  for (let i = 0; i < 4; i++) {
    const b = ball((1.1 - i * 0.12) * s, std(0x5f9e3c + i * 0x050a00, 0.9), 14, 10);
    b.position.set(Math.cos(i * 2) * 0.5 * s, (2.6 + i * 0.35) * s, Math.sin(i * 2) * 0.4 * s);
    g.add(b);
  }
  return g;
}

export function barn(s = 1) {
  const g = new THREE.Group();
  g.name = 'barn';
  const body = box(6 * s, 4 * s, 4 * s, M.red(), 0.1);
  body.position.y = 2 * s; g.add(body);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 3.6 * s, 2.2 * s, 4, 1), std(0x6b3b2a, 0.8));
  roof.rotation.y = Math.PI / 4; roof.scale.set(1.2, 1, 0.8); roof.position.y = 5.1 * s;
  g.add(roof);
  const door = box(2 * s, 2.6 * s, 0.1, M.white(), 0.04);
  door.position.set(0, 1.3 * s, 2 * s + 0.02); g.add(door);
  const x1 = box(2.6 * s, 0.18, 0.12, M.red(), 0.02); x1.rotation.z = 0.9; x1.position.set(0, 1.3 * s, 2 * s + 0.08); g.add(x1);
  const x2 = x1.clone(); x2.rotation.z = -0.9; g.add(x2);
  return g;
}

export function windmill(s = 1) {
  const g = new THREE.Group();
  const tower = cyl(0.15 * s, 0.5 * s, 6 * s, M.woodDark(), 6);
  tower.position.y = 3 * s; g.add(tower);
  const hub = new THREE.Group(); hub.name = 'rotor';
  hub.position.set(0, 6 * s, 0.4 * s);
  for (let i = 0; i < 8; i++) {
    const b = box(0.3 * s, 1.6 * s, 0.05, M.white(), 0.02);
    b.position.y = 0.9 * s; const arm = new THREE.Group(); arm.rotation.z = (i / 8) * Math.PI * 2; arm.add(b); hub.add(arm);
  }
  g.add(hub);
  return g;
}

export function bunting(len: number) {
  const g = new THREE.Group();
  const cols = [0xe2483d, 0xf2b632, 0x3bb8b0, 0x7d5ad6, 0x5fae4c];
  const n = Math.round(len / 0.6);
  for (let i = 0; i < n; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.4, 3), std(cols[i % cols.length], 0.8));
    f.rotation.x = Math.PI; f.position.set(-len / 2 + i * 0.6, -Math.sin((i / n) * Math.PI) * 0.4 - 0.2, 0);
    g.add(f);
  }
  return g;
}

export function trophy() {
  const g = new THREE.Group();
  const base = box(0.5, 0.2, 0.5, M.woodDark(), 0.04); base.position.y = 0.1; g.add(base);
  const stem = cyl(0.06, 0.1, 0.3, M.gold(), 12); stem.position.y = 0.35; g.add(stem);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.12, 0.4, 20, 1, true), M.gold()); cup.position.y = 0.7; g.add(cup);
  return g;
}
