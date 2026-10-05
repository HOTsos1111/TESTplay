// 3D backdrop behind menus + story vignettes (growth transformation, adult celebration, egg hatching).
import * as THREE from 'three';
import type { Renderer } from './Renderer';
import { ChickModel } from './ChickModel';
import { applyLook, buildBackdrop } from './themes';
import { Fx } from './Fx';
import * as P from './props';
import type { ChickClass } from '../data/classes';
import type { Stage } from '../data/growth';

type Mode = 'title' | 'menu' | 'growth' | 'adult' | 'hatch';

export class MenuScene {
  readonly root = new THREE.Group();
  private chicks: ChickModel[] = [];
  private fx = new Fx();
  private t = 0;
  private mode: Mode = 'title';
  private story: { a?: ChickModel; b?: ChickModel; eggs?: THREE.Object3D[]; t: number; from?: Stage; to?: Stage | 'adult'; cls?: ChickClass; done?: boolean } = { t: 0 };
  onBeat: ((name: string) => void) | null = null;

  constructor(private r: Renderer) {
    const back = buildBackdrop('farmyard', 'top', 14, 10);
    back.traverse((o) => { if (o.name === 'barn') { o.position.set(-3, 0, -16); o.scale.setScalar(0.8); } });
    this.root.add(back);
    const nest = P.moundPerch(3.2, 0.35);
    nest.position.set(7, 0, 5);
    this.root.add(nest);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.35, 10, 40), P.M.straw());
    rim.rotation.x = Math.PI / 2; rim.position.set(7, 0.45, 5); rim.castShadow = true;
    this.root.add(rim);
    for (const [x, z, s] of [[2.5, 3, 1.1], [11.5, 3.5, 1.0], [3, 7.5, 0.9]] as const) { const e = P.hayBale(1.6 * s, 1 * s, 1.1 * s); e.position.set(x, 0, z); e.rotation.y = x; this.root.add(e); }
    const egg = P.egg(1.2); egg.position.set(10.5, 0.3, 6.6); this.root.add(egg);
    this.root.add(this.fx.group);
  }

  attach() { this.r.scene.add(this.root); applyLook(this.r.scene, 'farmyard'); this.r.setLighting({ sun: 0xffd29a, sunI: 2.6, sky: 0xfff0d6, ground: 0x9a7444, hemiI: 1.3, dir: [0.4, 1, 0.7], exposure: 1.05 }); this.r.focusShadows(7, 0, 5, 9); }
  detach() { this.r.scene.remove(this.root); }

  /** Three siblings on the nest (title/menus). */
  setChicks(list: { cls: ChickClass; stage: Stage | 'adult' }[], mode: Mode = 'title') {
    for (const c of this.chicks) { this.root.remove(c.root); c.dispose(); }
    this.chicks = list.map((c, i) => {
      const m = new ChickModel(c.cls, c.stage);
      const n = list.length;
      m.root.position.set(7 + (i - (n - 1) / 2) * 1.55, 0.42, 5.3 + Math.abs(i - (n - 1) / 2) * -0.35);
      m.root.rotation.y = (i - (n - 1) / 2) * -0.25;
      m.root.scale.setScalar(c.stage === 'adult' ? 1.15 : 1.35);
      this.root.add(m.root);
      return m;
    });
    this.mode = mode;
    this.clearStory();
  }

  private clearStory() {
    for (const k of ['a', 'b'] as const) { const m = this.story[k]; if (m) { this.root.remove(m.root); m.dispose(); } }
    this.story.eggs?.forEach((e) => this.root.remove(e));
    this.story = { t: 0 };
  }

  /** Growth transformation: stage `from` → `to` (identity kept, proportions change). */
  playGrowth(cls: ChickClass, from: Stage, to: Stage | 'adult') {
    this.setChicks([], to === 'adult' ? 'adult' : 'growth');
    const a = new ChickModel(cls, from);
    const b = new ChickModel(cls, to);
    a.root.position.set(7, 0.42, 5.4); b.root.position.set(7, 0.42, 5.4);
    a.root.scale.setScalar(1.6); b.root.scale.setScalar(0.001);
    this.root.add(a.root, b.root);
    this.story = { a, b, t: 0, from, to, cls };
  }

  /** Egg hatching vignette: new brood of three. */
  playHatch(classes: ChickClass[]) {
    this.setChicks([], 'hatch');
    const eggs: THREE.Object3D[] = [];
    classes.forEach((c, i) => {
      const e = P.egg(1.0);
      e.position.set(7 + (i - 1) * 1.4, 0.42, 5.4);
      this.root.add(e);
      eggs.push(e);
      const chick = new ChickModel(c, 1);
      chick.root.position.copy(e.position);
      chick.root.scale.setScalar(0.001);
      chick.root.userData.cls = c;
      this.root.add(chick.root);
      e.userData.chick = chick;
    });
    this.story = { eggs, t: 0 };
  }

  get storyTime() { return this.story.t; }

  update(dt: number) {
    this.t += dt;
    const t = this.t;
    const s = this.story;
    s.t += dt;
    // camera
    const cam = this.r.camera;
    const orbit = this.mode === 'title' ? Math.sin(t * 0.15) * 0.25 : 0;
    const close = this.mode === 'growth' || this.mode === 'adult' || this.mode === 'hatch';
    const dist = close ? 6.2 : 8.2;
    cam.position.set(7 + Math.sin(orbit) * dist, close ? 2.6 : 3.4, 5.4 + Math.cos(orbit) * dist);
    cam.lookAt(7, close ? 1.1 : 1.0, 5);
    // idle chicks
    this.chicks.forEach((c, i) => c.update(dt, { anim: Math.sin(t * 0.7 + i * 2) > 0.92 ? 'celebrate' : 'idle', speed: 0, vy: 0, grounded: true }));
    // growth: sparkle bloom, old shrinks while the new grows in
    if (s.a && s.b) {
      const k = Math.min(1, Math.max(0, (s.t - 1.2) / 1.2));
      s.a.root.scale.setScalar(1.6 * (1 - k) + 0.001);
      s.b.root.scale.setScalar(1.6 * k + 0.001);
      s.a.root.rotation.y = s.t * (1 + k * 8);
      s.b.root.rotation.y = s.t * 8 * (1 - k) + 0.3;
      s.a.update(dt, { anim: 'idle', speed: 0, vy: 0, grounded: true });
      s.b.update(dt, { anim: k >= 1 ? 'celebrate' : 'idle', speed: 0, vy: 0, grounded: true });
      if (s.t > 1.0 && s.t < 2.6 && Math.floor(s.t * 20) !== Math.floor((s.t - dt) * 20)) this.fx.emit('sparkle', new THREE.Vector3(7, 1.2, 5.4), 4, { speed: 2.5, up: 2, size: 0.35, life: 1 });
      if (s.t > 1.15 && s.t - dt <= 1.15) { this.onBeat?.('bloom'); this.fx.emit('feather', new THREE.Vector3(7, 1.2, 5.4), 18, { color: '#fff4c8', speed: 3, up: 3, size: 0.3, life: 1.6 }); }
      if (k >= 1 && !s.done) { s.done = true; this.onBeat?.('grown'); }
    }
    // hatch: eggs wobble, crack, chicks pop out
    if (s.eggs) {
      s.eggs.forEach((e, i) => {
        const t0 = 0.8 + i * 0.9;
        const chick = e.userData.chick as ChickModel;
        if (s.t < t0) e.rotation.z = Math.sin(s.t * 24 + i) * 0.12 * Math.min(1, s.t);
        else if (e.visible) {
          e.visible = false;
          this.onBeat?.('crack');
          this.fx.emit('star', e.position.clone().add(new THREE.Vector3(0, 0.6, 0)), 10, { speed: 2, up: 2.5, size: 0.3 });
        }
        if (!e.visible) {
          const k = Math.min(1, (s.t - t0) * 3);
          chick.root.scale.setScalar(1.4 * k + 0.001);
          chick.update(dt, { anim: 'celebrate', speed: 0, vy: 0, grounded: true });
        }
      });
    }
    this.fx.update(dt);
  }
}
