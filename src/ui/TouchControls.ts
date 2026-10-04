import Phaser from 'phaser';
import { DEPTH } from '../data/config';
import { ART_SCALE } from '../systems/AssetRegistry';
import { InputManager } from '../systems/InputManager';
import { COLOR, CSS, textStyle } from './theme';

type Action = 'bark' | 'burst';

const STICK_RADIUS = 72;
const HOME = { x: 160, y: 560 };

/**
 * Touch layout:
 * - Left thumb: a floating joystick (appears where you touch). Up = jump (hold to
 *   spin the tail, push up again in the air to double-jump), down = duck,
 *   left/right = pace back/forward.
 * - Right thumb: BARK, with SPEED (burst) above it. Each button shows its own
 *   recharge as a sweeping fill instead of a separate meter.
 * The action buttons also show on desktop (with key hints) as the recharge readout.
 */
export class TouchControls {
  private barkBtn: Phaser.GameObjects.Image;
  private burstBtn: Phaser.GameObjects.Image;
  private fill: Phaser.GameObjects.Graphics;
  private stickG: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
  private pointerAction = new Map<number, Action>();
  private stickPointer: number | null = null;
  private stickBase = { ...HOME };
  private stickKnob = { x: 0, y: 0 };
  private t = 0;
  private touch: boolean;
  private barkFrac = 1;
  private burstFrac = 1;
  private wasBarkReady = true;
  private wasBurstReady = true;
  private flash = { bark: 0, burst: 0 };
  static readonly BUTTON_RADIUS = 78;

  constructor(private scene: Phaser.Scene, private input: InputManager, private isBlocked: (p: Phaser.Input.Pointer) => boolean) {
    scene.input.addPointer(3);
    this.touch = scene.sys.game.device.input.touch || InputManager.touchMode;
    const btn = (key: string) => scene.add.image(0, 0, key).setScale(ART_SCALE * 1.1).setScrollFactor(0).setDepth(DEPTH.touch);
    this.barkBtn = btn('btn_bark');
    this.burstBtn = btn('btn_burst');
    this.fill = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.touch + 1);
    this.stickG = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.touch);
    for (const t of ['BARK', 'SPEED']) this.labels.push(scene.add.text(0, 0, t, textStyle(16, CSS.cream, 4)).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.touch + 2));
    this.layout(scene.scale.width);
    this.applyMode();

    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.down, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.move, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.up, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.up, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  private get small(): boolean {
    return !this.touch;
  }

  layout(width: number): void {
    const s = this.small ? 0.62 : 1;
    const bx = width - (this.small ? 70 : 120);
    this.barkBtn.setPosition(bx, this.small ? 650 : 600).setScale(ART_SCALE * 1.1 * s);
    this.burstBtn.setPosition(bx - (this.small ? 130 : 0), this.small ? 650 : 448).setScale(ART_SCALE * 1.1 * s);
    this.labels[0].setPosition(this.barkBtn.x, this.barkBtn.y + 56 * s + 6).setText(this.small ? 'BARK · X' : 'BARK');
    this.labels[1].setPosition(this.burstBtn.x, this.burstBtn.y + 56 * s + 6).setText(this.small ? 'SPEED · Shift' : 'SPEED');
  }

  private applyMode(): void {
    this.layout(this.scene.scale.width);
    for (const l of this.labels) l.setFontSize(this.small ? 13 : 16);
  }

  private radius(btn: Phaser.GameObjects.Image): number {
    return 60 * (btn.scaleX / ART_SCALE);
  }

  /** Recharge readouts: 0..1 for bark and burst. */
  update(dt: number, barkFrac: number, burstFrac: number): void {
    this.t += dt;
    this.barkFrac = barkFrac;
    this.burstFrac = burstFrac;
    const g = this.fill;
    g.clear();
    for (const [btn, frac, key] of [[this.barkBtn, barkFrac, 'bark'], [this.burstBtn, burstFrac, 'burst']] as const) {
      const ready = frac >= 1;
      const was = key === 'bark' ? this.wasBarkReady : this.wasBurstReady;
      if (ready && !was) this.flash[key] = 0.45;
      if (key === 'bark') this.wasBarkReady = ready;
      else this.wasBurstReady = ready;
      this.flash[key] = Math.max(0, this.flash[key] - dt);
      const r = this.radius(btn);
      btn.setAlpha(ready ? 1 : 0.75);
      if (!ready) {
        // Dark shutter over the part still recharging; it sweeps away clockwise.
        const a0 = -Math.PI / 2 + frac * Math.PI * 2;
        g.fillStyle(COLOR.outline, 0.62);
        g.slice(btn.x, btn.y, r, a0, -Math.PI / 2 + Math.PI * 2, false);
        g.fillPath();
        g.lineStyle(4, COLOR.white, 0.9);
        g.beginPath();
        g.arc(btn.x, btn.y, r + 3, -Math.PI / 2, a0, false);
        g.strokePath();
      } else {
        const pulse = 0.5 + Math.sin(this.t * 6) * 0.5;
        g.lineStyle(4, key === 'burst' ? COLOR.butter : COLOR.white, 0.5 + pulse * 0.5);
        g.strokeCircle(btn.x, btn.y, r + 3 + this.flash[key] * 30);
      }
    }
    this.drawStick();
  }

  private drawStick(): void {
    const g = this.stickG;
    g.clear();
    if (!this.touch) return;
    const active = this.stickPointer !== null;
    const b = this.stickBase;
    g.fillStyle(COLOR.outline, active ? 0.35 : 0.18);
    g.fillCircle(b.x, b.y, STICK_RADIUS + 14);
    g.lineStyle(4, COLOR.white, active ? 0.7 : 0.35);
    g.strokeCircle(b.x, b.y, STICK_RADIUS + 14);
    // Direction cues: up jump, down duck, left/right pace.
    g.fillStyle(COLOR.white, active ? 0.75 : 0.4);
    const tri = (dx: number, dy: number) => {
      const cx = b.x + dx * (STICK_RADIUS - 6);
      const cy = b.y + dy * (STICK_RADIUS - 6);
      const px = -dy;
      const py = dx;
      g.fillTriangle(cx + dx * 10, cy + dy * 10, cx + px * 9, cy + py * 9, cx - px * 9, cy - py * 9);
    };
    tri(0, -1);
    tri(0, 1);
    tri(-1, 0);
    tri(1, 0);
    const k = active ? this.stickKnob : { x: 0, y: 0 };
    g.fillStyle(COLOR.teal, active ? 0.95 : 0.55);
    g.fillCircle(b.x + k.x, b.y + k.y, 34);
    g.lineStyle(4, COLOR.white, 0.9);
    g.strokeCircle(b.x + k.x, b.y + k.y, 34);
  }

  private actionAt(p: Phaser.Input.Pointer): Action | 'stick' {
    for (const [btn, a] of [[this.burstBtn, 'burst'], [this.barkBtn, 'bark']] as const) {
      if (Phaser.Math.Distance.Between(p.x, p.y, btn.x, btn.y) < TouchControls.BUTTON_RADIUS * (btn.scaleX / (ART_SCALE * 1.1))) return a;
    }
    if (p.x < this.scene.scale.width * 0.5) return 'stick';
    return 'bark';
  }

  private down(p: Phaser.Input.Pointer): void {
    if (this.isBlocked(p)) return;
    if (p.wasTouch && !this.touch) {
      this.touch = true;
      this.applyMode();
    }
    const action = this.actionAt(p);
    if (action === 'stick') {
      if (!this.touch || this.stickPointer !== null) return;
      this.stickPointer = p.id;
      this.stickBase = { x: Phaser.Math.Clamp(p.x, 100, this.scene.scale.width * 0.4), y: Phaser.Math.Clamp(p.y, 330, 620) };
      this.stickKnob = { x: 0, y: 0 };
      this.input.setStick(0, 0, true);
      return;
    }
    this.pointerAction.set(p.id, action);
    this.input.touchDown(action, p.id);
    const btn = action === 'bark' ? this.barkBtn : this.burstBtn;
    btn.setScale(btn.scaleX * 0.92);
  }

  private move(p: Phaser.Input.Pointer): void {
    if (p.id !== this.stickPointer) return;
    let dx = p.x - this.stickBase.x;
    let dy = p.y - this.stickBase.y;
    const d = Math.hypot(dx, dy);
    if (d > STICK_RADIUS) {
      dx = (dx / d) * STICK_RADIUS;
      dy = (dy / d) * STICK_RADIUS;
    }
    this.stickKnob = { x: dx, y: dy };
    this.input.setStick(dx / STICK_RADIUS, dy / STICK_RADIUS, true);
  }

  private up(p: Phaser.Input.Pointer): void {
    if (p.id === this.stickPointer) {
      this.stickPointer = null;
      this.stickBase = { ...HOME };
      this.input.setStick(0, 0, false);
      return;
    }
    const action = this.pointerAction.get(p.id);
    this.pointerAction.delete(p.id);
    this.input.touchUp(p.id);
    if (action) this.layout(this.scene.scale.width);
  }

  destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.down, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.move, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.up, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.up, this);
  }

  /** Test/debug: current recharge readouts. */
  get readouts(): { bark: number; burst: number } {
    return { bark: this.barkFrac, burst: this.burstFrac };
  }
}
