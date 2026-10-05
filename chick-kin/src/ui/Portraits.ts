// Renders chick portraits from the same procedural models used in-game (consistent class identity).
import * as THREE from 'three';
import { ChickModel, type Expression } from '../render/ChickModel';
import type { ChickClass } from '../data/classes';
import type { Stage } from '../data/growth';

const cache = new Map<string, string>();
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene, cam: THREE.PerspectiveCamera;

function setup() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(256, 256, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x9a7444, 1.6));
  const key = new THREE.DirectionalLight(0xffe2b0, 2.6);
  key.position.set(2, 3, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfe0ff, 0.8);
  rim.position.set(-3, 2, -2);
  scene.add(rim);
  cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
}

export function portrait(cls: ChickClass, stage: Stage | 'adult', expr: Expression = 'happy', angle = 0.45, silhouette = false): string {
  const key = `${cls}:${stage}:${expr}:${angle}:${silhouette}`;
  const hit = cache.get(key);
  if (hit) return hit;
  try {
    if (!renderer) setup();
    const m = new ChickModel(cls, stage, { shadow: false });
    m.setExpression(expr, 99);
    m.update(0.016, { anim: expr === 'victory' ? 'celebrate' : 'idle', speed: 0, vy: 0, grounded: true });
    m.root.rotation.y = angle;
    if (silhouette) m.root.traverse((o) => { const mm = o as THREE.Mesh; if (mm.isMesh) mm.material = new THREE.MeshBasicMaterial({ color: 0x4a3a2c }); });
    scene.add(m.root);
    const box = new THREE.Box3().setFromObject(m.root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const dist = Math.max(size.y, size.x) * 2.15;
    cam.position.set(center.x, center.y + size.y * 0.08, center.z + dist);
    cam.lookAt(center.x, center.y, center.z);
    renderer!.render(scene, cam);
    const url = renderer!.domElement.toDataURL('image/png');
    scene.remove(m.root);
    m.dispose();
    cache.set(key, url);
    return url;
  } catch {
    return '';
  }
}
