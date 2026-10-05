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

/**
 * Hero visuals built from the hand-drawn pose sprites. Purely cosmetic: squash,
 * stretch and pose never influence the collision box held by PlayerController.
 */
export class HeroView {
  readonly root: Phaser.GameObjects.Container;
  private rig: Phaser.GameObjects.Container;
  private spr: Phaser.GameObjects.Image;
  private propeller: Phaser.GameObjects.Image;

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
  private static readonly SPRITE_SCALE = ART_SCALE * 1.08;

  constructor(private scene: Phaser.Scene, x: number, y: number) {
    HeroView.ensureSleepTexture(scene);
    this.root = scene.add.container(x, y);
    this.rig = scene.add.container(0, 0);
    this.root.add(this.rig);
    // Spinning blur over the tail swirl drawn in the propeller pose.
    this.propeller = scene.add.image(-34, -100, 'hero_propeller').setScale(ART_SCALE * 1.5, ART_SCALE * 0.5).setAlpha(0.7).setVisible(false);
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

  update(dt: number, s: HeroVisualState): void {
    this.t += dt;
    this.modeT += dt;
    this.barkT = Math.max(0, this.barkT - dt);
    this.hitT = Math.max(0, this.hitT - dt);
    this.springSquash(dt);

    let pose: Pose = 'run';
    let rigY = 0;
    let rigRot = 0;
    let showProp = false;
    let alpha = 1;

    if (this.mode === 'play') {
      if (s.grounded) {
        if (!this.wasGrounded) this.phase = 0;
        const stride = 3.4 * (Math.max(s.speed, 1) / 320);
        this.phase += dt * stride * Math.PI * 2;
        this.stepAcc += dt * stride;
        if (this.stepAcc >= 1) {
          this.stepAcc -= 1;
          this.onStep?.();
        }
        // Bounding gallop: hop, slight rock, and a squash at each footfall.
        const b = Math.abs(Math.sin(this.phase));
        rigY = -b * 7;
        rigRot = Math.sin(this.phase * 2) * 0.035;
        this.sqY += (1 - b * 0.06 - this.sqY) * Math.min(1, dt * 10);
        pose = 'run';
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
      if (this.hitT > 0) rigRot += Math.sin(this.hitT * 40) * 0.14;
      alpha = s.invulnerable > 0 && Math.floor(s.invulnerable * 14) % 2 === 0 ? 0.35 : 1;
    } else if (this.mode === 'idle') {
      pose = 'idle';
      this.sqY = 1 + Math.sin(this.t * 2.2) * 0.02;
    } else if (this.mode === 'hover-demo') {
      pose = 'prop';
      showProp = true;
      rigY = Math.sin(this.t * 4) * 6;
    } else if (this.mode === 'sniff') {
      pose = 'side';
      rigRot = 0.1 + Math.sin(this.t * 18) * 0.012;
      rigY = 2;
    } else if (this.mode === 'sleep') {
      pose = 'sleep';
      const breath = Math.sin(this.t * 1.6);
      this.sqY = 0.88 + breath * 0.03;
      this.sqX = 1.04;
    } else if (this.mode === 'startled') {
      pose = 'idle';
      const k = Math.min(1, this.modeT / 0.3);
      rigY = -Math.sin(k * Math.PI) * 26;
      rigRot = -Math.sin(k * Math.PI) * 0.12;
    } else if (this.mode === 'victory') {
      pose = 'idle';
      const b = Math.abs(Math.sin(this.t * 6.5));
      rigY = -b * 16;
      if (b < 0.1) this.sqY = 0.92;
    } else if (this.mode === 'defeat') {
      pose = 'side';
      const k = Math.min(1, this.modeT / 0.35);
      rigY = -Math.sin(Math.min(1, this.modeT / 0.5) * Math.PI) * 30 * (1 - k * 0.6);
      rigRot = 0.3 * k;
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
        if (this.burstAnimT < HeroView.STRETCH_TIME) pose = 'leap';
      }
      if (s.bursting) rigRot += 0.06;
      if (s.ducking && s.grounded) {
        this.sqX += (1.22 - this.sqX) * Math.min(1, dt * 22);
        this.sqY += (0.6 - this.sqY) * Math.min(1, dt * 22);
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

    this.setPose(pose);
    const B = HeroView.BASE_SCALE;
    this.rig.setScale(B * this.sqX, B * this.sqY);
    this.rig.y = rigY;
    this.rig.rotation = rigRot;
    this.spr.setScale(HeroView.SPRITE_SCALE * stretchX, HeroView.SPRITE_SCALE);
    this.spr.x = stretchShift;
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
