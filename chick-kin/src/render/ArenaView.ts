// Builds the 3D scene for one arena and syncs dynamic entities from the simulation each frame.
import * as THREE from 'three';
import type { ArenaRuntime, Ent } from '../sim/arena';
import type { Actor } from '../sim/actor';
import type { EntityDef } from '../sim/types';
import * as P from './props';
import { buildBackdrop } from './themes';
import { CLASS_INFO } from '../data/classes';

export const SIDE_DEPTH = 2.6;
/** Side-view depth lanes so siblings can pass each other (player nearest the camera). */
export const laneZ = (slot: number, isPlayer: boolean) => (isPlayer ? 0.45 : [0.1, -0.25, -0.6][slot % 3]);

export class ArenaView {
  readonly group = new THREE.Group();
  private objs = new Map<number, THREE.Object3D>();
  private loose = new Map<number, THREE.Object3D>();
  private t = 0;
  private side: boolean;
  private cornStacks = new Map<number, THREE.Group>();
  private rotors: THREE.Object3D[] = [];
  private spectators: THREE.Object3D[] = [];

  constructor(readonly ar: ArenaRuntime, private ownerColors: string[]) {
    this.side = ar.mode === 'side';
    const d = ar.def;
    this.group.add(buildBackdrop(d.theme, d.mode, d.w, d.h));
    this.buildSolids();
    ar.ents.forEach((e) => {
      const o = this.buildEnt(e);
      if (o) { this.objs.set(e.i, o); this.group.add(o); }
    });
    this.group.traverse((o) => {
      if (o.name === 'rotor') this.rotors.push(o);
      if (o.name === 'spectator') this.spectators.push(o);
    });
  }

  /** sim → world */
  pos(x: number, y: number, z = 0): THREE.Vector3 {
    return this.side ? new THREE.Vector3(x, y, z) : new THREE.Vector3(x, z, y);
  }

  private buildSolids() {
    const d = this.ar.def;
    const theme = d.theme;
    for (const s of this.ar.solids) {
      let o: THREE.Object3D;
      if (this.side) {
        const top = s.y + s.h;
        if (s.oneWay) {
          o = s.kind === 'beam' ? P.beam(s.w, 0.36, 1.1) : s.kind === 'catchbed' ? P.hayBale(s.w, 0.5, 2.2) : P.plankPlatform(s.w, 1.8, top > 1.4 && top < 4 ? 2 : 0);
          if (s.kind === 'catchbed') o.position.set(s.x + s.w / 2, top - 0.5, 0);
          else o.position.set(s.x + s.w / 2, top, 0);
        } else if (s.lowFence) {
          o = P.lowFenceGap(s.w, s.y - this.groundUnder(s.x + s.w / 2, s.y), 1.2);
          o.position.set(s.x + s.w / 2, this.groundUnder(s.x + s.w / 2, s.y), 0);
        } else if (s.kind === 'crate') {
          o = P.crate(s.w, s.h, 1.3); o.position.set(s.x + s.w / 2, s.y, 0);
        } else if (s.kind === 'hay') {
          o = P.hayBale(s.w, s.h, 1.6); o.position.set(s.x + s.w / 2, s.y, 0);
        } else if (s.kind === 'beam' || s.kind === 'post') {
          o = P.beam(s.w, s.h, 0.9); o.position.set(s.x + s.w / 2, top, 0);
        } else {
          const topMat = theme === 'championship' ? P.M.plank() : theme === 'coop' || theme === 'rafters' ? P.M.plank() : P.M.grass();
          const sideMat = theme === 'championship' ? P.M.wood() : P.M.woodDark();
          o = P.slab(s.w, Math.min(s.h, 6), SIDE_DEPTH + 0.6, s.kind === 'straw' ? P.M.straw() : topMat, s.kind === 'straw' ? P.M.hay() : sideMat);
          o.position.set(s.x + s.w / 2, top, 0);
        }
      } else {
        const cx = s.x + s.w / 2, cz = s.y + s.h / 2;
        const hgt = s.height;
        if (s.kind === 'nestrim') {
          const ang = Math.atan2(cz - d.h / 2, cx - d.w / 2);
          o = P.nestRim(Math.max(s.w, s.h) * 1.15, Math.min(s.w, s.h) * 1.1, hgt);
          o.rotation.y = -ang + Math.PI / 2;
          o.position.set(cx, 0, cz);
        } else if (s.kind === 'straw') {
          const along = s.w >= s.h;
          o = P.nestRim(Math.max(s.w, s.h), Math.min(s.w, s.h), Math.max(0.3, hgt));
          o.rotation.y = along ? 0 : Math.PI / 2;
          o.position.set(cx, 0, cz);
        } else if (s.kind === 'fence') {
          const along = s.w >= s.h;
          o = P.fence(Math.max(s.w, s.h), Math.min(1.2, hgt));
          o.rotation.y = along ? 0 : Math.PI / 2;
          o.position.set(cx, 0, cz);
        } else if (s.kind === 'crate') {
          o = P.crate(s.w, Math.min(hgt, 1.2), s.h); o.position.set(cx, 0, cz);
        } else if (s.kind === 'hay') {
          o = P.hayBale(s.w, Math.min(hgt, 1.2), s.h); o.position.set(cx, 0, cz);
        } else if (s.kind === 'water') {
          const pond = new THREE.Group();
          const wtr = new THREE.Mesh(new THREE.CircleGeometry(0.5, 32), P.M.water());
          wtr.rotation.x = -Math.PI / 2; wtr.scale.set(s.w, s.h, 1); wtr.position.y = 0.04;
          pond.add(wtr);
          const rim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 6, 32), new THREE.MeshStandardMaterial({ color: 0x8b8b80, roughness: 0.9 }));
          rim.rotation.x = Math.PI / 2; rim.scale.set(s.w, s.h, 1); rim.position.y = 0.05;
          pond.add(rim);
          o = pond; o.position.set(cx, 0, cz);
        } else if (s.kind === 'coop' || s.kind === 'wall') {
          const m = new THREE.Mesh(new THREE.BoxGeometry(s.w, hgt, s.h), s.kind === 'coop' ? P.M.red() : P.M.woodDark());
          m.castShadow = true; m.receiveShadow = true; m.position.y = hgt / 2;
          o = new THREE.Group(); o.add(m); o.position.set(cx, 0, cz);
        } else if (s.kind === 'stone') {
          const m = new THREE.Mesh(new THREE.BoxGeometry(s.w, hgt, s.h), new THREE.MeshStandardMaterial({ color: 0xa8a090, roughness: 0.95 }));
          m.castShadow = true; m.position.y = hgt / 2; o = new THREE.Group(); o.add(m); o.position.set(cx, 0, cz);
        } else {
          const m = new THREE.Mesh(new THREE.BoxGeometry(s.w, hgt, s.h), P.M.wood());
          m.castShadow = true; m.receiveShadow = true; m.position.y = hgt / 2; o = new THREE.Group(); o.add(m); o.position.set(cx, 0, cz);
        }
      }
      this.group.add(o);
    }
    // top-down floor inside the arena
    if (!this.side) {
      const floorMat = d.theme === 'nest' ? P.M.straw() : d.theme === 'farmyard' || d.theme === 'championship' ? P.M.dirt() : P.M.plank();
      const f = new THREE.Mesh(new THREE.PlaneGeometry(d.w, d.h), floorMat.clone());
      const fm = (f.material as THREE.MeshStandardMaterial);
      if (fm.map) { fm.map = fm.map.clone(); fm.map.needsUpdate = true; fm.map.repeat.set(d.w / 3, d.h / 3); }
      f.rotation.x = -Math.PI / 2; f.position.set(d.w / 2, 0.005, d.h / 2);
      f.receiveShadow = true;
      this.group.add(f);
    }
  }

  private groundUnder(x: number, y: number) {
    let best = 0;
    for (const s of this.ar.solids) if (!s.lowFence && x >= s.x && x <= s.x + s.w && s.y + s.h <= y + 0.01) best = Math.max(best, s.y + s.h);
    return best;
  }

  private buildEnt(e: Ent): THREE.Object3D | null {
    const d = e.def as EntityDef;
    let o: THREE.Object3D | null = null;
    switch (d.t) {
      case 'crumb': o = P.crumb(this.side ? 1.2 : 1.1); break;
      case 'feather': o = P.goldenFeather(); o.scale.setScalar(0.7); break;
      case 'power': o = P.powerUp(d.pu); break;
      case 'egg': o = P.egg((d.r ?? 0.35) * 2.4); break;
      case 'mud': o = P.mudPuddle(d.w, this.side ? 2.2 : d.h); break;
      case 'seed': o = P.seedSpill(d.w, this.side ? 2 : d.h); break;
      case 'wind': o = P.windGust(d.w, d.h); break;
      case 'spring': o = P.springBranch(d.w); break;
      case 'bucket': {
        const g = new THREE.Group();
        const pivot = new THREE.Group(); pivot.name = 'pivot';
        const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, d.len, 5), P.M.rope());
        rope.position.y = -d.len / 2; pivot.add(rope);
        const b = P.bucket(); b.position.y = -d.len - 0.55; b.name = 'bucket'; pivot.add(b);
        g.add(pivot);
        const bar = P.beam(1.4, 0.3, 0.5); bar.position.y = 0.3; g.add(bar);
        g.position.copy(this.pos(d.px, d.py));
        o = g; break;
      }
      case 'wobbly': o = P.wobblyLog(d.w); break;
      case 'straw': o = P.strawBarrier(d.w, this.side ? d.h : 0.9, this.side ? 1.6 : d.h); break;
      case 'bale': o = this.side ? P.roundBale(Math.min(d.w, d.h) / 2, 1.4) : P.hayBale(d.w, 1.0, d.h); break;
      case 'crate': o = P.crate(d.w, this.side ? d.h : 0.8, this.side ? 1.2 : d.h); break;
      case 'mover': o = P.moverCart(d.w, d.h); break;
      case 'tugworm': o = P.worm(); break;
      case 'perch': {
        if (this.side) { o = P.crownPerch(d.w); }
        else { o = new THREE.Group(); const ring = new THREE.Mesh(new THREE.RingGeometry(Math.min(d.w, d.h) * 0.42, Math.min(d.w, d.h) * 0.5, 32), new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.8 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.6; ring.name = 'ring'; o.add(ring); const cr = P.crownPerch(1); cr.scale.setScalar(0.6); cr.position.y = 0.4; o.add(cr); }
        break;
      }
      case 'finish': {
        o = this.side ? P.ribbonArch(SIDE_DEPTH + 0.8, true) : P.ribbonArch(Math.max(d.w, d.h), true);
        if (this.side) o.rotation.y = Math.PI / 2;
        break;
      }
      case 'checkpoint': o = P.lantern(false); break;
      case 'scratch': o = P.scratchPatch(); break;
      case 'basket': {
        const owner = d.owner ?? -1;
        const col = owner >= 0 ? new THREE.Color(this.ownerColors[owner] ?? '#ffffff').getHex() : 0xffffff;
        o = P.basket(d.r * 0.85, col); break;
      }
      case 'cornpile': { const g = P.cornPile(); const stack = new THREE.Group(); g.add(stack); this.cornStacks.set(e.i, stack); o = g; break; }
      case 'gate': o = P.gate(Math.max(d.w, d.h)); if (d.h > d.w) o.rotation.y = Math.PI / 2; break;
      case 'mound': o = P.moundPerch(d.r, d.elev); break;
      case 'deco': o = this.deco(d.kind, d.s ?? 1); if (d.r) o.rotation.y = d.r; break;
    }
    if (!o) return null;
    // initial placement
    if (d.t === 'perch' || d.t === 'finish' || d.t === 'mud' || d.t === 'seed' || d.t === 'wind' || d.t === 'straw' || d.t === 'bale' || d.t === 'crate' || d.t === 'mover' || d.t === 'gate') {
      const dd = d as { x: number; y: number; w: number; h: number };
      if (this.side) o.position.set(dd.x + dd.w / 2, d.t === 'wind' ? dd.y + dd.h * 0.3 : d.t === 'mud' || d.t === 'seed' ? dd.y + dd.h / 2 + 0.01 : dd.y, 0);
      else o.position.set(dd.x + dd.w / 2, 0, dd.y + dd.h / 2);
    } else if (d.t === 'spring' || d.t === 'wobbly') {
      o.position.copy(this.pos(d.x + d.w / 2, d.y + 0.3));
    } else if (d.t !== 'bucket' && d.t !== 'egg') {
      const dd = d as { x: number; y: number };
      o.position.copy(this.pos(dd.x, dd.y));
    }
    if (d.t === 'checkpoint' && this.side) o.position.z = -1.1;
    return o;
  }

  private deco(kind: string, s: number): THREE.Object3D {
    let o: THREE.Object3D;
    switch (kind) {
      case 'egg': o = P.egg(s); break;
      case 'flower': o = P.flower(); break;
      case 'hay': o = P.hayBale(1.4 * s, 0.9 * s, 1 * s); break;
      case 'mound': o = P.moundPerch(1.1 * s, 0.4 * s); break;
      case 'ribbon-start': o = P.ribbonArch(SIDE_DEPTH + 0.8, false); o.rotation.y = this.side ? Math.PI / 2 : 0; break;
      case 'ribbon-finish': o = new THREE.Group(); break;
      case 'barn': o = P.barn(s); break;
      case 'tree': o = P.tree(s); break;
      case 'windmill': o = P.windmill(s); break;
      case 'lantern': o = P.lantern(true); break;
      case 'trophy': o = P.trophy(); o.scale.setScalar(s); break;
      case 'bunting': o = P.bunting(6 * s); o.position.y = 3; break;
      case 'crate': o = P.crate(s, s, s); break;
      case 'ramp': { const r = new THREE.Mesh(new THREE.BoxGeometry(1.4 * s, 0.1, 0.8 * s), P.M.plank()); r.rotation.z = 0.35; r.position.y = 0.25 * s; r.castShadow = true; o = new THREE.Group(); o.add(r); break; }
      case 'scoreboard': { o = new THREE.Group(); const b = P.plankPlatform(2.4 * s, 0.3, 0); b.rotation.x = Math.PI / 2; b.position.y = 2.6 * s; o.add(b); const post = P.beam(0.25, 2.6 * s, 0.25); post.rotation.z = Math.PI / 2; o.add(post); break; }
      default: o = new THREE.Group();
    }
    return o;
  }

  /** Sync dynamic state. `player` lets checkpoint lanterns light up for the player's progress. */
  update(dt: number, player: Actor | null, perchOwnerColor: (id: number) => string) {
    this.t += dt;
    const t = this.t;
    for (const e of this.ar.ents) {
      const o = this.objs.get(e.i);
      if (!o) continue;
      const d = e.def;
      switch (e.t) {
        case 'crumb': case 'feather': case 'power': {
          o.visible = e.alive && !(e.t === 'feather' && player && (e.taken & (1 << player.id)));
          if (!e.alive) break;
          const bx = (d as { x: number }).x, by = (d as { y: number }).y;
          const base = this.side ? this.pos(bx, by - 0.15) : this.pos(bx, by, 0);
          o.position.set(base.x, base.y + (e.t === 'crumb' ? 0.08 : 0.35) + Math.sin(t * 3 + e.i) * 0.06, base.z);
          o.rotation.y = t * (e.t === 'feather' ? 1.6 : 1.2) + e.i;
          const glow = o.getObjectByName('glow');
          if (glow) glow.quaternion.copy(this.cameraQuat);
          break;
        }
        case 'egg': {
          const r = (d as { r?: number }).r ?? 0.35;
          o.visible = e.x > -900;
          if (!o.visible) break;
          const p = this.side ? this.pos(e.x + r, e.y - r * 0.2) : this.pos(e.x + r, e.y + r, 0);
          o.position.copy(p);
          if (e.warn) o.rotation.z = Math.sin(t * 30) * 0.15;
          else if (e.active) {
            const sp = Math.hypot(e.vx, e.vy);
            if (this.side) o.rotation.z -= (e.vx * dt) / r;
            else { o.rotation.x += (sp * dt) / r * Math.sign(e.vy || 1); o.rotation.y = Math.atan2(e.vx, e.vy); }
          }
          break;
        }
        case 'bucket': {
          const pivot = o.getObjectByName('pivot')!;
          pivot.rotation.z = e.angle;
          break;
        }
        case 'wobbly': {
          const tilt = o.getObjectByName('tilt')!;
          tilt.rotation.z = -e.angle;
          break;
        }
        case 'spring': {
          const br = o.getObjectByName('branch');
          if (br) br.scale.y = 1 + Math.sin(e.phase * Math.PI * 2) * 0.08;
          break;
        }
        case 'wind': {
          o.visible = e.active || e.warn;
          o.children.forEach((c, i) => { c.rotation.z = t * (e.active ? 5 : 1.5) + i; (c as THREE.Mesh).scale.setScalar(e.active ? 1 : 0.6); });
          const dw = d as { x: number; y: number; w: number; h: number };
          o.position.copy(this.side ? this.pos(dw.x + dw.w / 2, dw.y + dw.h / 2) : this.pos(dw.x + dw.w / 2, dw.y + dw.h / 2, 0.6));
          break;
        }
        case 'straw': case 'bale': case 'crate': case 'mover': {
          o.visible = e.alive;
          if (this.side) o.position.set(e.x + e.w / 2, e.y, 0);
          else o.position.set(e.x + e.w / 2, 0, e.y + e.h / 2);
          if (e.t === 'straw' && e.alive) { const k = 0.85 + 0.15 * (e.hp / 3); o.scale.set(1, k, 1); }
          if (e.t === 'bale' && this.side) { const c = o.children[0]; if (c) c.rotation.y = 0; o.rotation.z = -(e.x) / 0.6; o.position.y = e.y; o.children.forEach((ch) => ch.position.setY(ch.position.y)); }
          break;
        }
        case 'tugworm': {
          o.visible = e.alive;
          const pulled = Math.max(...e.tug);
          o.scale.set(1, 1 + pulled * 0.8, 1);
          o.rotation.z = Math.sin(t * 6 + e.i) * 0.12;
          break;
        }
        case 'perch': {
          const crown = o.getObjectByName('crown');
          if (crown) { crown.rotation.y = t; crown.position.y = 1.5 + Math.sin(t * 2) * 0.08; }
          const ring = o.getObjectByName('ring') as THREE.Mesh | undefined;
          if (ring) {
            const mm = ring.material as THREE.MeshBasicMaterial;
            mm.color.set(e.owner >= 0 ? perchOwnerColor(e.owner) : e.active ? '#ffffff' : '#ffd23a');
            ring.rotation.z = t * 0.5;
          }
          break;
        }
        case 'checkpoint': {
          const lit = !!player && player.cpIdx >= e.i;
          const glass = o.getObjectByName('glass') as THREE.Mesh | undefined;
          if (glass) {
            const mm = glass.material as THREE.MeshStandardMaterial;
            if (lit && mm.emissiveIntensity === 0) glass.material = (P.lantern(true).getObjectByName('glass') as THREE.Mesh).material;
          }
          break;
        }
        case 'scratch': {
          o.children.forEach((c) => { if (c.name === 'seed') c.visible = e.alive; });
          break;
        }
        case 'cornpile': {
          const stack = this.cornStacks.get(e.i)!;
          while (stack.children.length > e.count) stack.remove(stack.children[stack.children.length - 1]);
          while (stack.children.length < e.count) {
            const i = stack.children.length;
            const b = P.cornBundle();
            b.position.set(Math.cos(i * 2.4) * 0.35, 0.1 + Math.floor(i / 3) * 0.25, Math.sin(i * 2.4) * 0.35);
            b.rotation.y = i;
            stack.add(b);
          }
          break;
        }
        case 'gate': {
          const door = o.getObjectByName('door');
          if (door) door.rotation.y += ((e.active ? -1.5 : 0) - door.rotation.y) * Math.min(1, dt * 6);
          break;
        }
        default: break;
      }
    }
    // loose items
    const seen = new Set<number>();
    for (const l of this.ar.loose) {
      if (!l.alive) continue;
      seen.add(l.id);
      let o = this.loose.get(l.id);
      if (!o) {
        o = l.kind === 'bundle' ? P.cornBundle() : l.kind === 'crumb' ? P.crumb(1.1) : P.treat();
        this.loose.set(l.id, o);
        this.group.add(o);
      }
      const hop = l.t < 0.35 ? Math.sin((l.t / 0.35) * Math.PI) * 0.5 : Math.sin(t * 3 + l.id) * 0.03;
      o.position.copy(this.pos(l.x, l.y, hop));
      o.rotation.y = t + l.id;
    }
    for (const [id, o] of this.loose) if (!seen.has(id)) { this.group.remove(o); this.loose.delete(id); }
    for (const r of this.rotors) r.rotation.z = t * 0.6;
    this.spectators.forEach((s, i) => { s.position.y = 1.5 + Math.abs(Math.sin(t * 4 + i)) * (i % 3 === 0 ? 0.25 : 0.06); });
  }

  cameraQuat = new THREE.Quaternion();

  /** Owner colours for baskets / perch (class UI colours by actor id). */
  static colorsFor(actors: Actor[]) { return actors.map((a) => CLASS_INFO[a.cls].colors.ui); }

  dispose() {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
  }
}
