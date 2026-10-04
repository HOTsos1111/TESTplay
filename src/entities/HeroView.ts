import Phaser from 'phaser';
import { ART_SCALE } from '../systems/AssetRegistry';
import { HERO_PARTS, type EyeKind } from '../systems/art/heroArt';

export type HeroMode = 'play' | 'idle' | 'defeat' | 'victory' | 'sniff' | 'hover-demo';

export interface HeroVisualState {
  grounded: boolean;
  vy: number;
  hovering: boolean;
  speed: number;
  invulnerable: number;
}

type PartKey = keyof typeof HERO_PARTS;

/**
 * Procedural rubber-hose rig for the hero. Purely cosmetic: squash, stretch,
 * ears and tail never influence the collision box held by PlayerController.
 */
export class HeroView {
  readonly root: Phaser.GameObjects.Container;
  private rig: Phaser.GameObjects.Container;
  private head: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Image;
  private headImg: Phaser.GameObjects.Image;
  private ear: Phaser.GameObjects.Image;
  private eye: Phaser.GameObjects.Image;
  private mouth: Phaser.GameObjects.Image;
  private tail: Phaser.GameObjects.Image;
  private propeller: Phaser.GameObjects.Image;
  private legs: { img: Phaser.GameObjects.Image; offset: number; front: boolean }[] = [];

  mode: HeroMode = 'play';
  private t = 0;
  private phase = 0;
  private sqX = 1;
  private sqY = 1;
  private sqVX = 0;
  private sqVY = 0;
  private earSpring = { a: 0.4, v: 0 };
  private barkT = 0;
  private hitT = 0;
  private blinkT = 2.5;
  private wasGrounded = true;
  private modeT = 0;
  private stepAcc = 0;
  /** Fired roughly once per stride while running on the ground (for footstep audio). */
  onStep?: () => void;

  static readonly BASE_SCALE = 0.92;

  constructor(private scene: Phaser.Scene, x: number, y: number) {
    this.root = scene.add.container(x, y);
    this.rig = scene.add.container(0, 0);
    this.root.add(this.rig);

    const part = (key: string, p: PartKey, px: number, py: number) => {
      const spec = HERO_PARTS[p];
      const img = scene.add.image(px, py, key).setOrigin(spec.ox, spec.oy).setScale(ART_SCALE);
      return img;
    };

    const legFarFront = part('hero_leg_far', 'legFar', 40, -24);
    const legFarRear = part('hero_leg_far', 'legFar', -34, -24);
    this.tail = part('hero_tail', 'tail', -64, -48).setRotation(-0.5);
    this.propeller = part('hero_propeller', 'propeller', -68, -50).setVisible(false);
    this.body = part('hero_body', 'body', -6, -36);
    const legNearFront = part('hero_leg_near', 'legNear', 30, -24);
    const legNearRear = part('hero_leg_near', 'legNear', -42, -24);
    const collar = part('hero_collar', 'collar', 34, -46);

    this.head = scene.add.container(44, -54);
    this.headImg = part('hero_head', 'head', 0, 0);
    this.eye = part('hero_eye_determined', 'eye', 12, -15);
    this.ear = part('hero_ear', 'ear', -5, -24);
    this.mouth = part('hero_mouth', 'mouth', 22, 4).setVisible(false);
    this.head.add([this.headImg, this.mouth, this.eye, this.ear]);

    this.rig.add([legFarFront, legFarRear, this.tail, this.propeller, this.body, legNearFront, legNearRear, collar, this.head]);
    this.legs = [
      { img: legNearFront, offset: 0, front: true },
      { img: legFarFront, offset: 0.7, front: true },
      { img: legNearRear, offset: Math.PI, front: false },
      { img: legFarRear, offset: Math.PI + 0.7, front: false },
    ];
    this.rig.setScale(HeroView.BASE_SCALE);
  }

  setPosition(x: number, y: number): void {
    this.root.setPosition(x, y);
  }

  setDepth(d: number): this {
    this.root.setDepth(d);
    return this;
  }

  setMode(mode: HeroMode): void {
    if (this.mode !== mode) {
      this.mode = mode;
      this.modeT = 0;
    }
  }

  bark(): void {
    this.barkT = 0.26;
  }

  hit(): void {
    this.hitT = 0.45;
    this.sqX = 1.25;
    this.sqY = 0.75;
  }

  land(impact: number): void {
    const k = Math.min(1, impact / 900);
    this.sqX = 1 + 0.22 * k;
    this.sqY = 1 - 0.2 * k;
  }

  takeoff(): void {
    this.sqX = 0.86;
    this.sqY = 1.14;
  }

  private setEye(kind: EyeKind): void {
    const key = `hero_eye_${kind}`;
    if (this.eye.texture.key !== key) this.eye.setTexture(key);
  }

  /** Springs are sub-stepped so long frames (tab switches, slow devices) stay stable. */
  private static substeps(dt: number): [number, number] {
    const n = Math.max(1, Math.ceil(dt / (1 / 120)));
    return [n, dt / n];
  }

  private springSquash(dt: number): void {
    const k = 260;
    const d = 16;
    const [n, h] = HeroView.substeps(dt);
    for (let i = 0; i < n; i++) {
      this.sqVX += ((1 - this.sqX) * k - this.sqVX * d) * h;
      this.sqVY += ((1 - this.sqY) * k - this.sqVY * d) * h;
      this.sqX += this.sqVX * h;
      this.sqY += this.sqVY * h;
    }
    if (!Number.isFinite(this.sqX) || !Number.isFinite(this.sqY)) {
      this.sqX = this.sqY = 1;
      this.sqVX = this.sqVY = 0;
    }
    this.sqX = Phaser.Math.Clamp(this.sqX, 0.6, 1.5);
    this.sqY = Phaser.Math.Clamp(this.sqY, 0.6, 1.5);
  }

  private springEar(target: number, dt: number): void {
    const k = 180;
    const d = 9;
    const e = this.earSpring;
    const [n, h] = HeroView.substeps(dt);
    for (let i = 0; i < n; i++) {
      e.v += ((target - e.a) * k - e.v * d) * h;
      e.a += e.v * h;
    }
    if (!Number.isFinite(e.a) || !Number.isFinite(e.v)) {
      e.a = target;
      e.v = 0;
    }
    e.a = Phaser.Math.Clamp(e.a, -0.6, 2.8);
    e.v = Phaser.Math.Clamp(e.v, -40, 40);
  }

  /** Debug/test introspection of the cosmetic rig. */
  get debugState(): { scaleX: number; scaleY: number; alpha: number; visible: boolean } {
    return { scaleX: this.rig.scaleX, scaleY: this.rig.scaleY, alpha: this.root.alpha, visible: this.root.visible };
  }

  update(dt: number, s: HeroVisualState): void {
    this.t += dt;
    this.modeT += dt;
    this.barkT = Math.max(0, this.barkT - dt);
    this.hitT = Math.max(0, this.hitT - dt);
    this.blinkT -= dt;
    this.springSquash(dt);

    let rigY = 0;
    let rigRot = 0;
    let bodyRot = 0;
    let headX = 44;
    let headY = -54;
    let headRot = 0;
    let headScale = 1;
    let earTarget = 0.4;
    let eye: EyeKind = 'determined';
    let showProp = false;
    let tailRot = -0.5 + Math.sin(this.t * 14) * 0.25;
    let mouth = false;

    const legAngles: number[] = [0, 0, 0, 0];

    if (this.mode === 'play') {
      if (s.grounded) {
        if (!this.wasGrounded) this.phase = 0;
        const stride = 3.4 * (s.speed / 320);
        this.phase += dt * stride * Math.PI * 2;
        this.stepAcc += dt * stride;
        if (this.stepAcc >= 1) {
          this.stepAcc -= 1;
          this.onStep?.();
        }
        for (let i = 0; i < 4; i++) legAngles[i] = Math.sin(this.phase + this.legs[i].offset) * 0.95;
        rigY = -Math.abs(Math.sin(this.phase)) * 3.5;
        bodyRot = Math.sin(this.phase - 0.9) * 0.04; // rear end lags the front
        headY += Math.sin(this.phase + 0.6) * 1.6;
        earTarget = 0.7 + Math.sin(this.phase - 1.3) * 0.35;
        tailRot = -0.4 + Math.sin(this.t * 16) * 0.35;
      } else if (s.hovering) {
        showProp = true;
        rigRot = 0.08;
        for (let i = 0; i < 4; i++) legAngles[i] = Math.sin(this.t * 9 + this.legs[i].offset) * 0.45 + (this.legs[i].front ? -0.3 : 0.3);
        earTarget = 1.1 + Math.sin(this.t * 7) * 0.15;
        rigY = Math.sin(this.t * 10) * 1.5;
      } else if (s.vy < 0) {
        // Rising: front legs reach forward, rear legs kick back.
        for (let i = 0; i < 4; i++) legAngles[i] = this.legs[i].front ? -0.85 : 0.9;
        rigRot = Math.max(-0.14, s.vy / 4500);
        earTarget = 0.25;
      } else {
        // Falling: legs dangle, ears lift.
        for (let i = 0; i < 4; i++) legAngles[i] = Math.sin(this.t * 14 + this.legs[i].offset) * 0.25 + (this.legs[i].front ? -0.2 : 0.25);
        rigRot = Math.min(0.12, s.vy / 6000);
        earTarget = 2.3;
      }
      if (this.barkT > 0) {
        const k = this.barkT / 0.26;
        // Cheeks inflate first, then a sharp forward pulse.
        if (k > 0.75) headScale = 1 + (1 - k) * 0.5;
        else {
          headScale = 1.08;
          headX += 7 * Math.sin(k * Math.PI);
          headRot = -0.12;
          mouth = true;
        }
        earTarget = 1.6;
      }
      if (this.hitT > 0) {
        eye = 'surprised';
        rigRot += Math.sin(this.hitT * 40) * 0.12;
        earTarget = 2.6;
      }
      this.root.alpha = s.invulnerable > 0 && Math.floor(s.invulnerable * 14) % 2 === 0 ? 0.35 : 1;
    } else if (this.mode === 'idle') {
      const breath = Math.sin(this.t * 2.2);
      this.sqY = 1 + breath * 0.02;
      headRot = Math.sin(this.t * 0.9) * 0.05 + (Math.sin(this.t * 13) > 0.97 ? -0.05 : 0);
      tailRot = -0.6 + Math.sin(this.t * 6) * 0.25;
      earTarget = 0.35;
      eye = 'open';
      this.root.alpha = 1;
    } else if (this.mode === 'hover-demo') {
      showProp = true;
      rigRot = 0.08;
      rigY = Math.sin(this.t * 4) * 6;
      for (let i = 0; i < 4; i++) legAngles[i] = Math.sin(this.t * 9 + this.legs[i].offset) * 0.45;
      earTarget = 1.2;
      eye = 'determined';
    } else if (this.mode === 'sniff') {
      headRot = -0.35 + Math.sin(this.t * 18) * 0.03;
      headY -= 4;
      earTarget = -0.2;
      eye = this.modeT < 0.8 ? 'closed' : 'open';
      tailRot = -0.8 + Math.sin(this.t * 10) * 0.2;
      this.root.alpha = 1;
    } else if (this.mode === 'victory') {
      const b = Math.abs(Math.sin(this.t * 6.5));
      rigY = -b * 16;
      if (b < 0.1) this.sqY = 0.92;
      tailRot = -0.7 + Math.sin(this.t * 26) * 0.5;
      eye = 'happy';
      earTarget = 1.4 - b;
      mouth = true;
      for (let i = 0; i < 4; i++) legAngles[i] = this.legs[i].front ? -0.4 * b : 0.4 * b;
      this.root.alpha = 1;
    } else if (this.mode === 'defeat') {
      const k = Math.min(1, this.modeT / 0.35);
      rigY = -Math.sin(Math.min(1, this.modeT / 0.5) * Math.PI) * 30 * (1 - k * 0.6);
      for (let i = 0; i < 4; i++) legAngles[i] = (this.legs[i].front ? -1.5 : 1.5) * k;
      this.sqY = 1 - 0.18 * k;
      headRot = 0.25 * k;
      headY += 6 * k;
      eye = 'dizzy';
      earTarget = 1.8;
      tailRot = -0.1;
      mouth = true;
      this.root.alpha = 1;
    }

    if (this.mode === 'play' && this.blinkT <= 0) {
      if (this.blinkT < -0.12) this.blinkT = 2 + Math.random() * 3;
      else if (eye === 'determined' || eye === 'open') eye = 'closed';
    }

    this.wasGrounded = s.grounded;
    this.springEar(earTarget, dt);

    const B = HeroView.BASE_SCALE;
    this.rig.setScale(B * this.sqX, B * this.sqY);
    this.rig.y = rigY;
    this.rig.rotation = rigRot;
    this.body.rotation = bodyRot;
    this.head.setPosition(headX, headY);
    this.head.rotation = headRot;
    this.headImg.setScale(ART_SCALE * headScale);
    this.ear.rotation = this.earSpring.a;
    this.setEye(eye);
    this.mouth.setVisible(mouth);
    this.tail.setVisible(!showProp);
    this.propeller.setVisible(showProp);
    if (showProp) {
      this.propeller.rotation -= dt * 38;
      this.propeller.setScale(ART_SCALE * (1.25 + Math.sin(this.t * 50) * 0.08));
    }
    this.tail.rotation = tailRot;
    for (let i = 0; i < 4; i++) this.legs[i].img.rotation = legAngles[i];
  }

  /** World-space position of the tail tip region (for hover streak fx). */
  get tailWorld(): { x: number; y: number } {
    return { x: this.root.x - 64 * HeroView.BASE_SCALE, y: this.root.y - 50 * HeroView.BASE_SCALE };
  }

  destroy(): void {
    this.root.destroy();
  }

  get scenePlugin(): Phaser.Scene {
    return this.scene;
  }
}
