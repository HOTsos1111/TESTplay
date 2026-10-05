import Phaser from 'phaser';
import { ART_SCALE } from '../systems/AssetRegistry';

export type HeroMode = 'play' | 'idle' | 'defeat' | 'victory' | 'sniff' | 'hover-demo' | 'sleep' | 'startled';

export interface HeroVisualState {
  grounded: boolean;
  vy: number;
  hovering: boolean;
  speed: number;
  invulnerable: number;
  bursting?: boolean;
  ducking?: boolean;
}

type Pose = 'side' | 'idle' | 'run' | 'leap' | 'prop' | 'bark' | 'toy' | 'sleep';

/**
 * Where each pose's body centre sits, as a fraction of the sprite width, so the
 * dog stays planted over his hitbox when the pose changes. Sprites come from the
 * character reference sheet (scripts/extract-sprites.mjs) and face right.
 */
/**
 * The motion poses were drawn smaller on the reference sheet than the side view
 * (measured by eye size), so scale them up to keep the dog one consistent size.
 */
const POSE_SCALE: Record<Pose, number> = {
  side: 1,
  sleep: 1,
  idle: 1.2,
  run: 1.27,
  leap: 1.35,
  prop: 1.35,
  bark: 1.3,
  toy: 1.3,
};

const POSE_ORIGIN_X: Record<Pose, number> = {
  side: 0.44,
  idle: 0.47,
  run: 0.45,
  leap: 0.47,
  prop: 0.5,
  bark: 0.5,
  toy: 0.45,
  sleep: 0.44,
};

/** Cut lines on the side-view sprite (sprite px, ~402×261) for the animated running rig. */
const RIG = {
  belly: 212,
  legs: [
    // [x0, x1, pivotX] — rear-far, front-far, rear-near, front-near (draw order).
    { x0: 50, x1: 104, px: 78, far: true, front: false },
    { x0: 232, x1: 286, px: 258, far: true, front: true },
    { x0: 0, x1: 54, px: 30, far: false, front: false },
    { x0: 180, x1: 236, px: 208, far: false, front: true },
  ],
  legTop: 196,
  pivotY: 206,
  ear: { poly: [[197, 72], [222, 44], [252, 44], [264, 90], [261, 140], [254, 164], [238, 176], [214, 176], [184, 162], [180, 128], [188, 96]], px: 236, py: 58 },
  tail: { poly: [[0, 92], [20, 92], [28, 118], [50, 138], [48, 162], [18, 162], [0, 132]], px: 40, py: 152 },
} as const;

type RigPart = 'body' | 'ear' | 'tail' | 'leg0' | 'leg1' | 'leg2' | 'leg3';

/**
 * Hero visuals built from the hand-drawn pose sprites. Purely cosmetic: squash,
 * stretch and pose never influence the collision box held by PlayerController.
 */
export class HeroView {
  readonly root: Phaser.GameObjects.Container;
  private rig: Phaser.GameObjects.Container;
  private spr: Phaser.GameObjects.Image;
  private propeller: Phaser.GameObjects.Image;
  /** Animated cut-out of the side pose: legs, ear and tail move on their own. */
  private cut: Phaser.GameObjects.Container;
  private parts: Record<RigPart, Phaser.GameObjects.Image>;
  private earSpring = { a: 0, v: 0 };

  mode: HeroMode = 'play';
  private pose: Pose = 'run';
  private t = 0;
  private phase = 0;
  private sqX = 1;
  private sqY = 1;
  private sqVX = 0;
  private sqVY = 0;
  private barkT = 0;
  private hitT = 0;
  private wasGrounded = true;
  private modeT = 0;
  private stepAcc = 0;
  /** Burst animation clock (-1 when idle) and whether the rear has snapped yet. */
  private burstAnimT = -1;
  private flipT = -1;
  private snapped = false;
  /** Elastic body: how far the front (F) and rear (R) are pulled ahead, in px. */
  private elF = 0;
  private elR = 0;
  private elRV = 0;
  static readonly STRETCH_TIME = 0.24;
  static readonly STRETCH_PX = 135;
  /** Fired when the stretched rear end snaps forward (for the sound). */
  onSnap?: () => void;
  /** Fired roughly once per stride while running on the ground (for footstep audio). */
  onStep?: () => void;

  static readonly BASE_SCALE = 0.92;
  /** Sprite scale inside the rig (the sheet is drawn a little larger than the 2× contract). */
  private static readonly SPRITE_SCALE = ART_SCALE * 0.88;

  constructor(private scene: Phaser.Scene, x: number, y: number) {
    HeroView.ensureSleepTexture(scene);
    HeroView.ensureRigTextures(scene);
    this.root = scene.add.container(x, y);
    this.rig = scene.add.container(0, 0);
    this.root.add(this.rig);
    // Cut-out rig, aligned so its unrotated parts reproduce the side pose exactly.
    const side = scene.textures.get('hero_s_side').getSourceImage();
    const W = side.width;
    const H = side.height;
    const s0 = HeroView.SPRITE_SCALE;
    const place = (key: string, px: number, py: number) =>
      scene.add.image((px - POSE_ORIGIN_X.side * W) * s0, (py - H) * s0 + 2, key).setOrigin(px / W, py / H).setScale(s0);
    this.parts = {
      tail: place('hero_r_tail', RIG.tail.px, RIG.tail.py),
      leg0: place('hero_r_leg0', RIG.legs[0].px, RIG.pivotY),
      leg1: place('hero_r_leg1', RIG.legs[1].px, RIG.pivotY),
      leg2: place('hero_r_leg2', RIG.legs[2].px, RIG.pivotY),
      leg3: place('hero_r_leg3', RIG.legs[3].px, RIG.pivotY),
      body: place('hero_r_body', W / 2, H / 2),
      ear: place('hero_r_ear', RIG.ear.px, RIG.ear.py),
    };
    this.cut = scene.add.container(0, 0, [this.parts.tail, this.parts.leg0, this.parts.leg1, this.parts.leg2, this.parts.leg3, this.parts.body, this.parts.ear]);
    this.rig.add(this.cut);
    // Spinning blur over the tail swirl drawn in the propeller pose.
    this.propeller = scene.add.image(-37, -110, 'hero_propeller').setScale(ART_SCALE * 1.5, ART_SCALE * 0.5).setAlpha(0.7).setVisible(false);
    this.spr = scene.add.image(0, 2, 'hero_s_run').setOrigin(POSE_ORIGIN_X.run, 1).setScale(HeroView.SPRITE_SCALE);
    this.rig.add([this.spr, this.propeller]);
    this.rig.setScale(HeroView.BASE_SCALE);
  }

  /**
   * A napping variant of the side pose: the open eye is painted over with fur
   * and replaced by a closed, contented curve.
   */
  private static ensureSleepTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists('hero_s_sleep') || !scene.textures.exists('hero_s_side')) return;
    const src = scene.textures.get('hero_s_side').getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const tex = scene.textures.createCanvas('hero_s_sleep', src.width, src.height);
    if (!tex) return;
    const c = tex.getContext();
    c.drawImage(src, 0, 0);
    const ex = src.width * 0.762;
    const ey = src.height * 0.27;
    c.beginPath();
    c.ellipse(ex, ey, src.width * 0.06, src.height * 0.13, 0, 0, Math.PI * 2);
    c.fillStyle = '#B66B38';
    c.fill();
    c.beginPath();
    c.moveTo(ex - 15, ey + 2);
    c.quadraticCurveTo(ex, ey + 13, ex + 15, ey + 2);
    c.lineWidth = 5;
    c.lineCap = 'round';
    c.strokeStyle = '#302331';
    c.stroke();
    tex.refresh();
  }

  /** Splits the side pose into body, ear, tail and four legs (once per game). */
  private static ensureRigTextures(scene: Phaser.Scene): void {
    if (scene.textures.exists('hero_r_body') || !scene.textures.exists('hero_s_side')) return;
    const src = scene.textures.get('hero_s_side').getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const W = src.width;
    const H = src.height;
    const make = (key: string, draw: (c: CanvasRenderingContext2D) => void) => {
      const tex = scene.textures.createCanvas(key, W, H);
      if (!tex) return;
      draw(tex.getContext());
      tex.refresh();
    };
    const poly = (c: CanvasRenderingContext2D, pts: readonly (readonly [number, number])[]) => {
      c.beginPath();
      pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.closePath();
    };
    make('hero_r_body', (c) => {
      c.drawImage(src, 0, 0);
      // Remove the legs below the belly line (they are drawn as separate parts).
      for (const l of RIG.legs) c.clearRect(l.x0, RIG.belly, l.x1 - l.x0, H - RIG.belly);
      // Remove the tail, and paint fur where the ear used to hang.
      c.save();
      poly(c, RIG.tail.poly);
      c.clip();
      c.clearRect(0, 0, 44, H);
      c.restore();
      c.save();
      poly(c, RIG.ear.poly);
      c.clip();
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = '#A9622F';
      c.fillRect(0, 0, W, H);
      // The collar carries on round the neck under the ear.
      c.beginPath();
      c.moveTo(188, 124);
      c.lineTo(262, 146);
      c.lineTo(262, 168);
      c.lineTo(192, 146);
      c.closePath();
      c.fillStyle = '#42B7B0';
      c.fill();
      c.lineWidth = 4;
      c.strokeStyle = '#302331';
      c.stroke();
      c.restore();
    });
    make('hero_r_ear', (c) => {
      poly(c, RIG.ear.poly);
      c.clip();
      c.drawImage(src, 0, 0);
    });
    make('hero_r_tail', (c) => {
      poly(c, RIG.tail.poly);
      c.clip();
      c.drawImage(src, 0, 0);
    });
    RIG.legs.forEach((l, i) =>
      make(`hero_r_leg${i}`, (c) => {
        c.beginPath();
        c.rect(l.x0, RIG.legTop, l.x1 - l.x0, H - RIG.legTop);
        c.clip();
        c.drawImage(src, 0, 0);
        if (l.far) {
          // Far legs sit in shadow.
          c.globalCompositeOperation = 'source-atop';
          c.fillStyle = 'rgba(48,35,49,0.18)';
          c.fillRect(0, 0, W, H);
        }
      }),
    );
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

  /** Front stretches forward like an elastic band, then the rear snaps after it. */
  burst(): void {
    this.burstAnimT = 0;
    this.snapped = false;
    this.elRV = 0;
  }

  /**
   * Over-the-top rubber band: the front shoots ahead while the rear digs in,
   * then the rear springs after it, overshoots into a squash and wobbles.
   */
  private updateElastic(dt: number): void {
    if (this.burstAnimT < 0) return;
    this.burstAnimT += dt;
    const t = this.burstAnimT;
    const T = HeroView.STRETCH_TIME;
    if (t < T) {
      const k = t / T;
      this.elF = HeroView.STRETCH_PX * (1 + 0.12 * Math.sin(k * Math.PI)) * (1 - Math.pow(1 - k, 3));
      this.elR = 0;
      return;
    }
    if (!this.snapped) {
      this.snapped = true;
      this.elRV = 2600;
      this.sqY = 1.25;
      this.sqX = 0.85;
      this.onSnap?.();
    }
    if (t > 0.6) this.elF -= this.elF * Math.min(1, dt * 5);
    const [n, h] = HeroView.substeps(dt);
    for (let i = 0; i < n; i++) {
      this.elRV += ((this.elF - this.elR) * 900 - this.elRV * 9) * h;
      this.elR += this.elRV * h;
    }
    if (t > 1.6) {
      this.burstAnimT = -1;
      this.elF = this.elR = this.elRV = 0;
    }
  }

  bark(): void {
    this.barkT = 0.3;
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

  /** Double jump: a quick forward somersault. */
  flip(): void {
    this.flipT = 0;
    this.sqX = 0.85;
    this.sqY = 1.15;
  }

  takeoff(): void {
    this.sqX = 0.86;
    this.sqY = 1.14;
  }

  private setPose(p: Pose): void {
    if (this.pose === p && this.spr.texture.key === `hero_s_${p}`) return;
    this.pose = p;
    this.spr.setTexture(`hero_s_${p}`);
    this.spr.setOrigin(POSE_ORIGIN_X[p], 1);
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
    this.sqX = Phaser.Math.Clamp(this.sqX, 0.55, 1.5);
    this.sqY = Phaser.Math.Clamp(this.sqY, 0.55, 1.5);
  }

  /** Debug/test introspection of the cosmetic rig. */
  get debugState(): { scaleX: number; scaleY: number; alpha: number; visible: boolean } {
    return { scaleX: this.rig.scaleX, scaleY: this.rig.scaleY, alpha: this.root.alpha, visible: this.root.visible };
  }

  private springEar(target: number, dt: number): void {
    // Soft, under-damped spring: floppy velvet ears.
    const e = this.earSpring;
    const [n, h] = HeroView.substeps(dt);
    for (let i = 0; i < n; i++) {
      e.v += ((target - e.a) * 140 - e.v * 6) * h;
      e.a += e.v * h;
    }
    if (!Number.isFinite(e.a) || !Number.isFinite(e.v)) {
      e.a = target;
      e.v = 0;
    }
    e.a = Phaser.Math.Clamp(e.a, -0.5, 1.4);
  }

  update(dt: number, s: HeroVisualState): void {
    this.t += dt;
    this.modeT += dt;
    this.barkT = Math.max(0, this.barkT - dt);
    this.hitT = Math.max(0, this.hitT - dt);
    this.springSquash(dt);

    // 'rig' = the animated cut-out of the side pose; anything else is a whole drawn pose.
    let pose: Pose | 'rig' = 'rig';
    let rigY = 0;
    let rigRot = 0;
    let showProp = false;
    let alpha = 1;
    const legs = [0, 0, 0, 0];
    let earTarget = 0.1;
    let tailRot = Math.sin(this.t * 9) * 0.3;
    let cutY = 0;

    if (this.mode === 'play') {
      if (s.grounded) {
        if (!this.wasGrounded) this.phase = 0;
        const stride = 3.2 * (Math.max(s.speed, 1) / 320);
        this.phase += dt * stride * Math.PI * 2;
        this.stepAcc += dt * stride;
        if (this.stepAcc >= 1) {
          this.stepAcc -= 1;
          this.onStep?.();
        }
        // Gallop: front pair and rear pair swing in opposition, far legs a beat behind.
        const p = this.phase;
        legs[0] = Math.sin(p + Math.PI + 0.5) * 0.62;
        legs[1] = Math.sin(p + 0.5) * 0.62;
        legs[2] = Math.sin(p + Math.PI) * 0.62;
        legs[3] = Math.sin(p) * 0.62;
        const b = Math.abs(Math.sin(p));
        rigY = -b * 6;
        rigRot = Math.sin(p) * 0.04;
        earTarget = 0.35 + Math.sin(p * 2 - 1) * 0.3;
        tailRot = Math.sin(this.t * 20) * 0.45 - 0.1;
      } else if (s.hovering) {
        pose = 'prop';
        showProp = true;
        rigRot = Math.sin(this.t * 9) * 0.05;
        rigY = Math.sin(this.t * 10) * 2;
      } else {
        pose = 'leap';
        rigRot = s.vy < 0 ? Math.max(-0.2, s.vy / 3200) : Math.min(0.25, s.vy / 3000);
      }
      if (this.barkT > 0) {
        pose = 'bark';
        rigRot = 0;
        const k = this.barkT / 0.3;
        if (k > 0.7) this.sqY = Math.max(this.sqY, 1 + (1 - k) * 0.4);
      }
      if (this.hitT > 0) {
        rigRot += Math.sin(this.hitT * 40) * 0.14;
        earTarget = 1.2;
      }
      alpha = s.invulnerable > 0 && Math.floor(s.invulnerable * 14) % 2 === 0 ? 0.35 : 1;
    } else if (this.mode === 'idle') {
      this.sqY = 1 + Math.sin(this.t * 2.2) * 0.015;
      earTarget = 0.05 + Math.sin(this.t * 1.3) * 0.05;
      tailRot = Math.sin(this.t * 11) * 0.4;
    } else if (this.mode === 'hover-demo') {
      pose = 'prop';
      showProp = true;
      rigY = Math.sin(this.t * 4) * 6;
    } else if (this.mode === 'sniff') {
      rigRot = 0.1 + Math.sin(this.t * 18) * 0.012;
      rigY = 2;
      earTarget = -0.2;
      tailRot = Math.sin(this.t * 14) * 0.35;
    } else if (this.mode === 'sleep') {
      pose = 'sleep';
      const breath = Math.sin(this.t * 1.6);
      this.sqY = 0.88 + breath * 0.03;
      this.sqX = 1.04;
    } else if (this.mode === 'startled') {
      const k = Math.min(1, this.modeT / 0.3);
      rigY = -Math.sin(k * Math.PI) * 26;
      rigRot = -Math.sin(k * Math.PI) * 0.12;
      for (let i = 0; i < 4; i++) legs[i] = RIG.legs[i].front ? -0.5 * k : 0.5 * k;
      earTarget = 1.1;
      tailRot = 0.4 + Math.sin(this.t * 30) * 0.3;
    } else if (this.mode === 'victory') {
      const b = Math.abs(Math.sin(this.t * 6.5));
      rigY = -b * 16;
      if (b < 0.1) this.sqY = 0.92;
      for (let i = 0; i < 4; i++) legs[i] = (RIG.legs[i].front ? -0.45 : 0.45) * b;
      earTarget = 0.9 * b;
      tailRot = Math.sin(this.t * 26) * 0.5;
    } else if (this.mode === 'defeat') {
      const k = Math.min(1, this.modeT / 0.35);
      rigY = -Math.sin(Math.min(1, this.modeT / 0.5) * Math.PI) * 30 * (1 - k * 0.6);
      rigRot = 0.3 * k;
      for (let i = 0; i < 4; i++) legs[i] = (RIG.legs[i].front ? -1.2 : 1.2) * k;
      earTarget = 1.0;
      tailRot = -0.5;
      this.sqY = 1 - 0.18 * k;
    }

    let stretchX = 1;
    let stretchShift = 0;
    if (this.mode === 'play') {
      this.updateElastic(dt);
      if (this.burstAnimT >= 0) {
        // Front pulls ahead while the rear stays put, then the rear snaps after it.
        stretchX = Math.max(0.6, 1 + (this.elF - this.elR) / 150);
        stretchShift = (this.elF + this.elR) / 2;
        if (this.burstAnimT < HeroView.STRETCH_TIME) {
          earTarget = 1.3;
          legs[0] = legs[2] = 0.9;
          legs[1] = legs[3] = -0.9;
        }
      }
      if (s.bursting) {
        rigRot += 0.06;
        earTarget = Math.max(earTarget, 0.9);
      }
      if (s.ducking && s.grounded) {
        // Belly to the floor: legs splayed fore and aft, ears and tail streaming back.
        pose = 'rig';
        const wiggle = Math.sin(this.phase * 1.5) * 0.12;
        legs[0] = legs[2] = 1.35 + wiggle;
        legs[1] = legs[3] = -1.35 - wiggle;
        cutY = 21;
        earTarget = 0.7;
        tailRot = -0.75 + Math.sin(this.t * 16) * 0.12;
        this.sqX += (1.12 - this.sqX) * Math.min(1, dt * 22);
        this.sqY += (0.9 - this.sqY) * Math.min(1, dt * 22);
        rigY = 0;
        rigRot = 0;
      }
    }
    if (this.flipT >= 0) {
      this.flipT += dt;
      const k = Math.min(1, this.flipT / 0.42);
      rigRot += (1 - Math.pow(1 - k, 2)) * Math.PI * 2;
      if (k >= 1) this.flipT = -1;
    }
    this.wasGrounded = s.grounded;
    this.springEar(earTarget, dt);

    const useRig = pose === 'rig';
    this.cut.setVisible(useRig);
    this.spr.setVisible(!useRig);
    if (!useRig) this.setPose(pose as Pose);
    const B = HeroView.BASE_SCALE;
    this.rig.setScale(B * this.sqX, B * this.sqY);
    this.rig.y = rigY;
    this.rig.rotation = rigRot;
    const ps = HeroView.SPRITE_SCALE * POSE_SCALE[this.pose];
    this.spr.setScale(ps * stretchX, ps);
    this.spr.x = stretchShift;
    this.cut.setScale(stretchX, 1);
    this.cut.setPosition(stretchShift, cutY);
    this.parts.leg0.rotation = legs[0];
    this.parts.leg1.rotation = legs[1];
    this.parts.leg2.rotation = legs[2];
    this.parts.leg3.rotation = legs[3];
    this.parts.ear.rotation = this.earSpring.a;
    this.parts.tail.rotation = tailRot;
    this.propeller.setVisible(showProp);
    if (showProp) {
      this.propeller.setScale(ART_SCALE * 1.5 * (1 + Math.sin(this.t * 50) * 0.08), ART_SCALE * 0.5);
      this.propeller.setFlipX(Math.sin(this.t * 60) > 0);
    }
    this.root.alpha = alpha;
  }

  /** World-space position of the tail tip region (for hover streak fx). */
  get tailWorld(): { x: number; y: number } {
    return { x: this.root.x - 60 * HeroView.BASE_SCALE, y: this.root.y - 70 * HeroView.BASE_SCALE };
  }

  destroy(): void {
    this.root.destroy();
  }

  get scenePlugin(): Phaser.Scene {
    return this.scene;
  }
}
