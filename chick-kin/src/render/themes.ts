// Per-chapter look: lighting, sky, fog and backdrop dressing (kept outside critical sightlines).
import * as THREE from 'three';
import type { Theme } from '../sim/types';
import { skyTex, woodTex } from './textures';
import * as P from './props';

export interface ThemeLook {
  sky: [string, string, string];
  fog: number; fogNear: number; fogFar: number;
  sun: number; sunI: number; skyLight: number; groundLight: number; hemiI: number; dir: [number, number, number]; exposure: number;
}

export const LOOKS: Record<Theme, ThemeLook> = {
  nest: { sky: ['#f6d9a6', '#f3c88a', '#e7b06a'], fog: 0xe9c48c, fogNear: 30, fogFar: 70, sun: 0xffd29a, sunI: 2.6, skyLight: 0xfff0d6, groundLight: 0x9a7444, hemiI: 1.25, dir: [0.4, 1, 0.55], exposure: 1.05 },
  coop: { sky: ['#5a3a22', '#7a5233', '#b07a45'], fog: 0x6b4a2f, fogNear: 22, fogFar: 60, sun: 0xffc983, sunI: 2.5, skyLight: 0xffe2b8, groundLight: 0x6b4a2f, hemiI: 1.35, dir: [0.35, 1, 0.75], exposure: 1.1 },
  rafters: { sky: ['#3b2618', '#5e3d25', '#8a5d36'], fog: 0x4f3420, fogNear: 22, fogFar: 60, sun: 0xffc27a, sunI: 2.6, skyLight: 0xffdcae, groundLight: 0x5b3c22, hemiI: 1.3, dir: [-0.3, 1, 0.7], exposure: 1.12 },
  farmyard: { sky: ['#8ec7ea', '#cfe6ef', '#f7e2b8'], fog: 0xe8e0c8, fogNear: 35, fogFar: 90, sun: 0xffdca8, sunI: 2.8, skyLight: 0xe8f2ff, groundLight: 0x7a8a4a, hemiI: 1.15, dir: [0.5, 1, 0.45], exposure: 1.0 },
  championship: { sky: ['#f4b97a', '#f9d6a0', '#fbe7c4'], fog: 0xf3d4a6, fogNear: 35, fogFar: 95, sun: 0xffc88a, sunI: 2.7, skyLight: 0xfff0d0, groundLight: 0x8a6a3a, hemiI: 1.2, dir: [0.6, 0.9, 0.5], exposure: 1.04 },
};

export function applyLook(scene: THREE.Scene, theme: Theme) {
  const L = LOOKS[theme];
  scene.background = skyTex(L.sky[0], L.sky[1], L.sky[2], 'sky:' + theme);
  scene.fog = new THREE.Fog(L.fog, L.fogNear, L.fogFar);
  return L;
}

/** Backdrop dressing for side arenas (behind the play lane) and top-down arenas (around the arena). */
export function buildBackdrop(theme: Theme, mode: 'side' | 'top', w: number, h: number): THREE.Group {
  const g = new THREE.Group();
  const rnd = (i: number) => { const a = Math.sin(i * 91.17) * 43758.5; return a - Math.floor(a); };
  if (mode === 'side') {
    if (theme === 'coop' || theme === 'rafters') {
      const wallTex = woodTex(theme === 'coop' ? 0x8a5a32 : 0x6e4628, 6, 'wall' + theme).clone();
      wallTex.needsUpdate = true;
      wallTex.repeat.set((w + 40) / 6, (h + 20) / 6);
      wallTex.rotation = Math.PI / 2;
      const back = new THREE.Mesh(new THREE.PlaneGeometry(w + 40, h + 24), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95 }));
      back.position.set(w / 2, h / 2 + 2, -6);
      back.receiveShadow = true;
      g.add(back);
      // windows with warm light
      for (let x = 4; x < w; x += 14) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.8), new THREE.MeshStandardMaterial({ color: 0xffe2a8, emissive: 0xffc06a, emissiveIntensity: 1.2 }));
        win.position.set(x + rnd(x) * 4, (theme === 'rafters' ? 4 + rnd(x + 1) * (h - 4) : 3.6), -5.95);
        g.add(win);
        const fr = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 0.15), new THREE.MeshStandardMaterial({ color: 0x4a2e18 }));
        fr.position.set(win.position.x, win.position.y, -5.9);
        g.add(fr);
        const fr2 = fr.clone(); fr2.rotation.z = Math.PI / 2; fr2.scale.x = 0.75; g.add(fr2);
        // light shaft
        const shaft = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 9), new THREE.MeshBasicMaterial({ color: 0xffd08a, transparent: true, opacity: 0.08, depthWrite: false, blending: THREE.AdditiveBlending }));
        shaft.position.set(win.position.x + 2, win.position.y - 3.5, -3);
        shaft.rotation.z = 0.5;
        g.add(shaft);
      }
      // posts
      for (let x = -6; x < w + 10; x += 9) {
        const post = P.beam(0.5, h + 14, 0.5);
        post.rotation.z = Math.PI / 2;
        post.position.set(x, -6, -4.8);
        g.add(post);
      }
      // background hay and roosts
      for (let x = 2; x < w; x += 7) {
        const hb = P.hayBale(1.6, 1, 1.1);
        hb.position.set(x + rnd(x) * 3, -0.05, -4 + rnd(x + 3));
        g.add(hb);
      }
      if (theme === 'rafters') {
        for (let x = 3; x < w; x += 6) {
          const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, h + 4, 5), P.M.rope());
          rope.position.set(x + rnd(x) * 2, h / 2 + 4, -3.5);
          g.add(rope);
        }
        for (let y = 6; y < h + 6; y += 6) {
          const rb = P.beam(w + 30, 0.5, 0.6);
          rb.position.set(w / 2, y, -5.3);
          g.add(rb);
        }
      }
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(w + 60, 14), new THREE.MeshStandardMaterial({ map: woodTex(0x7a5030, 3, 'floorfar'), roughness: 1 }));
      floor.rotation.x = -Math.PI / 2; floor.position.set(w / 2, -4, -3);
      g.add(floor);
    } else {
      // outdoor side events (championship): fairground
      const grass = new THREE.Mesh(new THREE.PlaneGeometry(w + 120, 80), P.M.grass());
      ((grass.material as THREE.MeshStandardMaterial).map as THREE.Texture).repeat.set(30, 20);
      grass.rotation.x = -Math.PI / 2; grass.position.set(w / 2, -0.6, -38);
      grass.receiveShadow = true;
      g.add(grass);
      for (let x = -10; x < w + 20; x += 18) {
        const b = P.barn(1.2); b.position.set(x + rnd(x) * 6, -0.6, -26 - rnd(x + 2) * 8); g.add(b);
        const t = P.tree(1.3); t.position.set(x + 8, -0.6, -18 - rnd(x) * 6); g.add(t);
      }
      const wm = P.windmill(1.3); wm.position.set(w * 0.6, -0.6, -30); g.add(wm);
      for (let x = 0; x < w; x += 12) { const bu = P.bunting(12); bu.position.set(x + 6, 5.5, -2.5); g.add(bu); }
      // stands with spectators
      for (let x = 0; x < w; x += 6) {
        const st = P.plankPlatform(6, 2, 0); st.position.set(x + 3, 1.2, -7); g.add(st);
        for (let i = 0; i < 4; i++) {
          const blob = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshStandardMaterial({ color: [0xf2f0e8, 0xc98b4a, 0x8c5a3a, 0xf6d36a][(x + i) % 4], roughness: 0.9 }));
          blob.position.set(x + 0.8 + i * 1.4, 1.5, -7 + (i % 2) * 0.4);
          blob.name = 'spectator';
          g.add(blob);
        }
      }
    }
  } else {
    // top-down surround
    const groundMat = theme === 'farmyard' || theme === 'championship' ? P.M.grass() : theme === 'nest' ? P.M.hay() : P.M.dirt();
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(w + 60, h + 60), groundMat);
    const map = (ground.material as THREE.MeshStandardMaterial).map;
    if (map) map.repeat.set((w + 60) / 3, (h + 60) / 3);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(w / 2, -0.02, h / 2);
    ground.receiveShadow = true;
    g.add(ground);
    if (theme === 'nest') {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const e = i % 3 === 0 ? P.egg(1.6) : P.hayBale(2.2, 1.3, 1.6);
        e.position.set(w / 2 + Math.cos(a) * (w * 0.62 + rnd(i) * 3), 0, h / 2 + Math.sin(a) * (h * 0.7 + rnd(i + 5) * 3));
        e.rotation.y = a;
        g.add(e);
      }
      const boards = P.plankPlatform(10, 2.2, 0); boards.position.set(w / 2, 0.2, -3.5); g.add(boards);
    } else if (theme === 'farmyard' || theme === 'championship') {
      const b = P.barn(1.4); b.position.set(w * 0.5, 0, -9); g.add(b);
      const wm = P.windmill(1.2); wm.position.set(w + 6, 0, -6); g.add(wm);
      for (let i = 0; i < 12; i++) { const t = P.tree(1 + rnd(i) * 0.5); t.position.set(-6 + rnd(i + 1) * (w + 12), 0, i % 2 ? -6 - rnd(i) * 6 : h + 4 + rnd(i) * 6); g.add(t); }
      for (let i = 0; i < 20; i++) { const f = P.flower([0xffa0c8, 0xfff07a, 0xffffff, 0xc8a0ff][i % 4]); f.position.set(rnd(i * 3) * w, 0, h + 0.6 + rnd(i * 7) * 2); g.add(f); }
      if (theme === 'championship') for (let x = 0; x < w; x += 10) { const bu = P.bunting(10); bu.position.set(x + 5, 4, -1); g.add(bu); }
    }
  }
  return g;
}
