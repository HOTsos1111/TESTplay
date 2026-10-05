// Debug model viewer (?view=models): all classes across growth stages and the adult parent.
import * as THREE from 'three';
import { Renderer } from './render/Renderer';
import { ChickModel } from './render/ChickModel';
import { CLASSES } from './data/classes';
import { STAGES } from './data/growth';

export function startViewer(host: HTMLElement) {
  const r = new Renderer(host);
  r.scene.background = new THREE.Color(0xf6ead2);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0xeedcb8, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  r.scene.add(floor);
  const models: ChickModel[] = [];
  CLASSES.forEach((c, row) => {
    [...STAGES, 'adult' as const].forEach((s, col) => {
      const m = new ChickModel(c, s);
      m.root.position.set(-6.2 + col * 2.4, 0, -2.6 + row * 2.6);
      m.root.rotation.y = 0.35;
      r.scene.add(m.root);
      models.push(m);
    });
  });
  r.camera.position.set(0, 7.5, 9.5);
  r.camera.lookAt(0, 0.6, 0);
  r.focusShadows(0, 0, 0, 10);
  const params = new URLSearchParams(location.search);
  const anim = (params.get('anim') ?? 'idle') as never;
  let last = performance.now();
  const loop = () => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    for (const m of models) m.update(dt, { anim, speed: 5, vy: 0, grounded: true });
    r.render();
    requestAnimationFrame(loop);
  };
  loop();
  (window as unknown as { __viewerReady: boolean }).__viewerReady = true;
}
