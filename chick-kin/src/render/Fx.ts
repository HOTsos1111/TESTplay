// Lightweight pooled particle FX (sprites). Intensity respects reduced-motion / flash settings.
import * as THREE from 'three';
import { radialTex } from './textures';

type Kind = 'sparkle' | 'dust' | 'feather' | 'straw' | 'mud' | 'speed' | 'heart' | 'ring' | 'star';
interface Particle { s: THREE.Sprite; life: number; max: number; vx: number; vy: number; vz: number; g: number; spin: number; grow: number; kind: Kind }

const COLORS: Record<Kind, string> = { sparkle: '#fff2a8', dust: '#d8c3a0', feather: '#ffffff', straw: '#e8c25a', mud: '#5c3a1e', speed: '#fff8e0', heart: '#ff7aa0', ring: '#ffe27a', star: '#ffd23a' };

export class Fx {
  readonly group = new THREE.Group();
  private pool: Particle[] = [];
  private live: Particle[] = [];
  private mats = new Map<string, THREE.SpriteMaterial>();
  intensity = 1;

  private matFor(kind: Kind, color?: string) {
    const c = color ?? COLORS[kind];
    const key = kind + c;
    let m = this.mats.get(key);
    if (!m) {
      const tex = kind === 'feather' || kind === 'straw' ? radialTex(c, 'rgba(255,255,255,0)', 'fx-soft-' + c) : radialTex(c, 'rgba(255,255,255,0)', 'fx-' + c);
      m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: kind === 'sparkle' || kind === 'ring' || kind === 'star' || kind === 'speed' ? THREE.AdditiveBlending : THREE.NormalBlending });
      this.mats.set(key, m);
    }
    return m;
  }

  emit(kind: Kind, pos: THREE.Vector3, n: number, opts: { color?: string; speed?: number; up?: number; size?: number; life?: number; dir?: THREE.Vector3 } = {}) {
    const count = Math.max(1, Math.round(n * this.intensity));
    for (let i = 0; i < count; i++) {
      let p = this.pool.pop();
      const tpl = this.matFor(kind, opts.color);
      if (!p) {
        const s = new THREE.Sprite(tpl.clone());
        p = { s, life: 0, max: 1, vx: 0, vy: 0, vz: 0, g: 0, spin: 0, grow: 0, kind };
      }
      p.kind = kind;
      p.s.material.map = tpl.map;
      p.s.material.blending = tpl.blending;
      p.s.material.needsUpdate = true;
      const sp = opts.speed ?? 2;
      const a = Math.random() * Math.PI * 2;
      const e = Math.random();
      p.vx = Math.cos(a) * sp * e + (opts.dir?.x ?? 0);
      p.vz = Math.sin(a) * sp * e + (opts.dir?.z ?? 0);
      p.vy = (opts.up ?? 2) * (0.5 + Math.random() * 0.8) + (opts.dir?.y ?? 0);
      p.g = kind === 'sparkle' || kind === 'ring' || kind === 'speed' ? 0 : kind === 'feather' ? 2 : 9;
      p.max = p.life = (opts.life ?? 0.7) * (0.7 + Math.random() * 0.6);
      const size = (opts.size ?? 0.25) * (0.6 + Math.random() * 0.8);
      p.s.scale.setScalar(size);
      p.grow = kind === 'ring' ? 3 : kind === 'dust' ? 0.8 : 0;
      p.spin = (Math.random() - 0.5) * 6;
      p.s.position.copy(pos);
      p.s.material.rotation = Math.random() * 6;
      this.group.add(p.s);
      this.live.push(p);
    }
  }

  update(dt: number) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.group.remove(p.s);
        this.live.splice(i, 1);
        this.pool.push(p);
        continue;
      }
      p.vy -= p.g * dt;
      if (p.kind === 'feather') { p.vx *= 0.96; p.vz *= 0.96; p.vy = Math.max(p.vy, -0.8); }
      p.s.position.x += p.vx * dt;
      p.s.position.y += p.vy * dt;
      p.s.position.z += p.vz * dt;
      const k = p.life / p.max;
      p.s.material.opacity = Math.min(1, k * 2);
      if (p.grow) p.s.scale.multiplyScalar(1 + p.grow * dt);
    }
  }

  clear() {
    for (const p of this.live) { this.group.remove(p.s); this.pool.push(p); }
    this.live = [];
  }
}
