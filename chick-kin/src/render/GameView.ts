// Presentation of a running Match: arena views, chick models, FX and camera. Reacts to sim events only.
import * as THREE from 'three';
import type { Renderer } from './Renderer';
import type { Match } from '../sim/match';
import type { SimEvent } from '../sim/events';
import type { Actor } from '../sim/actor';
import type { ArenaRuntime } from '../sim/arena';
import { ArenaView, laneZ } from './ArenaView';
import { ChickModel } from './ChickModel';
import { CameraDirector } from './CameraDirector';
import { Fx } from './Fx';
import { applyLook } from './themes';
import { CLASS_INFO } from '../data/classes';
import * as P from './props';

interface Snap { x: number; y: number; z: number }

export class GameView {
  readonly root = new THREE.Group();
  private views = new Map<ArenaRuntime, ArenaView>();
  private models: ChickModel[] = [];
  private prev: Snap[] = [];
  private curr: Snap[] = [];
  readonly cam: CameraDirector;
  readonly fx = new Fx();
  private activeArena: ArenaRuntime | null = null;
  private colors: string[];
  reducedMotion = false;

  constructor(private r: Renderer, private m: Match) {
    this.cam = new CameraDirector(r.camera);
    r.scene.add(this.root);
    this.root.add(this.fx.group);
    this.colors = ArenaView.colorsFor(m.actors);
    m.actors.forEach((a) => {
      const cm = new ChickModel(a.cls, a.stage);
      this.models.push(cm);
      this.root.add(cm.root);
    });
    this.snapshot();
    this.snapshot();
    this.syncArena(true);
  }

  private snapshot() {
    this.prev = this.curr;
    this.curr = this.m.actors.map((a) => ({ x: a.x, y: a.y, z: a.z }));
    if (!this.prev.length) this.prev = this.curr;
  }
  /** Call after each fixed simulation step. */
  afterStep() { this.snapshot(); }

  private viewFor(ar: ArenaRuntime) {
    let v = this.views.get(ar);
    if (!v) { v = new ArenaView(ar, this.colors, this.m.actors.map((a) => (a.isPlayer ? 'YOU' : a.name))); this.views.set(ar, v); this.root.add(v.group); }
    return v;
  }

  /** Show the player's current arena (relay legs / showdown rounds change it). */
  private syncArena(force = false) {
    const ar = this.m.arenaOf(this.m.player);
    if (ar === this.activeArena && !force) return;
    // drop views for arenas no longer in the match (showdown rounds rebuild arenas)
    for (const [k, v] of this.views) if (!this.m.arenas.includes(k)) { this.root.remove(v.group); v.dispose(); this.views.delete(k); }
    this.activeArena = ar;
    for (const [k, v] of this.views) v.group.visible = k === ar;
    this.viewFor(ar).group.visible = true;
    const look = applyLook(this.r.scene, ar.def.theme);
    this.r.setLighting({ sun: look.sun, sunI: look.sunI, sky: look.skyLight, ground: look.groundLight, hemiI: look.hemiI, dir: look.dir, exposure: look.exposure });
    this.cam.reset();
    this.fx.clear();
  }

  update(dt: number, alpha: number) {
    this.syncArena();
    const ar = this.activeArena!;
    const view = this.viewFor(ar);
    view.cameraQuat.copy(this.r.camera.quaternion);
    view.update(dt, this.m.player, (id) => this.colors[id]);
    const side = ar.mode === 'side';
    let rivalSlot = 0;
    this.m.actors.forEach((a, i) => {
      const cm = this.models[i];
      const inArena = this.m.arenaOf(a) === ar && this.m.participants().includes(a);
      cm.root.visible = inArena;
      if (!inArena) { if (!a.isPlayer) rivalSlot++; return; }
      const p = this.prev[i] ?? this.curr[i], c = this.curr[i];
      const x = p.x + (c.x - p.x) * alpha, y = p.y + (c.y - p.y) * alpha, z = p.z + (c.z - p.z) * alpha;
      const s = this.modelScale(a, side);
      cm.root.scale.setScalar(s);
      if (side) {
        cm.root.position.set(x, y, laneZ(rivalSlot, a.isPlayer));
        // three-quarter facing toward the camera keeps faces readable
        const target = a.facing > 0 ? Math.PI / 2 - 0.55 : -Math.PI / 2 + 0.55;
        cm.root.rotation.y += angleLerp(cm.root.rotation.y, target, Math.min(1, dt * 14));
        cm.setShadowHeight(0);
      } else {
        const elev = this.elevation(ar, x, y);
        cm.root.position.set(x, z + elev, y);
        const target = Math.atan2(Math.cos(a.heading), Math.sin(a.heading));
        cm.root.rotation.y += angleLerp(cm.root.rotation.y, target, Math.min(1, dt * 12));
        cm.setShadowHeight(z / s);
      }
      if (!a.isPlayer) rivalSlot++;
      cm.setCarry(a.carryBundle ? 'bundle' : a.carryTreats > 0 ? 'treat' : a.interactTarget >= 0 && ar.ents[a.interactTarget]?.t === 'tugworm' ? null : null, (k) => (k === 'bundle' ? P.cornBundle() : P.treat()));
      cm.update(dt, { anim: a.anim, speed: Math.hypot(a.vx, side ? 0 : a.vy), vy: a.vy, grounded: a.grounded, protect: a.protectT > 0 && a.stunT <= 0 });
    });
    const pl = this.m.player;
    const pc = this.curr[pl.id];
    const others = this.m.actors.filter((a) => a !== pl && this.m.arenaOf(a) === ar).map((a) => ({ x: a.x, y: a.y }));
    this.cam.update(dt, ar.def, { x: pc.x, y: pc.y, facing: pl.facing, others });
    const f = this.cam.focusPoint;
    this.r.focusShadows(f.x, f.y, f.z, side ? 14 : Math.max(ar.def.w, ar.def.h) * 0.7);
    this.fx.update(dt);
  }

  private modelScale(a: Actor, side: boolean) {
    // Match the collider: side height ≈ actor height; top-down diameter ≈ 2.3 × radius
    const base = side ? a.h / 0.95 : (a.r * 2.4) / 0.95;
    return base * (a.cls === 'mighty' ? 1.0 : 1);
  }

  private elevation(ar: ArenaRuntime, x: number, y: number) {
    for (const e of ar.ents) if (e.t === 'mound') { const d = e.def as { x: number; y: number; r: number; elev: number }; const k = Math.hypot(x - d.x, y - d.y) / d.r; if (k < 1) return d.elev * Math.min(1, (1 - k) * 2.2); }
    return 0;
  }

  world(x: number, y: number, z = 0) { return this.activeArena?.mode === 'side' ? new THREE.Vector3(x, y, z) : new THREE.Vector3(x, z, y); }

  onEvents(evs: SimEvent[]) {
    const pl = this.m.player;
    for (const e of evs) {
      const own = 'a' in e ? this.m.actors[(e as { a: number }).a] : null;
      if (own && this.m.arenaOf(own) !== this.activeArena) continue;
      const at = (x: number, y: number, up = 0.3) => this.world(x, y + (this.activeArena?.mode === 'side' ? up : 0), this.activeArena?.mode === 'side' ? 0.4 : up);
      switch (e.type) {
        case 'pickup':
          if (e.item === 'feather') this.fx.emit('star', at(e.x, e.y), 14, { speed: 2.5, up: 2.5, size: 0.35 });
          else this.fx.emit('sparkle', at(e.x, e.y), e.value > 1 ? 10 : 6, { speed: 1.6, up: 1.8, size: 0.22 });
          if (own) this.models[own.id].setExpression('happy', 0.4);
          break;
        case 'power': this.fx.emit('ring', at(e.x, e.y, 0.4), 3, { color: '#ffffff', speed: 0.3, up: 0.2, size: 0.6, life: 0.5 }); this.fx.emit('sparkle', at(e.x, e.y), 10, { speed: 2.2, up: 2, size: 0.25 }); break;
        case 'land': if (Math.abs(e.speed) > 7) this.fx.emit('dust', at(e.x, e.y, 0.05), 5, { speed: 1.5, up: 0.4, size: 0.4, life: 0.5 }); if (own === pl && Math.abs(e.speed) > 12) this.cam.shake(0.05); break;
        case 'jump': this.fx.emit('dust', at(e.x, e.y, 0.05), 3, { speed: 1, up: 0.3, size: 0.3, life: 0.4 }); break;
        case 'flap': this.fx.emit('feather', at(e.x, e.y, 0.3), 2, { color: own ? CLASS_INFO[own.cls].colors.accent : '#fff', speed: 1, up: 0.2, size: 0.18, life: 1.2 }); break;
        case 'bump': {
          this.fx.emit('feather', at(e.x, e.y, 0.5), 6, { color: own ? CLASS_INFO[own.cls].colors.accent : '#fff', speed: 2.5, up: 2, size: 0.2, life: 1.3 });
          this.fx.emit('star', at(e.x, e.y, 0.8), 4, { speed: 1.5, up: 1.2, size: 0.25, life: 0.6 });
          if (own) this.models[own.id].setExpression('startled', 0.8);
          if (own === pl) this.cam.shake(0.12);
          break;
        }
        case 'shield': this.fx.emit('ring', at(e.x, e.y, 0.4), 2, { color: '#bfe6ff', speed: 0.2, up: 0, size: 0.9, life: 0.5 }); break;
        case 'dodge': this.fx.emit('feather', at(e.x, e.y, 0.4), 5, { color: '#7fe3dc', speed: 2, up: 1, size: 0.2, life: 0.8 }); break;
        case 'ability': {
          if (!own) break;
          if (own.cls === 'speedy') this.fx.emit('speed', at(e.x, e.y, 0.4), 8, { speed: 0.5, up: 0.2, size: 0.3, life: 0.4 });
          if (own.cls === 'mighty') { this.fx.emit('ring', at(e.x, e.y, 0.4), 2, { color: '#ffb08a', speed: 0.1, up: 0, size: 0.8, life: 0.4 }); if (own === pl) this.cam.shake(0.08); }
          if (own.cls === 'nimble') this.fx.emit('feather', at(e.x, e.y, 0.4), 8, { color: '#7fe3dc', speed: 2.2, up: 1.5, size: 0.22, life: 1 });
          break;
        }
        case 'break': this.fx.emit('straw', at(e.x, e.y, 0), 16, { speed: 3, up: 3, size: 0.25, life: 0.9 }); if (this.activeArena?.mode === 'side') this.cam.shake(0.06); break;
        case 'mud': this.fx.emit('mud', at(e.x, e.y, 0.05), 6, { speed: 1.5, up: 1.5, size: 0.18 }); break;
        case 'scratch': this.fx.emit('dust', at(e.x, e.y, 0.05), 2, { speed: 1, up: 0.8, size: 0.25, life: 0.4 }); break;
        case 'deliver': this.fx.emit('sparkle', at(e.x, e.y, 0.6), 12, { speed: 2, up: 2.5, size: 0.3 }); this.fx.emit('heart', at(e.x, e.y, 0.8), 2, { speed: 0.5, up: 1.2, size: 0.3, life: 1 }); break;
        case 'tugWin': this.fx.emit('heart', at(e.x, e.y, 0.6), 4, { speed: 1, up: 1.5, size: 0.3, life: 1 }); break;
        case 'respawn': this.fx.emit('feather', at(e.x, e.y, 0.4), 6, { color: '#ffffff', speed: 1.5, up: 1, size: 0.2, life: 1 }); break;
        case 'checkpoint': if (own === pl) this.fx.emit('sparkle', at(e.x, e.y, 1.3), 8, { speed: 1, up: 1, size: 0.25 }); break;
        case 'spring': this.fx.emit('dust', at(e.x, e.y, 0.1), 4, { color: '#9cd46a', speed: 1.5, up: 1, size: 0.25 }); break;
        case 'complete': if (own) { this.models[own.id].setExpression('victory', 3); this.fx.emit('star', at(own.x, own.y, 1), 12, { speed: 2, up: 3, size: 0.3, life: 1 }); } break;
        case 'perchClaim': if (own) this.models[own.id].setExpression('determined', 1); break;
        default: break;
      }
    }
  }

  /** Final reactions: winner celebrates, the others sulk briefly. */
  react(order: number[]) {
    order.forEach((id, i) => this.models[id]?.setExpression(i === 0 ? 'victory' : i === order.length - 1 ? 'sulking' : 'happy', 5));
  }

  dispose() {
    this.r.scene.remove(this.root);
    for (const v of this.views.values()) v.dispose();
    for (const m of this.models) m.dispose();
  }
}

function angleLerp(from: number, to: number, k: number) {
  const d = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return d * k;
}
