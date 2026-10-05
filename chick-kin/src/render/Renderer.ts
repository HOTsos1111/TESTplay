// Three.js renderer setup with quality presets (high / medium / low).
import * as THREE from 'three';

export type Quality = 'high' | 'medium' | 'low';

export class Renderer {
  readonly gl: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  quality: Quality = 'high';
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;

  constructor(readonly host: HTMLElement) {
    this.gl = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.08;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFShadowMap;
    host.appendChild(this.gl.domElement);
    this.camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.1, 400);
    this.hemi = new THREE.HemisphereLight(0xfff1d8, 0x8a6a3c, 1.35);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffd9a3, 2.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.sun.shadow.radius = 4;
    this.scene.add(this.sun, this.sun.target);
    const fill = new THREE.DirectionalLight(0xbfd8ff, 0.45);
    fill.position.set(-8, 6, 10);
    this.scene.add(fill);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  setQuality(q: Quality) {
    this.quality = q;
    const dpr = Math.min(window.devicePixelRatio || 1, q === 'high' ? 2 : q === 'medium' ? 1.5 : 1);
    this.gl.setPixelRatio(dpr);
    this.gl.shadowMap.enabled = q !== 'low';
    this.gl.shadowMap.type = THREE.PCFShadowMap;
    this.sun.castShadow = q !== 'low';
    this.sun.shadow.mapSize.set(q === 'high' ? 2048 : 1024, q === 'high' ? 2048 : 1024);
    this.sun.shadow.map?.dispose();
    (this.sun.shadow as { map: THREE.WebGLRenderTarget | null }).map = null;
    this.resize();
  }

  /** Warm key light that follows the focus point so shadows stay crisp near the action. */
  setLighting(opts: { sun: number; sunI: number; sky: number; ground: number; hemiI: number; dir: [number, number, number]; exposure?: number }) {
    this.sun.color.setHex(opts.sun); this.sun.intensity = opts.sunI;
    this.hemi.color.setHex(opts.sky); this.hemi.groundColor.setHex(opts.ground); this.hemi.intensity = opts.hemiI;
    this.sunDir.set(...opts.dir).normalize();
    this.gl.toneMappingExposure = opts.exposure ?? 1.08;
  }
  private sunDir = new THREE.Vector3(0.5, 1, 0.6).normalize();
  focusShadows(x: number, y: number, z: number, span = 16) {
    this.sun.position.set(x + this.sunDir.x * 30, y + this.sunDir.y * 30, z + this.sunDir.z * 30);
    this.sun.target.position.set(x, y, z);
    const c = this.sun.shadow.camera;
    c.left = -span; c.right = span; c.top = span; c.bottom = -span; c.near = 1; c.far = 90;
    c.updateProjectionMatrix();
  }

  resize() {
    const w = this.host.clientWidth || window.innerWidth, h = this.host.clientHeight || window.innerHeight;
    this.gl.setSize(w, h, false);
    this.gl.domElement.style.width = '100%';
    this.gl.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render() { this.gl.render(this.scene, this.camera); }
}
