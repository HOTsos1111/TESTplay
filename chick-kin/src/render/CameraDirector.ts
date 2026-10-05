// Camera framing per chapter format, with smoothing, bounds, look-ahead and adjustable shake.
import * as THREE from 'three';
import type { ArenaDef } from '../sim/types';

export interface Focus { x: number; y: number; facing: number; others: { x: number; y: number }[] }

export class CameraDirector {
  private pos = new THREE.Vector3();
  private look = new THREE.Vector3();
  private shakeT = 0;
  private shakeA = 0;
  shakeScale = 1;
  private init = false;
  /** Brief reorientation when the arena (relay leg / round / growth) changes. */
  private blend = 0;

  constructor(private cam: THREE.PerspectiveCamera) {}

  reset() { this.init = false; this.blend = 0; }
  shake(a: number, t = 0.25) { if (this.shakeScale <= 0) return; this.shakeA = Math.max(this.shakeA, a * this.shakeScale); this.shakeT = Math.max(this.shakeT, t); }

  update(dt: number, arena: ArenaDef, f: Focus) {
    const mode = arena.camera ?? (arena.mode === 'side' ? 'follow' : 'three-quarter');
    const tp = new THREE.Vector3();
    const tl = new THREE.Vector3();
    const aspect = this.cam.aspect;
    if (arena.mode === 'side') {
      // keep the player plus nearby siblings in view; pull back a little when they spread out
      let minX = f.x, maxX = f.x, minY = f.y, maxY = f.y;
      for (const o of f.others) {
        if (Math.abs(o.x - f.x) < 9 && Math.abs(o.y - f.y) < 6) { minX = Math.min(minX, o.x); maxX = Math.max(maxX, o.x); minY = Math.min(minY, o.y); maxY = Math.max(maxY, o.y); }
      }
      const vertical = mode === 'vertical';
      const spread = Math.max(maxX - minX, (maxY - minY) * aspect);
      const dist = THREE.MathUtils.clamp((vertical ? 13 : 10.5) + spread * 0.35, vertical ? 13 : 10, vertical ? 17 : 15) / Math.min(1, aspect / 1.5);
      const cx = THREE.MathUtils.clamp((minX + maxX) / 2 * 0.4 + f.x * 0.6 + f.facing * (vertical ? 0.6 : 1.8), 6, arena.w - 6);
      const cy = (minY + maxY) / 2 * 0.3 + f.y * 0.7 + (vertical ? 1.4 : 1.6);
      tl.set(cx, cy, 0);
      tp.set(cx, cy + (vertical ? 1.8 : 2.4), dist);
    } else {
      const fit = Math.max(arena.w / aspect, arena.h) ;
      if (mode === 'close' || mode === 'overhead') {
        // whole nest in frame, gently following the player
        const H = THREE.MathUtils.clamp(fit * 0.95, 9, 20);
        const cx = arena.w / 2 + (f.x - arena.w / 2) * 0.18;
        const cz = arena.h / 2 + (f.y - arena.h / 2) * 0.15;
        tl.set(cx, 0, cz + 0.4);
        tp.set(cx, H, cz + H * 0.62);
      } else {
        const H = 11.5;
        const cx = THREE.MathUtils.clamp(f.x, Math.min(arena.w / 2, 7), Math.max(arena.w / 2, arena.w - 7));
        const cz = THREE.MathUtils.clamp(f.y, Math.min(arena.h / 2, 4.5), Math.max(arena.h / 2, arena.h - 5));
        tl.set(cx, 0, cz + 0.6);
        tp.set(cx, H, cz + H * 0.78);
      }
    }
    if (!this.init) { this.pos.copy(tp); this.look.copy(tl); this.init = true; }
    this.blend = Math.min(1, this.blend + dt * 0.8);
    const k = 1 - Math.exp(-dt * (arena.mode === 'side' ? 5 : 4) * (0.4 + this.blend * 0.6));
    this.pos.lerp(tp, k);
    this.look.lerp(tl, k);
    this.cam.position.copy(this.pos);
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeA * Math.max(0, this.shakeT) * 4;
      this.cam.position.x += (Math.random() - 0.5) * a;
      this.cam.position.y += (Math.random() - 0.5) * a;
      if (this.shakeT <= 0) this.shakeA = 0;
    }
    this.cam.lookAt(this.look);
  }

  get focusPoint() { return this.look; }
}
