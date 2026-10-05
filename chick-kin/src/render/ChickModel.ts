// Procedural Soft-3D chick (TEMP production art). Built from rounded primitives with velvety sheen,
// feather bump texture, big expressive eyes, tiny orange beak and feet. Class identity = colour + silhouette + tuft.
import * as THREE from 'three';
import { CLASS_INFO, type ChickClass } from '../data/classes';
import { GROWTH, ADULT_MODEL, type Stage } from '../data/growth';
import type { AnimState } from '../sim/actor';
import { featherBump, radialTex } from './textures';

export type Expression = 'happy' | 'determined' | 'startled' | 'sulking' | 'victory';

const ORANGE = 0xf39a2c;
const geoCache = new Map<string, THREE.BufferGeometry>();
type Paint = (n: THREE.Vector3) => number; // 0 = base colour, 1 = accent colour
function fluffSphere(segW = 40, segH = 28, amp = 0.035, paint?: { key: string; fn: Paint; base: number; accent: number }): THREE.BufferGeometry {
  const key = `fluff:${segW}:${segH}:${amp}:${paint ? paint.key + paint.base + ':' + paint.accent : ''}`;
  if (geoCache.has(key)) return geoCache.get(key)!;
  const g = new THREE.SphereGeometry(0.5, segW, segH);
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const cols = paint ? new Float32Array(p.count * 3) : null;
  const cb = paint ? new THREE.Color(paint.base) : null, ca = paint ? new THREE.Color(paint.accent) : null;
  const tmp = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = v.clone().normalize();
    // soft tufty displacement: layered sines (deterministic), stronger toward the sides/back
    const t = Math.sin(n.x * 17.1 + n.y * 9.3) * Math.sin(n.z * 15.7 - n.y * 7.1) + 0.6 * Math.sin(n.x * 29 + n.z * 23 + n.y * 21);
    const side = 0.5 + 0.5 * (1 - Math.max(0, n.z));
    v.multiplyScalar(1 + amp * t * side);
    p.setXYZ(i, v.x, v.y, v.z);
    if (cols && paint && cb && ca) {
      const k = Math.min(1, Math.max(0, paint.fn(n)));
      tmp.copy(cb).lerp(ca, k);
      cols[i * 3] = tmp.r; cols[i * 3 + 1] = tmp.g; cols[i * 3 + 2] = tmp.b;
    }
  }
  if (cols) g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  g.computeVertexNormals();
  geoCache.set(key, g);
  return g;
}
const smooth = (e0: number, e1: number, x: number) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const sphere = (r = 0.5, w = 24, h = 16) => {
  const key = `s:${r}:${w}:${h}`;
  if (!geoCache.has(key)) geoCache.set(key, new THREE.SphereGeometry(r, w, h));
  return geoCache.get(key)!;
};

function plumage(color: number, sheen: number, vertexColors = false) {
  return new THREE.MeshPhysicalMaterial({
    color: vertexColors ? 0xffffff : color, vertexColors, roughness: 0.9, metalness: 0,
    sheen: 1, sheenColor: new THREE.Color(sheen), sheenRoughness: 0.45,
    bumpMap: featherBump(), bumpScale: 0.45,
  });
}

export interface ChickPose { anim: AnimState; speed: number; vy: number; grounded: boolean; stamina?: number; carrying?: 'treat' | 'bundle' | null; protect?: boolean }

export class ChickModel {
  readonly root = new THREE.Group();
  private bob = new THREE.Group();
  private bodyMesh!: THREE.Mesh;
  private head = new THREE.Group();
  private eyes: THREE.Group[] = [];
  private pupils: THREE.Mesh[] = [];
  private brows: THREE.Mesh[] = [];
  private beakTop!: THREE.Mesh;
  private beakBot!: THREE.Mesh;
  private wingL = new THREE.Group();
  private wingR = new THREE.Group();
  private legL = new THREE.Group();
  private legR = new THREE.Group();
  private tuft = new THREE.Group();
  private tail = new THREE.Group();
  private shadow: THREE.Mesh;
  private carryItem: THREE.Object3D | null = null;
  private carryKind: string | null = null;
  private t = Math.random() * 10;
  private blinkT = 2;
  private blinkPhase = 0;
  private expr: Expression = 'happy';
  private exprT = 0;
  private cycle = 0;
  private squash = 1;
  private materials: THREE.Material[] = [];
  readonly cls: ChickClass;
  readonly height: number;
  lookTarget: THREE.Vector3 | null = null;

  constructor(cls: ChickClass, stage: Stage | 'adult', opts: { shadow?: boolean } = {}) {
    this.cls = cls;
    const info = CLASS_INFO[cls];
    const m = stage === 'adult' ? ADULT_MODEL : GROWTH[stage].model;
    const adult = stage === 'adult';
    const c = info.colors;
    const bodyMat = plumage(c.body, lighten(c.body, 1.35));
    const wingMat = plumage(c.wing, lighten(c.wing, 1.3));
    const tuftMat = plumage(c.tuft, lighten(c.tuft, 1.3));
    const faceMat = plumage(c.face, lighten(c.face, 1.2));
    this.materials.push(bodyMat, wingMat, tuftMat, faceMat);
    const orange = new THREE.MeshStandardMaterial({ color: ORANGE, roughness: 0.55 });
    this.materials.push(orange);

    // Class silhouette: Speedy slim oval, Mighty broad round, Nimble petite.
    const sil = cls === 'speedy' ? { w: 0.9, d: 0.86, h: 1.08 } : cls === 'mighty' ? { w: 1.14, d: 1.06, h: 0.98 } : { w: 0.86, d: 0.84, h: 1.0 };
    const bodyH = 0.86 * m.stretch * sil.h;
    const legLen = 0.16 * m.legs + (adult ? 0.12 : 0);
    const bodyY = legLen + bodyH * 0.46;

    this.root.add(this.bob);
    // body
    const bellyPaint = { key: 'belly', base: c.body, accent: c.belly, fn: (n: THREE.Vector3) => smooth(0.15, 0.75, n.z * 0.9 - n.y * 0.5 + 0.1) };
    const bodyPaintMat = plumage(c.body, lighten(c.body, 1.35), true);
    this.materials.push(bodyPaintMat);
    this.bodyMesh = new THREE.Mesh(fluffSphere(56, 40, 0.022, bellyPaint), bodyPaintMat);
    this.bodyMesh.scale.set(sil.w, bodyH, sil.d);
    this.bodyMesh.position.y = bodyY;
    this.bodyMesh.castShadow = true;
    this.bob.add(this.bodyMesh);

    // head: merged with the body for young chicks, separate on a neck as they grow
    const headR = (adult ? 0.3 : 0.4 + (1 - m.stretch) * 0.3 + (m.eyes - 1) * 0.2) * (cls === 'mighty' ? 1.06 : cls === 'nimble' ? 0.96 : 1);
    const headY = bodyY + bodyH * 0.34 + m.neck * 0.55 + (adult ? 0.25 : 0);
    const headZ = 0.06 + m.neck * 0.25;
    this.head.position.set(0, headY, headZ);
    this.bob.add(this.head);
    const facePaint = { key: 'face' + cls, base: c.body, accent: c.face, fn: (n: THREE.Vector3) => smooth(cls === 'mighty' ? 0.25 : 0.55, cls === 'mighty' ? 0.75 : 0.95, n.z - Math.max(0, n.y - 0.25) * 0.8) };
    const headPaintMat = plumage(c.body, lighten(c.body, 1.35), true);
    this.materials.push(headPaintMat);
    const headMesh = new THREE.Mesh(fluffSphere(48, 32, 0.02, facePaint), headPaintMat);
    headMesh.scale.setScalar(headR * 2);
    headMesh.castShadow = true;
    this.head.add(headMesh);
    if (m.neck > 0.05) {
      const neck = new THREE.Mesh(fluffSphere(24, 16, 0.03), bodyMat);
      neck.scale.set(headR * 1.5, m.neck * 1.6 + 0.2, headR * 1.4);
      neck.position.set(0, (bodyY + headY) / 2 + 0.05, headZ * 0.6);
      this.bob.add(neck);
    }

    // eyes: big, wide-set, glossy
    const eyeR = 0.125 * (0.55 + 0.45 * m.eyes) * (headR / 0.4) * 1.18;
    const irisCol = cls === 'nimble' ? 0x5a3a7a : cls === 'mighty' ? 0x4a2412 : 0x4a2c12;
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 });
    const iris = new THREE.MeshStandardMaterial({ color: irisCol, roughness: 0.2 });
    const pupil = new THREE.MeshStandardMaterial({ color: 0x120a08, roughness: 0.15 });
    const shine = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.materials.push(white, iris, pupil, shine);
    for (const side of [-1, 1]) {
      const eg = new THREE.Group();
      const ang = 0.4 * side;
      eg.position.set(Math.sin(ang) * headR * 0.84, headR * 0.1, Math.cos(ang) * headR * 0.84);
      eg.rotation.y = ang;
      const sclera = new THREE.Mesh(sphere(1, 24, 16), white);
      sclera.scale.set(eyeR, eyeR * 1.12, eyeR * 0.62);
      eg.add(sclera);
      const ir = new THREE.Mesh(sphere(1, 20, 14), iris);
      ir.scale.set(eyeR * 0.78, eyeR * 0.88, eyeR * 0.4);
      ir.position.z = eyeR * 0.36;
      eg.add(ir);
      const pu = new THREE.Mesh(sphere(1, 16, 12), pupil);
      pu.scale.set(eyeR * 0.5, eyeR * 0.58, eyeR * 0.3);
      pu.position.z = eyeR * 0.5;
      eg.add(pu);
      this.pupils.push(pu);
      const h1 = new THREE.Mesh(sphere(1, 10, 8), shine);
      h1.scale.setScalar(eyeR * 0.22);
      h1.position.set(-eyeR * 0.25 * side + eyeR * 0.1, eyeR * 0.32, eyeR * 0.66);
      eg.add(h1);
      const h2 = new THREE.Mesh(sphere(1, 8, 6), shine);
      h2.scale.setScalar(eyeR * 0.1);
      h2.position.set(eyeR * 0.22, -eyeR * 0.22, eyeR * 0.66);
      eg.add(h2);
      // soft brow (expression)
      const brow = new THREE.Mesh(sphere(1, 12, 8), tuftMat);
      brow.scale.set(eyeR * 0.75, eyeR * 0.16, eyeR * 0.2);
      brow.position.set(0, eyeR * 1.3, eyeR * 0.3);
      eg.add(brow);
      this.brows.push(brow);
      this.head.add(eg);
      this.eyes.push(eg);
    }
    // cheeks
    const blush = new THREE.MeshBasicMaterial({ color: 0xff8a8a, transparent: true, opacity: 0.35, depthWrite: false });
    this.materials.push(blush);
    for (const side of [-1, 1]) {
      const ch = new THREE.Mesh(sphere(1, 12, 8), blush);
      const ang = 0.78 * side;
      ch.scale.set(eyeR * 0.75, eyeR * 0.45, eyeR * 0.2);
      ch.position.set(Math.sin(ang) * headR * 0.92, -headR * 0.22, Math.cos(ang) * headR * 0.92);
      ch.rotation.y = ang;
      this.head.add(ch);
    }
    // beak
    const beakG = new THREE.ConeGeometry(0.06 * (headR / 0.4) * (adult ? 1.4 : 1), 0.13 * (headR / 0.4) * (adult ? 1.5 : 1), 12);
    beakG.rotateX(Math.PI / 2);
    this.beakTop = new THREE.Mesh(beakG, orange);
    this.beakTop.scale.set(1, 0.7, 1);
    this.beakTop.position.set(0, -headR * 0.12, headR * 0.98);
    this.head.add(this.beakTop);
    this.beakBot = new THREE.Mesh(beakG, orange);
    this.beakBot.scale.set(0.8, 0.45, 0.75);
    this.beakBot.position.set(0, -headR * 0.2, headR * 0.94);
    this.head.add(this.beakBot);
    if (adult) {
      // comb and wattle for the parent
      const comb = new THREE.MeshStandardMaterial({ color: 0xd8282b, roughness: 0.5 });
      this.materials.push(comb);
      for (let i = 0; i < 3; i++) {
        const k = new THREE.Mesh(sphere(1, 12, 10), comb);
        k.scale.set(0.05, 0.09 - i * 0.012, 0.06);
        k.position.set(0, headR * 0.95 + 0.03, headR * (0.3 - i * 0.3));
        this.head.add(k);
      }
      const w = new THREE.Mesh(sphere(1, 12, 10), comb);
      w.scale.set(0.04, 0.07, 0.035);
      w.position.set(0, -headR * 0.45, headR * 0.85);
      this.head.add(w);
    }

    // tuft — the class signature
    this.head.add(this.tuft);
    this.tuft.position.set(0, headR * 0.86, -headR * 0.05);
    const feather = (len: number, wid: number) => {
      const f = new THREE.Mesh(fluffSphere(14, 12, 0.02), tuftMat);
      f.scale.set(wid, len, wid * 0.8);
      f.position.y = len * 0.45;
      const g = new THREE.Group();
      g.add(f);
      return g;
    };
    const ts = m.tuft * (headR / 0.4) * 1.45;
    if (cls === 'speedy') {
      for (let i = 0; i < 5; i++) {
        const f = feather(0.3 * ts * (1 - Math.abs(i - 2) * 0.15), 0.07 * ts);
        f.rotation.set(-1.0 - i * 0.12, (i - 2) * 0.22, 0);
        f.position.z = -i * 0.02;
        this.tuft.add(f);
      }
    } else if (cls === 'mighty') {
      for (let i = 0; i < 4; i++) {
        const f = feather(0.2 * ts, 0.085 * ts);
        f.rotation.set(-0.25 - i * 0.25, (i % 2 ? 0.15 : -0.15), 0);
        f.position.z = 0.04 - i * 0.05;
        this.tuft.add(f);
      }
    } else {
      for (let i = 0; i < 5; i++) {
        const f = feather(0.32 * ts, 0.06 * ts);
        f.rotation.set(-0.15 + (i - 2) * -0.12, 0, (i - 2) * 0.32);
        f.children[0].rotation.x = 0.35;
        this.tuft.add(f);
      }
    }

    // wings
    for (const [g, side] of [[this.wingL, -1], [this.wingR, 1]] as const) {
      const w = new THREE.Mesh(fluffSphere(24, 18, 0.04), wingMat);
      const wl = 0.34 * m.wings;
      w.scale.set(0.12, wl, 0.3 * m.wings);
      w.position.set(0, -wl * 0.42, -0.02);
      w.castShadow = true;
      g.add(w);
      g.position.set(side * sil.w * 0.47, bodyY + bodyH * 0.18, -0.02);
      g.rotation.z = side * 0.18;
      this.bob.add(g);
    }
    // tail
    const tl = 0.08 + m.wings * 0.12 + (adult ? 0.2 : 0);
    for (let i = 0; i < 3 + (adult ? 2 : 0); i++) {
      const f = new THREE.Mesh(fluffSphere(14, 10, 0.02), adult && cls === 'nimble' ? tuftMat : wingMat);
      f.scale.set(0.08, tl, 0.06);
      const k = i - (adult ? 2 : 1);
      f.rotation.set(-0.9, 0, k * 0.35);
      f.position.set(k * 0.04, tl * 0.3, -tl * 0.35);
      this.tail.add(f);
    }
    this.tail.position.set(0, bodyY + bodyH * 0.02, -sil.d * 0.44);
    this.bob.add(this.tail);

    // legs & feet
    const legMat = orange;
    for (const [g, side] of [[this.legL, -1], [this.legR, 1]] as const) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, legLen + 0.06, 8), legMat);
      leg.position.y = -(legLen + 0.06) / 2;
      g.add(leg);
      for (const toe of [-0.5, 0, 0.5]) {
        const t = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.07, 4, 8), legMat);
        t.rotation.set(Math.PI / 2, 0, toe);
        t.position.set(Math.sin(toe) * 0.04, -legLen - 0.03, 0.05 * Math.cos(toe));
        g.add(t);
      }
      g.position.set(side * 0.14 * sil.w, legLen + 0.03, 0.02);
      this.bob.add(g);
    }

    // soft contact shadow
    const sm = new THREE.MeshBasicMaterial({ map: radialTex('rgba(40,25,10,0.45)', 'rgba(40,25,10,0)', 'shadowBlob'), transparent: true, depthWrite: false });
    this.materials.push(sm);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), sm);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.01;
    this.shadow.scale.set(sil.w * 1.3, sil.d * 1.3, 1);
    this.shadow.renderOrder = -1;
    if (opts.shadow !== false) this.root.add(this.shadow);

    this.height = headY + headR + 0.2;
    const s = stage === 'adult' ? 1.0 : 1;
    this.root.scale.setScalar(s);
  }

  setExpression(e: Expression, hold = 1.2) { this.expr = e; this.exprT = hold; }

  /** Ground height of the shadow relative to the root (for airborne chicks). */
  setShadowHeight(dy: number) {
    this.shadow.position.y = -dy + 0.01;
    const k = Math.max(0.35, 1 - dy * 0.35);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = k;
  }

  setCarry(kind: 'treat' | 'bundle' | 'worm' | null, make?: (k: string) => THREE.Object3D) {
    if (kind === this.carryKind) return;
    if (this.carryItem) { this.head.remove(this.carryItem); this.carryItem = null; }
    this.carryKind = kind;
    if (kind && make) {
      this.carryItem = make(kind);
      this.carryItem.position.set(0, -0.12, 0.42);
      this.carryItem.scale.multiplyScalar(kind === 'bundle' ? 0.8 : 0.9);
      this.head.add(this.carryItem);
    }
  }

  update(dt: number, p: ChickPose) {
    this.t += dt;
    const t = this.t;
    if (this.exprT > 0) { this.exprT -= dt; if (this.exprT <= 0) this.expr = 'happy'; }
    // ---- blink
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blinkPhase = 0.14; this.blinkT = 2 + Math.random() * 3; }
    let eyeOpen = 1;
    if (this.blinkPhase > 0) { this.blinkPhase -= dt; eyeOpen = 0.1; }

    // ---- defaults
    let bobY = 0, lean = 0, sqY = 1, wingA = 0.18, wingFlap = 0, legSwing = 0, headDip = 0, spin = 0, beakOpen = 0, puff = 1;
    const sp = Math.min(1.6, p.speed / 5);
    switch (p.anim) {
      case 'idle': case 'perch':
        bobY = Math.sin(t * 2.2) * 0.012; sqY = 1 + Math.sin(t * 2.2) * 0.015; break;
      case 'run': case 'carry': case 'push': {
        this.cycle += dt * (7 + sp * 9);
        bobY = Math.abs(Math.sin(this.cycle)) * 0.06 * (0.6 + sp * 0.5);
        lean = (p.anim === 'push' ? 0.45 : 0.12 + sp * 0.12);
        legSwing = Math.sin(this.cycle) * 0.9;
        wingA = 0.35 + Math.sin(this.cycle * 2) * 0.15;
        sqY = 1 - Math.abs(Math.cos(this.cycle)) * 0.05;
        if (p.anim === 'carry') { wingA = 0.9; lean = 0.08; }
        break;
      }
      case 'jump': sqY = 1.12; wingA = 1.2; legSwing = -0.4; break;
      case 'fall': sqY = 1.04; wingA = 0.9; wingFlap = Math.sin(t * 14) * 0.3; legSwing = 0.3; break;
      case 'flap': sqY = 1.06; wingA = 1.0; wingFlap = Math.sin(t * 40) * 0.9; break;
      case 'glide': wingA = 1.45; wingFlap = Math.sin(t * 6) * 0.08; lean = 0.25; break;
      case 'land': sqY = 0.82; break;
      case 'duck': sqY = 0.62; lean = 0.15; wingA = 0.1; this.cycle += dt * 6 * sp; legSwing = Math.sin(this.cycle) * 0.4; break;
      case 'brace': sqY = 0.78; lean = -0.12; wingA = 0.7; puff = 1.06; break;
      case 'peck': case 'scratch': headDip = Math.max(0, Math.sin(t * 22)) * 0.5; lean = 0.25; legSwing = p.anim === 'scratch' ? Math.sin(t * 22) * 0.6 : 0; break;
      case 'tug': lean = -0.3; headDip = 0.35 + Math.sin(t * 9) * 0.05; wingA = 0.6 + Math.sin(t * 9) * 0.1; legSwing = Math.sin(t * 9) * 0.2; break;
      case 'bumped': spin = Math.sin(t * 18) * 0.35; sqY = 0.9 + Math.sin(t * 25) * 0.08; wingA = 1.0; this.setExpression('startled', 0.6); break;
      case 'ability':
        if (this.cls === 'speedy') { lean = 0.5; this.cycle += dt * 30; legSwing = Math.sin(this.cycle) * 1.1; wingA = 0.2; sqY = 0.92; }
        else if (this.cls === 'mighty') { puff = 1.18; lean = 0.35; wingA = 1.1; }
        else { spin = (t * 14) % (Math.PI * 2); wingA = 1.3; wingFlap = Math.sin(t * 30) * 0.4; }
        this.setExpression('determined', 0.6);
        break;
      case 'celebrate':
        bobY = Math.abs(Math.sin(t * 6)) * 0.22; wingA = 1.4 + Math.sin(t * 12) * 0.3; sqY = 1 + Math.sin(t * 12) * 0.06; beakOpen = 0.5;
        if (this.expr === 'happy') this.expr = 'victory';
        break;
      case 'respawn': sqY = 1; break;
    }
    // squash/stretch easing
    this.squash += (sqY - this.squash) * Math.min(1, dt * 18);
    const sy = this.squash;
    const sx = 1 / Math.sqrt(sy);
    this.bob.scale.set(sx * puff, sy * puff, sx * puff);
    this.bob.position.y = bobY;
    this.bob.rotation.x = lean;
    this.bob.rotation.y = spin;
    this.wingL.rotation.z = -(wingA + wingFlap);
    this.wingR.rotation.z = wingA + wingFlap;
    this.legL.rotation.x = legSwing;
    this.legR.rotation.x = -legSwing;
    this.head.rotation.x = headDip;
    this.beakBot.rotation.x = beakOpen * 0.4 + (p.anim === 'peck' ? 0.2 : 0);
    // tuft sway
    this.tuft.rotation.x = Math.sin(t * 3) * 0.05 - lean * 0.4;
    // protection flicker
    this.root.visible = !(p.protect && Math.floor(t * 14) % 2 === 0 && p.anim !== 'celebrate');

    // ---- expression
    let eyeScaleY = eyeOpen, browTilt = 0, browY = 0, pupilS = 1;
    switch (this.expr) {
      case 'determined': browTilt = 0.45; browY = -0.25; pupilS = 0.9; break;
      case 'startled': pupilS = 0.6; browY = 0.35; eyeScaleY *= 1.1; beakOpen = 0.6; break;
      case 'sulking': browTilt = -0.35; eyeScaleY *= 0.55; browY = -0.1; break;
      case 'victory': eyeScaleY *= 0.35; browY = 0.25; break;
      default: break;
    }
    this.eyes.forEach((e, i) => {
      e.scale.y = eyeScaleY;
      const side = i === 0 ? -1 : 1;
      this.brows[i].visible = this.expr === 'determined' || this.expr === 'sulking';
      this.brows[i].rotation.z = browTilt * -side;
      this.brows[i].position.y = (this.brows[i].scale.x / 0.75) * (1.3 + browY);
      this.pupils[i].scale.set(this.pupils[i].scale.x, this.pupils[i].scale.y, this.pupils[i].scale.z);
      void pupilS;
    });
    this.beakBot.rotation.x = Math.max(this.beakBot.rotation.x, beakOpen * 0.4);
  }

  dispose() {
    this.root.traverse((o) => { if ((o as THREE.Mesh).geometry && !geoCache.has('x')) { /* shared geometries are cached */ } });
    for (const m of this.materials) m.dispose();
  }
}

function lighten(c: number, k: number) {
  const r = Math.min(255, ((c >> 16) & 255) * k), g = Math.min(255, ((c >> 8) & 255) * k), b = Math.min(255, (c & 255) * k);
  return (r << 16) | (g << 8) | b;
}
